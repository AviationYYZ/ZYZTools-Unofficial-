// Offline synthetic training traffic; uses only the user's locally installed sector.
const fs=require('node:fs'),path=require('node:path');
const {importSectors,resolveScenario}=require('../electron-app/src/training-sector');
const {normalize,geometry,LocalTraining}=require('../electron-app/src/local-training');
const assert=require('node:assert/strict');
const sector=importSectors([process.argv[2]||path.join(process.env.APPDATA,'EuroScope/CZYZ/CZYZ.sct')]);
const flights=[
 ['ACA114','A321','CYUL','BOXUM','BOXUM7','23',16000],
 ['POE421','E295','CYOW','IMEBA','IMEBA9','24L',16000],
 ['AAL258','B738','KCLT','LINNG','LINNG3','24R',15000],
 ['WJA654','B738','CYYC','NUBER','NUBER6','23',16000],
 ['JZA872','CRJ9','CYQB','RAGID','RAGID6','24L',15000],
 ['ACA208','BCS1','CYEG','IRKIM','BOXUM7','24R',20000],
 ['TSC613','A332','LFPG','ROSVO','IMEBA9','23',22000],
 ['DAL382','A319','KATL','LOKPU','LINNG3','24L',16000],
 ['UAL547','B739','KDEN','APDAX','NUBER6','24R',22000],
 ['ACA760','B789','EGLL','TORNI','RAGID6','23',22000],
 ['WJA718','B38M','CYWG','TUDAN','BOXUM7','23',22000],
 ['ACA462','A320','CYHZ','POLTY','IMEBA9','24L',22000],
 ['JBU906','A320','KJFK','WOZEE','LINNG3','24R',22000],
 ['ROU163','A321','KLAS','FINGL','NUBER6','23',22000],
 ['POE309','E295','CYQM','UDNOX','RAGID6','24L',20000]
];
const raw={format:'ZYZTools-training',version:1,name:'CYYZ West Flow - All Five Streams - One Minute Spawns',waypoints:[],aircraft:flights.map(([callsign,type,origin,spawnFix,star,arrivalRunway,altitude],i)=>({callsign,type,origin,destination:'CYYZ',spawnFix,lat:0,lon:0,altitude,speed:250,speedBasis:'IAS',heading:0,rate:1500,spawnTime:i*60,squawk:String(2201+i),squawkMode:'N',flightRules:'I',wake:['A332','B789'].includes(type)?'H':'M',equipment:'S',category:'jet',publishedSpeeds:true,arrivalRunway,flightPlanRoute:spawnFix+' '+star+' CYYZ/'+arrivalRunway,cruiseAltitude:altitude,cruiseSpeed:440,alternate:'CYHM',remarks:'SYNTHETIC LOCAL TRAINING ONLY'}))};
// Use valid, unique octal squawks (never 8 or 9).
raw.aircraft.forEach((a,i)=>a.squawk=(parseInt('2201',8)+i).toString(8).padStart(4,'0'));
const resolved=resolveScenario(raw,sector);
for(const a of resolved.aircraft){const points=a.route.split(' ').map(name=>resolved.waypoints.find(w=>w.name===name));a.heading=geometry(points[0],points[1]).bearing;}
const result=normalize({...resolved,runways:resolved.runways.filter(r=>r.airport==='CYYZ')});
const sim=new LocalTraining();sim.load(result);assert.equal(sim.aircraft.filter(a=>a.active).length,1);
for(let i=1;i<15;i++){sim.tick(60);assert.equal(sim.aircraft.filter(a=>a.active).length,i+1);}
sim.reset();assert.equal(sim.aircraft.filter(a=>a.active).length,1);
console.log(JSON.stringify(result,null,2));
