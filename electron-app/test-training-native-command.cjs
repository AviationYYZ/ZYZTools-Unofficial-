// Manual Windows integration test; only synthetic loopback traffic.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {LocalTraining}=require('./src/local-training'),{TrainingMultiplayer}=require('./src/training-multiplayer'),{FsdConnector}=require('./src/training-fsd-tunnel'),{TrainingCommandBridge}=require('./src/training-command-bridge');
const binary=process.argv[2];if(!binary)throw Error('Pass the compiled TrainingCommandHarness.exe path.');
function run(args,env){return new Promise((resolve,reject)=>{const c=spawn(binary,args,{windowsHide:true,env,stdio:['ignore','pipe','pipe']});let out='';c.stdout.on('data',b=>out+=b);c.stderr.on('data',b=>out+=b);c.on('error',reject);c.on('exit',code=>code===0?resolve(out):reject(Error('Native harness failed ('+code+'): '+out)));});}
(async()=>{const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-native-command-')),sim=new LocalTraining(),panel=new TrainingMultiplayer(sim,0,{readOnly:true}),connector=new FsdConnector('127.0.0.1');let bridge;
 try{sim.load(require('./src/training-demo.json'));await sim.start(17851);await panel.start();await connector.start({url:panel.status().url,token:panel.token});
 const client={pair:{url:'https://synthetic.trycloudflare.com',token:'a'.repeat(64)},state:async()=>({slots:[{id:1,epoch:'epoch'}]}),aircraft:async()=>panel.snapshot(),action:async(slot,action,epoch,p)=>{assert.equal(slot,1);assert.equal(p.sessionId,sim.sessionId);sim.command(p.callsign,p.command);}};
 bridge=new TrainingCommandBridge(path.join(folder,'ZYZTools-test/TrainingCommands'),'test',client,connector);await bridge.bind(1);
 const env={...process.env,APPDATA:folder};await run(['offline'],env);assert.notEqual(sim.aircraft[0].targetHeading,270);
 const result=await run([],env);assert(result.includes('applied'));assert(Math.abs(sim.aircraft[0].targetHeading-(270-sim.scenario.magneticVariationWest))<.001);assert.equal(sim.aircraft[0].targetAltitude,3000);assert.equal(sim.aircraft[0].targetIAS,210);assert.equal(bridge.selection().callsign,'TEST101');
 console.log('PASS: compiled Windows TCP/PID proof rejects non-training process; native command queues through authenticated local HTTP; server receives magnetic heading; acknowledgement and aircraft selection return.');
 }finally{bridge?.close();connector.stop();panel.stop();sim.stop();fs.rmSync(folder,{recursive:true,force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
