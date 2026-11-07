const fs=require('node:fs');
const WebSocket=require('ws');
const FEATURES=Object.fromEntries(Object.entries(require('./policy-catalog.json')).map(([id,{label}])=>[id,label]));
const DEFAULT='https://zyztools-room-directory-test.zyztools-room-directory.workers.dev';
const empty=()=>({revision:0,announcement:null,maintenance:false,rules:{}});
function normalize(raw){
 if(!raw||!Number.isSafeInteger(raw.revision)||raw.revision<0||typeof raw.maintenance!=='boolean'||!raw.rules||typeof raw.rules!=='object')throw Error('Invalid policy response.');
 const {announcement:a}=raw;
 return {revision:raw.revision,maintenance:raw.maintenance,announcement:a&&typeof a.message==='string'&&Number.isFinite(a.until)?{message:a.message.slice(0,500),until:a.until}:null,
  rules:Object.fromEntries(Object.entries(raw.rules).filter(([k,v])=>Object.hasOwn(FEATURES,k)&&['open','disabled','code'].includes(v)))};
}
class AppPolicyClient{
 constructor({file,onChange=()=>{},origin=DEFAULT,request=fetch,Socket=WebSocket}={}){
  this.file=file;this.onChange=onChange;this.origin=origin;this.request=request;this.Socket=Socket;this.state=empty();this.grant=null;
  try{if(file)this.state=normalize(JSON.parse(fs.readFileSync(file,'utf8')));}catch{}
 }
 snapshot(){
  const s=this.state,g=this.grant;
  return {...s,announcement:s.announcement?.until>Date.now()?s.announcement:null,unlocked:g?.revision===s.revision&&g.expires>Date.now()?g.features:[],connected:!!this.connected};
 }
 assert(feature){
  const s=this.snapshot(),rule=s.rules[feature];
  if(s.maintenance&&['localTraining','scenarioBuilder'].includes(feature))throw Error('New training actions are paused for maintenance.');
  if(rule==='disabled')throw Error(FEATURES[feature]+' is disabled.');
  if(rule==='code'&&!s.unlocked.includes(feature))throw Error(FEATURES[feature]+' requires access.');
 }
 accept(raw){
  const next=normalize(raw);this.connected=true;
  if(next.revision<this.state.revision)return;
  this.state=next;
  if(this.file)try{fs.writeFileSync(this.file,JSON.stringify(next));}catch{}
  this.onChange(this.snapshot());
 }
 async call(route,value,key){
  const res=await this.request(this.origin+route,{method:value?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(7000),headers:{...(value?{'Content-Type':'application/json'}:{}),...(key?{Authorization:'Bearer '+key}:{})},...(value?{body:JSON.stringify(value)}:{})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(res.status===404?'App policy service is not deployed yet.':String(data.error||'App policy service unavailable.'));
  return data;
 }
 async redeem(code){
  const g=await this.call('/v2/redeem',{code});
  if(!Array.isArray(g.features)||!Number.isFinite(g.expires)||!Number.isInteger(g.revision))throw Error('Invalid feature grant.');
  if(g.revision!==this.state.revision)await this.refresh();
  this.grant=g;this.onChange(this.snapshot());return this.snapshot();
 }
 async admin(key,action){
  if(typeof key!=='string'||!/^[a-f0-9]{64}$/i.test(key))throw Error('Enter the private 64-character admin password.');
  const result=await this.call('/v2/admin',action,key);
  if(result.rules)this.accept(result);
  return result;
 }
 async refresh(){
  try{const state=await this.call('/v2/policy');if(!this.closed&&this.socket?.readyState!==1)this.accept(state);}
  catch{if(this.socket?.readyState!==1){this.connected=false;this.onChange(this.snapshot());}}
 }
 connect(){
  if(this.closed||!this.Socket||this.socket)return;
  try{
   const ws=new this.Socket(this.origin.replace(/^https:/,'wss:').replace(/^http:/,'ws:')+'/v2/events',{handshakeTimeout:7000,maxPayload:8192});this.socket=ws;
   ws.addEventListener('message',event=>{try{if(this.socket===ws&&typeof event.data==='string'&&event.data.length<8192)this.accept(JSON.parse(event.data));}catch{}});
   const retry=()=>{if(this.socket!==ws)return;this.socket=null;this.connected=false;try{ws.close();}catch{}this.onChange(this.snapshot());if(!this.closed){this.retry=setTimeout(()=>this.connect(),30000+Math.random()*10000);this.retry.unref?.();}};
   ws.addEventListener('close',retry);ws.addEventListener('error',retry);
  }catch{}
 }
 start(){this.closed=false;this.refresh();this.connect();this.poll=setInterval(()=>{if(this.socket?.readyState!==1)this.refresh();else this.onChange(this.snapshot());},60000);this.poll.unref?.();}
 stop(){this.closed=true;clearInterval(this.poll);clearTimeout(this.retry);const ws=this.socket;this.socket=null;ws?.close();}
}
module.exports={AppPolicyClient,FEATURES,normalize};
