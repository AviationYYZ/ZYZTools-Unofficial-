const assert=require('node:assert/strict');
const {LocalTraining,geometry,normalize}=require('../electron-app/src/local-training');
const base=require('../scenarios/CYYZ-West-65-15NM-VERKO-Challenge-D-FastRamp.json');
const entry=require('../scenarios/CYYZ-VERKO-Sequencing-Drill-Unowned.json');
const profile=require('../electron-app/src/training-jet-profile').normalize();
const spacingNM=process.argv.includes('--15nm')?15:10;
const gate=base.waypoints.find(w=>w.name==='VERKO');
const run=aircraft=>{const s=new LocalTraining();s.load({...base,initialOwnership:undefined,jetSpeedProfile:profile,aircraft});return s;};
function build(every){
 const streams=['NUBER6','LINNG3'].map(star=>{
  const start=entry.aircraft.find(a=>a.procedures[0]===star);
  let next=0;
  return base.aircraft.filter(a=>a.procedures[0]===star).slice(0,12).map((a,i)=>{
   const plane={...a,initialDescent:undefined,lat:start.lat,lon:start.lon,heading:start.heading,spawnFix:start.spawnFix,altitude:star==='LINNG3'&&(i+1)%every?9000:11000,spawnTime:next};
   const sim=run([{...plane,spawnTime:0}]);let spacing,closest={distance:Infinity,time:0};
   for(let t=0;t<420;t+=0.25){
    sim.tick(0.25);const live=sim.aircraft[0];if(!live)break;
    if(spacing===undefined&&geometry(live,plane).distance>=spacingNM)spacing=sim.elapsed;
    const d=geometry(live,gate).distance;if(d<closest.distance)closest={distance:d,time:sim.elapsed};
   }
   assert(spacing);next+=spacing;return {plane,gateTime:plane.spawnTime+closest.time};
  });
 });
 const differences=streams[0].map((p,i)=>p.gateTime-streams[1][i].gateTime).filter((_,i)=>(i+1)%every===0);
 const offset=(Math.min(...differences)+Math.max(...differences))/2;
 for(const p of streams[0])p.plane.spawnTime+=Math.max(0,-offset);
 for(const p of streams[1])p.plane.spawnTime+=Math.max(0,offset);
 const scenario=normalize({...base,name:'CYYZ VERKO - '+spacingNM+' NM streams - conflict every '+every+' pairs - Unowned',initialOwnership:undefined,jetSpeedProfile:undefined,aircraft:streams.flat().map(p=>p.plane).sort((a,b)=>a.spawnTime-b.spawnTime)});
 const sim=run(scenario.aircraft),hits=new Map();let minSpacing=Infinity,maxSpacing=0;
 const expected=new Set(streams[0].flatMap((p,i)=>(i+1)%every===0?[p.plane.callsign+'/'+streams[1][i].plane.callsign]:[]));
 const entries=new Map(streams.flatMap(stream=>stream.slice(1).map((p,i)=>[p.plane.callsign,stream[i].plane.callsign])));
 const checked=new Set();
 for(let t=0;t<4000;t+=0.25){
  sim.tick(0.25);const active=sim.aircraft.filter(a=>a.active);
  assert(active.every(a=>!a.trackingController));
  for(const a of active){
   if(entries.has(a.callsign)&&!checked.has(a.callsign)){
    const predecessor=active.find(b=>b.callsign===entries.get(a.callsign));assert(predecessor);
    const distance=geometry(a,predecessor).distance;minSpacing=Math.min(minSpacing,distance);maxSpacing=Math.max(maxSpacing,distance);checked.add(a.callsign);
   }
  }
  const near=active.filter(a=>geometry(a,gate).distance<=3);
  for(const n of near.filter(a=>a.procedures[0]==='NUBER6'))for(const l of near.filter(a=>a.procedures[0]==='LINNG3')){
   const d=geometry(n,l).distance,key=n.callsign+'/'+l.callsign;
   if(d<3&&Math.abs(n.altitude-l.altitude)<1000&&(!hits.has(key)||d<hits.get(key).distance))hits.set(key,{time:sim.elapsed,distance:d});
  }
 }
 assert.equal(checked.size,22);assert(minSpacing>=spacingNM-.05&&maxSpacing<=spacingNM+.05);
 assert.deepEqual(new Set(hits.keys()),expected,'Unexpected VERKO encounter pattern');
 return {scenario,report:{every,entrySpacingNM:[minSpacing,maxSpacing],encounters:[...hits]}};
}
for(const every of [2,4]){
 const {scenario,report}=build(every);
 if(process.argv.includes('--check'))console.log(JSON.stringify(report,null,2));
 else if(process.argv.includes(String(every)))console.log('*** Begin Patch\n*** Add File: scenarios/CYYZ-VERKO-'+spacingNM+'NM-Every-'+every+'-Unowned.json\n'+JSON.stringify(scenario,null,2).split('\n').map(l=>'+'+l).join('\n')+'\n*** End Patch');
}
