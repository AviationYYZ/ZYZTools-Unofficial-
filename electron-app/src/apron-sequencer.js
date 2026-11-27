// Advisory only. Resources are controller-declared, not a navigation graph.
const active = row => ['pushing','pushed','outbound','inbound','blocked','parked'].includes(row.state);
const inbound = row => row.type === 'arrival';
const waiting = row => row.state === 'waiting';
const resources = row => [...(row.state==='parked'?[]:[...row.zones,...(row.entry?['entry:'+row.entry]:[])]), ...(row.stand ? ['stand:'+row.stand] : [])];
const overlap = (a,b) => resources(a).filter(z=>resources(b).includes(z));
const gateBlocked=(row,board)=>board.some(other=>other.id!==row.id&&other.stand===row.stand&&
 (other.state==='parked'||waiting(other)&&!inbound(other)));
function groundFeed(value,now){
 if(!value||!Number.isFinite(value.at)||value.at>now||now-value.at>7||!Array.isArray(value.rows))return {fresh:false,rows:[]};
 return {fresh:true,selected:/^[A-Z0-9-]{2,14}$/i.test(value.selected||"")?value.selected.toUpperCase():"",rows:value.rows.slice(0,200).filter(r=>r&&typeof r.call==='string'&&/^[A-Z0-9-]{2,14}$/i.test(r.call)&&
  Number.isFinite(r.lat)&&Math.abs(r.lat)<=90&&Number.isFinite(r.lon)&&Math.abs(r.lon)<=180&&Number.isFinite(r.kt)&&r.kt>=0&&r.kt<=70)
  .map(r=>({call:r.call.toUpperCase(),lat:r.lat,lon:r.lon,kt:r.kt,groundState:String(r.groundState||'').toUpperCase(),cleared:r.cleared===true,hint:['arrival','departure'].includes(r.hint)?r.hint:''}))};
}
function assess(row, board, tracks=[]){
 const contrary=board.find(other=>other.id!==row.id&&active(other)&&other.state!=='parked'&&require('./apron-lanes').conflict(row,other).startsWith('Opposing flow'));
 if(contrary)return {ok:false,why:'Opposing loop traffic: '+contrary.call};
 const occupied=board.filter(other=>other.id!==row.id&&active(other)&&overlap(row,other).length);
 if(occupied.length)return {ok:false,why:'Reserved by '+occupied.map(r=>r.call).join(', ')};
 if(!waiting(row))return {ok:false,why:'Not waiting'};
 if(!row.stand||!row.zones.length)return {ok:false,why:'Stand and lane required'};
 if(inbound(row)&&gateBlocked(row,board))return {ok:false,why:'Stand recorded occupied'};
 const ahead=board.filter(other=>other.id!==row.id&&waiting(other)&&overlap(row,other).length&&
   (!inbound(other)||!gateBlocked(other,board))&&
   (inbound(other)&&!inbound(row)||inbound(other)===inbound(row)&&other.order<row.order));
 if(ahead.length)return {ok:false,why:'Give way to '+ahead.map(r=>r.call).join(', ')};
 if(!row.confirmed)return {ok:false,why:inbound(row)?'Confirm stand, route and outside holding point':'Confirm exhaust away, route and handoff'};
 const own=tracks.find(t=>t.call===row.call);
 if(own?.kt>=4)return {ok:false,why:'Already moving on scope — check status before starting'};
 return {ok:true,why:inbound(row)?'Next inbound candidate':'Next push candidate'};
}
function advance(id,board,tracks=[]){
 const r=board.find(r=>r.id===id);
 if(!r)return board;
 if(waiting(r)&&!assess(r,board,tracks).ok)return board;
 const next={waiting:inbound(r)?'inbound':'pushing',pushing:'pushed',pushed:'outbound',outbound:'done',inbound:'parked',parked:'done',blocked:'done'}[r.state];
 return next?board.map(item=>item.id===id?{...item,state:next}:item):board;
}
module.exports={active,assess,advance,overlap,groundFeed};
