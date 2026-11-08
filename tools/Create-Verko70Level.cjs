const assert=require('node:assert/strict');
const {LocalTraining,normalize,geometry}=require('../electron-app/src/local-training');
const {resolveScenario}=require('../electron-app/src/training-sector');
const base=require('../scenarios/CYYZ-West-70-Five-Streams-11NM-VERKO-Varied-Callsigns.json');
const scenario={...base,name:'CYYZ West - 70 aircraft - five bedposts - 11 NM - hold 8000',aircraft:base.aircraft.map(({initialDescent,...a})=>a)};
const sim=new LocalTraining();sim.load(normalize(resolveScenario(scenario,{})));
const gate=scenario.waypoints.find(w=>w.name==='VERKO'),hits=new Set();
for(let t=0;t<Math.max(...scenario.aircraft.map(a=>a.spawnTime))+650;t+=.25){
 sim.tick(.25);
 assert(sim.aircraft.every(a=>a.altitude===8000),'An aircraft descended without instructor input');
 const near=sim.aircraft.filter(a=>a.active&&geometry(a,gate).distance<=3);
 for(const n of near.filter(a=>a.procedures[0]==='NUBER6'))for(const l of near.filter(a=>a.procedures[0]==='LINNG3'))
  if(geometry(n,l).distance<3)hits.add(n.callsign+'/'+l.callsign);
}
assert.equal(hits.size,16);
if(process.argv.includes('--check'))console.log('70 aircraft hold 8,000 ft; all 16 matched VERKO pairs conflict in calm air.');
else console.log('*** Begin Patch\n*** Add File: scenarios/CYYZ-West-70-Five-Streams-11NM-VERKO-Hold-8000.json\n'+JSON.stringify(scenario,null,2).split('\n').map(l=>'+'+l).join('\n')+'\n*** End Patch');
