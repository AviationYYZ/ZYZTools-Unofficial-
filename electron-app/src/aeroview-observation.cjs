// Prototype: parse only text from the visible CYYZ widgets. No private API,
// credentials, browser storage, or forwarding is used by this module.
'use strict';
const maxAge=15*60_000;
function utc(value){
 const m=String(value).match(/^(\d{4}-\d\d-\d\d)[ T](\d\d:\d\d)(?::(\d\d))?Z$/);
 if(!m)return null;
 const iso=m[1]+'T'+m[2]+':'+(m[3]||'00')+'.000Z',time=Date.parse(iso);
 return Number.isFinite(time)&&new Date(time).toISOString()===iso?time:null;
}
function quality(at,now){
 return at===null||at>now+60_000?'unavailable':now-at>=maxAge?'stale':'current';
}
function wind(field,widget,now=Date.now()){
 if(!['north','south'].includes(field))throw Error('Select the North or South Field tab explicitly.');
 const text=String(widget).replace(/\s+/g,' ').trim();
 const observedAt=utc(text.match(/Wind Data Last Updated at\s+(\d{4}-\d\d-\d\d[ T]\d\d:\d\d(?::\d\d)?Z)/i)?.[1]);
 const reading=text.match(/(?:^|\s)(\d{1,3}|VRB)\s*°?\s*(\d{1,3})\s*(?:G\s*(\d{1,3})\s*)?kts?\b/i);
 const dir=reading&&reading[1].toUpperCase(),speed=reading&&Number(reading[2]),gust=reading?.[3]===undefined?null:Number(reading[3]);
 if(!reading||(dir!=='VRB'&&Number(dir)>360)||speed>200||(gust!==null&&(gust<speed||gust>200))||quality(observedAt,now)==='unavailable')
  return {field,status:'unavailable',observedAt:null};
 return {field,status:quality(observedAt,now),observedAt,direction:dir==='VRB'?dir:Number(dir),speed,gust};
}
function atis(widget,now=Date.now()){
 const text=String(widget).replace(/\s+/g,' ').trim();
 const m=text.match(/^ATIS Message\s+Last Updated\s+(\d{4}-\d\d-\d\d[ T]\d\d:\d\d(?::\d\d)?Z)\s+(CYYZ\s+(?:(ARR|DEP)\s+)?ATIS\b.{1,1900})$/i);
 if(!m)return null;
 const updatedAt=utc(m[1]);
 if(quality(updatedAt,now)==='unavailable')return null;
 return {airport:'CYYZ',kind:m[3]?.toUpperCase()||'combined',updatedAt,status:quality(updatedAt,now),text:m[2]};
}
module.exports={wind,atis,quality};
