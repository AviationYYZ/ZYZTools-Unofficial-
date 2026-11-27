import React from 'react';
import lanes from './apron-lanes';
export default function Strips({board,side,save,tracks=[],search=""}){
 const rows=board.filter(r=>r.side===side&&r.state!=='done'&&r.call.includes(search.trim().toUpperCase()));
 const edit=(id,v)=>save(old=>old.map(r=>r.id===id&&r.side===side?{...r,...v}:r));
 return <div className="card"><h3>{side==='north'?'North':side==='south'?'South':'Other'} apron strips</h3>
 <p>Drag a strip into its planned lane, or use its lane selector. The gate pocket is a planning hint; confirm the actual path. Assign loop direction as viewed on the chart. Moving a strip does not clear the aircraft.</p>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:8}}>
 {['',...lanes.slots[side]].map(l=><div key={l} style={{border:'1px solid #657586',padding:8,minHeight:70}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('application/x-apron-strip');if(id)edit(Number(id),{lane:l});}}>
 <strong>{l?(/^\d+$/.test(l)?'Lane '+l:l):'Awaiting lane'}</strong>
 {rows.filter(r=>(r.lane||'')===l).map(r=>{
 const warnings=board.map(b=>{const note=lanes.conflict(r,b);return note&&b.call+' · '+note;}).filter(Boolean);
 return <div key={r.id} draggable onDragStart={e=>e.dataTransfer.setData('application/x-apron-strip',String(r.id))} style={{marginTop:6,padding:8,borderLeft:'3px solid #62afcd',background:'#182632',color:'white'}}>
 <b>{r.call}</b> · {r.type}<br/>{r.state} · Stand {r.stand||'—'} · {lanes.pocket(r.stand)||'unmapped'}{r.entry&&' · '+r.entry}
 <select aria-label={'Lane for '+r.call} value={l} onChange={e=>edit(r.id,{lane:e.target.value})}><option value="">Awaiting lane</option>{lanes.slots[side].map(x=><option key={x} value={x}>{/^\d+$/.test(x)?'Lane '+x:x}</option>)}</select>
 <select aria-label={'Flow for '+r.call} value={r.flow||''} onChange={e=>edit(r.id,{flow:e.target.value})}><option value="">Direction unconfirmed</option><option value="cw">Clockwise</option><option value="ccw">Counterclockwise</option></select>
 {warnings.length>0&&<small role="status" style={{display:'block',color:'#ffcf75'}}>⚠ {warnings.join('; ')}</small>}</div>;})}</div>)}</div></div>;
}
