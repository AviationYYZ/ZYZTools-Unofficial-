'use strict';
// Materialize the pre-aircraft-profile desktop baseline in a separate build directory.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const builds=path.join(process.env.LOCALAPPDATA,'ZYZTools/Builds');
const baseline=JSON.parse(fs.readFileSync(path.join(builds,'desktop-2.0.27/test/win-ia32-unpacked/resources/TestSourceSnapshot.json'),'utf8'));
assert.equal(baseline.version,'2.0.27');
const stage=path.join(builds,'source-dll-hotfix-2.0.31');
fs.mkdirSync(stage);
function put(rel,content,encoding){
 const file=path.resolve(stage,rel);
 assert(file.startsWith(stage+path.sep),rel);
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content,encoding);
}
for(const file of baseline.files)put(file.path,file.content,file.encoding);
for(const rel of ['src/ZYZToolsPlugin.cpp','tools/Build-Channel.ps1','electron-app/src/euroscope-runtime.js','electron-app/src/workspace-ui.jsx','electron-app/test-euroscope-launch.cjs'])
 put(rel,fs.readFileSync(path.join(root,rel)));
const main='electron-app/src/main.js',current=fs.readFileSync(path.join(root,main),'utf8');
let source=fs.readFileSync(path.join(stage,main),'utf8');
for(const prefix of ['const dllGuard=','const recoveryChannels=']){
 const pattern=new RegExp('^'+prefix+'.*','m');
 assert(pattern.test(source)&&pattern.test(current));
 source=source.replace(pattern,()=>current.match(pattern)[0]);
}
put(main,source);
for(const file of ['package.json','package-lock.json']){
 const rel='electron-app/'+file,doc=JSON.parse(fs.readFileSync(path.join(stage,rel),'utf8'));
 doc.version='2.0.31';if(doc.packages)doc.packages[''].version=doc.version;
 put(rel,JSON.stringify(doc,null,2)+'\n');
}
for(const rel of ['EuroScopePlugIn.h','EuroScopePlugInDll.dll','EuroScopePlugInDll.lib'])put('SDK/'+rel,fs.readFileSync(path.join(root,'SDK',rel)));
for(const rel of ['PreferredCYYZPdcPlugin.json','EuroScopePlugInDll.dll','PDCBridge.ini','pdc_request.wav','cpdlc_rx.wav','IFR_release.wav','DEPARTURE_LIST_SETUP.md','Tunnel/cloudflared.exe','Tunnel/LICENSE-cloudflared.txt','TrackAudioTap140/out/afv_native.dll','TrackAudioTap/out/afv_native.dll','TrackAudioTapStable/out/afv_native.dll'])
 put('build/'+rel,fs.readFileSync(path.join(root,'build',rel)));
fs.symlinkSync(path.join(root,'electron-app/node_modules'),path.join(stage,'electron-app/node_modules'),'junction');
assert(!fs.readFileSync(path.join(stage,'electron-app/src/training-jet-profile.js'),'utf8').includes('highProp'));
console.log(stage);
