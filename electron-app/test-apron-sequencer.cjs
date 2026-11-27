const {test}=require('node:test'),a=require('node:assert/strict');
const {assess,advance,groundFeed}=require('./src/apron-sequencer');
const {alPractice,entranceBoard,entryName,validEntry}=require('./src/apron-entries');
const row=(id,type,zones,props={})=>({id,order:id,call:'AC'+id,stand:'G'+id,zones,type,state:'waiting',confirmed:true,...props});
test('outside arrivals take precedence; only overlapping claims conflict',()=>{
 const d=row(1,'departure',['n-b']),i=row(2,'arrival',['n-b']),s=row(3,'departure',['s-central']);
 let b=[d,i,s];a.equal(assess(d,b).ok,false);a.equal(assess(i,b).ok,true);a.equal(assess(s,b).ok,true);
 b=advance(2,b);a.equal(b[1].state,'inbound');a.match(assess(d,b).why,/Reserved/);
 b=advance(2,b);a.equal(b[1].state,'parked');a.equal(assess(d,b).ok,true);
 a.equal(assess(row(4,'arrival',['n-c'],{stand:'G2'}),b).ok,false);
});
test('push confirmation, shared desk blockage and manual clearance',()=>{
 const incomplete=row(1,'departure',['shared'],{confirmed:false});
 a.equal(advance(1,[incomplete])[0].state,'waiting');
 let b=[{...incomplete,confirmed:true},row(2,'arrival',['s-east','shared'],{state:'done'})];
 b=advance(1,b);b=advance(1,b);a.equal(b[0].state,'pushed');
 b[1]={...b[1],state:'waiting'};
 a.equal(assess(b[1],b).ok,false);b=advance(1,b);a.equal(assess(b[1],b).ok,false);
 b=advance(1,b);a.equal(assess(b[1],b).ok,true);
});
test('arrival at an occupied stand does not prevent that departure from vacating',()=>{
 const dep=row(1,'departure',['s-west']),arr=row(2,'arrival',['s-west'],{stand:dep.stand});
 a.equal(assess(dep,[dep,arr]).ok,true);a.match(assess(arr,[dep,arr]).why,/occupied/);
});
test('nearby traffic does not block a start, but own movement still does',()=>{
 const d=row(1,'departure',['n-b']);
 const own={call:d.call,lat:43.68,lon:-79.63,kt:0},near={call:'NEAR',lat:43.681,lon:-79.63,kt:8};
 a.equal(assess(d,[d],[own,near]).ok,true);
 a.equal(advance(1,[d],[own,near])[0].state,'pushing');
 a.equal(assess(d,[d],[own,{...near,lat:43.69}]).ok,true);
 a.match(assess(d,[d],[{...own,kt:8}]).why,/Already moving/);
 a.equal(groundFeed({at:100,rows:[own,near]},108).fresh,false);
 a.equal(groundFeed({at:100,rows:[own,near,{...near,kt:100}]},106).rows.length,2);
});
test('A short of AL to 136 gets priority over Gate 138 and only occupies AL after start',()=>{
 let b=alPractice(),get=()=>entranceBoard(b,['AL'])[0];
 a.deepEqual(get().holding.map(r=>r.call),['TEST136']);a.equal(get().using.length,0);
 a.match(assess(b[0],b).why,/Give way/);
 b[1].confirmed=true;b=advance(2,b);
 a.equal(get().holding.length,0);a.deepEqual(get().using.map(r=>r.call),['TEST136']);
 a.match(assess(b[0],b).why,/Reserved/);
 b=advance(2,b);a.equal(get().using.length,0);a.match(assess(b[0],b).why,/exhaust/);
 b[0].confirmed=true;for(let i=0;i<4;i++)b=advance(1,b);
 a.deepEqual(b.map(r=>r.state),['done','parked']);
});
test('same entrance reserves across desks and does not depend on lane labels',()=>{
 const departure=row(1,'departure',['n-throat'],{entry:'AL',state:'outbound'});
 const arrival=row(2,'arrival',['s-west'],{entry:entryName(' al ')});
 a.match(assess(arrival,[departure,arrival]).why,/Reserved/);
 a.equal(validEntry('EVENT A'),true);
 a.deepEqual(entranceBoard([arrival],[])[0].holding,[arrival]);
});
