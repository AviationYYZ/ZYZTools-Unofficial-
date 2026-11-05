const fs=require('node:fs'),path=require('node:path');
const defaults={enabled:false,situAdapter:true,muted:false,arrivalAirports:'CYYZ,CYTZ,CYHM,CYKF,CYOO,CYXU,CYQG,CYSB,CYYB,CYAM'};
const names={enabled:'Enabled',situAdapter:'SituAdapter',muted:'Muted',arrivalAirports:'ArrivalAirports'};
function normalize(input={}){
 const c=Object.fromEntries(Object.keys(defaults).map(key=>[key,input[key]??defaults[key]]));
 for(const key of ['enabled','situAdapter','muted'])c[key]=c[key]===true;

 c.arrivalAirports=[...new Set(String(c.arrivalAirports).toUpperCase().split(/[\s,;]+/).filter(Boolean))].join(',');
 if(!c.arrivalAirports||!c.arrivalAirports.split(',').every(code=>/^[A-Z0-9]{4}$/.test(code))||c.arrivalAirports.length>500)throw Error('Enter four-character arrival airport codes separated by commas.');
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
