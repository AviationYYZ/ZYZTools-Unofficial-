const fs=require('node:fs'),assert=require('node:assert/strict');
const {LocalTraining}=require('../electron-app/src/local-training');
const base=require('../scenarios/FL110/CYYZ-West-70-AAR-Instructor-Owned-FL110.json');
const order=['NUBER6','BOXUM7','LINNG3','IMEBA9','RAGID6'];
const used=new Set();
const aircraft=Array.from({length:30},(_,i)=>{
 const star=order[i%order.length];
 // Familiar medium jets, with two heavy arrivals for modest speed differences.
 const heavy=i===12||i===24;
 const a=base.aircraft.find(a=>a.procedures[0]===star&&a.wake===(heavy?'H':'M')&&!used.has(a.callsign));
 assert(a,'Missing aircraft for '+star);used.add(a.callsign);
 return {...a,spawnTime:i*60,squawk:(0o2500+i).toString(8),initialDescent:undefined};
});
const {jetSpeedProfile,aircraftSpeedProfiles,automaticSpeedMode,...rest}=base;
const scenario={...rest,name:'CYYZ West - Medium - 60 AAR - 30 Minutes',aircraft};
assert.equal(used.size,30);
assert(aircraft.every(a=>a.altitude===11000&&a.remarks.includes('/v/')));
const sim=new LocalTraining();sim.load(scenario);sim.tick(1740.1);
assert(sim.aircraft.some(a=>a.callsign===aircraft.at(-1).callsign&&a.active));
for(const output of process.argv.slice(2))fs.writeFileSync(output,JSON.stringify(scenario,null,2)+'\n',{flag:'wx'});
console.log('PASS: 30 aircraft (28 medium, 2 heavy); 60-second gaps; each stream every 5 minutes; last spawn 29:00; all FL110.');
