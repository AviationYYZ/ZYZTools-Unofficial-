const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {ServerManager}=require('../src/manager.cjs');
test('server slot speed profiles persist independently of scenario files and may be configured before import',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-server-speed-'));let manager;try{
  manager=new ServerManager(folder,folder);const profile=[{ceiling:10000,ias:190},{ceiling:60000,ias:240}];
  await manager.speedProfile(1,profile);assert.deepEqual(manager.status().slots[0].jetSpeedProfile,profile);
  await manager.speedProfile(1,[{ceiling:60000,ias:120}],'prop');
  const raw=structuredClone(require('../../electron-app/src/training-demo.json'));raw.jetSpeedProfile=[{ceiling:60000,ias:399}];manager.import(1,raw);
  assert.equal(JSON.parse(fs.readFileSync(path.join(manager.dir(1),'scenario.json'),'utf8')).jetSpeedProfile,undefined);assert.deepEqual(manager.status().slots[0].jetSpeedProfile,profile);
  const reopened=new ServerManager(folder,folder);assert.deepEqual(reopened.status().slots[0].jetSpeedProfile,profile);assert.notDeepEqual(reopened.status().slots[1].jetSpeedProfile,profile);
  assert.deepEqual(reopened.status().slots[0].aircraftSpeedProfiles.prop,[{ceiling:60000,ias:120}]);
  assert.deepEqual(reopened.status().slots[1].aircraftSpeedProfiles,{});
  await reopened.speedProfile(1,null,'prop');assert.deepEqual(reopened.status().slots[0].aircraftSpeedProfiles,{});
  raw.name='Another scenario';raw.jetSpeedProfile='invalid legacy file table is not authoritative';reopened.import(1,raw);assert.deepEqual(reopened.status().slots[0].jetSpeedProfile,profile);
  await assert.rejects(()=>reopened.speedProfile(1,[]));assert.deepEqual(reopened.status().slots[0].jetSpeedProfile,profile);
 }finally{await manager?.shutdown();fs.rmSync(folder,{recursive:true,force:true});}
});
test('wake overrides propulsion, high-performance prop wins over prop, and manual speed survives edits',()=>{
 const {LocalTraining}=require('../../electron-app/src/local-training');
 const demo=require('../../electron-app/src/training-demo.json');
 const sim=new LocalTraining();
 sim.load({...demo,aircraft:[['TEST101','B77W','jet','H'],['TEST102','DH8D','prop','M'],['TEST103','C172','prop','L']].map(([callsign,type,category,wake])=>({...demo.aircraft[0],callsign,type,category,wake}))});
 const rows=ias=>[{ceiling:60000,ias}];
 sim.speedProfile(rows(240),'heavy');sim.speedProfile(rows(110),'prop');sim.speedProfile(rows(180),'highProp');
 assert.deepEqual(sim.aircraft.map(a=>a.targetIAS),[240,180,110]);
 sim.command('TEST101','IAS 205');sim.speedProfile(rows(230),'heavy');
 assert.equal(sim.aircraft[0].targetIAS,205);
 sim.command('TEST101','SPEED PUBLISHED');assert.equal(sim.aircraft[0].targetIAS,230);
 sim.speedProfile(null,'highProp');assert.equal(sim.aircraft[1].targetIAS,110);
});
