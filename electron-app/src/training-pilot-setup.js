const fs=require('node:fs'),path=require('node:path'),{execFile,spawn}=require('node:child_process');
const {promisify}=require('node:util'),exec=promisify(execFile);
const {exportPlugin}=require('./training-pilot-package');
async function findCli(){
 try{const {stdout}=await exec('where.exe',['codex.exe'],{windowsHide:true,timeout:5000});const file=stdout.split(/\r?\n/).find(f=>fs.existsSync(f.trim()));if(file)return file.trim();}catch{}
 const root=path.join(process.env.LOCALAPPDATA||'','OpenAI/Codex/bin');
 for(const name of fs.existsSync(root)?fs.readdirSync(root).reverse():[]){const file=path.join(root,name,'codex.exe');if(fs.existsSync(file))return file;}
 throw Error('Codex desktop CLI was not found. Install/open the desktop app, then try Set up / repair again.');
}
async function install(source,parent,runtime,test){
 const cli=await findCli();fs.mkdirSync(parent,{recursive:true});
 // Keep earlier exports intact. The registered marketplace identity is stable; each repair gets fresh files.
 const destination=fs.mkdtempSync(path.join(parent,'setup-')),result=exportPlugin(source,destination,runtime,test);
 const options={windowsHide:true,timeout:60000,maxBuffer:1024*1024};
 const marketplace='zyztools-pilots-local'+(test?'-test':''),plugin='zyztools-local-pilots'+(test?'-test':'')+'@'+marketplace;
 const listing=JSON.parse((await exec(cli,['plugin','marketplace','list','--json'],options)).stdout);
 const previous=listing.marketplaces.find(m=>m.name===marketplace);
 if(previous)await exec(cli,['plugin','marketplace','remove',marketplace],options);
 try{await exec(cli,['plugin','marketplace','add',result.marketplaceRoot,'--json'],options);await exec(cli,['plugin','add',plugin,'--json'],options);}
 catch(error){if(previous){try{await exec(cli,['plugin','marketplace','remove',marketplace],options);}catch{}try{await exec(cli,['plugin','marketplace','add',previous.root,'--json'],options);await exec(cli,['plugin','add',plugin,'--json'],options);}catch{}}throw Error('Pilot setup failed; previous registration was restored when possible. '+error.message);}
 return {installed:true,...result};
}
function check(folder){return new Promise((resolve,reject)=>{
 const config=JSON.parse(fs.readFileSync(path.join(folder,'runtime.json'),'utf8'));
 const channel=JSON.parse(fs.readFileSync(path.join(folder,'mcp.json'),'utf8')).mcpServers['zyztools-pilots'].args.at(-1);
 const child=spawn(config.executable,[path.join(folder,'server.cjs'),channel],{windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},stdio:['pipe','pipe','pipe']});
 const timer=setTimeout(()=>finish(Error('Pilot connection check timed out.')),10000);let buffer='',finished=false;
 function finish(error,result){if(finished)return;finished=true;clearTimeout(timer);child.kill();error?reject(error):resolve(result);}
 child.on('error',()=>finish(Error('Cannot launch pilot runtime. Repair the plugin.')));child.on('exit',()=>finish(Error('Pilot runtime closed before replying.')));child.stderr.resume();
 child.stdout.on('data',data=>{buffer+=data;let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);let r;try{r=JSON.parse(line);}catch{continue;}if(r.id!==1)continue;const result=r.result;if(result?.isError)return finish(Error(result.content?.[0]?.text||'Pilot check failed.'));finish(null,{connected:true,status:JSON.parse(result.content[0].text)});}});
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'training_status',arguments:{}}})+'\n');
});}
module.exports={install,check,findCli};
