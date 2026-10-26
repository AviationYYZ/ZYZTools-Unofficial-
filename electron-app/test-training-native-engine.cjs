const {test}=require('node:test'),assert=require('node:assert/strict'),net=require('node:net'),{once}=require('node:events'),path=require('node:path');
const {NativeEuroScopeRelay}=require('./src/training-native-relay'),{bundle}=require('./src/training-native-export'),{TrainingMultiplayer}=require('./src/training-multiplayer'),{normalize,position,flightPlan}=require('./src/local-training');
const demo=()=>structuredClone(require('./src/training-demo.json')),wait=ms=>new Promise(r=>setTimeout(r,ms));
test('native export uses resolved editor fixes, isolated private profiles and explicit limitations',()=>{
 const raw=demo();raw.aircraft[1].spawnTime=120;const result=bundle(raw,2,path.resolve('native-synthetic-test'));assert.equal(result.hostAddress,'127.0.0.12');assert(result.files['host.prf'].includes('LastSession\ttovatsim\t0'));assert(result.files['host.prf'].includes('LastSession\tpassword\tdummy'));assert(result.files['host.prf'].includes('LastSession\tconnecttype\t2'));assert(!result.files['host.prf'].includes('AUTOMATIC'));assert(result.files['scenario.txt'].includes('START:2'));assert(result.files['native.sct'].includes('[FIXES]'));for(const w of raw.waypoints)assert(result.files['native.sct'].includes(w.name+' '));assert(result.files['SETUP.txt'].includes('Scenario EMPTY'));
 assert.throws(()=>bundle({...raw,aircraft:[{...raw.aircraft[0],spawnTime:90}]},1,path.resolve('native-synthetic-test')),/whole-minute/);assert.throws(()=>bundle(raw,4,path.resolve('native-synthetic-test')),/slot/);assert.throws(()=>new NativeEuroScopeRelay('8.8.8.8'),/loopback/);
});
test('native private relay transports opaque controls and aircraft; student role cannot drive/spoof; no second engine',{timeout:20000},async()=>{
 const relay=new NativeEuroScopeRelay('127.0.0.11'),panel=new TrainingMultiplayer(relay,0,{readOnly:true,instructorTransport:true});let host;
 try{
  relay.load(demo());await relay.start(0);await panel.start();const base=panel.status().url;
  const call=async(route,token,value)=>{const response=await fetch(base+route,{method:value?'POST':'GET',headers:{Authorization:'Bearer '+token,...(value?{'Content-Type':'application/json'}:{})},body:value?JSON.stringify(value):undefined});return {status:response.status,data:await response.json()};};
  const student=(await call('/api/fsd/open',panel.token,{})).data.id,instructor=(await call('/api/fsd/open',panel.instructorToken,{})).data.id;assert(student&&instructor);assert.notEqual(panel.token,panel.instructorToken);
  const write=(id,token,sequence,text)=>call('/api/fsd/write/'+id,token,{sequence,data:Buffer.from(text+'\r\n').toString('base64')});
  await write(student,panel.token,1,'#AASTUDENT:SERVER:Dummy:0:dummy:1:9');await write(instructor,panel.instructorToken,1,'#AAINSTR:SERVER:Dummy:0:dummy:1:9');
  host=net.connect({host:relay.host,port:relay.port});await once(host,'connect');let received='';host.on('data',b=>received+=b);host.write('#AAZYHOST:SERVER:Dummy:0:dummy:5:9\r\n');await wait(30);
  const a=normalize(demo()).aircraft[0];host.write(position(a)+'\r\n'+flightPlan(a)+'\r\n');await wait(50);assert.equal(relay.status().aircraft.length,1);assert.equal(relay.status().aircraft[0].ias,null);assert(relay.status().nativeHostConnected);assert.equal(relay.status().running,null);
  const opaque='#PCINSTR:ZYHOST:NATIVE_TEST_MESSAGE:TEST101:unchanged';received='';await write(instructor,panel.instructorToken,2,opaque);await wait(40);assert(received.includes(opaque));
  const bad='#PCSTUDENT:ZYHOST:NATIVE_TEST_MESSAGE:TEST101:bad';await write(student,panel.token,2,bad);await write(student,panel.token,3,position({...a,altitude:50000}));await write(student,panel.token,4,'#DP'+a.callsign+':0');await wait(40);assert(!received.includes(bad));assert.equal(relay.status().aircraft[0].altitude,a.altitude);
  assert.equal((await call('/api/fsd/read/'+student,panel.instructorToken)).status,400,'Transport sessions must remain role-isolated');assert.equal((await call('/api/fsd/read/'+instructor,panel.token)).status,400);
  const shot=(await call('/api/status',panel.token)).data;assert.equal(shot.engineMode,'euroscope');assert.equal(shot.readOnly,true);assert(!JSON.stringify(shot).includes(panel.instructorToken));assert(!JSON.stringify(shot).includes('dummy'));
  assert.throws(()=>relay.command('TEST101','ALT 5000'),/Native mode/);assert.throws(()=>relay.run(),/SERVER-PC/);assert.throws(()=>relay.reset(),/SERVER-PC/);const before=JSON.stringify(relay.status().aircraft);await wait(250);assert.equal(JSON.stringify(relay.status().aircraft),before,'Relay must not fly or extrapolate aircraft itself');
  host.destroy();await wait(60);assert.equal(relay.status().aircraft.length,0);const removed=(await call('/api/fsd/read/'+student,panel.token)).data;assert(Buffer.from(removed.data,'base64').toString().includes('#DP'+a.callsign+':0'));
 }finally{host?.destroy();panel.stop();relay.stop();}
});
