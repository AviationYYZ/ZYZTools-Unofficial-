import React,{useState,useEffect} from 'react';
import model from './apron-sequencer';
import entrances from './apron-entries';
import Strips from './apron-strips';

const zones={
 other:[['fedex','FedEx apron'],['infield','Infield terminal'],['other-apron','Other apron']],
 north:[['n-b','T3 west / B stands and satellite feeder'],['n-c','T3 east / C stands'],['n-throat','T3 entrance throat (apron-edge connectors)']],
 south:[['s-west','T1 west / lanes 5–8'],['s-central','T1 central / lanes 9–10'],['s-east','T1 east / lanes 11–12 and H area'],['s-throat','T1 entrance throat (relevant T1 connector)']],
};
const shared=['shared','Shared edge / handoff between desks'];
const empty={call:'',stand:'',type:'departure',zones:[],position:'',entry:'',confirmed:false};
const states={waiting:'Waiting',pushing:'Push in progress',pushed:'Pushed back',outbound:'Taxiing out',inbound:'Taxiing in',parked:'Parked · stand occupied',done:'Clear',blocked:'Manual block'};
const labels={waiting:'Record start',pushing:'Mark pushed back',pushed:'Mark taxiing out',outbound:'Confirm off apron',inbound:'Confirm parked / lanes clear',parked:'Confirm stand now empty',blocked:'Confirm obstruction clear'};
const storage='zyz-apron-desk-v1';
function restore(){try{const b=JSON.parse(sessionStorage.getItem(storage));return Array.isArray(b)?b:[];}catch{return [];}}
function practiceBoard(){
 const sample=[
  ['ACA701','B17','north','departure',['n-b','n-throat'],'Push away from terminal → west throat'],
  ['WJA482','B19','north','arrival',['n-b','n-throat','shared'],'On A holding short of AT → B19','AT'],
  ['ACA318','153','south','departure',['s-central','s-throat'],'Push away from terminal → south throat'],
  ['ACA840','248','south','arrival',['s-east','s-throat'],'On D holding short of DT → 248','DT'],
  ['ACA952','159','south','departure',['s-central','shared'],'Push away from terminal → shared edge'],
 ];
 return sample.map(([call,stand,side,type,zones,position,entry],i)=>({id:i+1,order:i+1,call,stand,side,type,zones,position,entry,state:'waiting',confirmed:false}));
}
function practiceTracks(board,traffic){
 const points={'ACA701':[43.686,-79.631],'WJA482':[43.687,-79.636],'ACA318':[43.676,-79.616],'ACA840':[43.675,-79.610],'ACA952':[43.680,-79.620]};
 const rows=board.filter(r=>points[r.call]&&r.state!=='done').map(r=>{
  const [lat,lon]=points[r.call];
  return {call:r.call,lat,lon,kt:r.state==='inbound'||r.state==='outbound'?12:r.state==='pushing'?5:0,hint:r.type};
 });
 if(traffic)rows.push({call:'SIMTUG',lat:43.6768,lon:-79.616,kt:7,hint:''});
 return rows;
}
export default function ApronDesk(){
 const [side,choose]=useState('north'),[form,set]=useState(empty),[liveBoard,saveLive]=useState(restore),[notice,report]=useState('');
 const [offline,setOffline]=useState(false),[demo,saveDemo]=useState(practiceBoard),[tug,setTug]=useState(true),[exercise,setExercise]=useState('default');
 const board=offline?demo:liveBoard,save=offline?saveDemo:saveLive;
 const [feed,setFeed]=useState({fresh:false,rows:[]}),[trackFilter,setTrackFilter]=useState('');
 useEffect(()=>{
  let alive=true,busy=false;
  const poll=async()=>{
   if(offline||busy||!document.getElementById('apronDesk')?.classList.contains('active'))return;
   busy=true;
   try{const result=await window.preferredCyyzPdc?.apronTracks?.();if(alive)setFeed(result??{fresh:false,rows:[]});}
   catch{if(alive)setFeed({fresh:false,rows:[]});}
   finally{busy=false;}
  };
  const timer=setInterval(poll,2000);poll();
  return ()=>{alive=false;clearInterval(timer);};
 },[offline]);
 useEffect(()=>{if(!offline&&feed.selected)setTrackFilter(feed.selected);},[offline,feed.selected]);
 const tracks=offline?practiceTracks(demo,tug):feed.rows;
 useEffect(()=>{try{sessionStorage.setItem(storage,JSON.stringify(liveBoard));}catch{}},[liveBoard]);
 const sideZones=[...zones[side],shared],rows=board.filter(r=>r.side===side);
 const entranceList=entrances.entranceBoard(board,entrances.entries[side]).filter(x=>entrances.entries[side].includes(x.entry)||rows.some(r=>r.entry===x.entry&&r.state!=='done'));
 const other=board.filter(r=>r.side!==side&&model.active(r)&&r.state!=='parked'&&r.zones.includes('shared'));
 const patch=delta=>set(f=>({...f,...delta}));
 function add(e){
  e.preventDefault();const call=form.call.trim().toUpperCase(),stand=form.stand.trim().toUpperCase(),entry=entrances.entryName(form.entry);
  if(!/^[A-Z0-9-]{2,14}$/.test(call)||!form.zones.length||(form.type!=='block'&&(!stand||!form.position.trim()))){report('Enter a callsign, stand, route or outside holding point, and the zones affected.');return;}
  if((entry&&!entrances.validEntry(entry))||(form.type==='arrival'&&!entry)){report('Select or enter a named entrance for the inbound holding short.');return;}
  const turnaround=board.find(r=>r.call===call&&r.state==='parked'&&r.stand===stand&&r.side===side&&form.type==='departure');
  if(board.some(r=>r.call===call&&r.state!=='done'&&r!==turnaround)){report('This callsign is already tracked.');return;}
  const order=Math.max(0,...board.map(r=>r.order))+1;
  save([...board.filter(r=>r!==turnaround),{...form,call,stand,entry,side,id:order,order,state:form.type==='block'?'blocked':'waiting'}]);set(empty);report(call+' added.');
 }
 function move(r){
  if(r.state==='waiting'&&!model.assess(r,board,tracks).ok)return;
  save(current=>model.advance(r.id,current,tracks));
  report(r.call+' status updated. No instruction was transmitted.');
 }
 return <>
  <div className="card">
   <h3>CYYZ apron sequence desk</h3>
   <div className="buttons"><button type="button" aria-pressed={offline} onClick={()=>{setOffline(!offline);setFeed({fresh:false,rows:[]});set(empty);setTrackFilter('');report('');}}>{offline?'Return to scope board':'Start offline practice'}</button>
    {offline&&<><button type="button" onClick={()=>{setExercise('al');saveDemo(entrances.alPractice());setTug(false);choose('south');set(empty);report('AL exercise loaded.');}}>Load AL / 136–138 exercise</button><button type="button" onClick={()=>{saveDemo(exercise==='al'?entrances.alPractice():exercise==='default'?practiceBoard():entrances.lanePractice(exercise));setTug(exercise==='default');set(empty);setTrackFilter('');report('Practice reset.');}}>Reset practice</button>{exercise==='default'&&<button type="button" aria-pressed={tug} onClick={()=>setTug(!tug)}>{tug?'Move practice tug clear':'Add moving practice tug'}</button>}</>}</div>
   {offline&&<div className="buttons">{['south','north'].map(s=><button key={s} onClick={()=>{setExercise(s);choose(s);saveDemo(entrances.lanePractice(s));setTug(false);set(empty);report('Lane exercise loaded.');}}>{s==='south'?'Practice 138 / AL to 167':'Practice B20 / C28'}</button>)}</div>}
   {offline&&<p role="status"><strong>OFFLINE PRACTICE.</strong> Simulated strip movements; no EuroScope feed or instructions.</p>}
   <p>Advisory for simulated ATC only. Radar detections supply ground candidates and movement status; stand, zone and clearance state remain controller-entered. Use your event briefing for allowed routes and aircraft limits. Keep aircraft holding <strong>short of</strong> the apron entrance, not on the entrance itself.</p>
   <div className="buttons"><button aria-pressed={side==='north'} onClick={()=>{choose('north');set(empty);report('');}}>North · T3</button><button aria-pressed={side==='south'} onClick={()=>{choose('south');set(empty);report('');}}>South · T1 / H</button><button aria-pressed={side==='other'} onClick={()=>{choose('other');set(empty);}}>Other aprons</button></div>
   <p>{side==='north'?'Photo 2: T3 and satellite apron. Mark the actual T3 approach corridor and all zones used.':side==='other'?'FedEx, infield terminal and other apron traffic.':'Photo 1: T1 and H area. The center lanes and east-side restrictions make it important to reserve every zone the aircraft will touch.'} Mark the shared edge on either desk when a move affects both.</p>
   <p className="subtle">These are coarse planning zones, not verified one-way lanes. Mark all zones swept during push, turn and taxi. Reservations stay until you confirm clear. Use one open desk window; this board is not shared and closing the window clears its session.</p>
  </div>
  <div className="card">
   <label>Search strips and list · follows EuroScope selection<input value={trackFilter} onChange={e=>setTrackFilter(e.target.value.toUpperCase())}/></label><Strips board={board} side={side} save={save} tracks={tracks} search={trackFilter}/>
   <h3>{offline?'Simulated ground tracks':'List · inbound and cleared stopped departure candidates'}</h3>
   <p role="status">{offline?`${tracks.length} simulated tracks`:feed.fresh?`${tracks.length} nearby candidates · low altitude and low speed, not confirmed on the apron`:'No fresh scope feed. Manual sequencing only. Open EuroScope with the matching plugin loaded.'}</p>
   <p className="subtle">Both desks see the same airport-wide list. Select a track and confirm which desk, stand, and zones apply. A disappearing or stationary track never clears a reservation.</p>
   <label>Filter callsigns<input value={trackFilter} onChange={e=>setTrackFilter(e.target.value.toUpperCase())}/></label>
   <div className="buttons">{tracks.filter(t=>t.call.includes(trackFilter.trim())&&(offline||t.hint==='arrival'||(t.hint==='departure'&&t.cleared&&!t.groundState&&t.kt===0))&&!board.some(r=>r.call===t.call&&r.state!=='done')).sort((a,b)=>a.call.localeCompare(b.call)).map(t=><button key={t.call} onClick={()=>{set({...empty,call:t.call,type:t.hint||'departure'});document.querySelector('#apronDesk form')?.scrollIntoView({block:'nearest'});}}>{t.call} · {t.kt} kt</button>)}</div>
  </div>
  <form className="card" onSubmit={add}>
   <h3>Add to {side} desk</h3>
   <div className="grid">
    <label>Callsign / block ID<input maxLength="14" value={form.call} onChange={e=>patch({call:e.target.value})}/></label>
    <label>Movement<select value={form.type} onChange={e=>patch({type:e.target.value,confirmed:false})}><option value="departure">Departure waiting for push</option><option value="arrival">Inbound holding outside apron</option><option value="block">Manual obstruction / active traffic</option></select></label>
    <label>Stand<input maxLength="16" value={form.stand} onChange={e=>patch({stand:e.target.value,confirmed:false})}/></label>
    <label>{form.type==='arrival'?'Outside holding point → stand route':form.type==='departure'?'Push heading → taxi route / handoff':'Location / reason'}<input maxLength="100" value={form.position} onChange={e=>patch({position:e.target.value,confirmed:false})}/></label>
   </div>
   <label>{form.type==='arrival'?'Entrance held short of':'Entrance used (if applicable)'}<input list="apron-entry-names" maxLength="16" value={form.entry} onChange={e=>patch({entry:e.target.value.toUpperCase(),confirmed:false})}/></label>
   <datalist id="apron-entry-names">{[...new Set([...entrances.entries[side],...entranceList.map(x=>x.entry),...entrances.entries[side==='north'?'south':'north']])].map(name=><option key={name} value={name}/>)}</datalist>
   <fieldset><legend>Zones to reserve</legend>{sideZones.map(([id,name])=><label key={id} className="check"><input type="checkbox" checked={form.zones.includes(id)} onChange={e=>patch({confirmed:false,zones:e.target.checked?[...form.zones,id]:form.zones.filter(z=>z!==id)})}/>{name}</label>)}</fieldset>
   <button type="submit" className="primary">Add or log obstruction</button>
   <p role="status">{notice}</p>
  </form>
  <div className="card"><h3>Entrance board · {side}</h3><p className="subtle">“Holding short” is the queue outside the point; “In use” is a recorded movement. Additional event points can be typed above. These are not automatic location or jurisdiction assignments.</p>
   <table><thead><tr><th>Point</th><th>Holding short</th><th>In use</th></tr></thead><tbody>{entranceList.map(x=><tr key={x.entry}><th scope="row">{x.entry}</th><td>{x.holding.map(r=>r.call+' → '+r.stand).join(', ')||'—'}</td><td>{x.using.map(r=>r.call).join(', ')||'—'}</td></tr>)}</tbody></table>
  </div>
  <div className="card"><h3>{side==='north'?'North':side==='south'?'South':'Other'} queue</h3>
    <p>For shared lanes, inbound traffic waiting outside takes priority over queued pushes. Already-moving traffic keeps its reservation. Check the intended direction and receiving controller before recording a start.</p>
    {other.length>0&&<p role="status">Other desk holds shared edge: {other.map(r=>r.call).join(', ')}</p>}
    {!rows.some(r=>r.state!=='done')&&<p>No live entries on this desk.</p>}
    {rows.filter(r=>r.state!=='done').map(r=>{
     const decision=model.assess(r,board,tracks),seen=tracks.find(t=>t.call===r.call);
     return <article key={r.id} className="card"><strong>{r.call}</strong> · {r.stand||'no stand'} · {r.state==='waiting'&&r.type==='arrival'?'Holding outside':states[r.state]}
      <p>{r.position} — {r.zones.map(z=>sideZones.find(([k])=>k===z)?.[1]||z).join(' · ')}</p>
      {seen&&<p>Scope: {seen.kt} kt · {seen.kt>=4?'moving':'slow / stopped'}</p>}
      {r.state==='waiting'&&<><label className="check"><input type="checkbox" checked={r.confirmed} onChange={e=>{const confirmed=e.target.checked;save(b=>b.map(x=>x.id===r.id?{...x,confirmed}:x));}}/>{r.type==='arrival'?'Confirmed holding short outside, stand available, and route clear':'Confirmed exhaust points away from terminal; route and outbound handoff available'}</label><p>{decision.why}</p></>}
      <div className="buttons"><button className={decision.ok?'primary':''} disabled={r.state==='waiting'&&!decision.ok} onClick={()=>move(r)}>{labels[r.state]}</button>
      {r.state==='waiting'&&<button onClick={()=>save(b=>b.filter(x=>x.id!==r.id))}>Remove from queue</button>}</div>
     </article>;
    })}
    {rows.some(r=>r.state==='done')&&<details><summary>Cleared moves</summary><p>{rows.filter(r=>r.state==='done').map(r=>r.call).join(' · ')}</p></details>}
  </div>
 </>;
}
