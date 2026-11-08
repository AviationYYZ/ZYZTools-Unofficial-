const assert=require('node:assert/strict');
const {LocalTraining,normalize,geometry}=require('../electron-app/src/local-training');
const {resolveScenario}=require('../electron-app/src/training-sector');
const base=require('../scenarios/CYYZ-VERKO-15NM-Every-2-Unowned.json');
const profile=require('../electron-app/src/training-jet-profile').normalize();
const fixes=new Map(base.waypoints.map(w=>[w.name,w])),gate=fixes.get('VERKO');
const sim=aircraft=>{const s=new LocalTraining();s.load({...base,initialOwnership:undefined,jetSpeedProfile:profile,aircraft});return s;};
const streams=['NUBER6','LINNG3'].map((star,j)=>{
 const pool=base.aircraft.filter(a=>a.procedures[0]===star&&a.category==='jet');
 const route=pool[0].route.split(' ').filter(n=>!n.startsWith('SP15_')),bedpost=fixes.get(route[0]),next=fixes.get(route[1]);
 const template={...pool[0],lat:bedpost.lat,lon:bedpost.lon,heading:geometry(bedpost,next).bearing,route:route.join(' '),altitude:8000,speed:210,spawnTime:0,spawnFix:'',initialDescent:undefined};
 const solo=sim([template]);let interval,gateTime,closest=Infinity;
 for(let t=0;t<700;t+=.25){
  solo.tick(.25);const a=solo.aircraft[0];if(!a)break;
  if(interval===undefined&&geometry(a,bedpost).distance>=11)interval=solo.elapsed;
  const d=geometry(a,gate).distance;if(d<closest){closest=d;gateTime=solo.elapsed;}
 }
 assert(interval&&gateTime);
 return {gateTime,interval,bedpost,aircraft:Array.from({length:35},(_,i)=>{
  const a=pool[i%pool.length];
  return {...template,...a,lat:template.lat,lon:template.lon,heading:template.heading,route:template.route,altitude:8000,speed:210,initialDescent:undefined,spawnFix:'',spawnTime:0,
   callsign:a.callsign.replace(/\d+$/,'')+(j===0?5100+i:6100+i),squawk:(1200+j*35+i).toString(8).padStart(4,'0')};
 })};
});
const offsets=streams.map(s=>Math.max(...streams.map(a=>a.gateTime))-s.gateTime);
for(const [j,stream] of streams.entries())for(const [i,a] of stream.aircraft.entries())a.spawnTime=offsets[j]+i*stream.interval;
const scenario=normalize({...base,name:'CYYZ VERKO - 70 aircraft - 11 NM - Bedpost at 8000',initialOwnership:undefined,jetSpeedProfile:undefined,aircraft:streams.flatMap(s=>s.aircraft).sort((a,b)=>a.spawnTime-b.spawnTime)});
const imported=normalize(resolveScenario(scenario,{})),s=sim(imported.aircraft);
assert(s.aircraft.every(a=>a.altitude===8000&&!a.trackingController&&a.remarks.includes('/v/')));
const expected=new Set(streams[0].aircraft.map((a,i)=>a.callsign+'/'+streams[1].aircraft[i].callsign));
const previous=new Map(streams.flatMap(({aircraft})=>aircraft.slice(1).map((a,i)=>[a.callsign,aircraft[i].callsign])));
const hits=new Map(),seen=new Set();let min=Infinity,max=0;
const end=Math.max(...scenario.aircraft.map(a=>a.spawnTime))+600;
for(let t=0;t<end;t+=.25){
 s.tick(.25);const active=s.aircraft.filter(a=>a.active);
 for(const a of active){
  if(!previous.has(a.callsign)||seen.has(a.callsign))continue;
  const prior=active.find(p=>p.callsign===previous.get(a.callsign));assert(prior);
  const d=geometry(a,prior).distance;min=Math.min(min,d);max=Math.max(max,d);seen.add(a.callsign);
 }
 const near=active.filter(a=>geometry(a,gate).distance<=3);
 for(const n of near.filter(a=>a.procedures[0]==='NUBER6'))for(const l of near.filter(a=>a.procedures[0]==='LINNG3')){
  const key=n.callsign+'/'+l.callsign,d=geometry(n,l).distance;
  if(d<3&&Math.abs(n.altitude-l.altitude)<1000&&(!hits.has(key)||hits.get(key).distance>d))hits.set(key,{distance:d,time:s.elapsed});
 }
}
assert.equal(seen.size,68);assert(min>=10.97&&max<=11.03,[min,max]);
assert.deepEqual(new Set(hits.keys()),expected,'Unexpected VERKO encounter pattern');
if(process.argv.includes('--check'))console.log(JSON.stringify({aircraft:70,conflicts:hits.size,spawnSpacing:[min,max],lastSpawn:Math.max(...scenario.aircraft.map(a=>a.spawnTime)),firstConflict:[...hits.values()][0],lastConflict:[...hits.values()].at(-1),intervals:streams.map(s=>s.interval)},null,2));
else console.log('*** Begin Patch\n*** Add File: scenarios/CYYZ-VERKO-70-11NM-Bedpost-8000.json\n'+JSON.stringify(scenario,null,2).split('\n').map(l=>'+'+l).join('\n')+'\n*** End Patch');
