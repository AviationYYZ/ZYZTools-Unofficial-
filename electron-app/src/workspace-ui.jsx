import React, {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal,flushSync} from 'react-dom';
import catalog from './policy-catalog.json';
import {LaunchButton,LaunchConfiguration} from './launch-ui.jsx';

const groups=[
 ['App settings',[['install','Install / Link'],['appearance','Appearance'],['advanced','Advanced']]],
 ['Controller tools',[['operations','Operations'],['hoppie','Hoppie'],['sids','SID Matrix'],['conflicts','Conflict alerts'],['launchConfig','Launch configuration']]],
 ['Sweatbox',[['training','Training'],['trainingBuilder','Scenario Builder']]],
 ['Session history',[['replay','Replay & Recordings'],['statistics','Statistics']]],
 ['Integrations',[['discord','Discord status']]],
 ['Administration',[['admin','Admin console']]]
];
const descriptions={
 install:'Manage the EuroScope plugin and installation location.',
 appearance:'Set the workspace theme, typography and layout.',
 advanced:'Manage updates and advanced app settings.',
 operations:'Configure clearances, runway assignments and PDC templates.',
 hoppie:'Set up the Hoppie connection and delivery options.',
 sids:'Review and edit the departure runway matrix.',
 conflicts:'Configure prediction and conflict alerts.',
 training:'Join, instruct or run an isolated training session.',
 trainingBuilder:'Build, validate and export reusable scenarios.',
 replay:'Capture radio audio and review saved recordings.',
 statistics:'Review completed sessions and export movement data.',
 discord:'Configure your public controller activity status.',
 admin:'Publish announcements and manage access across ZYZTools.'
 ,launchConfig:'Save EuroScope profiles and monitor layouts for fast startup.'
};
function Navigation(){
 return <><LaunchButton/><WorkspaceSearch/>{groups.map(([label,pages],index)=><details key={label} className="menu-group" name="zyz-menu" open={index===0} hidden={label==='Administration'} id={label==='Administration'?'adminMenu':undefined}>
  <summary>{label}</summary><div className="menu-pages">{pages.map(([id,name])=><button key={id} data-tab={id} className={id==='install'?'primary':undefined} aria-current={id==='install'?'page':undefined}>{name}</button>)}</div>
 </details>)}</>;
}
function WorkspaceSearch(){
 const dialog=useRef(null),input=useRef(null),trigger=useRef(null);
 const [query,setQuery]=useState(''),[selected,setSelected]=useState(0);
 const pages=groups.filter(([group])=>group!=='Administration')
  .flatMap(([group,items])=>items.map(([id,label])=>({id,label,group})));
 const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
 const results=pages.filter(({id,label,group})=>terms.every(term=>[label,group,descriptions[id]].join(' ').toLowerCase().includes(term)));
 function open(){if(dialog.current.open)return;setQuery('');setSelected(0);dialog.current.showModal();input.current.focus();}
 function choose(id){if(!id)return;dialog.current.close();document.querySelector(`nav button[data-tab="${id}"]`)?.click();}
 useEffect(()=>{
  const shortcut=e=>{if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='k'){e.preventDefault();open();}};
  window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut);
 },[]);
 useEffect(()=>{if(dialog.current?.open)document.getElementById('workspace-result-'+selected)?.scrollIntoView({block:'nearest'});},[selected]);
 return <><button type="button" className="workspace-search-button" ref={trigger} onClick={open}>Find a tool <kbd>Ctrl K</kbd></button>
 {createPortal(<dialog className="workspace-search" ref={dialog} aria-labelledby="workspace-search-title" onClose={()=>trigger.current.focus()}>
  <header><strong id="workspace-search-title">Find a tool</strong><button type="button" onClick={()=>dialog.current.close()} aria-label="Close search">×</button></header>
  <input ref={input} type="search" placeholder="Search for training, replay, runways…" aria-label="Search workspace tools" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="workspace-search-results" aria-activedescendant={results.length?'workspace-result-'+selected:undefined} value={query} onChange={e=>{setQuery(e.target.value);setSelected(0);}} onKeyDown={e=>{
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setSelected(i=>Math.max(0,Math.min(results.length-1,i+(e.key==='ArrowDown'?1:-1))));}
   if(e.key==='Enter'){e.preventDefault();choose(results[selected]?.id);}
  }}/>
  <div id="workspace-search-results" role="listbox" aria-label="Workspace pages">
   {results.map(({id,label,group},i)=><button type="button" role="option" id={'workspace-result-'+i} aria-selected={selected===i} key={id} onMouseEnter={()=>setSelected(i)} onClick={()=>choose(id)}><span><strong>{label}</strong><small>{descriptions[id]}</small></span><em>{group}</em></button>)}
   {!results.length&&<p role="status">No matching tools. Try a different search.</p>}
  </div>
  <footer>↑ ↓ Move · Enter Open · Esc Close</footer>
 </dialog>,document.body)}</>;
}
function PageHeading({group,title,id}){
 return <div className="workspace-page-heading"><span>{group}</span><h2>{title}</h2><p>{descriptions[id]}</p></div>;
}
function Panel({title,children}){return <div className="card workspace-admin-card"><h3>{title}</h3>{children}</div>;}
function Admin(){
 return <>
  <Panel title="Administrator session">
   <p>Sign in using the credential enrolled for this Windows account.</p>
   <div className="buttons"><button className="primary" id="adminSignIn">Sign in with Windows</button><button id="adminSignOut">Sign out</button></div>
   <details><summary>Enroll or remove this Windows account</summary>
    <label>Administrator credential<input id="adminEnrollCredential" type="password" autoComplete="off" spellCheck={false}/></label>
    <div className="buttons"><button id="adminEnroll">Enroll this account</button><button id="adminForget">Forget enrollment</button></div>
   </details>
   <p id="adminStatus" role="status"></p>
  </Panel>
  <div id="adminControls" hidden>
   <Panel title="Announcements">
    <label>Message<textarea id="adminMessage" maxLength="500" rows="4" /></label>
    <label>Expires after (hours)<input id="adminAnnouncementHours" type="number" min="1" max="168" defaultValue="24" /></label>
    <div className="buttons"><button id="adminAnnounce" className="primary">Publish announcement</button><button id="adminClearAnnouncement">Clear announcement</button></div>
   </Panel>
   <Panel title="Page and feature access">
    <p>Set each page or feature to Open, Require access, or Disabled.</p>
    <label className="workspace-toggle"><input id="adminMaintenance" type="checkbox" /> Pause new local training and scenario editing</label>
    <div id="adminPolicies"></div>
   </Panel>
   <Panel title="Access codes">
    <div className="workspace-form-grid">
     <label>Manage code<select id="adminCodes"></select></label>
     <label>Label<input id="adminCodeLabel" maxLength="60" /></label>
     <label>Valid for (hours)<input id="adminCodeHours" type="number" min="1" max="720" defaultValue="24" /></label>
    </div>
    <div id="adminCodeScopes" className="workspace-form-grid"></div>
    <div className="buttons"><button id="adminCreateCode" className="primary">Create code</button><button id="adminEditCode">Save changes</button><button id="adminDeleteCode" className="warn">Revoke code</button></div>
    <p id="adminIssued" role="status"></p>
   </Panel>
   <Panel title="Recent activity"><ol id="adminAudit"></ol></Panel>
   <div id="adminAccounts" hidden><Panel title="Administrators">
    <p>Issue a separate credential for each administrator. Revoke it here when they no longer need access.</p>
    <label>Administrator name<input id="adminAccountLabel" maxLength="60"/></label>
    <button id="adminCreateAccount">Issue administrator credential</button>
    <label>Existing administrator<select id="adminAccountList"></select></label>
    <button className="warn" id="adminRevokeAccount">Revoke administrator</button>
    <p id="adminAccountIssued" role="status"></p>
   </Panel></div>
  </div>
 </>;
}
function AccessLayer({target,host,reason}){
 useLayoutEffect(()=>{
  const before=target.inert;target.inert=!!reason;
  host.classList.toggle('workspace-blocked',!!reason);
  return ()=>{target.inert=before;host.classList.remove('workspace-blocked');};
 },[target,host,reason]);
 if(!reason)return null;
 return createPortal(<div className="workspace-lock" role="note" aria-label={reason}>
  <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19"/><path d="M11 11 37 37"/></svg>
  <div><strong>{reason}</strong></div>
 </div>,host);
}
function Workspace({surfaces}){
 const [policy,setPolicy]=useState(null),[dismissed,setDismissed]=useState(''),[runtime,setRuntime]=useState(window.zyzRuntime);
 useEffect(()=>{
  const update=event=>setPolicy(event.detail);
  window.addEventListener('zyz:policy',update);
  if(window.zyzCurrentPolicy)setPolicy(window.zyzCurrentPolicy);
  return ()=>window.removeEventListener('zyz:policy',update);
 },[]);
 useEffect(()=>{
  const update=event=>setRuntime(event.detail);
  window.addEventListener('zyz:runtime',update);
  if(window.zyzRuntime)setRuntime(window.zyzRuntime);
  return ()=>window.removeEventListener('zyz:runtime',update);
 },[]);
 useLayoutEffect(()=>{
  if(!runtime?.blocked)return;
  const targets=[...document.querySelectorAll('main>div>section:not(#install)')];
  targets.forEach(el=>{el.inert=true;el.classList.add('workspace-runtime-blocked');});
  return ()=>targets.forEach(el=>{el.inert=false;el.classList.remove('workspace-runtime-blocked');});
 },[runtime?.blocked]);
 const a=policy?.announcement,id=a?JSON.stringify(a):'';
 function reason(key){
  if(!policy)return '';
  if(policy.maintenance&&key==='scenarioBuilder')return 'Unavailable during maintenance';
  if(policy.rules[key]==='disabled')return 'Disabled by administrator';
  if(policy.rules[key]==='code'&&!policy.unlocked.includes(key))return 'Access restricted';
  return '';
 }
 return <>
  {surfaces.map(({key,target,host},i)=><AccessLayer key={key+i} target={target} host={host} reason={reason(key)}/>)}
  {a&&dismissed!==id&&<aside className="workspace-announcement" role="status"><div><strong>ZYZTools announcement</strong><p>{a.message}</p></div><button onClick={()=>setDismissed(id)} aria-label="Dismiss announcement">Dismiss</button></aside>}
  {runtime?.blocked&&<aside className="workspace-runtime-notice" role="alert"><div><strong>EuroScope plugin update required</strong><p>Close EuroScope and install the DLL bundled with ZYZTools {runtime.version}. App features are paused until you close EuroScope or install the matching DLL.</p></div><button onClick={()=>document.querySelector('[data-tab=install]').click()}>Install / Link</button></aside>}
 </>;
}
const nav=document.querySelector('nav[aria-label="ZYZTools menu"]'),admin=document.getElementById('admin');
flushSync(()=>{
 if(nav)createRoot(nav).render(<Navigation/>);
 if(admin)createRoot(admin).render(<Admin/>);
 const launch=document.getElementById('launchConfig');
 if(launch)createRoot(launch).render(<LaunchConfiguration/>);
});
function ThemeGallery(){
 const [active,setActive]=useState(document.body.dataset.theme);
 useEffect(()=>{const changed=e=>setActive(e.detail);window.addEventListener('zyz:theme',changed);return()=>window.removeEventListener('zyz:theme',changed);},[]);
 return <div className="workspace-theme-gallery">{Object.entries(window.ZYZWorkspaceThemes).map(([id,t])=><button type="button" key={id} aria-pressed={active===id} onClick={()=>{
  const picker=document.getElementById('uiTheme');picker.value=id;picker.dispatchEvent(new Event('change'));
 }}><span className="workspace-theme-preview" style={{'--preview-bg':t.variables['--bg'],'--preview-panel':t.variables['--panel'],'--preview-accent':t.variables['--accent'],'--preview-header':t.variables['--header']}} aria-hidden="true"><i/><i/><i/></span><strong>{t.label}</strong><small>{t.layout}</small></button>)}</div>;
}
window.ZYZPolicyCatalog=catalog;
window.mountZYZWorkspace=()=>{
 const gallery=document.getElementById('reactThemeGallery');if(gallery)createRoot(gallery).render(<ThemeGallery/>);
 const surfaces=[];
 function add(key,target,wrap=true){
  if(!target)return;
  const host=document.createElement('div');host.className='workspace-surface';
  if(wrap){target.before(host);host.append(target);}
  else{while(target.firstChild)host.append(target.firstChild);target.append(host);}
  if(!wrap){
   const contents=document.createElement('div');contents.className='workspace-content';
   while(host.firstChild)contents.append(host.firstChild);host.append(contents);target=contents;
  }
  target.classList.add('workspace-surface-content');
  surfaces.push({key,host,target});
 }
 for(const [group,pages] of groups)for(const [id,title] of pages){
  const page=document.getElementById(id);if(!page)continue;
  const header=document.createElement('div');header.className='workspace-heading-slot';page.prepend(header);
  createRoot(header).render(<PageHeading group={group} title={title} id={id}/>);
 }
 for(const [key,{target}] of Object.entries(catalog))for(let node of document.querySelectorAll(target)){
  if(node.tagName==='TBODY')node=node.closest('.card');
  if(node)add(key,node,node.tagName!=='SECTION');
 }
 const root=document.createElement('div');document.body.append(root);createRoot(root).render(<Workspace surfaces={surfaces}/>);
};
document.addEventListener('DOMContentLoaded',window.mountZYZWorkspace,{once:true});
