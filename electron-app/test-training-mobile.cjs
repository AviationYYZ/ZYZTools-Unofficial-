const {app,BrowserWindow}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{LocalTraining}=require('./src/local-training'),{TrainingMultiplayer}=require('./src/training-multiplayer');
app.whenReady().then(async()=>{const s=new LocalTraining(),panel=new TrainingMultiplayer(s,0);let w;
 try{
  s.load(require('./src/training-demo.json'));await s.start(17941);s.run();await panel.start();
  w=new BrowserWindow({show:false,width:390,height:844,webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  const errors=[];w.webContents.on('console-message',(_e,level,message)=>{if(level>=3)errors.push(message);});
  await w.loadURL(panel.status().url+'/#zyz='+panel.token);const js=t=>w.webContents.executeJavaScript(t),wait=()=>new Promise(r=>setTimeout(r,350));await wait();
  assert.equal(await js("document.querySelectorAll('#aircraft tr').length"),2);
  for(const width of [320,390,430,768,1280]){
   w.setContentSize(width,844);await wait();
   const size=await js(`({width:innerWidth,scroll:document.documentElement.scrollWidth,controls:document.getElementById('controls').getBoundingClientRect().width,minimum:Math.min(...[...document.querySelectorAll('button,input,select')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().height))})`);
   assert(size.scroll<=size.width+1,'No page overflow at '+width+': '+JSON.stringify(size));assert(size.minimum>=44,'Touch targets at '+width);
  }
  w.setContentSize(390,844);await wait();await js("document.querySelector('#aircraft tr').click();document.getElementById('command').value='LHDG 330, ALT 3000';document.getElementById('send').click()");await wait();
  assert.equal(s.aircraft[0].targetAltitude,3000);assert.equal(s.aircraft[0].turnDirection,-1);assert.equal(await js("document.getElementById('command').value"),'');
  const previous=s.aircraft[0].targetAltitude;await js("document.getElementById('command').value='ALT 2000, DCT MISSING';document.getElementById('send').click()");await wait();assert.equal(s.aircraft[0].targetAltitude,previous);assert.equal(await js("document.getElementById('command').value"),'ALT 2000, DCT MISSING');
  await js("document.getElementById('edit').click();document.getElementById('fp_remarks').value='Mobile control test';document.getElementById('save').click()");await wait();assert.equal(s.aircraft[0].remarks,'Mobile control test');
  const screenshot=path.join(process.env.LOCALAPPDATA,'ZYZTools/Builds/desktop-1.2.42/mobile-controls.png');fs.mkdirSync(path.dirname(screenshot),{recursive:true});await js("document.documentElement.style.scrollBehavior='auto';document.getElementById('controls').scrollIntoView({block:'start',behavior:'instant'})");await wait();assert(Math.abs(await js("document.getElementById('controls').getBoundingClientRect().top"))<20);fs.writeFileSync(screenshot,(await w.webContents.capturePage()).toPNG());
  assert.equal(await js('location.hash'),'');assert.equal(await js('localStorage.length'),0);assert(!errors.some(e=>/TypeError|ReferenceError|Uncaught/.test(e)),errors.join('\n'));
  panel.readOnly=true;await new Promise(r=>setTimeout(r,1200));assert.equal(await js("document.getElementById('controls').getClientRects().length"),0);assert.equal(await js("document.querySelectorAll('#aircraft tr[tabindex]').length"),0);
  console.log('PASS: phone/tablet/desktop 320–1280px no overflow, 44px touch controls, tap selection, atomic batch commands, error retention, flight-plan edits, private invite removal and read-only student role. Screenshot: '+screenshot);
 }finally{w?.destroy();panel.stop();s.stop();}
}).then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1);});
