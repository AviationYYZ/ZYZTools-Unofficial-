// One instructor connection manages all three slots. Student keys never authorize
// these endpoints. No arbitrary path, URL, shell command or filesystem API exists.
const http=require('node:http'),crypto=require('node:crypto'),path=require('node:path'),fs=require('node:fs'),engine=require('./engine.cjs');
const {TrainingTunnel}=engine('training-tunnel'),{DirectoryLease}=engine('training-directory');
function equal(a,b){return Buffer.byteLength(a)===Buffer.byteLength(b)&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));}
class InstructorHub{
 constructor(manager,helper,options={}){
  this.manager=manager;this.port=options.port??16820;this.token='';this.requests=new Map();this.queues=new Map();this.generation=0;
  this.tunnel=options.tunnel||new TrainingTunnel(helper,()=>this.server?'http://127.0.0.1:'+this.port:null);
  this.tunnel.configFolder=path.join(manager.folder,'instructor-tunnel');this.lease=options.lease||new DirectoryLease();this.readiness=new (engine('training-fsd-tunnel').FsdConnector)('127.0.0.2');
 }
 status(){const t=this.tunnel.status(),l=this.lease.status();return {enabled:!!this.server,state:t.state,code:t.state==='ready'?l.code:'',error:this.error||l.error||t.error||''};}
 reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"});res.end(JSON.stringify(data));}
 async start(){
  if(this.server||this.starting)throw Error('Instructor access is already enabled or starting.');this.starting=true;const generation=++this.generation;this.token=crypto.randomBytes(32).toString('hex');this.requests.clear();this.count=0;this.window=Date.now();
  const server=http.createServer((req,res)=>this.handle(req,res));server.requestTimeout=30000;server.headersTimeout=10000;server.maxHeadersCount=30;server.maxConnections=20;
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(this.port,'127.0.0.1',resolve);});if(generation!==this.generation){server.close();throw Error('Enable canceled.');}this.port=server.address().port;this.server=server;server.on('error',()=>this.stop());this.nextTunnel=0;this.nextLease=0;this.error='';this.timer=setInterval(()=>this.network(),1000);this.network();return this.status();}
  catch{server.close();this.token='';throw Error('Cannot start instructor access. Check the local management port.');}finally{this.starting=false;}
 }
 async network(){
  if(!this.server||this.networkBusy)return;this.networkBusy=true;const generation=this.generation;
  try{let t=this.tunnel.status();if(!t.running&&Date.now()>this.nextTunnel){this.nextTunnel=Date.now()+60000;await this.lease.stop();if(generation!==this.generation)return;await this.tunnel.start();t=this.tunnel.status();}
   if(t.state==='ready'&&Date.now()>this.nextLease){this.nextLease=Date.now()+10000;this.readiness.url=new URL(t.url);this.readiness.token=this.token;const s=await this.readiness.call('/api/instructor/status');if(s.service!=='ZYZTools Instructor'||s.role!=='instructor')throw Error('Unexpected service.');if(generation!==this.generation)return;await this.lease.sync(t.url,this.token);this.nextLease=Date.now()+45000;this.error='';}
  }catch{this.error='Instructor connection is not ready. Retrying automatically.';}finally{this.networkBusy=false;}
 }
 async stop(){this.generation++;clearInterval(this.timer);this.server?.closeAllConnections();this.server?.close();this.server=null;this.token='';this.requests.clear();this.readiness.stop();this.tunnel.stop();await this.lease.stop();return this.status();}
 async handle(req,res){
  try{
   if(Date.now()-this.window>60000){this.window=Date.now();this.count=0;}if(++this.count>600)return this.reply(res,429,{error:'Too many instructor requests.'});
   // Non-sensitive marker used only by the bundled helper's local origin probe.
   if(req.method==='GET'&&req.url==='/')return this.reply(res,200,{service:'ZYZTools shared sweatbox instructor gateway'});
   if(!this.token||!equal(req.headers.authorization||'','Bearer '+this.token))return this.reply(res,401,{error:'Instructor pairing is required.'});
   if(req.headers['sec-fetch-site']==='cross-site')return this.reply(res,403,{error:'Cross-site requests are not allowed.'});
   if(req.method==='GET'&&req.url==='/api/instructor/status')return this.reply(res,200,{service:'ZYZTools Instructor',role:'instructor',apiVersion:1,...this.manager.status()});
   const match=req.url.match(/^\/api\/instructor\/aircraft\/([123])$/);
   if(req.method==='GET'&&match)return this.reply(res,200,await this.manager.call(Number(match[1]),'instructor',{operation:'snapshot'}));
   if(req.method!=='POST'||req.url!=='/api/instructor/action')return this.reply(res,404,{error:'Not found.'});
   if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return this.reply(res,415,{error:'JSON required.'});
   if(Number(req.headers['content-length'])>4194304)return this.reply(res,413,{error:'Scenario exceeds 4 MB.'});
   const generation=this.generation,chunks=[];let bytes=0;for await(const b of req){bytes+=b.length;if(bytes>4194304)throw Error('Scenario exceeds 4 MB.');chunks.push(b);}const raw=Buffer.concat(chunks).toString('utf8');
   if(generation!==this.generation||!this.server)throw Error('Instructor access stopped.');
   let value;try{value=JSON.parse(raw);}catch{throw Error('Invalid JSON.');}
   if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).some(k=>!['requestId','slot','action','epoch','payload'].includes(k))||!/^[a-zA-Z0-9_-]{8,100}$/.test(value.requestId||''))throw Error('Invalid instructor request.');
   this.manager.slot(value.slot);
   const allowed=['import','demo','start','stop','run','pause','reset','restart','command','amend','studentInvite'];if(!allowed.includes(value.action))throw Error('Unsupported instructor action.');
   for(const [id,r]of this.requests)if(r.at<Date.now()-300000)this.requests.delete(id);
   const signature=crypto.createHash('sha256').update(raw).digest('hex'),old=this.requests.get(value.requestId);
   if(old){if(old.signature!==signature)throw Error('Request ID already used.');return this.reply(res,200,await old.result);}
   if(this.requests.size>=200)throw Error('Too many pending instructor requests. Retry later.');
   const previous=this.queues.get(value.slot)||Promise.resolve();
   const result=previous.catch(()=>{}).then(async()=>{
    if(generation!==this.generation||!this.server)throw Error('Instructor access stopped.');
    if(this.manager.slot(value.slot).epoch!==value.epoch)throw Error('Server changed. Refresh before trying again.');
    return this.apply(value);
   });this.queues.set(value.slot,result);this.requests.set(value.requestId,{signature,result,at:Date.now()});
   const output=await result;this.reply(res,200,output);
  }catch(e){if(!res.destroyed&&!res.headersSent)this.reply(res,400,{error:e.message||'Instructor request failed.'});}
 }
 async apply(v){const id=v.slot,p=v.payload||{};
  if(v.action==='studentInvite')return {invite:await this.manager.call(id,'invite')};
  if(['command','amend'].includes(v.action)){
   if(typeof p.callsign!=='string'||typeof p.sessionId!=='string'||v.action==='command'&&(typeof p.command!=='string'||p.command.length>512))throw Error('Invalid aircraft instruction.');
   return this.manager.call(id,'instructor',{operation:v.action,sessionId:p.sessionId,callsign:p.callsign,command:p.command,fields:p.fields});
  }
  if(v.action==='import'||v.action==='demo'){
   const scenario=engine('local-training').normalize(v.action==='demo'?engine('training-demo.json'):p.scenario);if(!scenario.aircraft.length)throw Error('Scenario must contain aircraft.');
   await this.manager.stop(id);this.manager.import(id,scenario);return this.manager.status();
  }
  if(v.action==='start')return this.manager.start(id);
  if(v.action==='stop')return this.manager.stop(id);
  if(v.action==='restart'){await this.manager.stop(id);return this.manager.start(id);}
  return this.manager.action(id,v.action);
 }
}
module.exports={InstructorHub};
