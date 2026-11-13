const assert=require('node:assert/strict');
const {normalize,LocalTraining}=require('../electron-app/src/local-training');
const base=require('../scenarios/CYYZ-West-70-AAR-Instructor-Owned.json');
const alternate=require('../scenarios/CYYZ-West-120-AAR-Instructor-Owned.json');
const starters=['Early south push','West arrival bank','Northeast crossover','Staggered rush'];
const main=['NUBER6','LINNG3','RAGID6'];
const starts=[['LINNG3','NUBER6','RAGID6','BOXUM7','IMEBA9'],['NUBER6','BOXUM7','LINNG3','RAGID6','IMEBA9'],['RAGID6','IMEBA9','LINNG3','NUBER6','BOXUM7'],['BOXUM7','RAGID6','NUBER6','IMEBA9','LINNG3']];
const scenarios=starters.map((name,index)=>{
 const pools=starts[index].map(star=>{
  const entries=base.aircraft.filter(a=>a.procedures[0]===star),extra=alternate.aircraft.filter(a=>a.procedures[0]===star);
  const combined=[...new Map([...entries,...extra].map(a=>[a.callsign,a])).values()],offset=(index+1)*3%combined.length;
  return [...combined.slice(offset),...combined.slice(0,offset)].slice(0,entries.length);
 });
 const aircraft=pools.flatMap((pool,stream)=>pool.map((a,i)=>({a,phase:(i+(stream+1)/6)/pool.length}))).sort((a,b)=>a.phase-b.phase).map(({a},i)=>({
  ...a,spawnTime:i===0?0:Math.round((i*3600/70+Math.sin(i*(.55+index*.13)+index)*13)*100)/100,
  squawk:(0o2200+i).toString(8)
 }));
 const s=normalize({...base,name:'CYYZ West 70 AAR · '+name,aircraft,jetSpeedProfile:undefined});
 assert.equal(s.aircraft.length,70);
 assert.equal(s.aircraft.filter(a=>main.includes(a.procedures[0])).length,49);
 assert(s.aircraft.every(a=>['23','24R'].includes(a.arrivalRunway)&&a.remarks.includes('/v/')));
 assert(s.aircraft.some(a=>a.wake==='H')&&s.aircraft.some(a=>a.wake==='M'));
 assert(s.aircraft.at(-1).spawnTime<3600);
 assert(s.aircraft.every((a,i)=>!i||a.spawnTime>s.aircraft[i-1].spawnTime));
 const sim=new LocalTraining();sim.load(s);sim.tick(s.aircraft.at(-1).spawnTime+.25);
 assert(sim.aircraft.some(a=>a.callsign===s.aircraft.at(-1).callsign&&a.active));
 return s;
});
if(process.argv.includes('--patch')){
 console.log('*** Begin Patch');
 scenarios.forEach((s,i)=>console.log('*** Add File: scenarios/CYYZ-West-70-Default-'+(i+1)+'.json\n+'+JSON.stringify(s).replace(/\},\{"callsign":/g,'},\n{"callsign":').split('\n').join('\n+')));
 console.log('*** End Patch');
}else for(const s of scenarios)console.log(s.name+': '+s.aircraft.length+' aircraft, '+s.aircraft[0].callsign+' first');
