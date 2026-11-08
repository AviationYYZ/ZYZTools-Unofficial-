const {test}=require('node:test'),assert=require('node:assert/strict');
const {AppPolicyClient}=require('./src/app-policy');
test('policy gates apply in the main process, and code edits invalidate prior grants',async()=>{
 let state={revision:0,rules:{replay:'code',discord:'disabled'},maintenance:false,announcement:null};
 const app=new AppPolicyClient({Socket:null,request:async(url,opts)=>{
  if(url.endsWith('/v2/policy'))return Response.json(state);
  if(url.endsWith('/v2/redeem'))return Response.json({revision:state.revision,features:['replay'],expires:Date.now()+3600000});
  assert.match(opts.headers.Authorization,/^Bearer [a-f0-9]{64}$/);return Response.json({ok:true});
 }});
 await app.refresh();
 assert.throws(()=>app.assert('replay'),/requires access/);
 assert.throws(()=>app.assert('discord'),/disabled/);
 await assert.rejects(app.admin('67g7z28s',{action:'status'}),/private/);
 await app.redeem('A'.repeat(24));
 assert.doesNotThrow(()=>app.assert('replay'));
 state={...state,revision:1,maintenance:true};
 await app.refresh();
 assert.throws(()=>app.assert('replay'),/requires access/);
 assert.throws(()=>app.assert('localTraining'),/maintenance/);
 assert.equal((await app.admin('a'.repeat(64),{action:'status'})).ok,true);
});
test('HTTPS refresh delivers an announcement even when the WebSocket stays open but misses an event',async()=>{
 const message={message:'Local fixture announcement',until:Date.now()+60000};
 const client=new AppPolicyClient({Socket:null,request:async()=>Response.json({revision:0,rules:{},maintenance:false,announcement:message})});
 client.socket={readyState:1};await client.refresh();assert.deepEqual(client.snapshot().announcement,message);
});
