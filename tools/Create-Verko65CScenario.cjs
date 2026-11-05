const {create,verify}=require('./Create-Verko65Scenario.cjs');
const profile=require('../electron-app/src/training-jet-profile').normalize();
const stem='CYYZ-West-65-15NM-VERKO-Challenge-C-RoutesFixed';
function build(){
 const made=create({seedValue:2026110409,jetSpeedProfile:profile,name:'CYYZ West 65 AAR - VERKO Challenge C - Explicit Filed Fixes'});
 // EuroScope must receive named fixes, not depend on resolving an ambiguous
 // STAR/transition shorthand. Synthetic initial spawn markers are simulator-only.
 made.scenario=require('../electron-app/src/local-training').normalize({...made.scenario,aircraft:made.scenario.aircraft.map(a=>({...a,flightPlanRoute:[...a.route.split(' ').filter(n=>!/^SP(?:15)?_/.test(n)),a.destination+'/'+a.arrivalRunway].join(' ')}))});
 const manifest={...verify(made),seed:2026110409,jetSpeedProfile:profile,minimumVersion:'App / plugin 1.2.65, server 0.4.14; enable conflict alerts in the linked app settings.',alertValidation:'See native conflict replay test: actual simulated samples at 5-second intervals are scanned by the C++ alert engine, with separate suppression tests for instructor approach clearance and Situ ILS/visual status.'};
 manifest.filedRoutes='Explicit named fixes through each selected runway branch; simulator-only SP/SP15 spawn markers are excluded. No STAR-name expansion is required in EuroScope. Aircraft trajectories and conflict timings are unchanged.';
 return {...made,manifest};
}
module.exports={build,stem};
if(require.main===module){const made=build();if(process.argv.includes('--check'))console.log(JSON.stringify(made.manifest,null,2));else{console.log('*** Begin Patch');for(const [suffix,value]of [['.json',made.scenario],['-manifest.json',made.manifest]]){console.log('*** Add File: scenarios/'+stem+suffix);console.log(JSON.stringify(value,null,2).split('\n').map(l=>'+'+l).join('\n'));}console.log('*** End Patch');}}
