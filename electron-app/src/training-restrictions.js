// Local simulation only. Constraints refer to the aircraft's upcoming filed route.
const flight=require('./training-flight');
function route(a,fix){const i=a.remaining.indexOf(fix);if(i<0)throw Error('Restriction waypoint must be ahead on the aircraft route.');return i;}
function speed(a,knots,fix){route(a,fix);if(!Number.isFinite(knots)||knots<50||knots>400)throw Error('Restriction speed must be 50–400 knots IAS.');if(!a.speedRestrictions?.length)a.speedResume={speedMode:a.speedMode,targetIAS:a.targetIAS,targetMach:a.targetMach,iasCommand:a.iasCommand};a.speedRestrictions=(a.speedRestrictions||[]).filter(r=>r.fix!==fix);a.speedRestrictions.push({fix,knots});a.speedMode='restriction';a.iasCommand=true;}
function clearSpeed(a,restore=true){if(restore){a.speedMode='published';a.iasCommand=true;}a.speedRestrictions=[];delete a.speedResume;}
function cross(a,fix,altitude){route(a,fix);if(!Number.isFinite(altitude)||altitude<0||altitude>60000)throw Error('Crossing altitude must be 0–60000 feet.');a.crossingRestrictions=(a.crossingRestrictions||[]).filter(r=>r.fix!==fix);a.crossingRestrictions.push({fix,altitude});a.initialDescentActive=false;}
function clearCross(a){a.crossingRestrictions=[];a.crossingNotice='';}
function update(a,fixes,geometry){
 if(a.speedRestrictions?.length){
  a.speedRestrictions=a.speedRestrictions.filter(r=>{
   if(!a.remaining.includes(r.fix))return false;
   const fix=fixes.find(w=>w.name===r.fix);if(!fix)return true;
   const index=a.remaining.indexOf(r.fix),previous=index?fixes.find(w=>w.name===a.remaining[index-1]):a.legStart;
   const g=geometry(a,fix);r.closestDistance=Math.min(r.closestDistance??Infinity,g.distance);if(g.distance<=.15)return false;
   // Vectors/ILS may leave earlier STAR fixes unsequenced. Passing the actual
   // fix abeam releases the restriction without requiring those fixes first.
   const ahead=g.distance*Math.cos((g.bearing-a.heading)*Math.PI/180);
   if(r.closestDistance<1.5&&ahead<-.02)return false;
   if(previous){const leg=geometry(previous,fix),angle=(g.bearing-leg.bearing+540)%360-180,along=g.distance*Math.cos(angle*Math.PI/180),cross=Math.abs(g.distance*Math.sin(angle*Math.PI/180));if(leg.distance>.05&&along<0&&cross<1.5)return false;}
   return true;
  });
  if(!a.speedRestrictions.length)clearSpeed(a);
  else{a.speedRestrictions.sort((x,y)=>route(a,x.fix)-route(a,y.fix));const r=a.speedRestrictions[0];a.targetIAS=r.knots;a.speedNotice=r.knots+' IAS until '+r.fix;a.speedMode='restriction';a.iasCommand=true;}
 }
 if(!a.crossingRestrictions?.length)return null;
 a.crossingRestrictions=a.crossingRestrictions.filter(r=>{if(a.remaining.includes(r.fix))return true;a.crossingNotice=r.fix+' crossing '+(Math.abs(a.altitude-r.altitude)<=100?'met':'missed')+' at '+Math.round(a.altitude)+' ft';return false;});
 if(!a.crossingRestrictions.length)return null;
 if(a.navigation!=='route'||['localizer captured','glideslope captured'].includes(a.approachState)){a.crossingNotice='Crossing restriction suspended: resume route or cancel approach.';return null;}
 a.crossingRestrictions.sort((x,y)=>route(a,x.fix)-route(a,y.fix));const r=a.crossingRestrictions[0],i=route(a,r.fix);let start=a,distance=0;
 for(const name of a.remaining.slice(0,i+1)){const w=fixes.find(w=>w.name===name);if(!w){a.crossingNotice='Crossing restriction suspended: missing '+name;return null;}distance+=geometry(start,w).distance;start=w;}
 // Fly-by fixes sequence at turn entry, so reserve their rolling-turn lead.
 const previous=i?fixes.find(w=>w.name===a.remaining[i-1]):a.legStart||a,next=fixes.find(w=>w.name===a.remaining[i+1]);
 if(previous&&next){const inbound=geometry(previous,start).bearing,outbound=geometry(start,next).bearing,angle=Math.abs((outbound-inbound+540)%360-180);distance-=Math.min(flight.turnLead(a.speed,angle),distance*.9);}
 const needed=Math.abs(a.altitude-r.altitude)*Math.max(30,a.speed)/(60*Math.max(.02,distance));a.targetAltitude=r.altitude;
 a.crossingNotice='Cross '+r.fix+' at '+r.altitude+' ft'+(needed>6000?' — unable at maximum 6000 FPM':'');
 return Math.min(6000,needed);
}
module.exports={speed,clearSpeed,cross,clearCross,update};
