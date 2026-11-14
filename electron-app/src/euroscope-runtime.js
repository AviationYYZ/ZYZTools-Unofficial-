const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const dllName='PreferredCYYZPdcPlugin.dll';
const versionMarker=/ZYZTOOLS_DLL_VERSION\[(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]/g;
function readDllVersion(bytes){
 if(bytes.length<64||bytes.readUInt16LE(0)!==0x5a4d)return null;
 const pe=bytes.readUInt32LE(0x3c);
 if(pe<64||pe>bytes.length-24||bytes.readUInt32LE(pe)!==0x4550||!(bytes.readUInt16LE(pe+22)&0x2000))return null;
 const versions=new Set(Array.from(bytes.toString('latin1').matchAll(versionMarker),m=>m[1]));
 return versions.size===1?[...versions][0]:null;
}
const queryRunning=()=>new Promise((resolve,reject)=>cp.execFile('tasklist.exe',['/FI','IMAGENAME eq EuroScope.exe','/FO','CSV','/NH'],{windowsHide:true,timeout:3000},(e,s)=>e?reject(e):resolve(/(?:^|\r?\n)"EuroScope\.exe",/i.test(s))));
const moduleCommand="$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; $paths=@(Get-Process -Name EuroScope -ErrorAction SilentlyContinue | ForEach-Object { $_.Modules | Where-Object ModuleName -eq 'PreferredCYYZPdcPlugin.dll' | ForEach-Object FileName }); ConvertTo-Json -Compress -InputObject $paths";
async function query(){
 if(!await queryRunning())return {running:false,paths:[]};
 const windows=process.env.SystemRoot||'C:\\Windows';
 // EuroScope is x86; 64-bit Windows PowerShell sees only its WOW64 modules.
 const x86=path.join(windows,'SysWOW64','WindowsPowerShell','v1.0','powershell.exe');
 const ps=fs.existsSync(x86)?x86:path.join(windows,'System32','WindowsPowerShell','v1.0','powershell.exe');
 const paths=await new Promise(resolve=>cp.execFile(ps,['-NoProfile','-NonInteractive','-Command',moduleCommand],{windowsHide:true,timeout:4500},(e,s)=>{
  try{if(e)throw e;const list=JSON.parse(s);resolve(Array.isArray(list)?list.filter(p=>typeof p==='string'&&path.isAbsolute(p)):null);}catch{resolve(null);}
 }));
 return {running:true,paths};
}
class DllGuard{
 constructor({version,otherChannelFolder,running=query}){this.version=version;this.otherChannelFolder=otherChannelFolder?.toLowerCase();this.running=running;this.versions=new Map();}
 inspect(file){
  try{
   const stat=fs.statSync(file),id=stat.size+':'+stat.mtimeMs+':'+stat.ctimeMs+':'+stat.ino,old=this.versions.get(file);
   if(old?.id===id)return old;
   const result={id,version:readDllVersion(fs.readFileSync(file))};
   this.versions.set(file,result);return result;
  }catch{return null;}
 }
 async check(folder,force=false){
  if(!this.pending&&(force||this.checked===undefined||Date.now()-this.checked>1500)){
   this.pending=Promise.resolve().then(()=>this.running()).then(value=>{this.active=typeof value==='boolean'?{running:value,paths:null}:value;this.checked=Date.now();}).catch(()=>{this.checked=Date.now();}).finally(()=>{this.pending=null;});
  }
  await this.pending;
  const installed=folder&&this.inspect(path.join(folder,dllName));
  const running=!!this.active?.running;
  const loaded=this.active?.paths?.filter(file=>path.basename(path.dirname(file)).toLowerCase()!==this.otherChannelFolder);
  const candidates=(loaded??(folder?[path.join(folder,dllName)]:[])).map(file=>({file,info:this.inspect(file)}));
  const mismatch=running?candidates.find(({info})=>info?.version&&info.version!==this.version):null;
  const unknown=running?candidates.find(({info})=>!info?.version&&(info||loaded)):null;
  return {running,blocked:!!mismatch,unverified:!mismatch&&!!unknown,version:this.version,installed:!!installed,
   installedVersion:mismatch?.info.version??(unknown?null:(loaded?candidates[0]?.info?.version:installed?.version)??null),
   checkedFile:mismatch?.file??unknown?.file??null};
 }
}
module.exports={DllGuard,readDllVersion};
