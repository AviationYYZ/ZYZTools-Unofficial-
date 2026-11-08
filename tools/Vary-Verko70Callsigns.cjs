const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const base=require('../scenarios/CYYZ-West-70-Five-Streams-11NM-VERKO.json');
// Observed Toronto flight identifiers are reserved for matching carrier/origin.
// Other identifiers are fictional, within airline-style number ranges.
const observed={'ACA/CYUL':['ACA409'],'POE/CYEG':['POE402'],'POE/CYWG':['POE420'],'WJA/CYWG':['WJA384'],'KLM/EHAM':['KLM691'],'BAW/EGLL':['BAW93'],'AFR/LFPG':['AFR356J']};
const ranges={ACA:[100,1800],JZA:[7200,8999],POE:[100,680],WJA:[100,1800],DAL:[400,2900],ROU:[1500,1999],AAL:[200,2800],SKW:[3300,5900],UAL:[200,2400],KLM:[680,699]};
const reserved=new Set(Object.values(observed).flat()),used=new Set();
const aircraft=base.aircraft.map(a=>{
 const carrier=a.callsign.replace(/\d+$/,''),recorded=observed[carrier+'/'+a.origin]?.find(cs=>!used.has(cs));
 let callsign=recorded;
 if(!callsign){
  const [min,max]=ranges[carrier]||[100,2899];
  for(let n=0;!callsign;n++){
   const hash=crypto.createHash('sha256').update('verko-five-streams-v2|'+a.callsign+'|'+n).digest().readUInt32LE();
   const next=carrier+(min+hash%(max-min+1));
   if(!used.has(next)&&!reserved.has(next))callsign=next;
  }
 }
 used.add(callsign);return {...a,callsign};
});
assert.equal(used.size,70);
for(let i=0;i<aircraft.length;i++)assert.deepEqual({...aircraft[i],callsign:base.aircraft[i].callsign},base.aircraft[i]);
const scenario={...base,name:base.name+' - varied callsigns',aircraft};
require('../electron-app/src/local-training').normalize(scenario);
if(process.argv.includes('--check'))console.log({aircraft:aircraft.length,observed:aircraft.filter(a=>reserved.has(a.callsign)).map(a=>a.callsign)});
else console.log('*** Begin Patch\n*** Add File: scenarios/CYYZ-West-70-Five-Streams-11NM-VERKO-Varied-Callsigns.json\n'+JSON.stringify(scenario,null,2).split('\n').map(l=>'+'+l).join('\n')+'\n*** End Patch');
