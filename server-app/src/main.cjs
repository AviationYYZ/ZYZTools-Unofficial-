const {app,BrowserWindow,ipcMain,dialog,clipboard,shell,Tray,Menu,nativeImage,powerSaveBlocker}=require('electron');
const path=require('node:path'),fs=require('node:fs'),{ServerManager}=require('./manager.cjs');
// Keep the existing user-data folder and installer identity during the rename.
app.setName('ZYZTools Server');app.setPath('userData',path.join(app.getPath('appData'),'ZYZTools Server test'));
let manager,hub,window,tray,quitting=false,blocked,updater,updateTimer;
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',()=>{window?.show();window?.focus();});
 function show(){window.show();window.focus();}
 app.whenReady().then(async()=>{
  const helper=app.isPackaged?path.join(process.resourcesPath,'tunnel'):path.join(__dirname,'../../build/Tunnel');
  manager=new ServerManager(app.getPath('userData'),helper);
  manager.loadDefaults();
  hub=new (require('./instructor.cjs').InstructorHub)(manager,helper);
  window=new BrowserWindow({width:1130,height:850,minWidth:730,minHeight:520,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',e=>e.preventDefault());window.removeMenu();
  window.on('close',e=>{if(!quitting){e.preventDefault();window.hide();}});
  // A tiny local icon; no network or remote assets in the management UI.
  const icon=nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==');
  tray=new Tray(icon);tray.setToolTip('ZYZTools Server');tray.setContextMenu(Menu.buildFromTemplate([{label:'Open server dashboard',click:show},{label:'Stop all servers and exit',click:()=>app.quit()}]));tray.on('double-click',show);
  blocked=powerSaveBlocker.start('prevent-app-suspension');
  ipcMain.handle('server:action',async(event,action,id,value)=>{
   if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw Error('Invalid sender.');
   if(action==='status')return {...manager.status(),instructor:hub.status(),updateStatus:updater?.message||'Stable automatic updates are enabled in installed builds.'};
   if(manager.updating)throw Error('Server update is installing. Try again after restart.');
   if(action==='instructorEnable'){await hub.start();manager.config.instructorEnabled=true;manager.save();return {...manager.status(),instructor:hub.status()};}
   if(action==='instructorDisable'){await hub.stop();manager.config.instructorEnabled=false;manager.save();return {...manager.status(),instructor:hub.status()};}
   if(action==='instructorCopy'){const s=hub.status();if(!s.code)throw Error('Wait for the instructor pairing code.');clipboard.writeText(s.code);return {...manager.status(),instructor:s};}
   if(action==='instructorWebApp'){const s=hub.status();if(!s.webApp)throw Error('Wait for instructor access to be ready.');clipboard.writeText(s.webApp);return {...manager.status(),instructor:s};}
   if(action==='startup'){if(typeof value!=='boolean')throw Error('Invalid startup setting.');app.setLoginItemSettings({openAtLogin:value});manager.config.startup=value;manager.save();return manager.status();}
   if(action==='configure')return manager.configure(id,value||{});
   if(action==='updateRate')return manager.updateRate(id,value);
   if(action==='speedProfile')return manager.speedProfile(id,value);
   if(action==='import'){
    const result=await dialog.showOpenDialog(window,{title:'Import compiled ZYZTools scenario',filters:[{name:'ZYZTools scenario',extensions:['json']}],properties:['openFile']});
    if(!result.canceled){const file=result.filePaths[0];if(fs.statSync(file).size>4*1024*1024)throw Error('Scenario exceeds 4 MB.');manager.import(id,JSON.parse(fs.readFileSync(file,'utf8')));}return manager.status();
   }
   if(action==='demo'){manager.import(id,require('./engine.cjs')('training-demo.json'));return manager.status();}
   if(action==='start')return manager.start(id);
   if(action==='stop')return manager.stop(id);
   if(['run','pause','reset'].includes(action))return manager.action(id,action);
   if(action==='restart'){await manager.stop(id);return manager.start(id);}
   if(action==='copyCode'){const s=manager.status().slots.find(s=>s.id===id);if(!s?.code)throw Error('Wait for a connection code.');clipboard.writeText(s.code);return manager.status();}
   if(action==='copyInvite'){clipboard.writeText(await manager.call(id,'invite'));return manager.status();}
   if(action==='panel'){await shell.openExternal(await manager.call(id,'invite'));return manager.status();}
   if(action==='logs'){await shell.openPath(manager.dir(id));return manager.status();}
   throw Error('Unsupported action.');
  });
  await window.loadFile(path.join(__dirname,'index.html'));show();
  if(manager.config.instructorEnabled)await hub.start();
  await manager.autostart();
  if(app.isPackaged){
   if(manager.config.startup)app.setLoginItemSettings({openAtLogin:true});
   const idle=()=>!quitting&&!manager.updating&&manager.slots.every(s=>!s.child&&!s.desired&&['stopped','error'].includes(s.state));
   updater=new (require('./auto-updates.cjs').ServerUpdater)({version:app.getVersion(),folder:app.getPath('userData'),idle,install:async installer=>{
    if(!idle())return;
    manager.updating=true;
    try{
     const child=require('node:child_process').spawn(installer,['/S','--updated','--force-run'],{detached:true,windowsHide:true,stdio:'ignore'});
     await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
     child.unref();app.quit();
    }catch(e){manager.updating=false;throw e;}
   }});
   updateTimer=setInterval(()=>updater.tick(),15000);updater.tick();
  }
 }).catch(e=>{dialog.showErrorBox('ZYZTools Server could not start',e.message);app.exit(1);});
 app.on('before-quit',e=>{if(!manager||quitting)return;e.preventDefault();quitting=true;clearInterval(updateTimer);Promise.all([hub?.stop(),manager.shutdown()]).finally(()=>{if(blocked!==undefined)powerSaveBlocker.stop(blocked);tray?.destroy();app.quit();});});
 app.on('window-all-closed',()=>{});
}
