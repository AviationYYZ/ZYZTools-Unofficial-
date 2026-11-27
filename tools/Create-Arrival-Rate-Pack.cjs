const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { LocalTraining, normalize } = require('../electron-app/src/local-training');
const templates = {
  West: require('../scenarios/FL110/CYYZ-West-70-AAR-Instructor-Owned-FL110.json'),
  East: require('../scenarios/FL110/CYYZ-East-70-AAR-05-06L-FL110.json'),
  Rush: require('../scenarios/FL110/CYYZ-West-120-AAR-Instructor-Owned-FL110.json'),
  Mixed: require('../scenarios/CYYZ-West-Mixed-25-AAR-FL110.json'),
};
const lineup = [
  ['West', 15, 60, 'Quiet'], ['Mixed', 25, 60, 'Jets and Props'],
  ['East', 30, 60, 'Light'], ['West', 45, 60, 'Steady'], ['East', 55, 60, 'Moderate'],
  ['West', 65, 60, 'Busy'], ['East', 70, 60, 'Busy'], ['West', 90, 40, 'Heavy'],
  ['Rush', 120, 30, 'Rush'],
];

function build(flow, rate, minutes, label) {
  const base = templates[flow], count = rate * minutes / 60;
  const groups = Map.groupBy(base.aircraft, a => a.procedures[0]);
  const scores = [...groups].map(([star, pool], i) => ({
    star, pool, i, taken: 0, score: (i * 7 + rate) % 13 - 6,
    offset: (rate + i * 11) % pool.length,
  }));
  const gap = 3600 / rate;
  const aircraft = Array.from({ length: count }, (_, i) => {
    for (const group of scores) group.score += group.pool.length;
    const ranked = scores.filter(g => g.taken < g.pool.length).sort((a,b) => b.score - a.score || a.i - b.i);
    const g = i === 0 && flow === 'Mixed' ? ranked.find(x => x.pool[0].category === 'prop') || ranked[0] : ranked[0];
    g.score -= base.aircraft.length;
    const a = g.pool[(g.offset + g.taken++) % g.pool.length];
    const jitter = Math.sin(i * .93 + rate) * Math.min(9, gap * .16);
    return {...a, spawnTime: i ? Math.round((gap * i + jitter) * 100) / 100 : 0,
      squawk: (0o2200 + i).toString(8), remarks: /\/v\//i.test(a.remarks) ? a.remarks : '/v/ ' + a.remarks};
  });
  const title = flow === 'Rush' || flow === 'Mixed' ? 'West' : flow;
  const { jetSpeedProfile, aircraftSpeedProfiles, automaticSpeedMode, ...source } = base;
  const name = `CYYZ ${title} ${String(rate).padStart(3,'0')} AAR - ${label}`;
  const scenario = normalize({...source, name, aircraft});
  const runways = title === 'East' ? ['05','06L'] : ['23','24R'];
  assert.equal(scenario.aircraft.length, count);
  assert.equal(new Set(scenario.aircraft.map(a=>a.callsign)).size, count);
  assert.equal(new Set(scenario.aircraft.map(a=>a.squawk)).size, count);
  assert(scenario.aircraft.every((a,i)=>a.altitude===11000 && a.remarks.includes('/v/') &&
    runways.includes(a.arrivalRunway) && a.origin!=='CYYZ' &&
    a.flightPlanRoute.endsWith('CYYZ/'+a.arrivalRunway) &&
    (!i || a.spawnTime>scenario.aircraft[i-1].spawnTime)));
  assert(scenario.aircraft.at(-1).spawnTime < minutes*60);
  assert(!scenario.jetSpeedProfile && !Object.keys(scenario.aircraftSpeedProfiles).length);
  const sim = new LocalTraining();
  sim.load(scenario);
  const last = scenario.aircraft.at(-1);
  sim.tick(last.spawnTime + .25);
  assert(sim.aircraft.some(a=>a.callsign===last.callsign && a.active));
  delete scenario.aircraftSpeedProfiles;
  return {name, scenario, rate, minutes, count, runways};
}

const rows=(process.argv.includes('--rush-10')
  ? [['Rush',120,10,'10-Minute Rush']]
  : lineup).map(row=>build(...row));
if (process.argv[2]) {
  const output = path.resolve(process.argv[2]);
  fs.mkdirSync(output, {recursive:true});
  for (const row of rows) fs.writeFileSync(path.join(output, row.name+'.json'), JSON.stringify(row.scenario,null,2)+'\n', {flag:'wx'});
}
for (const r of rows) console.log(`${r.name} | ${r.count} aircraft over ${r.minutes} min | ${r.runways.join('/')}`);
