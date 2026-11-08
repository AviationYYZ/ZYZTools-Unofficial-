(()=>{'use strict';const api=window.preferredCyyzPdc.trainingInstructor,$=id=>document.getElementById(id);if(!api)return;
let state=null,aircraft=null,slot=1,busy=false,polling=false,connected=false,editing=null,generation=0,selectionRevision=0,requestedSelection=null,draftTarget=null,rosterContext='';
const profileEditor=new window.ZYZSpeedProfileEditor('instructorSpeedProfile',async profile=>{if(!state||!connected||busy)throw Error('Connect to your instructor server first.');const s=state.slots.find(s=>s.id===slot);if(!s)throw Error('Choose a server slot.');await api('action',{slot,epoch:s.epoch,action:'speedProfile',payload:{profile}});await refresh();});
const fields=['flightRules','type','wake','equipment','origin','destination','alternate','cruiseAltitude','cruiseSpeed','departureTime','actualDepartureTime','enrouteHours','enrouteMinutes','fuelHours','fuelMinutes','remarks','flightPlanRoute','arrivalRunway','squawk'];
const labels={flightRules:'Flight rules (I / V)',type:'Aircraft type',wake:'Wake category',equipment:'Equipment',origin:'Departure',destination:'Arrival',alternate:'Alternate',cruiseAltitude:'Cruise altitude · ft',cruiseSpeed:'Cruise speed · kt',departureTime:'Estimated departure · HHMM',actualDepartureTime:'Actual departure · HHMM',enrouteHours:'Enroute hours',enrouteMinutes:'Enroute minutes',fuelHours:'Fuel hours',fuelMinutes:'Fuel minutes',remarks:'Remarks',flightPlanRoute:'Filed route',arrivalRunway:'Arrival runway',squawk:'Squawk'};
for(const field of fields){const label=document.createElement('label');label.textContent=labels[field];const input=document.createElement(['remarks','flightPlanRoute'].includes(field)?'textarea':'input');input.id='instructorField_'+field;label.append(input);$('instructorFields').append(label);}
const message=text=>$('instructorMessage').textContent=text;
const callsignOrder=new Intl.Collator('en',{numeric:true});
const compare=(a,b)=>callsignOrder.compare(a.callsign,b.callsign);
const selectedAircraft=()=>aircraft?.aircraft.find(a=>a.active&&a.callsign===$('instructorSelected').value);
const navLabel=a=>a.explicitDirectFix?'DCT '+a.explicitDirectFix:a.navigation==='heading'?'HDG':a.remaining?.[0]||a.navigation;
const clock=seconds=>{const whole=Math.max(0,Math.floor(seconds||0));return Math.floor(whole/60)+':'+String(whole%60).padStart(2,'0');};
const eta=a=>Math.max(0,Math.ceil(a.spawnTime-(aircraft?.elapsed||0)));
function drawRoster(){
 const tbody=$('instructorAircraft'),selected=$('instructorSelected').value,focus=tbody.contains(document.activeElement)?document.activeElement.dataset.callsign:null;
 const all=aircraft?.aircraft||[],terms=$('instructorAircraftSearch').value.toUpperCase().trim().split(/\s+/).filter(Boolean),filter=$('instructorAircraftFilter').value;
 const visible=all.filter(a=>(filter==='all'||filter==='active'&&a.active||filter==='queued'&&!a.active||filter==='direct'&&a.active&&a.explicitDirectFix||filter==='paused'&&a.active&&a.paused)
  &&terms.every(t=>[a.callsign,a.type,a.arrivalRunway,a.remaining?.[0],a.explicitDirectFix,a.destination].join(' ').toUpperCase().includes(t)));
 const sorts={altitude:(a,b)=>b.altitude-a.altitude,runway:(a,b)=>String(a.arrivalRunway||'').localeCompare(String(b.arrivalRunway||'')),spawn:(a,b)=>a.spawnTime-b.spawnTime};
 const sort=sorts[$('instructorAircraftSort').value];visible.sort((a,b)=>(sort?.(a,b)||0)||compare(a,b));
 $('instructorAircraftCount').textContent=`${visible.length} of ${all.length} shown · ${all.filter(a=>a.active).length} spawned · ${all.filter(a=>!a.active).length} queued`;
 const rows=document.createDocumentFragment();let restoreFocus;
 for(const a of visible){
  const row=document.createElement('tr');row.dataset.callsign=a.callsign;
  row.title=[a.navigationNotice,a.speedNotice,a.crossingNotice,a.approachNotice].filter(Boolean).join(' | ');
  for(const value of [a.callsign,Math.round(a.altitude),(Number.isFinite(a.ias)?Math.round(a.ias):'—')+' / '+Math.round(a.speed),Math.round(a.magneticHeading??a.heading),a.arrivalRunway||'—',!a.active?'Spawn in '+clock(eta(a)):a.paused?'PAUSED':navLabel(a),a.squawk]){
   const c=document.createElement('td');c.textContent=value;row.append(c);
  }
  if(a.active){row.tabIndex=0;row.setAttribute('aria-selected',String(selected===a.callsign));
   const select=()=>{requestedSelection=a.callsign;editing=null;draw();};
   row.onclick=select;row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}};
   if(focus===a.callsign)restoreFocus=row;
  }
  rows.append(row);
 }
 tbody.replaceChildren(rows);
 if(focus)(restoreFocus||$('instructorAircraftSearch')).focus({preventScroll:true});
}
function downloadCSV(name,rows){
 // Treat imported plan text as data, not spreadsheet expressions.
 const csv=value=>{const text=String(value??'');return '"'+(typeof value==='string'&&/^\s*[=+@-]/.test(text)?"'"+text:text).replaceAll('"','""')+'"';};
 const url=URL.createObjectURL(new Blob([rows.map(row=>row.map(csv).join(',')).join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='ZYZTools-slot-'+slot+'-'+name+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportRoster(){
 if(!aircraft?.aircraft.length)return;
 const rows=[['Callsign','Type','State','Runway','Altitude ft','IAS kt','GS kt','Heading magnetic','Next fix','Navigation','Latitude','Longitude','Spawn seconds','Snapshot simulation seconds'],
  ...[...aircraft.aircraft].sort(compare).map(a=>[a.callsign,a.type,!a.active?'Queued':a.paused?'Paused':'Active',a.arrivalRunway,Math.round(a.altitude),Math.round(a.ias||0),Math.round(a.speed),Math.round(a.magneticHeading??a.heading),a.remaining?.[0],a.navigationNotice||navLabel(a),a.lat,a.lon,a.spawnTime,Math.floor(aircraft.elapsed||0)])];
 downloadCSV('roster',rows);
}
function drawMonitor(target){
 const all=aircraft?.aircraft||[],queue=all.filter(a=>!a.active).sort((a,b)=>a.spawnTime-b.spawnTime||compare(a,b)),next=queue[0],counts=new Map();
 $('instructorNextSpawn').textContent=next?next.callsign+' · '+clock(eta(next))+(aircraft.running?'':' (paused)'):aircraft?'No aircraft queued':'No session snapshot';
 $('instructorShowQueue').disabled=!next;
 for(const a of all){const runway=a.arrivalRunway||'Unassigned',countsForRunway=counts.get(runway)||[0,0];countsForRunway[a.active?0:1]++;counts.set(runway,countsForRunway);}
 $('instructorRunways').textContent=[...counts].sort(([a],[b])=>callsignOrder.compare(a,b)).map(([runway,[active,queued]])=>runway+': '+active+' active / '+queued+' queued').join(' · ')||'—';
 $('instructorMonitorSelection').textContent=target?target.callsign+' · '+(navLabel(target)||'—'):'No aircraft selected';
 $('instructorRevealAircraft').disabled=!target;
 const strip=$('instructorRouteStrip'),fixes=target?.navigation==='route'?(target.remaining||[]).filter(name=>!/^SP(?:15)?_/.test(name)):[];
 strip.replaceChildren(...fixes.slice(0,12).map((fix,i)=>{const item=document.createElement('li');item.textContent=fix;if(!i)item.setAttribute('aria-current','step');return item;}));
 if(fixes.length>12){const item=document.createElement('li');item.textContent='+'+(fixes.length-12)+' more';strip.append(item);}
 strip.hidden=!fixes.length;
}
function journalEntries(){
 const selected=$('instructorSelected').value,filter=$('instructorJournalSelected').checked;
 return (aircraft?.instructorJournal||[]).filter(e=>!filter||e.callsign===selected);
}
function drawJournal(){
 const entries=journalEntries();
 $('instructorJournalStatus').textContent=!aircraft?'No session snapshot.':!Array.isArray(aircraft.instructorJournal)?'The command journal requires the 2.0.10 server or later.':entries.length?entries.length+' accepted entries · newest first':'No accepted commands in this view yet.';
 $('instructorExportJournal').disabled=!entries.length;
 $('instructorJournal').replaceChildren(...entries.slice().reverse().map(e=>{
  const row=document.createElement('li'),time=document.createElement('time'),callsign=document.createElement('strong'),action=document.createElement('span');
  time.textContent=clock(e.time);callsign.textContent=e.callsign;action.textContent=e.action;
  row.append(time,callsign,action);return row;
 }));
}
function draw(){
 profileEditor.set(aircraft?.jetSpeedProfile||state?.slots.find(s=>s.id===slot)?.jetSpeedProfile,slot+'|'+(aircraft?.sessionId||''));
 $('instructorControls').hidden=!connected;$('instructorPair').hidden=connected;$('instructorSlots').replaceChildren();
 if(!state||!connected)return;
 for(const s of state.slots){const b=document.createElement('button');b.textContent=s.name+' · '+s.state;b.setAttribute('aria-pressed',String(s.id===slot));b.disabled=busy;b.onclick=()=>{slot=s.id;aircraft=null;editing=null;generation++;draw();refresh();};$('instructorSlots').append(b);}
 const s=state.slots.find(s=>s.id===slot);if(!s)return;const live=['paused','running'].includes(s.state),ready=!!s.code;
 $('instructorUpdateRate').value=String(s.positionUpdateHz??0.2);$('instructorUpdateRate').disabled=true;
 $('instructorSlotStatus').textContent=[s.name,s.scenarioName||'No scenario loaded',s.state,'+'+Math.floor(s.elapsed||0)+'s',s.clients||0,'EuroScope connection(s)',aircraft?.weatherLabel,s.error].filter(x=>x!==undefined&&x!=='').join(' · ');
 for(const id of ['instructorUpload','instructorDemo','instructorStart','instructorRun','instructorPause','instructorReset','instructorStop','instructorStudentInvite']){$(id).disabled=busy||(['starting','stopping','recovering'].includes(s.state));}
 $('instructorStart').disabled=busy||!s.hasScenario||!['stopped','error'].includes(s.state);
 $('instructorRun').disabled=busy||s.state!=='paused';$('instructorPause').disabled=busy||s.state!=='running';$('instructorReset').disabled=busy||!live;
 $('instructorStop').disabled=busy||s.state==='stopped';$('instructorStudentInvite').disabled=busy||!ready;$('instructorEuroScope').disabled=busy||!ready;
 const picker=$('instructorSelected'),context=aircraft?slot+'|'+aircraft.sessionId:'';
 const wanted=requestedSelection??(context===rosterContext?picker.value:'');requestedSelection=null;rosterContext=context;
 const active=(aircraft?.aircraft||[]).filter(a=>a.active).sort(compare),choices=['',...active.map(a=>a.callsign)];
 if(choices.length!==picker.options.length||choices.some((value,i)=>picker.options[i].value!==value))picker.replaceChildren(...choices.map(value=>new Option(value||'Select an active aircraft',value)));
 picker.value=choices.includes(wanted)?wanted:'';
 const target=selectedAircraft();$('instructorAircraftGuidance').textContent=target?[target.callsign,target.navigationNotice,(['published','restriction'].includes(target.speedMode)?target.speedNotice:target.speedMode==='mach'?'Assigned Mach '+target.targetMach:'Assigned IAS '+Math.round(target.targetIAS||0)),target.approachNotice,target.crossingNotice].filter(Boolean).join(' | '):'Select a spawned aircraft to enable controls.';
 $('instructorExportRoster').disabled=!aircraft?.aircraft.length;
 drawRoster();
 drawMonitor(target);drawJournal();
 const can=live&&!!aircraft&&!!$('instructorSelected').value&&!busy;
 for(const b of document.querySelectorAll('[data-instructor-command],#instructorSend,#instructorEdit,#instructorDeleteAircraft'))b.disabled=!can;
 $('instructorSave').disabled=!can||!editing;
}
async function refresh(){if(!connected||polling||busy)return;polling=true;let g=generation,id=slot;try{const selection=await api('euroScopeSelection');if(document.activeElement!==$('instructorPrediction'))$('instructorPrediction').value=String(selection.predictionMinutes??0);if(g!==generation)return;if(selection.enabled&&selection.revision!==selectionRevision){selectionRevision=selection.revision;if(selection.callsign&&[1,2,3,4,5,6].includes(selection.slot)){slot=selection.slot;id=slot;generation++;g=generation;editing=null;requestedSelection=selection.callsign;}}const next=await api('state');if(g!==generation)return;state=next;const s=state.slots.find(s=>s.id===id);if(s&&['paused','running'].includes(s.state)){const nextAircraft=await api('aircraft',{slot:id});if(g!==generation)return;if(aircraft?.sessionId!==nextAircraft.sessionId)editing=null;aircraft=nextAircraft;}else{aircraft=null;editing=null;}draw();}catch(e){if(g===generation){aircraft=null;draw();message(e.message);}}finally{polling=false;}}
async function connect(restore=false){if(busy)return;busy=true;message('Connecting to instructor server…');try{const result=restore?await api('restore'):await api('connect',{pairing:$('instructorPairing').value,remember:$('instructorRemember').checked});if(restore&&!result.connected){message('No saved server. Enter the instructor pairing code.');return;}state=restore?result.state:result;connected=true;generation++;$('instructorPairing').value='';message('Instructor connected. Select a server, load a scenario and start it.');draw();}catch(e){message(e.message);}finally{busy=false;await refresh();}}
async function action(action,payload,submittedDraft){if(busy||!connected||!state)return;const s=state.slots.find(s=>s.id===slot);if(!s)return;
 if(['upload','demo','reset','stop'].includes(action)&&s.state!=='stopped'&&!confirm(action==='upload'||action==='demo'?'Replace this slot’s scenario and disconnect its students?':'Apply '+action+' to this slot?'))return;
 const id=slot,g=generation;busy=true;draw();try{const result=await api(['upload','studentInvite'].includes(action)?action:'action',{slot:id,epoch:s.epoch,action,payload});if(g!==generation)return;if(result.canceled){message('Upload canceled.');return;}if(action==='command'&&submittedDraft!==undefined&&$('instructorCommand').value===submittedDraft){$('instructorCommand').value='';draftTarget=null;}if(action==='studentInvite')message('Pilot/student invite copied. Anyone with this link can control aircraft in a browser. Share only with trusted participants; never share the instructor pairing code.');else message(action==='upload'?'Scenario uploaded to server PC. Click Start paused when ready.':'Applied to '+s.name+'.');if(['upload','demo','reset','stop'].includes(action)){aircraft=null;editing=null;}}catch(e){if(g===generation)message(e.message);}finally{busy=false;await refresh();}}
for(const [id,a]of [['instructorUpload','upload'],['instructorDemo','demo'],['instructorStart','start'],['instructorRun','run'],['instructorPause','pause'],['instructorReset','reset'],['instructorStop','stop'],['instructorStudentInvite','studentInvite']])$(id).onclick=()=>action(a);
 $('instructorUpdateRate').onchange=()=>action('updateRate',{hz:Number($('instructorUpdateRate').value)});
 $('instructorPrediction').onchange=async()=>{try{await api('prediction',{minutes:Number($('instructorPrediction').value)});message('ZYZTools prediction line updated for the selected training aircraft. Disable the external PTL to avoid duplicate lines.');}catch(e){message(e.message);}};
function command(text,submittedDraft){const target=selectedAircraft();if(!target||!text.trim())return;return action('command',{sessionId:aircraft.sessionId,callsign:target.callsign,command:text.trim().toUpperCase()},submittedDraft);}
for(const id of ['instructorAircraftSearch','instructorAircraftFilter','instructorAircraftSort'])$(id).addEventListener(id==='instructorAircraftSearch'?'input':'change',drawRoster);
$('instructorExportRoster').onclick=exportRoster;
$('instructorShowQueue').onclick=()=>{$('instructorAircraftSearch').value='';$('instructorAircraftFilter').value='queued';$('instructorAircraftSort').value='spawn';drawRoster();$('instructorAircraftSearch').focus();};
$('instructorRevealAircraft').onclick=()=>{const a=selectedAircraft();if(!a)return;$('instructorAircraftFilter').value='all';$('instructorAircraftSearch').value=a.callsign;drawRoster();[...$('instructorAircraft').rows].find(row=>row.dataset.callsign===a.callsign)?.focus();};
$('instructorJournalSelected').onchange=drawJournal;
$('instructorExportJournal').onclick=()=>{const entries=journalEntries();if(entries.length)downloadCSV('instructor-journal',[['Simulation seconds','Callsign','Accepted instruction'],...entries.map(e=>[e.time,e.callsign,e.action])]);};
const commandBox=$('instructorCommand');
commandBox.addEventListener('input',()=>{if(!commandBox.value.trim())draftTarget=null;else if(!draftTarget&&aircraft&&selectedAircraft())draftTarget={session:aircraft.sessionId,callsign:selectedAircraft().callsign,slot};});
function sendDraft(){
 if(!commandBox.value.trim())return;
 if(draftTarget&&(draftTarget.session!==aircraft?.sessionId||draftTarget.callsign!==selectedAircraft()?.callsign||draftTarget.slot!==slot)){
  return message('This command was drafted for '+draftTarget.callsign+'. Reselect that aircraft or clear the draft before issuing a new command.');
 }
 return command(commandBox.value,commandBox.value);
}
$('instructorSend').onclick=sendDraft;commandBox.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)sendDraft();};for(const b of document.querySelectorAll('[data-instructor-command]'))b.onclick=()=>command(b.dataset.instructorCommand);
$('instructorDeleteAircraft').onclick=()=>{const name=$('instructorSelected').value;if(name&&confirm('Delete '+name+' from this server session? Reset/reloading restores it.'))command('DELETE AIRCRAFT');};
$('instructorSelected').onchange=()=>{editing=null;draw();};
$('instructorEdit').onclick=()=>{const a=aircraft?.aircraft.find(a=>a.callsign===$('instructorSelected').value);if(!a)return;editing={callsign:a.callsign,sessionId:aircraft.sessionId};for(const field of fields)$('instructorField_'+field).value=a[field]??'';$('instructorSave').disabled=false;};
$('instructorSave').onclick=()=>{if(!editing||editing.sessionId!==aircraft?.sessionId||editing.callsign!==$('instructorSelected').value)return message('Load the selected aircraft flight plan first.');const values={};for(const field of fields)values[field]=$('instructorField_'+field).value;action('amend',{...editing,fields:values});};
$('instructorConnect').onclick=()=>connect();$('instructorRestore').onclick=()=>connect(true);
$('instructorEuroScope').onclick=async()=>{if(busy||!state)return;busy=true;draw();try{const s=state.slots.find(s=>s.id===slot),r=await api('connectEuroScope',{slot,epoch:s.epoch});message('EuroScope connector ready: '+r.address+' (copied). Complete EuroScope’s non-VATSIM connection dialog.');}catch(e){message(e.message);}finally{busy=false;draw();}};
for(const [id,forget]of [['instructorDisconnect',false],['instructorForget',true]])$(id).onclick=async()=>{generation++;connected=false;state=null;aircraft=null;editing=null;await api('disconnect',{forget});draw();message(forget?'Pairing forgotten on this PC.':'Disconnected. Server simulations keep running.');};
setInterval(()=>{if($('training').classList.contains('active')&&!$('instructorCard').hidden)refresh();},1500);
draw();
})();
