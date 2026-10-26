const assert=require('node:assert/strict'),{LocalTraining,geometry,move,flightPlan}=require('./src/local-training'),f=require('./src/training-flight');
const runway={airport:'CYYZ',name:'09',threshold:{lat:0,lon:0},opposite:{lat:0,lon:.02},elevation:0};
const base={format:'ZYZTools-training',version:1,name:'Guidance',magneticVariationWest:0,waypoints:[],runways:[runway],aircraft:[]};
function sim(a){const s=new LocalTraining();s.load({...base,aircraft:[{callsign:'TEST101',type:'A320',origin:'CYUL',destination:'CYYZ',squawk:'2001',altitude:3000,speed:210,speedBasis:'IAS',automaticSpeeds:false,heading:90,lat:0,lon:-.2,route:'',flightPlanRoute:'CYYZ/09',arrivalRunway:'09',...a}]});return s;}
for(const speed of [140,180,210,250])for(const side of [-1,1])for(const angle of [20,30,45,60]){
 const s=sim({speed,lat:side*.025,heading:90+side*angle});s.command('TEST101','APP CLEAR');s.command('TEST101','HDG '+(90+side*angle));assert.equal(s.aircraft[0].approachState,'armed');let captured=false,last;
 for(let i=0;i<2400;i++){s.tick(.1);const a=s.aircraft[0];if(a.approachState.includes('captured'))captured=true;if(captured&&a.lon>-.08&&a.lon<-.035)last={cross:Math.abs(a.lat)*60,heading:Math.abs(a.heading-90)};}
 assert(captured,'Capture '+[speed,side,angle]);assert(last&&last.cross<.05&&last.heading<2,'Settled localizer '+JSON.stringify([speed,side,angle,last]));
}
const late=sim({speed:250,lat:0,heading:120});late.command('TEST101','APP CLEAR');late.tick(.1);assert.equal(late.aircraft[0].approachState,'localizer captured');late.tick(100);assert(Math.abs(late.aircraft[0].lat)*60<.15,'Late clearance recovers without instant turn.');
const turning=sim({speed:210,lat:.002,heading:100});turning.command('TEST101','RHDG 150');turning.command('TEST101','APP CLEAR');assert.equal(turning.aircraft[0].approachVectorTarget,150);turning.tick(3);assert.equal(turning.aircraft[0].approachState,'armed');assert.equal(turning.aircraft[0].targetHeading,150);assert(turning.aircraft[0].heading>100,'Clearing approach must not stop an assigned turn.');
const straight=sim({lat:0,heading:90});straight.command('TEST101','APP CLEAR');straight.tick(.1);assert(straight.aircraft[0].approachState.includes('captured'),'Straight-in needs no extra heading command.');
const directed=sim({heading:1,lat:.002});directed.command('TEST101','RHDG 0');directed.command('TEST101','APP CLEAR');directed.tick(.1);assert.equal(directed.aircraft[0].approachState,'armed');assert(directed.aircraft[0].heading>1,'Directed turn across north must not be shortened by approach clearance.');
for(const course of [57,237,327,147])for(const side of [-1,1]){
 const threshold={lat:43.67,lon:-79.65},r={...runway,name:'23',threshold,opposite:move(threshold,1,course)},start=move(move(threshold,12,course+180),1.5,course-90+(side<0?180:0));
 const s=new LocalTraining();s.load({...base,runways:[r],aircraft:[{...sim({}).scenario.aircraft[0],...start,heading:(course+side*30+360)%360,arrivalRunway:'23'}]});s.command('TEST101','APP CLEAR');let last;
 for(let i=0;i<2500;i++){s.tick(.1);const a=s.aircraft[0],g=geometry(threshold,a),angle=((g.bearing-(course+180)+540)%360)-180,along=g.distance*Math.cos(angle*Math.PI/180);if(along<5&&along>2)last=Math.abs(g.distance*Math.sin(angle*Math.PI/180));}assert(last!==undefined&&last<.06,'Rotated Toronto-area centreline capture.');
}
const back=sim({heading:270});back.command('TEST101','APP CLEAR');back.tick(10);assert.equal(back.aircraft[0].approachState,'armed');
for(const speed of [140,210,250])for(const altitude of [3000,15000])for(const side of [-1,1]){
 const s=new LocalTraining();s.load({...base,waypoints:[{name:'TURN',lat:0,lon:.12},{name:'EXIT',lat:side*.25,lon:.12}],aircraft:[{...sim({}).scenario.aircraft[0],lat:0,lon:0,altitude,speed,heading:90,route:'TURN EXIT',flightPlanRoute:'TURN EXIT'}]});let began=false,settled=false;
 for(let i=0;i<4500;i++){s.tick(.1);const a=s.aircraft[0];if(!began&&Math.abs(a.heading-90)>2){began=true;assert(a.lon<.12,'Fly-by must start before fix at TAS '+a.speed);}if(a.lat*side>.09&&a.lat*side<.15){settled=true;assert(Math.abs(a.lon-.12)*60<.45,'Outbound turn track must converge.');}}
 assert(began&&settled,'Fly-by matrix must exercise turn and outbound segment.');
}
const wire=flightPlan({...sim({}).aircraft[0],flightPlanRoute:'STAR/23 CYYZ/23 EXTRA',arrivalRunway:'09'});assert(wire.endsWith('CYYZ/09'));assert(!wire.includes('CYYZ/23'));
const imported=sim({route:'',flightPlanRoute:'OLDSTAR/09'});imported.scenario.runways.push({...runway,name:'18',opposite:move(runway.threshold,1,180)});imported.scenario.waypoints=[{name:'ILS09',...runway.threshold}];imported.runtimeWaypoints=imported.scenario.waypoints;imported.aircraft[0].route='ILS09';imported.aircraft[0].remaining=['ILS09'];
imported.amend('TEST101',{flightPlanRoute:'OLDSTAR/09 CYYZ/18'});assert.equal(imported.aircraft[0].arrivalRunway,'18');assert.equal(imported.aircraft[0].route,'CYYZ_18');assert(flightPlan(imported.aircraft[0]).endsWith('CYYZ/18'));
imported.amend('TEST101',{flightPlanRoute:'OLDSTAR/09 CYYZ/09'});assert.equal(imported.aircraft[0].arrivalRunway,'09');assert.equal(imported.aircraft[0].route,'CYYZ_09');
const deleted=sim({});let messages=[];deleted.broadcast=l=>messages.push(l);deleted.command('TEST101','DELETE AIRCRAFT');assert.equal(deleted.aircraft.length,0);assert(messages.includes('#DPTEST101:0'));deleted.tick(1);deleted.reset();assert.equal(deleted.aircraft.length,1);
for(const speed of [140,210,300]){const expected=(speed*.514444)**2/(9.80665*Math.tan(25*Math.PI/180))/1852;const radius=f.turnRadius(speed);if(f.turnRate(speed)<3)assert(Math.abs(radius-expected)<.01);}
console.log('PASS: 32 speed/intercept + 8 rotated Toronto-area ILS cases, late-clearance recovery, clearance retained through vectors, reciprocal rejection, canonical runway wire format, delete/reset and physical TAS/bank turn radii.');
