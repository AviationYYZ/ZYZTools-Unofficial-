const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),readline=require('node:readline');
const test=process.argv[2]!=='production',pipe='\\\\.\\pipe\\ZYZToolsPilot'+(test?'.Test':'');
const file=path.join(process.env.APPDATA||'',test?'ZYZTools-test':'ZYZTools','pilot-bridge.json');
function invoke(action,value){return new Promise((resolve,reject)=>{
 let config;try{config=JSON.parse(fs.readFileSync(file,'utf8'));}catch{reject(Error('Enable the pilot bridge in the matching ZYZTools app first.'));return;}
 if(config.pipe!==pipe||!/^[a-f0-9]{64}$/.test(config.token||'')){reject(Error('Local pilot connection settings are invalid. Disable/re-enable the bridge.'));return;}
 const c=net.connect(pipe);let text='';c.setTimeout(5000,()=>c.destroy(Error('Local pilot bridge timed out.')));
 c.on('connect',()=>c.write(JSON.stringify({token:config.token,action,value})+'\n'));
 c.on('data',data=>{text+=data.toString();if(text.length>1000000){c.destroy();reject(Error('Local result too large.'));return;}const end=text.indexOf('\n');if(end>=0){try{const message=JSON.parse(text.slice(0,end));message.error?reject(Error(message.error)):resolve(message.result);}catch{reject(Error('Invalid local pilot result.'));}c.end();}});
 c.on('error',()=>reject(Error('Local pilot bridge is unavailable. Enable it in ZYZTools.')));c.on('close',()=>{if(!text.includes('\n'))reject(Error('Local pilot bridge closed before replying.'));});
 });}
const tools=[{name:'training_status',description:'Get local simulation session, active aircraft, readbackMode, selected arrival runway, IAS, approach/pause states and expanded route fixes. No live traffic.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,closedWorldHint:true}},{name:'pilot_instruction',description:'Execute one local simulated clearance after your spoken readback in ChatGPT mode (readbackCompleted=true), or queue Windows speech in windows mode. Do not set readbackCompleted before finishing your spoken readback. No further approval needed. One to five commands, exact active callsign, current session; reuse requestId on retries. Local only.',inputSchema:{type:'object',properties:{sessionId:{type:'string'},requestId:{type:'string',minLength:8,maxLength:100},callsign:{type:'string'},readbackCompleted:{type:'boolean',description:'True only after finishing the actual spoken readback in voice chat. Agent report, not an independently verified audio callback.'},commands:{type:'array',minItems:1,maxItems:5,items:{type:'string'}}},required:['sessionId','requestId','callsign','commands'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,closedWorldHint:true}}];
async function handle(request){
 if(request.method==='initialize')return {protocolVersion:request.params?.protocolVersion||'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'zyztools-local-pilots',version:'0.2.0'}};
 if(request.method==='ping')return {};
 if(request.method==='tools/list')return {tools};
 if(request.method==='tools/call'){
  try{const p=request.params||{};if(!['training_status','pilot_instruction'].includes(p.name))throw Error('Unknown tool.');const result=await invoke(p.name==='training_status'?'status':'queue',p.arguments);return {content:[{type:'text',text:JSON.stringify(result)}]};}catch(error){return {isError:true,content:[{type:'text',text:error.message}]};}
 }
 throw Error('Unsupported MCP method.');
}
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});rl.on('line',line=>{
 if(line.length>20000)return;let request;try{request=JSON.parse(line);}catch{return;}if(!Object.hasOwn(request,'id'))return;
 handle(request).then(result=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:request.id,result})+'\n')).catch(()=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:request.id,error:{code:-32601,message:'Unsupported MCP method'}})+'\n'));
});
