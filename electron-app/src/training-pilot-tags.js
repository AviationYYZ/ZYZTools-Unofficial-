// Private instructor UI model. Orders never change controller annotations.
const fields=['ALT','IAS','HDG','RATE','DCT','SQ','APP'];
function order(command){const p=String(command).trim().split(/\s+/);if(p.length!==2||!fields.includes(p[0]))return null;let value=p[1];if(['ALT','IAS','HDG','RATE'].includes(p[0]))value=String(Number(value));if(p[0]==='HDG'&&Number(value)===0)value='360';return {field:p[0],value};}
function annotate(a,author,kind,value,fixes=[]){
 const set=(field,value)=>{a.annotationSources??={};a.annotationSources[field]={author,value:String(value)};};
 if(kind==='TA'){set('ALT',Number(value)>2?Number(value):'');set('APP',Number(value)===1?'CLEAR':Number(value)===2?'VISUAL':'CANCEL');}
 if(kind==='BC')set('SQ',value);
 if(kind==='SC'){const text=String(value||'').toUpperCase();let m;if((m=text.match(/^H(\d{1,3})$/)))set('HDG',Number(m[1])%360||360);else if((m=text.match(/^S(\d{2,3})$/)))set('IAS',Number(m[1]));else if((m=text.match(/^R(-?\d{1,4})$/)))set('RATE',Math.abs(Number(m[1])));else if(fixes.some(w=>w.name===text))set('DCT',text);else if(!text)for(const f of ['HDG','IAS','RATE','DCT'])set(f,'');}
}
function matched(a,controller,field,selected){const source=a.annotationSources?.[field];return !!selected&&selected.state==='done'&&!!source&&source.author!==controller&&source.value===selected.value&&(!a.trackingController||a.trackingController===controller||source.author===a.trackingController);}
function rows(snapshot,peer,orders){return snapshot.aircraft.filter(a=>a.active).map(a=>{const values=[a.callsign,a.type,a.trackingController||'-'];for(const field of fields){const selected=orders.get(a.callsign)?.[field],own=selected?.peer===peer?selected:null;values.push(own?.value||'-',matched(a,peer.controller,field,own)?'1':'0',own?.state||'-');}return values.join('|');});}
function menu(field,a,shot){
 if(field==='ALT')return Array.from({length:120},(_,i)=>String((i+1)*500));
 if(field==='IAS')return Array.from({length:65},(_,i)=>String(80+i*5));
 if(field==='HDG')return Array.from({length:72},(_,i)=>String((i+1)*5));
 if(field==='RATE')return Array.from({length:23},(_,i)=>String(500+i*250));
 if(field==='DCT')return [...new Set([...(a.remaining||[]),...(shot.fixes||[]).map(w=>w.name)])].slice(0,2000);
 if(field==='SQ')return [...new Set([a.assignedSquawk,a.squawk,...shot.aircraft.map(a=>a.assignedSquawk||a.squawk),'1000','1200','2000'].filter(v=>/^[0-7]{4}$/.test(v)))];
 if(field==='APP')return ['CLEAR','CANCEL'];throw Error('Unknown pilot field.');
}
module.exports={fields,order,annotate,matched,rows,menu};
