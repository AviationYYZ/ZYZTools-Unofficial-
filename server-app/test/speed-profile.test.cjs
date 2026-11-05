const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {ServerManager}=require('../src/manager.cjs');
test('server slot speed profiles persist independently of scenario files and may be configured before import',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-server-speed-'));let manager;try{
  manager=new ServerManager(folder,folder);const profile=[{ceiling:10000,ias:190},{ceiling:60000,ias:240}];
  await manager.speedProfile(1,profile);assert.deepEqual(manager.status().slots[0].jetSpeedProfile,profile);
  const raw=structuredClone(require('../../electron-app/src/training-demo.json'));raw.jetSpeedProfile=[{ceiling:60000,ias:399}];manager.import(1,raw);
  assert.equal(JSON.parse(fs.readFileSync(path.join(manager.dir(1),'scenario.json'),'utf8')).jetSpeedProfile,undefined);assert.deepEqual(manager.status().slots[0].jetSpeedProfile,profile);
  const reopened=new ServerManager(folder,folder);assert.deepEqual(reopened.status().slots[0].jetSpeedProfile,profile);assert.notDeepEqual(reopened.status().slots[1].jetSpeedProfile,profile);
  raw.name='Another scenario';raw.jetSpeedProfile='invalid legacy file table is not authoritative';reopened.import(1,raw);assert.deepEqual(reopened.status().slots[0].jetSpeedProfile,profile);
  await assert.rejects(()=>reopened.speedProfile(1,[]));assert.deepEqual(reopened.status().slots[0].jetSpeedProfile,profile);
 }finally{await manager?.shutdown();fs.rmSync(folder,{recursive:true,force:true});}
});
