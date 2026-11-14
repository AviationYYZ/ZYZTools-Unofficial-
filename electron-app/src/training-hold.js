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
// Entry sectors measured using arrival track at the fix, mirrored for left holds.
function entryFor(track,inbound,side){
 const angle=delta(track,inbound)*side;
 return angle>70?'parallel':angle<=-110?'teardrop':'direct';
}
function guide(a,dt,geometry,move){
 const h=a.hold,track=a.groundTrack??a.heading;
 const heading=c=>weather.crab(wrap(c),a.speed,a.wind);
 const go=(c,side=0)=>{a.targetHeading=heading(c);a.turnDirection=side;};
 const fix=geometry(a,h.fix);
 const relative=p=>{
  const g=geometry(h.fix,p),angle=delta(g.bearing,h.outbound)*rad;
  return {cross:g.distance*Math.sin(angle),along:g.distance*Math.cos(angle)};
 };
 const {cross,along}=relative(a);
 if(h.phase==='entry'){
  if(fix.distance>.08){flight.guideDirect(a,{...h.fix,name:h.id},fix,geometry,move);return;}
  a.directGuidance=null;
  h.entry=h.selectedEntry=entryFor(track,h.inbound,h.side);
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
   // The banked reversal itself moves the jet laterally. Choose any
   // intercept from the predicted rollout, not the start of the turn.
   const end=relative(flight.rolloutPosition(a,heading(h.inbound),h.side,move));
   const intercept=Math.min(45,Math.atan2(Math.abs(end.cross),Math.max(.65,end.along*.55))/rad);
   h.captureCourse=wrap(h.inbound+(h.entry==='parallel'?h.side*Math.max(8,intercept):Math.sign(end.cross)*intercept));
   h.anticipate=h.entry!=='parallel'&&Math.abs(delta(h.captureCourse,h.inbound))>3;
  }else return;
 }
 if(h.phase==='turn-in'){
  // For a turn that is already closing on the inbound line, roll out
  // onto it before the aircraft crosses it. Never short-cut the initial
  // parallel reversal; that entry intentionally turns through >180°.
  if(h.anticipate&&Math.abs(delta(track,h.inbound))<80&&Math.abs(cross)>.025&&cross*Math.sin(delta(track,h.inbound)*rad)<0){
   const end=relative(flight.rolloutPosition(a,heading(h.inbound),0,move));
   if(cross*end.cross<=0||Math.abs(end.cross)<.025){h.phase='inbound';go(h.inbound);return;}
  }
  if(Math.abs(delta(heading(h.captureCourse),a.heading))>2){go(h.captureCourse,h.side);return;}
  h.phase='inbound';
 }
 if(fix.distance>.1&&!(along<=0&&Math.abs(cross)<.25)){
  const end=relative(flight.rolloutPosition(a,heading(h.inbound),0,move));
  if(Math.abs(delta(track,h.inbound))<60&&Math.abs(end.cross)<.04)go(h.inbound);
  else if(along<.35&&Math.abs(cross)>.15)go(fix.bearing);
  else{a.turnDirection=0;a.targetHeading=flight.legHeading(a,h.fix,h.inbound,geometry,40,Math.max(.45,Math.min(1.25,along*.4)));}
  return;
 }
 if(h.exit){
  if(a.remaining[0]===h.id&&h.mode==='TIME')a.remaining.shift();
  a.hold=null;a.navigation=a.remaining.length?'route':'heading';a.legStart={lat:a.lat,lon:a.lon};a.targetHeading=a.heading;a.turnDirection=0;return;
 }
 h.laps++;h.entry='direct';h.entryCourse=h.outbound;h.turnSide=h.side;h.phase='turn-out';go(h.outbound,h.side);
}
module.exports={create,guide,entryFor};
