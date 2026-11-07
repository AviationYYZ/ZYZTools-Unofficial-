(()=>{
 const api=window.preferredCyyzPdc,$=id=>document.getElementById(id);
 const features={localTraining:'Local practice',scenarioBuilder:'Scenario Builder',replay:'Audio replay',discord:'Discord status',conflictSettings:'Conflict alert settings'};
 const tabs={trainingBuilder:'scenarioBuilder',replay:'replay',discord:'discord',conflicts:'conflictSettings'};
 let state,adminKey='',adminState,busy=false,session=0;
 function update(s){
  if(!s)return;state=s;
  $('globalAnnouncement').hidden=!s.announcement;
  $('globalAnnouncement').textContent=s.announcement?'Announcement: '+s.announcement.message:'';
  $('globalMaintenance').hidden=!s.maintenance;
  for(const [tab,feature] of Object.entries(tabs)){
   const button=document.querySelector(`[data-tab="${tab}"]`),reason=blocked(feature);
   button.setAttribute('aria-disabled',String(!!reason));button.title=reason||'';
  }
 }
 function blocked(f){
  if(!f||!state)return '';
  if(state.maintenance&&f==='scenarioBuilder')return 'Scenario editing is paused for maintenance.';
  if(state.rules[f]==='disabled')return features[f]+' is disabled by the administrator.';
  if(state.rules[f]==='code'&&!state.unlocked.includes(f))return 'Enter a feature access code in Training to unlock '+features[f]+'.';
  return '';
 }
 window.zyzPolicyBlockTab=tab=>blocked(tabs[tab]);
 api.onAppPolicy?.(update);
 api.appPolicy?.().then(update).catch(()=>{});
 window.zyzTrainingSpecialCode=async value=>{
  const code=value.trim();
  if(code.toLowerCase()==='67g7z28s'){
   $('trainingInvite').value='';$('adminMenu').hidden=false;document.querySelector('[data-tab="admin"]').click();
   $('adminKey').focus();return true;
  }
  if(!/^[A-F0-9]{24}$/i.test(code))return false;
  $('trainingInvite').value='';
  try{const s=await api.redeemFeature(code);update(s);$('trainingJoinStatus').textContent='Unlocked: '+s.unlocked.map(x=>features[x]).join(', ')+'.';}
  catch(error){$('trainingJoinStatus').textContent=error.message;}
  return true;
 };
 for(const [feature,label] of Object.entries(features)){
  const policy=document.createElement('label'),select=document.createElement('select');
  select.id='adminRule-'+feature;
  for(const [value,text] of [['open','Open'],['code','Require access code'],['disabled','Disabled']])select.add(new Option(text,value));
  select.onchange=()=>act({action:'policy',feature,mode:select.value});
  policy.append(label,select);$('adminPolicies').append(policy);
  const scope=document.createElement('label'),check=document.createElement('input');
  check.type='checkbox';check.id='adminScope-'+feature;scope.append(check,' '+label);$('adminCodeScopes').append(scope);
 }
 function draw(s){
  adminState=s;$('adminControls').hidden=false;
  for(const feature of Object.keys(features))$('adminRule-'+feature).value=s.rules[feature]||'open';
  $('adminMaintenance').checked=s.maintenance;
  const selection=$('adminCodes').value;
  $('adminCodes').replaceChildren(new Option('New code',''),...s.codes.map(c=>new Option(`${c.label} · ${c.uses} uses · expires ${new Date(c.expires).toLocaleString()}`,c.id)));
  if(s.codes.some(c=>c.id===selection))$('adminCodes').value=selection;
  $('adminAudit').replaceChildren(...s.audit.map(x=>{const li=document.createElement('li');li.textContent=new Date(x.at).toLocaleString()+' — '+x.action;return li;}));
  if(s.issued)$('adminIssued').textContent='Copy this code now; it won’t be shown again: '+s.issued;
 }
 async function act(value){
  if(!adminKey||busy)return;busy=true;const run=session;
  try{const result=await api.adminPolicy(adminKey,value);if(run!==session)return;draw(result);$('adminStatus').textContent='Connected to global administration.';}
  catch(error){if(run===session){$('adminStatus').textContent=error.message;if(adminState)draw(adminState);}}
  finally{busy=false;}
 }
 $('adminSignIn').onclick=()=>{if(busy)return;adminKey=$('adminKey').value.trim();$('adminKey').value='';if(!adminKey){$('adminStatus').textContent='Enter the private admin key.';return;}act({action:'status'});};
 $('adminSignOut').onclick=()=>{session++;adminKey='';adminState=null;$('adminControls').hidden=true;$('adminIssued').textContent='';$('adminKey').value='';$('adminStatus').textContent='Signed out.';};
 $('adminAnnounce').onclick=()=>act({action:'announcement',message:$('adminMessage').value,hours:Number($('adminAnnouncementHours').value)});
 $('adminClearAnnouncement').onclick=()=>act({action:'announcement',message:''});
 $('adminMaintenance').onchange=()=>act({action:'maintenance',enabled:$('adminMaintenance').checked});
 $('adminCodes').onchange=()=>{
  const c=adminState?.codes.find(c=>c.id===$('adminCodes').value);
  $('adminCodeLabel').value=c?.label||'';$('adminCodeHours').value=c?Math.max(1,Math.ceil((c.expires-Date.now())/3600000)):24;
  for(const f of Object.keys(features))$('adminScope-'+f).checked=c?.features.includes(f)||false;
 };
 function codeAction(action){
  const id=$('adminCodes').value;
  if(action!=='create'&&!id){$('adminStatus').textContent='Select an existing code first.';return;}
  if(action==='delete'&&!confirm('Revoke this code and invalidate previously redeemed feature grants?'))return;
  $('adminIssued').textContent='';
  act({action,id,label:$('adminCodeLabel').value,hours:Number($('adminCodeHours').value),features:Object.keys(features).filter(f=>$('adminScope-'+f).checked)});
 }
 for(const [id,action] of [['adminCreateCode','create'],['adminEditCode','edit'],['adminDeleteCode','delete']])$(id).onclick=()=>codeAction(action);
})();
