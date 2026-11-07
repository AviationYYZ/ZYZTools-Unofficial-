import React,{useEffect,useState} from 'react';
const api=window.preferredCyyzPdc;
const positions={unchanged:'Leave unchanged',maximize:'Maximize',full:'Full (taskbar visible)',left:'Left half',right:'Right half',top:'Top half',bottom:'Bottom half',leftThird:'Left third',middleThird:'Middle third',rightThird:'Right third',leftTwoThirds:'Left two thirds',rightTwoThirds:'Right two thirds'};
const blank=()=>({profile:'',display:'primary',orientation:'unchanged'});
const clean=e=>String(e?.message||e).replace(/^.*?Error:\s*/,'');
export function LaunchButton(){
 const [menu,setMenu]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[blocked,setBlocked]=useState(false);
 useEffect(()=>{
  const state=e=>{setBlocked(e.detail.blocked);if(e.detail.blocked)setMenu(null);};
  window.addEventListener('zyz:runtime',state);if(window.zyzRuntime)state({detail:window.zyzRuntime});
  return()=>window.removeEventListener('zyz:runtime',state);
 },[]);
 async function open(){
  if(menu){setMenu(null);return;}
  try{setMessage('');setMenu((await api.launchState()).config);}catch(e){setMessage(clean(e));}
 }
 async function run(id){
  setBusy(true);setMessage('Opening EuroScope…');
  try{const r=await api.launchOpen(id);setMenu(null);setMessage(r.warnings?.length?r.warnings.join(' '):`Opened ${r.opened} EuroScope window${r.opened===1?'':'s'}.`);}
  catch(e){setMessage(clean(e));}finally{setBusy(false);}
 }
 return <div className="workspace-launch">
  <button className="primary workspace-launch-button" id="launchNav" aria-expanded={!!menu} disabled={busy||blocked} onClick={open}>Launch</button>
  {menu&&<div className="workspace-launch-menu"><strong>Launch EuroScope</strong>
   {menu.presets.length?menu.presets.map(p=><button key={p.id} disabled={busy} className={p.id===menu.selected?'primary':undefined} onClick={()=>run(p.id)}>{p.name}</button>):<p>No launch presets yet.</p>}
   <button disabled={busy} onClick={()=>{setMenu(null);document.querySelector('[data-tab=launchConfig]').click();}}>Configure presets</button>
  </div>}
  {message&&<small className="workspace-launch-status" role="status">{message}</small>}
 </div>;
}
export function LaunchConfiguration(){
 const [config,setConfig]=useState(null),[displays,setDisplays]=useState([]),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 const preset=config?.presets.find(p=>p.id===config.selected);
 async function load(){
  try{const data=await api.launchState();setConfig(data.config);setDisplays(data.displays);setStatus('');}
  catch(e){setStatus(clean(e));}
 }
 useEffect(()=>{
  const open=e=>{if(e.target.closest('[data-tab=launchConfig]')&&!config)load();};
  document.addEventListener('click',open);return()=>document.removeEventListener('click',open);
 },[config]);
 function updatePreset(change){setConfig(c=>({...c,presets:c.presets.map(p=>p.id===c.selected?{...p,...change}:p)}));}
 function updateWindow(i,change){updatePreset({windows:preset.windows.map((w,j)=>i===j?{...w,...change}:w)});}
 async function choose(kind,index){
  try{const picked=await api.launchPick(kind);if(!picked)return;if(kind==='exe')setConfig(c=>({...c,exe:picked}));else updateWindow(index,{[kind]:picked});}
  catch(e){setStatus(clean(e));}
 }
 async function save(){
  setBusy(true);try{setConfig(await api.launchSave(config));setStatus('Launch presets saved.');}
  catch(e){setStatus(clean(e));}finally{setBusy(false);}
 }
 function add(){
  const id=crypto.randomUUID();setConfig(c=>({...c,selected:id,presets:[...c.presets,{id,name:'New preset',windows:[blank()]}]}));
 }
 function remove(){
  if(!confirm('Delete this preset?'))return;
  setConfig(c=>{const presets=c.presets.filter(p=>p.id!==c.selected);return {...c,presets,selected:presets[0]?.id||''};});
 }
 return <div className="card workspace-launch-config">
  {!config?<p role="status">{status||'Loading launch configuration…'}</p>:<>
   <div className="workspace-form-grid">
    <label>EuroScope executable<input readOnly value={config.exe} placeholder="Choose EuroScope.exe"/></label>
    <div className="buttons"><button onClick={()=>choose('exe')}>Browse</button></div>
    <label>Default preset<select value={config.selected} onChange={e=>setConfig({...config,selected:e.target.value})}><option value="" disabled>Choose a preset</option>{config.presets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <div className="buttons"><button disabled={config.presets.length>=20} onClick={add}>New preset</button><button className="warn" disabled={!preset} onClick={remove}>Delete</button></div>
   </div>
   {preset&&<>
    <label>Preset name<input maxLength="60" value={preset.name} onChange={e=>updatePreset({name:e.target.value})}/></label>
    <p className="subtle">Each window opens a .prf file. Layouts use EuroScope’s built-in positions, so its toolbar and radar resize together. ZYZTools does not start a network connection.</p>
    {preset.windows.map((w,i)=><fieldset key={i} className="workspace-launch-window"><legend>Window {i+1}</legend>
     <label>EuroScope profile<input readOnly value={w.profile} placeholder="Choose a .prf file"/></label>
     <div className="buttons"><button onClick={()=>choose('profile',i)}>Browse profile</button><button disabled={preset.windows.length===1} onClick={()=>updatePreset({windows:preset.windows.filter((_,j)=>j!==i)})}>Remove window</button></div>
     <label>Radar display (.asr, optional)<input readOnly value={w.asr||''} placeholder="Use the profile's last radar display"/></label>
     <div className="buttons"><button onClick={()=>choose('asr',i)}>Browse ASR</button><button disabled={!w.asr} onClick={()=>updateWindow(i,{asr:''})}>Clear ASR</button></div>
     <div className="workspace-form-grid">
      <label>Monitor<select value={w.display} onChange={e=>updateWindow(i,{display:e.target.value})}><option value="primary">Primary monitor</option>{displays.map(d=><option key={d.id} value={d.id}>{d.label} · {d.width} × {d.height}</option>)}</select></label>
      <label>Layout<select value={w.orientation} onChange={e=>updateWindow(i,{orientation:e.target.value})}>{Object.entries(positions).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
     </div>
    </fieldset>)}
    <button disabled={preset.windows.length>=6} onClick={()=>updatePreset({windows:[...preset.windows,blank()]})}>Add window</button>
   </>}
   <div className="buttons"><button className="primary" disabled={busy} onClick={save}>Save configuration</button></div>
   <p role="status">{status}</p>
  </>}
 </div>;
}
