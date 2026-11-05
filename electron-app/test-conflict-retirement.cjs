const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('sequencing recommendations have no native runtime, UI, preload or IPC entry points',()=>{
 const main=read('electron-app/src/main.js'),preload=read('electron-app/src/preload.js'),ui=read('electron-app/src/index.html'),module=read('src/conflict/ConflictModule.h');
 assert(!main.includes("ipcMain.handle('ai:"));assert(!main.includes("ipcMain.handle('chatgpt:"));assert(!preload.includes('analyzeAI'));assert(!ui.includes('id="conflictSequencing"'));assert(!ui.includes('id="aiProvider"'));assert(!module.includes('ca::recommend'));assert(!module.includes('processAI'));
 assert(!read('tools/Build-Channel.ps1').includes('Sequencing.cpp'));
});
test('labels use only that aircraft filed fixes; yellow dots use the predicted geographic position',()=>{
 const module=read('src/conflict/ConflictModule.h'),plugin=read('src/ZYZToolsPlugin.cpp'),engine=read('src/conflict/Engine.h');assert(module.includes('ca::conflictLocation(v,found->filedRoute)'));assert(!module.includes('locationFixes'));assert(engine.includes('double nearest=3+1e-9'));assert(plugin.includes('DrawConflictPoints(hDC)'));assert(plugin.includes('ca::unproject(alert.point)'));assert(plugin.includes('RGB(255,230,0)'));assert(plugin.includes('drawn.insert(key)'));assert(module.includes('early=ca::scan(aircraft,config,runways,true)'));
});
