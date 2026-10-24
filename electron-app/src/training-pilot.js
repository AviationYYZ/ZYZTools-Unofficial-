const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),crypto=require('node:crypto');
const {LocalTraining}=require('./local-training');
const digits=n=>String(n).split('').map(c=>['zero','one','two','three','four','five','six','seven','eight','niner'][Number(c)]||c).join(' ');
function altitude(n){const small=['zero','one','two','three','four','five','six','seven','eight','niner','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];const word=n=>n<20?small[n]:['','','twenty','thirty','forty','fifty','sixty'][Math.floor(n/10)]+(n%10?' '+small[n%10]:'');return n%1000===0?word(n/1000)+' thousand':String(n)+' feet';}
function spokenCallsign(callsign){const match=callsign.match(/^([A-Z]{3})(\d.*)$/),airlines={ACA:'Air Canada',WJA:'WestJet',JZA:'Jazz',POE:'Porter',TSC:'Air Transat',ROU:'Rouge'};if(match&&airlines[match[1]])return airlines[match[1]]+' '+digits(match[2]);const alphabet=['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf','Hotel','India','Juliett','Kilo','Lima','Mike','November','Oscar','Papa','Quebec','Romeo','Sierra','Tango','Uniform','Victor','Whiskey','X-ray','Yankee','Zulu'];return callsign.split('').map(c=>/[A-Z]/.test(c)?alphabet[c.charCodeAt(0)-65]:digits(c)).join(' ');}
function readback(a,commands){return commands.map(command=>{
 const [verb,arg]=command.split(' ');
 if(verb==='ALT')return (Number(arg)<a.altitude?'descend and maintain ':Number(arg)>a.altitude?'climb and maintain ':'maintain ')+altitude(Number(arg));
 if(verb==='RATE')return 'vertical rate '+String(arg)+' feet per minute';
 if(['SPD','IAS'].includes(verb))return 'speed '+digits(arg)+' knots';
 if(verb==='SPEED'&&arg==='PUBLISHED')return 'resume published speeds';
 if(verb==='APP')return arg==='CLEAR'?'cleared simulated ILS runway '+a.arrivalRunway:'approach canceled';
 if(['HDG','LHDG','RHDG'].includes(verb))return (verb==='LHDG'?'left ':verb==='RHDG'?'right ':'')+'heading '+digits(String(Number(arg)===0?360:Number(arg)).padStart(3,'0'))+' magnetic';
 if(verb==='DCT')return 'direct '+arg;if(verb==='SQ')return 'squawk '+digits(arg);if(verb==='IDENT')return 'ident';if(verb==='MODE')return 'squawk '+(arg==='C'?'Charlie':'standby');if(verb==='ROUTE')return 'resume own navigation';throw Error('Unsupported maneuver.');
}).join(', ')+', '+spokenCallsign(a.callsign)+'.';}
class TrainingPilot{
 constructor(training,folder,test){this.training=training;this.file=path.join(folder,'pilot-bridge.json');this.pipe='\\\\.\\pipe\\ZYZToolsPilot'+(test?'.Test':'');this.pending=new Map();this.requests=new Map();this.enabled=false;this.readbackMode='windows';}
 snapshot(){this.expire();const s=this.training.status();return {enabled:this.enabled,readbackMode:this.readbackMode,sessionId:s.sessionId,listening:s.listening,running:s.running,elapsed:s.elapsed,aircraft:s.aircraft.filter(a=>a.active).map(a=>({callsign:a.callsign,type:a.type,altitude:a.altitude,speed:a.speed,ias:a.ias,heading:a.heading,magneticHeading:a.magneticHeading,squawk:a.squawk,targetAltitude:a.targetAltitude,targetSpeed:a.targetSpeed,targetHeading:a.targetHeading,targetMagneticHeading:a.targetMagneticHeading,remaining:a.remaining,paused:a.paused,arrivalRunway:a.arrivalRunway,approachState:a.approachState,speedMode:a.speedMode})),fixes:(this.training.runtimeWaypoints||s.scenario.waypoints).map(w=>w.name),pending:[...this.pending.values()].map(p=>({id:p.id,sessionId:p.sessionId,readback:p.readback}))};}
 expire(){if(this.requestSession!==this.training.sessionId){this.pending.clear();this.requests.clear();this.requestSession=this.training.sessionId;}for(const [id,p]of this.pending)if(Date.now()>p.expires||p.sessionId!==this.training.sessionId)this.pending.delete(id);}
 async enable(enabled){
  if(!enabled){this.enabled=false;this.pending.clear();this.requests.clear();for(const c of this.sockets||[])c.destroy();this.server?.close();this.server=null;try{fs.unlinkSync(this.file);}catch{}return this.snapshot();}
  if(this.enabled)return this.snapshot();if(this.starting)throw Error('Pilot bridge is starting.');this.starting=true;
  try{this.token=crypto.randomBytes(32).toString('hex');this.sockets=new Set();const server=net.createServer(socket=>{
   this.sockets.add(socket);socket.on('close',()=>this.sockets.delete(socket));socket.on('error',()=>{});socket.setTimeout(5000,()=>socket.destroy());let buffer='';
   socket.on('data',data=>{buffer+=data.toString();if(buffer.length>20000){socket.destroy();return;}const i=buffer.indexOf('\n');if(i<0)return;try{const request=JSON.parse(buffer.slice(0,i));if(typeof request.token!=='string'||request.token.length!==this.token.length||!crypto.timingSafeEqual(Buffer.from(request.token),Buffer.from(this.token)))throw Error('Pilot bridge authorization failed.');const result=request.action==='status'?this.snapshot():request.action==='queue'?this.queue(request.value):(()=>{throw Error('Unknown pilot tool.');})();socket.end(JSON.stringify({result})+'\n');}catch(error){socket.end(JSON.stringify({error:error.message})+'\n');}});
  });await new Promise((resolve,reject)=>{server.once('error',()=>reject(Error('Pilot bridge endpoint is busy. Close the other instance of this app channel.')));server.listen(this.pipe,resolve);});
  this.server=server;server.on('error',()=>{this.enabled=false;this.pending.clear();});fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,JSON.stringify({pipe:this.pipe,token:this.token}),{mode:0o600});this.enabled=true;return this.snapshot();
  }catch(error){this.enabled=false;this.server?.close();this.server=null;throw error;}finally{this.starting=false;}
 }
 validate(value){
  if(!this.enabled||!this.training.server||!this.training.running)throw Error('Enable the pilot bridge and Run the local simulation first.');
  if(value?.sessionId!==this.training.sessionId)throw Error('Stale session. Fetch training status again.');
  if(!/^[A-Z][A-Z0-9]{1,11}$/.test(value.callsign||'')||!Array.isArray(value.commands)||!value.commands.length||value.commands.length>5)throw Error('Specify one exact callsign and one to five bounded commands.');
  if(value.commands.some(c=>typeof c!=='string'||!(/^(?:ALT|RATE|SPD|IAS|HDG|LHDG|RHDG|DCT|SQ|MODE|APP|SPEED) [A-Z0-9_.-]+$/.test(c)||c==='IDENT'||c==='ROUTE RESUME')))throw Error('Unsupported pilot command.');
  const a=this.training.aircraft.find(a=>a.callsign===value.callsign&&a.active);if(!a)throw Error('No active simulated aircraft has that exact callsign. Ask for clarification.');
  if(a.paused)throw Error('Aircraft is individually paused. Resume it in the command centre before giving another clearance.');
  const copy=new LocalTraining(this.training.host);copy.scenario=structuredClone(this.training.scenario);copy.runtimeWaypoints=structuredClone(this.training.runtimeWaypoints);copy.aircraft=structuredClone(this.training.aircraft);copy.elapsed=this.training.elapsed;for(const c of value.commands)copy.command(value.callsign,c);return {a,updated:copy.aircraft.find(a=>a.callsign===value.callsign)};
 }
 queue(value){
  this.expire();if(!/^[A-Za-z0-9_-]{8,100}$/.test(value?.requestId||''))throw Error('A stable request ID is required to avoid duplicate readbacks.');
  if(this.requests.has(value.requestId))return this.requests.get(value.requestId);
  if(this.readbackMode==='chatgpt'&&value.readbackCompleted!==true)throw Error('ChatGPT voice mode: finish the spoken pilot readback first, then submit readbackCompleted=true. No maneuver executed.');
  if(this.pending.size>=5)throw Error('Pilot readback queue is full. Wait for it to finish.');const {a}=this.validate(value);
  if([...this.pending.values()].some(p=>p.callsign===a.callsign))throw Error('That aircraft already has a pending readback. Wait for it to finish.');
  const p={id:crypto.randomUUID(),sessionId:this.training.sessionId,callsign:a.callsign,commands:[...value.commands],revision:a.revision||0,readback:readback(a,value.commands),expires:Date.now()+60000};this.pending.set(p.id,p);
  let result={id:p.id,status:'queued_for_local_spoken_readback',readback:p.readback,maneuverStarted:false};
  if(this.readbackMode==='chatgpt'){const done=this.complete({id:p.id,sessionId:p.sessionId});result={...result,...done,status:'maneuver_started_after_agent_readback_report',sessionId:p.sessionId,maneuverStarted:true,audioCompletionVerified:false};}
  this.requests.set(value.requestId,result);if(this.requests.size>200)this.requests.delete(this.requests.keys().next().value);return result;
 }
 setReadbackMode(mode){if(!['chatgpt','windows'].includes(mode))throw Error('Choose ChatGPT or Windows readback.');this.pending.clear();this.requests.clear();this.readbackMode=mode;return this.snapshot();}
 complete(value){this.expire();const p=this.pending.get(value?.id);if(!p||value.sessionId!==p.sessionId)throw Error('Readback expired, canceled, or belongs to another session. No maneuver executed.');const {a,updated}=this.validate(p);if((a.revision||0)!==p.revision){this.pending.delete(p.id);throw Error('Aircraft instructions changed during readback. Repeat the clearance.');}Object.assign(a,updated);this.pending.delete(p.id);this.training.broadcastAll();return {status:'maneuver_started_after_readback',callsign:a.callsign};}
 cancel(id){this.pending.delete(id);return this.snapshot();}
}
function checkIn(a){return spokenCallsign(a.callsign)+', '+altitude(Math.round(a.altitude/100)*100)+(a.targetAltitude!==a.altitude?', '+(a.targetAltitude<a.altitude?'descending to ':'climbing to ')+altitude(a.targetAltitude):', level')+'.';}
module.exports={TrainingPilot,readback,checkIn};
