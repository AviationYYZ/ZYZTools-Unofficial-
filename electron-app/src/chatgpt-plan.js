// Public-client OAuth for the documented ChatGPT plan usage flow. Main process only.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http');
const ISSUER='https://auth.openai.com',RESOURCE='https://api.openai.com/v1';
const SCOPES='openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const random=()=>crypto.randomBytes(32).toString('base64url');
function failure(status){return Error(status===401?'ChatGPT connection expired. Continue with ChatGPT again.':status===403?'ChatGPT plan permission or account eligibility is unavailable. Reconnect or check ChatGPT usage settings.':status===429?'ChatGPT plan usage limit reached. Check Manage usage; no paid API fallback was used.':'ChatGPT request failed (HTTP '+status+'). No API-key fallback was used.');}
function verifyIdentity(token,keys,clientId,nonce,subject,now=Date.now()){
 try{
  const parts=token.split('.');if(parts.length!==3||token.length>65536)throw Error();
  const header=JSON.parse(Buffer.from(parts[0],'base64url')),claims=JSON.parse(Buffer.from(parts[1],'base64url'));
  if(header.alg!=='RS256'||typeof header.kid!=='string'||header.crit)throw Error();
  const jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.use||k.use==='sig')&&(!k.alg||k.alg==='RS256'));
  if(!jwk||!crypto.verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),crypto.createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url')))throw Error();
  const aud=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  if(claims.iss!==ISSUER||!aud.includes(clientId)||(aud.length>1&&claims.azp!==clientId)||(claims.azp!==undefined&&claims.azp!==clientId)||typeof claims.sub!=='string'||!claims.sub||!Number.isFinite(claims.exp)||claims.exp*1000<=now-5000||!Number.isFinite(claims.iat)||claims.iat*1000>now+5000||(claims.nbf!==undefined&&(!Number.isFinite(claims.nbf)||claims.nbf*1000>now+5000))||(nonce!==undefined&&claims.nonce!==nonce)||(subject&&claims.sub!==subject))throw Error();
  return {subject:claims.sub,issuer:claims.iss,email:typeof claims.email==='string'?claims.email.slice(0,254):'',name:typeof claims.name==='string'?claims.name.slice(0,100):''};
 }catch{throw Error('ChatGPT identity could not be verified. Sign in again; previous profiles were preserved.');}
}
async function readStream(response){
 if(!response.body)throw Error('ChatGPT returned no response stream.');
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',size=0,completed;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.length;if(size>2*1024*1024)throw Error('ChatGPT response exceeded the supported size.');
   buffer=(buffer+decoder.decode(value,{stream:true})).replace(/\r\n/g,'\n');
   let end;while((end=buffer.indexOf('\n\n'))>=0){
    const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);
    const raw=frame.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
    if(!raw||raw==='[DONE]')continue;
    let event;try{event=JSON.parse(raw);}catch{throw Error('ChatGPT returned an invalid stream.');}
    if(['error','response.failed','response.incomplete'].includes(event.type))throw Error('ChatGPT did not complete a usable response. No maneuver was accepted.');
    if(event.type==='response.completed'){completed=event.response;if(completed?.status!=='completed')throw Error('ChatGPT response was not complete.');return completed;}
   }
  }
  throw Error('ChatGPT stream ended before completion. No maneuver was accepted.');
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
class ChatGPTPlan{
 constructor(folder,storage,openBrowser,appName,fetcher=fetch){
  this.file=path.join(folder,'chatgpt-plan.bin');this.storage=storage;this.openBrowser=openBrowser;this.appName=appName;this.fetch=fetcher;this.refreshing=new Map();this.epoch=0;
 }
 load(){
  if(!this.storage.isEncryptionAvailable())throw Error('Windows-encrypted credential storage is unavailable.');
  if(!fs.existsSync(this.file))return {hostId:'urn:uuid:'+crypto.randomUUID(),profiles:[],selected:null};
  try{const state=JSON.parse(this.storage.decryptString(fs.readFileSync(this.file)));if(!state.hostId||!Array.isArray(state.profiles))throw Error();return state;}catch{throw Error('The encrypted ChatGPT connection could not be read. No credentials were overwritten.');}
 }
 save(state){if(!this.storage.isEncryptionAvailable())throw Error('Windows-encrypted credential storage is unavailable.');fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',this.storage.encryptString(JSON.stringify(state)),{mode:0o600});fs.renameSync(this.file+'.tmp',this.file);}
 status(){const s=this.load(),p=s.profiles.find(p=>p.id===s.selected);return {selected:s.selected,signingIn:!!this.signing,connected:!!p?.accessToken,sharing:!!p?.accessToken&&p.scopes?.includes('chatgpt.tokens.use.direct'),verified:!!p?.verified,profiles:s.profiles.map(p=>({id:p.id,label:p.email||p.name||'ChatGPT account',connected:!!p.accessToken}))};}
 select(id){if(this.signing||this.refreshing.size)throw Error('Wait for sign-in or refresh to finish.');const s=this.load();if(!s.profiles.some(p=>p.id===id))throw Error('Unknown ChatGPT profile.');s.selected=id;this.epoch++;this.save(s);return this.status();}
 signOut(){this.cancel();this.epoch++;const s=this.load(),p=s.profiles.find(p=>p.id===s.selected);if(p){for(const k of ['accessToken','refreshToken','idToken','pendingRefresh','verified'])delete p[k];}this.save(s);return this.status();}
 cancel(){this.signing?.abort();}
 async remote(url,options={}){
  try{return await this.fetch(url,{...options,redirect:'error',signal:AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(20000)])});}
  catch{throw Error('ChatGPT connection canceled, timed out, or unavailable. No credentials were displayed.');}
 }
 async identity(token,clientId,nonce,subject,now){
  const r=await this.remote(ISSUER+'/.well-known/jwks.json');if(!r.ok)throw Error('ChatGPT identity verification is temporarily unavailable. Try again.');
  let data;try{data=await r.json();}catch{throw Error('ChatGPT identity verification is temporarily unavailable.');}
  if(!Array.isArray(data.keys))throw Error('ChatGPT signing keys are unavailable.');
  return verifyIdentity(token,data.keys,clientId,nonce,subject,now);
 }
 async token(form,signal){
  const r=await this.remote(ISSUER+'/api/accounts/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...form,resource:RESOURCE}),signal});
  if(!r.ok)throw failure(r.status);let data;try{data=await r.json();}catch{throw Error('ChatGPT returned invalid credentials.');}
  if(typeof data.access_token!=='string'||!data.access_token||String(data.token_type).toLowerCase()!=='bearer'||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw Error('ChatGPT returned incomplete credentials.');return data;
 }
 async signIn(newProfile=false){
  if(this.signing||this.refreshing.size)throw Error('A ChatGPT sign-in or refresh is already running.');
  const s=this.load();this.save(s);const previous=newProfile?null:s.profiles.find(p=>p.id===s.selected);
  const state=random(),nonce=random(),verifier=random(),controller=new AbortController();this.signing=controller;const epoch=++this.epoch;
  const timer=setTimeout(()=>controller.abort(),180000);let server,port,close=()=>{},rejectCallback;
  try{
   const callback=new Promise((resolve,reject)=>{
    rejectCallback=reject;
    server=http.createServer((req,res)=>{
     res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
     let u;try{u=new URL(req.url,'http://127.0.0.1:'+port);}catch{res.writeHead(400).end();return;}
     if(req.method!=='GET'||req.headers.host!=='127.0.0.1:'+port||u.origin!=='http://127.0.0.1:'+port||u.pathname!=='/auth/callback'){res.writeHead(404).end();return;}
     const returned=Buffer.from(u.searchParams.get('state')||''),expected=Buffer.from(state);
     if(u.searchParams.getAll('state').length!==1||returned.length!==expected.length||!crypto.timingSafeEqual(returned,expected)){res.writeHead(400).end('Invalid sign-in state. Return to the original sign-in tab.');return;}
     res.setHeader('Content-Type','text/plain; charset=utf-8');res.end('Return to ZYZTools. Your connection will be verified there. You can close this tab.');
     if(u.searchParams.has('error')){reject(Error('ChatGPT sign-in was declined or unavailable.'));return;}
     const clientId=u.searchParams.get('client_id')||previous?.clientId,code=u.searchParams.get('code');
     if(!clientId||clientId==='dynamic_agent_client'||!/^[A-Za-z0-9_-]{1,200}$/.test(clientId)||previous&&clientId!==previous.clientId||!code||u.searchParams.getAll('code').length!==1||u.searchParams.getAll('client_id').length>1){reject(Error('ChatGPT registration was incomplete or did not match this account.'));return;}
     resolve({clientId,code});
    });
   });callback.catch(()=>{});
   server.requestTimeout=15000;server.headersTimeout=10000;
   close=()=>{server.close();server.closeAllConnections();};
   const abort=()=>{rejectCallback(Error('ChatGPT sign-in canceled or timed out.'));close();};controller.signal.addEventListener('abort',abort,{once:true});
   await new Promise((resolve,reject)=>{server.once('error',()=>reject(Error('Unable to open the local sign-in listener.')));server.listen(0,'127.0.0.1',resolve);});
   port=server.address().port;const redirect='http://127.0.0.1:'+port+'/auth/callback';
   const params=new URLSearchParams({client_id:previous?.clientId||'dynamic_agent_client',ext_agent_host_id:s.hostId,response_type:'code',redirect_uri:redirect,scope:SCOPES,resource:RESOURCE,state,nonce,code_challenge_method:'S256',code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url')});
   if(!previous)params.set('agent_name_hint',this.appName);
   await this.openBrowser(ISSUER+'/api/accounts/authorize?'+params);
   const result=await callback;close();controller.signal.throwIfAborted();
   // Retain the issued registration even if the one-time exchange fails.
   const id=previous?.id||crypto.randomUUID();let profile=previous;
   if(!profile){profile={id,clientId:result.clientId};s.profiles.push(profile);this.save(s);}
   const data=await this.token({grant_type:'authorization_code',client_id:result.clientId,code:result.code,code_verifier:verifier,redirect_uri:redirect},controller.signal);
   const identity=await this.identity(data.id_token,result.clientId,nonce,previous?.subject);
   if(typeof data.scope!=='string'||!data.refresh_token)throw Error('ChatGPT did not grant renewable plan credentials. Reconnect and approve plan usage.');
   if(controller.signal.aborted||epoch!==this.epoch)throw Error('ChatGPT sign-in canceled.');
   Object.assign(profile,identity,{accessToken:data.access_token,refreshToken:data.refresh_token,idToken:data.id_token,scopes:data.scope.split(/\s+/),expiresAt:Date.now()+data.expires_in*1000,verified:false});
   delete profile.pendingRefresh;s.selected=id;this.save(s);return this.status();
  }catch(error){if(!/^ChatGPT |^Unable to open/.test(error.message||''))throw Error('ChatGPT sign-in failed. No credentials were displayed.');throw error;}
  finally{clearTimeout(timer);close();this.signing=null;}
 }
 async credential(){
  const s=this.load(),p=s.profiles.find(p=>p.id===s.selected);if(!p?.accessToken||!p.scopes?.includes('chatgpt.tokens.use.direct'))throw Error('Continue with ChatGPT and approve ChatGPT plan usage first.');
  if(!p.pendingRefresh&&p.expiresAt>Date.now()+60000)return {id:p.id,token:p.accessToken,epoch:this.epoch};
  if(this.refreshing.has(p.id))return this.refreshing.get(p.id);
  const epoch=this.epoch;
  const task=(async()=>{
   let rotation=p.pendingRefresh;
   if(!rotation){
    if(!p.refreshToken)throw Error('ChatGPT connection expired. Continue with ChatGPT again.');
    const data=await this.token({grant_type:'refresh_token',client_id:p.clientId,refresh_token:p.refreshToken});
    rotation={accessToken:data.access_token,refreshToken:data.refresh_token||p.refreshToken,expiresAt:Date.now()+data.expires_in*1000,scopes:typeof data.scope==='string'?data.scope.split(/\s+/):p.scopes,idToken:data.id_token,receivedAt:Date.now()};
    if(epoch!==this.epoch)throw Error('ChatGPT account changed. Request discarded.');
    p.pendingRefresh=rotation;this.save(s);
   }
   if(rotation.idToken)await this.identity(rotation.idToken,p.clientId,undefined,p.subject,rotation.receivedAt);
   if(epoch!==this.epoch)throw Error('ChatGPT account changed. Request discarded.');
   Object.assign(p,rotation);delete p.receivedAt;delete p.pendingRefresh;this.save(s);
   if(!p.scopes.includes('chatgpt.tokens.use.direct'))throw Error('ChatGPT plan permission is no longer granted. Reconnect.');
   return {id:p.id,token:p.accessToken,epoch};
  })();this.refreshing.set(p.id,task);try{return await task;}finally{this.refreshing.delete(p.id);}
 }
 async models(){
  const c=await this.credential(),r=await this.remote(RESOURCE+'/models',{headers:{Authorization:'Bearer '+c.token}});if(!r.ok)throw failure(r.status);
  let data;try{data=await r.json();}catch{throw Error('ChatGPT model catalog was invalid.');}
  if(c.epoch!==this.epoch)throw Error('ChatGPT account changed. Refresh models again.');
  if(!Array.isArray(data.models))throw Error('ChatGPT did not return its account-specific model catalog.');
  return data.models.filter(m=>m.visibility==='list'&&/^[a-zA-Z0-9._:-]{1,80}$/.test(m.slug)).map(m=>({slug:m.slug,display_name:String(m.display_name||m.slug).slice(0,100)}));
 }
 async generate(body,signal){
  const c=await this.credential();
  // Allowlist the plan transport fields; never forward API-only options or a string input.
  const request={model:body.model,store:false,stream:true,instructions:body.instructions,input:[{role:'user',content:body.input}],text:body.text};
  let r;try{r=await this.fetch(RESOURCE+'/responses',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+c.token,'Content-Type':'application/json'},body:JSON.stringify(request),signal});}catch{throw Error('ChatGPT request canceled or unavailable. No paid API fallback was used.');}
  if(!r.ok)throw failure(r.status);
  let result;try{result=await readStream(r);}catch(error){if(/^ChatGPT /.test(error.message))throw error;throw Error('ChatGPT response stream failed. No maneuver was accepted.');}
  if(c.epoch!==this.epoch)throw Error('ChatGPT account changed; response discarded.');
  const s=this.load(),p=s.profiles.find(p=>p.id===c.id);if(p){p.verified=true;this.save(s);}return result;
 }
}
module.exports={ChatGPTPlan,verifyIdentity,readStream,failure};
