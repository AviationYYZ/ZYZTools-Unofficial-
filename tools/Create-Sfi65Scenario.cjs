// Reproducible synthetic variant; no network/credentials or sector changes.
const fs=require('node:fs'),path=require('node:path'),{normalize}=require('../electron-app/src/local-training');
const fleets={
 ACA:{types:['A320','BCS3','B38M'],source:'https://www.aircanada.com/ca/en/aco/home/fly/onboard/fleet.html'},
 ROU:{types:['B38M'],source:'https://www.aircanada.com/ca/en/aco/home/about/corporate-profile.html'},
 JZA:{types:['CRJ9','E75L'],source:'https://flyjazz.com/en/operations/air-canada-express/'},
 POE:{types:['E295'],source:'https://status.embraer.com/star-performers-fly-e2/en/'},
 WJA:{types:['B738','B38M'],source:'https://www.westjetcargo.com/en-ca/company/our-fleet'},
 AAL:{types:['A321'],source:'https://s202.q4cdn.com/986123435/files/doc_downloads/fact-sheets/fleet/Airbus-A321-family.pdf'},
 UAL:{types:['B738'],source:'https://united.mediaroom.com/corporate-fact-sheet'},
 DAL:{types:['A321'],source:'https://www.delta.com/eu/en/aircraft/overview'},
 SKW:{types:['E75L'],source:'https://inc.skywest.com/corporate-information/our-fleet/'},
 KLM:{types:['B789'],source:'https://www.klm.nl/en/information/travel-class-extra-options/aircraft-types/boeing-787-9'},
 BAW:{types:['B772'],source:'https://www.britishairways.com/content/information/about-ba/fleet-facts'},
 AFR:{types:['A359'],source:'https://corporate.airfrance.com/sites/default/files/media-pdf/90%20ans%20France_DP-EN_061023.pdf'}
};
function create({instructorOwned=false}={}){
 const base=JSON.parse(fs.readFileSync(path.join(__dirname,'../scenarios/CYYZ-West-65-Random-Close-15NM.json'),'utf8')),used=new Set();let seed=651503;
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 const scenario=normalize({...base,...(instructorOwned?{initialOwnership:'instructor'}:{}),name:'CYYZ West 65 per hour - 15NM Entry - SFI N/R - Airline Fleets'+(instructorOwned?' - Instructor Owned':''),aircraft:base.aircraft.map(a=>{
  const prefix=a.callsign.slice(0,3),fleet=fleets[prefix];if(!fleet)throw Error('Unverified airline '+prefix);let callsign;do{callsign=prefix+(100+next()%8900);}while(used.has(callsign));used.add(callsign);
  const type=fleet.types[next()%fleet.types.length];return {...a,callsign,type,wake:['B789','B772','A359'].includes(type)?'H':'M',category:'jet',scratchpad:a.arrivalRunway==='23'?' N':' R'};
 })});
 const manifest={...JSON.parse(fs.readFileSync(path.join(__dirname,'../scenarios/CYYZ-West-65-Random-Close-15NM-manifest.json'),'utf8')),scenario:scenario.name,sfi:{'23':' N','24R':' R'},scratchpadNote:'Leading space is intentional for VATCAN Situ SFI format. Initial scratchpads require app 1.2.56 / server 0.4.11 or newer.',fleetVerificationDate:'2026-11-03',fleets,notes:'Synthetic callsigns/flightplans, not real schedules or tail-specific assignments. Fleet families checked against airline/manufacturer sources. Original routes, origins, 15 route NM entry positions, hourly intervals and bedpost targets preserved. All remarks include /v/. Not a 15 NM inter-aircraft spacing guarantee.'};
 if(instructorOwned){manifest.initialOwnership='Instructor identified by authenticated app pairing, never first student login. Connect instructor EuroScope using Connect my EuroScope before Run. Active unowned aircraft are assumed once; delayed spawns inherit ownership. Normal handoffs are preserved.';manifest.requires='App 1.2.57 / server 0.4.12 or newer.';}
 return {scenario,manifest};
}
module.exports={create,fleets};
if(require.main===module){const instructorOwned=process.argv.includes('--instructor-owned'),{scenario,manifest}=create({instructorOwned}),stem='scenarios/CYYZ-West-65-15NM-SFI'+(instructorOwned?'-Instructor-Owned':'');console.log('*** Begin Patch');for(const [name,value]of [[stem+'.json',scenario],[stem+'-manifest.json',manifest]]){console.log('*** Add File: '+name);console.log(JSON.stringify(value,null,2).split('\n').map(l=>'+'+l).join('\n'));}console.log('*** End Patch');}
