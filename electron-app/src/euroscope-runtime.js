const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const dllName='PreferredCYYZPdcPlugin.dll';
const query=()=>new Promise((resolve,reject)=>cp.execFile('tasklist.exe',['/FI','IMAGENAME eq EuroScope.exe','/FO','CSV','/NH'],{windowsHide:true,timeout:3000},(e,s)=>e?reject(e):resolve(/(?:^|\r?\n)"EuroScope\.exe",/i.test(s))));
class DllGuard{
 constructor({payload,version,running=query}){this.payload=payload;this.version=version;this.running=running;this.hashes=new Map();}
 hash(file){
  try{
   const stat=fs.statSync(file),id=stat.size+':'+stat.mtimeMs+':'+stat.ctimeMs,old=this.hashes.get(file);
   if(old?.id===id)return old.hash;
   const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
   this.hashes.set(file,{id,hash});return hash;
  }catch{return null;}
 }
 async check(folder,force=false){
  if(!this.pending&&(force||this.checked===undefined||Date.now()-this.checked>1500)){
   this.pending=Promise.resolve().then(()=>this.running()).then(value=>{this.active=value;this.checked=Date.now();}).catch(()=>{this.checked=Date.now();}).finally(()=>{this.pending=null;});
  }
  await this.pending;
  const installed=folder&&this.hash(path.join(folder,dllName)),expected=this.hash(path.join(this.payload(),dllName));
  return {running:!!this.active,blocked:!!this.active&&(!installed||!expected||installed!==expected),version:this.version,installed:!!installed};
 }
}
module.exports={DllGuard};
