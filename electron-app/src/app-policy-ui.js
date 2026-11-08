(()=>{
 const api=window.preferredCyyzPdc,$=id=>document.getElementById(id);
 const catalog=window.ZYZPolicyCatalog;
 const features=Object.fromEntries(Object.entries(catalog).map(([key,value])=>[key,value.label]));
 let signedIn=false,adminState,busy=false,session=0;
 const drafts=new Map();
 const legacyFeatures=['localTraining','scenarioBuilder','replay','discord','conflictSettings'];
 function update(s){
  if(!s)return;window.zyzCurrentPolicy=s;
  $('globalMaintenance').hidden=!s.maintenance;
  window.dispatchEvent(new CustomEvent('zyz:policy',{detail:s}));
 }
 api.onAppPolicy?.(update);
 api.appPolicy?.().then(update).catch(()=>{});
 window.zyzTrainingSpecialCode=async value=>{
  const code=value.trim();
  if(code.toLowerCase()==='67g7z28s'||/^[a-f0-9]{64}$/i.test(code)){
   $('trainingInvite').value='';$('adminMenu').hidden=false;document.querySelector('[data-tab="admin"]').click();
   await signIn(code.toLowerCase()==='67g7z28s'?undefined:code);return true;
  }
  if(!/^[A-F0-9]{24}$/i.test(code))return false;
  $('trainingInvite').value='';
  try{const s=await api.redeemFeature(code);update(s);$('trainingJoinStatus').textContent='Unlocked: '+s.unlocked.map(x=>features[x]).join(', ')+'.';}
  catch(error){$('trainingJoinStatus').textContent=error.message;}
  return true;
 };
 const policyGroups=new Map();
 for(const [feature,label] of Object.entries(features)){
  const group=catalog[feature].group;
  if(!policyGroups.has(group)){
   const fieldset=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=group;
   fieldset.append(legend);$('adminPolicies').append(fieldset);policyGroups.set(group,fieldset);
  }
  const policy=document.createElement('label'),select=document.createElement('select'),save=document.createElement('button');
  select.id='adminRule-'+feature;
  for(const [value,text] of [['open','Open'],['code','Require access code'],['disabled','Disabled']])select.add(new Option(text,value));
  save.type='button';save.id='adminRuleSave-'+feature;save.textContent='Apply';save.disabled=true;
  select.onchange=()=>{drafts.set(feature,select.value);save.disabled=select.value===(adminState?.rules[feature]||'open');};
  save.onclick=async()=>{if(busy)return;const mode=select.value;save.disabled=true;await act({action:'policy',feature,mode});};
  policy.append(label,select);const row=document.createElement('div');row.className='workspace-policy-row';row.append(policy,save);policyGroups.get(group).append(row);
  const scope=document.createElement('label'),check=document.createElement('input');
  check.type='checkbox';check.id='adminScope-'+feature;scope.append(check,' '+label);$('adminCodeScopes').append(scope);
 }
 function draw(s){
  adminState=s;$('adminControls').hidden=false;
  const supported=new Set(s.supportedFeatures||legacyFeatures);
  for(const feature of Object.keys(features)){
   const select=$('adminRule-'+feature),save=$('adminRuleSave-'+feature),current=s.rules[feature]||'open',available=supported.has(feature);
   if(drafts.get(feature)===current)drafts.delete(feature);
   select.value=drafts.get(feature)||current;select.disabled=!available;
   select.title=available?'':'Requires the updated policy service.';
   save.disabled=!available||select.value===current;
   const scope=$('adminScope-'+feature);scope.disabled=!available;if(!available)scope.checked=false;
  }
  $('adminMaintenance').checked=s.maintenance;
  const selection=$('adminCodes').value;
  $('adminCodes').replaceChildren(new Option('New code',''),...s.codes.map(c=>new Option(`${c.label} · ${c.uses} uses · expires ${new Date(c.expires).toLocaleString()}`,c.id)));
  if(s.codes.some(c=>c.id===selection))$('adminCodes').value=selection;
  $('adminAudit').replaceChildren(...s.audit.map(x=>{const li=document.createElement('li');li.textContent=new Date(x.at).toLocaleString()+' — '+x.action;return li;}));
  if(s.issued)$('adminIssued').textContent='Copy this code now; it won’t be shown again: '+s.issued;
  $('adminAccounts').hidden=s.owner!==true;
  $('adminAccountList').replaceChildren(new Option('Select an administrator',''),...(s.admins||[]).map(a=>new Option(a.label,a.id)));
  if(s.adminCredential)$('adminAccountIssued').textContent='Share privately with this administrator; shown once: '+s.adminCredential;
 }
 async function act(value){
  if(!signedIn||busy)return;busy=true;const run=session;
  try{const result=await api.adminPolicy(value);if(run!==session)return;draw(result);$('adminStatus').textContent='Changes saved.';}
  catch(error){if(run===session){$('adminStatus').textContent=String(error.message).replace(/^.*?Error:\s*/,'');if(adminState)draw(adminState);}}
  finally{busy=false;}
 }
 async function signIn(key,remember=false){
  if(busy)return;busy=true;const run=session;$('adminStatus').textContent='Verifying administrator access…';
  try{const result=await api.adminSignIn(key,remember);if(run!==session)return;signedIn=true;draw(result);$('adminStatus').textContent=remember?'Enrolled and signed in.':'Signed in.';}
  catch(error){if(run===session)$('adminStatus').textContent=String(error.message).replace(/^.*?Error:\s*/,'');}
  finally{busy=false;}
 }
 $('adminSignIn').onclick=()=>signIn();
 $('adminEnroll').onclick=()=>{const field=$('adminEnrollCredential'),key=field.value.trim();field.value='';if(key)signIn(key,true);};
 $('adminSignOut').onclick=()=>{session++;signedIn=false;adminState=null;drafts.clear();api.adminSignOut?.().catch(()=>{});$('adminControls').hidden=true;$('adminIssued').textContent='';$('adminAccountIssued').textContent='';$('adminStatus').textContent='Signed out.';};
 $('adminForget').onclick=async()=>{try{await api.adminForget();$('adminSignOut').click();$('adminStatus').textContent='Windows enrollment removed.';}catch(e){$('adminStatus').textContent=e.message;}};
 $('adminCreateAccount').onclick=()=>act({action:'createAdmin',label:$('adminAccountLabel').value});
 $('adminRevokeAccount').onclick=()=>{const id=$('adminAccountList').value;if(id&&confirm('Revoke this administrator’s access?')){ $('adminAccountIssued').textContent='';act({action:'revokeAdmin',id});}};
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
  act({action,id,label:$('adminCodeLabel').value,hours:Number($('adminCodeHours').value),features:Object.keys(features).filter(f=>$('adminScope-'+f).checked&&!$('adminScope-'+f).disabled)});
 }
 for(const [id,action] of [['adminCreateCode','create'],['adminEditCode','edit'],['adminDeleteCode','delete']])$(id).onclick=()=>codeAction(action);
})();
