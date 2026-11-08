const assert=require('node:assert/strict');
const {LocalTraining,normalize,geometry,move}=require('../electron-app/src/local-training');
const base=require('../scenarios/CYYZ-VERKO-15NM-Every-2-Unowned.json');
const profile=require('../electron-app/src/training-jet-profile').normalize();
const fixes=new Map(base.waypoints.map(w=>[w.name,w])),gate=fixes.get('VERKO');
const resolve=require('../electron-app/src/training-sector').resolveScenario;
function build(offsets){return ['NUBER6','LINNG3'].map((star,index)=>{
 const pool=base.aircraft.filter(a=>a.procedures[0]===star&&a.category==='jet').slice(0,6);
 assert.equal(pool.length,6);
 const route=pool[0].route.split(' ').filter(n=>!n.startsWith('SP15_'));
 const bedpost=fixes.get(route[0]),outbound=geometry(bedpost,fixes.get('SP15_'+route[0])).bearing;
 return pool.map((a,i)=>{
  const pos=move(bedpost,offsets[index]+12*i,outbound);
  return {...a,...pos,heading:geometry(pos,bedpost).bearing,spawnFix:'',route:route.join(' '),altitude:11000,speed:230,spawnTime:0,initialDescent:undefined};
 });
});}
function gateTime(a){
 const s=new LocalTraining();s.load({...base,aircraft:[a],jetSpeedProfile:profile});let best=Infinity,time=0;
 for(let t=0;t<800;t+=.25){s.tick(.25);const d=geometry(s.aircraft[0],gate).distance;if(d<best){best=d;time=s.elapsed;}}
 return time;
}
const offsets=[4,4],probe=build(offsets),difference=gateTime(probe[0][0])-gateTime(probe[1][0]);
offsets[difference>0?1:0]+=Math.abs(difference)*require('../electron-app/src/training-flight').iasToTas(230,11000)/3600;
const streams=build(offsets);
const scenario=normalize({...base,name:'CYYZ VERKO - 12 NM inbound to bedposts - all aircraft at 11000',aircraft:streams.flat(),jetSpeedProfile:undefined,initialOwnership:undefined});
const imported=normalize(resolve(scenario,{}));
const sim=new LocalTraining();sim.load({...imported,jetSpeedProfile:profile});
assert(sim.aircraft.every(a=>a.active&&a.altitude===11000&&!a.trackingController));
for(const stream of streams){
 const live=stream.map(a=>sim.aircraft.find(b=>b.callsign===a.callsign));
 for(let i=0;i<live.length;i++){
  assert(geometry(stream[i],live[i]).distance<.001);
  assert.equal(live[i].remaining[0],stream[i].procedures[0].replace(/\d+$/,''));
  if(i)assert(Math.abs(geometry(live[i-1],live[i]).distance-12)<.001);
 }
}
const hits=new Map();
for(let t=0;t<1500;t+=.25){
 sim.tick(.25);
 const near=sim.aircraft.filter(a=>geometry(a,gate).distance<=3);
 for(const n of near.filter(a=>a.procedures[0]==='NUBER6'))for(const l of near.filter(a=>a.procedures[0]==='LINNG3')){
  const d=geometry(n,l).distance,key=n.callsign+'/'+l.callsign;
  if(d<3&&Math.abs(n.altitude-l.altitude)<1000&&(!hits.has(key)||hits.get(key).distance>d))hits.set(key,{distance:d,time:sim.elapsed});
 }
}
const expected=streams[0].map((a,i)=>a.callsign+'/'+streams[1][i].callsign);
assert.deepEqual([...hits.keys()].sort(),expected.sort(),JSON.stringify([...hits]));
if(process.argv.includes('--check'))console.log(JSON.stringify([...hits],null,2));
else console.log('*** Begin Patch\n*** Add File: scenarios/CYYZ-VERKO-12NM-Bedpost-Lines-Unowned.json\n'+JSON.stringify(scenario,null,2).split('\n').map(l=>'+'+l).join('\n')+'\n*** End Patch');
