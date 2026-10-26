const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),{once,EventEmitter}=require('node:events');
const {ServerManager}=require('../src/manager.cjs'),{normalize,position}=require('../../electron-app/src/local-training');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('mixed native/ZYZ slots, persisted selector, prepared files, bounded launcher and native authority',{timeout:25000},async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-native-server-')),launched=[],manager=new ServerManager(folder,folder,{spawnNative:(file,args,options)=>{const child=new EventEmitter();launched.push({file,args,options,child});process.nextTick(()=>child.emit('spawn'));return child;}});let host;
 try{
  const raw=structuredClone(require('../../electron-app/src/training-demo.json'));raw.aircraft[1].spawnTime=60;manager.import(1,raw);manager.import(2,raw);manager.configure(2,{engineMode:'euroscope'});assert.equal(manager.status().slots[1].engineMode,'euroscope');assert.equal(new ServerManager(folder,folder).status().slots[1].engineMode,'euroscope');
  const setup=manager.nativeSetup(2);assert.equal(setup.hostAddress,'127.0.0.12');assert(fs.existsSync(setup.scenarioFile));assert(fs.readFileSync(setup.profileFile,'utf8').includes('LastSession\ttovatsim\t0'));
  await manager.start(1);await manager.start(2);assert.equal(manager.status().slots[1].state,'native-awaiting-host');assert.throws(()=>manager.configure(2,{engineMode:'zyztools'}),/Stop/);
  host=net.connect({host:'127.0.0.12',port:6809});await once(host,'connect');host.on('error',()=>{});host.write('#AAZYHOST2:SERVER:Dummy:0:dummy:5:9\r\n'+position(normalize(raw).aircraft[0])+'\r\n');await wait(150);
  const shot=await manager.call(2,'instructor',{operation:'snapshot'});assert.equal(shot.engineMode,'euroscope');assert.equal(shot.aircraft.length,1);assert.equal(shot.running,null);await assert.rejects(()=>manager.action(2,'run'),/SERVER-PC/);await assert.rejects(()=>manager.call(2,'instructor',{operation:'command',sessionId:shot.sessionId,callsign:shot.aircraft[0].callsign,command:'ALT 5000'}),/Native mode/);
  await manager.action(1,'run');assert.equal((await manager.call(1,'status')).running,true);
  const exe=path.join(folder,'EuroScope.exe');fs.writeFileSync(exe,'TEST FIXTURE — NEVER EXECUTED');manager.setEuroScope(exe);const launchedResult=await manager.launchNative(2);assert(launchedResult.opened);assert.deepEqual(launched[0].args,[setup.profileFile]);assert.equal(launched[0].options.shell,false);assert(!launched[0].args.some(a=>a.includes('connect')));await assert.rejects(()=>manager.launchNative(2),/already/);launched[0].child.emit('exit');
  await manager.stop(2);assert.equal((await manager.call(1,'status')).running,true);manager.configure(2,{engineMode:'zyztools'});assert.equal(manager.status().slots[1].engineMode,'zyztools');
 }finally{host?.destroy();await manager.shutdown();fs.rmSync(folder,{recursive:true,force:true});}
});
