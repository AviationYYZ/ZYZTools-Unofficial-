'use strict';
const flight=require('./training-flight'),weather=require('./training-weather');
const wrap=x=>(x%360+360)%360,delta=(a,b)=>wrap(a-b+180)-180,rad=Math.PI/180;
function create(parts,fixes,variation,move,altitude=0){
 const [,mode,id,quadrant,course,side,...limits]=parts;
 const point=fixes.find(w=>w.name===id);
 if(!point)throw Error('Hold fix or VOR/DME is not in the scenario.');
 const inbound=wrap(Number(course)-variation),outbound=wrap(inbound+180);
 const quadrants={N:0,NE:45,E:90,SE:135,S:180,SW:225,W:270,NW:315};
 if(Number(course)>360||Math.abs(delta(outbound,wrap(quadrants[quadrant]-variation)))>45)throw Error('Holding quadrant must agree with the outbound course.');
 const h={id,mode,inbound,outbound,side:side==='R'?1:-1,phase:'entry',laps:0,fix:point};
 if(mode==='TIME'){
  const minutes=Number(limits[0]);if(minutes<.5||minutes>5)throw Error('Use a leg time from 0.5 to 5 minutes.');
  h.seconds=minutes*60;return h;
 }
 const [radial,fixDme,endDme]=limits.map(Number);
 if(radial>360||Math.min(fixDme,endDme)<1||Math.max(fixDme,endDme)>200||Math.abs(fixDme-endDme)<1)throw Error('Use DME limits from 1 to 200 NM, at least 1 NM apart, fix first.');
 const bearing=wrap(radial-variation),toward=Math.abs(delta(inbound,bearing+180))<1;
 if((!toward&&Math.abs(delta(inbound,bearing))>=1)||(toward?endDme<=fixDme:endDme>=fixDme))throw Error('Inbound course and DME limit order must agree with the radial.');
 const height=(altitude-(point.elevation||0))/6076.12;
 if(Math.abs(height)>=Math.min(fixDme,endDme))throw Error('DME limits are inside the aircraft’s height above the station.');
 return {...h,fix:move(point,Math.sqrt(fixDme**2-height**2),bearing),station:point,endDme,outward:toward};
}
function guide(a,dt,geometry,move){
 const h=a.hold,track=a.groundTrack??a.heading;
 const heading=c=>weather.crab(wrap(c),a.speed,a.wind);
 const go=(c,side=0)=>{a.targetHeading=heading(c);a.turnDirection=side;};
 const fix=geometry(a,h.fix);
 if(h.phase==='entry'){
  if(fix.distance>.08){flight.guideDirect(a,{...h.fix,name:h.id},fix,geometry,move);return;}
  a.directGuidance=null;
  const angle=delta(track,h.inbound)*h.side;
  h.entry=angle>110?'teardrop':angle< -70?'parallel':'direct';
  h.entryCourse=h.entry==='teardrop'?wrap(h.outbound-h.side*30):h.outbound;
  h.phase='turn-out';h.elapsed=0;
  h.turnSide=h.entry==='direct'?h.side:0;
 }
 if(h.phase==='turn-out'){
  if(Math.abs(delta(heading(h.entryCourse),a.heading))>2){go(h.entryCourse,h.turnSide);return;}
  h.phase='outbound';h.elapsed=0;
 }
 if(h.phase==='outbound'){
  go(h.entryCourse);h.elapsed+=dt;
  const d=h.station?Math.hypot(geometry(h.station,a).distance,(a.altitude-(h.station.elevation||0))/6076.12):null;
  if(h.station?(h.outward?d>=h.endDme:d<=h.endDme):h.elapsed>=h.seconds){
   h.phase='turn-in';h.outboundEndDme=d;
   const from=geometry(h.fix,a),cross=from.distance*Math.sin(delta(from.bearing,h.outbound)*rad);
   const intercept=Math.min(30,Math.max(8,Math.atan2(Math.abs(cross),Math.max(1,flight.turnRadius(a.speed)*3))/rad));
   h.captureCourse=wrap(h.inbound+Math.sign(cross)*intercept);
  }else return;
 }
 if(h.phase==='turn-in'){
  if(Math.abs(delta(heading(h.captureCourse),a.heading))>2){go(h.captureCourse,h.entry==='parallel'?-h.side:h.side);return;}
  h.phase='inbound';
 }
 const from=geometry(h.fix,a),cross=from.distance*Math.sin(delta(from.bearing,h.outbound)*rad);
 const correction=Math.min(30,Math.atan2(Math.abs(cross),Math.max(.4,flight.turnRadius(a.speed)*2))/rad);
 const along=from.distance*Math.cos(delta(from.bearing,h.outbound)*rad);
 if(fix.distance>.1&&!(along<=0&&Math.abs(cross)<.25)){
  go(along<.4?fix.bearing:h.inbound+Math.sign(cross)*correction);return;
 }
 if(h.exit){
  if(a.remaining[0]===h.id&&h.mode==='TIME')a.remaining.shift();
  a.hold=null;a.navigation=a.remaining.length?'route':'heading';a.legStart={lat:a.lat,lon:a.lon};a.targetHeading=a.heading;a.turnDirection=0;return;
 }
 h.laps++;h.entry='direct';h.entryCourse=h.outbound;h.turnSide=h.side;h.phase='turn-out';go(h.outbound,h.side);
}
module.exports={create,guide};
