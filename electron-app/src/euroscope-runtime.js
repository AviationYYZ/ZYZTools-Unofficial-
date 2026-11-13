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
const query=()=>new Promise((resolve,reject)=>cp.execFile('tasklist.exe',['/FI','IMAGENAME eq EuroScope.exe','/FO','CSV','/NH'],{windowsHide:true,timeout:3000},(e,s)=>e?reject(e):resolve(/(?:^|\r?\n)"EuroScope\.exe",/i.test(s))));
class DllGuard{
 constructor({version,running=query}){this.version=version;this.running=running;this.versions=new Map();}
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
   this.pending=Promise.resolve().then(()=>this.running()).then(value=>{this.active=value;this.checked=Date.now();}).catch(()=>{this.checked=Date.now();}).finally(()=>{this.pending=null;});
  }
  await this.pending;
  const installed=folder&&this.inspect(path.join(folder,dllName));
  const installedVersion=installed?.version??null;
  // Older DLLs did not encode the desktop version. An unknown version alone
  // is not evidence of a mismatch, and must not disable the whole app.
  return {running:!!this.active,blocked:!!this.active&&installedVersion!==null&&installedVersion!==this.version,version:this.version,installed:!!installed,installedVersion};
 }
}
module.exports={DllGuard,readDllVersion};
