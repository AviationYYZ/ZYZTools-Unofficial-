const {app,BrowserWindow}=require('electron'),assert=require('node:assert/strict'),os=require('node:os'),fs=require('node:fs'),path=require('node:path');
const {InstructorHub}=require('../server-app/src/instructor.cjs');
const {LocalTraining}=require('./src/local-training');
app.whenReady().then(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-pwa-ui-')),sim=new LocalTraining();
 sim.load(require('./src/training-demo.json'));
 const slot={id:1,name:'Private fixture',epoch:'fixture-epoch',state:'paused',clients:0};
 const manager={folder,slot:()=>slot,status:()=>({slots:[slot]}),call:async(_id,_action,args)=>{
  if(args.operation==='command'){assert.equal(args.sessionId,sim.sessionId);sim.command(args.callsign,args.command);}
  if(args.operation==='amend'){assert.equal(args.sessionId,sim.sessionId);sim.amend(args.callsign,args.fields);}
  return {...sim.status(),runways:[],instructorJournal:[]};
 }};
 const tunnel={status:()=>({state:'ready',url:'https://synthetic.trycloudflare.com',running:true}),stop(){}};
 const hub=new InstructorHub(manager,folder,{port:0,tunnel,lease:{status:()=>({code:'ABCDE-FG234'}),stop:async()=>{}}});hub.network=async()=>{};
 let w;
 try{
  await hub.start();
  w=new BrowserWindow({width:390,height:844,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  await w.loadURL('http://127.0.0.1:'+hub.port+'/instructor/');
  const js=s=>w.webContents.executeJavaScript(s);
  const until=async s=>{for(let i=0;i<50;i++){if(await js(s))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+s);};
  await until('navigator.serviceWorker.controller !== null');
  await js("document.querySelector('[data-page=tools]').click()");
  assert.equal(await js("document.querySelectorAll('.calculator-card').length"),7);
  assert.equal(await js("document.documentElement.scrollWidth <= innerWidth"),true);
  await js("document.querySelector('[data-page=traffic]').click();document.getElementById('code').value='ABCDE-FG234';document.querySelector('#pairForm button').click()");
  await until("document.querySelector('#roster button') !== null");
  assert.match(await js("document.getElementById('sessionState').textContent"),/paused/);
  await js("window.confirm=()=>true;document.querySelector('#roster button').click();document.getElementById('instruction').value='ALT 5000';document.getElementById('sendInstruction').click()");
  await until("document.getElementById('aircraftNotice').textContent.includes('Accepted')");
  assert.equal(sim.aircraft.find(a=>a.callsign==='TEST101').targetAltitude,5000);
  await until("!document.getElementById('sendRoute').disabled");
  await js("document.getElementById('routeForm').closest('details').open=true;document.getElementById('runway').value='36C';document.getElementById('sendRoute').click()");
  await until("document.getElementById('aircraftDetails').textContent.includes('36C')");
  assert.equal(sim.aircraft.find(a=>a.callsign==='TEST101').arrivalRunway,'36C');
  assert.match(await js("document.getElementById('aircraftDetails').textContent"),/No simulated runway geometry/);
  assert.match(await js("document.getElementById('filedRoute').value"),/CYYZ\/36C$/);
  await js("document.getElementById('runway').value='18L';document.getElementById('sendRoute').click()");
  await until("document.getElementById('aircraftDetails').textContent.includes('18L')");
  await js("document.getElementById('closeAircraft').click();document.getElementById('disconnect').click()");
  assert.equal(await js("document.getElementById('pairForm').hidden"),false);
  assert.equal(await js("localStorage.length + sessionStorage.length"),0);
  const paths=await js("(async()=>{const names=await caches.keys();const cache=await caches.open(names.find(n=>n.startsWith('zyz-instructor-shell-')));return (await cache.keys()).map(r=>new URL(r.url).pathname)})()");
  assert(paths.length>=7);assert(paths.every(p=>p.startsWith('/instructor/')&&!p.includes('/pair')));
  console.log('PASS: phone-width instructor PWA, offline shell, seven tools, pairing, selected-aircraft command, and no persisted credentials.');
 }finally{w?.destroy();await hub.stop();fs.rmSync(folder,{recursive:true,force:true});}
}).then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1);});
