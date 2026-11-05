const fs=require('node:fs'),path=require('node:path');
const defaults={ALT:['Cleared approach','030','040','050','060','080','110'],IAS:['160','170','180','200','210','230','250'],MACH:['0.70','0.74','0.78','0.80'],HDG:['Fly present heading','90','180','270','360'],DCT:[],SQ:['1000','1200','2000'],RATE:['1500','2250','3000'],APP:['CLEAR','CANCEL'],ADV:['Clear speed restrictions','Custom speed restrictions','Crossing altitude restrictions','IDENT']};
const actions={ALT:['Cleared approach'],HDG:['Fly present heading','Enter custom heading...'],DCT:['Type waypoint...'],ADV:['Delete aircraft','Enter squawk','IDENT','Clear speed restrictions','Custom speed restrictions','Crossing altitude restrictions','Clear crossing restrictions'],APP:['CLEAR','CANCEL']};
function normalize(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid control presets.');
 const out={};for(const field of Object.keys(defaults)){
  const slots=value[field]??defaults[field];if(!Array.isArray(slots)||slots.length>12)throw Error(field+': use up to 12 presets.');
  out[field]=[...new Set(slots.map(raw=>{
   let text=String(raw).trim();if(actions[field]?.includes(text))return text;
   const n=Number(text);let valid=false;
   if(field==='ALT'){valid=/^\d{1,3}$/.test(text)&&n>=10&&n<=600&&n%10===0;text=String(n).padStart(3,'0');}
   if(field==='IAS')valid=/^\d+$/.test(text)&&n>=50&&n<=400;
   if(field==='MACH'){valid=n>=0.4&&n<=0.99&&Math.abs(n*100-Math.round(n*100))<1e-8;text=n.toFixed(2);}
   if(field==='HDG'){valid=/^\d{1,3}$/.test(text)&&n>=0&&n<=360;text=String(n%360||360);}
   if(field==='RATE')valid=/^\d+$/.test(text)&&n>=500&&n<=6000&&n%250===0;
   if(field==='SQ')valid=/^[0-7]{4}$/.test(text);
   if(field==='DCT'){text=text.toUpperCase();valid=/^[A-Z0-9_-]{1,16}$/.test(text);}
   if(!valid)throw Error(field+': invalid preset '+String(raw).slice(0,40));return text;
  }))];
 }return out;
}
class ControlPresets{
 constructor(folder){this.file=path.join(folder,'TrainingControlPresets.json');}
 get(){if(!fs.existsSync(this.file))return normalize(defaults);return normalize(JSON.parse(fs.readFileSync(this.file,'utf8')).fields);}
 set(fields){const saved=normalize(fields);fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify({version:1,fields:saved},null,2));fs.renameSync(this.file+'.tmp',this.file);return saved;}
 choices(field,choices){const picks=this.get()[field]||[];return [...picks.filter(v=>field==='DCT'||!['ADV','APP'].includes(field)||choices.includes(v)),...choices.filter(v=>!picks.includes(v))];}
}
module.exports={ControlPresets,normalize,defaults};
