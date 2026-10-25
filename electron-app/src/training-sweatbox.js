// EuroScope text scenarios are data, never commands to execute. No file includes,
// network lookup, executable instructions or guessed fix coordinates are allowed.
const {coordinate}=require('./training-sector'),{normalize,move}=require('./local-training');
function decode(bytes){if(!Buffer.isBuffer(bytes))return String(bytes).replace(/^\uFEFF/,'');if(bytes.length>3*1024*1024)throw Error('Scenario exceeds 3 MB.');if(bytes[0]===255&&bytes[1]===254)return bytes.subarray(2).toString('utf16le');const utf=bytes.toString('utf8');return (utf.includes('\uFFFD')?new TextDecoder('windows-1252').decode(bytes):utf).replace(/^\uFEFF/,'');}
function parse(text,catalogue={},name='Imported SweatBox'){
 const warnings=new Set(),errors=[],planes=new Map(),ils=new Map();let current=null,elevation=0;
 const num=(v,min,max,label)=>{if(String(v).trim()===''||!Number.isFinite(Number(v))||Number(v)<min||Number(v)>max)throw Error('Invalid '+label+'.');return Number(v);};
 const point=(lat,lon)=>{const a=coordinate(lat),b=coordinate(lon);if(a===null||b===null||Math.abs(a)>89||Math.abs(b)>180)throw Error('Invalid scenario coordinates.');return {lat:a,lon:b};};
 function target(parts){if(planes.has(parts[0]))return {a:planes.get(parts.shift()),p:parts};if(!current)throw Error('Aircraft data has no preceding position.');return {a:current,p:parts};}
 for(const [index,raw]of decode(text).split(/\r?\n/).entries()){
  const line=raw.trim();if(!line||/^(;|#|\/\/)/.test(line))continue;
  try{
   const p=line.split(':'),key=p.shift();
   if(/^@[NS]$/.test(key)){
    const callsign=p[0];if(planes.has(callsign))throw Error('Duplicate aircraft '+callsign+'.');
    current={callsign,squawk:p[1],squawkMode:key.slice(1),...point(p[3],p[4]),altitude:num(p[5],0,60000,'initial altitude'),heading:(((num(p[7],0,4294967295,'packed heading')>>>2)&1023)/2.88)%360,spawnTime:0};planes.set(callsign,current);if(planes.size>100)throw Error('Scenario exceeds 100 aircraft.');
   }else if(key.startsWith('$FP')){
    const a=planes.get(key.slice(3));if(!a){warnings.add('Line '+(index+1)+': flight plan '+key.slice(3)+' has no matching position and is not imported.');continue;}if(a.fp)throw Error('Duplicate flight plan for '+a.callsign+'.');
    if(p.length!==16)throw Error('Flight plan must contain 16 fields after callsign.');
    const type=p[2].split('/');a.type=type[0];a.wake='M';if(/^[HJ]$/.test(type[0])){a.wake=type.shift();a.type=type[0];}a.equipment=type.slice(1).join('/')||'S';
    let cruise=num(p[7],0,60000,'cruise altitude');if(cruise>0&&cruise<=600){cruise*=100;warnings.add('Cruise altitudes of 600 or less interpreted as flight levels.');}
    Object.assign(a,{fp:true,flightRules:p[1],cruiseSpeed:num(p[3],0,600,'filed TAS'),origin:p[4],departureTime:p[5]||'0000',actualDepartureTime:p[6]||'0000',cruiseAltitude:cruise,destination:p[8],enrouteHours:Number(p[9]||0),enrouteMinutes:Number(p[10]||0),fuelHours:Number(p[11]||0),fuelMinutes:Number(p[12]||0),alternate:p[13],remarks:p[14],flightPlanRoute:p[15]});
   }else if(key==='$ROUTE'){
    const {a,p:parts}=target(p);if(a.override!==undefined)throw Error('Duplicate navigation route for '+a.callsign+'.');a.override=parts[0];if(parts[1]!==undefined)a.spawnTime=num(parts[1],0,1440,'START minutes')*60;
    if(parts.length>2)warnings.add('Legacy route response delays/altitude targets are not executed.');
   }else if(key==='START'){const {a,p:parts}=target(p);a.spawnTime=num(parts[0],0,1440,'START minutes')*60;}
   else if(key==='AIRPORT_ALT')elevation=num(p[0],-1000,15000,'airport altitude');
   else if(key.startsWith('ILS')){
    const match=key.match(/^ILS(\d{2}[LRC]?)(?:\s+([A-Z0-9]{4}))?$/);if(!match)throw Error('Invalid ILS name.');const threshold=point(p[0],p[1]);
    const opposite=p.length===4?point(p[2],p[3]):p.length===3?move(threshold,1,num(p[2],0,360,'runway heading')):null;if(!opposite)throw Error('Invalid ILS geometry.');
    if(ils.has(key))throw Error('Duplicate ILS definition.');ils.set(key,{name:match[1],airport:match[2]||'',threshold,opposite});
   }else if(['PSEUDOPILOT','INITIALPSEUDOPILOT','CONTROLLER'].includes(key))warnings.add('Pseudo-pilot/controller assignments are not recreated; use instructor/student connections.');
   else if(['DELAY','REQALT','INSTRUCTION','IASVARIATION','HOLDING','ROUTE','METAR','PERFAC','PERFLINE'].includes(key))warnings.add(key+' definitions are not executed; instructor commands and the ZYZTools flight model apply.');
   else if(key==='SIMDATA')warnings.add('SIMDATA tower models, taxi and ground-collision behaviour are not simulated.');
   else warnings.add('Unsupported directive '+key.slice(0,50)+' is not executed.');
  }catch(e){if(line.startsWith('ILS'))warnings.add('Line '+(index+1)+': ILS definition not imported: '+e.message);else errors.push('Line '+(index+1)+': '+e.message);}
 }
 if(!planes.size)throw Error('No EuroScope aircraft position records found.');if(errors.length)throw Error(errors.slice(0,8).join('\n'));
 const airports=new Map();for(const a of planes.values())for(const airport of [a.destination,a.origin])if(airport)airports.set(airport,(airports.get(airport)||0)+1);const defaultAirport=[...airports].sort((a,b)=>b[1]-a[1])[0]?.[0];
 const map=new Map((catalogue.fixes||[]).map(w=>[w.name,w])),used=new Map(),aircraft=[],rejected=[],runways=[];
 for(const a of planes.values()){
  try{
   if(!a.fp)throw Error('Missing flight plan.');
   const ground=a.altitude<=elevation+100;const match=a.flightPlanRoute.match(/\/(\d{2}[LRC]?)(?:\s|$)/);a.arrivalRunway=ground?'':match?.[1]||'';
   const route=a.override&&!['FP','FPA'].includes(a.override)?a.override:null;
   let expanded;
   if(ground){a.route='';a.speed=0;a.speedBasis='IAS';warnings.add('Ground aircraft imported stationary with no taxi/takeoff simulation or automatic navigation.');}
   else{
    if(route){const fixes=[];for(const part of route.trim().toUpperCase().split(/\s+/).filter(Boolean)){
     const [fix,alt]=part.split('/');if(alt!==undefined)warnings.add('Route altitude constraints are not flown automatically.');
     if(fix==='DCT')continue;
     const runway=ils.get(fix);let w=map.get(fix);if(runway){if((runway.airport||defaultAirport)!==a.destination)throw Error('ILS airport does not match destination.');w={name:fix,...runway.threshold};a.arrivalRunway=runway.name;}
     if(!w)throw Error('Unknown route fix '+fix+'. Import matching SCT/navdata.');if(fixes.at(-1)?.name!==fix)fixes.push(w);
    }expanded={route:fixes.map(w=>w.name).join(' '),waypoints:fixes};
    }else expanded=require('./training-routes').expandRoute(a,catalogue);
    a.route=expanded.route;for(const w of expanded.waypoints)used.set(w.name,w);
    // Position records contain no initial speed. Explicit training approximation,
    // not the filed high-altitude TAS or a claim of EuroScope performance parity.
    a.speed=Number(a.altitude)<10000?210:250;a.speedBasis='IAS';warnings.add('Airborne initial speed uses a training default: 210 IAS below 10,000 ft, otherwise 250 IAS. Review before Run.');
   }
   a.publishedSpeeds=false;a.compiledPlan=a.flightPlanRoute;a.compiledRunway=a.arrivalRunway;
   for(const r of ils.values()){const airport=r.airport||defaultAirport;if(!/^[A-Z]{4}$/.test(airport)){warnings.add('Runway airport '+airport+' is not supported by the current four-letter airport model.');continue;}if(!runways.some(x=>x.airport===airport&&x.name===r.name))runways.push({...r,airport,elevation});}
   // Validate each aircraft before offering a partial-import review.
   normalize({format:'ZYZTools-training',version:1,name,waypoints:[...used.values()],aircraft:[a],runways});aircraft.push(a);
  }catch(e){rejected.push(a.callsign+': '+e.message);}
 }
 if(!aircraft.length)throw Error('No compatible aircraft.\n'+rejected.slice(0,8).join('\n'));
 const scenario=normalize({format:'ZYZTools-training',version:1,name,magneticVariationWest:catalogue.magneticVariationWest??10.37,waypoints:[...used.values()],aircraft,runways,speedRules:[]});
 return {scenario,report:{total:planes.size,imported:aircraft.length,rejected,warnings:[...warnings]}};
}
module.exports={decode,parse};
