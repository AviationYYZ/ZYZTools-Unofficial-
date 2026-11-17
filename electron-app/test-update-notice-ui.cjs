const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const renderer=fs.readFileSync(require.resolve('./src/renderer'),'utf8');
const ui=renderer.slice(renderer.indexOf('let offeredUpdate,'),renderer.indexOf('async function publishBeta'));
test('global update notice dismisses a release and essential download never starts installation',async()=>{
 const elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{value:'stable',style:{setProperty(){}},addEventListener(name,fn){this[name]=fn;}});return elements.get(id);};
 let next={tag:'v1.2.74',available:true,essential:false,message:'Optional update'};
 const downloads=[],installs=[];
 const context=vm.createContext({$,window:{},api:{checkUpdates:async()=>next,downloadUpdate:async tag=>{downloads.push(tag);return next;},installStagedUpdate:async tag=>{installs.push(tag);return {installing:false};} }});
 vm.runInContext(ui,context);
 await vm.runInContext('checkUpdates()',context);
 assert.equal($('updateNotice').hidden,false);
 assert.match($('updateNoticeText').textContent,/v1.2.74/);
 assert.match($('updateNoticeText').textContent,/will close to install/);
 $('updateNoticeDismiss').click();
 await vm.runInContext('checkUpdates(true)',context);
 assert.equal($('updateNotice').hidden,true);
 assert.equal($('installUpdateBtn').hidden,false);
 next={tag:'v1.2.75',available:true,essential:true,message:'Essential update'};
 await vm.runInContext('checkUpdates(true)',context);
 assert.equal($('updateNotice').hidden,false);
 assert.match($('updateNoticeText').textContent,/next time you open/);
 await $('updateNoticeDownload').click();
 assert.deepEqual(downloads,['v1.2.75']);
 assert.equal($('updateNoticeDownload').disabled,false);
 assert.equal($('updateNoticeDownload').textContent,'Install now');
 assert.deepEqual(installs,[]);
 assert.match($('updateNoticeText').textContent,/downloaded.*next time you open/);
 $('pauseAutomaticUpdates').checked=true;
 vm.runInContext('renderUpdateNotice()',context);
 assert.match($('updateNoticeText').textContent,/Automatic updates are paused/);
 assert.doesNotMatch($('updateNoticeText').textContent,/next time you open/);
 await $('updateNoticeDownload').click();
 assert.deepEqual(installs,['v1.2.75']);
});
test('download IPC launches only optional installers, and quits only after successful launch',async()=>{
 const main=fs.readFileSync(require.resolve('./src/main'),'utf8');
 const code=main.slice(main.indexOf('let updateDownloadInProgress'),main.indexOf('guarded("plugin:action"'));
 let opened=0,quit=0,downloaded=0,error='',response=0;
 const handlers={};
 const context=vm.createContext({guarded(name,fn){handlers[name]=fn;},
  channel:{test:false},checkedRelease:{available:true,tag:'v1.2.76',essential:true},updateFolder:()=>'/updates',
  updates:{async download(){downloaded++;return '/updates/setup.exe';},essentialInstallerArgs:()=>['--updated','--force-run']},shell:{async openPath(){opened++;return error;}},
  childProcess:{spawn(_path,args){assert.equal(args[1],'--force-run');opened++;return {once(name,fn){if(name==='spawn')fn();},unref(){}};}},
  app:{quit(){quit++;}},setImmediate:fn=>fn(),mainWindow:{},dialog:{async showMessageBox(){return {response};}}});
 vm.runInContext(code,context);
 const handler=handlers['updates:download'],staged=handlers['updates:installStaged'];
 await assert.rejects(staged(null,'v1.2.76'),/Download/);
 const event={sender:{isDestroyed:()=>false,send(){}}};
 await handler(event,'v1.2.76');
 assert.deepEqual([downloaded,opened,quit],[1,0,0]);
 assert.equal((await staged(null,'v1.2.76')).installing,false);
 assert.deepEqual([downloaded,opened,quit],[1,0,0]);
 response=1;
 assert.equal((await staged(null,'v1.2.76')).installing,true);
 assert.deepEqual([downloaded,opened,quit],[2,1,1]);
 context.checkedRelease.essential=false;
 error='Installer blocked';
 await assert.rejects(handler(event,'v1.2.76'),/Installer blocked/);
 assert.equal(quit,1);
 error='';
 await handler(event,'v1.2.76');
 assert.deepEqual([downloaded,opened,quit],[4,3,2]);
});
