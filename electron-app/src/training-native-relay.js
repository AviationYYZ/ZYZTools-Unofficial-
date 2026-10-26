// A loopback-only private FSD relay. EuroScope on the server PC is the sole
// simulation authority. No ZYZTools tick, speed, altitude or approach guidance.
const net=require('node:net'),crypto=require('node:crypto'),{normalize}=require('./local-training');
class NativeEuroScopeRelay{
 constructor(host){if(!/^127\.0\.0\.(11|12|13)$/.test(host))throw Error('Native relay must use its dedicated loopback slot.');this.host=host;this.clients=new Set();this.roles=new Map();this.positions=new Map();this.plans=new Map();this.controllers=new Map();this.scenario=normalize({format:'ZYZTools-training',version:1,name:'Native session',waypoints:[],aircraft:[]});this.sessionId=crypto.randomUUID();this.mode='euroscope';this.running=null;this.elapsed=null;this.lastEvent='Waiting for server-PC EuroScope.';}
 load(raw){if(this.server)throw Error('Stop before changing a native scenario.');this.scenario=normalize(raw);return this.status();}
 registerTransportPort(port,role){if(!['student','instructor'].includes(role)||!Number.isInteger(port))throw Error('Invalid native transport role.');this.roles.set(port,role);}
 unregisterTransportPort(port){this.roles.delete(port);}
 role(c){return c.admittedRole||this.roles.get(c.socket.remotePort)||'host';}
 status(){const hostConnected=[...this.clients].some(c=>c.callsign&&this.role(c)==='host');return {engineMode:'euroscope',nativeEngine:true,nativeHostConnected:hostConnected,magneticVariationWest:this.scenario?.magneticVariationWest||0,sessionId:this.sessionId,listening:!!this.server,host:this.host,port:this.port||6809,running:null,elapsed:null,scenario:this.scenario,aircraft:[...this.positions.values()].map(a=>({...a,magneticHeading:(a.heading+(this.scenario?.magneticVariationWest||0)+360)%360,targetMagneticHeading:null})),clients:[...this.clients].filter(c=>c.callsign&&this.role(c)!=='host').length,lastEvent:this.lastEvent};}
 write(c,line){if(!c.socket.destroyed){if(c.socket.writableLength>1024*1024){c.socket.destroy();return;}c.socket.write(line+'\r\n');}}
 forward(c,line){for(const peer of this.clients)if(peer!==c&&peer.callsign)this.write(peer,line);}
 receive(c,line){
  const role=this.role(c);if(line.length>8192||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(line))return;
  if(line.startsWith('#AA')){const name=line.slice(3).split(':')[0];if(!/^[A-Z0-9_]{2,16}$/.test(name)||[...this.clients].some(p=>p!==c&&p.callsign===name)){c.socket.destroy();return;}c.admittedRole=role;c.callsign=name;this.write(c,'#TMSERVER:'+name+':PRIVATE LOCAL NATIVE EUROScope relay. Never connect to VATSIM.');for(const p of this.positions.values())this.write(c,p.packet);for(const p of this.plans.values())this.write(c,p);for(const p of this.controllers.values())this.write(c,p);this.lastEvent=role==='host'?'Server-PC EuroScope connected; use its native pause/run.':'Private '+role+' joined.';return;}
  if(line.startsWith('#AP')){if(role!=='host')return;const name=line.slice(3).split(':')[0];if(!/^[A-Z][A-Z0-9]{1,11}$/.test(name))return;c.admittedRole=role;if(!c.callsign)c.callsign=name;return;}
  if(!c.callsign)return;
  if(line.startsWith('$PI')){this.write(c,'$POSERVER:'+c.callsign+':'+line.split(':').slice(2).join(':'));return;}
  if(line.startsWith('#DA')){if(line.slice(3).split(':')[0]===c.callsign)c.socket.end();return;}
  if(/^@[NSY]:/.test(line)){
   if(role!=='host')return;const p=line.split(':'),lat=Number(p[4]),lon=Number(p[5]),altitude=Number(p[6]),speed=Number(p[7]);
   if(!/^[A-Z][A-Z0-9]{1,11}$/.test(p[1])||!Number.isFinite(lat)||Math.abs(lat)>89||!Number.isFinite(lon)||Math.abs(lon)>180||!Number.isFinite(altitude)||altitude<0||altitude>60000||!Number.isFinite(speed)||speed<0||speed>1200)return;
   if(!this.positions.has(p[1])&&this.positions.size>=100)return;
   const seed=this.scenario.aircraft.find(a=>a.callsign===p[1]);this.positions.set(p[1],{...seed,callsign:p[1],lat,lon,altitude,speed,heading:((Number(p[8])>>>2)&1023)*360/1024,ias:null,targetIAS:null,targetAltitude:null,active:true,squawk:p[2],speedMode:'native EuroScope',navigation:'native EuroScope',remaining:[],packet:line});this.forward(c,line);return;
  }
  if(line.startsWith('#DP')){if(role!=='host')return;const name=line.slice(3).split(':')[0];this.positions.delete(name);this.plans.delete(name);this.forward(c,line);return;}
  if(line.startsWith('$FP')){if(role!=='host')return;const name=line.slice(3).split(':')[0];if(!/^[A-Z][A-Z0-9]{1,11}$/.test(name)||this.plans.size>=100&&!this.plans.has(name))return;this.plans.set(name,line);this.forward(c,line);return;}
  const prefix=line.slice(0,3),fields=line.slice(prefix==='%'?1:3).split(':');
  if(line.startsWith('%')){const name=line.slice(1).split(':')[0];if(role!=='host'&&name!==c.callsign)return;if(this.controllers.size>=64&&!this.controllers.has(name))return;this.controllers.set(name,line);this.forward(c,line);return;}
  if(!['#PC','$CQ','$CR','$AM','#TM','$PO'].includes(prefix)){if(role!=='student'&&!['$ID','$DI','$ZC','$ZR'].includes(prefix))this.forward(c,line);return;}
  if(role!=='host'&&fields[0]!==c.callsign)return;
  if(role==='student'){
   // Student traffic may update controller metadata, but cannot send private
   // simulator messages, claim a driver or publish aircraft/state packets.
   const ordinary=['FP','BC','IT','HT','IC','SC','TA','CAPS','ATIS','RN','RV'];
   if(prefix==='#PC'&&(fields[2]!=='CCP'||!ordinary.includes(fields[3])))return;
   if(prefix==='$CQ'&&!ordinary.includes(fields[2]))return;
   if(prefix==='$CR'&&!['CAPS','ATIS','RN','RV'].includes(fields[2]))return;
   if(prefix==='#TM')return;
  }
  if(prefix==='$CQ'&&fields[2]==='FP'&&this.plans.has(fields[3])){this.write(c,this.plans.get(fields[3]));return;}
  this.forward(c,line);
 }
 async start(port=6809){if(this.server)throw Error('Native relay already started.');this.port=port;const server=net.createServer(socket=>{if(!/^127\./.test(socket.remoteAddress||'')||this.clients.size>=128){socket.destroy();return;}const c={socket,callsign:'',buffer:''};this.clients.add(c);socket.setNoDelay(true);socket.on('error',()=>{});socket.on('close',()=>{const wasHost=this.role(c)==='host';this.clients.delete(c);this.roles.delete(socket.remotePort);if(c.callsign)this.controllers.delete(c.callsign);if(wasHost&&![...this.clients].some(p=>p.callsign&&this.role(p)==='host')){for(const a of this.positions.values())this.forward(c,'#DP'+a.callsign+':0');this.positions.clear();this.plans.clear();this.lastEvent='Native host disconnected; aircraft removed. Reconnect the server-PC EuroScope.';}});socket.on('data',bytes=>{c.buffer+=bytes.toString();if(c.buffer.length>65536){socket.destroy();return;}let n;while((n=c.buffer.indexOf('\n'))>=0){const line=c.buffer.slice(0,n).replace(/\r$/,'');c.buffer=c.buffer.slice(n+1);this.receive(c,line);}});});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,this.host,resolve);});this.server=server;this.port=server.address().port;return this.status();}
 stop(){for(const c of this.clients)c.socket.destroy();this.clients.clear();this.roles.clear();this.server?.close();this.server=null;this.positions.clear();this.plans.clear();this.controllers.clear();return this.status();}
 command(){throw Error('Native mode: use EuroScope simulation ownership and ribbon/tag controls. ZYZTools does not drive these aircraft.');}
 amend(){throw Error('Native mode: edit the flight plan in EuroScope.');}
 run(){throw Error('Native mode: use Run in the SERVER-PC EuroScope.');}
 pause(){throw Error('Native mode: use Pause in the SERVER-PC EuroScope.');}
 reset(){throw Error('Native mode: reload the scenario in the SERVER-PC EuroScope.');}
}
module.exports={NativeEuroScopeRelay};
