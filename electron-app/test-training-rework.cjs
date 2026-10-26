const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {LocalTraining,geometry,move}=require('./src/local-training'),flight=require('./src/training-flight'),{normalizeCommand}=require('./src/training-commands'),{parse}=require('./src/training-sweatbox');
const runway={airport:'CYYZ',name:'09',threshold:{lat:0,lon:0},opposite:{lat:0,lon:.02},elevation:0};
const plane={callsign:'TEST101',type:'A320',lat:0,lon:0,altitude:5000,speed:250,speedBasis:'IAS',heading:0,route:'TURN EXIT',flightPlanRoute:'TURN EXIT',arrivalRunway:'09',squawk:'2001'};
const base={format:'ZYZTools-training',version:1,name:'Rework',magneticVariationWest:0,runways:[runway],waypoints:[{name:'TURN',lat:.12,lon:0},{name:'EXIT',lat:.12,lon:-.25}],aircraft:[plane]};
for(const altitude of [0,4999,5000,7500,10000,10001,28000]){const a={...plane,altitude,baseIAS:250,ias:250,navigation:'heading',heading:0,targetHeading:0};assert.equal(flight.publishedIAS(a,[],[],geometry,[runway]),altitude>10000?270:250);}
for(const altitude of [3000,5000,9000]){
 const s=new LocalTraining();s.load({...base,aircraft:[{...plane,altitude}]});let turned=false;
 for(let i=0;i<1600;i++){s.tick(.1);const a=s.aircraft[0];if(Math.abs(((a.heading+540)%360)-180)>2){assert(a.ias<=210.5,'210 before downwind turn at '+altitude+': '+a.ias);turned=true;break;}}
 assert(turned);s.command('TEST101','IAS 230');s.tick(20);assert.equal(s.aircraft[0].ias,230);s.command('TEST101','SPEED PUBLISHED');s.tick(20);assert.equal(s.aircraft[0].ias,210);
}
const vectors=new LocalTraining();vectors.load({...base,aircraft:[{...plane,route:'',flightPlanRoute:'',heading:0}]});vectors.command('TEST101','HDG 270');vectors.tick(.1);assert.equal(vectors.aircraft[0].targetIAS,210);
assert.equal(normalizeCommand('.LHDG 330, ALT 3000, .IAS 210'),'LHDG 330, ALT 3000, IAS 210');
const s=new LocalTraining();s.load(base);s.command('TEST101','LHDG 330, ALT 3000, RATE 2500');assert.equal(s.aircraft[0].targetHeading,330);assert.equal(s.aircraft[0].targetAltitude,3000);assert.equal(s.aircraft[0].rate,2500);assert.equal(s.aircraft[0].turnDirection,-1);
for(const command of ['HDG 100, ALT 90000','ALT 2000, DCT MISSING','IDENT, DELETE','HDG 100,','ALT 2000, garbage',Array(9).fill('IDENT').join(',')]){const old=JSON.stringify(s.aircraft);assert.throws(()=>s.command('TEST101',command));assert.equal(JSON.stringify(s.aircraft),old,'Bad batch must be atomic: '+command);}
s.command('TEST101','IDENT, PAUSE ON');assert(s.aircraft[0].identActive&&s.aircraft[0].paused);
const wire=[],c={callsign:'TOR_APP'};s.write=(_,l)=>wire.push(l);s.receive(c,'$CQTOR_APP:SERVER:BC:TEST101');assert(wire.includes('$CQSERVER:TOR_APP:BC:TEST101:2001'));assert.equal(s.aircraft[0].assignedSquawk,'2001');s.receive(c,'$CQTOR_APP:SERVER:FP:TEST101');assert(wire.some(l=>l.startsWith('$FPTEST101:TOR_APP:')));
for(const speed of [140,210,250,300])for(const altitude of [3000,15000])for(const side of [-1,1]){
 const sim=new LocalTraining();sim.load({...base,waypoints:[{name:'TURN',lat:0,lon:.12},{name:'EXIT',lat:side*.25,lon:.12}],aircraft:[{...plane,altitude,speed,publishedSpeeds:false,heading:90}]});let max=0;
 for(let i=0;i<3600;i++){sim.tick(.1);const a=sim.aircraft[0];if(a.lat*side<.2)max=Math.max(max,(a.lon-.12)*60);}
 assert(max<.04,'Outbound course overshoot below .04 NM: '+[speed,altitude,side,max]);
}
for(const speed of [140,250,350])for(const dir of [-1,0,1]){
 let a={speed,heading:1,targetHeading:359,bank:0,turnDirection:dir};for(let t=0;t<300;t+=.1)flight.turnMotion(a,.1);assert.equal(a.heading,359);assert.equal(a.bank,0);
}
const text=['AIRPORT_ALT:550','@N:PTEST101:0508:1:44:-80:13000:0:1036:0','$FPTEST101:*A:I:A320/L:420:CYUL:::350:CYYZ:1:0:2:0::/v/:ENTRY','$ROUTE:ENTRY'].join('\n');
const repaired=parse(text,{fixes:[{name:'ENTRY',lat:43.8,lon:-79.7}]});assert.equal(repaired.report.imported,1);assert.equal(repaired.scenario.aircraft[0].callsign,'PTEST101');assert(/^[0-7]{4}$/.test(repaired.scenario.aircraft[0].squawk));assert(repaired.report.warnings.some(w=>w.includes('repaired flight-plan')));assert(repaired.report.warnings.some(w=>w.includes('replaced invalid/duplicate')));
const folder=path.join(process.env.USERPROFILE,'OneDrive/Documents/sweatbox/ES'),file=path.join(folder,'ARR - 06 Hard.txt'),sct=path.join(process.env.APPDATA,'EuroScope/CZYZ/CZYZ.sct');
if(fs.existsSync(file)&&fs.existsSync(sct)){
 const imported=parse(fs.readFileSync(file),require('./src/training-sector').importSectors([sct]));assert.equal(imported.report.total,44);assert.equal(imported.report.imported,44);assert.deepEqual(imported.report.rejected,[]);assert.equal(new Set(imported.scenario.aircraft.map(a=>a.squawk)).size,44);
 const sim=new LocalTraining();sim.load(imported.scenario);const packets=[];sim.broadcast=l=>packets.push(l);sim.reset();sim.tick(Math.max(...sim.aircraft.map(a=>a.spawnTime))+1);sim.broadcastAll();
 for(const a of sim.aircraft){assert(a.active);assert(packets.some(l=>l.startsWith('@N:'+a.callsign+':')));assert(packets.some(l=>l.startsWith('$FP'+a.callsign+':')));assert.equal(a.assignedSquawk,a.squawk);}
 const points=new Map(imported.scenario.waypoints.map(w=>[w.name,w])),verko=points.get('VERKO'),course=geometry(points.get('SEGOD'),verko).bearing,linng=imported.scenario.aircraft.find(a=>a.callsign==='ACA101');
 for(const altitude of [3000,6000,9000]){
  const model=new LocalTraining();model.load({...imported.scenario,aircraft:[{...linng,...move(verko,10,course+180),heading:course,altitude,speed:250,route:linng.route.slice(linng.route.indexOf('VERKO'))}]});let corner=false,done=false,downwind=false;
  for(let t=0;t<2000;t+=.25){model.tick(.25);const a=model.aircraft[0];if(!downwind&&Math.abs(((a.heading-course+540)%360)-180)>2){assert(a.ias<=210.5,'LINNG downwind at 210 IAS');downwind=true;}if(a.flyBy?.next==='LOBKO')corner=true;if(corner&&!a.flyBy&&a.remaining[0]==='LOBKO'){const leg=geometry(points.get('YZDW06'),points.get('LOBKO')),g=geometry(points.get('YZDW06'),a),cross=g.distance*Math.sin((g.bearing-leg.bearing)*Math.PI/180);assert(Math.abs(cross)<.08,'LINNG 172-degree rollout cross-track: '+cross+' at '+altitude);console.log('LINNG sharp-turn rollout cross-track at '+altitude+' ft: '+cross.toFixed(3)+' NM');done=true;break;}}
  assert(downwind&&done,'Exercise both actual LINNG downwind and near-reversal');
 }
 console.log('PASS actual ARR - 06 Hard: 44/44 import, unique valid squawks, all scheduled targets activated with position and flight plan; actual LINNG turns at three altitudes.');
}
console.log('PASS altitude/downwind profile, IAS overrides, comma batches/atomic failures, assignment queries, bounded turn overshoot, directed wraps, reported legacy repairs.');
