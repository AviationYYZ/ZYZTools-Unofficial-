// Generic offline training guidance; not a certified FMS or published ILS database.
const rad=Math.PI/180,wrap=n=>(n%360+360)%360,delta=(a,b)=>(a-b+540)%360-180;
const performance=require('./training-performance');
const jetProfile=require('./training-jet-profile');
const weather=require('./training-weather');
const courseHeading=(a,course)=>weather.crab(course,a.speed,a.wind);
function density(altitude){const h=Math.min(11000,Math.max(0,altitude)*.3048);return Math.pow(1-2.25577e-5*h,4.25588);}
const iasToTas=(ias,altitude)=>ias/Math.sqrt(density(altitude)),tasToIas=(tas,altitude)=>tas*Math.sqrt(density(altitude));
const machToTas=(mach,altitude)=>mach*Math.sqrt(1.4*287.05*(288.15-.0065*Math.min(11000,Math.max(0,altitude)*.3048)))/.514444;
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
 const remaining=error-rollout;
 const requested=Math.sign(remaining)!==Math.sign(error)&&Math.sign(a.bank||0)===Math.sign(error)?0:Math.sign(remaining)*Math.min(maxRate,Math.abs(remaining));
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
// Forecast a bank-limited turn at the simulator's integration cadence.
// Freeze TAS and wind for the short prediction, not for the actual flight.
function rolloutPosition(a,targetHeading,turnDirection,move){
 const probe={lat:a.lat,lon:a.lon,speed:a.speed,wind:a.wind,bank:a.bank||0,heading:a.heading,targetHeading,turnDirection};
 for(let i=0;i<1000;i++){
  turnMotion(probe,.25);
  const motion=weather.motion(probe.heading,probe.speed,probe.wind);
  Object.assign(probe,move(probe,motion.speed/14400,motion.track));
  if(probe.heading===targetHeading)break;
 }
 return probe;
}
// Find a rollout heading whose ground track points at the fix *from the
// rollout position*. Aiming at its present bearing during the bank-in can
// cause overshoot or continuous bearing pursuit around a close-in fix.
function directIntercept(a,fix,geometry,move){
 const bearing=geometry(a,fix).bearing,target=courseHeading(a,bearing);
 if(Math.abs(delta(target,a.heading))<2&&Math.abs(a.bank||0)<2)return null;
 const sample=(angle,side)=>{
  const heading=wrap(a.heading+side*angle),end=rolloutPosition(a,heading,side,move);
  const g=geometry(end,fix),track=weather.motion(heading,a.speed,a.wind).track,error=delta(g.bearing,track)*rad;
  return {angle,heading,cross:g.distance*Math.sin(error),ahead:g.distance*Math.cos(error),side};
 };
 let best=null;
 for(const side of [1,-1]){
  let left=sample(0,side);
  for(let angle=15;angle<=210;angle+=15){
   if(best&&left.angle>=best.angle)break;
   const right=sample(angle,side);
   if(left.cross*right.cross<=0){
    let lo=left,hi=right;
    for(let n=0;n<10;n++){
     const mid=sample((lo.angle+hi.angle)/2,side);
     if(lo.cross*mid.cross<=0)hi=mid;else lo=mid;
    }
    const candidate=Math.abs(lo.cross)<Math.abs(hi.cross)?lo:hi;
    if(candidate.ahead>.15&&Math.abs(candidate.cross)<.025&&(!best||candidate.angle<best.angle)){
     best=candidate;break;
    }
   }
   left=right;
  }
 }
 return best;
}
function guideDirect(a,fix,g,geometry,move){
 const radius=turnRadius(a.speed)*1.35;
 if(!a.directGuidance||a.directGuidance.fix!==fix.name){
  const intercept=directIntercept(a,fix,geometry,move),track=a.groundTrack??a.heading;
  const offset=delta(g.bearing,track)*rad,side=Math.sign(offset);
  const inside=side&&Math.hypot(g.distance*Math.cos(offset),g.distance*Math.sin(offset)-side*radius)<radius;
  a.directGuidance=intercept?{fix:fix.name,mode:'turn',heading:intercept.heading,side:intercept.side}:
   inside?{fix:fix.name,mode:'extend',track}:{fix:fix.name,mode:'track'};
 }
 const state=a.directGuidance;
 if(state.mode==='extend'){
  if(g.distance<radius*3){a.navigationNotice='DCT '+fix.name+': extending to make turn room';a.targetHeading=courseHeading(a,state.track);return;}
  a.directGuidance=null;guideDirect(a,fix,g,geometry,move);return;
 }
 a.navigationNotice='DCT '+fix.name+': '+(state.mode==='turn'?'turning to intercept':'tracking to fix');
 if(state.mode==='turn'){
  if(Math.abs(delta(state.heading,a.heading))>.05){
   a.targetHeading=state.heading;a.turnDirection=state.side;return;
  }
  state.mode='track';a.turnDirection=0;
 }
 a.targetHeading=courseHeading(a,g.bearing);
}
function endsDownwind(start,fix,next,runway,geometry){
 if(!runway)return false;
 const axis=geometry(runway.threshold,runway.opposite).bearing,inbound=geometry(start,fix);
 if(inbound.distance<.05||Math.abs(delta(inbound.bearing,axis+180))>25)return false;
 const offset=geometry(runway.threshold,fix),angle=delta(offset.bearing,axis)*rad;
 const lateral=Math.abs(offset.distance*Math.sin(angle)),along=offset.distance*Math.cos(angle);
 return lateral>=1&&lateral<=12&&along>=-35&&along<=15&&(!next||Math.abs(delta(geometry(fix,next).bearing,inbound.bearing))>=30);
}
function isApproachFix(fix,runway,geometry){
 if(!fix||!runway)return false;
 const axis=geometry(runway.threshold,runway.opposite).bearing,g=geometry(runway.threshold,fix),angle=delta(g.bearing,axis)*rad;
 const along=g.distance*Math.cos(angle),cross=Math.abs(g.distance*Math.sin(angle));
 return along<0&&along>=-35&&cross<=.4;
}
function straightInJoin(fix,next,runway,geometry){
 if(!isApproachFix(fix,runway,geometry)||!isApproachFix(next,runway,geometry))return false;
 const axis=geometry(runway.threshold,runway.opposite).bearing,leg=geometry(fix,next);
 return geometry(runway.threshold,fix).distance>=12&&leg.distance>.5&&Math.abs(delta(leg.bearing,axis))<=12;
}
// Capture the leg with a bounded intercept. Track-rate damping starts the
// rollout before the centerline, instead of waiting for cross-track error to
// change sign while the aircraft is still banked toward it.
function legHeading(a,anchor,course,geometry,limit=20,lookCap=Infinity){
 const g=geometry(anchor,a),cross=g.distance*Math.sin(delta(g.bearing,course)*rad);
 const look=Math.min(lookCap,Math.max(1,turnRadius(a.speed)*4,(a.groundSpeed||a.speed)/3600*25));
 const bank=a.bank||0,rate=9.80665*Math.tan(bank*rad)/(Math.max(30,a.speed)*.514444)/rad;
 const settling=Math.min(2.5,Math.abs(bank)/10);
 const track=delta(a.groundTrack??a.heading,course)*rad;
 const drift=(a.groundSpeed||a.speed)/3600*settling*Math.sin(track+rate*settling*rad/2);
 const correction=Math.max(-limit,Math.min(limit,Math.atan2(cross+drift,look)/rad));
 return courseHeading(a,wrap(course-correction));
}
function startRejoin(a,fix,next,geometry,move){
 const course=geometry(fix,next).bearing,parallel=courseHeading(a,course);
 // Plan an intercept rather than first levelling out on a displaced,
 // parallel track and then commanding a second turn.
 const end=rolloutPosition(a,parallel,0,move),g=geometry(fix,end);
 const cross=g.distance*Math.sin(delta(g.bearing,course)*rad);
 const look=Math.max(2,turnRadius(a.speed)*4);
 const correction=Math.max(-30,Math.min(30,Math.atan2(cross,look)/rad));
 const heading=courseHeading(a,wrap(course-correction));
 a.flyBy={course,next:next.name,anchor:{lat:fix.lat,lon:fix.lon},rejoinHeading:heading,intercepting:true};
 a.navigationNotice='Rejoining filed route after '+fix.name+' toward '+next.name;
 a.targetHeading=heading;
}
function guideRoute(a,fixes,geometry,move,runway){
 let rejoinReached=false;
 if(a.flyBy){
  if(a.flyBy.next===a.remaining[0]){
   if(Number.isFinite(a.flyBy.rejoinHeading)){
    if(Math.abs(delta(a.heading,a.flyBy.rejoinHeading))>.05){a.targetHeading=a.flyBy.rejoinHeading;return;}
    a.flyBy.rejoinHeading=null;a.flyBy.directCapture=true;
   }
   if(!a.flyBy.intercepting&&Math.abs(delta(a.heading,courseHeading(a,a.flyBy.course)))>.5){a.targetHeading=courseHeading(a,a.flyBy.course);return;}
   const anchor=a.flyBy.anchor;if(anchor){const g=geometry(anchor,a),cross=g.distance*Math.sin(delta(g.bearing,a.flyBy.course)*rad);
    if(a.flyBy.directCapture){
     const nextFix=fixes.find(w=>w.name===a.flyBy.next);
     if(nextFix){
      const toFix=geometry(a,nextFix),leg=geometry(anchor,nextFix);
      const along=g.distance*Math.cos(delta(g.bearing,a.flyBy.course)*rad);
      if(a.flyBy.captureEndpoint||leg.distance-along<=Math.max(3,turnRadius(a.speed)*2)){
       a.flyBy.captureEndpoint=true;
       if(toFix.distance>.08){a.targetHeading=courseHeading(a,toFix.bearing);return;}
       rejoinReached=true;
      }
     }
    }
    if(!rejoinReached&&(Math.abs(cross)>.055||Math.abs(delta(a.groundTrack??a.heading,a.flyBy.course))>2||Math.abs(a.bank||0)>2)){a.flyBy.intercepting=true;a.targetHeading=legHeading(a,anchor,a.flyBy.course,geometry,a.flyBy.directCapture?35:20,a.flyBy.directCapture?Math.max(1.5,turnRadius(a.speed)*2):Infinity);return;}
   }
  }
  if(a.flyBy.directCapture)a.navigationNotice='';
  a.flyBy=null;
 }
 let count=0;while(a.remaining.length&&count++<10){
  const fix=fixes.find(w=>w.name===a.remaining[0]);if(!fix){a.navigation='heading';a.navigationNotice='Missing route fix '+a.remaining[0];return;}
  const g=geometry(a,fix),start=a.legStart||a,leg=geometry(start,fix),following=fixes.find(w=>w.name===a.remaining[1]);
  let direct=a.explicitDirectFix===fix.name;
  const approachFix=isApproachFix(fix,runway,geometry),join=straightInJoin(fix,following,runway,geometry);
  const afterFollowing=fixes.find(w=>w.name===a.remaining[2]);
  if(approachFix&&!join&&a.explicitDirectFix!==fix.name){
   a.navigation='heading';a.flyBy=null;a.turnDirection=0;a.routeCompleted=false;a.targetHeading=a.heading;
   a.navigationNotice='Approach discontinuity before '+fix.name+'; awaiting vectors or direct-to.';
   return;
  }
  // Use the filed leg, not the vector-to-fix line, to detect downwinds.
  const filed=direct?String(a.route||'').split(' '):null;
  const filedIndex=filed?.indexOf(fix.name)??-1;
  const downwindStart=direct?(filedIndex>0?fixes.find(w=>w.name===filed[filedIndex-1]):null):start;
  // PENGO is a published STAR split, not the end of a downwind.
  const nuberSplit=fix.name==='PENGO'&&['MANUP','BOTUM'].includes(following?.name)&&a.procedures?.includes('NUBER6');
  const discontinuity=(!nuberSplit&&downwindStart&&endsDownwind(downwindStart,fix,following,runway,geometry))||
   (isApproachFix(following,runway,geometry)&&!straightInJoin(following,afterFollowing,runway,geometry))||approachFix;
  const next=discontinuity&&!join?null:following;
  // A direct-to that rejoins a filed STAR uses the actual inbound track
  // after the vector, then anticipates the fixed outbound fix-to-fix leg.
  // Do not anticipate while still banking to establish the direct leg.
  let directFlyBy=false;
  if(direct&&next&&filed?.[filedIndex+1]===next.name&&filedIndex>=0&&a.directGuidance?.mode==='track'){
   const inbound=a.groundTrack??a.heading,outbound=geometry(fix,next);
   const angle=Math.abs(delta(outbound.bearing,inbound));
   if(angle>5&&angle<135&&Math.abs(delta(g.bearing,inbound))<5&&Math.abs(a.bank||0)<3){
    const lead=turnLead(a.speed,angle);
    const groundScale=Math.max(1,(a.groundSpeed||a.speed)/a.speed);
    if(g.distance<=Math.min(3.9,outbound.distance*.75,lead*groundScale+1.2)&&g.distance>.08){
     const relative=p=>{const v=geometry(fix,p),r=delta(v.bearing,outbound.bearing)*rad;return {cross:v.distance*Math.sin(r),along:v.distance*Math.cos(r)};};
     const here=relative(a),rollout=relative(rolloutPosition(a,courseHeading(a,outbound.bearing),0,move));
     // Start only when a bank-limited turn would actually roll out onto
     // the outbound centerline, accounting for wind and the inbound offset.
     const tolerance=Math.max(.015,(a.groundSpeed||a.speed)/3600*.4);
     if(Math.abs(rollout.cross)<=tolerance&&rollout.along>0&&rollout.along<outbound.distance*.75&&Math.abs(here.cross)>tolerance){
     a.explicitDirectFix=null;a.directGuidance=null;a.turnDirection=0;
     direct=false;directFlyBy=true;
     }
    }
   }
  }
  if(direct&&g.distance>.08){
   guideDirect(a,fix,g,geometry,move);
   return;
  }
  if(direct){a.explicitDirectFix=null;a.directGuidance=null;a.turnDirection=0;a.navigationNotice='';}
  const passed=leg.distance>.05&&g.distance*Math.cos(delta(g.bearing,leg.bearing)*rad)<-.01;
  let lead=.08,anticipated=false;
  if(next&&!direct&&!directFlyBy){
   const outgoing=geometry(fix,next),angle=Math.min(179,Math.abs(delta(outgoing.bearing,leg.bearing)));
   // A near-reversal needs MUCH more anticipation than a 90-degree corner.
   // Capping the angle at 150 underestimated LINNG's 172-degree turn by miles.
   const required=turnLead(a.speed,angle),available=Math.min(outgoing.distance*.95,leg.distance*.95);
   lead=Math.max(.08,Math.min(required,available));
   // A rollout crossing alone is ambiguous when the jet is off the inbound
   // leg. Only arm it in the expected lead window, never far up the leg.
   const inWindow=angle>5&&g.distance<=Math.min(available,required+Math.max(.12,a.speed/3600*2));
   if(inWindow){
    // Test where the rolling turn will finish against the actual outbound
    // great-circle line. This also handles convergence on long near-reversals.
    const targetHeading=courseHeading(a,outgoing.bearing),signed=delta(targetHeading,a.heading),shape=turnShape(a.speed,Math.abs(signed));
    let end=move(a,Math.hypot(shape.x,shape.y),a.heading+Math.atan2(Math.sign(signed)*shape.x,shape.y)/rad);
    if((angle>120||a.wind)&&g.distance<=required+3){
     // Refine near-reversals on the sphere, including existing bank. Small
     // planar/convergence errors are amplified by long, nearly parallel legs.
     end=rolloutPosition(a,targetHeading,0,move);
    }
    const from=geometry(fix,a),to=geometry(fix,end),cross=from.distance*Math.sin(delta(from.bearing,outgoing.bearing)*rad),endCross=to.distance*Math.sin(delta(to.bearing,outgoing.bearing)*rad);
    anticipated=Math.abs(cross)>.01&&cross*endCross<=0;
    // Use predicted interception rather than an underestimated planar lead.
    if(required<=available)lead=.08;
   }
   if(required>available&&angle>90)a.navigationNotice='Turn space limited at '+fix.name+'; reduce speed or vector.';
  }
  const projected=g.distance*Math.cos(delta(g.bearing,leg.bearing)*rad);
  if(discontinuity&&(rejoinReached||direct||anticipated||projected<=(join?lead:.08)||passed)){
   a.remaining.shift();(a.passedFixes||(a.passedFixes=[])).push(fix.name);
   a.navigation='heading';a.flyBy=null;a.turnDirection=0;a.routeCompleted=false;
   a.targetHeading=courseHeading(a,join?geometry(fix,following).bearing:wrap(geometry(fix,downwindStart||start).bearing+180));
   a.explicitDirectFix=null;
   a.navigationNotice='Route discontinuity at '+fix.name+'; awaiting vectors or direct-to.';
   return;
  }
  if(rejoinReached||direct||directFlyBy||anticipated||projected<=lead||passed){
   rejoinReached=false;
   a.remaining.shift();(a.passedFixes||(a.passedFixes=[])).push(fix.name);a.legStart={lat:fix.lat,lon:fix.lon};
   if(!a.remaining.length){a.routeCompleted=!a.vectorOnlyRunway;a.navigation='heading';a.targetHeading=direct?a.heading:leg.distance>.05?courseHeading(a,leg.bearing):a.heading;}
   else if(directFlyBy&&next){a.flyBy={course:geometry(fix,next).bearing,next:next.name,anchor:{lat:fix.lat,lon:fix.lon},directCapture:true};a.targetHeading=courseHeading(a,a.flyBy.course);return;}
   else if(direct&&next){startRejoin(a,fix,next,geometry,move);return;}
   else if(next&&Math.abs(delta(geometry(fix,next).bearing,leg.bearing))>5){a.flyBy={course:geometry(fix,next).bearing,next:next.name,anchor:{lat:fix.lat,lon:fix.lon}};a.targetHeading=courseHeading(a,a.flyBy.course);return;}
   continue;
  }
  if(leg.distance<=.05){a.targetHeading=courseHeading(a,g.bearing);return;}
  a.targetHeading=legHeading(a,start,leg.bearing,geometry);return;
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
 const intercept=delta(a.groundTrack??a.heading,course),closing=cross*Math.sin(intercept*rad)>0,lead=turnRadius(a.speed)*(1-Math.cos(intercept*rad))+(a.groundSpeed??a.speed)/3600*2.5*Math.abs(Math.sin(intercept*rad));
 if(a.approachState==='armed'&&along<=35&&along>.15&&Math.abs(intercept)<=80&&((closing&&Math.abs(cross)<=lead+.06)||Math.abs(cross)<.06))a.approachState='localizer captured';
 if(a.approachState==='armed')a.approachNotice=along>35?'Outside 35 NM simulated localizer capture range':'Localizer armed: maintain assigned intercept heading';
 if(['localizer captured','glideslope captured'].includes(a.approachState)){
  a.flyBy=null;
  const look=Math.max(.6,turnRadius(a.speed)*1.6,a.speed/3600*15);
  a.targetHeading=courseHeading(a,wrap(course+Math.max(-30,Math.min(30,Math.atan2(cross,look)/rad))));a.navigation='approach';a.turnDirection=0;
  const glide=r.elevation+50+Math.tan(3*rad)*along*6076.12;
  a.glidepathAltitude=glide;
  a.approachNotice=a.altitude>glide+60?'Above simulated glidepath ('+Math.round(glide)+' ft here): descend below the beam before capture':a.altitude<glide-100?'Localizer captured; waiting for glidepath from below':'Glidepath capture window';
  // Capture only from below/near the beam, never dive down from above to "catch" it.
  if(a.approachState==='localizer captured'&&Math.abs(cross)<.15&&Math.abs(delta(a.groundTrack??a.heading,course))<15&&a.altitude<=glide+60&&a.altitude>=glide-100)a.approachState='glideslope captured';
  if(a.approachState==='glideslope captured'){a.approachNotice='Glideslope captured';a.targetAltitude=Math.max(r.elevation,Math.min(a.altitude,glide));a.approachRate=Math.max(500,Math.min(2500,(a.groundSpeed??a.speed)*6));}
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
 // REQALT is a by-fix target, not a request to continuously invent a new
 // vertical rate. Retain the scenario/default rate (2250), or manual RATE.
 a.verticalNotice='Initial scenario descent: '+constraint.fix+' at '+constraint.altitude+' ft'+(needed>a.rate?' — too late to meet at the selected vertical rate':'');
 a.performanceDescentRate=model.rod;
}
function publishedIAS(a,rules,fixes,geometry,runways=[]){
 // Kept under the existing command/protocol name for old scenario compatibility.
 // This is a controller-requested training profile, NOT chart restrictions.
 if(a.landed||a.baseIAS===0&&a.speed===0){a.speedNotice='Stationary aircraft';return 0;}
 const phase=a.targetAltitude>a.altitude+100?'climb':a.targetAltitude<a.altitude-100||a.initialDescent||a.arrivalRunway?'descent':'cruise';
 const model=performance.profile(a,phase,tasToIas);
 if(performance.isJet(a)){
  // User's simplified IAS schedule; the lower band owns exactly 8,100 feet.
  // Carry each band through gaps; above 15,000 retain the 270-knot default.
  const onApproach=!!a.approachState&&a.approachState!=='off';
  const reference=onApproach?a.altitude:Number.isFinite(a.targetAltitude)?a.targetAltitude:a.altitude;
  const target=jetProfile.target(a.jetSpeedProfile,reference);
  a.speedProfileAltitude=reference;a.speedProfileBasis=onApproach?'current altitude (approach cleared)':'assigned altitude';
  a.speedPhase='jet '+a.speedProfileBasis+' band';a.performanceSource='ZYZTools jet training profile';a.trainingFinalIAS=136;
  a.speedNotice=a.performanceSource+' | '+target+' IAS | '+a.speedProfileBasis+' '+Math.round(reference)+' ft';return target;
 }
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
module.exports={machToTas,iasToTas,tasToIas,turnRate,turnRadius,turnError,turnMotion,turnLead,guideDirect,guideRoute,guideApproach,initialVerticalGuidance,normalizeSpeedRules,publishedIAS};
