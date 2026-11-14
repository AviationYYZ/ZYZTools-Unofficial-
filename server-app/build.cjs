// Stage outside OneDrive; never scan/archive the full workspace or credentials.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const version=require('./package.json').version,root=path.resolve(__dirname,'..'),stage=path.join(process.env.LOCALAPPDATA,'ZYZTools','ServerBuild',version),output=path.join(process.env.LOCALAPPDATA,'ZYZTools','Builds','server-'+version);
fs.mkdirSync(stage,{recursive:true});fs.cpSync(path.join(__dirname,'src'),path.join(stage,'src'),{recursive:true});fs.copyFileSync(path.join(__dirname,'package.json'),path.join(stage,'package.json'));
const modules=['training-weather.js','training-jet-profile.js','training-restrictions.js','local-training.js','training-pilot-tags.js','training-coordination.js','training-flight.js','training-routes.js','training-navdata.js','training-commands.js','training-speed-data.js','training-performance.js','training-performance.txt','training-performance-license.txt','training-multiplayer.js','training-fsd-tunnel.js','training-tunnel.js','training-tunnel-release.json','training-invite.js','training-directory.js','training-multiplayer.html','training-multiplayer.css','training-multiplayer-client.js','training-browser-controls.js','training-demo.json'];
fs.mkdirSync(path.join(stage,'src','engine'),{recursive:true});for(const file of modules)fs.copyFileSync(path.join(root,'electron-app/src',file),path.join(stage,'src/engine',file));
fs.copyFileSync(path.join(root,'electron-app/src/training-speed-editor.js'),path.join(stage,'src/engine/training-speed-editor.js'));
fs.copyFileSync(path.join(root,'electron-app/src/controller-calculators.js'),path.join(stage,'src/pwa/controller-calculators.js'));
fs.copyFileSync(path.join(root,'electron-app/src/training-route-variants.json'),path.join(stage,'src/engine/training-route-variants.json'));
fs.copyFileSync(path.join(root,'electron-app/src/training-prop-stars.json'),path.join(stage,'src/engine/training-prop-stars.json'));
fs.copyFileSync(path.join(root,'electron-app/src/github-updates.js'),path.join(stage,'src/engine/github-updates.js'));
for(const file of ['aeroview-reader.cjs','aeroview-observation.cjs','training-hold.js'])fs.copyFileSync(path.join(root,'electron-app/src',file),path.join(stage,'src/engine',file));
fs.mkdirSync(path.join(stage,'src/default-scenarios'),{recursive:true});
for(let i=1;i<=4;i++)fs.copyFileSync(path.join(root,'scenarios/FL110/CYYZ-West-70-Default-'+i+'-FL110.json'),path.join(stage,'src/default-scenarios','west70-'+i+'.json'));
const release=require('../electron-app/src/training-tunnel-release.json'),helper=path.join(root,'build/Tunnel/cloudflared.exe');
if(require('node:crypto').createHash('sha256').update(fs.readFileSync(helper)).digest('hex')!==release.sha256)throw Error('Bundled tunnel helper checksum mismatch.');
const config={...require('./package.json').build,directories:{app:stage,output},electronVersion:require('../electron-app/node_modules/electron/package.json').version,extraResources:[{from:helper,to:'tunnel/cloudflared.exe'},{from:path.join(root,'build/Tunnel/LICENSE-cloudflared.txt'),to:'tunnel/LICENSE-cloudflared.txt'},{from:path.join(root,'docs/THREE_SERVER_SETUP.md'),to:'THREE_SERVER_SETUP.md'}]};
const builder=require('../electron-app/node_modules/electron-builder');builder.build({projectDir:stage,config,targets:builder.Platform.WINDOWS.createTarget(['nsis'],builder.Arch.ia32),publish:'never'}).then(()=>console.log('Local test installer: '+output)).catch(e=>{console.error(e);process.exitCode=1;});
