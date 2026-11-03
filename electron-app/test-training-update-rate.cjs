const {test}=require('node:test'),assert=require('node:assert/strict'),net=require('node:net'),{once}=require('node:events');
const {LocalTraining,normalize}=require('./src/local-training'),{TrainingMultiplayer}=require('./src/training-multiplayer');
const demo=()=>structuredClone(require('./src/training-demo.json')),wait=ms=>new Promise(r=>setTimeout(r,ms));
test('bounded rates, exact cadence, physics/clock independence, pause/reset and no catch-up bursts',()=>{
 assert.equal(normalize(demo()).positionUpdateHz,2);
 for(const invalid of [0,3,10,-1,'5',NaN,Infinity])assert.throws(()=>normalize({...demo(),positionUpdateHz:invalid}),/update rate/);
 const states=[];
 for(const hz of [1,2,5]){
  const s=new LocalTraining();s.load(demo());s.updateRate(hz);s.running=true;let packets=[];s.broadcast=line=>packets.push(line);
  for(let i=0;i<100;i++)s.frame(.1);
  assert.equal(packets.length,hz*10*2);assert(packets.every(p=>p.startsWith('@')),'Periodic updates must never resend flight plans');assert(Math.abs(s.elapsed-10)<1e-6);states.push(s.aircraft);
  const before=JSON.stringify(s.aircraft);s.updateRate(1);assert.equal(JSON.stringify(s.aircraft),before);assert.equal(s.running,true);packets=[];s.frame(4);assert.equal(packets.length,2,'Do not burst old samples after a stall');
  s.updateRate(hz);s.reset();assert.equal(s.status().positionUpdateHz,hz);assert.equal(s.elapsed,0);
 }
 assert.deepEqual(states[0],states[1]);assert.deepEqual(states[0],states[2]);
});
test('faster real loopback positions reach authenticated HTTP readers; 1Hz fallback stays live',{timeout:15000},async()=>{
 const reservation=net.createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const s=new LocalTraining(),panel=new TrainingMultiplayer(s,0),sockets=[];
 try{
  s.load({...demo(),aircraft:[demo().aircraft[0]]});s.updateRate(5);await s.start(port);await panel.start();s.run();
  const socket=net.connect({host:s.host,port});sockets.push(socket);await once(socket,'connect');let lines='',packets=0,plans=0;socket.on('data',b=>{lines+=b.toString();let n;while((n=lines.indexOf('\n'))>=0){const line=lines.slice(0,n);lines=lines.slice(n+1);if(line.startsWith('@'))packets++;if(line.startsWith('$FP'))plans++;}});socket.write('#AARATE_TEST:SERVER:Dummy:0:dummy:5:9\r\n');await wait(150);packets=0;
  await wait(2200);assert(packets>=8&&packets<=13,'5Hz packet count '+packets);assert.equal(plans,1);
  const call=async(route,value)=>{const response=await fetch(panel.status().url+route,{method:value?'POST':'GET',headers:{Authorization:'Bearer '+panel.token,...(value?{'Content-Type':'application/json'}:{})},body:value?JSON.stringify(value):undefined});assert.equal(response.status,200);return response.json();};
  const {id}=await call('/api/fsd/open',{});await call('/api/fsd/write/'+id,{sequence:1,data:Buffer.from('#AAHTTP_TEST:SERVER:Dummy:0:dummy:5:9\r\n').toString('base64')});await call('/api/fsd/read/'+id);
  const begin=performance.now(),read=await call('/api/fsd/read/'+id);assert(Buffer.from(read.data,'base64').toString().includes('@'));assert(performance.now()-begin<700,'HTTP long-poll must wake on the faster position, not wait its full timeout');
  const elapsed=s.elapsed;s.updateRate(1);packets=0;await wait(2200);assert(packets>=1&&packets<=3,'1Hz packet count '+packets);assert(s.elapsed>elapsed+1);assert.equal(plans,1);
 }finally{for(const socket of sockets)socket.destroy();panel.stop();s.stop();}
});
