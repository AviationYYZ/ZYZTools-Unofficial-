// Offline catalogue lookup. Sector coordinates win; ambiguous global names
// must not silently send an aircraft to a different continent.
const cache=new WeakMap();
function parsePoints(text){const points=[];for(const raw of String(text).split(/\r?\n/)){const p=raw.trim().split(/\s+/);if(!/^[A-Z0-9_-]{1,16}$/i.test(p[0]||'')||p.length<3)continue;const lat=Number(p[1]),lon=Number(p[2]);if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>89||Math.abs(lon)>180)continue;points.push([p[0].toUpperCase(),lat,lon]);}return points;}
function lookup(catalogue,name){
 const source=catalogue.navPoints||catalogue;let index=cache.get(source);if(!index){index=new Map();for(const [name,lat,lon]of catalogue.navPoints||[]){const rows=index.get(name)||[];if(!rows.some(w=>Math.hypot(w.lat-lat,w.lon-lon)<.001))rows.push({name,lat,lon,kind:'NAVDATA'});index.set(name,rows);}cache.set(source,index);}
 const rows=index.get(name)||[];if(rows.length===1)return rows[0];if(!rows.length)return null;
 // A unique candidate within the imported sector's fix envelope is preferred
 // to distant namesakes. Two local candidates remain explicitly ambiguous.
 const bounds=catalogue.navBounds;if(bounds){const local=rows.filter(w=>w.lat>=bounds.south&&w.lat<=bounds.north&&w.lon>=bounds.west&&w.lon<=bounds.east);if(local.length===1)return local[0];}
 throw Error('Ambiguous navdata fix '+name+'. Define its coordinates explicitly in the scenario.');
}
module.exports={parsePoints,lookup};
