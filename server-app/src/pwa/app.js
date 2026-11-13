'use strict';
const $=id=>document.getElementById(id);
let token='',slots=[],slotId=0,shot=null,context=0,refreshing=false,busy=false,fresh=false,target=null;
const notice=(value,id='notice')=>{$(id).textContent=value;};
const clock=seconds=>{const n=Math.max(0,Math.ceil(seconds||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
const selectedSlot=()=>slots.find(s=>s.id===slotId);
const selectedAircraft=()=>shot?.aircraft.find(a=>a.active&&a.callsign===target?.callsign);
function canEdit(){return !busy&&fresh&&target?.sessionId===shot?.sessionId&&target?.slot===slotId&&target?.epoch===selectedSlot()?.epoch&&!!selectedAircraft();}
async function request(path,body){
 const headers={Accept:'application/json'};
 if(token)headers.Authorization='Bearer '+token;
 if(body!==undefined)headers['Content-Type']='application/json';
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const result=await fetch(path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',redirect:'error',signal:controller.signal});
  const data=await result.json();
  if(!result.ok){const error=Error(data.error||'Request failed.');error.status=result.status;throw error;}
  return data;
 }finally{clearTimeout(timer);}
}
function draw(){
 $('pairForm').hidden=!!token;$('session').hidden=!token;
 $('slot').replaceChildren(...slots.map(s=>new Option(s.name+' · '+s.state,s.id,false,s.id===slotId)));
 $('slot').disabled=busy;
 const s=selectedSlot();
 $('sessionState').textContent=s?[s.scenarioName||'No scenario',s.state,clock(shot?.elapsed??s.elapsed),s.clients+' scope connection(s)',shot?.weatherLabel].filter(Boolean).join(' · '):'No server slot selected.';
 $('run').disabled=busy||!fresh||s?.state!=='paused';$('pause').disabled=busy||!fresh||s?.state!=='running';
 const all=shot?.aircraft||[],next=all.filter(a=>!a.active).sort((a,b)=>a.spawnTime-b.spawnTime)[0];
 $('queue').textContent=next?'Next: '+next.callsign+' in '+clock(next.spawnTime-shot.elapsed)+(shot.running?'':' · paused'):'No aircraft queued';
 const terms=$('search').value.trim().toUpperCase().split(/\s+/).filter(Boolean);
 const visible=all.filter(a=>terms.every(t=>[a.callsign,a.arrivalRunway,a.type,a.remaining?.[0]].join(' ').toUpperCase().includes(t))).sort((a,b)=>a.callsign.localeCompare(b.callsign,undefined,{numeric:true}));
 $('rosterCount').textContent=visible.length+' shown · '+all.filter(a=>a.active).length+' active';
 $('roster').replaceChildren(...visible.map(a=>{
  const row=document.createElement(a.active?'button':'div'),name=document.createElement('strong'),detail=document.createElement('small');
  name.textContent=a.callsign+' · '+a.type+' · '+(a.arrivalRunway||'—');
  detail.textContent=a.active?Math.round(a.altitude)+' ft · '+Math.round(a.ias??0)+' IAS · '+(a.navigationNotice||(a.paused?'Paused':a.explicitDirectFix?'DCT '+a.explicitDirectFix:a.remaining?.[0]||'Vectors')):'Queued · '+clock(a.spawnTime-shot.elapsed);
  if(a.active){row.type='button';row.disabled=busy||!fresh;row.onclick=()=>openAircraft(a);}
  row.append(name,detail);return row;
 }));
 const journal=shot?.instructorJournal||[];
 $('entries').replaceChildren(...journal.slice().reverse().map(e=>{const li=document.createElement('li');li.textContent=clock(e.time)+' · '+e.callsign+' · '+e.action;return li;}));
 if(!journal.length){const li=document.createElement('li');li.textContent='No accepted instructions in this session.';$('entries').append(li);}
 $('sendInstruction').disabled=$('sendRoute').disabled=!canEdit();
 const selected=selectedAircraft();
 if($('aircraftDialog').open&&selected&&target?.sessionId===shot?.sessionId&&target.slot===slotId)
  $('aircraftDetails').textContent=[selected.type,selected.arrivalRunway,selected.navigationNotice||selected.remaining?.[0]].filter(Boolean).join(' · ');
}
function openAircraft(a){
 if(!fresh||!a.active||busy)return;
 target={slot:slotId,epoch:selectedSlot().epoch,sessionId:shot.sessionId,callsign:a.callsign};
 $('aircraftTitle').textContent=a.callsign;
 $('aircraftDetails').textContent=[a.type,a.arrivalRunway,a.navigationNotice||a.remaining?.[0]].filter(Boolean).join(' · ');
 const choices=[...new Set([a.arrivalRunway,...(shot.runways||[]).filter(r=>r.airport===a.destination).map(r=>r.name)].filter(Boolean))];
 $('runwayChoices').replaceChildren(...choices.map(r=>new Option(r,r)));$('runway').value=a.arrivalRunway||'';
 $('filedRoute').value=a.flightPlanRoute||'';$('instruction').value='';notice('','aircraftNotice');draw();$('aircraftDialog').showModal();
}
function disconnect(message='Disconnected.'){
 context++;token='';shot=null;slots=[];slotId=0;fresh=false;target=null;
 if($('aircraftDialog').open)$('aircraftDialog').close();
 draw();notice(message);
}
async function refresh(){
 if(!token||refreshing||busy||document.hidden)return;
 const id=context;refreshing=true;
 try{
  const status=await request('/api/instructor/status');
  if(id!==context)return;
  if(status.service!=='ZYZTools Instructor'||status.role!=='instructor'||status.apiVersion!==1||!Array.isArray(status.slots))throw Error('This server does not support instructor access.');
  slots=status.slots;if(!selectedSlot())slotId=slots[0]?.id||0;
  const s=selectedSlot(),data=['running','paused'].includes(s?.state)?await request('/api/instructor/aircraft/'+s.id):null;
  if(id!==context)return;
  shot=data;fresh=true;notice('');
 }catch(e){
  if(id!==context)return;
  if(e.status===401){disconnect('Pairing expired. Enter the current instructor code.');return;}
  fresh=false;notice(e.status?e.message:'Server unreachable. Controls paused until the connection recovers.');
 }finally{refreshing=false;draw();}
}
async function send(action,payload,identity){
 const s=selectedSlot();
 if(busy||!fresh||!s||identity&&!canEdit())return false;
 busy=true;draw();
 try{
  await request('/api/instructor/action',{requestId:crypto.randomUUID(),slot:s.id,epoch:s.epoch,action,payload});
  notice('Accepted by '+s.name+'.',identity?'aircraftNotice':'notice');return true;
 }catch(e){
  if(e.status===401){disconnect('Pairing expired. Enter the current instructor code.');return false;}
  notice(e.status?e.message:'No confirmation received. Check the aircraft or slot state before trying again.',identity?'aircraftNotice':'notice');
  return false;
 }finally{busy=false;await refresh();}
}
$('pairForm').onsubmit=async e=>{
 e.preventDefault();if(busy)return;
 busy=true;notice('Pairing…');
 try{const result=await request('/instructor/pair',{code:$('code').value});if(!/^[a-f0-9]{64}$/.test(result.token))throw Error('Invalid pairing response.');context++;token=result.token;$('code').value='';}
 catch(e){notice(e.status?e.message:'Cannot reach the private server.');}
 finally{busy=false;await refresh();}
};
$('slot').onchange=()=>{slotId=Number($('slot').value);context++;fresh=false;shot=null;draw();refresh();};
$('disconnect').onclick=()=>disconnect();
$('run').onclick=()=>send('run',{});
$('pause').onclick=()=>send('pause',{});
$('search').oninput=draw;
$('closeAircraft').onclick=()=>$('aircraftDialog').close();
for(const button of document.querySelectorAll('[data-draft]'))button.onclick=()=>{$('instruction').value=button.dataset.draft;$('instruction').focus();};
$('commandForm').onsubmit=async e=>{
 e.preventDefault();const command=$('instruction').value.trim().toUpperCase();
 if(!canEdit()||!command||!confirm('Send '+command+' to '+target.callsign+'?'))return;
 if(await send('command',{sessionId:target.sessionId,callsign:target.callsign,command},target))$('instruction').value='';
};
$('routeForm').onsubmit=async e=>{
 e.preventDefault();if(!canEdit())return;
 const fields={arrivalRunway:$('runway').value.trim().toUpperCase(),flightPlanRoute:$('filedRoute').value.trim().toUpperCase()};
 if(!fields.flightPlanRoute||!confirm('Change '+target.callsign+' to runway '+(fields.arrivalRunway||'unassigned')+' and apply this filed route?'))return;
 const edited=target;
 if(await send('amend',{sessionId:edited.sessionId,callsign:edited.callsign,fields},edited)&&target===edited){
  const saved=selectedAircraft();
  if(saved){$('runway').value=saved.arrivalRunway||'';$('filedRoute').value=saved.flightPlanRoute||'';}
 }
};
for(const b of document.querySelectorAll('nav [data-page]'))b.onclick=()=>{for(const other of document.querySelectorAll('nav [data-page]')){other.setAttribute('aria-pressed',String(b===other));$(other.dataset.page).hidden=b!==other;}};
window.ZYZCalculators.mount($('calculators'));
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
setInterval(refresh,4000);document.addEventListener('visibilitychange',()=>{if(document.hidden){context++;fresh=false;}else{draw();refresh();}});draw();
