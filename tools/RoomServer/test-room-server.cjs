// No service installation, firewall changes, helper launch or public exposure.
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),path=require('node:path'),net=require('node:net');
const exe=path.resolve(__dirname,'../../installer/dist/room-server/ZYZTools-Room-Server-Setup-0.1.0.exe');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function run(){
 await new Promise((resolve,reject)=>{const p=spawn(exe,['--self-test'],{windowsHide:true});p.on('error',reject);p.on('close',code=>code===0?resolve():reject(Error('Self-test exit '+code)));});
 const child=spawn(exe,['--test-server','7163'],{windowsHide:true});let startError;child.on('error',e=>startError=e);const base='http://127.0.0.1:7163';
 try{
  let healthy=false;for(let i=0;i<40;i++){try{const r=await fetch(base+'/health');if(r.status===200){assert.equal((await r.json()).service,'ZYZTools Room Directory');healthy=true;break;}}catch{}if(startError)throw startError;await wait(100);}assert(healthy,'Test server failed to start');
  const request=(method,route,body,owner='',ip='192.0.2.1')=>fetch(base+route,{method,headers:{'Content-Type':'application/json','CF-Connecting-IP':ip,...(owner?{Authorization:'Bearer '+owner}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const invite={url:'https://synthetic-training.trycloudflare.com',token:'a'.repeat(64)};
  let r=await request('POST','/v1/rooms',invite);assert.equal(r.status,200);const created=await r.json();assert.match(created.code,/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);assert.match(created.ownerToken,/^[a-f0-9]{64}$/);assert.equal(created.heartbeatSeconds,45);
  r=await request('GET','/v1/rooms/'+created.code);assert.equal(r.status,200);const found=await r.json();assert.equal(found.url,invite.url);assert.equal(found.token,invite.token);assert(!Object.hasOwn(found,'ownerToken'));assert.equal(r.headers.get('cache-control'),'no-store');
  r=await request('PUT','/v1/rooms/'+created.code,{},'wrong');assert.equal(r.status,403);r=await request('PUT','/v1/rooms/'+created.code,{},created.ownerToken);assert.equal(r.status,200);
  for(const url of ['http://synthetic.trycloudflare.com','https://127.0.0.1','https://evil.test','https://synthetic.trycloudflare.com/path']){r=await request('POST','/v1/rooms',{...invite,url},'', '192.0.2.2');assert.equal(r.status,400);}
  r=await request('POST','/v1/rooms',invite,'','192.0.2.2');assert.equal(r.status,200);r=await request('POST','/v1/rooms',invite,'','192.0.2.2');assert.equal(r.status,429);
  r=await request('DELETE','/v1/rooms/'+created.code,undefined,'wrong');assert.equal(r.status,403);r=await request('DELETE','/v1/rooms/'+created.code,undefined,created.ownerToken);assert.equal(r.status,200);r=await request('GET','/v1/rooms/'+created.code);assert.equal(r.status,404);
  r=await request('POST','/v1/rooms',{...invite,token:'bad'},'','192.0.2.3');assert.equal(r.status,400);r=await request('POST','/v1/rooms',{...invite,url:invite.url+'/#zyz='+invite.token},'','192.0.2.3');assert.equal(r.status,400);
  for(let i=0;i<31;i++){r=await request('GET','/v1/rooms/AAAAA-AAAAA',undefined,'','192.0.2.4');assert.equal(r.status,i<30?404:429);}
  const raw=await new Promise((resolve,reject)=>{const c=net.connect(7163,'127.0.0.1');let reply='';c.on('connect',()=>c.write('POST /v1/rooms HTTP/1.1\r\nHost: local\r\nContent-Length: 0\r\nContent-Length: 4\r\nContent-Type: application/json\r\n\r\n'));c.on('data',b=>reply+=b);c.on('end',()=>resolve(reply));c.on('error',reject);});assert(raw.startsWith('HTTP/1.1 400'));
  console.log('PASS standalone EXE: expiry/heartbeat/DPAPI self-test; real loopback HTTP create/lookup/renew/revoke; owner gates; 10-char codes; no owner-token disclosure; strict URLs/keys; create and lookup throttles; duplicate header rejection. No Windows service was installed.');
 }finally{child.kill();await new Promise(r=>{if(child.exitCode!==null)r();else child.once('close',r);});}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
