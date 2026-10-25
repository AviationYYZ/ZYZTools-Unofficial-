// Authenticated, bounded HTTP transport for an existing loopback FSD session.
// No configurable upstream: host side can connect only to its own simulator.
const net=require('node:net'),crypto=require('node:crypto'),http=require('node:http'),https=require('node:https');
class FsdSessions{
 constructor(training){this.training=training;this.sessions=new Map();}
 close(id){const s=this.sessions.get(id);if(s){s.socket.destroy();s.wait?.();this.sessions.delete(id);}}
 stop(){for(const id of this.sessions.keys())this.close(id);}
 async request(req,res,reply){
  const parts=req.url.split('/'),verb=parts[3],id=parts[4];
  if(verb==='open'&&req.method==='POST'){
   if(!this.training.server)throw Error('Training server is stopped.');if(this.sessions.size>=3)throw Error('Remote connection limit reached.');
   const id=crypto.randomBytes(24).toString('hex'),socket=net.connect({host:this.training.host,port:this.training.port}),s={socket,buffer:Buffer.alloc(0),sequence:0,ended:false,last:Date.now()};this.sessions.set(id,s);
   socket.on('data',b=>{s.buffer=Buffer.concat([s.buffer,b]);if(s.buffer.length>262144){s.ended=true;socket.destroy();}s.wait?.();});socket.on('error',()=>{s.ended=true;s.wait?.();});socket.on('close',()=>{s.ended=true;s.wait?.();});
   s.timer=setInterval(()=>{if(Date.now()-s.last>30000){clearInterval(s.timer);this.close(id);}},10000);socket.on('close',()=>clearInterval(s.timer));
   await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});return reply(res,200,{id});
  }
  const s=this.sessions.get(id);if(!s)throw Error('Remote session expired. Reconnect.');s.last=Date.now();
  if(verb==='close'&&req.method==='POST'){this.close(id);return reply(res,200,{ok:true});}
  if(verb==='read'&&req.method==='GET'){
   if(s.wait)throw Error('A read is already pending.');
   if(!s.buffer.length&&!s.ended)await new Promise(resolve=>{const timer=setTimeout(done,1000);function done(){clearTimeout(timer);s.wait=null;resolve();}s.wait=done;req.once('aborted',done);});
   const data=s.buffer.toString('base64');s.buffer=Buffer.alloc(0);return reply(res,200,{data,ended:s.ended});
  }
  if(verb==='write'&&req.method==='POST'){
   let raw='';for await(const b of req){raw+=b;if(raw.length>50000)throw Error('FSD write exceeds limit.');}const v=JSON.parse(raw);
   if(s.ended)throw Error('Remote socket closed.');if(v.sequence!==s.sequence+1)throw Error('Out-of-order FSD write.');if(typeof v.data!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(v.data))throw Error('Invalid FSD payload.');
   const data=Buffer.from(v.data,'base64');if(data.length>32768||s.socket.writableLength>262144)throw Error('FSD buffer limit.');s.socket.write(data);s.sequence=v.sequence;return reply(res,200,{ok:true});
  }
  throw Error('Invalid FSD operation.');
 }
}
class FsdConnector{
 constructor(host){this.host=host;this.sockets=new Set();this.activeRequests=new Set();this.generation=0;}
 status(){return {enabled:!!this.server,checking:this.starting===true,remoteName:this.remoteName||'',address:this.host,port:6809,connections:this.sockets.size,error:this.error||''};}
 stop(){this.generation++;for(const req of this.activeRequests)req.destroy();this.activeRequests.clear();for(const s of this.sockets)s.destroy();this.sockets.clear();this.server?.close();this.server=null;return this.status();}
 async start(value){
  if(this.server||this.starting)throw Error('Connector is already started.');const url=new URL(value.url);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Enter the tunnel origin only, without credentials/path/query.');
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&url.hostname==='127.0.0.1'))throw Error('Use an HTTPS tunnel URL. HTTP is allowed only for loopback testing.');
  if(!/^[a-f0-9]{64}$/.test(value.token||''))throw Error('Enter the host access key.');
  this.url=url;this.token=value.token;this.error='';this.starting=true;const generation=++this.generation;
  const server=net.createServer(socket=>this.accept(socket,generation));
  try{const remote=await this.call('/api/status');if(generation!==this.generation)throw Error('Join canceled.');if(!remote.listening||typeof remote.sessionId!=='string')throw Error('The host training server is not ready.');this.remoteName=String(remote.name||'Training session');await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(6809,this.host,resolve);});if(generation!==this.generation){server.close();throw Error('Start canceled.');}this.server=server;server.on('error',e=>{this.error=e.message;this.stop();});return this.status();}catch(e){if(generation===this.generation)this.error=e.code==='EADDRINUSE'?'EuroScope connector address is busy. Stop the other local server/connector.':e.message;throw Error(this.error||'Join canceled.');}finally{this.starting=false;}
 }
 call(route,value){return new Promise((resolve,reject)=>{const data=value===undefined?null:JSON.stringify(value),client=this.url.protocol==='https:'?https:http;
  const req=client.request(new URL(route,this.url),{method:data?'POST':'GET',headers:{Authorization:'Bearer '+this.token,...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{})},timeout:12000},res=>{let raw='';res.on('data',b=>{raw+=b;if(raw.length>500000)req.destroy(Error('Tunnel response too large.'));});res.on('end',()=>{try{if(res.statusCode===401)throw Error('Invite/access key expired or incorrect. Ask the host to Copy private invite again.');if(res.statusCode===502||res.statusCode===503)throw Error('Tunnel cannot reach the host. Ask them to check hosting and internet tunnel status.');let result;try{result=JSON.parse(raw);}catch{throw Error('The address did not respond as a ZYZTools host. Check the invite or retry when the tunnel is ready.');}if(res.statusCode!==200)throw Error(result.error||'Tunnel rejected the connection.');resolve(result);}catch(e){reject(e);}});res.on('error',reject);});
  this.activeRequests.add(req);req.on('close',()=>this.activeRequests.delete(req));req.on('timeout',()=>req.destroy(Error('Tunnel timed out.')));req.on('error',reject);req.end(data);
 });}
 async accept(socket,generation){
  if(this.sockets.size>=3){socket.destroy();return;}this.sockets.add(socket);socket.setNoDelay(true);socket.pause();let id,sequence=0,closed=false;
  socket.on('error',()=>{});socket.on('close',()=>{closed=true;this.sockets.delete(socket);if(id&&generation===this.generation)this.call('/api/fsd/close/'+id,{}).catch(()=>{});});
  try{
   ({id}=await this.call('/api/fsd/open',{}));if(closed||generation!==this.generation){this.call('/api/fsd/close/'+id,{}).catch(()=>{});return;}
   const write=async()=>{try{for await(const chunk of socket){if(chunk.length>32768)throw Error('EuroScope write exceeds limit.');await this.call('/api/fsd/write/'+id,{sequence:++sequence,data:chunk.toString('base64')});}}catch(e){this.error=e.message;socket.destroy();}};write();socket.resume();
   while(!closed&&generation===this.generation){const result=await this.call('/api/fsd/read/'+id);if(result.data){if(socket.writableLength>262144)throw Error('EuroScope is not reading.');socket.write(Buffer.from(result.data,'base64'));}if(result.ended)break;}
  }catch(e){this.error=e.message;}finally{socket.destroy();if(id&&generation===this.generation)this.call('/api/fsd/close/'+id,{}).catch(()=>{});}
 }
}
module.exports={FsdSessions,FsdConnector};
