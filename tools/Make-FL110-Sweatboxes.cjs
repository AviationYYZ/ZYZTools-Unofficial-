'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {LocalTraining}=require('../electron-app/src/local-training');
const source=path.resolve(__dirname,'../scenarios'),target=path.join(source,'FL110');
const plans=[];
for(const name of fs.readdirSync(source).filter(x=>x.endsWith('.json'))){
 const original=JSON.parse(fs.readFileSync(path.join(source,name),'utf8'));
 if(!Array.isArray(original.aircraft)||!original.aircraft.length)continue;
 const scenario={...original,name:'FL110 | '+original.name,aircraft:original.aircraft.map(a=>({...a,altitude:11000}))};
 const sim=new LocalTraining();sim.load(scenario);
 assert(sim.aircraft.every(a=>a.altitude===11000),name);
 for(const aircraft of scenario.aircraft){
  const one=new LocalTraining();one.load({...scenario,aircraft:[aircraft]});
  // Sample the first instant at its scheduled spawn without fast-forwarding.
  one.elapsed=one.aircraft[0].spawnTime;
  one.tick(.001);
  assert.equal(Math.round(one.aircraft[0].altitude),11000,name+' '+aircraft.callsign);
 }
 plans.push({name:name.slice(0,-5)+'-FL110.json',scenario});
}
fs.mkdirSync(target,{recursive:true});
for(const {name,scenario} of plans)fs.writeFileSync(path.join(target,name),JSON.stringify(scenario,null,2)+'\n');
console.log('Validated '+plans.length+' FL110 scenarios ('+plans.reduce((n,p)=>n+p.scenario.aircraft.length,0)+' aircraft).');
