// CYYZ terminal-area training weather. No simulator or network credentials.
const levels=[1000,975,950,925,900,850,800,700,600,500,400,300,250,200,150,100,70,50];
const rad=Math.PI/180, knot=.514444, refreshMs=15*60_000, expiryMs=2*60*60_000;
const finite=Number.isFinite;
const wind=(from,speed)=>({east:-Math.sin(from*rad)*speed,north:-Math.cos(from*rad)*speed});
function upper(data,now){
 const h=data?.hourly;if(!Array.isArray(h?.time))return [];
 const index=h.time.reduce((best,t,i)=>finite(t)&&Math.abs(t-now/1000)<Math.abs((h.time[best]??Infinity)-now/1000)?i:best,-1);
 if(index<0||Math.abs(h.time[index]-now/1000)>5400)return [];
 return levels.flatMap(pressure=>{
  const read=name=>h[name+'_'+pressure+'hPa']?.[index];
  const values=['geopotential_height','temperature','wind_direction','wind_speed'].map(read);
  if(!values.every(finite)||values[1]<-120||values[1]>65||values[3]<0||values[3]>300)return [];
  const [height,temp,dir,speed]=values;
  return [{feet:height/.3048,kelvin:temp+273.15,pressure,...wind(dir,speed)}];
 }).sort((a,b)=>a.feet-b.feet);
}
function surface(data,now){
 const m=Array.isArray(data)?data.filter(x=>x?.icaoId==='CYYZ'&&finite(x.obsTime)).sort((a,b)=>b.obsTime-a.obsTime)[0]:null;
 if(!m||Math.abs(m.obsTime-now/1000)>7200||!finite(m.temp)||m.temp<-80||m.temp>65||!finite(m.altim)||m.altim<850||m.altim>1100)return null;
 const feet=finite(m.elev)?m.elev/.3048:569;
 return {feet,kelvin:m.temp+273.15,pressure:m.altim*(1-2.25577e-5*feet*.3048)**5.25588,
  ...(finite(m.wdir)&&finite(m.wspd)&&m.wspd>=0&&m.wspd<=150?wind(m.wdir,m.wspd):{}),observed:m.obsTime*1000,raw:String(m.rawOb||'').slice(0,300)};
}
function sample(profile,feet){
 if(!profile)return null;
 const {metar,aloft}=profile, rows=metar?[metar,...aloft.filter(row=>row.feet>metar.feet+25)]:aloft;
 if(!rows.length)return null;
 const hi=rows.findIndex(row=>row.feet>=feet);
 if(hi===0)return rows[0];
 if(hi===-1){
  const last=rows.at(-1),height=Math.max(0,feet-last.feet)*.3048;
  const kelvin=Math.max(216.65,last.kelvin-.0065*height);
  const windScale=aloft.length?1:Math.max(0,1-height/600);
  return {...last,kelvin,pressure:last.pressure*Math.exp(-9.80665*height/(287.05*(last.kelvin+kelvin)/2)),east:(last.east||0)*windScale,north:(last.north||0)*windScale};
 }
 const a=rows[hi-1],b=rows[hi],t=(feet-a.feet)/(b.feet-a.feet),lerp=(x,y)=>x+(y-x)*t;
 return {kelvin:lerp(a.kelvin,b.kelvin),pressure:Math.exp(lerp(Math.log(a.pressure),Math.log(b.pressure))),
  east:lerp(a.east??b.east??0,b.east??0),north:lerp(a.north??b.north??0,b.north??0)};
}
function motion(heading,tas,w){
 if(!tas||!w)return {track:heading,speed:tas};
 const east=tas*Math.sin(heading*rad)+(w.east||0),north=tas*Math.cos(heading*rad)+(w.north||0);
 return {track:(Math.atan2(east,north)/rad+360)%360,speed:Math.hypot(east,north)};
}
function crab(track,tas,w){
 if(!w||tas<1)return track;
 const cross=(w.east||0)*Math.cos(track*rad)-(w.north||0)*Math.sin(track*rad);
 return (track-Math.asin(Math.max(-.95,Math.min(.95,cross/tas)))/rad+360)%360;
}
// Treat indicated speed as calibrated speed (no simulated instrument error).
const impact=m=>Math.expm1(3.5*Math.log1p(.2*m*m)), mach=q=>Math.sqrt(5*Math.expm1(Math.log1p(q)/3.5));
const sound=t=>Math.sqrt(1.4*287.05*t)/knot;
const iasToTas=(ias,w)=>mach(1013.25/w.pressure*impact(ias/sound(288.15)))*sound(w.kelvin);
const tasToIas=(tas,w)=>mach(w.pressure/1013.25*impact(tas/sound(w.kelvin)))*sound(288.15);
let cache={},pending;
async function refresh(){
 if(cache.checked&&Date.now()-cache.checked<refreshMs)return cache;
 if(!pending)pending=(async()=>{
  const now=Date.now(),vars=levels.flatMap(p=>['temperature','wind_speed','wind_direction','geopotential_height'].map(v=>v+'_'+p+'hPa'));
  const query=new URLSearchParams({latitude:'43.6777',longitude:'-79.6248',hourly:vars.join(','),wind_speed_unit:'kn',timeformat:'unixtime',past_hours:'1',forecast_hours:'2'});
  async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':'ZYZTools-Training-Weather/1.0'}});if(!r.ok)throw Error('Weather HTTP '+r.status);return r.json();}
  const [m,u]=await Promise.allSettled([get('https://aviationweather.gov/api/data/metar?ids=CYYZ&format=json'),get('https://api.open-meteo.com/v1/forecast?'+query)]);
  const metar=m.status==='fulfilled'&&surface(m.value,now),aloft=u.status==='fulfilled'?upper(u.value,now):[];
  cache={checked:now,metar:metar||cache.metar,aloft:aloft.length?aloft:cache.aloft,upperAt:aloft.length?now:cache.upperAt,upperFresh:!!aloft.length,metarFresh:!!metar};
  return cache;
 })().finally(()=>{pending=null;});
 return pending;
}
function usable(data,now=Date.now()){
 const metar=now-data?.metar?.observed<=expiryMs?data.metar:null;
 const aloft=now-data?.upperAt<=expiryMs?data.aloft:[];
 return metar||aloft.length?{metar,aloft}:null;
}
module.exports={upper,surface,sample,motion,crab,iasToTas,tasToIas,sound,refresh,usable,refreshMs};
