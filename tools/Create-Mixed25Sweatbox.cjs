'use strict';
// Offline training; the installed Toronto sector pack supplies the route geometry.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {importSectors}=require('../electron-app/src/training-sector');
const {expandRoute}=require('../electron-app/src/training-routes');
const {LocalTraining,normalize,geometry,move}=require('../electron-app/src/local-training');
const performance=require('../electron-app/src/training-performance');
const profiles=require('../electron-app/src/training-jet-profile');
const catalogue=importSectors([process.argv[2]||path.join(process.env.APPDATA,'EuroScope/CZYZ/CZYZ.sct')]);
const streams={
 BOXUM7:['BOXUM','23'], NUBER6:['NUBER','24R'], LINNG3:['LINNG','24R'],
 IMEBA9:['IMEBA','23'], RAGID6:['RAGID','24R'],
 DUVOS4:['BOXUM','23'], NAKBO6:['NUBER','24R'], VERKO1:['LINNG','24R'],
 VIBLI6:['IMEBA','23'], UDNOX5:['RAGID','24R']
};
const propStars=new Set(['DUVOS4','NAKBO6','VERKO1','VIBLI6','UDNOX5']);
// Representative callsigns and simulated schedules, not live flight records.
const roster=`
CFXQH CYOS C182 L prop DUVOS4
ACA256 CYWG A321 M jet BOXUM7
WJA382 CYWG B738 M jet BOXUM7
ACA601 CYHZ A320 M jet RAGID6
ACA100 CYVR B77W H jet NUBER6
CFLPY CYGK PC12 L highProp UDNOX5
JZA7305 CYOW CRJ9 M jet IMEBA9
POE526 KTPA E295 M jet LINNG3
CFMZK KERI PA46 L prop VERKO1
JZA7894 CYAM DH8D M highProp DUVOS4
AFR356 LFPG A359 H jet RAGID6
UAL2044 KIAH B738 M jet LINNG3
CGVTP CYOW C182 L prop VIBLI6
ACA128 CYVR A321 M jet NUBER6
TSC427 MMUN A332 H jet LINNG3
JZA7657 KORD DH8D M highProp NAKBO6
ACA427 CYUL A320 M jet IMEBA9
CGKZP CYXU PA46 L prop NAKBO6
BAW93 EGLL B77W H jet RAGID6
WJA384 CYWG B738 M jet BOXUM7
JZA7970 KPIT DH8D M highProp VERKO1
POE664 KLAX E295 M jet NUBER6
CGVLJ CYOW C510 L jet IMEBA9
CGHNX CYTR PC12 L highProp UDNOX5
CFXRN CYND BE20 L highProp VIBLI6
`.trim().split('\n').map(row=>row.split(' '));
const points=new Map(),fixes=new Map(catalogue.fixes.map(w=>[w.name,w]));
const runways=catalogue.runways.filter(r=>r.airport==='CYYZ'&&['23','24R'].includes(r.name));
assert.equal(runways.length,2);
const yyz=fixes.get('YYZ');
const vors=catalogue.fixes.filter(w=>w.kind==='VOR'&&geometry(yyz,w).distance<=120);
for(const w of vors)points.set(w.name,w);
for(const name of ['YYZ','YTP'])assert(points.has(name),name);
const aircraft=roster.map(([callsign,origin,type,wake,group,star],i)=>{
 const [entry,arrivalRunway]=streams[star],flightPlanRoute=entry+' '+star+' CYYZ/'+arrivalRunway;
 const expanded=expandRoute({origin,destination:'CYYZ',arrivalRunway,flightPlanRoute},catalogue);
 assert.deepEqual(expanded.procedures,[star]);
 assert.equal(expanded.waypoints[0].name,entry);
 for(const w of expanded.waypoints)points.set(w.name,w);
 // Approach the transition on its first leg's inbound extension, so the
 // scenario begins outside the gate, already lined up with the procedure.
 const [anchor,next]=expanded.waypoints;
 const start=move(anchor,6+(i%3)*2,(geometry(anchor,next).bearing+180)%360);
 const category=group==='jet'?'jet':'prop';
 const a={callsign,origin,type,wake,category,...start,altitude:11000,
  heading:geometry(start,anchor).bearing,speed:group==='jet'?230:group==='prop'?135:185,speedBasis:'IAS',
  rate:2250,destination:'CYYZ',arrivalRunway,route:expanded.route,flightPlanRoute,
  compiledPlan:flightPlanRoute,compiledRunway:arrivalRunway,
  procedures:[star],automaticSpeeds:true,scratchpad:arrivalRunway==='23'?' N':' R',
  remarks:'/v/ OFFLINE TRAINING',equipment:'GR',cruiseAltitude:group==='jet'?35000:11000,
  cruiseSpeed:group==='jet'?440:group==='prop'?160:230,
  squawk:(0o2200+i).toString(8),spawnTime:i*144};
 assert.equal(performance.isJet(a),!propStars.has(star));
 if(group!=='jet')assert.equal(profiles.select(a,{highProp:true,prop:true}),group);
 return a;
});
const raw={format:'ZYZTools-training',version:1,name:'CYYZ West | Mixed Fleet | 25 AAR | FL110',
 magneticVariationWest:10.37,initialOwnership:'instructor',waypoints:[...points.values()],
 runways,aircraft};
assert.equal(aircraft.length,25);
const opening=aircraft.slice(0,3);
assert.deepEqual(opening.map(a=>[a.category,a.procedures[0],a.spawnTime]),[
 ['prop','DUVOS4',0],['jet','BOXUM7',144],['jet','BOXUM7',288]
]);
assert(opening.every(a=>a.arrivalRunway==='23'&&a.route===opening[0].route&&a.route.startsWith('BOXUM ')));
assert.equal(new Set(aircraft.map(a=>a.procedures[0])).size,10);
assert.deepEqual(new Set(aircraft.map(a=>a.wake)),new Set(['L','M','H']));
const sim=new LocalTraining();sim.load(normalize(raw));
const seen=new Set();
for(let elapsed=0;elapsed<=3600;elapsed++){
 for(const a of sim.aircraft)if(a.active&&!seen.has(a.callsign)){
  assert(Math.abs(sim.elapsed-a.spawnTime)<=1,a.callsign);
  assert.equal(a.altitude,11000);
  if(a.category==='jet')assert.equal(a.targetIAS,230);
  seen.add(a.callsign);
 }
 sim.tick(1);
}
assert.equal(seen.size,25);
const output=path.resolve(__dirname,'../scenarios/CYYZ-West-Mixed-25-AAR-FL110.json');
fs.writeFileSync(output,JSON.stringify(raw,null,2)+'\n');
console.log('Verified '+seen.size+' spawns, all 10 STARs, and '+vors.length+' sector VORs: '+vors.map(v=>v.name).join(', '));
console.log(output);
