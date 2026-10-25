const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),{once}=require('node:events');
const {ServerManager}=require('../src/manager.cjs'),{DirectoryLease,resolveCode,code,invite}=require('../../electron-app/src/training-directory');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=12000){const end=Date.now()+ms;while(Date.now()<end){if(fn())return;await delay(100);}assert.fail('Timed out waiting for server state.');}
test('directory validates code, managed URL, registration, heartbeat, expiry and revocation',async()=>{
 assert.equal(code('abcde-fg234'),'ABCDE-FG234');assert.throws(()=>code('http://evil.test'));assert.throws(()=>invite({url:'https://evil.test',token:'a'.repeat(64)}));assert.throws(()=>invite({url:'https://valid.trycloudflare.com/path',token:'a'.repeat(64)}));
 const calls=[],owner='b'.repeat(64),access='a'.repeat(64);let expire=false;
 const call=async(route,method,value,token)=>{calls.push({route,method,token});if(method==='POST')return {code:'ABCDE-FG234',ownerToken:owner,expiresAt:new Date(Date.now()+120000).toISOString()};if(method==='PUT'){if(expire){const e=Error('expired');e.status=404;throw e;}return {expiresAt:new Date(Date.now()+120000).toISOString()};}return {url:'https://synthetic.trycloudflare.com',token:access};};
 const lease=new DirectoryLease(call);await lease.sync('https://synthetic.trycloudflare.com',access);assert.equal(lease.status().code,'ABCDE-FG234');assert(!JSON.stringify(lease.status()).includes(owner));await lease.sync('https://synthetic.trycloudflare.com',access);assert.equal(calls[1].method,'PUT');assert.equal(calls[1].token,owner);
 expire=true;await assert.rejects(()=>lease.sync('https://synthetic.trycloudflare.com',access));assert.equal(lease.status().code,'');expire=false;await lease.sync('https://synthetic.trycloudflare.com',access);await lease.stop();assert.equal(calls.at(-1).method,'DELETE');assert.equal(lease.status().code,'');assert.equal((await resolveCode('ABCDE-FG234',call)).token,access);
});
test('three real child simulators: independent clocks, sockets, delay, pause, crash recovery, shutdown and persistence',{timeout:45000},async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-servers-test-')),manager=new ServerManager(folder,folder),sockets=[];
 try{
  assert.deepEqual(manager.status().slots.map(s=>s.autostart),[false,false,false]);assert.throws(()=>manager.slot(4));
  for(let id=1;id<=3;id++){const raw=structuredClone(require('../../electron-app/src/training-demo.json'));raw.name='Scenario '+id;raw.aircraft[1].spawnTime=60;manager.import(id,raw);}
  manager.configure(2,{name:'East flow',autostart:true});await Promise.all([1,2,3].map(id=>manager.start(id)));assert.equal(manager.status().slots[1].name,'East flow');assert.equal(manager.status().slots[1].scenarioName,'Scenario 2');assert.throws(()=>manager.import(1,{}),/Stop/);
  const received=[];for(let id=1;id<=3;id++){const socket=net.connect({host:'127.0.0.1',port:16800+id});sockets.push(socket);received[id]='';socket.on('error',()=>{});socket.on('data',b=>received[id]+=b);await once(socket,'connect');socket.write('#AATOR_APP:SERVER:Dummy:0000000:dummy:1:100\r\n');}
  await until(()=>[1,2,3].every(id=>received[id].includes('$FPTEST101')));assert([1,2,3].every(id=>!received[id].includes('$FPTEST202')));
  await manager.action(1,'run');await manager.action(3,'run');await delay(1400);const a=await manager.call(1,'status'),b=await manager.call(2,'status');assert(a.elapsed>1);assert.equal(b.elapsed,0);
  await manager.action(1,'pause');const before=(await manager.call(1,'status')).elapsed;await delay(400);assert.equal((await manager.call(1,'status')).elapsed,before);
  const oldChild=manager.slot(1).child;oldChild.kill();await until(()=>manager.slot(1).child&&manager.slot(1).child!==oldChild&&manager.slot(1).state==='paused');assert.equal((await manager.call(1,'status')).elapsed,0);assert((await manager.call(3,'status')).elapsed>2);assert(manager.slot(1).log.some(e=>e.message.includes('Recovered')));
  await manager.stop(2);assert.equal(manager.status().slots[1].state,'stopped');assert.equal((await manager.call(3,'status')).running,true);
  const saved=new ServerManager(folder,folder);assert.equal(saved.status().slots[1].name,'East flow');assert.equal(saved.status().slots[1].autostart,true);assert.equal(saved.status().slots[2].hasScenario,true);
  await manager.shutdown();assert(manager.slots.every(s=>!s.child&&!s.retry));assert(manager.slots.every(s=>!s.desired));
  for(let id=1;id<=3;id++){const socket=net.connect({host:'127.0.0.1',port:16800+id});await assert.rejects(once(socket,'connect'));socket.destroy();}
 }finally{for(const socket of sockets)socket.destroy();await manager.shutdown();fs.rmSync(folder,{recursive:true,force:true});}
});
