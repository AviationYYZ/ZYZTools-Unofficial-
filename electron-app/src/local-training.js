// Isolated classic-FSD traffic source. No outbound sockets, DNS, HTTP or credentials.
const net=require('node:net');
const crypto=require('node:crypto');
const flight=require('./training-flight');
const nm=3440.065,rad=Math.PI/180,wrap=n=>(n%360+360)%360;
function number(v,min,max,label){if(v===''||v===null||!Number.isFinite(Number(v))||Number(v)<min||Number(v)>max)throw Error(label+' must be '+min+' to '+max+'.');return Number(v);}
function token(v,re,label){if(typeof v!=='string'||!re.test(v))throw Error('Invalid '+label+'.');return v;}
function fpText(value,max,label){const s=String(value||'');if(s.length>max||/[\x00-\x1f:]/.test(s))throw Error('Invalid '+label+'.');return s;}
function assignedRunway(route,destination){const tokens=String(route||'').trim().toUpperCase().split(/\s+/);const airport=tokens.filter(t=>t.startsWith(destination+'/')).at(-1),last=airport||tokens.at(-1)||'';return last.match(/\/(\d{2}[LRC]?)$/)?.[1]||'';}
function flightFields(a){return {flightRules:token(a.flightRules||'I',/^[IV]$/,'flight rules'),wake:token(a.wake||'M',/^[LMHJ]$/,'wake category'),equipment:token(a.equipment||'S',/^[A-Z0-9/]{1,40}$/,'equipment'),departureTime:token(a.departureTime||'0000',/^(?:[01]\d|2[0-3])[0-5]\d$/,'departure time'),actualDepartureTime:token(a.actualDepartureTime||'0000',/^(?:[01]\d|2[0-3])[0-5]\d$/,'actual departure time'),cruiseAltitude:number(a.cruiseAltitude??a.altitude,0,60000,'Cruise altitude'),cruiseSpeed:number(a.cruiseSpeed??a.speed,0,600,'Cruise speed'),enrouteHours:number(a.enrouteHours??1,0,99,'Enroute hours'),enrouteMinutes:number(a.enrouteMinutes??0,0,59,'Enroute minutes'),fuelHours:number(a.fuelHours??2,0,99,'Fuel hours'),fuelMinutes:number(a.fuelMinutes??0,0,59,'Fuel minutes'),alternate:token(a.alternate||'',/^(?:[A-Z]{4})?$/,'alternate'),remarks:fpText(a.remarks,512,'remarks'),flightPlanRoute:fpText(a.flightPlanRoute??a.route,2000,'filed route')};}
function normalize(raw){
 if(!raw||raw.format!=='ZYZTools-training'||raw.version!==1)throw Error('Choose a ZYZTools training scenario (version 1).');
 if(!Array.isArray(raw.aircraft)||raw.aircraft.length>100||!Array.isArray(raw.waypoints)||raw.waypoints.length>2000)throw Error('Limit: 100 aircraft and 2,000 waypoints.');
 const waypoints=raw.waypoints.map(w=>({name:token(w.name,/^[A-Z0-9_-]{1,16}$/,'waypoint'),lat:number(w.lat,-89,89,'Latitude'),lon:number(w.lon,-180,180,'Longitude')}));
 if(new Set(waypoints.map(w=>w.name)).size!==waypoints.length)throw Error('Duplicate waypoint names.');
 const aircraft=raw.aircraft.map(a=>{
  const route=String(a.route||'').trim().toUpperCase().split(/\s+/).filter(Boolean);
  if(route.length>100||route.some(f=>!waypoints.some(w=>w.name===f)))throw Error('Every route fix must be defined in the waypoint list. Expand STARs into fixes first.');
  const result={callsign:token(String(a.callsign||'').toUpperCase(),/^[A-Z][A-Z0-9]{1,11}$/,'callsign'),type:token(String(a.type||'').toUpperCase(),/^[A-Z0-9]{2,4}$/,'aircraft type'),lat:number(a.lat,-89,89,'Latitude'),lon:number(a.lon,-180,180,'Longitude'),altitude:number(a.altitude,0,60000,'Altitude (feet)'),speed:number(a.speed,0,600,'Speed (knots)'),heading:number(a.heading,0,359.99,'True heading'),rate:number(a.rate??1500,100,6000,'Vertical rate (feet/min)'),route:route.join(' '),origin:token(String(a.origin||'CYYZ').toUpperCase(),/^[A-Z]{4}$/,'origin'),destination:token(String(a.destination||'CYYZ').toUpperCase(),/^[A-Z]{4}$/,'destination'),squawk:token(String(a.squawk||'2000'),/^[0-7]{4}$/,'squawk'),spawnTime:number(a.spawnTime??0,0,86400,'Spawn time (simulation seconds)'),spawnFix:token(a.spawnFix||'',/^[A-Z0-9_-]{0,16}$/,'spawn fix'),squawkMode:token(a.squawkMode||'N',/^[NS]$/,'transponder mode'),arrivalRunway:token(a.arrivalRunway||'',/^(?:\d{2}[LRC]?)?$/,'arrival runway'),speedBasis:token(a.speedBasis||'TAS',/^(IAS|TAS)$/,'initial speed basis'),publishedSpeeds:a.publishedSpeeds!==false,procedures:Array.isArray(a.procedures)?a.procedures.map(p=>token(p,/^[A-Z0-9]{1,20}$/,'procedure')):[],...flightFields(a)};
  result.category=token(a.category||(/^(?:A[23]|B7|B3[89]M|E[179]|CRJ|C[567]|GLF|CL[36])/.test(result.type)?'jet':'unknown'),/^(jet|prop|unknown)$/,'aircraft category');result.compiledPlan=result.flightPlanRoute;result.compiledRunway=result.arrivalRunway;return result;
 });
 if(new Set(aircraft.map(a=>a.callsign)).size!==aircraft.length)throw Error('Aircraft callsigns must be unique.');
 if(raw.runways&&!Array.isArray(raw.runways)||raw.runways?.length>2000)throw Error('Invalid runway catalogue.');
 const runways=(raw.runways||[]).map(r=>({airport:token(r.airport,/^[A-Z]{4}$/,'runway airport'),name:token(r.name,/^\d{2}[LRC]?$/,'runway'),threshold:{lat:number(r.threshold?.lat,-89,89,'Threshold latitude'),lon:number(r.threshold?.lon,-180,180,'Threshold longitude')},opposite:{lat:number(r.opposite?.lat,-89,89,'Runway latitude'),lon:number(r.opposite?.lon,-180,180,'Runway longitude')},elevation:number(r.elevation??0,-1000,15000,'Runway elevation'),simulated:true}));
 return {magneticVariationWest:number(raw.magneticVariationWest??((aircraft.some(a=>a.destination==='CYYZ')||!aircraft.length)?10.37:0),-180,180,'Magnetic variation west'),format:'ZYZTools-training',version:1,name:String(raw.name||'Local scenario').replace(/[\x00-\x1f]/g,'').slice(0,100),waypoints,aircraft,runways,speedRules:flight.normalizeSpeedRules(raw.speedRules??require('./training-speed-data').rules)};
}
function geometry(a,b){const p=a.lat*rad,q=b.lat*rad,d=(b.lon-a.lon)*rad;const h=Math.sin((q-p)/2)**2+Math.cos(p)*Math.cos(q)*Math.sin(d/2)**2;return {distance:2*nm*Math.asin(Math.sqrt(Math.min(1,h))),bearing:wrap(Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d))/rad)};}
function move(a,distance,heading){const p=a.lat*rad,l=a.lon*rad,t=heading*rad,d=distance/nm;const q=Math.asin(Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(t));return {lat:q/rad,lon:((l+Math.atan2(Math.sin(t)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(q)))/rad+540)%360-180};}
function approach(v,target,step){return v+Math.sign(target-v)*Math.min(Math.abs(target-v),step);}
function position(a){return '@'+(a.identActive?'Y':a.squawkMode||'N')+':'+a.callsign+':'+a.squawk+':1:'+a.lat.toFixed(7)+':'+a.lon.toFixed(7)+':'+Math.round(a.altitude)+':'+Math.round(a.speed)+':'+((Math.round(wrap(a.heading)*1024/360)&1023)<<2)+':0';}
function flightPlan(a,recipient='*A'){const type=(['H','J'].includes(a.wake)?a.wake+'/':'')+a.type+'/'+a.equipment;const filed=a.arrivalRunway?[...String(a.flightPlanRoute).split(/\s+/).filter(t=>t&&!new RegExp('^'+a.destination+'(?:/\\d{2}[LRC]?)?$','i').test(t)),a.destination+'/'+a.arrivalRunway].join(' '):a.flightPlanRoute;return '$FP'+a.callsign+':'+recipient+':'+a.flightRules+':'+type+':'+Math.round(a.cruiseSpeed)+':'+a.origin+':'+a.departureTime+':'+a.actualDepartureTime+':'+Math.round(a.cruiseAltitude)+':'+a.destination+':'+a.enrouteHours+':'+a.enrouteMinutes+':'+a.fuelHours+':'+a.fuelMinutes+':'+a.alternate+':'+a.remarks+':'+filed;}
class LocalTraining{
 constructor(host='127.0.0.1'){if(!['127.0.0.1','127.0.0.2'].includes(host))throw Error('Only fixed loopback addresses are supported.');this.host=host;this.scenario=normalize({format:'ZYZTools-training',version:1,name:'New scenario',waypoints:[],aircraft:[]});this.clients=new Set();this.aircraft=[];this.running=false;this.elapsed=0;this.scale=1;this.reset();}
 load(raw){if(this.server||this.starting)throw Error('Stop the local server before editing or loading a scenario.');this.scenario=normalize(raw);this.reset();return this.status();}
 reset(){
  for(const a of this.aircraft||[])if(a.active)this.broadcast('#DP'+a.callsign+':SERVER');
  this.running=false;this.elapsed=0;this.runtimeWaypoints=structuredClone(this.scenario.waypoints);this.sessionId=crypto.randomUUID();this.aircraft=this.scenario.aircraft.map(a=>{const ias=a.speedBasis==='IAS'?a.speed:flight.tasToIas(a.speed,a.altitude),speed=a.speedBasis==='IAS'?flight.iasToTas(a.speed,a.altitude):a.speed,remaining=a.route.split(' ').filter(Boolean);const start=remaining.indexOf(a.spawnFix);return {...a,speed,ias,baseIAS:ias,targetIAS:ias,speedMode:a.publishedSpeeds?'published':'assigned',paused:false,approachState:'off',legStart:{lat:a.lat,lon:a.lon},assignedSquawk:a.squawk,trackingController:'',scratchpad:'',active:a.spawnTime===0,identUntil:0,identActive:false,targetAltitude:a.altitude,targetSpeed:speed,targetHeading:a.heading,turnDirection:0,passedFixes:start>=0?remaining.slice(0,start):[],remaining:start>=0?remaining.slice(start):remaining,navigation:a.route?'route':'heading'};});
  for(const a of this.aircraft)if(a.active)this.announce(a);return this.status();
 }
 status(){return {magneticVariationWest:this.scenario.magneticVariationWest,sessionId:this.sessionId,listening:!!this.server,host:this.host,port:this.port||6809,running:this.running,elapsed:this.elapsed,scale:this.scale,sockets:this.clients.size,clients:[...this.clients].filter(c=>c.callsign).length,lastEvent:this.lastEvent||'No local connection received yet.',scenario:this.scenario,aircraft:this.aircraft.map(a=>({...a,magneticHeading:wrap(a.heading+this.scenario.magneticVariationWest),targetMagneticHeading:wrap(a.targetHeading+this.scenario.magneticVariationWest)})),error:this.error||''};}
 write(c,line){if(!c.socket.destroyed){if(c.socket.writableLength>1024*1024){c.socket.destroy();return;}c.socket.write(line+'\r\n');}}
 broadcast(line){for(const c of this.clients)if(c.callsign)this.write(c,line);}
 broadcastAll(){for(const a of this.aircraft)if(a.active){a.identActive=this.elapsed<a.identUntil;this.broadcast(position(a));}}
 announce(a,c){const send=line=>c?this.write(c,line):this.broadcast(line);send(position(a));send(flightPlan(a));for(const peer of c?[c]:this.clients)if(peer.callsign)this.write(peer,'$CQSERVER:'+peer.callsign+':BC:'+a.callsign+':'+a.assignedSquawk);}
 receive(c,line){
  // Passwords/login lines are never retained or logged. No authentication service is called.
  if(line.startsWith('#AA')){
   const callsign=line.slice(3).split(':')[0];if(!/^[A-Z0-9_]{2,16}$/.test(callsign)){c.socket.destroy();return;}
   c.callsign=callsign;this.lastEvent='Local controller login accepted (dummy credentials; no online authentication).';this.write(c,'#TMSERVER:'+callsign+':ZYZTools LOCAL TRAINING ONLY - no VATSIM connection.');
   for(const a of this.aircraft)if(a.active)this.announce(a,c);return;
  }
  if(!c.callsign)return;
  if(line.startsWith('$PI')){const f=line.slice(3).split(':');this.write(c,'$POSERVER:'+c.callsign+':'+(f.slice(2).join(':')||'0'));}
  try{
   if(line.startsWith('$AM')){
    const f=line.slice(3).split(':');if(f[0]!==c.callsign||f.length!==18)throw Error('Invalid local flight-plan amendment.');
    const aircraftType=f[4].split('/');let wake='M';if(['H','J','L','M'].includes(aircraftType[0]))wake=aircraftType.shift();
    this.amend(f[2],{flightRules:f[3],wake,type:aircraftType.shift(),equipment:aircraftType.join('/')||'S',cruiseSpeed:f[5],origin:f[6],departureTime:f[7].padStart(4,'0'),actualDepartureTime:f[8].padStart(4,'0'),cruiseAltitude:/^FL?\d+$/i.test(f[9])?Number(f[9].replace(/^FL?/i,''))*100:f[9],destination:f[10],enrouteHours:f[11],enrouteMinutes:f[12],fuelHours:f[13],fuelMinutes:f[14],alternate:f[15],remarks:f[16],flightPlanRoute:f[17]});this.lastEvent='EuroScope flight plan saved: '+f[2];return;
   }
   if(line.startsWith('$CQ')||line.startsWith('#PC')){
    const f=line.slice(3).split(':'),offset=line.startsWith('#PC')?3:2;if(f[0]!==c.callsign)return;if(offset===3&&f[2]!=='CCP')return;
    const kind=f[offset],a=this.aircraft.find(a=>a.callsign===f[offset+1]&&a.active),value=f[offset+2];if(!a)return;
    if(kind==='FP'){this.announce(a,c);return;}
    if(kind==='BC'){a.assignedSquawk=token(value,/^[0-7]{4}$/,'assigned squawk');}
    else if(kind==='IT'||kind==='HT')a.trackingController=c.callsign;
    else if(kind==='IC'){if(a.trackingController===c.callsign)a.trackingController='';}
    else if(kind==='SC')a.scratchpad=fpText(value,64,'scratchpad');
    else if(kind==='TA')a.clearedAltitude=number(value,0,60000,'Cleared altitude');
    else return;
    // Controller assignments are metadata, not pilot instructions. Never turn/descend/change actual squawk here.
    for(const peer of this.clients)if(peer!==c&&peer.callsign)this.write(peer,line);
   }
  }catch(error){this.lastEvent='Local update rejected: '+error.message;this.write(c,'#TMSERVER:'+c.callsign+':'+this.lastEvent);}
  if(line.startsWith('#DA'))c.socket.end();
 }
 async start(port=6809){
  if(this.server)return this.status();if(this.starting)throw Error('Local server is already starting.');
  this.port=number(port,1024,65535,'Local port');if(!Number.isInteger(this.port))throw Error('Port must be an integer.');
  this.error='';const server=net.createServer(socket=>{
   if(!/^127\.\d+\.\d+\.\d+$/.test(socket.remoteAddress||'')||this.clients.size>=4){socket.destroy();return;}
   const c={socket,buffer:'',callsign:null};this.clients.add(c);this.lastEvent='Local TCP connection received; waiting for controller login.';socket.setNoDelay(true);socket.setTimeout(120000,()=>socket.destroy());
   socket.on('error',()=>{});socket.on('close',()=>{this.clients.delete(c);this.lastEvent=c.callsign?'Local controller disconnected.':'Local connection closed before controller login. Verify the non-VATSIM connection settings.';});
   socket.on('data',bytes=>{c.buffer+=bytes.toString('utf8');if(c.buffer.length>32768){socket.destroy();return;}let end;while((end=c.buffer.indexOf('\n'))>=0){const line=c.buffer.slice(0,end).replace(/\r$/,'');c.buffer=c.buffer.slice(end+1);this.receive(c,line);}});
  });
  this.starting=true;
  try{await new Promise((resolve,reject)=>{server.once('error',()=>reject(Error('Cannot start '+this.host+':'+this.port+'. Another local server may be using it. Stop that server; do not change Connect to VATSIM.')));server.listen({host:this.host,port:this.port},resolve);});}
  finally{this.starting=false;}
  this.server=server;server.on('error',()=>{this.error='Local server stopped unexpectedly.';this.stop();});
  // Integrate at 10 Hz, but publish radar samples at 1 Hz: consumers that
  // timestamp samples in whole seconds must not receive five samples/second.
  this.last=performance.now();let ticks=0;this.timer=setInterval(()=>{const now=performance.now(),dt=Math.min(1,(now-this.last)/1000);this.last=now;if(this.running)this.tick(dt*this.scale);if(++ticks%10===0)this.broadcastAll();},100);return this.status();
 }
 stop(){this.running=false;clearInterval(this.timer);for(const c of this.clients){for(const a of this.aircraft)this.write(c,'#DP'+a.callsign+':SERVER');c.socket.destroy();}this.clients.clear();this.server?.close();this.server=null;return this.status();}
 run(){if(!this.server)throw Error('Start the local server first.');this.running=true;this.last=performance.now();return this.status();}
 pause(){this.running=false;return this.status();}
 tick(seconds){for(let remaining=seconds;remaining>0;remaining-=0.25)this.step(Math.min(0.25,remaining));}
 step(dt){
  const before=this.elapsed;this.elapsed+=dt;
  for(const a of this.aircraft){
   if(this.elapsed<a.spawnTime)continue;const step=Math.max(0,this.elapsed-Math.max(before,a.spawnTime));if(!a.active){a.active=true;this.announce(a);}a.identActive=this.elapsed<a.identUntil;
   if(a.paused)continue;
   const fixes=this.runtimeWaypoints?.length?this.runtimeWaypoints:this.scenario.waypoints;
   if(a.speedMode==='published')a.targetIAS=flight.publishedIAS(a,this.scenario.speedRules,fixes,geometry);
   if(a.speedMode==='published'||a.speedBasis==='IAS'||a.iasCommand){a.ias=approach(a.ias,a.targetIAS,2*step);a.speed=flight.iasToTas(a.ias,a.altitude);a.targetSpeed=flight.iasToTas(a.targetIAS,a.altitude);}else{a.speed=approach(a.speed,a.targetSpeed,2*step);a.ias=flight.tasToIas(a.speed,a.altitude);}
   if(a.navigation==='route'&&a.remaining.length)flight.guideRoute(a,fixes,geometry,move);
   if(a.approachState!=='off')flight.guideApproach(a,this.scenario.runways,geometry);
   if(a.paused)continue;
   a.altitude=approach(a.altitude,a.targetAltitude,(a.approachState==='glideslope captured'?a.approachRate:a.rate)/60*step);
   flight.turnMotion(a,step);
   Object.assign(a,move(a,a.speed/3600*step,a.heading));
  }
 }
 command(callsign,command){
  const a=this.aircraft.find(a=>a.callsign===callsign);if(!a)throw Error('Select a simulated aircraft.');
  if(String(command).trim().toUpperCase()==='DELETE AIRCRAFT'){this.broadcast('#DP'+a.callsign+':SERVER');this.aircraft=this.aircraft.filter(x=>x!==a);return this.status();}
  if(!a.active)throw Error('Aircraft has not spawned yet.');
  const parts=String(command).trim().toUpperCase().split(/\s+/);if(parts[0]==='IDENT'&&parts.length===1){a.revision=(a.revision||0)+1;a.identUntil=this.elapsed+18;a.identActive=true;this.broadcastAll();return this.status();}if(parts.length!==2)throw Error('Use ALT, RATE, SPD, HDG/LHDG/RHDG, DCT, SQ, MODE, IDENT or ROUTE RESUME.');
  const [verb,arg]=parts;
  if(verb==='ALT')a.targetAltitude=number(arg,0,60000,'Target altitude (feet)');
  else if(verb==='RATE'){if(a.approachState==='glideslope captured')throw Error('ILS glidepath controls vertical rate (ground speed × 6). Use APP CANCEL, then ALT and RATE for a manual climb/descent.');a.rate=number(arg,100,6000,'Climb/descent rate magnitude (feet/min)');}
  else if(['SPD','IAS'].includes(verb)){a.targetIAS=number(arg,80,400,'Speed (knots IAS)');a.speedMode='assigned';a.iasCommand=true;}
  else if(verb==='SPEED'&&arg==='PUBLISHED'){a.speedMode='published';a.targetIAS=flight.publishedIAS(a,this.scenario.speedRules,this.runtimeWaypoints||this.scenario.waypoints,geometry);}
  else if(verb==='PAUSE'&&['ON','OFF'].includes(arg)){a.paused=arg==='ON';}
  else if(verb==='APP'&&arg==='CLEAR'){if(!a.arrivalRunway||!this.scenario.runways.some(r=>r.airport===a.destination&&r.name===a.arrivalRunway))throw Error('Select a runway with imported sector geometry before clearing the approach.');a.approachVectorTarget=a.navigation==='heading'&&Math.abs(flight.turnError(a))>1?a.targetHeading:null;a.approachState='armed';}
  else if(verb==='APP'&&arg==='CANCEL'){a.approachState='off';a.approachVectorTarget=null;a.navigation='heading';a.flyBy=null;a.targetHeading=a.heading;a.turnDirection=0;a.targetAltitude=a.altitude;}
  else if(['HDG','LHDG','RHDG'].includes(verb)){a.targetHeading=wrap(number(arg,0,360,'Magnetic heading')-this.scenario.magneticVariationWest);a.navigation='heading';a.flyBy=null;if(a.approachState!=='off'){a.approachState='armed';a.approachVectorTarget=a.targetHeading;}a.turnDirection=verb==='LHDG'?-1:verb==='RHDG'?1:0;}
  else if(verb==='SQ')a.squawk=token(arg,/^[0-7]{4}$/,'squawk');
  else if(verb==='MODE'){if(!['C','STBY'].includes(arg))throw Error('Use MODE C or MODE STBY.');a.squawkMode=arg==='C'?'N':'S';a.identUntil=0;a.identActive=false;}
  else if(verb==='DCT'){
   if(!(this.runtimeWaypoints?.length?this.runtimeWaypoints:this.scenario.waypoints).some(w=>w.name===arg))throw Error('Waypoint is not defined in this scenario.');
   const i=a.remaining.indexOf(arg),filed=a.route.split(' ').filter(Boolean),j=filed.indexOf(arg);a.remaining=i>=0?a.remaining.slice(i):j>=0?filed.slice(j):[arg];a.navigation='route';a.flyBy=null;a.legStart={lat:a.lat,lon:a.lon};a.approachState='off';a.turnDirection=0;
  }
  else if(verb==='ROUTE'&&arg==='RESUME'){if(!a.remaining.length)throw Error('No remaining route. Use DCT FIX.');a.approachVectorTarget=null;a.navigation='route';}
  else throw Error('Unknown command. Use ALT, RATE, SPD, HDG, DCT or ROUTE RESUME.');
  a.revision=(a.revision||0)+1;this.broadcastAll();return this.status();
 }
 amend(callsign,fields){
  const a=this.aircraft.find(a=>a.callsign===callsign&&a.active);if(!a)throw Error('Select an active simulated aircraft.');let candidate={...a,...fields},expanded;
  if(Object.hasOwn(fields,'flightPlanRoute')&&!Object.hasOwn(fields,'arrivalRunway'))candidate.arrivalRunway=assignedRunway(fields.flightPlanRoute,candidate.destination)||candidate.arrivalRunway;
  const routeChanged=candidate.arrivalRunway!==a.arrivalRunway||['flightPlanRoute','arrivalRunway','origin','destination'].some(k=>Object.hasOwn(fields,k)&&fields[k]!==a[k]);
  if(routeChanged){
   const root=plan=>String(plan).toUpperCase().replace(/\/\d{2}[LRC]?(?=\s|$)/g,'').split(/\s+/).filter(t=>t&&t!==a.destination).join(' ');
   if(candidate.arrivalRunway!==a.arrivalRunway&&candidate.origin===a.origin&&candidate.destination===a.destination&&root(candidate.flightPlanRoute)===root(a.flightPlanRoute)){
    const points=this.runtimeWaypoints||this.scenario.waypoints,route=a.route.split(' ').filter(Boolean),r=this.scenario.runways.find(r=>r.airport===candidate.destination&&r.name===candidate.arrivalRunway);let added=[];
    if(r&&(/^(?:ILS\d{2}[LRC]?)$/.test(route.at(-1)||'')||new RegExp('^'+candidate.destination+'_\\d{2}[LRC]?$').test(route.at(-1)||''))){const name=candidate.destination+'_'+candidate.arrivalRunway;route[route.length-1]=name;added=[{name,...r.threshold}];}
    expanded={route:route.join(' '),waypoints:[...points,...added],arrivalRunway:candidate.arrivalRunway,procedures:a.procedures};candidate={...candidate,...expanded};
   }else{candidate.compiledPlan=null;expanded=this.planResolver?this.planResolver(candidate):require('./training-routes').expandRoute(candidate,{fixes:this.runtimeWaypoints||this.scenario.waypoints},[]);candidate={...candidate,...expanded};}
  }
  const points=expanded?[...(this.runtimeWaypoints||this.scenario.waypoints),...expanded.waypoints]:this.runtimeWaypoints||this.scenario.waypoints;
  const clean=normalize({...this.scenario,waypoints:[...new Map(points.map(w=>[w.name,w])).values()],aircraft:[candidate]}).aircraft[0];
  for(const key of ['type','category','origin','destination','squawk','squawkMode','arrivalRunway','procedures','compiledPlan','compiledRunway','route',...Object.keys(flightFields(clean))])a[key]=clean[key];
  if(expanded){a.flyBy=null;this.runtimeWaypoints=[...new Map(points.map(w=>[w.name,w])).values()];const first=a.remaining[0],i=expanded.route.split(' ').indexOf(first);a.remaining=expanded.route.split(' ').filter(Boolean).slice(Math.max(0,i));a.legStart={lat:a.lat,lon:a.lon};if(a.navigation==='route'&&!a.remaining.length)a.navigation='heading';if(a.approachState!=='off')a.approachState='armed';}
  if(Object.hasOwn(fields,'squawk'))a.assignedSquawk=a.squawk;a.revision=(a.revision||0)+1;this.announce(a);return this.status();
 }
}
module.exports={LocalTraining,normalize,geometry,move,position,flightPlan};
