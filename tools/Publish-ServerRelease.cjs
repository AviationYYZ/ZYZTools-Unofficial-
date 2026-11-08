const {app,safeStorage}=require('electron'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
app.setPath('userData',path.join(process.env.APPDATA,'ZYZTools-test'));
app.whenReady().then(async()=>{
 const version=process.argv[2];
 if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Pass the explicitly approved server version.');
 const token=require('../electron-app/src/publishing-auth').load(path.join(process.env.APPDATA,'ZYZTools-test'),safeStorage);
 if(!token)throw Error('No saved GitHub publishing credential.');
 const beta=process.argv[3]==='--beta';
 const repo='AviationYYZ/ZYZTools-Unofficial-',tag='v'+version+(beta?'-beta':''),name='ZYZTools-Server-Setup-'+version+'.exe';
 const built=fs.readFileSync(path.join(process.env.LOCALAPPDATA,'ZYZTools/Builds/server-'+version,name));
 const bytes=fs.readFileSync(path.join(process.env.USERPROFILE,'Downloads',name));
 if(!bytes.equals(built)||bytes.subarray(0,2).toString()!=='MZ')throw Error('Installer does not match verified build.');
 const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','User-Agent':'ZYZTools-Server-Publisher'};
 async function api(endpoint,method='GET',body){
  const r=await fetch('https://api.github.com'+endpoint,{method,headers:{...headers,'Content-Type':'application/json'},body:body&&JSON.stringify(body),redirect:'error'});
  if(r.status===404&&method==='GET')return null;
  if(!r.ok)throw Error(method+' '+endpoint+' failed ('+r.status+')');
  return r.json();
 }
 if((await api('/user'))?.login?.toLowerCase()!=='aviationyyz')throw Error('Saved GitHub account is not AviationYYZ.');
 const root='/repos/'+repo;
 if(await api(root+'/releases/tags/'+tag))throw Error('A release already exists; refusing to replace it.');
 const draft=await api(root+'/releases','POST',{tag_name:tag,name:'ZYZTools Server '+version+(beta?' beta':''),body:beta?'Server-only beta. Anticipates the turn onto the filed outbound leg after a vector-to-direct rejoin. Install manually to test.':'Server-only stable release. Improves outbound STAR track capture after vector-to-direct and fixes the NUBER6 runway 23 branch at PENGO.',draft:true,prerelease:beta});
 const upload=new URL(draft.upload_url.replace(/\{.*$/,''));
 if(upload.origin!=='https://uploads.github.com')throw Error('Invalid upload endpoint.');
 upload.searchParams.set('name',name);
 const response=await fetch(upload,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream'},body:bytes,redirect:'error',signal:AbortSignal.timeout(180000)});
 if(!response.ok)throw Error('Installer upload failed ('+response.status+'); release remains draft.');
 const asset=await response.json();
 if(asset.size!==bytes.length||asset.digest!=='sha256:'+crypto.createHash('sha256').update(bytes).digest('hex'))throw Error('Upload verification failed; release remains draft.');
 const release=await api(root+'/releases/'+draft.id,'PATCH',{draft:false,prerelease:beta,make_latest:'false'});
 console.log(release.html_url);
}).then(()=>app.exit(0)).catch(e=>{console.error(e.message);app.exit(1);});
