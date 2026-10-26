const {app,BrowserWindow,ipcMain,dialog,clipboard,shell,Tray,Menu,nativeImage,powerSaveBlocker}=require('electron');
const path=require('node:path'),fs=require('node:fs'),{ServerManager}=require('./manager.cjs');
app.setName('ZYZTools Server test');app.setPath('userData',path.join(app.getPath('appData'),'ZYZTools Server test'));
let manager,hub,window,tray,quitting=false,blocked;
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',()=>{window?.show();window?.focus();});
 function show(){window.show();window.focus();}
 app.whenReady().then(async()=>{
  const helper=app.isPackaged?path.join(process.resourcesPath,'tunnel'):path.join(__dirname,'../../build/Tunnel');
  manager=new ServerManager(app.getPath('userData'),helper);
  hub=new (require('./instructor.cjs').InstructorHub)(manager,helper);
  window=new BrowserWindow({width:1130,height:850,minWidth:730,minHeight:520,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',e=>e.preventDefault());window.removeMenu();
  window.on('close',e=>{if(!quitting){e.preventDefault();window.hide();}});
  // A tiny local icon; no network or remote assets in the management UI.
  const icon=nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==');
  tray=new Tray(icon);tray.setToolTip('ZYZTools Server test');tray.setContextMenu(Menu.buildFromTemplate([{label:'Open server dashboard',click:show},{label:'Stop all servers and exit',click:()=>app.quit()}]));tray.on('double-click',show);
  blocked=powerSaveBlocker.start('prevent-app-suspension');
  ipcMain.handle('server:action',async(event,action,id,value)=>{
   if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw Error('Invalid sender.');
   if(action==='status')return {...manager.status(),instructor:hub.status()};
   if(action==='instructorEnable'){await hub.start();manager.config.instructorEnabled=true;manager.save();return {...manager.status(),instructor:hub.status()};}
   if(action==='instructorDisable'){await hub.stop();manager.config.instructorEnabled=false;manager.save();return {...manager.status(),instructor:hub.status()};}
   if(action==='instructorCopy'){const s=hub.status();if(!s.code)throw Error('Wait for the instructor pairing code.');clipboard.writeText(s.code);return {...manager.status(),instructor:s};}
   if(action==='startup'){if(typeof value!=='boolean')throw Error('Invalid startup setting.');app.setLoginItemSettings({openAtLogin:value});manager.config.startup=value;manager.save();return manager.status();}
   if(action==='configure')return manager.configure(id,value||{});
   if(action==='chooseEuroScope'){const r=await dialog.showOpenDialog(window,{title:'Choose installed EuroScope.exe (server PC)',filters:[{name:'EuroScope executable',extensions:['exe']}],properties:['openFile']});if(!r.canceled)manager.setEuroScope(r.filePaths[0]);return manager.status();}
   if(action==='nativeSetup'){await shell.openPath(manager.nativeSetup(id).folder);return manager.status();}
   if(action==='launchNative'){const setup=await manager.launchNative(id);await dialog.showMessageBox(window,{type:'info',title:'Native EuroScope — local setup only',message:'EuroScope opened; it has NOT been connected automatically.',detail:'On this server PC choose Start simulator session, server '+setup.hostAddress+', Connect to VATSIM UNCHECKED. Use dummy credentials. Browse to '+setup.scenarioFile+'. Publish simulation data: To everyone. Connect manually. Instructor PCs leave Scenario empty.'});return manager.status();}
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
 }).catch(e=>{dialog.showErrorBox('ZYZTools Server could not start',e.message);app.exit(1);});
 app.on('before-quit',e=>{if(!manager||quitting)return;e.preventDefault();quitting=true;Promise.all([hub?.stop(),manager.shutdown()]).finally(()=>{if(blocked!==undefined)powerSaveBlocker.stop(blocked);tray?.destroy();app.quit();});});
 app.on('window-all-closed',()=>{});
}
