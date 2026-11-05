const {build}=require('./Create-Verko65CScenario.cjs'),{LocalTraining}=require('../electron-app/src/local-training');
const made=build(),sim=new LocalTraining();sim.load(made.scenario);const rows=[];
for(let t=0;t<3700;t+=5){sim.tick(5);for(const pair of made.targets){if(Math.abs(sim.elapsed-pair.predictedSeconds)>80)continue;const planes=pair.callsigns.map(cs=>sim.aircraft.find(a=>a.callsign===cs&&a.active));if(planes.some(a=>!a))continue;rows.push([pair.number,sim.elapsed,...planes.flatMap(a=>[a.callsign,a.lat,a.lon,a.altitude,a.speed,a.heading,a.verticalSpeed||0,a.targetAltitude])].join(' '));}}
console.log('*** Begin Patch\n*** Add File: scenarios/CYYZ-West-65-15NM-VERKO-Challenge-C-replay.txt\n'+rows.map(l=>'+'+l).join('\n')+'\n*** End Patch');
