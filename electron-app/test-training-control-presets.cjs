const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {ControlPresets,normalize}=require('./src/training-control-presets'),model=require('./src/training-pilot-tags');
test('all control categories persist independently and prioritize choices without losing full menus',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-controls-'));try{
  const p=new ControlPresets(path.join(dir,'test')),prod=new ControlPresets(path.join(dir,'production'));
  const initial=prod.get();p.set({ALT:['080','030'],IAS:['175','210'],MACH:['.78'],HDG:['330','Fly present heading'],DCT:['kirex','LINNG'],SQ:['4521'],RATE:['2250'],APP:['CANCEL'],ADV:['IDENT']});
  const saved=new ControlPresets(path.join(dir,'test'));assert.deepEqual(saved.get().ALT,['080','030']);assert.deepEqual(prod.get(),initial);
  for(const field of Object.keys(initial)){
   const base=model.menu(field,{remaining:['LINNG'],squawk:'1000'},{aircraft:[],fixes:[]}),choices=saved.choices(field,base);
   assert.equal(choices[0],saved.get()[field][0]);for(const item of base)assert(choices.includes(item));assert.equal(new Set(choices).size,choices.length);
  }
  assert(saved.choices('IAS',['170']).includes('175'));assert(saved.choices('DCT',[]).includes('KIREX'));
  const before=fs.readFileSync(p.file,'utf8');for(const bad of [{ALT:['085']},{IAS:['999']},{HDG:['361']},{MACH:['1']},{DCT:['FIX, ALT 0']},{SQ:['8888']},{RATE:['9999']},{ADV:['arbitrary command']},{ALT:Array(13).fill('080')}])assert.throws(()=>p.set(bad));assert.equal(fs.readFileSync(p.file,'utf8'),before);
  assert.deepEqual(normalize({ALT:[]}).ALT,[]);
  p.set({ALT:['070','090']});assert.deepEqual(p.get().DCT,['KIREX','LINNG']);assert.deepEqual(p.get().IAS,['175','210']);assert.deepEqual(new ControlPresets(path.join(dir,'test')).get().ALT,['070','090']);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('native radar navigation buttons are direct left / heading right; presets remain visible on opening',()=>{
 const cpp=fs.readFileSync(path.join(__dirname,'../src/ZYZToolsPlugin.cpp'),'utf8'),drop=fs.readFileSync(path.join(__dirname,'../src/TrainingPilotDropdown.h'),'utf8');
 assert(cpp.includes('index==2?(Button==BUTTON_RIGHT?"HDG":"DCT")'));assert(cpp.includes('column("HDG",4,TrainingPilotList::Heading,9713,9714)'));assert(drop.includes('CB_SETTOPINDEX,0,0'));assert(cpp.includes('if(value=="Set vertical rate")'));assert(cpp.includes('Enter custom squawk...'));
});
