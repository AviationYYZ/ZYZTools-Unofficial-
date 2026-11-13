const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {levels,modes,weatherSettings,synthetic,decode,RadarFeed}=require('./src/radar-reflectivity');
test('weather controls preserve valid settings and reject invalid range, mode and height',()=>{
 const settings={radar_weather_layers:3,radar_weather_altitude:2000,radar_weather_mode:'line',radar_weather_range_nm:30};
 assert.deepEqual(weatherSettings(settings),settings);
 for(const range of [10,75])assert.equal(weatherSettings({radar_weather_range_nm:range}).radar_weather_range_nm,range);
 assert.deepEqual(weatherSettings({radar_weather_layers:12,radar_weather_altitude:2100,radar_weather_mode:'other',radar_weather_range_nm:76}),
   {radar_weather_layers:0,radar_weather_altitude:1500,radar_weather_mode:'live',radar_weather_range_nm:75});
});
test('storm profiles have distinct strengths and clear air above echo tops',()=>{
 const g=(m,h)=>synthetic(m,h).grid;
 assert(g('clear',500).every(x=>!x));
 assert(g('supercell',1500).some(x=>x>=90));
 assert(g('line',1500).some(x=>x>=90));
 assert(g('light',1500).some(x=>x>0));
 assert(g('light',1500).every(x=>x<90));
 assert(g('supercell',11000).every(x=>!x));
 assert.notDeepEqual(g('supercell',1500),g('supercell',6000));
 assert.throws(()=>decode(Buffer.from('not GRIB'),1500));
});
test('test feed writes altitude-tagged grids without contacting live weather',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-radar-'));
 try{
  const feed=new RadarFeed();
  for(const mode of modes.slice(1)){
   feed.tick(dir,1500,mode);await feed.pending;
   const file=fs.readFileSync(path.join(dir,'RadarReflectivity.bin'));
   assert.equal(file.toString('ascii',0,4),'WXG2');
   assert.equal(file.readUInt32LE(4),1500);
   assert.equal(file.readUInt32LE(16),modes.indexOf(mode));
   assert.equal(file.length,120020);
  }
  assert.equal(levels.length,33);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
