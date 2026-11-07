// Fixed directory only. Session credentials stay in memory and never enter logs.
const https=require('node:https');
const DIRECTORY='https://zyztools-room-directory-test.zyztools-room-directory.workers.dev';
function code(value){const s=String(value||'').trim().toUpperCase().replace(/-/g,'');if(!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/.test(s))throw Error('Enter the ten-character connection code.');return s.slice(0,5)+'-'+s.slice(5);}
function invite(value){let u;try{u=new URL(value?.url);}catch{throw Error('Directory returned an invalid session.');}if(u.protocol!=='https:'||!/^([a-z0-9]+-)*[a-z0-9]+\.trycloudflare\.com$/.test(u.hostname)||u.port||u.username||u.password||u.pathname!=='/'||u.search||u.hash||!/^[a-f0-9]{64}$/.test(value?.token||''))throw Error('Directory returned an invalid session.');return {url:u.origin,token:value.token};}
function request(route,method='GET',value,owner){return new Promise((resolve,reject)=>{
 const body=value===undefined?null:JSON.stringify(value),req=https.request(DIRECTORY+route,{method,timeout:12000,headers:{...(body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}:{}),...(owner?{Authorization:'Bearer '+owner}:{})}},res=>{let raw='';res.on('data',b=>{raw+=b;if(raw.length>8192)req.destroy(Error('Directory response too large.'));});res.on('error',()=>reject(Error('Directory connection interrupted.')));res.on('end',()=>{if(res.statusCode!==200){const e=Error(res.statusCode===404?'Connection code expired. Ask the host for a new code.':res.statusCode===429?'Directory busy. Retry in one minute.':'Room directory unavailable.');e.status=res.statusCode;reject(e);return;}try{resolve(JSON.parse(raw));}catch{reject(Error('Invalid room directory response.'));}});});req.on('timeout',()=>req.destroy(Error('Room directory timed out.')));req.on('error',()=>reject(Error('Cannot reach room directory. Check internet connection.')));req.end(body);
});}
class DirectoryLease{
 constructor(call=request){this.call=call;this.room=null;this.url='';this.error='';}
 status(){return {code:this.room&&Date.parse(this.room.expiresAt)>Date.now()?this.room.code:'',error:this.error};}
 async sync(url,token){
  invite({url,token});
  if(this.room&&(this.url!==url||Date.parse(this.room.expiresAt)<=Date.now()))await this.stop();
  try{
   if(!this.room){const room=await this.call('/v1/rooms','POST',{url,token});code(room.code);if(!/^[a-f0-9]{64}$/.test(room.ownerToken)||!Number.isFinite(Date.parse(room.expiresAt)))throw Error('Invalid room registration.');this.room=room;this.url=url;}
   else {const r=await this.call('/v1/rooms/'+this.room.code,'PUT',{},this.room.ownerToken);if(!Number.isFinite(Date.parse(r.expiresAt)))throw Error('Invalid room renewal.');this.room.expiresAt=r.expiresAt;}
   this.error='';
  }catch(e){if(e.status===404)this.room=null;this.error=e.message;throw e;}
  return this.status();
 }
 async stop(){const room=this.room;this.room=null;this.url='';this.error='';if(room)await this.call('/v1/rooms/'+room.code,'DELETE',undefined,room.ownerToken).catch(()=>{});}
}
async function resolveCode(value,call=request){return invite(await call('/v1/rooms/'+code(value)));}
module.exports={DIRECTORY,DirectoryLease,resolveCode,code,invite,request};
