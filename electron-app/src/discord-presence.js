const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const APPLICATION_ID = '1560430298968105010';
const defaults = { enabled:false, airports:'CYYZ', details:'Controlling {position}', state:'{traffic} traffic • {count} aircraft • {airports}', medium:6, high:15, lowLabel:'Light', mediumLabel:'Moderate', highLabel:'Heavy', radius:4, altitude:300, speed:60, button1Label:'', button1Url:'', button2Label:'', button2Url:'', largeImage:'', largeText:'', showElapsed:true };
function normalize(input = {}) {
  const c = {...defaults,...input};
  c.enabled = c.enabled === true; c.showElapsed = c.showElapsed !== false;
  c.airports = [...new Set(String(c.airports).toUpperCase().split(/[\s,;]+/).filter(Boolean))].join(', ');
  if(c.airports && !c.airports.split(', ').every(code=>/^[A-Z0-9]{4}$/.test(code))) throw Error('Enter four-character airport codes, separated by commas.');
  if(c.airports.split(', ').length>30) throw Error('Use at most 30 airports.');
  for(const key of ['details','state','lowLabel','mediumLabel','highLabel','largeImage','largeText']) {
    c[key]=String(c[key]||'').trim();
    if(c[key].length>128) throw Error(key+' must be at most 128 characters.');
  }
  for(const key of ['details','state','largeText']) {
    const text=c[key].replace(/\{(position|airports|count|traffic|source)\}/g,'');
    if(/[{}]/.test(text)) throw Error('Status variables: {position}, {airports}, {count}, {traffic}, {source}.');
  }
  for(const [key,min,max] of [['medium',1,500],['high',2,1000],['radius',1,10],['altitude',50,1000],['speed',1,150]]) {
    c[key]=Number(c[key]); if(!Number.isFinite(c[key]) || c[key]<min || c[key]>max) throw Error('Invalid '+key+' threshold.');
  }
  if(c.high<=c.medium) throw Error('Heavy traffic threshold must exceed moderate.');
  for(const n of [1,2]) {
    c['button'+n+'Label']=String(c['button'+n+'Label']||'').trim();
    c['button'+n+'Url']=String(c['button'+n+'Url']||'').trim();
    if(c['button'+n+'Label'].length>32) throw Error('Button labels must be at most 32 characters.');
    if(!!c['button'+n+'Label'] !== !!c['button'+n+'Url']) throw Error('Each button needs both a label and a URL, or neither.');
    if(c['button'+n+'Url']) {
      let u; try { u=new URL(c['button'+n+'Url']); } catch { throw Error('Enter a valid button URL.'); }
      if(!['https:','http:'].includes(u.protocol) || u.username || u.password || u.href.length>512) throw Error('Buttons require http(s) URLs without credentials.');
    }
  }
  if(c.largeImage && !/^[a-zA-Z0-9_-]{1,128}$/.test(c.largeImage)) throw Error('Image must be an uploaded Discord application asset key.');
  return c;
}
function distance(a,b) {
  const rad=Math.PI/180, dlat=(a.latitude-b.lat)*rad, dlon=(a.longitude-b.lon)*rad;
  const h=Math.sin(dlat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
  return 3440.065*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
function groundCount(pilots, airports, database, config) {
  const missing=airports.filter(code=>!database[code]);
  if(missing.length) throw Error('Unknown airport codes: '+missing.join(', '));
  return pilots.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) &&
    Number.isFinite(p.altitude) && Number.isFinite(p.groundspeed) && p.groundspeed<=config.speed &&
    airports.some(code=>{
      const a=database[code];
      return Math.abs(p.altitude-Number(a.elevation))<=config.altitude && distance(p,a)<=config.radius;
    })).length;
}
function activity(config, snapshot, count, startedAt) {
  const radar=/_(APP|CTR)$/i.test(snapshot.position);
  const values={position:snapshot.position,airports:config.airports||'No airports selected',count:String(count),
    traffic:count>=config.high?config.highLabel:count>=config.medium?config.mediumLabel:config.lowLabel,source:radar?'Owned tags':'Ground aircraft'};
  const render=text=>text.replace(/\{(\w+)\}/g,(_,key)=>values[key]||'').slice(0,128);
  const result={type:0};
  if(config.details) result.details=render(config.details);
  if(config.state) result.state=render(config.state);
  if(config.showElapsed) result.timestamps={start:startedAt};
  if(config.largeImage) result.assets={large_image:config.largeImage,...(config.largeText?{large_text:render(config.largeText)}:{})};
  const buttons=[1,2].filter(n=>config['button'+n+'Label']).map(n=>({label:config['button'+n+'Label'],url:config['button'+n+'Url']}));
  if(buttons.length) result.buttons=buttons;
  return result;
}
class DiscordIPC {
  constructor(){this.socket=null;this.pending=new Map();this.connected=false;}
  frame(op,data){const body=Buffer.from(JSON.stringify(data));const header=Buffer.alloc(8);header.writeUInt32LE(op);header.writeUInt32LE(body.length,4);return Buffer.concat([header,body]);}
  async connect(){
    if(this.connected)return;
    for(let i=0;i<10;i++){
      try { await this.open('\\\\?\\pipe\\discord-ipc-'+i); return; } catch {}
    }
    throw Error('Discord desktop is unavailable. Open Discord and enable activity sharing.');
  }
  open(pipe){
    return new Promise((resolve,reject)=>{
      const socket=net.createConnection(pipe); this.socket=socket; let buffer=Buffer.alloc(0), ready=false;
      const timer=setTimeout(()=>socket.destroy(Error('Discord handshake timed out.')),2000);
      const fail=error=>{clearTimeout(timer);this.connected=false;if(!ready)reject(error);for(const p of this.pending.values())p.reject(error);this.pending.clear();};
      socket.on('error',fail);
      socket.on('close',()=>fail(Error('Discord connection closed.')));
      socket.on('connect',()=>socket.write(this.frame(0,{v:1,client_id:APPLICATION_ID})));
      socket.on('data',chunk=>{
        buffer=Buffer.concat([buffer,chunk]);
        while(buffer.length>=8){
          const op=buffer.readUInt32LE(0),length=buffer.readUInt32LE(4);
          if(length>1024*1024){socket.destroy(Error('Invalid Discord frame.'));return;}
          if(buffer.length<8+length)return;
          const bytes=buffer.subarray(8,8+length);buffer=buffer.subarray(8+length);
          let payload;try{payload=JSON.parse(bytes.toString());}catch{socket.destroy(Error('Invalid Discord response.'));return;}
          if(op===3){socket.write(this.frame(4,payload));continue;}
          if(op===2){socket.destroy(Error('Discord closed the connection.'));return;}
          if(payload.evt==='READY'){ready=true;clearTimeout(timer);this.connected=true;resolve();}
          const pending=this.pending.get(payload.nonce);
          if(pending){this.pending.delete(payload.nonce);payload.evt==='ERROR'?pending.reject(Error(payload.data?.message||'Discord rejected activity.')):pending.resolve();}
        }
      });
    });
  }
  async set(value){
    await this.connect();
    const nonce=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(nonce);reject(Error('Discord activity acknowledgement timed out.'));},5000);
      this.pending.set(nonce,{resolve:()=>{clearTimeout(timer);resolve();},reject:e=>{clearTimeout(timer);reject(e);}});
      this.socket.write(this.frame(1,{cmd:'SET_ACTIVITY',args:{pid:process.pid,activity:value},nonce}));
    });
  }
  close(){this.socket?.destroy();this.connected=false;}
}
class PresenceService {
  constructor(settingsFile,folder, fetcher=fetch, rpc=new DiscordIPC()){
    this.settingsFile=settingsFile;this.folder=folder;this.fetch=fetcher;this.rpc=rpc;
    this.status='Disabled';this.preview=null;this.busy=false;this.lastActivity=null;this.session='';this.startedAt=0;
    try{this.config=normalize(JSON.parse(fs.readFileSync(settingsFile,'utf8')));}catch{this.config={...defaults};}
  }
  save(value,folder){const config=normalize(value);fs.mkdirSync(path.dirname(this.settingsFile),{recursive:true});fs.writeFileSync(this.settingsFile,JSON.stringify(config,null,2));this.config=config;this.folder=folder;this.lastActivity=null;this.retryUntil=0;}
  start(){this.timer=setInterval(()=>this.tick(),5000);this.timer.unref();this.tick();}
  async clear(){this.preview=null;if(this.rpc.connected){try{await this.rpc.set(null);}catch{}}this.rpc.close();this.lastActivity=null;this.session='';}
  async json(url){const response=await this.fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Traffic data unavailable (HTTP '+response.status+').');return response.json();}
  async tick(){
    if(this.busy)return;this.busy=true;
    try{
      if(!this.config.enabled){await this.clear();this.status='Disabled';return;}
      if(Date.now()<(this.retryUntil||0))return;
      let snapshot;try{snapshot=JSON.parse(fs.readFileSync(path.join(this.folder,'DiscordPresence.json'),'utf8'));}catch{}
      if(!snapshot?.connected || !Number.isFinite(snapshot.ts) || Math.abs(Date.now()/1000-snapshot.ts)>20 || typeof snapshot.position!=='string' || !snapshot.position){
        await this.clear();this.status='Waiting for a connected EuroScope plugin (update via Install / Link).';return;
      }
      const session=snapshot.position+':'+snapshot.session;
      if(this.session!==session){this.session=session;this.startedAt=Math.floor(Date.now()/1000);}
      const radar=/_(APP|CTR)$/i.test(snapshot.position);let count;
      if(radar){count=Math.max(0,Number(snapshot.owned)||0);}
      else{
        const airports=this.config.airports.split(', ').filter(Boolean);if(!airports.length)throw Error('Enter at least one airport for non-radar positions.');
        if(!this.airports){
          const cache=path.join(path.dirname(this.settingsFile),'discord-airports.json');
          try{this.airports=JSON.parse(fs.readFileSync(cache,'utf8'));}catch{
            this.airports=await this.json('https://raw.githubusercontent.com/mwgg/Airports/master/airports.json');
            fs.mkdirSync(path.dirname(cache),{recursive:true});fs.writeFileSync(cache,JSON.stringify(this.airports));
          }
        }
        if(!this.feed || Date.now()-this.feedTime>60000){
          this.feed=await this.json('https://data.vatsim.net/v3/vatsim-data.json');this.feedTime=Date.now();
        }
        if(!Array.isArray(this.feed.pilots))throw Error('Invalid VATSIM traffic response.');
        const feedTimestamp=Date.parse(this.feed.general?.update_timestamp);
        if(!Number.isFinite(feedTimestamp) || Math.abs(Date.now()-feedTimestamp)>180000)throw Error('VATSIM traffic feed is stale.');
        count=groundCount(this.feed.pilots,airports,this.airports,this.config);
      }
      // Do not publish if the plugin disappeared while data was being fetched.
      const fresh=JSON.parse(fs.readFileSync(path.join(this.folder,'DiscordPresence.json'),'utf8'));
      if(!this.config.enabled || !fresh.connected || fresh.position!==snapshot.position || !Number.isFinite(fresh.ts) || Math.abs(Date.now()/1000-fresh.ts)>20){await this.clear();return;}
      const value=activity(this.config,snapshot,count,this.startedAt);
      const serialized=JSON.stringify(value);
      if(serialized!==this.lastActivity || !this.rpc.connected){await this.rpc.set(value);this.lastActivity=serialized;}
      this.preview=value;this.status='Connected to Discord • '+count+' '+(radar?'owned tags':'ground aircraft (estimated)');
    }catch(error){await this.clear();this.status=error.message;this.retryUntil=Date.now()+60000;}
    finally{this.busy=false;}
  }
  async stop(){clearInterval(this.timer);await this.clear();}
}
module.exports={APPLICATION_ID,defaults,normalize,distance,groundCount,activity,DiscordIPC,PresenceService};
