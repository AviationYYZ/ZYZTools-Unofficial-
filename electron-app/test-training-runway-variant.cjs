const assert=require('node:assert/strict');
const test=require('node:test');
const {LocalTraining,normalize,flightPlan}=require('./src/local-training');
const scenario=require('../scenarios/CYYZ-West-70-Five-Streams-11NM-VERKO-Hold-8000.json');

test('west-flow STAR variant is explicit to EuroScope and survives amendment echoes',()=>{
 const sim=new LocalTraining();
 sim.scenario=normalize(scenario);
 sim.runtimeWaypoints=sim.scenario.waypoints;
 for(const [callsign,star,runway] of [['ACA409','IMEBA9','23'],['JZA8494','NUBER6','24R']]){
  const a={...sim.scenario.aircraft.find(a=>a.callsign===callsign),active:true};
  sim.aircraft=[a];
  const wire=flightPlan(a).split(':').at(-1),plan=a.flightPlanRoute,route=a.route;
  assert(wire.endsWith(star+'/'+runway+' CYYZ/'+runway));
  sim.amend(callsign,{flightPlanRoute:wire,remarks:'OFFLINE TEST'});
  assert.equal(a.flightPlanRoute,plan);
  assert.equal(a.route,route);
  assert.throws(()=>sim.amend(callsign,{arrivalRunway:'05',flightPlanRoute:'UNKNOWNFIX'}),/Import the matching|Unknown/);
  assert.equal(a.arrivalRunway,runway);
  sim.amend(callsign,{arrivalRunway:'05'});
  assert.equal(a.arrivalRunway,'05');
  assert.equal(a.navigation,'heading');
  assert(a.route.startsWith(plan.split(' ')[0]+' '));
  assert.notEqual(a.route,route);
  assert.equal(a.vectorOnlyRunway,false);
  assert(flightPlan(a).endsWith('CYYZ/05'));
  sim.amend(callsign,{arrivalRunway:'09'});
  assert.equal(a.arrivalRunway,'09');
  assert.match(a.navigationNotice,/No simulated runway geometry/);
  assert.throws(()=>sim.command(callsign,'APP CLEAR'),/geometry/);
  assert.throws(()=>sim.amend(callsign,{arrivalRunway:'99'}),/01 to 36/);
 }
});
