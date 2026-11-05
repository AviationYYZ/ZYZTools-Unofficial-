const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const model=require('./src/training-pilot-tags'),{LocalTraining}=require('./src/local-training');
test('private conflict telemetry reports actual approach state, independent of student labels and instructor order history',()=>{
 const sim=new LocalTraining();sim.load(require('../scenarios/CYYZ-West-65-15NM-VERKO-Challenge-C.json'));const callsign=sim.aircraft[0].callsign,peer={controller:'PRIVATE_CTR'},orders=new Map();
 function row(){return model.rows(sim.status(),peer,orders)[0].split('|');}
 assert.equal(row().length,48);assert.equal(row()[43],'0');assert(Number.isFinite(Number(row()[41])));
 sim.command(callsign,'APP CLEAR');assert.equal(row()[43],'1');assert.equal(row()[21],'-','No own-order history should be necessary');
 sim.command(callsign,'APP CANCEL');assert.equal(row()[43],'0');
 const cpp=fs.readFileSync(path.join(__dirname,'../src/TrainingCommandBridge.h'),'utf8'),module=fs.readFileSync(path.join(__dirname,'../src/conflict/ConflictModule.h'),'utf8');
 assert(cpp.includes('parts.size()!=41&&parts.size()!=48'));assert(cpp.includes('PilotLayoutContext().empty()||!TrainingContext()'));assert(cpp.includes('a.approachCleared=tag.approachCleared'));assert(module.includes('if(trainingVerified)'));assert(module.includes('clearance==1||clearance==2'));assert(module.includes('if(cleared==1||cleared==2)return false;'));
});
