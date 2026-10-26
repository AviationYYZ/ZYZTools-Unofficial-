// Generic offline training guidance; not a certified FMS or published ILS database.
const rad=Math.PI/180,wrap=n=>(n%360+360)%360,delta=(a,b)=>(a-b+540)%360-180;
function density(altitude){const h=Math.min(11000,Math.max(0,altitude)*.3048);return Math.pow(1-2.25577e-5*h,4.25588);}
const iasToTas=(ias,altitude)=>ias/Math.sqrt(density(altitude)),tasToIas=(tas,altitude)=>tas*Math.sqrt(density(altitude));
const turnRate=speed=>Math.min(3,1091*Math.tan(25*rad)/Math.max(60,speed));
const turnRadius=speed=>(Math.max(0,speed)/3600)/(turnRate(speed)*rad);
function turnError(a,target=a.targetHeading){let error=delta(target,a.heading);if(a.turnDirection>0&&error<0)error+=360;if(a.turnDirection<0&&error>0)error-=360;return error;}
function turnMotion(a,dt){
 const error=turnError(a);
 const v=Math.max(30,a.speed)*.514444,maxRate=turnRate(a.speed),requested=Math.sign(error)*Math.min(maxRate,Math.abs(error)/3);
 const targetBank=Math.atan(requested*rad*v/9.80665)/rad;
 a.bank=(a.bank||0)+Math.sign(targetBank-(a.bank||0))*Math.min(Math.abs(targetBank-(a.bank||0)),5*dt);
 const amount=9.80665*Math.tan(a.bank*rad)/v/rad*dt;
 if(Math.abs(error)<.005||Math.sign(amount)===Math.sign(error)&&Math.abs(amount)>=Math.abs(error)){a.heading=wrap(a.targetHeading);a.bank=0;a.turnDirection=0;}
 else a.heading=wrap(a.heading+amount);
}
function guideRoute(a,fixes,geometry,move){
 if(a.flyBy){if(a.flyBy.next===a.remaining[0]&&Math.abs(delta(a.heading,a.flyBy.course))>3){a.targetHeading=a.flyBy.course;return;}a.flyBy=null;}
 let count=0;while(a.remaining.length&&count++<10){
  const fix=fixes.find(w=>w.name===a.remaining[0]);if(!fix){a.navigation='heading';a.navigationNotice='Missing route fix '+a.remaining[0];return;}
  const g=geometry(a,fix),start=a.legStart||a,leg=geometry(start,fix),next=fixes.find(w=>w.name===a.remaining[1]);
  const passed=leg.distance>.05&&g.distance*Math.cos(delta(g.bearing,leg.bearing)*rad)<-.01;
  let lead=.08;
  if(next){const outgoing=geometry(fix,next),angle=Math.min(150,Math.abs(delta(outgoing.bearing,leg.bearing))),radius=turnRadius(a.speed);lead=Math.max(.08,Math.min(radius*Math.tan(angle*rad/2)+a.speed/3600*2.5,outgoing.distance*.8,leg.distance*.8));}
  const projected=g.distance*Math.cos(delta(g.bearing,leg.bearing)*rad);
  if(projected<=lead||passed){a.remaining.shift();(a.passedFixes||(a.passedFixes=[])).push(fix.name);a.legStart={lat:fix.lat,lon:fix.lon};if(!a.remaining.length){a.navigation='heading';a.targetHeading=leg.distance>.05?leg.bearing:a.heading;}else if(next&&Math.abs(delta(geometry(fix,next).bearing,leg.bearing))>5){a.flyBy={course:geometry(fix,next).bearing,next:next.name};a.targetHeading=a.flyBy.course;return;}continue;}
  const fromStart=geometry(start,a),along=fromStart.distance*Math.cos(delta(fromStart.bearing,leg.bearing)*rad),look=Math.max(.4,turnRadius(a.speed)*1.5,a.speed/3600*12),aim=move(start,Math.max(0,Math.min(leg.distance,along+look)),leg.bearing);
  a.targetHeading=geometry(a,aim).bearing;return;
 }
}
function guideApproach(a,runways,geometry){
 if(a.approachState==='armed'&&Number.isFinite(a.approachVectorTarget)){
  if(Math.abs(turnError(a,a.approachVectorTarget))>1){a.targetHeading=a.approachVectorTarget;return;}
  a.approachVectorTarget=null;
 }
 const r=runways.find(r=>r.airport===a.destination&&r.name===a.arrivalRunway);if(!r){a.approachState='runway unavailable';return;}
 const course=geometry(r.threshold,r.opposite).bearing,g=geometry(r.threshold,a),outbound=wrap(course+180),angle=delta(g.bearing,outbound),along=g.distance*Math.cos(angle*rad),cross=g.distance*Math.sin(angle*rad);
 a.approachDistance=along;
 if(along<0){if(a.approachState==='glideslope captured'&&Math.abs(cross)<.15){a.altitude=r.elevation;a.targetAltitude=r.elevation;a.speed=0;a.targetSpeed=0;a.landed=true;a.paused=true;a.approachState='touchdown';}return;}
 const intercept=delta(a.heading,course),closing=cross*Math.sin(intercept*rad)>0,lead=turnRadius(a.speed)*(1-Math.cos(intercept*rad))+a.speed/3600*2.5*Math.abs(Math.sin(intercept*rad));
 if(a.approachState==='armed'&&along<=25&&along>.15&&Math.abs(intercept)<=80&&((closing&&Math.abs(cross)<=lead+.06)||Math.abs(cross)<.06))a.approachState='localizer captured';
 if(['localizer captured','glideslope captured'].includes(a.approachState)){
  a.flyBy=null;
  const look=Math.max(.6,turnRadius(a.speed)*1.6,a.speed/3600*15);
  a.targetHeading=wrap(course+Math.max(-30,Math.min(30,Math.atan2(cross,look)/rad)));a.navigation='approach';a.turnDirection=0;
  const glide=r.elevation+50+Math.tan(3*rad)*along*6076.12;
  // Capture only from below/near the beam, never dive down from above to "catch" it.
  if(a.approachState==='localizer captured'&&Math.abs(cross)<.15&&Math.abs(delta(a.heading,course))<15&&a.altitude<=glide+60&&a.altitude>=glide-100)a.approachState='glideslope captured';
  if(a.approachState==='glideslope captured'){a.targetAltitude=Math.max(r.elevation,glide);a.approachRate=Math.max(500,Math.min(2500,a.speed*6));}
 }
}
function normalizeSpeedRules(rows){if(!Array.isArray(rows)||rows.length>2000)throw Error('Limit: 2,000 speed rules.');return rows.map(r=>{if(!/^[A-Z]{4}$/.test(r.airport)||!(/^[A-Z0-9]+$/).test(r.procedure)||!/^\d{2}[LRC]?$/.test(r.runway)||!(/^[A-Z0-9_-]{1,16}$/).test(r.fix)||!['at','max','min'].includes(r.kind)||!Number.isFinite(Number(r.knots))||r.knots<80||r.knots>400||typeof r.source!=='string'||!r.source.trim()||r.source.length>300)throw Error('Invalid published-speed rule; airport/procedure/runway/fix/kind/IAS/source required.');return {...r,knots:Number(r.knots)};});}
function publishedIAS(a,rules,fixes,geometry){
 const applicable=rules.filter(r=>r.airport===a.destination&&r.runway===a.arrivalRunway&&(!r.aircraftCategory||r.aircraftCategory===a.category)&&(a.procedures||[]).includes(r.procedure));
 if(!applicable.length){a.speedNotice='No chart speed coverage for this STAR/runway';return a.baseIAS;}
 const remaining=a.remaining||[],passed=a.passedFixes||[];
 let target=a.baseIAS;const prior=applicable.filter(r=>passed.includes(r.fix));if(prior.length){const r=prior.sort((x,y)=>passed.indexOf(y.fix)-passed.indexOf(x.fix))[0];target=r.kind==='at'?r.knots:r.kind==='max'?Math.min(target,r.knots):Math.max(target,r.knots);}
 if(a.navigation==='route')for(const name of remaining){const rule=applicable.find(r=>r.fix===name),fix=fixes.find(w=>w.name===name);if(!rule||!fix)continue;const d=geometry(a,fix).distance,decelDistance=Math.max(0,(a.ias-rule.knots)/2)*(a.speed/3600)+2;if(d<=decelDistance){target=rule.kind==='at'?rule.knots:rule.kind==='max'?Math.min(target,rule.knots):Math.max(target,rule.knots);a.speedNotice=rule.procedure+' '+rule.runway+' '+rule.fix+' '+rule.kind+' '+rule.knots+' IAS';break;}}
 return target;
}
module.exports={iasToTas,tasToIas,turnRate,turnRadius,turnError,turnMotion,guideRoute,guideApproach,normalizeSpeedRules,publishedIAS};
