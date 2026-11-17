const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),asar=require('@electron/asar');
const {readDllVersion}=require('./src/euroscope-runtime');
const version=require('./package.json').version,serverVersion=require('../server-app/package.json').version;
const root=process.argv[2]||process.env.ZYZTOOLS_BUILD_OUTPUT||path.resolve(__dirname,'../installer/dist');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const serverName='ZYZTools-Server-Setup-'+serverVersion+'.exe';
const serverRoot=path.join(process.env.LOCALAPPDATA,'ZYZTools/Builds/server-'+serverVersion);
assert.equal(serverVersion,version);
for(const kind of ['production','test']){
 const resources=path.join(root,kind,'win-ia32-unpacked','resources'),archive=path.join(resources,'app.asar');
 const file=(...parts)=>asar.extractFile(archive,path.join(...parts)).toString();
 const pkg=JSON.parse(file('package.json')),main=file('src','main.js'),html=file('src','index.html');
 assert.equal(pkg.version,version);assert.equal(pkg.zyzBuildChannel,kind);
 const dll=fs.readFileSync(path.join(resources,'plugin','PreferredCYYZPdcPlugin.dll'));
 assert.equal(readDllVersion(dll),version);
 for(const id of ['wxRange','wxMode','wxAltitude','wxRain','wxLightning','pauseAutomaticUpdates','arrivalAssignmentEnabled','trainingMap','publishPriority','publishStream','updateStream'])assert(html.includes('id="'+id+'"'),id);
 for(const feature of ['radar:weatherSettings','updates:preferences','statistics:list','training:action','audioReplay:command'])assert(main.includes(feature),feature);
 assert(file('src','renderer.js').includes('applyWeatherControls'));
 assert.equal(JSON.parse(file('src','training-prop-stars.json')).procedures.length,30);
 assert(!asar.listPackage(archive).some(name=>/(?:\.env|ai-sequencing\.js|chatgpt-plan\.js|openai-key\.bin|training-sector\.json)$/i.test(name)));
 const snapshot=JSON.parse(fs.readFileSync(path.join(resources,'TestSourceSnapshot.json')));
 assert.equal(snapshot.version,version);
 assert.equal(JSON.parse(snapshot.files.find(f=>f.path==='server-app/package.json').content).version,serverVersion);
 if(kind==='test'){
  assert.equal(hash(path.join(resources,'Publishing','ZYZTools-Setup.exe')),hash(path.join(root,'production','ZYZTools-Setup.exe')));
  assert.equal(hash(path.join(resources,'Publishing',serverName)),hash(path.join(serverRoot,serverName)));
 }
}
const serverArchive=path.join(serverRoot,'win-ia32-unpacked/resources/app.asar');
assert.equal(JSON.parse(asar.extractFile(serverArchive,'package.json')).version,serverVersion);
assert.equal(JSON.parse(asar.extractFile(serverArchive,path.join('src','engine','training-prop-stars.json'))).procedures.length,30);
console.log('PASS: release candidate app/DLL/server versions, channel separation, weather and update controls, prop data, and installer hashes.');
