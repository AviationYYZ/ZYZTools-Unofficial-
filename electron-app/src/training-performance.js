// Offline EuroScope performance data, MIT, VATSIM Inc. See adjacent license.
// Pinned source: vatsimnetwork/euroscope-performance-data@6dcc431a07e41a83450ac72a0f141b8a8f29b9e1
// Final-approach targets below are configurable TRAINING defaults, not Vref data.
const fs=require('node:fs'),path=require('node:path');
function parse(text){
 const types=new Map();let rows;
 for(const raw of String(text).split(/[\r\n]+/)){
  const line=raw.trim();if(!line||line.startsWith(';')||line.startsWith('#'))continue;
  if(line.startsWith('PERFAC:')){const [type,kind]=line.slice(7).trim().split(':');if(!/^[A-Z0-9]{2,4}$/.test(type)||kind&&kind!=='ROTOR')throw Error('Invalid bundled performance type.');rows=[];types.set(type,rows);}
  else if(line.startsWith('PERFLINE:')){const values=line.slice(9).split(':').map(Number);if(!rows||values.length!==9||values.some(v=>!Number.isFinite(v)||v<0))throw Error('Invalid bundled performance row.');rows.push({altitude:values[0]*100,ias:values.slice(1,4),mach:values.slice(4,7).map(v=>v>1?v/100:v),roc:values[7],rod:values[8]});}
 }
 for(const [type,r]of types){r.sort((a,b)=>a.altitude-b.altitude);if(!r.length)throw Error('Missing performance rows for '+type);}
 return types;
}
const types=parse(fs.readFileSync(path.join(__dirname,'training-performance.txt'),'utf8'));
function profile(a,phase,tasToIas){
 const rows=types.get(a.type),index={climb:0,cruise:1,descent:2}[phase]??2;
 if(!rows)return {ias:a.category==='prop'?180:250,rod:1500,finalIAS:a.finalApproachIAS||(['H','J'].includes(a.wake)?150:a.category==='prop'?120:140),source:'Generic training fallback (unknown type '+a.type+')'};
 const rowSpeed=r=>r.ias[index]>0?r.ias[index]:r.mach[index]>0?tasToIas(r.mach[index]*Math.sqrt(1.4*287.05*(288.15-.0065*Math.min(11000,Math.max(0,a.altitude)*.3048)))/.514444,a.altitude):null;
 const low=rows.filter(r=>r.altitude<=a.altitude).at(-1)||rows[0],high=rows.find(r=>r.altitude>=a.altitude)||rows.at(-1),fraction=high.altitude===low.altitude?0:(a.altitude-low.altitude)/(high.altitude-low.altitude);
 const left=rowSpeed(low),right=rowSpeed(high),ias=left===null?right??200:right===null?left:left+(right-left)*fraction;
 const prop=/^(DH8|DHC|AT4|AT7|SF34|BE|B190|PC12|C208|P180)/.test(a.type),slow=rows[0].ias[2];
 const heavy=['H','J'].includes(a.wake)||/^(A33|A34|A35|A38|B74|B76|B77|B78|MD11|DC10|A124)/.test(a.type);
 const finalIAS=a.finalApproachIAS||(slow>0&&slow<140?Math.max(60,Math.min(110,Math.round(slow*.8/5)*5)):prop?120:heavy?150:140);
 return {ias,rod:low.rod+(high.rod-low.rod)*fraction,finalIAS,source:'EuroScope '+a.type+' '+phase};
}
module.exports={parse,profile,typeCount:types.size};
