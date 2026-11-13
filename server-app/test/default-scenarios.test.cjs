const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {ServerManager}=require('../src/manager.cjs');
test('the four west-flow defaults seed empty slots without overwriting a saved scenario',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-default-slots-')),defaults=path.join(folder,'fixtures');
 try{
  fs.mkdirSync(defaults);
  for(let i=1;i<=4;i++)fs.copyFileSync(path.join(__dirname,'../../scenarios/FL110/CYYZ-West-70-Default-'+i+'-FL110.json'),path.join(defaults,'west70-'+i+'.json'));
  const manager=new ServerManager(path.join(folder,'server'),folder);
  const demo={...require('../../electron-app/src/training-demo.json'),name:'User scenario'};
  manager.import(2,demo);
  manager.loadDefaults(defaults);manager.loadDefaults(defaults);
  const slots=manager.status().slots;
  assert.equal(slots[1].scenarioName,'User scenario');
  for(const id of [1,3,4]){const s=JSON.parse(fs.readFileSync(path.join(manager.dir(id),'scenario.json')));assert.equal(s.aircraft.length,70);assert(s.aircraft.every(a=>['23','24R'].includes(a.arrivalRunway)&&a.altitude===11000));assert(!s.jetSpeedProfile);}
  assert(!slots[4].hasScenario&&!slots[5].hasScenario);
  assert(slots.every(s=>s.state==='stopped'));
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
