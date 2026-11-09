const {app,safeStorage}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const userData=path.join(process.env.APPDATA,'ZYZTools-test');
app.setPath('userData',userData);
app.whenReady().then(async()=>{
 const version=process.argv[2];
 if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Pass the approved desktop version.');
 const resources=path.join(process.env.LOCALAPPDATA,'ZYZTools/Builds/desktop-'+version,'test/win-ia32-unpacked/resources');
 const snapshot=JSON.parse(fs.readFileSync(path.join(resources,'TestSourceSnapshot.json'),'utf8'));
 const token=require('../electron-app/src/publishing-auth').load(userData,safeStorage);
 const release=await require('../electron-app/src/test-publisher').publish({token,version,snapshot,installer:path.join(resources,'Publishing/ZYZTools-Setup.exe'),stream:'beta'});
 console.log(release.url);
}).then(()=>app.exit(0)).catch(e=>{console.error(e.message);app.exit(1);});
