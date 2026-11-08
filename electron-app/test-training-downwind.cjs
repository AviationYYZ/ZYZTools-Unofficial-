const {test}=require('node:test'),assert=require('node:assert/strict');
const {LocalTraining,geometry}=require('./src/local-training');
const base=require('../scenarios/CYYZ-West-65-15NM-VERKO-Challenge-D-FastRamp.json');
for(const [star,stop,next,straight] of [['LINNG3','DUNOL','EBDAL'],['NUBER6','DUNOL','EBDAL'],['BOXUM7','SATUR','CALVY'],['IMEBA9','DUGDA','CALVY',true],['RAGID6','AMILU','EBDAL',true]]){
 test(star+' retains the filed route but waits for explicit approach navigation',()=>{
  const a=base.aircraft.find(a=>a.procedures[0]===star),s=new LocalTraining();
  s.load({...base,aircraft:[{...a,spawnTime:0}]});
  const live=s.aircraft[0],point=s.scenario.waypoints.find(w=>w.name===stop);
  for(let i=0;i<1800&&live.navigation==='route';i++)s.tick(1);
  assert.equal(live.navigation,'heading');assert.equal(live.remaining[0],next);
  assert(live.passedFixes.includes(stop));assert(geometry(live,point).distance<(straight?2:.2));
  const heading=live.targetHeading;s.tick(30);assert(s.aircraft.includes(live));assert.equal(live.targetHeading,heading);
  if(straight){
   const final=s.scenario.waypoints.find(w=>w.name===next),course=geometry(point,final).bearing;
   const g=geometry(point,live),cross=Math.abs(g.distance*Math.sin((g.bearing-course)*Math.PI/180));
   assert(Math.abs((live.heading-course+540)%360-180)<2);
   assert(cross<.25,`Straight-in rollout cross-track: ${cross}`);
  }
  assert.equal(live.flightPlanRoute,a.flightPlanRoute);
  s.command(a.callsign,'ROUTE RESUME');s.tick(.25);assert.equal(live.navigation,'heading');
  s.command(a.callsign,'DCT '+next);s.tick(.25);assert.equal(live.navigation,'route');
  for(let i=0;i<900&&live.navigation==='route';i++)s.tick(1);
  assert.equal(live.navigation,'heading');assert(s.aircraft.includes(live));assert(live.passedFixes.includes(next));
 });
}
