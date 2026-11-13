// Isolated classic-FSD traffic source. Optional outbound HTTPS is weather-only.
const net=require('node:net');
const crypto=require('node:crypto');
const flight=require('./training-flight');
const weather=require('./training-weather');
const restrictions=require('./training-restrictions');
const jetProfiles=require('./training-jet-profile');
const nm=3440.065,rad=Math.PI/180,wrap=n=>(n%360+360)%360;
function number(v,min,max,label){if(v===''||v===null||!Number.isFinite(Number(v))||Number(v)<min||Number(v)>max)throw Error(label+' must be '+min+' to '+max+'.');return Number(v);}
function token(v,re,label){if(typeof v!=='string'||!re.test(v))throw Error('Invalid '+label+'.');return v;}
function positionRate(value){if(![0.2,1,2,5].includes(value))throw Error('Invalid legacy update rate; aircraft updates are fixed at 5 seconds.');return 0.2;}
function fpText(value,max,label){const s=String(value||'');if(s.length>max||/[\x00-\x1f:]/.test(s))throw Error('Invalid '+label+'.');return s;}
function assignedRunway(route,destination){const tokens=String(route||'').trim().toUpperCase().split(/\s+/);const airport=tokens.filter(t=>t.startsWith(destination+'/')).at(-1),last=airport||tokens.at(-1)||'';return last.match(/\/(\d{2}[LRC]?)$/)?.[1]||'';}
function flightFields(a){return {flightRules:token(a.flightRules||'I',/^[IV]$/,'flight rules'),wake:token(a.wake||'M',/^[LMHJ]$/,'wake category'),equipment:token(a.equipment||'S',/^[A-Z0-9/]{1,40}$/,'equipment'),departureTime:token(a.departureTime||'0000',/^(?:[01]\d|2[0-3])[0-5]\d$/,'departure time'),actualDepartureTime:token(a.actualDepartureTime||'0000',/^(?:[01]\d|2[0-3])[0-5]\d$/,'actual departure time'),cruiseAltitude:number(a.cruiseAltitude??a.altitude,0,60000,'Cruise altitude'),cruiseSpeed:number(a.cruiseSpeed??a.speed,0,600,'Cruise speed'),enrouteHours:number(a.enrouteHours??1,0,99,'Enroute hours'),enrouteMinutes:number(a.enrouteMinutes??0,0,59,'Enroute minutes'),fuelHours:number(a.fuelHours??2,0,99,'Fuel hours'),fuelMinutes:number(a.fuelMinutes??0,0,59,'Fuel minutes'),alternate:token(a.alternate||'',/^(?:[A-Z]{4})?$/,'alternate'),remarks:fpText(a.remarks,512,'remarks'),flightPlanRoute:fpText(a.flightPlanRoute??a.route,2000,'filed route')};}
function normalize(raw){
 if(!raw||raw.format!=='ZYZTools-training'||raw.version!==1)throw Error('Choose a ZYZTools training scenario (version 1).');
 if(!Array.isArray(raw.aircraft)||raw.aircraft.length>100||!Array.isArray(raw.waypoints)||raw.waypoints.length>2000)throw Error('Limit: 100 aircraft and 2,000 waypoints.');
 const waypoints=raw.waypoints.map(w=>({name:token(w.name,/^[A-Z0-9_-]{1,16}$/,'waypoint'),lat:number(w.lat,-89,89,'Latitude'),lon:number(w.lon,-180,180,'Longitude'),...(w.elevation==null?{}:{elevation:number(w.elevation,-1000,15000,'Waypoint elevation')})}));
 if(new Set(waypoints.map(w=>w.name)).size!==waypoints.length)throw Error('Duplicate waypoint names.');
 const aircraft=raw.aircraft.map(a=>{
  const route=String(a.route||'').trim().toUpperCase().split(/\s+/).filter(Boolean);
  if(route.length>100||route.some(f=>!waypoints.some(w=>w.name===f)))throw Error('Every route fix must be defined in the waypoint list. Expand STARs into fixes first.');
  const result={callsign:token(String(a.callsign||'').toUpperCase(),/^[A-Z][A-Z0-9]{1,11}$/,'callsign'),type:token(String(a.type||'').toUpperCase(),/^[A-Z0-9]{2,4}$/,'aircraft type'),lat:number(a.lat,-89,89,'Latitude'),lon:number(a.lon,-180,180,'Longitude'),altitude:number(a.altitude,0,60000,'Altitude (feet)'),speed:number(a.speed,0,600,'Speed (knots)'),heading:number(a.heading,0,359.99,'True heading'),rate:number(a.rate??2250,100,6000,'Vertical rate (feet/min)'),route:route.join(' '),origin:token(String(a.origin||'CYYZ').toUpperCase(),/^[A-Z]{4}$/,'origin'),destination:token(String(a.destination||'CYYZ').toUpperCase(),/^[A-Z]{4}$/,'destination'),squawk:token(String(a.squawk||'2000'),/^[0-7]{4}$/,'squawk'),spawnTime:number(a.spawnTime??0,0,86400,'Spawn time (simulation seconds)'),spawnFix:token(a.spawnFix||'',/^[A-Z0-9_-]{0,16}$/,'spawn fix'),squawkMode:token(a.squawkMode||'N',/^[NS]$/,'transponder mode'),arrivalRunway:token(a.arrivalRunway||'',/^(?:\d{2}[LRC]?)?$/,'arrival runway'),speedBasis:token(a.speedBasis||'TAS',/^(IAS|TAS)$/,'initial speed basis'),publishedSpeeds:a.publishedSpeeds!==false,procedures:Array.isArray(a.procedures)?a.procedures.map(p=>token(p,/^[A-Z0-9]{1,20}$/,'procedure')):[],...flightFields(a)};
  result.category=token(a.category||(/^(?:A[23]|B7|B3[89]M|E[179]|CRJ|C[567]|GLF|CL[36])/.test(result.type)?'jet':'unknown'),/^(jet|prop|unknown)$/,'aircraft category');
  // Legacy publishedSpeeds:false must not silently disable the repaired default.
  // A NEW, explicit opt-out can still be saved through the aircraft editor.
  if(a.automaticSpeeds!==undefined&&typeof a.automaticSpeeds!=='boolean')throw Error('Invalid automatic speed setting.');
  result.automaticSpeeds=a.automaticSpeeds!==false;result.publishedSpeeds=result.automaticSpeeds;
  if(a.scratchpad!==undefined)result.scratchpad=fpText(a.scratchpad,64,'initial scratchpad');
  if(a.finalApproachIAS!==undefined)result.finalApproachIAS=number(a.finalApproachIAS,50,190,'Training final-approach IAS');
  if(a.initialDescent){const fix=token(a.initialDescent.fix,/^[A-Z0-9_-]{1,16}$/,'initial descent fix');if(!route.includes(fix))throw Error('Initial descent fix must be in the navigation route.');result.initialDescent={fix,altitude:number(a.initialDescent.altitude,0,60000,'Initial descent altitude')};}
  result.compiledPlan=result.flightPlanRoute;result.compiledRunway=result.arrivalRunway;return result;
 });
 if(new Set(aircraft.map(a=>a.callsign)).size!==aircraft.length)throw Error('Aircraft callsigns must be unique.');
 if(raw.runways&&!Array.isArray(raw.runways)||raw.runways?.length>2000)throw Error('Invalid runway catalogue.');
 const runways=(raw.runways||[]).map(r=>({airport:token(r.airport,/^[A-Z]{4}$/,'runway airport'),name:token(r.name,/^\d{2}[LRC]?$/,'runway'),threshold:{lat:number(r.threshold?.lat,-89,89,'Threshold latitude'),lon:number(r.threshold?.lon,-180,180,'Threshold longitude')},opposite:{lat:number(r.opposite?.lat,-89,89,'Runway latitude'),lon:number(r.opposite?.lon,-180,180,'Runway longitude')},elevation:number(r.elevation??0,-1000,15000,'Runway elevation'),simulated:true}));
 if(raw.initialOwnership!==undefined&&raw.initialOwnership!=='instructor')throw Error('Unknown initial ownership mode.');
 return {aircraftSpeedProfiles:jetProfiles.normalizeGroups(raw.aircraftSpeedProfiles),...(raw.initialOwnership?{initialOwnership:raw.initialOwnership}:{}),...(raw.jetSpeedProfile?{jetSpeedProfile:jetProfiles.normalize(raw.jetSpeedProfile)}:{}),positionUpdateHz:positionRate(raw.positionUpdateHz??0.2),magneticVariationWest:number(raw.magneticVariationWest??((aircraft.some(a=>a.destination==='CYYZ')||!aircraft.length)?10.37:0),-180,180,'Magnetic variation west'),format:'ZYZTools-training',version:1,name:String(raw.name||'Local scenario').replace(/[\x00-\x1f]/g,'').slice(0,100),waypoints,aircraft,runways,speedRules:flight.normalizeSpeedRules(raw.speedRules??require('./training-speed-data').rules)};
}
function geometry(a,b){const p=a.lat*rad,q=b.lat*rad,d=(b.lon-a.lon)*rad;const h=Math.sin((q-p)/2)**2+Math.cos(p)*Math.cos(q)*Math.sin(d/2)**2;return {distance:2*nm*Math.asin(Math.sqrt(Math.min(1,h))),bearing:wrap(Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d))/rad)};}
function move(a,distance,heading){const p=a.lat*rad,l=a.lon*rad,t=heading*rad,d=distance/nm;const q=Math.asin(Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(t));return {lat:q/rad,lon:((l+Math.atan2(Math.sin(t)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(q)))/rad+540)%360-180};}
function approach(v,target,step){return v+Math.sign(target-v)*Math.min(Math.abs(target-v),step);}
function position(a){return '@'+(a.identActive?'Y':a.squawkMode||'N')+':'+a.callsign+':'+a.squawk+':1:'+a.lat.toFixed(7)+':'+a.lon.toFixed(7)+':'+Math.round(a.altitude)+':'+Math.round(a.groundSpeed??a.speed)+':'+((Math.round(wrap(a.groundTrack??a.heading)*1024/360)&1023)<<2)+':0';}
// Delete-pilot's second field is a certificate ID, not a receiver/server name.
// Local synthetic pilots have no network identity; use numeric dummy ID 0.
function deletion(a){return '#DP'+a.callsign+':0';}
function flightPlan(a,recipient='*A'){
 const type=(['H','J'].includes(a.wake)?a.wake+'/':'')+a.type+'/'+a.equipment;
 const tokens=String(a.flightPlanRoute).split(/\s+/).filter(Boolean);
 const arrival=tokens.findLastIndex((t,i)=>(a.procedures||[]).includes(t)&&tokens.slice(i+1).every(x=>x.split('/')[0]===a.destination));
 // Explicitly select the runway variant in EuroScope's route extractor,
 // without changing the scenario's compact route or sending expanded fixes.
 if(a.arrivalRunway&&arrival>=0)tokens[arrival]+='/'+a.arrivalRunway;
 const filed=a.arrivalRunway?[...tokens.filter(t=>!new RegExp('^'+a.destination+'(?:/\\d{2}[LRC]?)?$','i').test(t)),a.destination+'/'+a.arrivalRunway].join(' '):a.flightPlanRoute;
 return '$FP'+a.callsign+':'+recipient+':'+a.flightRules+':'+type+':'+Math.round(a.cruiseSpeed)+':'+a.origin+':'+a.departureTime+':'+a.actualDepartureTime+':'+Math.round(a.cruiseAltitude)+':'+a.destination+':'+a.enrouteHours+':'+a.enrouteMinutes+':'+a.fuelHours+':'+a.fuelMinutes+':'+a.alternate+':'+a.remarks+':'+filed;
}
class LocalTraining{
 constructor(host='127.0.0.1',{liveWeather=false}={}){if(!['127.0.0.1','127.0.0.2'].includes(host))throw Error('Only fixed loopback addresses are supported.');this.host=host;this.liveWeather=liveWeather;this.scenario=normalize({format:'ZYZTools-training',version:1,name:'New scenario',waypoints:[],aircraft:[]});this.clients=new Set();this.aircraft=[];this.running=false;this.elapsed=0;this.scale=1;this.reset();}
 load(raw){if(this.server||this.starting)throw Error('Stop the local server before editing or loading a scenario.');this.scenario=normalize(raw);this.reset();return this.status();}
 reset(){
  for(const a of this.aircraft||[])if(a.active)this.broadcast(deletion(a));
  this.running=false;this.elapsed=0;this.runtimeWaypoints=structuredClone(this.scenario.waypoints);this.sessionId=crypto.randomUUID();this.aircraft=this.scenario.aircraft.map(a=>{const ias=a.speedBasis==='IAS'?a.speed:flight.tasToIas(a.speed,a.altitude),speed=a.speedBasis==='IAS'?flight.iasToTas(a.speed,a.altitude):a.speed,remaining=a.route.split(' ').filter(Boolean);const start=remaining.indexOf(a.spawnFix);return {...a,speed,ias,baseIAS:ias,targetIAS:ias,speedMode:a.publishedSpeeds?'published':'assigned',paused:false,approachState:'off',legStart:{lat:a.lat,lon:a.lon},assignedSquawk:a.squawk,trackingController:'',scratchpad:a.scratchpad||'',active:a.spawnTime===0,identUntil:0,identActive:false,targetAltitude:a.altitude,targetSpeed:speed,targetHeading:a.heading,turnDirection:0,passedFixes:start>=0?remaining.slice(0,start):[],remaining:start>=0?remaining.slice(start):remaining,navigation:a.route?'route':'heading'};});
  for(const a of this.aircraft){
   a.jetSpeedProfile=this.scenario.jetSpeedProfile;
   a.aircraftSpeedProfiles=this.scenario.aircraftSpeedProfiles;
   a.initialDescentActive=!!a.initialDescent&&a.initialDescent.altitude<a.altitude;
   if(a.initialDescentActive)a.targetAltitude=a.initialDescent.altitude;
   if(a.speedMode==='published'){a.targetIAS=flight.publishedIAS(a,this.scenario.speedRules,this.runtimeWaypoints,geometry,this.scenario.runways);a.ias=a.targetIAS;a.speed=flight.iasToTas(a.ias,a.altitude);a.targetSpeed=a.speed;}
   if(a.active)this.announce(a);
  }return this.status();
 }
 status(){const p=weather.usable(this.weatherData),label=[p?.metar&&(this.weatherData.metarFresh?'METAR':'cached METAR'),p?.aloft.length&&(this.weatherData.upperFresh?'upper winds':'cached upper winds')].filter(Boolean).join(' + ');return {weatherLabel:this.weatherTimer?'CYYZ weather: '+(label||'standard atmosphere / calm winds'):'',positionUpdateHz:this.scenario.positionUpdateHz,magneticVariationWest:this.scenario.magneticVariationWest,sessionId:this.sessionId,listening:!!this.server,host:this.host,port:this.port||6809,running:this.running,elapsed:this.elapsed,scale:this.scale,sockets:this.clients.size,clients:[...this.clients].filter(c=>c.callsign).length,lastEvent:this.lastEvent||'No local connection received yet.',scenario:this.scenario,aircraft:this.aircraft.map(({wind,...a})=>({...a,trueAirspeed:a.speed,speed:a.groundSpeed??a.speed,magneticHeading:wrap(a.heading+this.scenario.magneticVariationWest),targetMagneticHeading:wrap(a.targetHeading+this.scenario.magneticVariationWest)})),error:this.error||''};}
 write(c,line){if(!c.socket.destroyed){if(c.socket.writableLength>1024*1024){c.socket.destroy();return;}c.socket.write(line+'\r\n');}}
 broadcast(line){for(const c of this.clients)if(c.callsign)this.write(c,line);}
 broadcastAll(){for(const a of this.aircraft)if(a.active){a.identActive=this.elapsed<a.identUntil;this.broadcast(position(a));}}
 announce(a,c,withPosition=true){this.initialOwner(a);const send=line=>c?this.write(c,line):this.broadcast(line);if(withPosition)send(position(a));send(flightPlan(a,c?.callsign||'*A'));for(const peer of c?[c]:this.clients)if(peer.callsign){this.write(peer,'$CQSERVER:'+peer.callsign+':BC:'+a.callsign+':'+a.assignedSquawk);if(a.clearedAltitude!==undefined)this.write(peer,'$CQSERVER:'+peer.callsign+':TA:'+a.callsign+':'+a.clearedAltitude);if(a.scratchpad)this.write(peer,'$CQSERVER:'+peer.callsign+':SC:'+a.callsign+':'+a.scratchpad);if(a.trackingController)this.write(peer,'$CQ'+a.trackingController+':'+peer.callsign+':IT:'+a.callsign);if(a.handoffPacket)this.write(peer,a.handoffPacket);}}
 receive(c,line){
  // Passwords/login lines are never retained or logged. No authentication service is called.
  if(line.startsWith('#AA')){
   const callsign=line.slice(3).split(':')[0];if(!/^[A-Z0-9_]{2,16}$/.test(callsign)||c.callsign||[...this.clients].some(peer=>peer!==c&&peer.callsign===callsign)){c.socket.destroy();return;}
   c.callsign=callsign;this.lastEvent='Local controller login accepted (dummy credentials; no online authentication).';this.write(c,'#TMSERVER:'+callsign+':ZYZTools LOCAL TRAINING ONLY - no VATSIM connection.');
   for(const peer of this.clients)if(peer!==c&&peer.controllerPacket)this.write(c,peer.controllerPacket);for(const a of this.aircraft)if(a.active)this.announce(a,c);return;
  }
  if(!c.callsign)return;
  if(line.startsWith('%')){if(line.slice(1).split(':')[0]!==c.callsign)return;c.controllerPacket=line;for(const peer of this.clients)if(peer!==c&&peer.callsign)this.write(peer,line);return;}
  if(line.startsWith('$CR')||line.startsWith('$CQ')){const f=line.slice(3).split(':');if(f[0]===c.callsign&&['CAPS','RN','RV','ATIS'].includes(f[2])){for(const peer of this.clients)if(peer!==c&&peer.callsign===f[1])this.write(peer,line);return;}}
  if(line.startsWith('$PI')){const f=line.slice(3).split(':');this.write(c,'$POSERVER:'+c.callsign+':'+(f.slice(2).join(':')||'0'));}
  try{
   if(require('./training-coordination').coordinate(this,c,line))return;
   if(line.startsWith('$AM')){
    const f=line.slice(3).split(':');if(f[0]!==c.callsign||f.length!==18)throw Error('Invalid local flight-plan amendment.');
    const aircraftType=f[4].split('/');let wake='M';if(['H','J','L','M'].includes(aircraftType[0]))wake=aircraftType.shift();
    this.amend(f[2],{flightRules:f[3],wake,type:aircraftType.shift(),equipment:aircraftType.join('/')||'S',cruiseSpeed:f[5],origin:f[6],departureTime:f[7].padStart(4,'0'),actualDepartureTime:f[8].padStart(4,'0'),cruiseAltitude:/^FL?\d+$/i.test(f[9])?Number(f[9].replace(/^FL?/i,''))*100:f[9],destination:f[10],enrouteHours:f[11],enrouteMinutes:f[12],fuelHours:f[13],fuelMinutes:f[14],alternate:f[15],remarks:f[16],flightPlanRoute:f[17]});this.lastEvent='EuroScope flight plan saved: '+f[2];return;
   }
   if(line.startsWith('$CQ')||line.startsWith('#PC')){
    const f=line.slice(3).split(':'),offset=line.startsWith('#PC')?3:2;if(f[0]!==c.callsign)return;if(offset===3&&f[2]!=='CCP')return;
    const kind=f[offset],a=this.aircraft.find(a=>a.callsign===f[offset+1]&&a.active),value=f[offset+2];if(!a)return;
    if(kind==='FP'){this.announce(a,c);return;}
    if(kind==='BC'&&(value===undefined||value==='')){this.write(c,'$CQSERVER:'+c.callsign+':BC:'+a.callsign+':'+a.assignedSquawk);return;}
    if(kind==='BC'){a.assignedSquawk=token(value,/^[0-7]{4}$/,'assigned squawk');}
    else if(kind==='SC'){a.scratchpad=fpText(value,64,'scratchpad');const text=a.scratchpad.toUpperCase();let match;if((match=text.match(/^H(\d{1,3})$/)))a.assignedHeading=Number(match[1])%360;else if((match=text.match(/^S(\d{2,3})$/)))a.assignedSpeed=Number(match[1]);else if((match=text.match(/^R(-?\d{1,4})$/)))a.assignedRate=Math.abs(Number(match[1]));else if((this.runtimeWaypoints||this.scenario.waypoints).some(w=>w.name===text))a.directTo=text;else if(!text){a.assignedHeading=0;a.assignedSpeed=0;a.assignedRate=0;a.directTo='';}}
    else if(kind==='TA')a.clearedAltitude=number(value,0,60000,'Cleared altitude');
    else return;
    // Controller assignments are metadata, not pilot instructions. Never turn/descend/change actual squawk here.
    require('./training-pilot-tags').annotate(a,c.callsign,kind,value,this.runtimeWaypoints||this.scenario.waypoints);
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
   socket.on('error',()=>{});socket.on('close',()=>{this.clients.delete(c);if(c.callsign){this.broadcast('#DA'+c.callsign+':SERVER');for(const a of this.aircraft){for(const [field,source]of Object.entries(a.annotationSources||{}))if(source.author===c.callsign)delete a.annotationSources[field];if(a.trackingController===c.callsign){a.trackingController='';a.handoffTarget='';a.handoffPacket='';this.broadcast('$CQ'+c.callsign+':*A:DR:'+a.callsign);}else if(a.handoffTarget===c.callsign){a.handoffTarget='';a.handoffPacket='';this.broadcast('$CQ'+a.trackingController+':*A:HC:'+a.callsign);}}}this.lastEvent=c.callsign?'Local controller disconnected.':'Local connection closed before controller login. Verify the non-VATSIM connection settings.';});
   socket.on('data',bytes=>{c.buffer+=bytes.toString('utf8');if(c.buffer.length>32768){socket.destroy();return;}let end;while((end=c.buffer.indexOf('\n'))>=0){const line=c.buffer.slice(0,end).replace(/\r$/,'');c.buffer=c.buffer.slice(end+1);this.receive(c,line);}});
  });
  this.starting=true;
  try{await new Promise((resolve,reject)=>{server.once('error',()=>reject(Error('Cannot start '+this.host+':'+this.port+'. Another local server may be using it. Stop that server; do not change Connect to VATSIM.')));server.listen({host:this.host,port:this.port},resolve);});}
  finally{this.starting=false;}
  this.server=server;server.on('error',()=>{this.error='Local server stopped unexpectedly.';this.stop();});
  // Physics stays at 10 Hz. Publication uses wall time, independent of scale.
  // One batch per frame at most: a delayed timer never creates catch-up bursts.
  // 1 Hz remains available for plugins that timestamp samples in whole seconds.
  if(this.liveWeather&&this.scenario.aircraft.some(a=>a.destination==='CYYZ'||a.origin==='CYYZ')){
   const refresh=()=>weather.refresh().then(data=>{if(this.server===server)this.weatherData=data;}).catch(()=>{});
   this.weatherTimer=setInterval(refresh,weather.refreshMs+1000);this.weatherTimer.unref();refresh();
  }
  this.last=performance.now();this.publishElapsed=0;this.timer=setInterval(()=>{const now=performance.now(),dt=Math.max(0,(now-this.last)/1000);this.last=now;this.frame(dt);},100);return this.status();
 }
 updateRate(value){const hz=positionRate(value);if(hz===this.scenario.positionUpdateHz)return this.status();this.scenario={...this.scenario,positionUpdateHz:hz};this.publishElapsed=0;return this.status();}
 speedProfile(profile,group='jet'){const normalized=jetProfiles.normalizeGroup(group,profile);const profiles={...this.scenario.aircraftSpeedProfiles};if(group==='jet')this.scenario.jetSpeedProfile=normalized;else if(normalized)profiles[group]=normalized;else delete profiles[group];this.scenario.aircraftSpeedProfiles=profiles;for(const a of this.aircraft){a.jetSpeedProfile=this.scenario.jetSpeedProfile;a.aircraftSpeedProfiles=profiles;if(a.speedMode==='published')a.targetIAS=flight.publishedIAS(a,this.scenario.speedRules,this.runtimeWaypoints||this.scenario.waypoints,geometry,this.scenario.runways);}return this.status();}
 initialOwner(a){if(this.scenario.initialOwnership!=='instructor'||!a.active||a.initialOwnershipAssigned||!this.instructorCallsign||![...this.clients].some(c=>c.callsign===this.instructorCallsign&&!c.socket.destroyed))return; a.initialOwnershipAssigned=true;if(!a.trackingController)a.trackingController=this.instructorCallsign;}
 registerInstructor(callsign){if(this.scenario.initialOwnership!=='instructor')throw Error('This scenario does not request instructor ownership.');const present=cs=>[...this.clients].some(c=>c.callsign===cs&&!c.socket.destroyed);if(!/^[A-Z0-9_]{2,16}$/.test(callsign)||!present(callsign))throw Error('Connect instructor EuroScope before assigning ownership.');if(this.instructorCallsign&&this.instructorCallsign!==callsign&&present(this.instructorCallsign))throw Error('A different instructor is already registered.');this.instructorCallsign=callsign;for(const a of this.aircraft){const owner=a.trackingController;this.initialOwner(a);if(a.active&&a.trackingController!==owner)this.broadcast('$CQ'+a.trackingController+':*A:IT:'+a.callsign);}return this.status();}
 frame(seconds){if(this.running)this.tick(Math.min(1,seconds)*this.scale);const interval=1/this.scenario.positionUpdateHz;this.publishElapsed=(this.publishElapsed||0)+seconds;if(this.publishElapsed+1e-9>=interval){this.publishElapsed=Math.max(0,this.publishElapsed-Math.floor((this.publishElapsed+1e-9)/interval)*interval);this.broadcastAll();}}
 stop(){this.running=false;clearInterval(this.timer);clearInterval(this.weatherTimer);this.weatherTimer=null;this.weatherData=null;for(const c of this.clients){for(const a of this.aircraft)this.write(c,deletion(a));c.socket.destroy();}this.clients.clear();this.server?.close();this.server=null;return this.status();}
 run(){if(!this.server)throw Error('Start the local server first.');this.running=true;this.last=performance.now();return this.status();}
 pause(){this.running=false;return this.status();}
 tick(seconds){for(let remaining=seconds;remaining>0;remaining-=0.25)this.step(Math.min(0.25,remaining));}
 step(dt){
  const before=this.elapsed,profile=weather.usable(this.weatherData);this.elapsed+=dt;
  for(const a of this.aircraft){
   if(this.elapsed<a.spawnTime)continue;const step=Math.max(0,this.elapsed-Math.max(before,a.spawnTime));if(!a.active){a.active=true;this.announce(a);}a.identActive=this.elapsed<a.identUntil;
   if(a.paused)continue;
   const fixes=this.runtimeWaypoints?.length?this.runtimeWaypoints:this.scenario.waypoints;
   flight.initialVerticalGuidance(a,fixes,geometry);
   const crossingRate=restrictions.update(a,fixes,geometry);
   if(a.speedMode==='published')a.targetIAS=flight.publishedIAS(a,this.scenario.speedRules,fixes,geometry,this.scenario.runways);
   const inArea=Math.abs(a.lat-43.6777)<2&&Math.abs(a.lon+79.6248)<2.75;
   const w=a.wind=inArea?weather.sample(profile,a.altitude):null;
   const toTas=ias=>w?weather.iasToTas(ias,w):flight.iasToTas(ias,a.altitude),toIas=tas=>w?weather.tasToIas(tas,w):flight.tasToIas(tas,a.altitude);
   if(a.speedMode==='mach')a.targetIAS=toIas(w?a.targetMach*weather.sound(w.kelvin):flight.machToTas(a.targetMach,a.altitude));
   if(a.speedMode==='published'||a.speedBasis==='IAS'||a.iasCommand){a.ias=approach(a.ias,a.targetIAS,2*step);a.speed=toTas(a.ias);a.targetSpeed=toTas(a.targetIAS);}else{a.speed=approach(a.speed,a.targetSpeed,2*step);a.ias=toIas(a.speed);}
   ({speed:a.groundSpeed,track:a.groundTrack}=weather.motion(a.heading,a.speed,w));
   if(a.navigation==='hold'&&a.hold)require('./training-hold').guide(a,step,geometry,move);
   if(a.navigation==='route'&&a.remaining.length&&!['localizer captured','glideslope captured'].includes(a.approachState))flight.guideRoute(a,fixes,geometry,move,this.scenario.runways.find(r=>r.airport===a.destination&&r.name===a.arrivalRunway));
   if(a.approachState!=='off')flight.guideApproach(a,this.scenario.runways,geometry);
   if(a.paused)continue;
   const previousAltitude=a.altitude;a.altitude=approach(a.altitude,a.targetAltitude,(a.approachState==='glideslope captured'?a.approachRate:crossingRate??a.rate)/60*step);a.verticalSpeed=step>0?(a.altitude-previousAltitude)*60/step:0;
   flight.turnMotion(a,step);
   ({speed:a.groundSpeed,track:a.groundTrack}=weather.motion(a.heading,a.speed,w));
   Object.assign(a,move(a,a.groundSpeed/3600*step,a.groundTrack));
  }
  const finished=this.aircraft.filter(a=>a.active&&(a.landed||a.routeCompleted&&a.approachState==='off'));
  for(const a of finished)this.broadcast(deletion(a));
  if(finished.length)this.aircraft=this.aircraft.filter(a=>!finished.includes(a));
 }
 command(callsign,command){
  const list=require('./training-commands').commands(command);
  if(list.length>1){
   if(list.some(item=>item.startsWith('RWY ')))throw Error('Runway diversion must be sent on its own.');
   if(list.includes('DELETE AIRCRAFT'))throw Error('DELETE must be sent on its own.');
   // Validate and apply on a private copy first. A bad second command must not
   // leave the first one applied, nor emit any partial radar updates.
   const shadow=Object.create(this);shadow.aircraft=structuredClone(this.aircraft);shadow.broadcast=()=>{};shadow.broadcastAll=()=>{};
   for(const item of list)shadow.command(callsign,item);
   const actual=this.aircraft.find(a=>a.callsign===callsign),updated=shadow.aircraft.find(a=>a.callsign===callsign);
   Object.assign(actual,updated);return this.status();
  }
  command=list[0];
  const a=this.aircraft.find(a=>a.callsign===callsign);if(!a)throw Error('Select a simulated aircraft.');
  if(String(command).trim().toUpperCase()==='DELETE AIRCRAFT'){this.aircraft=this.aircraft.filter(x=>x!==a);this.broadcast(deletion(a));return this.status();}
  if(!a.active)throw Error('Aircraft has not spawned yet.');
  const parts=String(command).trim().toUpperCase().split(/\s+/);
  if(parts[0]==='HOLD'){
   if(parts[1]==='CANCEL'||parts[1]==='EXIT'){
    if(!a.hold)throw Error('Aircraft is not holding.');
    if(parts[1]==='EXIT')a.hold.exit=true;
    else{a.hold=null;a.navigation='heading';a.targetHeading=a.heading;a.turnDirection=0;}
   }else{
    a.hold=require('./training-hold').create(parts,this.runtimeWaypoints?.length?this.runtimeWaypoints:this.scenario.waypoints,this.scenario.magneticVariationWest,move,a.altitude);
    a.navigation='hold';a.approachState='off';a.approachVectorTarget=null;a.explicitDirectFix=null;a.directGuidance=null;a.flyBy=null;a.turnDirection=0;
    a.initialDescentActive=false;a.routeCompleted=false;
   }
   a.revision=(a.revision||0)+1;return this.status();
  }
  if(parts[0]==='IAS'&&parts[2]==='UNTIL'){restrictions.speed(a,Number(parts[1]),parts[3]);a.targetIAS=Number(parts[1]);a.revision=(a.revision||0)+1;return this.status();}
  if(parts[0]==='CROSS'){restrictions.cross(a,parts[1],Number(parts[3]));a.revision=(a.revision||0)+1;return this.status();}
  if(parts[0]==='RESTRICTIONS'){if(parts[1]==='SPEED'){restrictions.clearSpeed(a);a.targetIAS=flight.publishedIAS(a,this.scenario.speedRules,this.runtimeWaypoints||this.scenario.waypoints,geometry,this.scenario.runways);}else restrictions.clearCross(a);a.revision=(a.revision||0)+1;return this.status();}
  if(parts[0]==='IDENT'&&parts.length===1){a.revision=(a.revision||0)+1;a.identUntil=this.elapsed+18;a.identActive=true;return this.status();}if(parts.length!==2)throw Error('Use ALT, RATE, SPD, HDG/LHDG/RHDG, DCT, SQ, MODE, IDENT or ROUTE RESUME.');
  const [verb,arg]=parts;
  if(a.hold&&['HDG','LHDG','RHDG','ROUTE','APP','DCT','RWY'].includes(verb))throw Error('Cancel the hold before issuing another lateral clearance.');
  if(verb==='RWY')return this.divert(callsign,arg);
  if(['HDG','LHDG','RHDG','ROUTE','APP','DCT'].includes(verb)){a.directGuidance=null;a.navigationNotice='';}
  if(['HDG','LHDG','RHDG','ROUTE','APP'].includes(verb))a.explicitDirectFix=null;
  if(verb==='HDG'&&arg==='PRESENT'){a.targetHeading=a.heading;a.turnDirection=0;a.bank=0;a.navigation='heading';a.flyBy=null;if(a.approachState!=='off'){a.approachState='armed';a.approachVectorTarget=a.targetHeading;}a.revision=(a.revision||0)+1;return this.status();}
  if(verb==='ALT'){const target=number(arg,0,60000,'Target altitude (feet)');if(a.approachState!=='off'&&target>a.altitude+50){a.approachState='off';a.approachVectorTarget=null;a.approachNotice='Go-around: climb to assigned altitude; approach guidance cancelled.';a.navigation='heading';a.flyBy=null;a.targetHeading=a.heading;a.turnDirection=0;a.routeCompleted=false;}a.targetAltitude=target;a.initialDescentActive=false;restrictions.clearCross(a);}
  else if(verb==='RATE'){if(a.approachState==='glideslope captured')throw Error('ILS glidepath controls vertical rate (ground speed × 6). Use APP CANCEL, then ALT and RATE for a manual climb/descent.');a.rate=number(arg,100,6000,'Climb/descent rate magnitude (feet/min)');a.manualRate=true;}
  else if(['SPD','IAS'].includes(verb)){const n=number(arg,50,400,'Speed (knots IAS)');restrictions.clearSpeed(a,false);a.targetIAS=n;a.speedMode='assigned';a.iasCommand=true;}
  else if(verb==='MACH'){const n=number(arg,.1,.99,'Mach number');restrictions.clearSpeed(a,false);a.targetMach=n;a.speedMode='mach';a.iasCommand=true;}
  else if(verb==='SPEED'&&arg==='PUBLISHED'){restrictions.clearSpeed(a,false);a.speedMode='published';a.targetIAS=flight.publishedIAS(a,this.scenario.speedRules,this.runtimeWaypoints||this.scenario.waypoints,geometry,this.scenario.runways);}
  else if(verb==='PAUSE'&&['ON','OFF'].includes(arg)){a.paused=arg==='ON';}
  else if(verb==='APP'&&arg==='CLEAR'){if(!a.arrivalRunway||!this.scenario.runways.some(r=>r.airport===a.destination&&r.name===a.arrivalRunway))throw Error('Select a runway with imported sector geometry before clearing the approach.');a.approachVectorTarget=a.navigation==='heading'&&Math.abs(flight.turnError(a))>1?a.targetHeading:null;a.approachState='armed';}
  else if(verb==='APP'&&arg==='CANCEL'){a.approachNotice='';a.approachState='off';a.approachVectorTarget=null;a.navigation='heading';a.flyBy=null;a.targetHeading=a.heading;a.turnDirection=0;a.targetAltitude=a.altitude;a.initialDescentActive=false;}
  else if(['HDG','LHDG','RHDG'].includes(verb)){a.targetHeading=wrap(number(arg,0,360,'Magnetic heading')-this.scenario.magneticVariationWest);a.navigation='heading';a.flyBy=null;if(a.approachState!=='off'){a.approachState='armed';a.approachVectorTarget=a.targetHeading;}a.turnDirection=verb==='LHDG'?-1:verb==='RHDG'?1:0;}
  else if(verb==='SQ')a.squawk=token(arg,/^[0-7]{4}$/,'squawk');
  else if(verb==='MODE'){if(!['C','STBY'].includes(arg))throw Error('Use MODE C or MODE STBY.');a.squawkMode=arg==='C'?'N':'S';a.identUntil=0;a.identActive=false;}
  else if(verb==='DCT'){
   if(!(this.runtimeWaypoints?.length?this.runtimeWaypoints:this.scenario.waypoints).some(w=>w.name===arg))throw Error('Waypoint is not defined in this scenario.');
   const i=a.remaining.indexOf(arg),filed=a.route.split(' ').filter(Boolean),j=filed.indexOf(arg);a.remaining=i>=0?a.remaining.slice(i):j>=0?filed.slice(j):[arg];a.explicitDirectFix=arg;a.navigationNotice='';a.navigation='route';a.routeCompleted=false;a.flyBy=null;a.legStart={lat:a.lat,lon:a.lon};a.approachState='off';a.turnDirection=0;
  }
  else if(verb==='ROUTE'&&arg==='RESUME'){if(!a.remaining.length)throw Error('No remaining route. Use DCT FIX.');a.approachVectorTarget=null;a.navigation='route';}
  else throw Error('Unknown command. Use ALT, RATE, SPD, HDG, DCT or ROUTE RESUME.');
  if(a.speedMode==='published')a.targetIAS=flight.publishedIAS(a,this.scenario.speedRules,this.runtimeWaypoints||this.scenario.waypoints,geometry,this.scenario.runways);
  a.revision=(a.revision||0)+1;return this.status();
 }
 divert(callsign,runway,fields={}){
  const a=this.aircraft.find(a=>a.callsign===callsign&&a.active);
  if(!a)throw Error('Select an active simulated aircraft.');
  if(a.arrivalRunway===runway)throw Error('Aircraft is already assigned runway '+runway+'.');
  const threshold=this.scenario.runways.find(r=>r.airport===a.destination&&r.name===runway);
  if(!threshold)throw Error('No simulator geometry for runway '+runway+'.');
  const library=require('./training-route-variants.json');
  const variant=library.procedures.find(p=>p.airport===a.destination&&p.runway===runway&&a.procedures.includes(p.name));
  if(!variant)throw Error('No loaded alternative STAR for runway '+runway+'. Use a manual runway and route amendment.');
  const plan=variant.fixes[0]+' '+variant.name+' '+a.destination+'/'+runway;
  const points=new Map([...library.fixes,...(this.runtimeWaypoints?.length?this.runtimeWaypoints:this.scenario.waypoints)].map(w=>[w.name,w]));
  const resolved={route:variant.fixes.join(' '),waypoints:variant.fixes.map(n=>points.get(n)),arrivalRunway:runway,procedures:[variant.name]};
  const track=a.groundTrack??a.heading;
  const oldRoute=a.route.split(' '),oldNext=a.remaining[0],oldIndex=oldRoute.indexOf(oldNext),newIndex=variant.fixes.indexOf(oldNext);
  const keepLeg=a.navigation==='route'&&!a.explicitDirectFix&&!a.flyBy&&a.approachState==='off'&&oldIndex>0&&newIndex>0&&oldRoute[oldIndex-1]===variant.fixes[newIndex-1];
  const angle=(x,y)=>Math.abs((x-y+540)%360-180);
  const axis=geometry(threshold.threshold,threshold.opposite).bearing;
  const eligible=resolved.waypoints.map(w=>{
   const from=geometry(a,w),r=geometry(threshold.threshold,w);
   const onFinal=angle(r.bearing,axis+180)<8&&r.distance<13;
   return {name:w.name,distance:from.distance,turn:angle(from.bearing,track),onFinal};
  }).filter(w=>!w.onFinal&&w.distance>=.15&&w.turn<=100);
  const next=eligible.find(w=>w.name===a.remaining[0]&&a.navigation==='route')||eligible.sort((x,y)=>x.distance+x.turn/20-y.distance-y.turn/20)[0];
  const wasGlide=a.approachState==='glideslope captured';
  this.amend(callsign,{...fields,arrivalRunway:runway,flightPlanRoute:plan},resolved);
  if(wasGlide)a.targetAltitude=a.altitude;
  if(keepLeg){a.navigationNotice='Runway '+runway+' assigned; continuing on the shared STAR leg.';}
  else if(next){this.command(callsign,'DCT '+next.name);a.navigationNotice='Diverted to '+runway+' via '+next.name+'; approach clearance required.';}
  else{a.navigation='heading';a.explicitDirectFix=null;a.flyBy=null;a.turnDirection=0;a.targetHeading=a.heading;a.navigationNotice='Runway '+runway+' route loaded. No suitable forward rejoin; vector or issue direct-to.';}
  return this.status();
 }
 amend(callsign,fields,preparedRoute){
  const a=this.aircraft.find(a=>a.callsign===callsign&&a.active);if(!a)throw Error('Select an active simulated aircraft.');let candidate={...a,...fields},expanded,vectorsOnly=false;
  if(Object.hasOwn(fields,'flightPlanRoute')&&!Object.hasOwn(fields,'arrivalRunway'))candidate.arrivalRunway=assignedRunway(fields.flightPlanRoute,candidate.destination)||candidate.arrivalRunway;
  const runwayChanged=candidate.arrivalRunway!==a.arrivalRunway||candidate.destination!==a.destination;
  if(runwayChanged&&candidate.arrivalRunway&&!/^(?:0[1-9]|[12][0-9]|3[0-6])[LRC]?$/.test(candidate.arrivalRunway))throw Error('Enter a runway designator from 01 to 36, optionally followed by L, C or R.');
  const hasGeometry=!candidate.arrivalRunway||this.scenario.runways.some(r=>r.airport===candidate.destination&&r.name===candidate.arrivalRunway);
  // Strip only the redundant wire suffix when EuroScope echoes a plan.
  if(Object.hasOwn(fields,'flightPlanRoute')&&candidate.arrivalRunway){
   const tokens=String(candidate.flightPlanRoute).trim().split(/\s+/);
   const i=tokens.findLastIndex((t,j)=>t.endsWith('/'+candidate.arrivalRunway)&&a.procedures.includes(t.split('/')[0])&&tokens.slice(j+1).some(x=>x===candidate.destination+'/'+candidate.arrivalRunway));
   if(i>=0){tokens[i]=tokens[i].split('/')[0];candidate.flightPlanRoute=tokens.join(' ');}
  }
  const routeChanged=['flightPlanRoute','arrivalRunway','origin','destination'].some(k=>candidate[k]!==a[k]);
  if(routeChanged){
   const root=plan=>String(plan).toUpperCase().replace(/\/\d{2}[LRC]?(?=\s|$)/g,'').split(/\s+/).filter(t=>t&&t!==a.destination).join(' ');
   const runwayOnly=candidate.arrivalRunway!==a.arrivalRunway&&candidate.origin===a.origin&&candidate.destination===a.destination&&root(candidate.flightPlanRoute)===root(a.flightPlanRoute);
   if(!preparedRoute&&runwayOnly&&hasGeometry&&a.navigation==='route'&&require('./training-route-variants.json').procedures.some(p=>p.airport===a.destination&&p.runway===candidate.arrivalRunway&&a.procedures.includes(p.name)))return this.divert(callsign,candidate.arrivalRunway,fields);
   const points=this.runtimeWaypoints?.length?this.runtimeWaypoints:this.scenario.waypoints;
   const assignForVectors=()=>{
    const tokens=String(candidate.flightPlanRoute).toUpperCase().split(/\s+/).filter(t=>t&&t.split('/')[0]!==candidate.destination&&!a.procedures.includes(t.split('/')[0]));
    candidate.flightPlanRoute=[...tokens,candidate.destination+(candidate.arrivalRunway?'/'+candidate.arrivalRunway:'')].join(' ');
    vectorsOnly=true;
    return {route:'',waypoints:[],arrivalRunway:candidate.arrivalRunway,procedures:[]};
   };
   if(runwayOnly&&(!hasGeometry||a.vectorOnlyRunway)){expanded=assignForVectors();candidate={...candidate,...expanded};}
   else if(!a.procedures.length&&candidate.arrivalRunway!==a.arrivalRunway&&candidate.origin===a.origin&&candidate.destination===a.destination&&root(candidate.flightPlanRoute)===root(a.flightPlanRoute)){
    const points=this.runtimeWaypoints||this.scenario.waypoints,route=a.route.split(' ').filter(Boolean),r=this.scenario.runways.find(r=>r.airport===candidate.destination&&r.name===candidate.arrivalRunway);let added=[];
    if(r&&(/^(?:ILS\d{2}[LRC]?)$/.test(route.at(-1)||'')||new RegExp('^'+candidate.destination+'_\\d{2}[LRC]?$').test(route.at(-1)||''))){const name=candidate.destination+'_'+candidate.arrivalRunway;route[route.length-1]=name;added=[{name,...r.threshold}];}
    expanded={route:route.join(' '),waypoints:[...points,...added],arrivalRunway:candidate.arrivalRunway,procedures:a.procedures};candidate={...candidate,...expanded};
   }else{
    // Re-resolve the entire STAR, not just its runway threshold. A rejected
    // amendment leaves the old route and its assigned runway intact.
    if(Object.hasOwn(fields,'arrivalRunway')){
     const prefix=candidate.destination+'/';
     const tokens=String(candidate.flightPlanRoute).toUpperCase().split(/\s+/).filter(t=>t&&t!==candidate.destination&&!t.startsWith(prefix));
     const last=tokens.at(-1),suffix=last?.match(/^([A-Z0-9]+)\/(\d{2}[LRC]?)$/);
     if(suffix&&a.procedures.includes(suffix[1]))tokens[tokens.length-1]=suffix[1];
     candidate.flightPlanRoute=[...tokens,candidate.arrivalRunway?prefix+candidate.arrivalRunway:candidate.destination].join(' ');
    }
    candidate.compiledPlan=null;
    try{expanded=preparedRoute||(this.planResolver?this.planResolver(candidate):require('./training-routes').expandRoute(candidate,{fixes:points},[]));}
    catch(e){if(!runwayOnly||!a.procedures.length)throw e;expanded=assignForVectors();}
    if(Object.hasOwn(fields,'arrivalRunway')&&expanded.arrivalRunway!==candidate.arrivalRunway)throw Error('The filed STAR suffix conflicts with the selected runway.');
    candidate={...candidate,...expanded};
   }
  }
  if(expanded&&candidate.initialDescent&&!candidate.route.split(' ').includes(candidate.initialDescent.fix))candidate.initialDescent=undefined;
  const points=expanded?[...(this.runtimeWaypoints||this.scenario.waypoints),...expanded.waypoints]:this.runtimeWaypoints||this.scenario.waypoints;
  const clean=normalize({...this.scenario,waypoints:[...new Map(points.map(w=>[w.name,w])).values()],aircraft:[candidate]}).aircraft[0];
  for(const key of ['type','category','origin','destination','squawk','squawkMode','arrivalRunway','procedures','compiledPlan','compiledRunway','route',...Object.keys(flightFields(clean))])a[key]=clean[key];
  if(expanded){
   a.vectorOnlyRunway=vectorsOnly;
   a.flyBy=null;a.directGuidance=null;this.runtimeWaypoints=[...new Map(points.map(w=>[w.name,w])).values()];
   const route=expanded.route.split(' ').filter(Boolean),first=a.remaining?.[0],i=route.indexOf(first);
   const continuing=a.navigation==='route'&&i>=0&&!(runwayChanged&&a.approachState!=='off');
   a.remaining=route.slice(Math.max(0,i));a.routeCompleted=false;
   if(!continuing){
    if(a.navigation==='route'){a.targetHeading=a.heading;a.turnDirection=0;}
    a.navigation='heading';a.explicitDirectFix=null;a.legStart={lat:a.lat,lon:a.lon};
    a.navigationNotice=vectorsOnly?(hasGeometry?'Runway assigned. No matching STAR; holding heading for vectors or a new route.':'Runway assigned. No simulated runway geometry; vectors only until geometry is imported.'):'Plan amended. Holding heading until direct-to or route resume.';
   }else if(a.explicitDirectFix!==first)a.explicitDirectFix=null;
   if(runwayChanged){a.approachState='off';a.approachVectorTarget=null;a.approachNotice='Runway changed; new approach clearance required.';}
  }
  if(expanded&&!candidate.initialDescent){delete a.initialDescent;a.initialDescentActive=false;}
  if(Object.hasOwn(fields,'squawk'))a.assignedSquawk=a.squawk;a.revision=(a.revision||0)+1;this.announce(a,undefined,false);return this.status();
 }
}
module.exports={LocalTraining,normalize,geometry,move,position,flightPlan};
