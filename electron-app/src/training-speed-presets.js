const fs=require('node:fs'),path=require('node:path');
function normalize(slots){if(!Array.isArray(slots)||slots.length!==6)throw Error('Use exactly six preset slots.');return slots.map((s,i)=>{if(s===null)return null;if(!s||typeof s!=='object')throw Error('Invalid preset slot.');const name=String(s.name||'Slot '+(i+1)).trim(),fix=String(s.fix||'').trim().toUpperCase(),ias=Number(s.ias);if(!name||name.length>32||/[\x00-\x1f|]/.test(name)||!Number.isInteger(ias)||ias<50||ias>400||!/^[A-Z0-9_-]{1,16}$/.test(fix))throw Error('Each preset needs a name (up to 32 characters), 50–400 knots IAS and one waypoint.');return {name,ias,fix};});}
class SpeedPresets{
 constructor(folder){this.file=path.join(folder,'TrainingSpeedPresets.json');}
 get(){if(!fs.existsSync(this.file))return Array(6).fill(null);let saved;try{saved=JSON.parse(fs.readFileSync(this.file,'utf8'));return normalize(saved.slots);}catch{throw Error('Saved speed presets cannot be read. Preserve TrainingSpeedPresets.json before repairing it.');}}
 set(slots){const saved=normalize(slots);fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify({version:1,slots:saved},null,2));fs.renameSync(this.file+'.tmp',this.file);return saved;}
 choices(){return this.get().flatMap((s,i)=>s?['Preset '+(i+1)+': '+s.name+' ('+s.ias+' until '+s.fix+')']:[]);}
 command(slot){if(!Number.isInteger(slot)||slot<1||slot>6)throw Error('Unknown speed preset.');const preset=this.get()[slot-1];if(!preset)throw Error('This speed preset slot is empty.');return 'IAS '+preset.ias+' UNTIL '+preset.fix;}
}
module.exports={SpeedPresets,normalize};
