const assert=require('node:assert/strict');
const {LocalTraining,normalize,geometry}=require('../electron-app/src/local-training');
const {resolveScenario}=require('../electron-app/src/training-sector');
const base=require('../scenarios/CYYZ-West-65-15NM-VERKO-Challenge-D-FastRamp.json');
const profile=require('../electron-app/src/training-jet-profile').normalize();
const fixes=new Map(base.waypoints.map(w=>[w.name,w])),gate=fixes.get('VERKO');
const setup=[['NUBER6',16,0],['LINNG3',22,0],['BOXUM7',11,23],['IMEBA9',11,57],['RAGID6',10,89]];
const run=aircraft=>{const s=new LocalTraining();s.load({...base,initialOwnership:undefined,jetSpeedProfile:profile,aircraft});return s;};
const streams=setup.map(([star,count,offset],j)=>{
 const pool=base.aircraft.filter(a=>a.procedures[0]===star&&a.category==='jet');
 const route=pool[0].route.split(' ').filter(n=>!n.startsWith('SP15_'));
 const bedpost=fixes.get(route[0]),heading=geometry(bedpost,fixes.get(route[1])).bearing;
 function plane(i){const a=pool[i%pool.length];return {...a,lat:bedpost.lat,lon:bedpost.lon,heading,route:route.join(' '),altitude:8000,speed:210,spawnFix:'',spawnTime:0,
  initialDescent:star==='LINNG3'&&i%2===0?{fix:'BIMPO',altitude:6000}:undefined,
  callsign:a.callsign.replace(/\d+$/,'')+(5100+j*100+i),squawk:(1300+j*35+i).toString(8).padStart(4,'0')};}
 function measure(a){
  const s=run([a]);let interval,gateTime,closest=Infinity;
  for(let t=0;t<700;t+=.25){s.tick(.25);const live=s.aircraft[0];if(!live)break;
   if(interval===undefined&&geometry(live,bedpost).distance>=11)interval=s.elapsed;
   const d=geometry(live,gate).distance;if(d<closest){closest=d;gateTime=s.elapsed;}
  }
  assert(interval,star);return {interval,gateTime};
 }
 const nominal=measure(plane(1)),alternate=star==='LINNG3'?measure(plane(0)):nominal;
 const aircraft=Array.from({length:count},(_,i)=>plane(i));let time=0;
 aircraft.forEach((a,i)=>{a.spawnTime=time;time+=(i%2===0?alternate:nominal).interval;});
 return {aircraft,bedpost,gateTime:nominal.gateTime,offset};
});
const crossTime=Math.max(streams[0].gateTime,streams[1].gateTime);
for(let j=0;j<streams.length;j++){const stream=streams[j];for(const a of stream.aircraft)a.spawnTime+=j<2?crossTime-stream.gateTime:stream.offset;}
const scenario=normalize({...base,name:'CYYZ West - 70 aircraft - five bedposts - 11 NM - alternating VERKO conflicts',initialOwnership:undefined,jetSpeedProfile:undefined,aircraft:streams.flatMap(s=>s.aircraft).sort((a,b)=>a.spawnTime-b.spawnTime)});
const imported=normalize(resolveScenario(scenario,{})),s=run(imported.aircraft);
assert(s.aircraft.every(a=>a.altitude===8000&&!a.trackingController&&a.remarks.includes('/v/')));
assert.equal(new Set(scenario.aircraft.map(a=>a.spawnTime)).size,70);
const expected=new Set(streams[0].aircraft.flatMap((a,i)=>i%2?[a.callsign+'/'+streams[1].aircraft[i].callsign]:[]));
const previous=new Map(streams.flatMap(({aircraft})=>aircraft.slice(1).map((a,i)=>[a.callsign,aircraft[i].callsign])));
const hits=new Map(),seen=new Set();let min=Infinity,max=0;
const end=Math.max(...scenario.aircraft.map(a=>a.spawnTime))+650;
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
assert.equal(seen.size,65);assert(min>=10.97&&max<=11.03,[min,max]);
assert.deepEqual(new Set(hits.keys()),expected,'Unexpected VERKO encounter pattern');
if(process.argv.includes('--check'))console.log(JSON.stringify({aircraft:70,streams:setup,conflicts:hits.size,spawnSpacing:[min,max],firstConflict:[...hits.values()][0],lastConflict:[...hits.values()].at(-1),lastSpawn:Math.max(...scenario.aircraft.map(a=>a.spawnTime))},null,2));
else console.log('*** Begin Patch\n*** Add File: scenarios/CYYZ-West-70-Five-Streams-11NM-VERKO.json\n'+JSON.stringify(scenario,null,2).split('\n').map(l=>'+'+l).join('\n')+'\n*** End Patch');
