const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {ServerManager}=require('../src/manager.cjs');
test('per-slot rate persists and updates a running worker without resetting session',{timeout:15000},async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-rate-')),manager=new ServerManager(folder,folder);
 try{
  assert.deepEqual(manager.status().slots.map(s=>s.positionUpdateHz),[2,2,2]);await manager.updateRate(1,5);assert.equal(new ServerManager(folder,folder).status().slots[0].positionUpdateHz,5);
  manager.import(1,require('../../electron-app/src/training-demo.json'));await manager.start(1);await manager.action(1,'run');
  const before=await manager.call(1,'instructor',{operation:'snapshot'});await manager.updateRate(1,1);const after=await manager.call(1,'instructor',{operation:'snapshot'});
  assert.equal(after.positionUpdateHz,1);assert.equal(after.sessionId,before.sessionId);assert(after.elapsed>=before.elapsed);assert.equal(after.running,true);assert.equal(manager.status().slots[1].positionUpdateHz,2);
  await assert.rejects(()=>manager.updateRate(1,100),/update rate/);assert.equal(manager.status().slots[0].positionUpdateHz,1);await manager.action(1,'reset');assert.equal(manager.status().slots[0].positionUpdateHz,1);
  await manager.stop(1);await manager.start(1);assert.equal(manager.status().slots[0].positionUpdateHz,1);
 }finally{await manager.shutdown();fs.rmSync(folder,{recursive:true,force:true});}
});
