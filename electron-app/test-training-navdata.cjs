const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {lookup,parsePoints}=require('./src/training-navdata'),{importSectors,resolveScenario}=require('./src/training-sector'),{normalize,LocalTraining,geometry}=require('./src/local-training');
test('companion fixes, airport/nav coordinates, airway-only endpoints, ambiguity and portable scenario lookup',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-nav-'));try{
  fs.mkdirSync(path.join(root,'navdata'));fs.writeFileSync(path.join(root,'test.sct'),'[FIXES]\nBASE N043.00.00.000 W079.00.00.000\n');fs.writeFileSync(path.join(root,'navdata/isec.txt'),'; synthetic\nMISSING\t43.5\t-79.5\t15\nDUP\t43.1\t-79\t15\nDUP\t-20\t130\t15\nAMBIG\t43.1\t-79\t15\nAMBIG\t43.2\t-79\t15\nBAD\t95\t-79\t15');fs.writeFileSync(path.join(root,'navdata/icao.txt'),'TEST\t43.2\t-79.2\tSynthetic airport');
  fs.writeFileSync(path.join(root,'navdata/airway.txt'),'EDGE\t43\t-79\t14\tQ1\tL\tEND\t43.2\t-79.3\t0\tY\t\t\t\t0\tN');
  const c=importSectors([path.join(root,'test.sct')]);assert.equal(lookup(c,'MISSING').lat,43.5);assert.equal(lookup(c,'TEST').lon,-79.2);assert.equal(lookup(c,'END').lat,43.2);assert.equal(lookup(c,'DUP').lat,43.1);assert.throws(()=>lookup(c,'AMBIG'),/Ambiguous/);assert.equal(lookup(c,'BAD'),null);assert.equal(parsePoints('A NaN 5\nB 45 181').length,0);
  const raw={format:'ZYZTools-training',version:1,waypoints:[],aircraft:[{callsign:'TEST1',type:'A320',lat:43,lon:-79,altitude:17000,speed:270,heading:0,route:'BASE MISSING TEST',spawnFix:'MISSING'}]};
  const s=normalize(resolveScenario(raw,c));assert.equal(s.aircraft[0].rate,2250);assert.equal(s.aircraft[0].lat,43.5);assert.equal(s.waypoints.length,3);assert.deepEqual(normalize(resolveScenario(s,{fixes:[]})),s);
  const sim=new LocalTraining();sim.load(s);sim.command('TEST1','ALT 11000');sim.tick(60);assert.equal(sim.aircraft[0].altitude,14750);sim.command('TEST1','RATE 3000');sim.tick(60);assert.equal(sim.aircraft[0].altitude,11750);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('bundled Toronto scenarios: exact stream schedules, runway mapping, bedpost altitude, no external catalogue required',()=>{
 for(const file of ['CYYZ-West-65-per-hour.json','CYYZ-East-40-per-hour-with-departures.json','CYYZ-West-10NM-spacing-20min.json']){
  const s=JSON.parse(fs.readFileSync(path.join(__dirname,'../scenarios',file))),east=file.includes('East'),spacing=file.includes('10NM');assert.deepEqual(normalize(resolveScenario(s,{fixes:[]})),s);assert.equal(s.aircraft.length,spacing?55:east?50:65);assert.equal(new Set(s.aircraft.map(a=>a.squawk)).size,s.aircraft.length);
  assert(s.aircraft.every(a=>a.remarks.includes('/v/')),'Every arrival and departure must have /v/ remarks');
  for(const [star,count]of [['LINNG3',20],['NUBER6',15],['BOXUM7',10],['IMEBA9',10],['RAGID6',10]]){
   const rows=s.aircraft.filter(a=>a.procedures.includes(star));assert.equal(rows.length,spacing?11:east?8:count);assert.equal(rows[0].arrivalRunway,['BOXUM7','IMEBA9'].includes(star)?east?'05':'23':east?'06R':'24R');
   if(!spacing)for(let i=1;i<rows.length;i++)assert(Math.abs(rows[i].spawnTime-rows[i-1].spawnTime-(east?450:3600/count))<.02);
   const sim=new LocalTraining();sim.load({...s,aircraft:[{...rows[0],spawnTime:0}]});let reached=false;for(let t=0;t<900;t+=.25){sim.tick(.25);const a=sim.aircraft[0];if(a.passedFixes.includes(a.initialDescent.fix)){assert.equal(a.altitude,a.initialDescent.altitude,star+' bedpost altitude');assert.equal(a.rate,2250);reached=true;break;}}assert(reached,star+' must cross its bedpost');
   if(spacing){sim.reset();sim.tick(rows[1].spawnTime-rows[0].spawnTime);assert(Math.abs(geometry(rows[1],sim.aircraft[0]).distance-10)<.04,star+' initial 10NM spacing');}
  }
  if(east){const deps=s.aircraft.filter(a=>a.origin==='CYYZ');assert.equal(deps.length,10);assert(deps.every(a=>a.flightPlanRoute.startsWith('CYYZ/05 ')));}
 }
});
