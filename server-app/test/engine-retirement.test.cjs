const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {ServerManager}=require('../src/manager.cjs');
test('retired native slots migrate to ZYZTools without deleting scenarios or launching EuroScope',{timeout:15000},async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-retirement-'));
 fs.writeFileSync(path.join(folder,'servers.json'),JSON.stringify({startup:false,instructorEnabled:true,euroScopePath:'C:\\not-used\\EuroScope.exe',slots:[{name:'Keep name',engineMode:'euroscope',autostart:false}]}));
 const manager=new ServerManager(folder,folder);
 try{
  const status=manager.status();assert.equal(status.nativeControlsSupported,undefined);assert(status.slots.every(s=>s.engineMode==='zyztools'));assert.equal(status.slots[0].name,'Keep name');assert.equal(manager.config.instructorEnabled,true);assert.equal(manager.config.euroScopePath,undefined);
  assert.equal(manager.launchNative,undefined);assert.equal(manager.nativeSetup,undefined);assert.equal(manager.setEuroScope,undefined);assert.throws(()=>manager.configure(1,{engineMode:'euroscope'}),/removed/);
  const scenario=require('../../electron-app/src/training-demo.json');manager.import(1,scenario);const saved=fs.readFileSync(path.join(folder,'server-1/scenario.json'),'utf8');
  await manager.start(1);assert.equal(manager.status().slots[0].state,'paused');assert.equal(manager.status().slots[0].engineMode,'zyztools');assert.equal(fs.readFileSync(path.join(folder,'server-1/scenario.json'),'utf8'),saved);assert(!fs.existsSync(path.join(folder,'server-1/native')));
  await manager.action(1,'run');assert.equal(manager.status().slots[0].state,'running');await manager.action(1,'pause');await manager.action(1,'reset');assert.equal(manager.status().slots[0].state,'paused');
  manager.save();assert(JSON.parse(fs.readFileSync(path.join(folder,'servers.json'))).slots.every(s=>s.engineMode==='zyztools'));
 }finally{await manager.shutdown();fs.rmSync(folder,{recursive:true,force:true});}
});
