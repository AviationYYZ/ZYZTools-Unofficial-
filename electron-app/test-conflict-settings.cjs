const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const settings=require('./src/conflict-settings');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-conflict-settings-'));
try{
 assert.equal(settings.load(dir).enabled,false);
 assert.equal(settings.snapshot(dir).alerts.length,0);
 const result=settings.save(dir,{enabled:true,sequencing:true,leader:'aca123',follower:'wja456',mergeFix:'verko',arrivalAirports:'cyyz CYTZ CYYZ'});
 assert.equal(result.leader,undefined);assert.equal(result.sequencing,undefined);assert.equal(result.arrivalAirports,'CYYZ,CYTZ');
 assert.deepEqual(settings.load(dir),result);
 for(const input of [{arrivalAirports:'INVALID'}])assert.throws(()=>settings.save(dir,input));
 fs.writeFileSync(path.join(dir,'ZYZToolsConflictStatus.json'),JSON.stringify({ts:Date.now()/1000,status:'Active',alerts:[],aircraft:[],recommendations:[]}));
 assert.equal(settings.snapshot(dir).status,'Active');
 fs.writeFileSync(path.join(dir,'ZYZToolsConflictStatus.json'),JSON.stringify({ts:1,status:'Active',recommendations:[{text:'STALE'}]}));
 assert.equal(settings.snapshot(dir).recommendations.length,0);
 const source=fs.readFileSync('../src/ZYZToolsPlugin.cpp','utf8');
 assert.equal((source.match(/: CPlugIn\(/g)||[]).length,1);
 assert(source.includes('m_conflict->OnTimer(Counter)'));
 assert(source.includes('m_conflict->OnGetTagItem'));
 assert(source.includes('m_conflict.reset()'));
 assert(!fs.readFileSync('../src/conflict/ConflictModule.h','utf8').includes('class Plugin:public CPlugIn'));
 console.log('PASS: conflict settings round-trip, validation, stale snapshot rejection and one united CPlugIn instance.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
