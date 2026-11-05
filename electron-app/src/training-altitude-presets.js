const fs=require('node:fs'),path=require('node:path');
function normalize(slots){if(!Array.isArray(slots)||slots.length!==6)throw Error('Use exactly six crossing-altitude slots.');return slots.map((s,i)=>{if(s===null)return null;if(!s||typeof s!=='object')throw Error('Invalid crossing slot.');const name=String(s.name||'Slot '+(i+1)).trim(),fix=String(s.fix||'').trim().toUpperCase(),altitude=Number(s.altitude);if(!name||name.length>32||/[\x00-\x1f|\[\]]/.test(name)||!Number.isInteger(altitude)||altitude<0||altitude>60000||altitude%100!==0||!/^[A-Z0-9_-]{1,16}$/.test(fix))throw Error('Crossing presets need a name, waypoint and altitude in feet (whole hundreds, 0–60000).');return {name,fix,altitude};});}
class AltitudePresets{
 constructor(folder){this.file=path.join(folder,'TrainingAltitudePresets.json');}
 get(){return fs.existsSync(this.file)?normalize(JSON.parse(fs.readFileSync(this.file,'utf8')).slots):Array(6).fill(null);}
 set(slots){const saved=normalize(slots);fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify({version:1,slots:saved},null,2));fs.renameSync(this.file+'.tmp',this.file);return saved;}
 choices(){return this.get().flatMap((s,i)=>s?['Crossing '+(i+1)+': '+s.name+' [CROSS '+s.fix+' AT '+s.altitude+']']:[]);}
}
module.exports={AltitudePresets,normalize};
