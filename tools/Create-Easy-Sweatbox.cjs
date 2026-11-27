const fs = require('node:fs'), assert = require('node:assert/strict');
const {LocalTraining} = require('../electron-app/src/local-training');
const base = require('../scenarios/FL110/CYYZ-West-70-AAR-Instructor-Owned-FL110.json');
const desired = ['NUBER6','BOXUM7','LINNG3','IMEBA9','RAGID6','NUBER6','BOXUM7','LINNG3'];
const used = new Set();
const aircraft = desired.map((star,i)=>{
  const a=base.aircraft.find(a=>a.procedures[0]===star&&a.wake==='M'&&!used.has(a.callsign));
  assert(a);used.add(a.callsign);
  return {...a,spawnTime:i*180,squawk:(0o2400+i).toString(8),initialDescent:undefined};
});
const {jetSpeedProfile,aircraftSpeedProfiles,automaticSpeedMode,...rest}=base;
const scenario={...rest,name:'CYYZ West - Very Easy - 8 Arrivals',aircraft};
const sim=new LocalTraining();sim.load(scenario);sim.tick(1260.1);
assert(sim.aircraft.some(a=>a.callsign===aircraft.at(-1).callsign&&a.active));
assert(aircraft.every(a=>a.altitude===11000&&a.wake==='M'&&a.remarks.includes('/v/')));
for(const file of process.argv.slice(2))fs.writeFileSync(file,JSON.stringify(scenario,null,2)+'\n',{flag:'wx'});
console.log('PASS: 8 medium jets, 180-second spawn gaps, last spawn 21:00, FL110, no automatic descent.');
