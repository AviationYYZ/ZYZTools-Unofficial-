const fs = require('node:fs');
const assert = require('node:assert/strict');
const { LocalTraining, geometry } = require('../electron-app/src/local-training');
const [input, ...outputs] = process.argv.slice(2);
const scenario = JSON.parse(fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, ''));
const stream = a => a.procedures[0] === 'DUVOS4' ? 'BOXUM7' : a.procedures[0];
const rows = scenario.aircraft;
assert.equal(rows.length, 20);
const sim = new LocalTraining();
// Hold each aircraft in reserve until there is room at its entry point.
sim.load({...scenario, aircraft: rows.map((a,i)=>({...a, spawnTime:i?86400:0}))});
const lastInStream = new Map([[stream(rows[0]), 0]]);
let previous = 0, minEntry = Infinity;
for (let i=1; i<rows.length; i++) {
  const a = rows[i], group = stream(a), aircraft = sim.aircraft.find(p=>p.callsign===a.callsign);
  let time = Math.max(previous + (i<5?60:30), (lastInStream.get(group)??-180)+180);
  const nearby = () => sim.aircraft.filter(p=>p.active&&!p.landed&&stream(p)===group)
    .map(p=>geometry(p,a).distance);
  while (true) {
    assert(time < 1800, 'Could not schedule a spaced entry');
    while (sim.elapsed < time-.01) sim.tick(Math.min(1,time-sim.elapsed));
    const closest=Math.min(Infinity,...nearby());
    if (closest>=11) {minEntry=Math.min(minEntry,closest);break;}
    time+=5;
  }
  a.spawnTime=time;
  aircraft.spawnTime=time;
  sim.tick(.05);
  assert(aircraft.active);
  lastInStream.set(group,time);
  previous=time;
}
scenario.name = 'CYYZ West 120 AAR - Mixed Fleet - Spaced Start';
for(const output of outputs)fs.writeFileSync(output,JSON.stringify(scenario,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({aircraft:rows.length, firstFive:rows.slice(0,5).map(a=>a.spawnTime), lastSpawn:previous, closestSameStreamEntryNM:minEntry}));
