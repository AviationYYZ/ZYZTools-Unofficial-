const {app,safeStorage}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const userData=path.join(process.env.APPDATA,'ZYZTools-test');
app.setPath('userData',userData);
app.whenReady().then(async()=>{
 const version=process.argv[2];
 if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Pass the approved desktop version.');
 const output=path.join(process.env.LOCALAPPDATA,'ZYZTools/Builds/desktop-'+version+(process.argv.includes('--final')?'-final':''));
 const productionOnly=process.argv.includes('--consumer-build');
 const resources=path.join(output,productionOnly?'production':'test','win-ia32-unpacked/resources');
 const installer=productionOnly?path.join(output,'production','ZYZTools-Setup.exe'):path.join(resources,'Publishing/ZYZTools-Setup.exe');
 const snapshot=JSON.parse(fs.readFileSync(path.join(resources,'TestSourceSnapshot.json'),'utf8'));
 const token=require('../electron-app/src/publishing-auth').load(userData,safeStorage);
 const request=async(url,options)=>{
  const response=await fetch(url,options);
  if(!response.ok&&response.status!==404&&new URL(url).hostname==='api.github.com'){
   const detail=await response.clone().json().catch(()=>({}));
   console.error(options.method+' '+new URL(url).pathname+' '+response.status+': '+String(detail.message||'').slice(0,220));
  }
  return response;
 };
 const streams=process.argv.includes('--both')?['beta','stable']:process.argv.includes('--stable')?['stable']:['beta'];
 for(const stream of streams){
  const release=await require('../electron-app/src/test-publisher').publish({token,version,snapshot,installer,stream,essential:process.argv.includes('--essential')},request);
  console.log(release.url);
 }
}).then(()=>app.exit(0)).catch(e=>{console.error(e.message);app.exit(1);});
