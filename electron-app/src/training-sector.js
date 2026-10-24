const fs=require('node:fs');
function coordinate(value){
 const m=String(value).match(/^([NSEW])(\d{2,3})\.(\d{2})\.(\d{2})(?:\.(\d+))?$/i);
 if(m){const deg=Number(m[2]),min=Number(m[3]),sec=Number(m[4]+'.'+(m[5]||'0'));if(min>=60||sec>=60)return null;const n=(deg+min/60+sec/3600)*(/[SW]/i.test(m[1])?-1:1);return Math.abs(n)<=180?n:null;}
 return /^-?\d+(?:\.\d+)?$/.test(String(value))?Number(value):null;
}
function parseSector(text){
 const info=String(text).match(/\[INFO\]([^]*?)(?=\n\[|$)/i)?.[1].split(/\r?\n/).map(l=>l.split(';')[0].trim()).filter(Boolean)||[];
 const magneticVariationWest=info.length>7&&Number.isFinite(Number(info[7]))?Number(info[7]):undefined;
 const fixes=new Map(),lines=[],geometry=[],colors={},runways=[],airwaySpecs=[];let section='',group='';
 for(const raw of String(text).split(/\r?\n/)){
  const line=raw.split(';')[0].trim();if(!line)continue;const define=line.match(/^#define\s+(\S+)\s+(\d+)/i);if(define){const n=Number(define[2]);colors[define[1].toUpperCase()]='#'+[n&255,(n>>8)&255,(n>>16)&255].map(c=>c.toString(16).padStart(2,'0')).join('');continue;}if(line.startsWith('#'))continue;
  const heading=line.match(/^\[([^\]]+)\]/);if(heading){section=heading[1].toUpperCase();group='';continue;}
  const parts=line.split(/\s+/),coords=[];
  for(let i=0;i+1<parts.length;i++){if(!/^[NS]\d/i.test(parts[i])||!/^([EW]\d)/i.test(parts[i+1]))continue;const lat=coordinate(parts[i]),lon=coordinate(parts[i+1]);if(lat!==null&&lon!==null&&Math.abs(lat)<=89&&Math.abs(lon)<=180)coords.push({lat,lon});}
  if(section==='RUNWAY'&&coords.length>=2&&/^[A-Z]{4}$/.test(parts.at(-1))){for(const i of [0,1])runways.push({airport:parts.at(-1),name:parts[i],threshold:coords[i],opposite:coords[1-i],elevation:parts.at(-1)==='CYYZ'?569:0,simulated:true});}
  if(['LOW AIRWAY','HIGH AIRWAY'].includes(section)&&parts.length>=5)airwaySpecs.push(parts);
  if(['FIXES','VOR','NDB','AIRPORT','AIRPORTS'].includes(section)&&coords.length&&/^[A-Z0-9_-]{1,16}$/i.test(parts[0])){
   const fix={name:parts[0].toUpperCase(),kind:section,...coords[0]};const old=fixes.get(fix.name);if(old&&Math.hypot(old.lat-fix.lat,old.lon-fix.lon)>0.001)throw Error('Ambiguous coordinates for '+fix.name+'. Import a single consistent sector cycle.');fixes.set(fix.name,fix);
  }
  if(['GEO','ARTCC','ARTCC HIGH','ARTCC LOW','ARTCC_HIGH','ARTCC_LOW','SID','STAR','RUNWAY'].includes(section)&&geometry.length<100000){
   const first=parts.findIndex(p=>/^[NS]\d/i.test(p));
   if(section==='RUNWAY')group=(parts.at(-1)||'')+' '+parts[0]+'-'+parts[1];
   else if(first>0)group=parts.slice(0,first).join(' ');
   // SCT named endpoints occupy the last four tokens before an optional colour.
   // Group names occupy the leading fixed-width column, and blank continuation lines reuse them.
   let endpoints=coords.slice(0,2);
   if(coords.length<2&&parts.length>=5){const tail=parts.slice(-5),prefix=parts.slice(0,-5).join(' ');if(prefix)group=prefix;endpoints=[[tail[0],tail[1]],[tail[2],tail[3]]];}
   if(endpoints.length===2){geometry.push({points:endpoints,section:section.replaceAll('_',' '),name:group,color:parts.at(-1)});}
  }
 }
 for(const item of geometry){const points=item.points.map(p=>{if(!Array.isArray(p))return p;const lat=coordinate(p[0]),lon=coordinate(p[1]);return lat!==null&&lon!==null?{lat,lon}:fixes.get(p[0].toUpperCase());});if(points.every(Boolean)&&points.some(p=>p.lat!==0||p.lon!==0)){lines.push(points);item.points=points;}}
 for(const item of geometry){const n=Number(item.color);item.color=colors[String(item.color).toUpperCase()]||(/^\d+$/.test(item.color)?'#'+[n&255,(n>>8)&255,(n>>16)&255].map(c=>c.toString(16).padStart(2,'0')).join(''):undefined);}
 const airways=[];for(const p of airwaySpecs){const from=fixes.get(p[1]),to=fixes.get(p[3]);if(from&&to)airways.push({name:p[0],from,to});}
 return {magneticVariationWest,fixes:[...fixes.values()],lines,runways,airways,geometry:geometry.filter(item=>item.points.every(p=>p&&!Array.isArray(p))&&item.points.some(p=>p.lat!==0||p.lon!==0))};
}
function importSectors(files){
 if(!Array.isArray(files)||files.length>10)throw Error('Select up to ten sector files.');const fixes=new Map(),lines=[],geometry=[],runways=[],procedures=[],airways=[];let magneticVariationWest;
 for(const file of files){if(fs.statSync(file).size>50*1024*1024)throw Error('Sector file exceeds 50 MB.');const parsed=parseSector(fs.readFileSync(file,'utf8'));if(magneticVariationWest===undefined)magneticVariationWest=parsed.magneticVariationWest;for(const fix of parsed.fixes){const old=fixes.get(fix.name);if(old&&Math.hypot(old.lat-fix.lat,old.lon-fix.lon)>0.001)throw Error('Conflicting sector coordinates for '+fix.name+'.');fixes.set(fix.name,fix);}lines.push(...parsed.lines);geometry.push(...parsed.geometry);runways.push(...parsed.runways);
  const path=require('node:path'),ese=file.replace(/\.sct2?$/i,'.ese'),nav=path.join(path.dirname(file),'navdata/airway.txt'),parser=require('./training-routes');
  if(fs.existsSync(ese)&&fs.statSync(ese).size<20*1024*1024)procedures.push(...parser.parseEse(fs.readFileSync(ese,'utf8')));
  for(const e of parsed.airways)airways.push(e);
  if(fs.existsSync(nav)&&fs.statSync(nav).size<30*1024*1024)for(const e of parser.parseAirways(fs.readFileSync(nav,'utf8')))airways.push(e);
 }
 if(!fixes.size)throw Error('No named fixes found. Select your .sct/.sct2 file containing [FIXES], [VOR] or [NDB].');
 if(fixes.size>30000)throw Error('Sector catalogue exceeds 30,000 fixes.');return {magneticVariationWest,fixes:[...fixes.values()],lines:lines.slice(0,100000),geometry:geometry.slice(0,100000),runways,procedures,airways};
}
const sectionKinds={GEO:'Geo',SID:'Sids',STAR:'Stars',RUNWAY:'Runways',ARTCC:'ARTCC boundary','ARTCC HIGH':'ARTCC high boundary','ARTCC LOW':'ARTCC low boundary',FIXES:'Fixes',VOR:'VORs',NDB:'NDBs',AIRPORT:'Airports',AIRPORTS:'Airports'};
function parseAsr(text,name='Display profile'){
 const selections=[],result={name,selections,rotation:0};
 for(const line of String(text).split(/\r?\n/)){const p=line.split(':'),kind=p[0];
  if(kind==='WINDOWAREA'&&p.length===5){const n=p.slice(1).map(Number);if(n.every(Number.isFinite)&&Math.abs(n[0])<=89&&Math.abs(n[2])<=89&&Math.abs(n[1])<=180&&Math.abs(n[3])<=180&&n[0]<n[2]&&n[1]<n[3])result.bounds={south:n[0],west:n[1],north:n[2],east:n[3]};}
  else if(kind==='DisplayRotation'&&Number.isFinite(Number(p[1])))result.rotation=Number(p[1])%360;
  else if(Object.values(sectionKinds).includes(kind)&&p[1])selections.push({kind,name:p[1].trim(),mode:p[2]||''});
 }
 if(!selections.length)throw Error('No supported sector display selections found in this ASR file.');return result;
}
function visible(profile,section,name,mode){if(!profile)return true;const kind=sectionKinds[section]||section;return profile.selections.some(s=>s.kind===kind&&s.name.toUpperCase()===String(name).toUpperCase()&&(!mode||s.mode===mode));}
function resolveScenario(raw,catalogue){
 const map=new Map((catalogue?.fixes||[]).map(w=>[w.name,w]));for(const w of raw.waypoints||[])map.set(w.name,w);
 const required=new Set((raw.waypoints||[]).map(w=>w.name));
 const aircraft=(raw.aircraft||[]).map(a=>{
  const copy={...a},expanded=require('./training-routes').expandRoute(a,{...catalogue,fixes:[...map.values()]},raw.waypoints);copy.route=expanded.route;copy.flightPlanRoute=a.flightPlanRoute??a.route??'';copy.arrivalRunway=expanded.arrivalRunway;copy.procedures=expanded.procedures;for(const w of expanded.waypoints){map.set(w.name,w);required.add(w.name);}
  if(a.spawnFix){const name=String(a.spawnFix).trim().toUpperCase(),fix=map.get(name);if(!fix)throw Error('Unknown spawn fix '+name+'. Import the correct sector file.');copy.lat=fix.lat;copy.lon=fix.lon;copy.spawnFix=name;required.add(name);}return copy;
 });
 const waypoints=[...required].map(name=>{const fix=map.get(name);if(!fix)throw Error('Unknown route fix '+name+'. Import the correct sector file or define it manually.');return fix;});return {...raw,magneticVariationWest:raw.magneticVariationWest??catalogue?.magneticVariationWest,waypoints,aircraft,runways:raw.runways?.length?raw.runways:catalogue?.runways||[],speedRules:raw.speedRules??require('./training-speed-data').rules};
}
module.exports={coordinate,parseSector,importSectors,resolveScenario,parseAsr,visible,sectionKinds};
