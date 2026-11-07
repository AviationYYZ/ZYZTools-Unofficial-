const {test}=require('node:test'),assert=require('node:assert/strict');
const weather=require('./src/training-weather'),{LocalTraining,move,geometry,position}=require('./src/local-training');
const now=Date.now(),seconds=Math.floor(now/1000);
const metar=weather.surface([{icaoId:'CYYZ',obsTime:seconds,temp:7,altim:1000,wdir:270,wspd:20,elev:173}],now);
const aloft=weather.upper({hourly:{time:[seconds],geopotential_height_700hPa:[3000],temperature_700hPa:[-7],wind_direction_700hPa:[270],wind_speed_700hPa:[40]}},now);
const data={metar,aloft,upperAt:now,metarFresh:true,upperFresh:true};
test('METAR and upper air blend in vector components, expire, and IAS/TAS round-trip',()=>{
 assert.equal(metar.east,20);assert.equal(aloft[0].east,40);
 const w=weather.sample(weather.usable(data,now),(metar.feet+aloft[0].feet)/2);
 assert(Math.abs(w.east-30)<1e-6);assert(w.pressure>700&&w.pressure<metar.pressure);
 const tas=weather.iasToTas(210,w);assert(tas>210);assert(Math.abs(weather.tasToIas(tas,w)-210)<1e-9);
 assert.equal(weather.usable(data,now+7200001),null);
 assert.equal(weather.surface([{icaoId:'CYYZ',obsTime:seconds-7201}],now),null);
 const corrected=weather.crab(0,tas,w);assert(corrected>330);
 assert(Math.min(weather.motion(corrected,tas,w).track,360-weather.motion(corrected,tas,w).track)<1e-8);
});
function scenario(start,heading,altitude,runway){
 const s=new LocalTraining();s.load({format:'ZYZTools-training',version:1,name:'Weather smoke',magneticVariationWest:0,waypoints:[],runways:runway?[runway]:[],aircraft:[{callsign:'TEST100',type:'A320',origin:'CYUL',destination:'CYYZ',squawk:'2001',...start,altitude,speed:210,speedBasis:'IAS',publishedSpeeds:false,heading,arrivalRunway:runway?.name,route:''}]});s.weatherData=data;return s;
}
test('assigned IAS and heading stay fixed, radar gets actual ground speed and track',()=>{
 const start={lat:43.7,lon:-79.6},s=scenario(start,0,6000);
 s.command('TEST100','IAS 210');s.command('TEST100','HDG 360');s.tick(20);
 const a=s.aircraft[0],published=s.status().aircraft[0];
 assert.equal(a.ias,210);assert.equal(a.heading,0);assert(a.groundTrack>5);assert(a.lon>start.lon);
 assert.equal(published.speed,a.groundSpeed);assert.equal(published.trueAirspeed,a.speed);
 assert.equal(Number(position(a).split(':')[6]),Math.round(a.groundSpeed));
});
test('crosswind-corrected localizer captures glide slope and lands on assigned runway',()=>{
 const r=require('../scenarios/CYYZ-West-65-Random-Close-15NM.json').runways.find(r=>r.name==='23'&&r.airport==='CYYZ');
 const course=geometry(r.threshold,r.opposite).bearing,start=move(r.threshold,25,course+180),s=scenario(start,geometry(start,r.threshold).bearing,5000,r);
 s.command('TEST100','APP CLEAR');const a=s.aircraft[0];let captured=false;
 for(let i=0;i<4000&&!a.landed;i++){s.tick(.25);captured ||= a.approachState==='glideslope captured';}
 assert(captured);assert(a.landed);assert.equal(s.aircraft.length,0);
});
