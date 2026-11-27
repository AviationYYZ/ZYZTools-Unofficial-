// Planning labels read from the supplied simulator diagrams. Not authoritative
// access points or a routing graph; user-defined labels cover event changes.
const entries={
 other:[],north:['AD','AE','AF','AG','AT','AJ','AK'],
 south:['AK','AL','AM','DP','DQ','DR','DT','DV'],
};
const entryName=value=>String(value||'').trim().toUpperCase();
const validEntry=value=>/^[A-Z0-9][A-Z0-9 /-]{0,15}$/.test(value);
function entranceBoard(rows, names){
 return [...new Set([...names,...rows.map(r=>r.entry).filter(Boolean)])].map(entry=>({
  entry,
  holding:rows.filter(r=>r.entry===entry&&r.type==='arrival'&&r.state==='waiting').sort((a,b)=>a.order-b.order),
  using:rows.filter(r=>r.entry===entry&&['inbound','pushing','pushed','outbound','blocked'].includes(r.state)),
 }));
}
function alPractice(){
 return [
  {id:1,order:1,call:'TEST138',stand:'138',side:'south',type:'departure',zones:['s-west'],position:'At Gate 138; push direction and outbound route to be verified',entry:'',state:'waiting',confirmed:false},
  {id:2,order:2,call:'TEST136',stand:'136',side:'south',type:'arrival',zones:['s-west'],position:'Taxiway A, holding short of AL outside the apron → Gate 136',entry:'AL',state:'waiting',confirmed:false},
 ];
}
function lanePractice(side){
 const south=side==='south',zone=south?'s-west':'n-c';
 return (south?[
 ['TEST138','138','departure','pushed','7','','Pushed from 138 onto lane 7, facing north-east'],
 ['TEST167','167','arrival','waiting','8','AL','On A holding short of AL for Gate 167']
 ]:[
 ['TEST320','B20','departure','pushed','3','','Pushed from B20 onto lane 3; facing not reported'],
 ['TEST428','C28','departure','waiting','4','','Push from C28 onto lane 4, face north-east']
 ]).map(([call,stand,type,state,lane,entry,position],i)=>({id:i+1,order:i+1,call,stand,type,state,lane,entry,position,side,zones:[zone],confirmed:state==='pushed'}));
}
module.exports={entries,entryName,validEntry,entranceBoard,alPractice,lanePractice};
