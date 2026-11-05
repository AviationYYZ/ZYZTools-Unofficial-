// Synthetic origin/airline pairings selected to agree with the entry stream.
const {fleets}=require('./Create-Sfi65Scenario.cjs');
const origins={
 LINNG3:{ACA:['KATL','KMIA','KMCO'],ROU:['KMCO','KTPA'],WJA:['KMCO','KATL'],JZA:['KCLE','KPIT'],POE:['KIAD','KBNA'],UAL:['KIAD','KIAH'],AAL:['KCLT','KDFW'],DAL:['KATL','KCVG'],SKW:['KCVG']},
 NUBER6:{ACA:['CYVR','CYYC','CYEG'],ROU:['KLAS','KPHX'],WJA:['CYYC','CYVR'],JZA:['CYWG','CYQT'],POE:['CYWG','CYEG'],UAL:['KORD','KDEN'],AAL:['KORD','KDFW'],DAL:['KMSP','KDTW'],SKW:['KORD','KDTW']},
 BOXUM7:{ACA:['CYWG','CYXE','CYEG'],WJA:['CYWG','CYEG'],JZA:['CYQT','CYAM'],POE:['CYQT','CYWG']},
 IMEBA9:{ACA:['CYUL','CYOW','CYQB'],JZA:['CYUL','CYOW','CYQB'],POE:['CYOW','CYUL'],KLM:['EHAM'],BAW:['EGLL'],AFR:['LFPG']},
 RAGID6:{ACA:['CYHZ','CYUL','KEWR'],JZA:['CYUL','CYOW'],POE:['CYHZ','KBOS','KEWR'],UAL:['KEWR'],AAL:['KJFK','KBOS'],DAL:['KJFK','KBOS'],SKW:['KEWR'],KLM:['EHAM'],BAW:['EGLL'],AFR:['LFPG']}
};
function apply(scenario,seed=2026110418){const used=new Set();const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);for(const a of scenario.aircraft){const map=origins[a.procedures[0]],eligible=Object.keys(map);let prefix=a.callsign.slice(0,3);if(!map[prefix]){prefix=eligible[Math.floor(rand()*eligible.length)];a.callsign=prefix+(100+Math.floor(rand()*8900));a.type=fleets[prefix].types[Math.floor(rand()*fleets[prefix].types.length)];a.wake=['B789','B772','A359'].includes(a.type)?'H':'M';}while(used.has(a.callsign))a.callsign=prefix+(100+Math.floor(rand()*8900));used.add(a.callsign);a.origin=map[prefix][Math.floor(rand()*map[prefix].length)];}return scenario;}
module.exports={origins,apply};
