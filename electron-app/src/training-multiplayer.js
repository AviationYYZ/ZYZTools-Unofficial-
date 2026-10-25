// Optional manual control panel. Never exposes the EuroScope/FSD socket.
const http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
class TrainingMultiplayer{
 constructor(training,port,options={}){this.training=training;this.port=port;this.readOnly=options.readOnly===true;this.requests=new Map();this.log=[];this.generation=0;this.fsd=new (require('./training-fsd-tunnel').FsdSessions)(training);}
 status(){return {enabled:!!this.server,port:this.port,url:'http://127.0.0.1:'+this.port,token:this.server?this.token:'',lastAction:this.log.at(-1)||null};}
 snapshot(){const s=this.training.status();return {role:this.readOnly?'student':'shared',readOnly:this.readOnly,sessionId:s.sessionId,name:s.scenario.name,running:s.running,listening:s.listening,elapsed:s.elapsed,aircraft:s.aircraft.map(a=>({...a})),fixes:(this.training.runtimeWaypoints||s.scenario.waypoints).map(w=>({name:w.name,lat:w.lat,lon:w.lon})),log:this.log.filter(x=>x.sessionId===s.sessionId).slice(-30)};}
 async start(){
  if(this.server)return this.status();if(this.starting)throw Error('Shared control is starting.');
  if(!this.training.server)throw Error('Start the local training server first.');
  this.starting=true;this.token=crypto.randomBytes(32).toString('hex');this.requests.clear();this.log=[];this.generation++;this.count=0;this.window=Date.now();
  const generation=this.generation,server=http.createServer((req,res)=>this.handle(req,res));server.requestTimeout=10000;server.headersTimeout=10000;server.maxHeadersCount=30;server.maxConnections=32;
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(this.port,'127.0.0.1',resolve);});if(generation!==this.generation){server.close();throw Error('Start canceled.');}this.port=server.address().port;this.server=server;server.on('error',()=>this.stop());return this.status();}
  catch{server.close();throw Error('Cannot start shared control port '+this.port+'. Another instance may be using it.');}finally{this.starting=false;}
 }
 stop(){this.generation++;this.fsd.stop();this.server?.closeAllConnections();this.server?.close();this.server=null;this.token='';this.requests.clear();return this.status();}
 reply(res,status,data,type='application/json'){res.writeHead(status,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'",'X-Frame-Options':'DENY'});res.end(type==='application/json'?JSON.stringify(data):data);}
 async handle(req,res){
  const generation=this.generation;
  try{
   if(Date.now()-this.window>60000){this.window=Date.now();this.count=0;}if(++this.count>2400)return this.reply(res,429,{error:'Too many requests. Wait a minute.'});
   const files={'/':'training-multiplayer.html','/panel.js':'training-multiplayer-client.js','/panel.css':'training-multiplayer.css'},file=Object.hasOwn(files,req.url)?files[req.url]:null;
   if(req.method==='GET'&&file)return this.reply(res,200,fs.readFileSync(path.join(__dirname,file),'utf8'),file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/javascript');
   const supplied=req.headers.authorization||'',expected='Bearer '+this.token;
   if(!this.token||Buffer.byteLength(supplied)!==Buffer.byteLength(expected)||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return this.reply(res,401,{error:'Enter the current host access key.'});
   // No CORS or cookie auth. The browser's same-origin policy protects the key.
   if(req.headers['sec-fetch-site']==='cross-site')return this.reply(res,403,{error:'Cross-site requests are not allowed.'});
   if(req.url.startsWith('/api/fsd/'))return await this.fsd.request(req,res,this.reply.bind(this));
   if(req.method==='GET'&&req.url==='/api/status')return this.reply(res,200,this.snapshot());
   if(this.readOnly)return this.reply(res,403,{error:'Student access cannot control aircraft. Use the instructor dashboard.'});
   if(req.method!=='POST'||req.url!=='/api/action')return this.reply(res,404,{error:'Not found.'});
   if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return this.reply(res,415,{error:'JSON required.'});
   let body='';await new Promise((resolve,reject)=>{req.on('data',b=>{body+=b;if(Buffer.byteLength(body)>8192){reject(Error('Request too large.'));req.destroy();}});req.on('end',resolve);req.on('error',reject);req.on('aborted',()=>reject(Error('Request canceled.')));});
   if(generation!==this.generation||!this.server)throw Error('Shared control was stopped.');
   const value=JSON.parse(body);if(value.sessionId!==this.training.sessionId)throw Error('Scenario changed. Refresh before sending another command.');
   if(!this.training.server||!this.training.running)throw Error('The host must start and Run the simulation first.');
   if(!/^[A-Za-z0-9_-]{8,100}$/.test(value.requestId||''))throw Error('A unique request ID is required.');
   if(this.session!==value.sessionId){this.requests.clear();this.session=value.sessionId;}
   const signature=JSON.stringify(value);if(this.requests.has(value.requestId)){const old=this.requests.get(value.requestId);if(old.signature!==signature)throw Error('Request ID already used for a different instruction.');return this.reply(res,200,old.result);}
   if(typeof value.callsign!=='string'||!this.training.aircraft.some(a=>a.callsign===value.callsign&&a.active))throw Error('Select an active simulated aircraft.');
   if(value.action==='command'){
    if(typeof value.command!=='string'||value.command.length>100)throw Error('Invalid command.');this.training.command(value.callsign,value.command);
   }else if(value.action==='amend'){
    const allowed=['flightRules','type','wake','equipment','origin','destination','alternate','cruiseAltitude','cruiseSpeed','departureTime','actualDepartureTime','enrouteHours','enrouteMinutes','fuelHours','fuelMinutes','remarks','flightPlanRoute','arrivalRunway','squawk'];
    if(!value.fields||typeof value.fields!=='object'||Array.isArray(value.fields)||Object.keys(value.fields).some(k=>!allowed.includes(k)))throw Error('Unsupported flight-plan field.');this.training.amend(value.callsign,value.fields);
   }else throw Error('Only manual aircraft commands and flight-plan edits are allowed.');
   const entry={sessionId:value.sessionId,callsign:value.callsign,action:value.action==='command'?value.command:'Flight plan amended',time:this.training.elapsed};this.log.push(entry);if(this.log.length>100)this.log.shift();
   const result={ok:true,sessionId:value.sessionId,entry};this.requests.set(value.requestId,{signature,result});if(this.requests.size>500)this.requests.delete(this.requests.keys().next().value);this.reply(res,200,result);
  }catch(error){if(!res.destroyed&&!res.headersSent)this.reply(res,400,{error:error.message||'Request failed.'});}
 }
}
module.exports={TrainingMultiplayer};
