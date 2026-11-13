const fs=require('node:fs'),path=require('node:path');
const github=require('./engine.cjs')('github-updates');
const repo=github.DEFAULT_REPOSITORY;
async function newestServer(installed,request=fetch){
 const result=await request('https://api.github.com/repos/'+repo+'/releases?per_page=100',{
  headers:{Accept:'application/vnd.github+json','User-Agent':'ZYZTools-Server'},signal:AbortSignal.timeout(10000)
 });
 if(!result.ok)throw Error('Release check unavailable ('+result.status+').');
 const rows=await result.json(),list=[];
 for(const r of Array.isArray(rows)?rows:[]){
  const m=/^v?(\d+\.\d+\.\d+)$/.exec(r.tag_name);
  if(!m||r.draft||r.prerelease||!github.newer(r.tag_name,installed))continue;
  const asset=Array.isArray(r.assets)&&r.assets.find(a=>a.name==='ZYZTools-Server-Setup-'+m[1]+'.exe'&&
   Number.isSafeInteger(a.size)&&a.size>0&&a.size<250*1024*1024&&/^sha256:[a-f0-9]{64}$/.test(a.digest||'')&&
   a.browser_download_url==='https://github.com/'+repo+'/releases/download/'+r.tag_name+'/'+a.name);
  if(asset)list.push({repo,tag:r.tag_name,asset,available:true});
 }
 return list.sort((a,b)=>github.newer(a.tag,b.tag)?-1:github.newer(b.tag,a.tag)?1:0)[0]||null;
}
class ServerUpdater{
 constructor({version,folder,idle,install,request=fetch,download=github.download,now=Date.now}){
  Object.assign(this,{version,folder,idle,install,request,download,now,nextCheck:0,busy:false,available:null,message:'Waiting to check stable releases.'});
  this.attemptFile=path.join(folder,'last-server-update-attempt.json');
 }
 async tick(){
  if(this.busy)return;this.busy=true;
  try{
   const now=this.now();
   if(now>=this.nextCheck){this.nextCheck=now+5*60_000;this.available=await newestServer(this.version,this.request);}
   const release=this.available;
   if(!release){this.message='Stable '+this.version+' · no verified newer server installer found.';return;}
   if(!this.idle()){this.message=release.tag+' available · installs after all slots stop.';return;}
   let previous;try{previous=JSON.parse(fs.readFileSync(this.attemptFile,'utf8'));}catch{}
   if(previous?.tag===release.tag&&now-previous.time<30*60_000){this.message='Waiting before retrying '+release.tag+'.';return;}
   this.message='Downloading and verifying '+release.tag+'…';
   const installer=await this.download(release,path.join(this.folder,'updates',release.tag),this.request);
   if(!this.idle()){this.message=release.tag+' ready · installs after all slots stop.';return;}
   fs.mkdirSync(this.folder,{recursive:true});fs.writeFileSync(this.attemptFile,JSON.stringify({tag:release.tag,time:now}));
   this.message='Installing '+release.tag+' and restarting…';
   await this.install(installer);
   this.available=null;
  }catch(e){this.message='Stable update check: '+e.message;}
  finally{this.busy=false;}
 }
}
module.exports={newestServer,ServerUpdater};
