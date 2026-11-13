const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {ServerManager}=require('../src/manager.cjs'),{InstructorHub}=require('../src/instructor.cjs'),{InstructorClient}=require('../../electron-app/src/training-instructor');
const {LocalTraining}=require('../../electron-app/src/local-training'),{TrainingMultiplayer}=require('../../electron-app/src/training-multiplayer');
const demo=()=>structuredClone(require('../../electron-app/src/training-demo.json'));
test('instructor controls all slots remotely; student keys denied; uploads validated; stale and duplicate requests gated',{timeout:40000},async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-instructor-')),manager=new ServerManager(folder,folder);
 const tunnel={status:()=>({state:'stopped',running:true}),stop(){}};const hub=new InstructorHub(manager,folder,{port:0,tunnel});
 const studentTraining=new LocalTraining(),student=new TrainingMultiplayer(studentTraining,0,{readOnly:true});
 let base;
 async function req(route,body,token=hub.token){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 async function act(slot,action,payload,epoch=manager.slot(slot).epoch,requestId=crypto.randomUUID()){return req('/api/instructor/action',{requestId,slot,action,epoch,payload});}
 try{
  await hub.start();base='http://127.0.0.1:'+hub.port;assert.equal((await req('/api/instructor/status',undefined,'bad')).status,401);assert.equal((await req('/api/instructor/status')).data.role,'instructor');
  for(const id of [1,2,3,4,5,6]){const raw=demo();raw.name='Uploaded '+id;raw.aircraft[1].spawnTime=60;assert.equal((await act(id,'import',{scenario:raw})).status,200);assert.equal((await act(id,'start')).status,200);}
  const snapshots=[];for(const id of [1,2,3,4,5,6])snapshots[id]=(await req('/api/instructor/aircraft/'+id)).data;
  assert.equal(snapshots[6].name,'Uploaded 6');
  assert(snapshots[1].aircraft.length===2);assert.notEqual(snapshots[1].sessionId,snapshots[2].sessionId);
  assert.equal(snapshots[1].role,'student-pilot');assert.equal(snapshots[1].readOnly,false);assert.equal(snapshots[1].allowPausedCommands,true);assert.equal(snapshots[1].capabilities.sessionAdministration,false);
  assert.equal((await act(1,'initialOwner',{sessionId:snapshots[1].sessionId,callsign:'TEACHER_CTR'})).status,400,'Old scenarios do not silently auto-assume');
  await act(3,'stop');const owned=demo();owned.initialOwnership='instructor';await act(3,'import',{scenario:owned});await act(3,'start');const ownerShot=(await req('/api/instructor/aircraft/3')).data;assert.equal((await act(3,'initialOwner',{sessionId:ownerShot.sessionId,callsign:'TEACHER_CTR'})).status,400);const ownerSocket=require('node:net').createConnection({host:'127.0.0.1',port:16803});try{await require('node:events').once(ownerSocket,'connect');const greeting=require('node:events').once(ownerSocket,'data');ownerSocket.write('#AATEACHER_CTR:SERVER:0:dummy\r\n');await greeting;assert.equal((await act(3,'initialOwner',{sessionId:ownerShot.sessionId,callsign:'TEACHER_CTR'})).status,200);assert((await req('/api/instructor/aircraft/3')).data.aircraft.filter(a=>a.active).every(a=>a.trackingController==='TEACHER_CTR'));}finally{ownerSocket.destroy();}
  const profile=[{ceiling:10000,ias:185},{ceiling:60000,ias:240}];assert.equal((await act(2,'speedProfile',{profile})).status,200);assert.deepEqual((await req('/api/instructor/aircraft/2')).data.jetSpeedProfile,profile);assert.deepEqual((await req('/api/instructor/aircraft/1')).data.jetSpeedProfile,require('../../electron-app/src/training-jet-profile').defaults);assert.deepEqual(JSON.parse(fs.readFileSync(manager.file,'utf8')).slots[1].jetSpeedProfile,profile);assert.equal((await act(2,'speedProfile',{profile:[]})).status,400);
  assert.equal((await act(2,'updateRate',{hz:5})).status,200);assert.equal((await req('/api/instructor/aircraft/2')).data.positionUpdateHz,0.2);assert.equal((await req('/api/instructor/aircraft/1')).data.positionUpdateHz,0.2);assert.equal((await act(2,'updateRate',{hz:100})).status,400);assert.equal((await act(2,'updateRate',{hz:2,path:'bad'})).status,400);
  const payload={sessionId:snapshots[2].sessionId,callsign:'TEST101',command:'ALT 7000'};assert.equal((await act(2,'command',payload)).status,200);assert.equal((await req('/api/instructor/aircraft/2')).data.aircraft[0].targetAltitude,7000);assert.equal((await req('/api/instructor/aircraft/2')).data.aircraft[0].targetIAS,185,'Paused remote aircraft immediately selects the assigned-altitude custom band');assert.equal((await req('/api/instructor/aircraft/1')).data.aircraft[0].targetAltitude,11000);
  assert.equal((await act(2,'command',{...payload,command:'LHDG 330, ALT 3000, IAS 210'})).status,200);let multi=(await req('/api/instructor/aircraft/2')).data.aircraft[0];assert.equal(multi.targetAltitude,3000);assert.equal(multi.targetIAS,210);assert.equal(multi.turnDirection,-1);
  assert.equal((await act(2,'command',{...payload,command:'ALT 4000, DCT MISSING'})).status,400);assert.equal((await req('/api/instructor/aircraft/2')).data.aircraft[0].targetAltitude,3000);
  const rid=crypto.randomUUID(),epoch=manager.slot(2).epoch;const original=await act(2,'command',payload,epoch,rid);assert.equal((await act(2,'command',payload,epoch,rid)).data.sessionId,original.data.sessionId);assert.equal((await act(2,'command',{...payload,command:'ALT 9000'},epoch,rid)).status,400);
  const journal=(await req('/api/instructor/aircraft/2')).data.instructorJournal;
  assert.deepEqual(journal.map(e=>e.action),['ALT 7000','LHDG 330, ALT 3000, IAS 210','ALT 7000']);
  assert(journal.every(e=>e.callsign==='TEST101'&&Number.isFinite(e.time)));
  assert.deepEqual((await req('/api/instructor/aircraft/1')).data.instructorJournal,[]);
  assert.equal((await act(2,'command',{...payload,command:'DELETE AIRCRAFT'})).status,200);assert.equal((await req('/api/instructor/aircraft/2')).data.aircraft.length,1);assert.equal((await req('/api/instructor/aircraft/1')).data.aircraft.length,2);
  await act(2,'reset');assert.equal((await act(2,'command',payload)).status,400);assert.equal((await act(2,'run',{},epoch)).status,400);
  assert.deepEqual((await req('/api/instructor/aircraft/2')).data.instructorJournal,[]);
  const before=manager.slot(1).child;assert.equal((await act(1,'import',{scenario:{}})).status,400);assert.equal(manager.slot(1).child,before);
  const west=structuredClone(require('../../scenarios/CYYZ-West-70-AAR-Instructor-Owned.json'));
  const plane=west.aircraft.find(a=>a.procedures.includes('LINNG3'));
  west.aircraft=[{...plane,spawnTime:0}];
  await act(4,'stop');assert.equal((await act(4,'import',{scenario:west})).status,200);
  await act(4,'start');await act(4,'run');
  const routeShot=(await req('/api/instructor/aircraft/4')).data;
  assert(routeShot.runways.some(r=>r.name==='24L'));
  const amendTarget={callsign:plane.callsign,sessionId:routeShot.sessionId};
  await act(4,'command',{...amendTarget,command:'HDG 240'});
  const changed=await act(4,'amend',{...amendTarget,fields:{arrivalRunway:'24L',flightPlanRoute:'LINNG LINNG3 CYYZ/24R'}});
  assert.equal(changed.status,200,JSON.stringify(changed.data));
  const changedPlane=changed.data.aircraft[0];
  assert.equal(changedPlane.flightPlanRoute,'LINNG LINNG3 CYYZ/24L');
  assert.equal(changedPlane.navigation,'heading');assert(changedPlane.route.includes('KIREX'));
  assert.equal((await act(4,'amend',{...amendTarget,fields:{flightPlanRoute:'UNKNOWNFIX',arrivalRunway:'24L'}})).status,400);
  assert.equal((await req('/api/instructor/aircraft/4')).data.aircraft[0].flightPlanRoute,'LINNG LINNG3 CYYZ/24L');
  const reroute=await act(4,'amend',{...amendTarget,fields:{arrivalRunway:'24L',flightPlanRoute:'VERKO MAROD CYYZ/24L'}});
  assert.equal(reroute.status,200);assert.equal(reroute.data.aircraft[0].route,'VERKO MAROD');
  const liveBefore=(await req('/api/instructor/aircraft/2')).data;await act(2,'run');await act(2,'command',{sessionId:liveBefore.sessionId,callsign:'TEST101',command:'IAS 180'});const liveProfile=[{ceiling:60000,ias:205}];await act(2,'speedProfile',{profile:liveProfile});const liveAfter=(await req('/api/instructor/aircraft/2')).data;assert.equal(liveAfter.sessionId,liveBefore.sessionId);assert.equal(liveAfter.running,true);assert.equal(liveAfter.aircraft.find(a=>a.callsign==='TEST101').targetIAS,180);assert.equal(liveAfter.aircraft.find(a=>a.callsign==='TEST202').targetIAS,205);await act(2,'pause');
  const replacement=demo();replacement.name='Replacement from client';assert.equal((await act(1,'import',{scenario:replacement})).status,200);assert.equal(manager.status().slots[0].state,'stopped');assert.equal(manager.status().slots[0].scenarioName,replacement.name);assert(manager.slot(3).child);
  assert.equal((await act(3,'configure',{path:'C:/'})).status,400);assert.equal((await act(4,'stop',{},'invalid')).status,400);assert.equal((await req('/api/fsd/open',{})).status,404);
  studentTraining.load(demo());await studentTraining.start(17831);await student.start();assert.equal((await req('/api/instructor/status',undefined,student.token)).status,401);
  const sbase=student.status().url;assert.equal((await fetch(sbase+'/api/status',{headers:{Authorization:'Bearer '+hub.token}})).status,401);
  const res=await fetch(sbase+'/api/action',{method:'POST',headers:{Authorization:'Bearer '+student.token,'Content-Type':'application/json'},body:JSON.stringify({action:'command'})});assert.equal(res.status,403);
  assert.equal((await (await fetch(sbase+'/api/status',{headers:{Authorization:'Bearer '+student.token}})).json()).readOnly,true);
  const old=hub.token;await hub.stop();assert(!hub.token);assert.notEqual(old,hub.token);
 }finally{await hub.stop();student.stop();studentTraining.stop();await manager.shutdown();fs.rmSync(folder,{recursive:true,force:true});}
});
test('installable instructor shell is public but pairing and API data stay guarded',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-pwa-'));
 const manager={folder,status:()=>({slots:[]})};
 const tunnel={status:()=>({state:'ready',url:'https://synthetic.trycloudflare.com',running:true}),stop(){}};
 const lease={status:()=>({code:'ABCDE-FG234'}),stop:async()=>{}};
 const hub=new InstructorHub(manager,folder,{port:0,tunnel,lease});
 hub.network=async()=>{};
 try{
  await hub.start();const base='http://127.0.0.1:'+hub.port;
  const get=route=>fetch(base+route);
  const html=await (await get('/instructor/')).text();assert(html.includes('manifest.webmanifest'));assert(!html.includes(hub.token));
  const manifest=await (await get('/instructor/manifest.webmanifest')).json();assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'/instructor/');
  for(const url of ['/instructor/app.js','/instructor/app.css','/instructor/icon.png','/instructor/calculators.js','/instructor/sw.js'])assert.equal((await get(url)).status,200);
  assert.equal((await get('/api/instructor/status')).status,401);
  const pair=(code,site='same-origin')=>fetch(base+'/instructor/pair',{method:'POST',headers:{'Content-Type':'application/json','Sec-Fetch-Site':site},body:JSON.stringify({code})});
  assert.equal((await pair('ABCDE-FG234','cross-site')).status,403);
  assert.equal((await pair('ABCDE-FG235')).status,401);
  const response=await pair('ABCDE-FG234');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const {token}=await response.json();assert.equal(token,hub.token);
  assert.equal((await fetch(base+'/api/instructor/status',{headers:{Authorization:'Bearer '+token}})).status,200);
  assert.equal(hub.status().webApp,'https://synthetic.trycloudflare.com/instructor/');
 }finally{await hub.stop();fs.rmSync(folder,{recursive:true,force:true});}
});
test('client pairing is role-checked and remembered only by explicit encrypted opt-in',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-pairing-')),pair={url:'https://synthetic.trycloudflare.com',token:'a'.repeat(64)};
 const storage={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from('encrypted:'+Buffer.from(s).toString('base64')),decryptString:b=>Buffer.from(b.toString().slice(10),'base64').toString()};
 let role='instructor';const options={resolve:async()=>pair,transport:async()=>({service:role==='instructor'?'ZYZTools Instructor':'Student',role,apiVersion:1,slots:[]})};
 try{const client=new InstructorClient(folder,storage,options);await client.connect('ABCDE-FG234');assert(!fs.existsSync(client.file));await client.connect('ABCDE-FG234',true);assert(!fs.readFileSync(client.file,'utf8').includes(pair.token));client.disconnect();assert.equal((await client.restore()).connected,true);client.disconnect(true);assert(!fs.existsSync(client.file));role='student';await assert.rejects(()=>client.connect('ABCDE-FG234'),/student/);const noEncryption=new InstructorClient(folder,{isEncryptionAvailable:()=>false},options);role='instructor';await assert.rejects(()=>noEncryption.connect('ABCDE-FG234',true),/encrypted/);}
 finally{fs.rmSync(folder,{recursive:true,force:true});}
});
