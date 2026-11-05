// Private instructor UI model. Orders never change controller annotations.
const fields=['ALT','IAS','HDG','RATE','DCT','SQ','APP','MACH'];
function order(command){const p=String(command).trim().split(/\s+/);if(p[0]==='HDG'&&p[1]==='PRESENT')return {field:'HDG',value:'PRESENT'};if(p.length===4&&p[0]==='IAS'&&p[2]==='UNTIL')return {field:'IAS',value:String(Number(p[1])),untilFix:p[3]};if(p.length===4&&p[0]==='CROSS'&&p[2]==='AT')return {field:'ALT',value:String(Number(p[3]))};if(p.length!==2||!fields.includes(p[0]))return null;let value=p[1];if(['ALT','IAS','HDG','RATE','MACH'].includes(p[0]))value=String(Number(value));if(p[0]==='HDG'&&Number(value)===0)value='360';return {field:p[0],value};}
function annotate(a,author,kind,value,fixes=[]){
 const set=(field,value)=>{a.annotationSources??={};a.annotationSources[field]={author,value:String(value)};};
 if(kind==='TA'){set('ALT',Number(value)>2?Number(value):'');set('APP',Number(value)===1?'CLEAR':Number(value)===2?'VISUAL':'CANCEL');}
 if(kind==='BC')set('SQ',value);
 if(kind==='SC'){const text=String(value||'').toUpperCase();let m;if((m=text.match(/^H(\d{1,3})$/))){set('HDG',Number(m[1])%360||360);set('DCT','');}else if((m=text.match(/^S(\d{2,3})$/))){set('IAS',Number(m[1]));set('MACH','');}else if((m=text.match(/^M(0?\.\d{1,2}|\d{2,3})$/))){const n=Number(m[1]);set('MACH',n>=1?n/100:n);set('IAS','');}else if((m=text.match(/^R(-?\d{1,4})$/)))set('RATE',Math.abs(Number(m[1])));else if(fixes.some(w=>w.name===text)){set('DCT',text);set('HDG','');}else if(!text)for(const f of ['HDG','IAS','MACH','RATE','DCT'])set(f,'');}
}
function matched(a,controller,field,selected){const source=a.annotationSources?.[field];return !!selected&&selected.state==='done'&&!!source&&source.author!==controller&&source.value===selected.value&&(!a.trackingController||a.trackingController===controller||source.author===a.trackingController);}
function rows(snapshot,peer,orders){return snapshot.aircraft.filter(a=>a.active).map(a=>{const values=[a.callsign,a.type,a.trackingController||'-'],own={};for(const field of fields){const selected=orders.get(a.callsign)?.[field];own[field]=selected?.peer===peer&&(!selected.untilFix||selected.state!=='done'||a.speedRestrictions?.some(r=>r.fix===selected.untilFix))?selected:null;values.push(own[field]?.value||'-',matched(a,peer.controller,field,own[field])?'1':'0',own[field]?.state||'-');}const actual=[Math.round(a.altitude),Math.round(a.speed),Math.round(a.ias||0),Math.round(a.magneticHeading||0),Math.round(a.paused||!snapshot.running?0:a.verticalSpeed||0),a.remaining?.[0]||'-',a.destination||'-',a.squawk||'-',String(a.scratchpad||'-').replaceAll('|',' '),a.clearedAltitude||0,a.cruiseAltitude||0];values.push(...actual);const newer=(a,b)=>own[a]&&(!own[b]||(own[a].revision||0)>(own[b].revision||0));values.push(newer('APP','ALT')?'APP':'ALT',newer('MACH','IAS')?'MACH':'IAS',newer('DCT','HDG')?'DCT':'HDG');values.push(a.lat,a.lon,a.approachState&&a.approachState!=="off"?"1":"0",a.flightRules||"I",a.wake||"M",a.targetAltitude??a.altitude,a.heading);return values.join('|');});}
function menu(field,a,shot){
 if(field==='ADV')return ['Delete aircraft','Enter squawk','IDENT','Clear speed restrictions','Custom speed restrictions','Crossing altitude restrictions',...(a.crossingRestrictions?.length?['Clear crossing restrictions']:[])];
 if(field==='ALT')return ['Cleared approach',...Array.from({length:60},(_,i)=>String((i+1)*10).padStart(3,'0'))];
 if(field==='MACH')return Array.from({length:60},(_,i)=>((40+i)/100).toFixed(2));
 if(field==='IAS')return Array.from({length:65},(_,i)=>String(80+i*5));
 if(field==='HDG')return ['Enter custom heading...','Fly present heading',...Array.from({length:72},(_,i)=>String((i+1)*5))];
 if(field==='RATE')return Array.from({length:23},(_,i)=>String(500+i*250));
 if(field==='DCT')return ['Type waypoint...',...[...new Set([...(a.remaining||[]),...(shot.fixes||[]).map(w=>w.name)])].slice(0,2000)];
 if(field==='SQ')return [...new Set([a.assignedSquawk,a.squawk,...shot.aircraft.map(a=>a.assignedSquawk||a.squawk),'1000','1200','2000'].filter(v=>/^[0-7]{4}$/.test(v)))];
 if(field==='APP')return ['CLEAR','CANCEL'];throw Error('Unknown pilot field.');
}
module.exports={fields,order,annotate,matched,rows,menu};
