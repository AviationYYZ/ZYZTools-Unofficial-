// NOAA MRMS quality-controlled constant-height reflectivity, Toronto crop.
const {gunzipSync,inflateSync}=require('node:zlib');
const fs=require('node:fs'),path=require('node:path');
const levels=[500,750,1000,1250,1500,1750,2000,2250,2500,2750,3000,3500,4000,4500,5000,5500,6000,6500,7000,7500,8000,8500,9000,10000,11000,12000,13000,14000,15000,16000,17000,18000,19000];
const width=400,height=300;
function decode(bytes,altitude){
 const b=gunzipSync(bytes,{maxOutputLength:8*1024*1024});
 if(b.toString('ascii',0,4)!=='GRIB'||b[6]!==209||b[7]!==2||b.readBigUInt64BE(8)!==BigInt(b.length)||b.toString('ascii',b.length-4)!=='7777')throw Error('Unexpected MRMS file');
 const s={};
 for(let i=16;i<b.length-4;){const n=b.readUInt32BE(i);if(n<5||i+n>b.length-4||s[b[i+4]])throw Error('Invalid GRIB section');s[b[i+4]]=b.subarray(i,i+n);i+=n;}
 const g=s[3],p=s[4],d=s[5],bitmap=s[6],t=s[1],png=s[7]?.subarray(5);
 if(t?.length!==21||g?.length!==72||p?.length!==34||d?.length!==21||bitmap?.[5]!==255||!png||
  g.readUInt16BE(12)!==0||g.readUInt32BE(30)!==7000||g.readUInt32BE(34)!==3500||
  g.readUInt32BE(38)!==1||g.readUInt32BE(42)!==1000000||g.readUInt32BE(46)!==54995000||g.readUInt32BE(50)!==230005000||
  g.readUInt32BE(63)!==10000||g.readUInt32BE(67)!==10000||g[71]!==0||
  p.readUInt16BE(7)!==0||p[9]!==9||p[10]!==0||p[22]!==102||p[23]!==0||p.readUInt32BE(24)!==altitude||
  d.readUInt16BE(9)!==41||d[19]!==16||d.readUInt16BE(15)!==0||d.readUInt16BE(17)!==1)throw Error('Unsupported MRMS grid');
 const utc=Date.UTC(t.readUInt16BE(12),t[14]-1,t[15],t[16],t[17],t[18]);
 if(!Number.isFinite(utc))throw Error('Missing radar observation time');
 if(png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||png.readUInt32BE(16)!==7000||png.readUInt32BE(20)!==3500||png[24]!==16||png[25]!==0||png[26]||png[27]||png[28])throw Error('Unsupported MRMS PNG');
 const chunks=[];
 for(let i=8;i<png.length;){const n=png.readUInt32BE(i);if(i+12+n>png.length)throw Error('Invalid PNG chunk');if(png.toString('ascii',i+4,i+8)==='IDAT')chunks.push(png.subarray(i+8,i+8+n));i+=12+n;}
 const stride=14000,raw=inflateSync(Buffer.concat(chunks),{maxOutputLength:(stride+1)*3500});
 if(raw.length!==(stride+1)*3500)throw Error('Unexpected MRMS raster size');
 const grid=Buffer.alloc(width*height),ref=d.readFloatBE(11);
 if(!Number.isFinite(ref))throw Error('Invalid reflectivity scale');
 const row=Buffer.alloc(stride);
 for(let y=0;y<1275;y++){
  let left0=0,left1=0,corner0=0,corner1=0;
  const start=y*(stride+1),filter=raw[start];
  if(filter>4)throw Error('Unsupported PNG filter');
  for(let x=0;x<stride;x++){
   const odd=x&1,left=odd?left1:left0,corner=odd?corner1:corner0,up=row[x];
   const a=Math.abs(up-corner),c=Math.abs(left-corner),e=Math.abs(left+up-2*corner);
   const predict=filter===1?left:filter===2?up:filter===3?(left+up)>>1:filter===4?(a<=c&&a<=e?left:c<=e?up:corner):0;
   const value=(raw[start+1+x]+predict)&255;
   row[x]=value;
   if(odd){left1=value;corner1=up;}else{left0=value;corner0=up;}
  }
  if(y<975)continue;
  for(let x=0;x<width;x++){
   const dbz=(ref+row.readUInt16BE((4850+x)*2))/10;
   // Both provider sentinels (-99/-999) and non-positive echo are clear.
   if(dbz>0&&dbz<=100)grid[(y-975)*width+x]=Math.min(200,Math.max(1,Math.round(dbz*2)));
  }
 }
 return {utc,grid};
}
const modes=['live','supercell','line','light','clear'];
function weatherSettings(value={}){
 const layers=Number(value.radar_weather_layers),altitude=Number(value.radar_weather_altitude),range=Number(value.radar_weather_range_nm);
 return {
  radar_weather_layers:Number.isInteger(layers)&&layers>=0&&layers<=7?layers&3:0,
  radar_weather_altitude:levels.includes(altitude)?altitude:1500,
  radar_weather_mode:modes.includes(value.radar_weather_mode)?value.radar_weather_mode:'live',
  radar_weather_range_nm:Number.isInteger(range)&&range>=10&&range<=75?range:75
 };
}
function synthetic(mode,altitude){
 const grid=Buffer.alloc(width*height);
 const cells=mode==='supercell'?[[158,162,66,34,25,10000],[208,125,51,27,20,6500],[126,185,39,46,22,4000]]:
  mode==='line'?Array.from({length:8},(_,i)=>[72+i*37,215-i*19,48+i%3*6,27,15,6500+i%3*1250]):
  mode==='light'?[[180,145,27,96,54,2900],[220,195,22,65,43,2300]]:[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  let dbz=0;
  for(const [cx,cy,peak,sx,sy,top] of cells){
   if(altitude>=top)continue;
   const shift=altitude/450;
   dbz=Math.max(dbz,peak*Math.exp(-(((x-cx-shift)/sx)**2+((y-cy)/sy)**2))*(1-(altitude/top)**2));
  }
  if(dbz>=5)grid[y*width+x]=Math.round(dbz*2);
 }
 return {utc:Date.now(),grid};
}
class RadarFeed{
 constructor(){this.next=0;}
 tick(folder,altitude,mode='live'){
  if(!folder||!levels.includes(altitude)||this.pending)return;
  if(!modes.includes(mode))mode='live';
  const key=folder+'|'+altitude+'|'+mode;
  if(key===this.key&&Date.now()<this.next)return;
  this.key=key;this.next=Date.now()+60000;
  this.pending=this.fetch(folder,altitude,mode).catch(()=>{}).finally(()=>{this.pending=null;});
 }
 async fetch(folder,altitude,mode){
  let result;
  if(mode!=='live')result=synthetic(mode,altitude);
  else {
  const name='MergedReflectivityQC_'+(altitude/1000).toFixed(2).padStart(5,'0');
  const response=await fetch('https://mrms.ncep.noaa.gov/3DRefl/'+name+'/MRMS_'+name+'.latest.grib2.gz',{redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('MRMS unavailable');
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>4*1024*1024)throw Error('MRMS download too large');chunks.push(chunk);}
  result=decode(Buffer.concat(chunks,size),altitude);
  }
  const {utc,grid}=result;
  if(Date.now()-utc>15*60000||utc-Date.now()>120000)throw Error('MRMS observation is stale');
  const header=Buffer.alloc(20);header.write('WXG2');header.writeUInt32LE(altitude,4);header.writeBigUInt64LE(BigInt(utc),8);header.writeUInt32LE(modes.indexOf(mode),16);
  const target=path.join(folder,'RadarReflectivity.bin');
  fs.writeFileSync(target+'.tmp',Buffer.concat([header,grid]));fs.renameSync(target+'.tmp',target);
 }
}
module.exports={levels,modes,weatherSettings,decode,synthetic,RadarFeed};
