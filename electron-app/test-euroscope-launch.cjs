const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events');
const {normalize,rectangle,launch,withAsr}=require('./src/euroscope-launch');
const {DllGuard}=require('./src/euroscope-runtime');
test('launch profiles use literal arguments and independent monitor layouts',async()=>{
 const preset={id:'test-preset',name:'Training',windows:[{profile:'C:\\EuroScope Files\\Session One.prf',orientation:'left',display:'1'},{profile:'D:\\Radar\\Second.prf',orientation:'bottom',display:'2'}]};
 const config=normalize({exe:'C:\\Program Files (x86)\\EuroScope\\EuroScope.exe',presets:[preset],selected:preset.id});
 const started=[],prepared=[],displayA={id:1,workArea:{x:0,y:0,width:1921,height:1000}},displayB={id:2,workArea:{x:-1200,y:20,width:1200,height:900}};
 const result=await launch(config,preset.id,{exists:()=>true,screen:{getAllDisplays:()=>[displayA,displayB],getPrimaryDisplay:()=>displayA},
  spawn(exe,args,options){started.push({exe,args,options});const child=new EventEmitter();child.pid=100+started.length;child.unref=()=>{};queueMicrotask(()=>child.emit('spawn'));return child;},
  prepare(profile,asr,layout){prepared.push({profile,asr,layout});return profile;}});
 assert.equal(result.opened,2);assert.deepEqual(result.warnings,[]);
 assert.deepEqual(started.map(x=>x.args),preset.windows.map(w=>[w.profile]));
 assert.deepEqual(prepared.map(x=>x.layout),[{monitor:0,position:1,maximized:false},{monitor:1,position:4,maximized:false}]);
 await assert.rejects(launch(config,preset.id,{exists:p=>!p.endsWith('Second.prf'),spawn:()=>assert.fail('Must validate all profiles before opening a window')}),/no longer exists/);
 assert.throws(()=>normalize({...config,presets:[{...preset,windows:[{...preset.windows[0],profile:'https://example.com/a.prf'}]}]}),/local/);
 assert.deepEqual(rectangle(displayA.workArea,'rightTwoThirds'),{x:640,y:0,width:1281,height:1000});
 assert.deepEqual(rectangle(displayB.workArea,'middleThird'),{x:-800,y:20,width:400,height:900});
 assert.deepEqual(rectangle(displayB.workArea,'bottomThird'),{x:-1200,y:620,width:1200,height:300});
});
test('ASR selection writes an isolated launch profile and preserves the original',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-asr-profile-')),file=path.join(dir,'Source.prf');
 try{
  const original='Settings\tsector\t\\Toronto.sct\r\nRecentFiles\tRecent1\t\\Old.asr\r\nRecentFiles\tRecent2\t\\Other.asr\r\n';
  fs.writeFileSync(file,original,'latin1');
  const target=withAsr(file,'C:\\Radar\\Arrival 24.asr');
  assert.notEqual(target,file);assert.equal(path.dirname(target),dir);
  assert.equal(fs.readFileSync(file,'latin1'),original);
  assert.equal(fs.readFileSync(target,'latin1'),original.replace('\\Old.asr','C:\\Radar\\Arrival 24.asr'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('layout goes into a separate EuroScope SCREEN settings file, not a Win32 resize',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-native-layout-')),profile=path.join(dir,'Source.prf'),screen=path.join(dir,'Screen layout.txt');
 try{
  const prf='Settings\tSettingsfileSCREEN\t\\Screen layout.txt\r\n',original='m_ScreenNumber:0\r\nm_ScreenPosition:5\r\nm_ScreenMaximized:1\r\notherSetting:77\r\n';
  fs.writeFileSync(profile,prf);fs.writeFileSync(screen,original);
  const launchProfile=withAsr(profile,'',{monitor:1,position:9,maximized:false});
  assert.equal(fs.readFileSync(profile,'utf8'),prf);
  assert.equal(fs.readFileSync(screen,'utf8'),original);
  assert.equal(fs.readFileSync(launchProfile,'utf8'),'Settings\tSettingsfileSCREEN\t\\'+path.basename(launchProfile)+'.screen.txt\r\n');
  assert.equal(fs.readFileSync(launchProfile+'.screen.txt','utf8'),'m_ScreenNumber:1\r\nm_ScreenPosition:9\r\nm_ScreenMaximized:0\r\notherSetting:77\r\n');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('two windows using the same profile get distinct launch copies and positions',async()=>{
 const profile='C:\\Radar\\Shared.prf',preset={id:'shared-preset',name:'Two windows',windows:[{profile,display:'primary',orientation:'leftThird'},{profile,display:'primary',orientation:'rightTwoThirds'}]};
 const opened=[],layouts=[],workArea={x:0,y:0,width:1500,height:900};
 const result=await launch({exe:'C:\\Radar\\EuroScope.exe',presets:[preset]},preset.id,{
  exists:()=>true,screen:{getAllDisplays:()=>[],getPrimaryDisplay:()=>({workArea})},
  prepare(p,_asr,layout){assert.equal(p,profile);layouts.push(layout);return 'C:\\Radar\\Copy'+opened.length+'.prf';},
  spawn(_exe,args){opened.push(args[0]);const child=new EventEmitter();child.pid=opened.length;child.unref=()=>{};queueMicrotask(()=>child.emit('spawn'));return child;},
 });
 assert.equal(result.opened,2);assert.notEqual(opened[0],opened[1]);
 assert.deepEqual(layouts,[{monitor:0,position:5,maximized:false},{monitor:0,position:9,maximized:false}]);
});
test('open EuroScope blocks a missing or mismatched DLL and accepts the bundled DLL',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-dll-check-')),payload=path.join(root,'payload'),installed=path.join(root,'installed');
 try{
  fs.mkdirSync(payload);fs.mkdirSync(installed);
  const dll='PreferredCYYZPdcPlugin.dll',expected=path.join(payload,dll),target=path.join(installed,dll);
  fs.writeFileSync(expected,'new');let active=true;
  const guard=new DllGuard({payload:()=>payload,version:'2.0.0',running:async()=>active});
  assert.equal((await guard.check(installed)).blocked,true);
  fs.writeFileSync(target,'older DLL');
  assert.equal((await guard.check(installed)).blocked,true);
  fs.writeFileSync(target,'new');
  assert.equal((await guard.check(installed)).blocked,false);
  fs.writeFileSync(target,'different');active=false;
  assert.equal((await guard.check(installed,true)).blocked,false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
