const fs = require('node:fs');
const assert = require('node:assert/strict');
const { LocalTraining } = require('../electron-app/src/local-training');
const west = require('../scenarios/FL110/CYYZ-West-70-AAR-Instructor-Owned-FL110.json');
const mixed = require('../scenarios/CYYZ-West-Mixed-25-AAR-FL110.json');
const [input, ...outputs] = process.argv.slice(2);
const scenario = JSON.parse(fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, ''));
assert.equal(scenario.aircraft.length, 20);
const rules = structuredClone(scenario.speedRules);
scenario.speedRules = rules.map(r => ({
  airport: 'CYYZ', source: 'User-edited Rush training scenario', aircraftCategory: 'jet', ...r
}));
const originalTimes = scenario.aircraft.map(a => a.spawnTime);
const used = new Set(scenario.aircraft.map(a => a.callsign));

function replace(star, donor, prop = false) {
  assert(!used.has(donor.callsign));
  const index = scenario.aircraft.findLastIndex(a => a.procedures[0] === star && a.wake === 'M'
    && a.arrivalRunway === donor.arrivalRunway && a.category !== 'prop');
  assert(index >= 0, star + ': no compatible slot');
  const a = scenario.aircraft[index];
  const identity = Object.fromEntries(['callsign','type','wake','category','origin','equipment','cruiseSpeed','cruiseAltitude']
    .filter(k => donor[k] !== undefined).map(k => [k, donor[k]]));
  scenario.aircraft[index] = {...a, ...(prop ? donor : {}), ...identity,
    squawk: a.squawk, spawnTime: a.spawnTime, altitude: a.altitude, remarks: a.remarks};
  used.add(donor.callsign);
}

replace('LINNG3', west.aircraft.find(a => a.callsign === 'TSC427'));
replace('NUBER6', west.aircraft.find(a => a.callsign === 'ACA122'));
const prop = mixed.aircraft.find(a => a.callsign === 'JZA7894');
replace('BOXUM7', prop, true);
const waypoints = new Map(scenario.waypoints.map(w => [w.name, w]));
for (const name of prop.route.split(/\s+/)) {
  if (waypoints.has(name)) continue;
  const fix = mixed.waypoints.find(w => w.name === name);
  assert(fix, 'Missing prop route fix ' + name);
  waypoints.set(name, fix);
}
scenario.waypoints = [...waypoints.values()];
scenario.name = 'CYYZ West 120 AAR - 10-Minute Rush - Mixed Fleet';
assert.deepEqual(scenario.speedRules.map((r,i) => Object.fromEntries(
  Object.keys(rules[i]).map(k => [k,r[k]]))), rules);
assert.deepEqual(scenario.aircraft.map(a => a.spawnTime), originalTimes);
const mix = {medium: 0, heavy: 0, prop: 0, super: 0};
for (const a of scenario.aircraft) {
  mix[a.type === 'DH8D' ? 'prop' : ({M:'medium',H:'heavy',J:'super'})[a.wake]]++;
  assert(a.remarks.includes('/v/'));
  assert(a.altitude === 11000);
  assert(a.route.split(/\s+/).every(f => waypoints.has(f)), a.callsign + ': unresolved route');
}
assert.deepEqual(mix, {medium:16, heavy:2, prop:1, super:1});
const sim = new LocalTraining();
sim.load(scenario);
const last = scenario.aircraft.at(-1);
sim.tick(last.spawnTime + .25);
assert(sim.aircraft.some(a => a.callsign === last.callsign && a.active));
for (const output of outputs) fs.writeFileSync(output, JSON.stringify(scenario, null, 2) + '\n', {flag:'wx'});
console.log(JSON.stringify({mix, preservedRules:rules.length, lastSpawn:last.spawnTime}));
