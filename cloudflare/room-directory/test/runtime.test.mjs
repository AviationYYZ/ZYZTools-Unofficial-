// Real local workerd + SQLite Durable Objects. No account or cloud resources used.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { digest } from '../src/core.ts';
const tooling=process.env.ZYZ_WORKER_TOOLS||path.join(process.env.LOCALAPPDATA||tmpdir(),'ZYZTools/WorkerDev/room-directory');
const require=createRequire(path.join(tooling,'package.json'));
const {Miniflare,convertV4MiniflareOptions,Log,LogLevel}=require('miniflare');
const state=await mkdtemp(path.join(tooling,'integration-'));
const adminKey='b'.repeat(64);
const options=convertV4MiniflareOptions({name:'directory',rootPath:tooling,modules:true,scriptPath:path.join(tooling,'dry-run/index.js'),compatibilityDate:'2026-10-25',compatibilityFlags:['nodejs_compat'],bindings:{ZYZTOOLS_ADMIN_KEY:adminKey},durableObjects:{ROOMS:{className:'Room',useSQLite:true},LIMITERS:{className:'ClientLimiter',useSQLite:true},APP_POLICY:{className:'AppPolicy',useSQLite:true}},unsafeInspectDurableObjects:true,resourcePersistencePath:state,resourceTmpPath:state,log:new Log(LogLevel.ERROR),logRequests:false,telemetry:{enabled:false}});
// Synthetic IPs are injected only by this local test harness, never by clients in production.
options.workers[0].dev.stripCfConnectingIp=false;
const mf=new Miniflare(options);
let requests=0;
const call=(method,route,value,owner='',ip='192.0.2.1')=>{requests++;return mf.dispatchFetch('https://directory.test'+route,{method,headers:{'CF-Connecting-IP':ip,...(value!==undefined?{'Content-Type':'application/json'}:{}),...(owner?{Authorization:'Bearer '+owner}:{})},body:value===undefined?undefined:JSON.stringify(value)});};
try{
 const wsResult=await mf.dispatchFetch('https://directory.test/v2/events',{headers:{Upgrade:'websocket','CF-Connecting-IP':'192.0.2.40'}});
 assert.equal(wsResult.status,101);
 const ws=wsResult.webSocket,seen=[];ws.addEventListener('message',event=>seen.push(JSON.parse(event.data)));ws.accept();
 const admin=(value,ip='192.0.2.41')=>call('POST','/v2/admin',value,adminKey,ip);
 assert.equal((await call('POST','/v2/admin',{action:'status'},'0'.repeat(64),'192.0.2.42')).status,403);
 let p=await admin({action:'announcement',message:'Training update',hours:1});assert.equal(p.status,200);
 for(let i=0;i<50&&!seen.some(v=>v.announcement?.message==='Training update');i++)await new Promise(r=>setTimeout(r,20));
 assert(seen.some(v=>v.announcement?.message==='Training update'));
 p=await admin({action:'policy',feature:'scenarioBuilder',mode:'code'});assert.equal(p.status,200);
 p=await admin({action:'create',label:'Test access',hours:1,features:['scenarioBuilder']});assert.equal(p.status,200);
 const policy=await p.json(),code=policy.issued;assert.match(code,/^[A-F0-9]{24}$/);assert(!JSON.stringify(policy.codes).includes('hash'));
 p=await call('POST','/v2/redeem',{code},'','192.0.2.43');assert.equal(p.status,200);const grant=await p.json();assert.deepEqual(grant.features,['scenarioBuilder']);
 p=await admin({action:'edit',id:policy.codes[0].id,label:'Edited',hours:1,features:['scenarioBuilder']});assert.equal(p.status,200);assert((await p.json()).revision>grant.revision);
 assert.equal((await admin({action:'delete',id:policy.codes[0].id})).status,200);
 assert.equal((await call('POST','/v2/redeem',{code},'','192.0.2.43')).status,403);
 p=await call('GET','/v2/policy');assert.equal(p.status,200);const publicPolicy=await p.json();assert.equal(publicPolicy.rules.scenarioBuilder,'code');assert(!Object.hasOwn(publicPolicy,'codes'));
 p=await admin({action:'createAdmin',label:'Test instructor'});assert.equal(p.status,200);const delegated=await p.json();
 assert.match(delegated.adminCredential,/^[a-f0-9]{64}$/);assert(!Object.hasOwn(delegated.admins[0],'hash'));
 const delegate=(action)=>call('POST','/v2/admin',{action},delegated.adminCredential,'192.0.2.44');
 p=await delegate('status');assert.equal(p.status,200);assert.equal((await p.json()).owner,false);
 assert.equal((await delegate('createAdmin')).status,403);
 assert.equal((await admin({action:'revokeAdmin',id:delegated.admins[0].id})).status,200);
 assert.equal((await delegate('status')).status,403);
 ws.close();
 let r=await call('GET','/health');assert.equal(r.status,200);assert.equal((await r.json()).service,'ZYZTools Room Directory');assert.equal(r.headers.get('cache-control'),'no-store');assert(!r.headers.has('Access-Control-Allow-Origin'));
 const value={url:'https://synthetic-room.trycloudflare.com',token:'a'.repeat(64)};
 r=await call('POST','/v1/rooms',value);assert.equal(r.status,200);const made=await r.json();assert.match(made.code,/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);assert.match(made.ownerToken,/^[a-f0-9]{64}$/);
 r=await call('GET','/v1/rooms/'+made.code);const found=await r.json();assert.equal(r.status,200);assert.equal(found.token,value.token);assert(!Object.hasOwn(found,'ownerToken'));
 r=await call('PUT','/v1/rooms/'+made.code,{},'0'.repeat(64));assert.equal(r.status,403);
 r=await call('PUT','/v1/rooms/'+made.code,{},made.ownerToken);assert.equal(r.status,200);
 const storage=await mf.unsafeGetDurableObjectStorage('directory','Room',{name:made.code.replace('-','')});await storage.exec('UPDATE room SET expires=? WHERE id=1',Date.now()-1);
 r=await call('GET','/v1/rooms/'+made.code);assert.equal(r.status,404);r=await call('PUT','/v1/rooms/'+made.code,{},made.ownerToken);assert.equal(r.status,404,'Expired hosts cannot revive a room');
 r=await call('POST','/v1/rooms',value,'','192.0.2.2');const second=await r.json();assert.equal(r.status,200);
 r=await call('DELETE','/v1/rooms/'+second.code,undefined,'0'.repeat(64));assert.equal(r.status,403);
 r=await call('DELETE','/v1/rooms/'+second.code,undefined,second.ownerToken);assert.equal(r.status,200);
 r=await call('GET','/v1/rooms/'+second.code);assert.equal(r.status,404);
 for(let i=0;i<6;i++){r=await call('POST','/v1/rooms',value,'','192.0.2.3');assert.equal(r.status,i<5?200:429);}
 for(let i=0;i<31;i++){r=await call('GET','/v1/rooms/AAAAA-AAAAA',undefined,'','192.0.2.4');assert.equal(r.status,i<30?404:429);}assert.equal(r.headers.get('retry-after'),'60');
 r=await call('POST','/v1/rooms',{...value,url:'https://127.0.0.1'},'','192.0.2.5');assert.equal(r.status,400);
 r=await call('POST','/v1/rooms',{...value,token:'x'.repeat(5000)},'','192.0.2.5');assert.equal(r.status,413);
 r=await call('GET','/v1/rooms/AAAAA-AAAAA?secret=x');assert.equal(r.status,400);
 // Idle cleanup can remove a table while the object is still live: next request recreates it.
 const limiter=await mf.unsafeGetDurableObjectStorage('directory','ClientLimiter',{name:await digest('zyz-directory-client-v1:192.0.2.5')});await limiter.exec('DROP TABLE limits');
 r=await call('POST','/v1/rooms',value,'','192.0.2.5');assert.equal(r.status,200);
 console.log('PASS local workerd/SQLite:',requests,'requests; room ownership, renewal, revocation, forced expiry, no revival, create/lookup limits, idle schema recovery, strict payloads and credential-free health. No deployment.');
}finally{await mf.dispose();}
