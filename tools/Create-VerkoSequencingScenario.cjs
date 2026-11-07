// Offline generator. Emits an apply_patch payload, not network traffic.
const assert=require('node:assert/strict');
const {LocalTraining,geometry,normalize}=require('../electron-app/src/local-training');
const profile=require('../electron-app/src/training-jet-profile').normalize();
const base=require('../scenarios/CYYZ-West-65-15NM-VERKO-Challenge-D-FastRamp.json');
const plan=require('../scenarios/CYYZ-West-65-15NM-VERKO-Challenge-D-FastRamp-manifest.json');
const stem='CYYZ-VERKO-Sequencing-Drill-Unowned';
const gate=base.waypoints.find(w=>w.name==='VERKO');
function run(aircraft){
 const s=new LocalTraining();s.load({...base,initialOwnership:undefined,jetSpeedProfile:profile,aircraft});return s;
}
function build(){
 const aircraft=[],pairs=[];
 for(const [i,pair] of plan.conflicts.entries()){
  const offsets=[0,-6,6,-4,4],entry=i*360;
  for(const [j,cs] of pair.callsigns.entries()){
   const original=base.aircraft.find(a=>a.callsign===cs),star=original.procedures[0],probe=run([{...original,spawnTime:0}]);
   probe.tick(plan.gateTimes[star]-220);
   const a=probe.aircraft[0];
   aircraft.push({...original,lat:a.lat,lon:a.lon,altitude:a.altitude,heading:a.heading,spawnFix:a.remaining[0],spawnTime:entry+(j?Math.max(0,offsets[i]):Math.max(0,-offsets[i]))});
  }
  pairs.push({callsigns:pair.callsigns,entry,closest:null});
 }
 const scenario=normalize({...base,name:'CYYZ VERKO Sequencing Drill - Unowned',initialOwnership:undefined,aircraft});
 assert(!Object.hasOwn(scenario,'initialOwnership')&&!Object.hasOwn(scenario,'jetSpeedProfile'));
 const sim=run(scenario.aircraft),traffic=new Map();
 const peer={callsign:'TEST_CTR',socket:{destroyed:false,writableLength:0,write:line=>assert(!/:IT:/.test(line),'Unexpected ownership broadcast')}};
 sim.clients.add(peer);
 for(let t=1;t<=2150;t++){
  sim.tick(1);
  const active=sim.aircraft.filter(a=>a.active);
  assert(active.every(a=>!a.trackingController),'Unexpected initial ownership');
  const near=active.filter(a=>geometry(a,gate).distance<2);
  for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++){
   const a=near[i],b=near[j],d=geometry(a,b).distance;
   if(d>=3||Math.abs(a.altitude-b.altitude)>=1000)continue;
   const key=[a.callsign,b.callsign].sort().join('/');
   const old=traffic.get(key);
   if(!old||d<old.distance)traffic.set(key,{time:t,distance:d,altitude:a.altitude});
  }
 }
 assert.equal(traffic.size,pairs.length,'Unexpected VERKO conflict pairs');
 for(const p of pairs){
  const nearest=traffic.get([...p.callsigns].sort().join('/'));
  assert(nearest&&nearest.distance<1,'Missing deliberate close encounter');
  p.closest=nearest;
 }
 return {scenario,pairs};
}
module.exports={build,stem};
if(require.main===module){
 const {scenario,pairs}=build();
 if(process.argv.includes('--check'))console.log(JSON.stringify(pairs,null,2));
 else console.log('*** Begin Patch\n*** Add File: scenarios/'+stem+'.json\n'+JSON.stringify(scenario,null,2).split('\n').map(l=>'+'+l).join('\n')+'\n*** End Patch');
}
