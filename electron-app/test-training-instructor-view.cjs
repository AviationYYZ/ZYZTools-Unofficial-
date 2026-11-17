const assert=require('node:assert/strict'),net=require('node:net'),{once}=require('node:events'),{LocalTraining}=require('./src/local-training'),{TrainingMultiplayer}=require('./src/training-multiplayer'),{FsdConnector}=require('./src/training-fsd-tunnel');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const sim=new LocalTraining(),panel=new TrainingMultiplayer(sim,0,{readOnly:true}),student=new FsdConnector('127.0.0.1',{port:0}),instructor=new FsdConnector('127.0.0.2',{port:0}),sockets=[];
 try{sim.load(require('./src/training-demo.json'));await sim.start(17841);await panel.start();await student.start({url:panel.status().url,token:panel.token});await instructor.start({url:panel.status().url,token:panel.token});const wires=['',''];
  for(const [i,host]of ['127.0.0.1','127.0.0.2'].entries()){const socket=net.connect({host,port:[student,instructor][i].status().port});sockets.push(socket);socket.on('error',()=>{});socket.on('data',b=>wires[i]+=b);await once(socket,'connect');socket.write('#AA'+(i?'INSTR_APP':'STUD_APP')+':SERVER:Dummy:0000000:dummy:1:100\r\n');}
  for(let i=0;i<50&&!wires.every(w=>w.includes('$FPTEST101')&&w.includes('@N:TEST101'));i++)await wait(100);
  assert(wires.every(w=>w.includes('$FPTEST101')&&w.includes('$FPTEST202')));const positions=w=>w.split('\r\n').filter(l=>l.startsWith('@N:TEST101'));assert.equal(positions(wires[0])[0],positions(wires[1])[0]);assert.equal(sim.status().clients,2);
  sim.run();for(let i=0;i<80&&!wires.every(w=>positions(w).length>1);i++)await wait(100);
  assert(wires.every(w=>positions(w).length>1));assert.equal(positions(wires[0])[1],positions(wires[1])[1]);instructor.stop();assert(student.status().enabled);assert(sim.running);
  console.log('PASS: student and instructor EuroScope connectors receive identical aircraft/positions from one server; unique callsigns; instructor disconnect leaves student and simulator running.');
 }finally{for(const s of sockets)s.destroy();student.stop();instructor.stop();panel.stop();sim.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});
