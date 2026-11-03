// Offline, reproducible synthetic scenarios. --patch emits an apply_patch file;
// no connections, live traffic, credential reads or sector-file modifications.
const path=require('node:path'),{importSectors}=require('../electron-app/src/training-sector'),{normalize,LocalTraining,geometry,move}=require('../electron-app/src/local-training');
function create(sectorFile){
 const c=importSectors([sectorFile]),lookup=name=>c.fixes.find(w=>w.name===name)||require('../electron-app/src/training-navdata').lookup(c,name);
 const streams=[['LINNG3',20,11000,'KATL'],['NUBER6',15,11000,'KORD'],['BOXUM7',10,11000,'CYWG'],['IMEBA9',10,8000,'CYOW'],['RAGID6',10,8000,'CYUL']];
 const outputs={};
 for(const mode of ['West-65-per-hour','East-40-per-hour-with-departures','West-10NM-spacing-20min']){
  const east=mode.startsWith('East'),spacing=mode.includes('10NM'),waypoints=new Map(),aircraft=[],report=[];
  let sequence=0;const add=w=>{if(!w)throw Error('Missing scenario fix');waypoints.set(w.name,{name:w.name,lat:w.lat,lon:w.lon});return w;};
  for(let s=0;s<streams.length;s++){
   const [star,rate,target,origin]=streams[s],bed=star.replace(/\d+$/,''),runway=s===2||s===3?(east?'05':'23'):(east?'06R':'24R');
   const choices=c.procedures.filter(p=>p.name===star&&p.airport==='CYYZ'&&p.runway===runway&&p.fixes.indexOf(bed)>0).sort((a,b)=>b.fixes.indexOf(bed)-a.fixes.indexOf(bed));
   if(!choices.length)throw Error('No upstream transition for '+star+'/'+runway);const fixes=choices[0].fixes.map(lookup),index=choices[0].fixes.indexOf(bed);
   let left=35,next=index,spawn;while(next>0){const g=geometry(fixes[next],fixes[next-1]);if(g.distance>=left){spawn=move(fixes[next],left,g.bearing);break;}left-=g.distance;next--;}
   if(!spawn)throw Error('Transition too short for 35 NM descent lead on '+star);const heading=geometry(spawn,fixes[next]).bearing;
   const spawnName='SP_'+bed;add({name:spawnName,...spawn});const route=[spawnName,...fixes.slice(next).map(w=>add(w).name)].join(' ');
   const fp=[...choices[0].fixes.slice(next,index+1),star,'CYYZ/'+runway].join(' '),types=['A320','B738','E190','A321','B789'];
   const template={type:types[s],...spawn,altitude:17000,speed:270,speedBasis:'IAS',heading,rate:2250,route,flightPlanRoute:fp,origin,destination:'CYYZ',arrivalRunway:runway,category:'jet',wake:s===4?'H':'M',procedures:[star],automaticSpeeds:true,initialDescent:{fix:bed,altitude:target},cruiseAltitude:35000,cruiseSpeed:450,equipment:'L',remarks:'SYNTHETIC OFFLINE TRAINING '+star};
   // Exactly one hour of per-stream slots (west 65 total; east 8 per STAR).
   const count=spacing?11:east?8:rate,interval=east?450:3600/rate;
   let time=spacing?s*15:east?s*90:s*15;
   for(let n=0;n<count;n++){
    const number=++sequence,plane={...template,callsign:['ACA','WJA','POE','DAL','UAL'][s]+(400+number),squawk:(parseInt('2100',8)+number).toString(8).padStart(4,'0'),spawnTime:Math.round(time*100)/100};aircraft.push(plane);
    if(spacing){
     // Run the actual speed/turn/vertical model to find the time at which the
     // predecessor is 10 NM from the common stream entry. Later spacing is not
     // guaranteed after manual control or converging streams.
     const probe=new LocalTraining();probe.load({format:'ZYZTools-training',version:1,waypoints:[...waypoints.values()],aircraft:[{...plane,spawnTime:0}],runways:c.runways.filter(r=>r.airport==='CYYZ')});let elapsed=0;while(elapsed<600&&geometry(spawn,probe.aircraft[0]).distance<10){probe.tick(.25);elapsed+=.25;}if(elapsed>=600)throw Error('Cannot establish 10 NM stream entry spacing');time+=elapsed;
    }else time+=interval;
   }
   report.push({star,runway,count,ratePerHour:spacing?'10 NM at stream entry (rate varies)':east?8:rate,bedpost:bed,bedpostAltitude:target});
  }
  if(east){
   const r=c.runways.find(r=>r.airport==='CYYZ'&&r.name==='05'),course=geometry(r.threshold,r.opposite).bearing;
   // Airborne runway-05 climb-outs; ground taxi/takeoff roll is not simulated.
   const position=move(r.opposite,.7,course);add({name:'D05END',...move(r.opposite,25,course)});
   for(let n=0;n<10;n++){const number=++sequence;aircraft.push({callsign:'ACA'+(800+n),type:n%2?'B738':'A320',...position,altitude:1800,speed:180,speedBasis:'IAS',heading:course,rate:2250,route:'D05END',flightPlanRoute:'CYYZ/05 DCT D05END',origin:'CYYZ',destination:n%2?'CYUL':'CYOW',squawk:(parseInt('2100',8)+number).toString(8).padStart(4,'0'),spawnTime:120+n*360,category:'jet',automaticSpeeds:true,cruiseAltitude:23000,remarks:'SYNTHETIC RWY05 AIRBORNE CLIMBOUT - INSTRUCTOR ALT REQUIRED'});}
  }
  const scenario=normalize({format:'ZYZTools-training',version:1,name:'CYYZ '+mode,magneticVariationWest:c.magneticVariationWest,waypoints:[...waypoints.values()],aircraft,runways:c.runways.filter(r=>r.airport==='CYYZ'),speedRules:[]});
  outputs['scenarios/CYYZ-'+mode+'.json']=JSON.stringify(scenario,null,2)+'\n';outputs['scenarios/CYYZ-'+mode+'-manifest.json']=JSON.stringify({synthetic:true,source:'User installed CZYZ SCT/ESE/navdata; offline training, not current navigation certification',duration:spacing?'Eleven aircraft per stream, about 20 minutes of injection':'One hour of traffic injection; allow extra time for last arrivals',streams:report,departures:east?10:0,departureNote:east?'Airborne runway 05 climb-outs at 1800 ft, starting +2 min then every 6 min. ALT command starts climb. No automatic takeoff or SID claimed.':undefined,spacingNote:spacing?'Each successor spawns when the same-stream predecessor is 10 NM from its entry, under the default flight model. Not separation assurance.':'Hourly rates take precedence; 10 NM cannot also be maintained with these speeds and rates.'},null,2)+'\n';
 }
 return outputs;
}
module.exports={create};
if(require.main===module){const files=create(process.argv[2]||path.join(process.env.APPDATA,'EuroScope/CZYZ/CZYZ.sct'));if(process.argv.includes('--patch')){console.log('*** Begin Patch');for(const [name,content]of Object.entries(files)){console.log('*** Add File: '+name);console.log(content.trimEnd().split('\n').map(l=>'+'+l).join('\n'));}console.log('*** End Patch');}else console.log(Object.fromEntries(Object.entries(files).map(([name,value])=>[name,Buffer.byteLength(value)])));}
