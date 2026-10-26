const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {TrainingCommandBridge,normalizeCommand}=require('./src/training-command-bridge'),{LocalTraining}=require('./src/local-training');
test('local instructor bridge: selection, scoped commands, stale/session/peer/role rejection, no retries',{timeout:15000},async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-command-')),sim=new LocalTraining();sim.load(require('./src/training-demo.json'));const connector={server:true,generation:1,peerForPort:p=>p===43210?{controller:'INSTR_APP'}:null};let calls=0;
 const client={pair:{url:'https://synthetic.trycloudflare.com',token:'a'.repeat(64)},state:async()=>({slots:[{id:1,epoch:'epoch1'}]}),aircraft:async()=>({...sim.status(),listening:true}),action:async(slot,action,epoch,payload)=>{assert.equal(slot,1);assert.equal(action,'command');assert.equal(epoch,'epoch1');assert.equal(payload.sessionId,sim.sessionId);calls++;sim.command(payload.callsign,payload.command);}};
 const bridge=new TrainingCommandBridge(folder,'test',client,connector,{port:0});
 try{await bridge.bind(1);const cfg=JSON.parse(fs.readFileSync(bridge.file));const base='http://127.0.0.1:'+bridge.port,v={callsign:'TEST101',controller:'INSTR_APP',port:43210,pid:1234,sent_at:Math.floor(Date.now()/1000),sessionId:sim.sessionId};
  const req=async(route,data,token=cfg.nonce)=>{const r=await fetch(base+route,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+token,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json()};};
  assert.equal((await req('/selection',{...v,changed_at:100})).status,200);assert.equal(bridge.selection().callsign,'TEST101');assert.equal(bridge.selection().slot,1);
  assert.equal((await req('/command',{...v,id:'command-0001',command:'HDG 270'})).status,202);
  let done;for(let i=0;i<30;i++){done=await req('/result?id=command-0001');if(done.data.state!=='pending')break;await new Promise(r=>setTimeout(r,20));}assert.equal(done.data.state,'done');assert.equal(calls,1);
  await req('/command',{...v,id:'command-0001',command:'HDG 270'});assert.equal(calls,1);
  for(const bad of [{...v,port:2},{...v,controller:'STUDENT_APP'},{...v,sessionId:'old-session'},{...v,sent_at:1},{...v,callsign:'LIVE123'}])assert.equal((await req('/command',{...bad,id:'command-bad1',command:'ALT 9000'})).status,400);
  assert.equal((await req('/command',{...v,id:'command-bad2',command:'run cmd.exe'})).status,400);assert.equal((await req('/selection',{...v,changed_at:101},'bad')).status,401);assert.equal(calls,1);
  sim.reset();await bridge.refresh();assert.notEqual(JSON.parse(fs.readFileSync(bridge.file)).nonce,cfg.nonce);assert.equal((await req('/command',{...v,id:'command-old1',command:'ALT 9000'})).status,401);
  connector.generation++;await bridge.refresh();assert.equal(bridge.selection().enabled,false);assert(!fs.existsSync(bridge.file));
  assert.equal(normalizeCommand('delete'),'DELETE AIRCRAFT');assert.equal(normalizeCommand('app'),'APP CLEAR');assert.equal(normalizeCommand('LHDG 330, ALT 3000'),'LHDG 330, ALT 3000');
 }finally{bridge.close();fs.rmSync(folder,{recursive:true,force:true});}
});
