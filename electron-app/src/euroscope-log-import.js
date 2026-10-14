const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
function logDate(file,override) {
  const found=path.basename(file).match(/EuroScope(\d{4})(\d{2})(\d{2})/i);
  const date=String(override||'').trim()||(found?`${found[1]}-${found[2]}-${found[3]}`:'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date) throw new Error('Enter the log start date as YYYY-MM-DD (UTC).');
  return Date.parse(date+'T00:00:00Z')/1000;
}
function flightPlan(line) {
  if(!line.startsWith('$FP'))return null;
  const p=line.split(':');const callsign=p[0].slice(3).toUpperCase();
  if(!/^[A-Z0-9]{1,12}$/.test(callsign)||p.length<17||!/^\w{4}$/.test(p[5])||!/^\w{4}$/.test(p[9]))return null;
  // Allowlist only operational fields. Never retain remarks, identity, auth or raw protocol lines.
  return {callsign,origin:p[5].toUpperCase(),destination:p[9].toUpperCase(),aircraftInfo:p[3].replace(/[^A-Z0-9/ -]/gi,'').slice(0,64),filedAltitude:Number(p[8])||0,route:p.slice(16).join(':').toUpperCase().replace(/[^A-Z0-9 .\/+-]/g,'').slice(0,4096)};
}
function bearing(a,b){const r=Math.PI/180;const d=(b.lon-a.lon)*r;return (Math.atan2(Math.sin(d)*Math.cos(b.lat*r),Math.cos(a.lat*r)*Math.sin(b.lat*r)-Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos(d))/r+360)%360;}
function parse(content,start,session) {
  const lines=content.split(/\r?\n/),firstPlans=new Map(),qualifying=new Set();
  for(const line of lines){const fp=flightPlan(line);if(fp){if(!firstPlans.has(fp.callsign))firstPlans.set(fp.callsign,fp);if(fp.origin==='CYYZ'||fp.destination==='CYYZ')qualifying.add(fp.callsign);}}
  const current=new Map(),flights=new Map(),last=new Map();let time=null,day=0,previousClock=null,positions=0,ignored=0;
  for(const line of lines){
    const header=line.match(/^\[(\d{2}):(\d{2}):(\d{2}) /);
    if(header){const h=Number(header[1]),m=Number(header[2]),s=Number(header[3]);if(h>23||m>59||s>59){time=null;continue;}const clock=h*3600+m*60+s;if(previousClock!==null&&clock<previousClock-43200)day++;previousClock=clock;time=start+day*86400+clock;continue;}
    const fp=flightPlan(line);if(fp){current.set(fp.callsign,fp);continue;}
    if(!/^@[NSY]:/.test(line))continue;
    positions++;
    const p=line.split(':'),callsign=(p[1]||'').toUpperCase();
    if(time===null||!qualifying.has(callsign)){ignored++;continue;}
    const plan=current.get(callsign)||firstPlans.get(callsign);
    if(!plan||(plan.origin!=='CYYZ'&&plan.destination!=='CYYZ')){ignored++;continue;}
    const lat=Number(p[4]),lon=Number(p[5]),altitude=Number(p[6]),groundSpeed=Number(p[7]);
    if(p.length<9||![lat,lon,altitude,groundSpeed].every(Number.isFinite)||Math.abs(lat)>90||Math.abs(lon)>180||altitude< -2000||altitude>100000||groundSpeed<0||groundSpeed>1500){ignored++;continue;}
    const sample={...plan,ts:time,session,event:'radar',source:'euroscope_log_import',controller:'not recorded',trackingController:'not imported',lat,lon,altitude,groundSpeed,positionAgeSeconds:0,flightPlanBackfilled:!current.has(callsign),altitudeDatum:'FSD reported altitude; datum unverified'};
    const prior=last.get(callsign);if(prior&&time>prior.ts&&time-prior.ts<=60&&(Math.abs(lat-prior.lat)+Math.abs(lon-prior.lon)>0.00001)){sample.track=bearing(prior,sample);sample.trackSource='derived from consecutive positions';}
    if(!flights.has(callsign))flights.set(callsign,[]);flights.get(callsign).push(sample);last.set(callsign,sample);
  }
  return {flights,positions,ignored};
}
async function importLog(file,folder,override) {
  const stat=await fs.stat(file);if(!stat.isFile()||stat.size>32*1024*1024)throw new Error('Select a EuroScope text log smaller than 32 MB.');
  const start=logDate(file,override),session=start+'_'+crypto.randomInt(100000000,999999999);
  const parsed=parse(await fs.readFile(file,'utf8'),start,session);
  if(!parsed.flights.size)throw new Error('No CYYZ arrival/departure position history was found. The log needs both flight plans and pilot-position messages.');
  await fs.mkdir(folder,{recursive:true});let samples=0;
  for(const [callsign,data]of parsed.flights){data.sort((a,b)=>a.ts-b.ts);const target=path.join(folder,`${session}_${callsign}.jsonl`);await fs.writeFile(target+'.tmp',data.map(s=>JSON.stringify(s)).join('\n')+'\n');await fs.rename(target+'.tmp',target);samples+=data.length;}
  return {aircraft:parsed.flights.size,samples,ignored:parsed.ignored,session,message:`Imported ${parsed.flights.size} YYZ aircraft and ${samples} position records. Authentication, remarks and chat entries were discarded. Log clock treated as UTC; assigned clearances and radio instructions are not available.`};
}
module.exports={logDate,flightPlan,parse,importLog};
