const fs=require('node:fs'),path=require('node:path');
const defaults={enabled:false,sequencing:false,ownedOnly:true,situAdapter:true,muted:false,leader:'',follower:'',mergeFix:'',arrivalAirports:'CYYZ,CYTZ,CYHM,CYKF,CYOO,CYXU,CYQG,CYSB,CYYB,CYAM'};
const names={enabled:'Enabled',sequencing:'Sequencing',ownedOnly:'OwnedOnly',situAdapter:'SituAdapter',muted:'Muted',leader:'Leader',follower:'Follower',mergeFix:'MergeFix',arrivalAirports:'ArrivalAirports'};
function normalize(input={}){
 const c={...defaults,...input};
 for(const key of ['enabled','sequencing','ownedOnly','situAdapter','muted'])c[key]=c[key]===true;
 for(const key of ['leader','follower','mergeFix']){
  c[key]=String(c[key]||'').trim().toUpperCase();
  if(!/^[A-Z0-9_-]{0,16}$/.test(c[key]))throw Error('Use a callsign or waypoint name, at most 16 characters.');
 }
 c.arrivalAirports=[...new Set(String(c.arrivalAirports).toUpperCase().split(/[\s,;]+/).filter(Boolean))].join(',');
 if(!c.arrivalAirports||!c.arrivalAirports.split(',').every(code=>/^[A-Z0-9]{4}$/.test(code))||c.arrivalAirports.length>500)throw Error('Enter four-character arrival airport codes separated by commas.');
 if(c.leader&&c.leader===c.follower)throw Error('Choose two different aircraft.');
 return c;
}
function load(folder){
 const c={...defaults};
 try{
  const text=fs.readFileSync(path.join(folder,'ZYZToolsConflict.ini'),'utf8');
  for(const [key,name]of Object.entries(names)){
   const value=text.match(new RegExp('^'+name+'=([^\r\n]*)','m'))?.[1];
   if(value!==undefined)c[key]=typeof defaults[key]==='boolean'?value==='1':value;
  }
 }catch{}
 return normalize(c);
}
function save(folder,input){
 const c=normalize(input),target=path.join(folder,'ZYZToolsConflict.ini');
 fs.mkdirSync(folder,{recursive:true});
 const text='[Settings]\n'+Object.entries(names).map(([key,name])=>name+'='+(typeof c[key]==='boolean'?(c[key]?1:0):c[key])).join('\n')+'\n';
 fs.writeFileSync(target+'.tmp',text);fs.renameSync(target+'.tmp',target);return c;
}
function snapshot(folder){
 try{
  const data=JSON.parse(fs.readFileSync(path.join(folder,'ZYZToolsConflictStatus.json'),'utf8'));
  if(!Number.isFinite(data.ts)||Math.abs(Date.now()/1000-data.ts)>15)throw Error('stale');
  return data;
 }catch{return {enabled:false,status:'Waiting for the updated ZYZTools plugin in EuroScope.',aircraft:[],alerts:[],recommendations:[],recommendationStatus:''};}
}
module.exports={defaults,normalize,load,save,snapshot};
