// Offline training scenarios. Published flight numbers and origins are used
// as identities only; equipment and spawn schedules are simulated.
const assert=require('node:assert/strict');
const path=require('node:path');
const {LocalTraining,normalize,geometry,move}=require('../electron-app/src/local-training');
const {importSectors,resolveScenario}=require('../electron-app/src/training-sector');
const {lookup}=require('../electron-app/src/training-navdata');
const {origins}=require('./Scenario-Stream-Origins.cjs');
const profile=require('../electron-app/src/training-jet-profile');
const base=require('../scenarios/CYYZ-West-70-Five-Streams-11NM-VERKO-Hold-8000.json');
const catalogue=importSectors([path.join(process.env.APPDATA,'EuroScope/CZYZ/CZYZ.sct')]);
const names=['NUBER6','LINNG3','RAGID6','BOXUM7','IMEBA9'];
const upstream={NUBER6:'NAKBO',LINNG3:'MYPAL',BOXUM7:'DARID'};
// Operating numbers from Pearson arrivals, Plane Finder and Flight.info.
// Regional operators are used where known; equipment is fleet-compatible.
const pools={
 NUBER6:'ACA100 CYVR B77W;ACA122 CYVR B789;ACA128 CYVR A321;ACA132 CYYC A320;ACA148 CYYC A321;ACA152 CYYC B38M;ACA156 CYYC A320;ACA160 CYEG A321;ACA172 CYEG B38M;ACA176 CYEG A320;WJA620 CYYC B738;WJA648 CYYC B38M;WJA650 CYYC B738;WJA654 CYYC B738;WJA714 CYVR B38M;POE664 KLAX E295;POE672 KSFO E295;POE654 KLAS E295;ACA788 KLAX A321;ACA744 KSFO B38M',
 LINNG3:'TSC427 MMUN A332;TSC301 MRLB A321;AAL726 KCLT A321;UAL2044 KIAH B738;AAL1246 KMIA B738;ACA1649 KMIA A321;ACA1679 KMCO B38M;ACA1661 KTPA A320;ACA1015 KRSW A320;ACA1029 KFLL A321;POE526 KTPA E295;POE506 KFLL E295;WJA1115 KFLL B738;WJA1035 KMCO B38M;DAL2422 KATL B739;ACA1872 MRLB A321;WJA2501 MRLB B738;POE768 MMUN E295;ACA1815 MMUN A321',
 RAGID6:'BAW93 EGLL B77W;AFR356 LFPG A359;ETD21 OMAA B789;UAE241 OMDB A388;ACA601 CYHZ A320;ACA603 CYHZ A220;ACA687 CYYT A220;ACA689 CYYT A321;POE200 CYHZ E295;POE210 CYHZ E295;ACA763 KBOS A220;ACA701 KLGA A220;POE608 KLGA E295;ACA639 CYSJ A220;ACA1983 CYQM A220;ACA2013 CYYG A220;ACA2001 CYFC A220',
 BOXUM7:'ACA256 CYWG A321;ACA268 CYWG B38M;ACA1120 CYXE A220;ACA1112 CYQR A220;ACA1940 CYMM A220;WJA382 CYWG B738;WJA384 CYWG B738;WJA432 CYEG B38M;WJA456 CYEG B738;POE428 CYWG E295;FLE640 CYWG B38M;FLE638 CYEG B38M',
 IMEBA9:'ACA409 CYUL A321;ACA427 CYUL A320;ACA429 CYUL A220;ACA481 CYUL A321;ACA439 CYOW A220;ACA451 CYOW A320;ACA467 CYOW A220;ACA471 CYOW A320;ACA1951 CYQB A220;ACA1953 CYQB A220;WJA859 CYUL B738;WJA917 CYUL B738;POE100 CYUL E295;POE110 CYUL E295'
};
const extra={
 NUBER6:'KLAX KSFO', LINNG3:'MMUN MRLB KRSW KFLL KTPA',RAGID6:'EGLL LFPG OMAA OMDB CYYT KLGA CYSJ CYQM CYYG CYFC',
 BOXUM7:'CYQR CYMM',IMEBA9:'CYUL CYOW CYQB'
};
const pool=(star,shift)=>{const rows=pools[star].split(';').map(r=>r.split(' '));return [...rows.slice(shift%rows.length),...rows.slice(0,shift%rows.length)];};
const fix=name=>catalogue.fixes.find(w=>w.name===name)||lookup(catalogue,name);
const gate=fix('VERKO');
function makeBuilder(){
 const points=new Map(base.waypoints.map(w=>[w.name,w]));
 function make(star,runway,identity,distance,index,spawnTime=0){
  const [callsign,origin,model]=identity,bed=star.slice(0,-1),type=model==='A220'?'BCS3':model;
  const known=Object.values(origins[star]).flat();
  assert(known.includes(origin)||extra[star].split(' ').includes(origin),star+' '+origin);
  const choose=catalogue.procedures.find(p=>p.kind==='STAR'&&p.airport==='CYYZ'&&p.name===star&&p.runway===runway&&
    (distance?p.fixes.includes(upstream[star]):p.fixes[0]===bed));
  assert(choose,star+'/'+runway);
  const i=choose.fixes.indexOf(bed),route=choose.fixes.slice(i),anchor=fix(bed);
  let start=anchor,heading=geometry(anchor,fix(route[1])).bearing;
  if(distance){
   const previous=fix(choose.fixes[i-1]),leg=geometry(anchor,previous);
   assert(leg.distance>=distance,star+' transition too short');
   start=move(anchor,distance,leg.bearing);heading=geometry(start,anchor).bearing;
  }
  for(const name of route){const p=fix(name);assert(p,name);points.set(name,p);}
  return {callsign,origin,type,lat:start.lat,lon:start.lon,heading,altitude:distance?11000:8000,speed:distance?230:210,speedBasis:'IAS',rate:2250,
   category:'jet',wake:type==='A388'?'J':/^(?:A33|A35|B77|B78)/.test(type)?'H':'M',destination:'CYYZ',arrivalRunway:runway,
   route:route.join(' '),flightPlanRoute:bed+' '+star+' CYYZ/'+runway,procedures:[star],automaticSpeeds:true,
   scratchpad:runway==='23'?' N':runway==='24R'?' R':' L',remarks:'/v/ OFFLINE TRAINING',equipment:'L',cruiseAltitude:35000,cruiseSpeed:450,
   squawk:(0o2100+index).toString(8),spawnTime};
 }
 function scenario(name,aircraft,owner){return normalize({...base,name,waypoints:[...points.values()],aircraft:aircraft.sort((a,b)=>a.spawnTime-b.spawnTime),initialOwnership:owner,jetSpeedProfile:undefined});}
 return {make,scenario};
}
function replay(scenario,aircraft=scenario.aircraft){
 const sim=new LocalTraining();sim.load({...scenario,aircraft,jetSpeedProfile:profile.normalize()});return sim;
}
function rateScenario(rate,minutes,counts,shift){
 const b=makeBuilder(),aircraft=[],schedule=[];
 counts.forEach((count,j)=>{for(let i=0;i<count;i++)schedule.push({star:names[j],i,phase:(i+(j+1)/6)/count});});
 schedule.sort((a,b)=>a.phase-b.phase);
 schedule.forEach(({star,i},n)=>{
  const runway=['BOXUM7','IMEBA9'].includes(star)?'23':'24R';
  aircraft.push(b.make(star,runway,pool(star,shift)[i],upstream[star]?10:0,n,Math.round(n*360000/rate)/100));
 });
 const s=b.scenario('CYYZ West | '+rate+' AAR | '+minutes+' min | Instructor owned',aircraft,'instructor');
 assert.equal(aircraft.length,rate*minutes/60);
 assert.equal(aircraft.filter(a=>names.slice(0,3).includes(a.procedures[0])).length,aircraft.length*.7);
 assert.equal(s.initialOwnership,'instructor');
 for(const a of aircraft){
  const bed=fix(a.procedures[0].slice(0,-1)),distance=upstream[a.procedures[0]]?10:0;
  assert(Math.abs(geometry(a,bed).distance-distance)<.0001);
  assert.equal(a.altitude,distance?11000:8000);
 }
 return {s,report:{rate,minutes,counts,intervalSeconds:3600/rate}};
}
function challenge(){
 const b=makeBuilder(),stars=names.slice(0,2),count=10;
 const aircraft=stars.flatMap((star,j)=>pool(star,j).slice(0,count).map((id,i)=>b.make(star,'24L',id,0,j*count+i)));
 const s=b.scenario('CYYZ VERKO | 24L | 10 MIT | Every pair | 8000 ft | Unowned',aircraft);
 const measures=stars.map(star=>{
  const a=aircraft.find(a=>a.procedures[0]===star),sim=replay(s,[a]);let interval,closest=Infinity,gateTime=0;
  for(let i=0;i<2600;i++){sim.tick(.25);const p=sim.aircraft[0];if(!p)break;
   if(interval===undefined&&geometry(a,p).distance>=10)interval=sim.elapsed;
   const d=geometry(gate,p).distance;if(d<closest){closest=d;gateTime=sim.elapsed;}
  }
  assert(interval&&closest<2,star+' '+closest);return {interval,gateTime};
 });
 const first=Math.max(...measures.map(m=>m.gateTime)),groups=stars.map(star=>aircraft.filter(a=>a.procedures[0]===star));
 groups.forEach((group,j)=>group.forEach((a,i)=>a.spawnTime=first-measures[j].gateTime+i*measures[j].interval));
 const final=b.scenario(s.name,aircraft),sim=replay(final),seen=new Set(),hits=new Map(),spacing=[];
 const expected=new Set(groups[0].map((a,i)=>a.callsign+'/'+groups[1][i].callsign));
 const previous=new Map(groups.flatMap(group=>group.slice(1).map((a,i)=>[a.callsign,group[i].callsign])));
 while(sim.elapsed<Math.max(...aircraft.map(a=>a.spawnTime))+650){
  sim.tick(.25);const active=sim.aircraft.filter(a=>a.active);
  assert(active.every(a=>a.altitude===8000&&!a.trackingController));
  for(const a of active)if(previous.has(a.callsign)&&!seen.has(a.callsign)){
   const prior=active.find(p=>p.callsign===previous.get(a.callsign));assert(prior);
   spacing.push(geometry(a,prior).distance);seen.add(a.callsign);
  }
  const near=active.filter(a=>geometry(a,gate).distance<=3);
  for(const a of near.filter(a=>a.procedures[0]===stars[0]))for(const b of near.filter(a=>a.procedures[0]===stars[1])){
   const d=geometry(a,b).distance,k=a.callsign+'/'+b.callsign;
   if(d<3)hits.set(k,Math.min(d,hits.get(k)??Infinity));
  }
 }
 assert.deepEqual(new Set(hits.keys()),expected);
 assert.equal(spacing.length,18);assert(spacing.every(d=>Math.abs(d-10)<.05),spacing.join(','));
 return {s:final,report:{matchedConflicts:hits.size,closestApproachesNM:[Math.min(...hits.values()),Math.max(...hits.values())],entrySpacingNM:[Math.min(...spacing),Math.max(...spacing)]}};
}
const results={
 'CYYZ-VERKO-24L-10MIT-Every-Pair-Unowned':challenge(),
 'CYYZ-West-70-AAR-Instructor-Owned':rateScenario(70,60,[17,17,15,10,11],0),
 'CYYZ-West-120-AAR-Instructor-Owned':rateScenario(120,30,[14,14,14,9,9],1)
};
for(const {s,report} of Object.values(results)){
 const imported=normalize(resolveScenario(s,{}));assert.equal(imported.aircraft.length,s.aircraft.length);
 assert.equal(new Set(s.aircraft.map(a=>a.callsign)).size,s.aircraft.length);
 assert(s.aircraft.some(a=>a.wake==='H')&&s.aircraft.some(a=>a.wake==='M'));
 assert(!Object.hasOwn(s,'jetSpeedProfile')&&s.aircraft.every(a=>a.remarks.includes('/v/')&&!a.initialDescent));
 assert(imported.aircraft.every(a=>a.scratchpad===({'23':' N','24R':' R','24L':' L'})[a.arrivalRunway]));
 if(!process.argv.includes('--patch'))console.log(s.name,JSON.stringify(report));
}
if(process.argv.includes('--patch')){
 console.log('*** Begin Patch');
 for(const [name,{s}] of Object.entries(results))console.log('*** Add File: scenarios/'+name+'.json\n+'+JSON.stringify(s).replace(/,"aircraft":\[/,',"aircraft":[\n').replace(/\},\{"callsign":/g,'},\n{"callsign":').split('\n').join('\n+'));
 console.log('*** End Patch');
}
