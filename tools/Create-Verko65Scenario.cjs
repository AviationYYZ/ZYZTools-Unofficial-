// Offline synthetic exercise. Emits an apply_patch payload; never connects to a network.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {LocalTraining,normalize,geometry}=require('../electron-app/src/local-training');
const {fleets}=require('./Create-Sfi65Scenario.cjs');
const stem='CYYZ-West-65-15NM-VERKO-Challenge-B';
function create({seedValue=2026110405,jetSpeedProfile,name}={}){
 const base=JSON.parse(fs.readFileSync(path.join(__dirname,'../scenarios/CYYZ-West-65-15NM-SFI-Instructor-Owned.json'),'utf8'));
 if(jetSpeedProfile)base.jetSpeedProfile=require('../electron-app/src/training-jet-profile').normalize(jetSpeedProfile);
 let seed=seedValue;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),used=new Set(base.aircraft.map(a=>a.callsign));
 const origins={ACA:['CYUL','CYVR','CYYC','CYOW'],ROU:['KMCO','KLAS'],JZA:['CYOW','CYQB','CYUL'],POE:['CYOW','CYHZ','KEWR'],WJA:['CYYC','CYEG','CYVR'],AAL:['KORD','KDFW','KCLT'],UAL:['KORD','KEWR','KDEN'],DAL:['KATL','KDTW','KMSP'],SKW:['KORD','KDTW'],KLM:['EHAM'],BAW:['EGLL'],AFR:['LFPG']};
 const aircraft=base.aircraft.map(a=>{
  const prefix=a.callsign.slice(0,3),fleet=fleets[prefix];let callsign;do{callsign=prefix+(100+Math.floor(rand()*8900));}while(used.has(callsign));used.add(callsign);
  const type=fleet.types[Math.floor(rand()*fleet.types.length)];return {...a,callsign,type,wake:['B789','B772','A359'].includes(type)?'H':'M',origin:origins[prefix][Math.floor(rand()*origins[prefix].length)],remarks:'/v/ SYNTHETIC WEST FLOW TRAINING '+a.procedures[0]};
 });
 const groups=Object.fromEntries(['LINNG3','NUBER6','BOXUM7','IMEBA9','RAGID6'].map(star=>[star,aircraft.filter(a=>a.procedures[0]===star)]));
 // Determine natural gate times using the exact current guidance/profile model.
 const gate=base.waypoints.find(w=>w.name==='VERKO'),gateTimes={};
 for(const star of ['LINNG3','NUBER6']){
  const sim=new LocalTraining();sim.load({...base,aircraft:[{...groups[star][0],spawnTime:0}]});let nearest={distance:Infinity,time:0};
  for(let t=0;t<1000;t++){sim.tick(1);const a=sim.aircraft[0];if(!a)break;const d=geometry(a,gate).distance;if(d<nearest.distance)nearest={distance:d,time:sim.elapsed};}
  gateTimes[star]=nearest.time;
 }
 const targets=[],delay=gateTimes.NUBER6-gateTimes.LINNG3;
 for(let cycle=0;cycle<5;cycle++){
  const shift=cycle*700,noise=Math.round((rand()-.5)*12),offset=cycle?noise:0;
  for(let j=0;j<4;j++)groups.LINNG3[cycle*4+j].spawnTime=Math.max(0,Math.round(delay+shift+j*180+(j?Math.round((rand()-.5)*12):offset)));
  for(let j=0;j<3;j++)groups.NUBER6[cycle*3+j].spawnTime=Math.max(0,Math.round(shift+j*240+(j?Math.round((rand()-.5)*12):offset)));
  targets.push({number:cycle+1,callsigns:[groups.LINNG3[cycle*4].callsign,groups.NUBER6[cycle*3].callsign],streams:['LINNG3','NUBER6'],predictedSeconds:gateTimes.NUBER6+shift+offset});
 }
 for(const [index,star]of ['BOXUM7','IMEBA9','RAGID6'].entries())for(let i=0;i<10;i++)groups[star][i].spawnTime=55+index*82+i*350+Math.round((rand()-.5)*44);
 const scenario=normalize({...base,name:name||'CYYZ West 65 AAR - VERKO Challenge B - 15NM - Instructor Owned',aircraft:aircraft.sort((a,b)=>a.spawnTime-b.spawnTime)});
 assert(scenario.aircraft.every(a=>a.spawnTime>=0&&a.spawnTime<3600));
 return {scenario,targets,gateTimes,gate};
}
function verify({scenario,targets,gateTimes,gate}){
 const sim=new LocalTraining();sim.load(scenario);const nearest=new Map(),bedposts=new Map();
 for(let t=0;t<4800;t++){
  sim.tick(1);const active=sim.aircraft.filter(a=>a.active);
  for(const a of active){const fix=scenario.waypoints.find(w=>w.name===a.initialDescent?.fix);if(fix){const d=geometry(a,fix).distance,old=bedposts.get(a.callsign);if(!old||d<old.distance)bedposts.set(a.callsign,{distance:d,altitude:a.altitude});}}
  const traffic=active.filter(a=>a.procedures.some(p=>p==='LINNG3'||p==='NUBER6')&&geometry(a,gate).distance<2);
  for(let i=0;i<traffic.length;i++)for(let j=i+1;j<traffic.length;j++){
   const a=traffic[i],b=traffic[j];if(a.procedures[0]===b.procedures[0])continue;
   const key=[a.callsign,b.callsign].sort().join('/'),d=geometry(a,b).distance,old=nearest.get(key);
   if(!old||d<old.horizontalNM)nearest.set(key,{callsigns:[a.callsign,b.callsign],atSeconds:sim.elapsed,horizontalNM:d,verticalFeet:Math.abs(a.altitude-b.altitude),distanceFromVERKO:Math.max(geometry(a,gate).distance,geometry(b,gate).distance)});
  }
 }
 const conflicts=[...nearest.values()].filter(p=>p.horizontalNM<3&&p.verticalFeet<1000).sort((a,b)=>a.atSeconds-b.atSeconds);
 for(const target of targets){const found=conflicts.find(c=>target.callsigns.every(cs=>c.callsigns.includes(cs)));assert(found,'Missing deliberate pair '+target.number);assert(found.horizontalNM<1,'Weak conflict '+target.number);assert(found.distanceFromVERKO<2,'Conflict too far from VERKO');const {callsigns,...metrics}=found;Object.assign(target,metrics);}
 assert.equal(conflicts.length,5,'Unexpected additional LINNG/NUBER loss of separation near VERKO');
 for(const a of scenario.aircraft){const crossing=bedposts.get(a.callsign);assert(crossing&&Math.abs(crossing.altitude-a.initialDescent.altitude)<100,'Bedpost target missed '+a.callsign);}
 return {synthetic:true,scenario:scenario.name,arrivals:65,injectionWindowSeconds:3600,streamCounts:{LINNG3:20,NUBER6:15,BOXUM7:10,IMEBA9:10,RAGID6:10},runways:{BOXUM7:'23',IMEBA9:'23',LINNG3:'24R',NUBER6:'24R',RAGID6:'24R'},entry:'15 route NM before each bedpost; not 15 NM between aircraft.',initialOwnership:'instructor',sfi:{'23':' N','24R':' R'},bedpostTargets:{LINNG:11000,NUBER:11000,BOXUM:11000,IMEBA:8000,RAGID:8000},defaultDescentFPM:2250,seed:2026110405,gateTimes,conflicts:targets,validation:'Offline current ZYZTools model, 1-second samples with 0.25-second physics steps, unmodified default speed profile, no instructor commands. Five LINNG/NUBER pairs within 3 NM and 1000 ft while both within 2 NM of VERKO; each designated pair closest approach within 2 NM of VERKO and under 1 NM horizontal. All bedpost targets checked. Not a guarantee of exactly five alerts elsewhere or after controller interventions.',instructorNote:'Timing is relative to Run. Resolve using normal vectors/speeds/altitudes; interventions change later timings. With no interventions, these pairs remain at FL110 at the merge; descend/vector as appropriate for the exercise. Flights continue filed routes and need approach clearance to land. 65 scheduled arrivals in the first hour, not 65 guaranteed landings.',minimumVersion:'App 1.2.63 / server 0.4.14 recommended; no update required if already installed.',fleetNote:'Synthetic callsigns/flightplans using the existing verified scenario fleet mappings; not real schedules.'};
}
module.exports={create,verify,stem};
if(require.main===module){const made=create(),manifest=verify(made);if(process.argv.includes('--check'))console.log(JSON.stringify(manifest,null,2));else{console.log('*** Begin Patch');for(const [suffix,value]of [['.json',made.scenario],['-manifest.json',manifest]]){console.log('*** Add File: scenarios/'+stem+suffix);console.log(JSON.stringify(value,null,2).split('\n').map(l=>'+'+l).join('\n'));}console.log('*** End Patch');}}
