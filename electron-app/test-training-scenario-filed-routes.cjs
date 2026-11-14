const {test}=require('node:test'),assert=require('node:assert/strict');
const {build,stem}=require('../tools/Create-Verko65CScenario.cjs');
const {normalize,flightPlan,LocalTraining}=require('./src/local-training');
const {expandRoute}=require('./src/training-routes');
test('all 65 Challenge C flight plans transmit full named-fix routes independently of STAR expansion',()=>{
 const {scenario,manifest}=build(),old=require('../scenarios/CYYZ-West-65-15NM-VERKO-Challenge-C.json');
 assert.deepEqual(normalize(require('../scenarios/'+stem+'.json')),scenario);assert.deepEqual(normalize(scenario),scenario);
 assert.deepEqual(scenario.jetSpeedProfile,old.jetSpeedProfile);assert.equal(scenario.initialOwnership,old.initialOwnership);
 const catalogue={fixes:scenario.waypoints,procedures:[],airways:[]},packets=[],sim=new LocalTraining();sim.load(scenario);
 const peer={callsign:'PRIVATE_CTR',socket:{destroyed:false,write:line=>packets.push(line)}};
 for(const a of sim.aircraft){
  const original=old.aircraft.find(b=>b.callsign===a.callsign);assert(original);
  for(const key of ['route','spawnTime','lat','lon','altitude','initialDescent','scratchpad','arrivalRunway','procedures','rate'])assert.deepEqual(a[key],original[key]);
  const names=a.route.split(' ').filter(n=>!/^SP(?:15)?_/.test(n));
  assert.equal(a.flightPlanRoute,[...names,'CYYZ/'+a.arrivalRunway].join(' '));assert(!a.flightPlanRoute.includes(a.procedures[0]));
  const wire=flightPlan(a,'PRIVATE_CTR');assert.equal(wire.split(':').at(-1),a.flightPlanRoute);
  const resolved=expandRoute({...a,compiledPlan:null},catalogue);assert.deepEqual(resolved.route.split(' '),names);
  sim.announce(a,peer);assert(packets.some(p=>p===wire+'\r\n'));
 }
 assert.equal(manifest.conflicts.length,5);
});
