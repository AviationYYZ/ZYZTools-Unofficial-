const {test}=require('node:test'),assert=require('node:assert/strict');
const {LocalTraining,geometry}=require('./src/local-training'),flight=require('./src/training-flight'),model=require('./src/training-pilot-tags');
const base={format:'ZYZTools-training',version:1,name:'Synthetic restrictions',magneticVariationWest:0,waypoints:[{name:'LINNG',lat:0,lon:.2},{name:'KIREX',lat:0,lon:.4},{name:'EXIT',lat:0,lon:.7}],aircraft:[{callsign:'TEST101',type:'A320',lat:0,lon:0,heading:90,altitude:15000,speed:250,speedBasis:'IAS',squawk:'2001',route:'LINNG KIREX EXIT'}]};
function sim(){const s=new LocalTraining();s.load(base);return s;}
test('exact jet altitude bands, gap/overlap policy, all common jets and non-jet fallback',()=>{
 for(const type of ['A320','B738','B77W','E75L','CRJ9','C25C','GLF6','MD11','HDJT','SF50'])for(const [altitude,expected] of [[0,136],[1900,136],[1999,136],[2000,160],[2900,160],[2999,160],[3000,200],[3900,200],[3999,200],[4000,210],[8100,210],[8101,230],[11000,230],[11099,230],[11100,250],[15000,250],[15001,270]])assert.equal(flight.publishedIAS({type,altitude,baseIAS:250,speed:250,targetAltitude:altitude},[],[],geometry),expected,type+' at '+altitude);
 assert(flight.publishedIAS({type:'C172',altitude:3000,baseIAS:100,speed:100,targetAltitude:3000},[],[],geometry)<136);
});
test('hold IAS until route fix, queue restrictions and return to automatic mode',()=>{
 for(const manual of [false,true]){const s=sim(),a=s.aircraft[0];if(manual)s.command(a.callsign,'IAS 220');s.command(a.callsign,'IAS 170 UNTIL LINNG');s.command(a.callsign,'IAS 190 UNTIL KIREX');s.tick(1);assert.equal(a.targetIAS,170);let first=false,second=false;
 for(let t=0;t<900;t++){s.tick(1);if(!a.remaining.includes('LINNG')&&a.speedRestrictions.some(r=>r.fix==='KIREX')){s.tick(.1);assert.equal(a.targetIAS,190);first=true;}if(!a.speedRestrictions.length){s.tick(.1);assert.equal(a.speedMode,'published');assert.equal(a.targetIAS,250);second=true;break;}}
 assert(first&&second);assert(!a.speedRestrictions.length);}
});
test('cross a fix at altitude using continuous bounded vertical guidance; no teleport and no scenario mutation',()=>{
 const s=sim(),a=s.aircraft[0];s.command(a.callsign,'CROSS LINNG AT 11000');assert.equal(a.altitude,15000);let done=false;
 for(let t=0;t<9000;t++){const old=a.altitude;s.tick(.1);assert(Math.abs(a.altitude-old)<=10.001);if(!a.remaining.includes('LINNG')){assert(Math.abs(a.altitude-11000)<100,JSON.stringify(a));done=true;break;}}
 assert(done);s.tick(.1);assert.match(a.crossingNotice,/met/);assert.equal(s.scenario.aircraft[0].altitude,15000);
});
test('validation, atomic batches, overrides, skipped fixes, pause and reset',()=>{
 const s=sim(),a=s.aircraft[0];for(const c of ['IAS 20 UNTIL LINNG','CROSS MISSING AT 11000','CROSS LINNG AT 99999','IAS 170 UNTIL LINNG, CROSS MISSING AT 11000']){const old=JSON.stringify(a);assert.throws(()=>s.command(a.callsign,c));assert.equal(JSON.stringify(a),old);}
 s.command(a.callsign,'IAS 170 UNTIL LINNG, CROSS LINNG AT 11000');s.command(a.callsign,'PAUSE ON');s.tick(10);assert.equal(a.altitude,15000);assert.equal(a.speedRestrictions.length,1);s.command(a.callsign,'PAUSE OFF');s.command(a.callsign,'DCT EXIT');s.tick(.1);assert.equal(a.speedMode,'published');assert(!a.crossingRestrictions.length);
 s.reset();const b=s.aircraft[0];s.command(b.callsign,'IAS 170 UNTIL LINNG');s.command(b.callsign,'MACH .60');assert(!b.speedRestrictions.length);assert.equal(b.speedMode,'mach');s.command(b.callsign,'CROSS LINNG AT 11000');s.command(b.callsign,'ALT 12000');assert(!b.crossingRestrictions.length);assert.equal(b.targetAltitude,12000);
 s.command(b.callsign,'IAS 180 UNTIL KIREX');s.command(b.callsign,'RESTRICTIONS SPEED CLEAR');assert.equal(b.speedMode,'published');s.command(b.callsign,'CROSS LINNG AT 11000');s.command(b.callsign,'RESTRICTIONS ALT CLEAR');assert(!b.crossingRestrictions.length);s.reset();assert(!s.aircraft[0].speedRestrictions?.length);
});
test('advanced menu and restriction targets retain student matching',()=>{const s=sim(),a=s.aircraft[0];assert.deepEqual(model.menu('ADV',a,s.status()),['Delete aircraft','Enter squawk','IDENT','Clear speed restrictions','Custom speed restrictions','Crossing altitude restrictions']);assert.deepEqual(model.order('IAS 170 UNTIL KIREX'),{field:'IAS',value:'170',untilFix:'KIREX'});assert.deepEqual(model.order('CROSS LINNG AT 11000'),{field:'ALT',value:'11000'});s.command(a.callsign,'DELETE AIRCRAFT');assert.equal(s.aircraft.length,0);});
