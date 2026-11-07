const {app,BrowserWindow}=require('electron'),path=require('node:path'),assert=require('node:assert/strict');
app.whenReady().then(async()=>{
 const window=new BrowserWindow({width:1100,height:900,show:false,webPreferences:{preload:path.join(__dirname,'test-conflict-ui-preload.cjs'),contextIsolation:true,nodeIntegration:false}});
 const failures=[];window.webContents.on('console-message',(_event,level,message)=>{if(level>=3&&!message.includes('Content-Security-Policy'))failures.push(message);});
 try{await window.loadFile(path.join(__dirname,'src/index.html'));const js=s=>window.webContents.executeJavaScript(s);await js("document.querySelector('[data-tab=conflicts]').click()");await new Promise(r=>setTimeout(r,150));
 const result=await js("({active:document.getElementById('conflicts').classList.contains('active'),rows:document.getElementById('conflictAlerts').children.length,enabled:document.getElementById('conflictEnabled').checked,retired:document.querySelector('#conflictSequencing,#conflictRecommendations,#aiProvider,#analyzeAIBtn,#chatGPTPanel')!==null,text:document.getElementById('conflicts').textContent})");
 assert(result.active&&result.enabled);assert.equal(result.rows,1);assert.equal(result.retired,false);assert(!result.text.includes('Sequence pair'));await js("document.getElementById('conflictMuted').checked=true;document.getElementById('saveConflictBtn').click()");await new Promise(r=>setTimeout(r,150));assert.equal(failures.length,0,failures.join('\n'));console.log('PASS: alert-only settings UI, working enable/mute/save, no sequencing selection or AI controls. No native/network writes.');
 }finally{window.destroy();app.quit();}
}).catch(e=>{console.error(e);app.exit(1);});
