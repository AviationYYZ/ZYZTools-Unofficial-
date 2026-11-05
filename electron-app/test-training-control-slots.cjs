const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {ControlSlots,defaults}=require('./src/training-control-slots'),{AltitudePresets}=require('./src/training-altitude-presets'),{SpeedPresets,defaults:speedDefaults}=require('./src/training-speed-presets');
test('independent named slots retain multiple values, categories and migration; dynamic defaults route to correct menus',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-named-slots-'));try{
  const p=new ControlSlots(dir),slots=p.get();assert.deepEqual(slots.ALT.slice(0,6).map(s=>s.value),['080','060','070','050','040','030']);
  slots.IAS[0]={name:'Slow',value:'175'};slots.IAS[1]={name:'Fast',value:'185'};slots.DCT[0]={name:'Bedpost',value:'LINNG'};slots.DCT[1]={name:'Final',value:'KIREX'};p.set(slots);
  const loaded=new ControlSlots(dir);assert.equal(loaded.get().IAS[0].value,'175');assert.equal(loaded.get().IAS[1].value,'185');assert(loaded.choices('IAS')[0].endsWith('[IAS 175]'));assert(loaded.choices('ALT')[0].endsWith('[ALT 8000]'));assert(loaded.choices('DCT')[1].endsWith('[DCT KIREX]'));
  slots.IAS[0]=null;p.set(slots);assert.equal(p.get().IAS[1].value,'185');assert.equal(p.get().DCT[1].value,'KIREX');
  const before=fs.readFileSync(p.file,'utf8');slots.ALT[0]={name:'invalid',value:'085'};assert.throws(()=>p.set(slots));assert.equal(fs.readFileSync(p.file,'utf8'),before);
  const c=new AltitudePresets(dir);c.set([{name:'North',fix:'linng',altitude:11000},{name:'East',fix:'RAGID',altitude:8000},null,null,null,null]);assert(c.choices()[0].endsWith('[CROSS LINNG AT 11000]'));assert.equal(new AltitudePresets(dir).get()[1].altitude,8000);
  assert.throws(()=>c.set([{name:'X',fix:'X,ALT0',altitude:11000},null,null,null,null,null]));
  const speed=new SpeedPresets(dir);assert.deepEqual(speed.get(),speedDefaults);assert(speed.choices()[0].includes('170 until NOAHA'));assert(speed.choices()[1].includes('170 until KIREX'));assert(speed.choices()[2].includes('170 until OMTOK'));
  const bridge=fs.readFileSync(path.join(__dirname,'src/training-command-bridge.js'),'utf8');assert(bridge.includes("field==='IAS'?this.presets.choices():field==='ALT'?this.altitudeSlots.choices():[]"));assert(bridge.includes('this.namedSlots.choices(field)'));
  const oldDir=path.join(dir,'migration');new(require('./src/training-control-presets').ControlPresets)(oldDir).set({DCT:['LINNG','KIREX']});assert.deepEqual(new ControlSlots(oldDir).get().ALT,defaults().ALT);assert.equal(new ControlSlots(oldDir).get().DCT[1].value,'KIREX');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
