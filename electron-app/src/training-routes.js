// Offline route expansion only. No network, chart guessing or live-client access.
const key=w=>w.name+'@'+Number(w.lat).toFixed(4)+','+Number(w.lon).toFixed(4);
function parseEse(text){const result=[];for(const line of String(text).split(/\r?\n/)){const p=line.split(';')[0].trim().split(':');if(!['SID','STAR'].includes(p[0])||p.length<5)continue;const route=p[4].trim().toUpperCase().split(/\s+/),name=route.shift();if(!/^[A-Z0-9]+$/.test(name))continue;result.push({kind:p[0],airport:p[1],runway:p[2],name,fixes:route});}return result;}
function parseAirways(text){const edges=[];for(const raw of String(text).split(/\r?\n/)){if(!raw||raw.startsWith(';'))continue;const p=raw.split('\t'),point=(name,lat,lon)=>({name,lat:Number(lat),lon:Number(lon)});if(p.length<16)continue;const a=point(p[0],p[1],p[2]);if(!/^[A-Z0-9_-]+$/.test(a.name)||!Number.isFinite(a.lat)||!Number.isFinite(a.lon))continue;for(const i of [6,11]){if(!p[i]||!p[i+1]||!p[i+2])continue;const b=point(p[i],p[i+1],p[i+2]);if(Number.isFinite(b.lat)&&Number.isFinite(b.lon)&&Math.abs(b.lat)<=89&&Math.abs(b.lon)<=180)edges.push({name:p[4],from:a,to:b});}}return edges;}
function airwayPath(name,from,to,catalogue,map){
 const edges=(catalogue.airways||[]).filter(e=>e.name===name),nodes=new Map(),graph=new Map();
 const canonical=w=>map.has(w.name)&&Math.hypot(map.get(w.name).lat-w.lat,map.get(w.name).lon-w.lon)<.03?map.get(w.name):w;
 for(const e of edges){const from=canonical(e.from),to=canonical(e.to);for(const w of [from,to])nodes.set(key(w),w);const a=key(from),b=key(to);if(!graph.has(a))graph.set(a,new Set());if(!graph.has(b))graph.set(b,new Set());graph.get(a).add(b);graph.get(b).add(a);}
 const matches=n=>[...nodes].filter(([,w])=>w.name===n&&(!map.has(n)||Math.hypot(map.get(n).lat-w.lat,map.get(n).lon-w.lon)<.03)).map(([id])=>id);
 const starts=matches(from),ends=new Set(matches(to));if(starts.length!==1||ends.size!==1)throw Error('Airway '+name+' entry/exit '+from+'/'+to+' is missing or geographically ambiguous.');
 const queue=[starts[0]],previous=new Map([[starts[0],null]]);let found=null;
 for(let i=0;i<queue.length;i++){const id=queue[i];if(ends.has(id)){found=id;break;}for(const next of graph.get(id)||[])if(!previous.has(next)){previous.set(next,id);queue.push(next);}}
 if(!found)throw Error('No connected '+name+' segment from '+from+' to '+to+'.');
 const result=[];for(let id=found;id!==null;id=previous.get(id))result.unshift(nodes.get(id));return result;
}
function expandRoute(aircraft,catalogue,waypoints=[]){
 const map=new Map([...(catalogue.fixes||[]),...waypoints].map(w=>[w.name,w])),route=[],usedProcedures=[];
 if(aircraft.compiledPlan===aircraft.flightPlanRoute&&aircraft.compiledRunway===(aircraft.arrivalRunway||'')&&aircraft.route&&aircraft.route.split(' ').every(n=>map.has(n)))return {route:aircraft.route,waypoints:aircraft.route.split(' ').map(n=>map.get(n)),arrivalRunway:aircraft.arrivalRunway||'',procedures:aircraft.procedures||[]};
 const tokens=String(aircraft.flightPlanRoute??aircraft.route??'').trim().toUpperCase().split(/\s+/).filter(Boolean);
 let arrivalRunway=aircraft.arrivalRunway||'';
 for(const t of tokens){const m=t.match(new RegExp('^'+(aircraft.destination||'CYYZ')+'/(\\d{2}[LRC]?)$'));if(m)arrivalRunway=m[1];}
 function add(name){if(!map.has(name))throw Error('Unknown flight-plan fix '+name+'. Import its sector/navdata.');if(route.at(-1)!==name)route.push(name);}
 for(let i=0;i<tokens.length;i++){
  const raw=tokens[i];if(raw==='DCT'||/^N\d{4}F\d{3}$/.test(raw))continue;
  const [name,suffix]=raw.split('/');if(name===aircraft.origin||name===aircraft.destination)continue;
  if(map.has(name)){add(name);continue;}
  if((catalogue.airways||[]).some(e=>e.name===name)){
   if(!route.length||!tokens[i+1])throw Error('Use ENTRY '+name+' EXIT for an airway.');
   const exit=tokens[++i].split('/')[0],points=airwayPath(name,route.at(-1),exit,catalogue,map);for(const w of points){const old=map.get(w.name);if(old&&Math.hypot(old.lat-w.lat,old.lon-w.lon)>.03)throw Error('Ambiguous airway fix '+w.name);map.set(w.name,w);add(w.name);}continue;
  }
  let candidates=(catalogue.procedures||[]).filter(p=>{const wanted=suffix||(p.kind==='STAR'?arrivalRunway:'');return p.name===name&&p.airport===(p.kind==='STAR'?(aircraft.destination||'CYYZ'):aircraft.origin)&&(!wanted||p.runway===wanted);});
  if(route.length&&candidates.some(p=>p.fixes.includes(route.at(-1))))candidates=candidates.filter(p=>p.fixes.includes(route.at(-1)));
  else if(candidates.some(p=>p.fixes[0]===name.replace(/\d+[A-Z]?$/,'')))candidates=candidates.filter(p=>p.fixes[0]===name.replace(/\d+[A-Z]?$/,''));
  // Transitions sharing an entry fix have the same remaining path. Compare
  // that suffix, not the different upstream fixes already bypassed by entry.
  const entry=route.at(-1);
  const unique=new Map(candidates.map(p=>[p.fixes.slice(Math.max(0,p.fixes.indexOf(entry))).join(' '),p]));if(unique.size!==1)throw Error((unique.size?'Select an arrival runway/transition for ':'Unknown route item ')+raw+'. Import the matching .ese/navdata.');
  const p=[...unique.values()][0],start=p.fixes.indexOf(route.at(-1));for(const f of p.fixes.slice(Math.max(0,start)))add(f);usedProcedures.push(p.name);if(p.kind==='STAR')arrivalRunway=suffix||arrivalRunway;
 }
 return {route:route.join(' '),waypoints:route.map(n=>map.get(n)),arrivalRunway,procedures:usedProcedures};
}
module.exports={parseEse,parseAirways,expandRoute,airwayPath};
