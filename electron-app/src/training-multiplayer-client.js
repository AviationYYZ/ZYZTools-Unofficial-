(()=>{'use strict';const $=id=>document.getElementById(id);let token='',state=null,polling=false,busy=false,editing=null;
const fields=['flightRules','type','wake','equipment','origin','destination','alternate','cruiseAltitude','cruiseSpeed','departureTime','actualDepartureTime','enrouteHours','enrouteMinutes','fuelHours','fuelMinutes','remarks','flightPlanRoute','arrivalRunway','squawk'];
for(const name of fields){const label=document.createElement('label');label.textContent=name;const input=document.createElement(name==='flightPlanRoute'||name==='remarks'?'textarea':'input');input.id='fp_'+name;label.append(input);$('fields').append(label);}
async function request(url,value){const response=await fetch(url,{method:value?'POST':'GET',headers:{Authorization:'Bearer '+token,...(value?{'Content-Type':'application/json'}:{})},body:value?JSON.stringify(value):undefined,cache:'no-store',signal:AbortSignal.timeout(8000)});const result=await response.json();if(!response.ok){if(response.status===401)token='';throw Error(result.error||'Request failed.');}return result;}
function message(text){$('status').textContent=text;}
function details(){const a=state?.aircraft.find(a=>a.callsign===$('selected').value);$('details').textContent=a?[a.callsign,'Target altitude '+a.targetAltitude,'Target IAS '+Math.round(a.targetIAS),'Target heading '+Math.round(a.targetMagneticHeading??a.targetHeading)+' M',a.approachState,a.speedMode].join(' | '):'Select aircraft';}
function draw(){
 $('login').hidden=true;
 const selected=$('selected').value,focused=document.activeElement?.dataset?.callsign,labels=[...document.querySelectorAll('thead th')].map(t=>t.textContent);
 $('selected').replaceChildren();$('aircraft').replaceChildren();
 for(const a of state.aircraft){
  const row=document.createElement('tr');row.dataset.callsign=a.callsign;let index=0;
  for(const value of [a.callsign,a.type,Math.round(a.altitude),Math.round(a.ias)+' / '+Math.round(a.speed),Math.round(a.magneticHeading??a.heading),a.arrivalRunway+' / '+(a.remaining?.[0]||'END'),a.squawk+(a.squawk!==a.assignedSquawk?' assigned '+a.assignedSquawk:''),!a.active?'Spawn +'+a.spawnTime+'s':a.paused?'PAUSED':a.navigation]){const c=document.createElement('td');c.dataset.label=labels[index++];c.textContent=value;row.append(c);}
  if(a.active){
   const o=document.createElement('option');o.value=a.callsign;o.textContent=a.callsign;$('selected').append(o);
   if(!state.readOnly){row.tabIndex=0;row.setAttribute('aria-label','Select '+a.callsign);row.onclick=()=>{editing=null;$('selected').value=a.callsign;details();for(const r of $('aircraft').children)r.setAttribute('aria-selected',String(r===row));if(matchMedia('(max-width:700px)').matches)$('controls').scrollIntoView({block:'start'});};row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();row.click();}};}
  }
  $('aircraft').append(row);
 }
 if([...$('selected').options].some(o=>o.value===selected))$('selected').value=selected;
 for(const row of $('aircraft').children){row.setAttribute('aria-selected',String(row.dataset.callsign===$('selected').value));if(row.dataset.callsign===focused)row.focus({preventScroll:true});}
 document.querySelector('.jump').hidden=state.readOnly===true;
 details();$('fixes').textContent=state.fixes.map(w=>w.name).join(' · ');$('log').textContent=state.log.map(l=>'+'+Math.floor(l.time)+'s '+l.callsign+' '+l.action).join('\n');
 for(const b of document.querySelectorAll('#send,#quick button,#save'))b.disabled=busy||!state.listening||!state.running;
}
async function refresh(){if(!token||polling)return;polling=true;try{const next=await request('/api/status');if(state&&state.sessionId!==next.sessionId)editing=null;state=next;draw();$('selected').closest('section').hidden=state.readOnly===true;$('fields').closest('section').hidden=state.readOnly===true;message((state.readOnly?'STUDENT VIEW · ':'')+state.name+' | '+(state.running?'RUNNING':state.listening?'PAUSED — instructor must Run':'HOST STOPPED')+' | +'+Math.floor(state.elapsed)+'s');}catch(e){message('Disconnected / not refreshed: '+e.message);state=null;$('send').disabled=true;}finally{polling=false;}}
async function apply(action,data){if(!token||!state||busy)return;busy=true;draw();try{await request('/api/action',{action,sessionId:state.sessionId,requestId:crypto.randomUUID(),callsign:$('selected').value,...data});if(action==='command'&&$('command').value.trim().toUpperCase()===data.command)$('command').value='';await refresh();}catch(e){message(e.message);}finally{busy=false;if(state)draw();}}
$('connect').onclick=()=>{token=$('key').value.trim();$('key').value='';state=null;refresh();};$('disconnect').onclick=()=>{token='';state=null;editing=null;$('login').hidden=false;$('aircraft').replaceChildren();$('selected').replaceChildren();for(const b of document.querySelectorAll('#send,#quick button,#save'))b.disabled=true;message('Disconnected; access key forgotten.');};
$('selected').onchange=()=>{editing=null;details();};$('send').onclick=()=>apply('command',{command:$('command').value.trim().toUpperCase()});$('command').onkeydown=e=>{if(e.key==='Enter')$('send').click();};for(const b of document.querySelectorAll('[data-command]'))b.onclick=()=>apply('command',{command:b.dataset.command});
$('edit').onclick=()=>{const a=state?.aircraft.find(a=>a.callsign===$('selected').value);if(!a)return;editing={callsign:a.callsign,sessionId:state.sessionId};for(const name of fields)$('fp_'+name).value=a[name]??'';};
$('save').onclick=()=>{if(!editing||editing.callsign!==$('selected').value||editing.sessionId!==state?.sessionId)return message('Load the selected flight plan before editing.');const values={};for(const name of fields)values[name]=$('fp_'+name).value;apply('amend',{fields:values});};
// Remove the invite credential from the address/history before authenticating.
function consumeInvite(){if(!location.hash)return;const inviteKey=new URLSearchParams(location.hash.slice(1)).get('zyz');history.replaceState(null,'',location.pathname+location.search);state=null;editing=null;if(/^[a-f0-9]{64}$/.test(inviteKey||'')){token=inviteKey;refresh();}else{token='';message('Invalid invite. Ask the host to copy a fresh invite.');}}
window.addEventListener('hashchange',consumeInvite);consumeInvite();
setInterval(refresh,1000);
})();
