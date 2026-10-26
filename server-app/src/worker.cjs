const fs=require('node:fs'),path=require('node:path'),engine=require('./engine.cjs');
const {LocalTraining}=engine('local-training'),{TrainingMultiplayer}=engine('training-multiplayer'),{TrainingTunnel}=engine('training-tunnel'),{DirectoryLease}=engine('training-directory');
const slot=Number(process.argv[2]),folder=process.argv[3],helper=process.argv[4],mode=process.argv[5]==='euroscope'?'euroscope':'zyztools';
if(![1,2,3].includes(slot)||!folder)process.exit(2);
const training=mode==='euroscope'?new (engine('training-native-relay').NativeEuroScopeRelay)('127.0.0.'+(10+slot)):new LocalTraining(),shared=new TrainingMultiplayer(training,16810+slot,{readOnly:true,instructorTransport:true}),tunnel=new TrainingTunnel(helper,()=>shared.server?shared.status().url:null,{launch:(...args)=>{const child=require('node:child_process').spawn(...args);child.once('spawn',()=>send({tunnelPid:child.pid}));return child;}}),lease=new DirectoryLease();
const readiness=new (engine('training-fsd-tunnel').FsdConnector)('127.0.0.2');
tunnel.configFolder=folder;
let stopping=false,operation=Promise.resolve(),networkBusy=false,nextLease=0,nextTunnel=0,verifiedURL='',publicError='';
function send(message){if(process.connected)process.send(message);}
function status(){const s=training.status(),t=tunnel.status(),l=lease.status();return {slot,engineMode:mode,nativeHostConnected:s.nativeHostConnected===true,hostAddress:mode==='euroscope'?training.host:undefined,listening:s.listening,running:s.running,elapsed:s.elapsed,clients:s.clients,aircraft:s.scenario.aircraft.length,active:s.aircraft.filter(a=>a.active).length,name:s.scenario.name,tunnel:t.state==='ready'&&verifiedURL!==t.url?'verifying':t.state,code:t.state==='ready'&&verifiedURL===t.url?l.code:'',error:publicError||l.error||t.error||s.error,fsdPort:training.port||16800+slot,panelPort:16810+slot};}
async function network(){
 if(stopping||networkBusy||!training.server)return;networkBusy=true;
 try{
  let t=tunnel.status();
  if(!t.running&&Date.now()>=nextTunnel){nextTunnel=Date.now()+60000;verifiedURL='';publicError='';await lease.stop();if(stopping)return;await tunnel.start();t=tunnel.status();}
  if(t.state==='ready'&&Date.now()>=nextLease){
   nextLease=Date.now()+10000;
   if(verifiedURL!==t.url){
    readiness.url=new URL(t.url);readiness.token=shared.token;
    try{const remote=await readiness.call('/api/status');if(!remote.listening||typeof remote.sessionId!=='string')throw Error('Not ready.');verifiedURL=t.url;publicError='';}
    catch{publicError='Waiting for the public tunnel to become reachable. Retrying automatically.';return;}
   }
   if(stopping)return;
   nextLease=Date.now()+45000;await lease.sync(t.url,shared.token);
  }
 }catch{ /* sanitized, user-readable errors are in tunnel/lease status */ }
 finally{networkBusy=false;}
}
async function shutdown(){if(stopping)return;stopping=true;clearInterval(timer);readiness.stop();tunnel.stop();shared.stop();training.stop();await Promise.race([lease.stop(),new Promise(r=>setTimeout(r,1500))]);process.exit(0);}
process.on('disconnect',shutdown);process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
process.on('message',m=>{operation=operation.then(async()=>{
 try{
  if(m.action==='start'){
   training.load(JSON.parse(fs.readFileSync(path.join(folder,'scenario.json'),'utf8')));await training.start(mode==='euroscope'?6809:16800+slot);
   try{await shared.start();}catch(e){training.stop();throw e;}
   if(m.run&&mode!=='euroscope')training.run();await network();
  }else if(m.action==='pause')training.pause();
  else if(m.action==='run')training.run();
  else if(m.action==='reset')training.reset();
  else if(m.action==='instructor'){
   if(m.operation==='snapshot'){send({id:m.id,result:shared.snapshot()});return;}
   if(m.sessionId!==training.sessionId)throw Error('Scenario changed. Refresh the aircraft dashboard.');
   if(!training.server)throw Error('Start this server first.');
   if(m.operation==='command')training.command(m.callsign,m.command);
   else if(m.operation==='amend'){
    const allowed=['flightRules','type','wake','equipment','origin','destination','alternate','cruiseAltitude','cruiseSpeed','departureTime','actualDepartureTime','enrouteHours','enrouteMinutes','fuelHours','fuelMinutes','remarks','flightPlanRoute','arrivalRunway','squawk'];
    if(!m.fields||typeof m.fields!=='object'||Array.isArray(m.fields)||Object.keys(m.fields).some(k=>!allowed.includes(k)))throw Error('Unsupported flight-plan field.');
    training.amend(m.callsign,m.fields);
   }else throw Error('Unsupported instructor operation.');
   send({id:m.id,result:shared.snapshot()});return;
  }
  else if(m.action==='invite'||m.action==='instructorInvite'){const t=tunnel.status();if(t.state!=='ready')throw Error('Wait for the internet connection to be ready.');send({id:m.id,result:engine('training-invite').makeInvite(t.url,m.action==='instructorInvite'?shared.instructorToken:shared.token)});return;}
  else if(m.action==='shutdown'){await shutdown();return;}
  else if(m.action!=='status')throw Error('Unsupported action.');
  send({id:m.id,result:status()});
 }catch(e){send({id:m.id,error:e.message});}
 }).catch(()=>{});});
const timer=setInterval(()=>{send({status:status()});network();},1000);
send({ready:true});
