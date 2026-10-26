// Generic offline training guidance; not a certified FMS or published ILS database.
const rad=Math.PI/180,wrap=n=>(n%360+360)%360,delta=(a,b)=>(a-b+540)%360-180;
const performance=require('./training-performance');
function density(altitude){const h=Math.min(11000,Math.max(0,altitude)*.3048);return Math.pow(1-2.25577e-5*h,4.25588);}
const iasToTas=(ias,altitude)=>ias/Math.sqrt(density(altitude)),tasToIas=(tas,altitude)=>tas*Math.sqrt(density(altitude));
const turnRate=speed=>Math.min(3,1091*Math.tan(25*rad)/Math.max(60,speed));
const turnRadius=speed=>(Math.max(0,speed)/3600)/(turnRate(speed)*rad);
function turnError(a,target=a.targetHeading){let error=delta(target,a.heading);if(a.turnDirection>0&&error<0)error+=360;if(a.turnDirection<0&&error>0)error-=360;return error;}
function turnMotion(a,dt){
 const error=turnError(a);
 const v=Math.max(30,a.speed)*.514444,maxRate=turnRate(a.speed);
 // Roll out for the heading still travelled while the bank returns to level.
 // The old error/3 rule produced a very long, widening tail to every turn.
 const currentRate=9.80665*Math.tan((a.bank||0)*rad)/v/rad;
 const rollout=currentRate*Math.abs(a.bank||0)/10;
 const remaining=error-rollout,requested=Math.sign(remaining)*Math.min(maxRate,Math.abs(remaining));
 const targetBank=Math.atan(requested*rad*v/9.80665)/rad;
 a.bank=(a.bank||0)+Math.sign(targetBank-(a.bank||0))*Math.min(Math.abs(targetBank-(a.bank||0)),5*dt);
 const amount=9.80665*Math.tan(a.bank*rad)/v/rad*dt;
 if(Math.abs(error)<.005||Math.sign(amount)===Math.sign(error)&&Math.abs(amount)>=Math.abs(error)){a.heading=wrap(a.targetHeading);a.bank=0;a.turnDirection=0;}
 else a.heading=wrap(a.heading+amount);
}
const leadCache=new Map();
function turnShape(speed,angle){
 // Predict the same bank/rollout model that will actually fly the corner.
 // Circular-radius alone understates the width of a sharp rolling turn.
 const v=Math.ceil(Math.max(30,speed)*2)/2,theta=Math.min(179,Math.ceil(Math.abs(angle)*100)/100),key=v+':'+theta;
 if(theta<1)return {lead:.08,x:0,y:0};if(leadCache.has(key))return leadCache.get(key);
 const probe={speed:v,heading:0,targetHeading:theta,bank:0,turnDirection:0};let x=0,y=0;
 for(let i=0;i<4000;i++){turnMotion(probe,.1);x+=v/36000*Math.sin(probe.heading*rad);y+=v/36000*Math.cos(probe.heading*rad);if(probe.heading===theta)break;}
 const lead=Math.max(.08,y-x/Math.tan(theta*rad)+v/3600*.25);
 const shape={lead,x,y};if(leadCache.size>=2048)leadCache.delete(leadCache.keys().next().value);leadCache.set(key,shape);return shape;
}
const turnLead=(speed,angle)=>turnShape(speed,angle).lead;
function guideRoute(a,fixes,geometry,move){
 if(a.flyBy){if(a.flyBy.next===a.remaining[0]&&Math.abs(delta(a.heading,a.flyBy.course))>.5){a.targetHeading=a.flyBy.course;return;}a.flyBy=null;}
 let count=0;while(a.remaining.length&&count++<10){
  const fix=fixes.find(w=>w.name===a.remaining[0]);if(!fix){a.navigation='heading';a.navigationNotice='Missing route fix '+a.remaining[0];return;}
  const g=geometry(a,fix),start=a.legStart||a,leg=geometry(start,fix),next=fixes.find(w=>w.name===a.remaining[1]);
  const passed=leg.distance>.05&&g.distance*Math.cos(delta(g.bearing,leg.bearing)*rad)<-.01;
  let lead=.08,anticipated=false;
  if(next){
   const outgoing=geometry(fix,next),angle=Math.min(179,Math.abs(delta(outgoing.bearing,leg.bearing)));
   // A near-reversal needs MUCH more anticipation than a 90-degree corner.
   // Capping the angle at 150 underestimated LINNG's 172-degree turn by miles.
   const required=turnLead(a.speed,angle),available=Math.min(outgoing.distance*.95,leg.distance*.95);
   lead=Math.max(.08,Math.min(required,available));
   if(angle>5&&g.distance<=available){
    // Test where the rolling turn will finish against the actual outbound
    // great-circle line. This also handles convergence on long near-reversals.
    const signed=delta(outgoing.bearing,a.heading),shape=turnShape(a.speed,Math.abs(signed));
    let end=move(a,Math.hypot(shape.x,shape.y),a.heading+Math.atan2(Math.sign(signed)*shape.x,shape.y)/rad);
    if(angle>120&&g.distance<=required+3){
     // Refine near-reversals on the sphere, including existing bank. Small
     // planar/convergence errors are amplified by long, nearly parallel legs.
     const probe={...a,targetHeading:outgoing.bearing,turnDirection:0};
     for(let i=0;i<4000;i++){turnMotion(probe,.1);Object.assign(probe,move(probe,probe.speed/36000,probe.heading));if(probe.heading===probe.targetHeading)break;}
     end=probe;
    }
    const from=geometry(fix,a),to=geometry(fix,end),cross=from.distance*Math.sin(delta(from.bearing,outgoing.bearing)*rad),endCross=to.distance*Math.sin(delta(to.bearing,outgoing.bearing)*rad);
    anticipated=Math.abs(cross)>.01&&cross*endCross<=0;
    // Use predicted interception rather than an underestimated planar lead.
    if(required<=available)lead=.08;
   }
   if(required>available&&angle>90)a.navigationNotice='Turn space limited at '+fix.name+'; reduce speed or vector.';
  }
  const projected=g.distance*Math.cos(delta(g.bearing,leg.bearing)*rad);
  if(anticipated||projected<=lead||passed){a.remaining.shift();(a.passedFixes||(a.passedFixes=[])).push(fix.name);a.legStart={lat:fix.lat,lon:fix.lon};if(!a.remaining.length){a.navigation='heading';a.targetHeading=leg.distance>.05?leg.bearing:a.heading;}else if(next&&Math.abs(delta(geometry(fix,next).bearing,leg.bearing))>5){a.flyBy={course:geometry(fix,next).bearing,next:next.name};a.targetHeading=a.flyBy.course;return;}continue;}
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
 if(along<0){if(a.approachState==='glideslope captured'&&Math.abs(cross)<.15){a.altitude=r.elevation;a.targetAltitude=r.elevation;a.speed=0;a.targetSpeed=0;a.ias=0;a.targetIAS=0;a.landed=true;a.paused=true;a.approachState='touchdown';}return;}
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
function initialVerticalGuidance(a,fixes,geometry){
 if(!a.initialDescentActive||a.approachState==='glideslope captured')return;
 const constraint=a.initialDescent;if(!constraint)return;
 a.targetAltitude=constraint.altitude;
 if(a.altitude<=constraint.altitude+.1){a.initialDescentActive=false;return;}
 if(a.manualRate||a.navigation!=='route')return;
 const index=a.remaining.indexOf(constraint.fix);if(index<0)return;
 let distance=0,start=a;
 for(const name of a.remaining.slice(0,index+1)){const fix=fixes.find(w=>w.name===name);if(!fix)return;distance+=geometry(start,fix).distance;start=fix;}
 const previous=index?fixes.find(w=>w.name===a.remaining[index-1]):a.legStart||a,next=fixes.find(w=>w.name===a.remaining[index+1]);
 if(next&&previous){const angle=Math.abs(delta(geometry(start,next).bearing,geometry(previous,start).bearing));distance-=Math.min(turnLead(a.speed,angle),distance*.8);}
 const model=performance.profile(a,'descent',tasToIas),needed=(a.altitude-constraint.altitude)*Math.max(30,a.speed)/(60*Math.max(.1,distance));
 const limit=Math.max(500,Math.min(6000,model.rod*1.5));a.rate=Math.max(200,Math.min(limit,needed));
 a.verticalNotice='Initial scenario descent: '+constraint.fix+' at '+constraint.altitude+' ft'+(needed>limit?' — too late to meet within training performance limits':'');
 a.performanceDescentRate=model.rod;
}
function publishedIAS(a,rules,fixes,geometry,runways=[]){
 // Kept under the existing command/protocol name for old scenario compatibility.
 // This is a controller-requested training profile, NOT chart restrictions.
 if(a.landed||a.baseIAS===0&&a.speed===0){a.speedNotice='Stationary aircraft';return 0;}
 const phase=a.targetAltitude>a.altitude+100?'climb':a.targetAltitude<a.altitude-100||a.initialDescent||a.arrivalRunway?'descent':'cruise';
 const model=performance.profile(a,phase,tasToIas);
 let target=Math.min(a.altitude>10000?270:250,model.ias);a.speedPhase=phase;a.performanceSource=model.source;a.trainingFinalIAS=model.finalIAS;
 // Begin reducing before crossing 10,000, not after the crossing.
 if(a.altitude>10000&&a.targetAltitude<10000&&(a.altitude-10000)/Math.max(1,a.rate/60)<Math.max(0,a.ias-250)/2)target=Math.min(target,250);
 if(a.altitude>12000)a.downwindSpeed=false;
 const runway=runways.find(r=>r.airport===a.destination&&r.name===a.arrivalRunway);
 if(runway&&a.altitude<=12000&&geometry(a,runway.threshold).distance<=60){
  const downwind=wrap(geometry(runway.threshold,runway.opposite).bearing+180);
  const aligned=heading=>Math.abs(delta(heading,downwind))<=30;
  // On vectors, slow as soon as a downwind heading is assigned. On a filed
  // route, allow deceleration PLUS the fly-by lead before the downwind fix.
  if(a.navigation==='heading'&&(aligned(a.targetHeading)||aligned(a.heading)))a.downwindSpeed=true;
  if(a.navigation==='route'){
   let distance=0,start=a;
   const names=a.remaining||[];
   for(let i=0;i<names.length;i++){
    const fix=fixes.find(w=>w.name===names[i]);if(!fix)break;
    distance+=geometry(start,fix).distance;
    const next=fixes.find(w=>w.name===names[i+1]);
    if(next&&aligned(geometry(fix,next).bearing)&&geometry(fix,runway.threshold).distance<=40){
     const leg=geometry(a.legStart||a,fix),angle=Math.min(179,Math.abs(delta(geometry(fix,next).bearing,leg.bearing)));
     const lead=turnLead(a.speed,angle)+a.speed/3600*2;
     const slowing=Math.max(0,a.ias-210)/2*Math.max(a.speed,iasToTas(210,a.altitude))/3600;
     if(distance<=slowing+lead+.3)a.downwindSpeed=true;
     break;
    }
    start=fix;
   }
   if(aligned(a.targetHeading)&&a.passedFixes?.length)a.downwindSpeed=true;
  }
 }
 if(a.downwindSpeed){target=Math.min(target,210);a.speedPhase='downwind';}
 if(runway&&a.approachState!=='off'&&a.approachState){
  const course=geometry(runway.threshold,runway.opposite).bearing,g=geometry(runway.threshold,a),along=g.distance*Math.cos(delta(g.bearing,wrap(course+180))*rad);
  if(g.distance<=25&&along>=0){
   target=Math.min(target,210);a.speedPhase='approach';
   if(['localizer captured','glideslope captured'].includes(a.approachState))for(const [distance,ias]of [[12,180],[7,160],[4,model.finalIAS]]){
    const slowing=Math.max(0,a.ias-ias)/2*Math.max(30,a.speed)/3600;
    if(along<=distance+slowing+.15){target=Math.min(target,ias);a.speedPhase=ias===model.finalIAS?'final':'approach';}
   }
  }
 }
 target=Math.max(50,Math.round(target));
 a.speedNotice=model.source+' | '+a.speedPhase+' | '+target+' IAS'+(a.speedPhase==='final'?' (training final target)':'')+(!runway?' | no runway geometry: approach schedule unavailable':'');
 return target;
}
module.exports={iasToTas,tasToIas,turnRate,turnRadius,turnError,turnMotion,turnLead,guideRoute,guideApproach,initialVerticalGuidance,normalizeSpeedRules,publishedIAS};
