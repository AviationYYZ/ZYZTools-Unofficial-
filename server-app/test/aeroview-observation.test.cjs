const {test}=require('node:test'),assert=require('node:assert/strict');
const {wind,atis}=require('../../electron-app/src/aeroview-observation.cjs');
const {formatWind}=require('../../electron-app/src/aeroview-client.js');
const {readField}=require('../../electron-app/src/aeroview-reader.cjs');
const now=Date.parse('2026-01-01T12:05:00Z');
test('reads rendered field and ATIS widgets with split lines',async()=>{
 const windText='350° 05kts\nAltimeter: 29.84\nWind Data Last Updated at\n2026-01-01 12:04Z';
 const atisText='ATIS Message\nLast Updated\n2026-01-01 12:04Z\nCYYZ ARR ATIS A SAMPLE';
 const tab={innerText:'NORTH FIELD',getAttribute:()=> 'true'};
 const node=innerText=>({innerText,getClientRects:()=>[{}]});
 global.document={querySelectorAll:selector=>selector==='[role=tab]'?[tab]:[node('CYYZ '+windText),node(windText),node(atisText)]};
 try{
  const row=await readField('north');
  assert.equal(wind('north',row.wind,now).direction,350);
  assert.equal(atis(row.atis,now).kind,'ARR');
 }finally{delete global.document;}
});
test('keeps the two wind observations independent',()=>{
 const north=wind('north','350° 05kts Altimeter: 29.84 Wind Data Last Updated at 2026-01-01 12:04Z',now);
 const south=wind('south','010° 12G20kts Wind Data Last Updated at 2026-01-01 12:00Z',now);
 assert.equal(north.direction,350);assert.equal(north.speed,5);assert.equal(south.direction,10);assert.equal(south.gust,20);
 assert.notEqual(north.observedAt,south.observedAt);
});
test('rejects malformed timestamps and distinguishes stale from missing',()=>{
 assert.equal(wind('north','350° 05kts',now).status,'unavailable');
 assert.equal(wind('north','350° 05kts Wind Data Last Updated at 2026-02-31 12:00Z',now).status,'unavailable');
 assert.equal(wind('south','350° 05kts Wind Data Last Updated at 2026-01-01 11:50Z',now).status,'stale');
});
test('client wind display keeps source time and never substitutes a missing field',()=>{
 assert.equal(formatWind(wind('north','350° 05kts Wind Data Last Updated at 2026-01-01 12:04Z',now),now),'350/05 kt  12:04Z');
 assert.equal(formatWind(null,now),'Unavailable');
 assert.equal(formatWind(wind('south','010° 12G20kts Wind Data Last Updated at 2026-01-01 11:50Z',now),now),'Stale (11:50Z)');
});
test('separates arrival, departure and combined ATIS from other page text',()=>{
 for(const [input,kind] of [['ARR ','ARR'],['DEP ','DEP'],['','combined']]){
  const value=atis('ATIS Message Last Updated 2026-01-01 12:04Z CYYZ '+input+'ATIS A SAMPLE FOR TEST',now);
  assert.equal(value.kind,kind);assert.equal(value.status,'current');
 }
 assert.equal(atis('ATIS Message Last Updated 2026-01-01 12:04Z CYYC ARR ATIS A SAMPLE',now),null);
});
