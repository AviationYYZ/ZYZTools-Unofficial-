'use strict';
const fs=require('node:fs'),path=require('node:path');
function formatWind(row,now=Date.now()){
 if(!row||!Number.isSafeInteger(row.observedAt)||row.observedAt>now+60_000)return 'Unavailable';
 const time=new Date(row.observedAt).toISOString().slice(11,16)+'Z';
 if(row.status==='stale'||now-row.observedAt>=900_000)return 'Stale ('+time+')';
 const dir=row.direction,spd=row.speed,gust=row.gust;
 if(row.status!=='current'||!(dir==='VRB'||Number.isInteger(dir)&&dir>=0&&dir<=360)||!Number.isInteger(spd)||spd<0||spd>200||
   (gust!==null&&(!Number.isInteger(gust)||gust<spd||gust>200)))return 'Unavailable';
 return String(dir).padStart(3,'0')+'/'+String(spd).padStart(2,'0')+(gust===null?'':'G'+gust)+' kt  '+time;
}
function writeWind(folder,feed,now=Date.now()){
 if(!folder||!fs.existsSync(path.join(folder,'PreferredCYYZPdcPlugin.dll')))return;
 const target=path.join(folder,'AeroViewWind.json'),temp=target+'.tmp';
 if(!feed){try{fs.unlinkSync(target);}catch{}return;}
 fs.writeFileSync(temp,JSON.stringify({received_at:Math.floor(now/1000),north:formatWind(feed.wind?.north,now),south:formatWind(feed.wind?.south,now)}));
 fs.renameSync(temp,target);
}
module.exports={formatWind,writeWind};
