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
  for(const id of [1,2,3]){const raw=demo();raw.name='Uploaded '+id;raw.aircraft[1].spawnTime=60;assert.equal((await act(id,'import',{scenario:raw})).status,200);assert.equal((await act(id,'start')).status,200);}
  const snapshots=[];for(const id of [1,2,3])snapshots[id]=(await req('/api/instructor/aircraft/'+id)).data;
  assert(snapshots[1].aircraft.length===2);assert.notEqual(snapshots[1].sessionId,snapshots[2].sessionId);
  const payload={sessionId:snapshots[2].sessionId,callsign:'TEST101',command:'ALT 7000'};assert.equal((await act(2,'command',payload)).status,200);assert.equal((await req('/api/instructor/aircraft/2')).data.aircraft[0].targetAltitude,7000);assert.equal((await req('/api/instructor/aircraft/1')).data.aircraft[0].targetAltitude,11000);
  assert.equal((await act(2,'command',{...payload,command:'LHDG 330, ALT 3000, IAS 210'})).status,200);let multi=(await req('/api/instructor/aircraft/2')).data.aircraft[0];assert.equal(multi.targetAltitude,3000);assert.equal(multi.targetIAS,210);assert.equal(multi.turnDirection,-1);
  assert.equal((await act(2,'command',{...payload,command:'ALT 4000, DCT MISSING'})).status,400);assert.equal((await req('/api/instructor/aircraft/2')).data.aircraft[0].targetAltitude,3000);
  const rid=crypto.randomUUID(),epoch=manager.slot(2).epoch;const original=await act(2,'command',payload,epoch,rid);assert.equal((await act(2,'command',payload,epoch,rid)).data.sessionId,original.data.sessionId);assert.equal((await act(2,'command',{...payload,command:'ALT 9000'},epoch,rid)).status,400);
  assert.equal((await act(2,'command',{...payload,command:'DELETE AIRCRAFT'})).status,200);assert.equal((await req('/api/instructor/aircraft/2')).data.aircraft.length,1);assert.equal((await req('/api/instructor/aircraft/1')).data.aircraft.length,2);
  await act(2,'reset');assert.equal((await act(2,'command',payload)).status,400);assert.equal((await act(2,'run',{},epoch)).status,400);
  const before=manager.slot(1).child;assert.equal((await act(1,'import',{scenario:{}})).status,400);assert.equal(manager.slot(1).child,before);
  const replacement=demo();replacement.name='Replacement from client';assert.equal((await act(1,'import',{scenario:replacement})).status,200);assert.equal(manager.status().slots[0].state,'stopped');assert.equal(manager.status().slots[0].scenarioName,replacement.name);assert(manager.slot(3).child);
  assert.equal((await act(3,'configure',{path:'C:/'})).status,400);assert.equal((await act(4,'stop',{},'invalid')).status,400);assert.equal((await req('/api/fsd/open',{})).status,404);
  studentTraining.load(demo());await studentTraining.start(17831);await student.start();assert.equal((await req('/api/instructor/status',undefined,student.token)).status,401);
  const sbase=student.status().url;assert.equal((await fetch(sbase+'/api/status',{headers:{Authorization:'Bearer '+hub.token}})).status,401);
  const res=await fetch(sbase+'/api/action',{method:'POST',headers:{Authorization:'Bearer '+student.token,'Content-Type':'application/json'},body:JSON.stringify({action:'command'})});assert.equal(res.status,403);
  assert.equal((await (await fetch(sbase+'/api/status',{headers:{Authorization:'Bearer '+student.token}})).json()).readOnly,true);
  const old=hub.token;await hub.stop();assert(!hub.token);assert.notEqual(old,hub.token);
 }finally{await hub.stop();student.stop();studentTraining.stop();await manager.shutdown();fs.rmSync(folder,{recursive:true,force:true});}
});
test('client pairing is role-checked and remembered only by explicit encrypted opt-in',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-pairing-')),pair={url:'https://synthetic.trycloudflare.com',token:'a'.repeat(64)};
 const storage={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from('encrypted:'+Buffer.from(s).toString('base64')),decryptString:b=>Buffer.from(b.toString().slice(10),'base64').toString()};
 let role='instructor';const options={resolve:async()=>pair,transport:async()=>({service:role==='instructor'?'ZYZTools Instructor':'Student',role,apiVersion:1,slots:[]})};
 try{const client=new InstructorClient(folder,storage,options);await client.connect('ABCDE-FG234');assert(!fs.existsSync(client.file));await client.connect('ABCDE-FG234',true);assert(!fs.readFileSync(client.file,'utf8').includes(pair.token));client.disconnect();assert.equal((await client.restore()).connected,true);client.disconnect(true);assert(!fs.existsSync(client.file));role='student';await assert.rejects(()=>client.connect('ABCDE-FG234'),/student/);const noEncryption=new InstructorClient(folder,{isEncryptionAvailable:()=>false},options);role='instructor';await assert.rejects(()=>noEncryption.connect('ABCDE-FG234',true),/encrypted/);}
 finally{fs.rmSync(folder,{recursive:true,force:true});}
});
