// Instructor connector only. Drop private annotation PDUs BEFORE transport.
// Student connections never install this layer. SDK edits become authenticated
// instructor API commands; FSD annotation traffic itself never moves an aircraft.
function metadata(line){
 if(!line.startsWith('$CQ')&&!line.startsWith('#PC'))return null;
 const f=line.slice(3).split(':'),offset=line.startsWith('#PC')?3:2;if(offset===3&&f[2]!=='CCP')return null;
 return {sender:f[0],recipient:f[1],kind:f[offset],callsign:f[offset+1],value:f.slice(offset+2).join(':')};
}
class InstructorTagControls{
 constructor(bridge,options={}){this.bridge=bridge;this.delay=options.delay??3000;this.peers=new Set();}
 known(cs){return this.bridge.snapshot?.aircraft?.some(a=>a.callsign===cs&&a.active);}
 enabled(){return this.bridge.valid()&&this.bridge.tagControls().enabled;}
 attach(peer){if(!peer.tagState){peer.tagState=new Map();peer.tagShadows=new Set();peer.tagClaims=new Set();}this.peers.add(peer);return peer;}
 row(peer,cs){this.attach(peer);if(!peer.tagState.has(cs)){if(peer.tagState.size>=100)throw Error('Too many private tag overlays.');peer.tagState.set(cs,{values:{},wire:{},until:0,timer:null});}return peer.tagState.get(cs);}
 send(peer,lines){if(peer.socket.destroyed)return;if(peer.socket.writableLength>262144){peer.socket.destroy();return;}if(lines.length)peer.socket.write(lines.join('\r\n')+'\r\n','latin1');}
 baseline(peer,cs,type){const a=this.bridge.snapshot?.aircraft?.find(a=>a.callsign===cs&&a.active);if(!a)throw Error('Selected aircraft is no longer active.');const r=this.row(peer,cs);const defaults={1:a.assignedSquawk||a.squawk,3:a.clearedAltitude||0,9:a.assignedSpeed||0,11:a.assignedRate||0,12:a.assignedHeading||0,13:a.directTo||''};return String(r.values[type]??defaults[type]??'');}
 observe(peer,m,line){const r=this.row(peer,m.callsign);r.wire[m.kind]=line;
  if(m.kind==='TA'&&/^\d{1,5}$/.test(m.value))r.values[3]=Number(m.value);
  if(m.kind==='BC'&&/^[0-7]{4}$/.test(m.value))r.values[1]=m.value;
  if(m.kind==='SC'){
   const value=m.value.toUpperCase();let match;
   if((match=value.match(/^H(\d{1,3})$/)))r.values[12]=Number(match[1])%360;
   else if((match=value.match(/^S(\d{2,3})$/)))r.values[9]=Number(match[1]);
   else if((match=value.match(/^R(-?\d{1,4})$/)))r.values[11]=Math.abs(Number(match[1]));
   else if(this.bridge.snapshot?.fixes?.some(w=>w.name===value))r.values[13]=value;
   else if(!value)for(const type of [9,11,12,13])r.values[type]=type===13?'':0;
  }
 }
 restore(peer,cs){const r=peer.tagState?.get(cs);if(!r)return;clearTimeout(r.timer);r.timer=null;r.until=0;if(!this.known(cs))return;
  const lines=[];for(const kind of ['TA','SC','BC']){
   if(r.wire[kind])lines.push(r.wire[kind]);else{const value=kind==='TA'?this.baseline(peer,cs,3):kind==='BC'?this.baseline(peer,cs,1):'';lines.push('$CQSERVER:'+peer.controller+':'+kind+':'+cs+':'+value);}
  }if(this.enabled())lines.push(this.shadow(peer,cs));this.send(peer,lines);
 }
 overlay(peer,cs){const r=this.row(peer,cs);clearTimeout(r.timer);r.until=Date.now()+this.delay;r.timer=setTimeout(()=>this.restore(peer,cs),this.delay);r.timer.unref?.();}
 editValue(m){if(m.kind==='TA'&&/^\d{1,5}$/.test(m.value))return [3,String(Number(m.value))];if(m.kind==='BC'&&/^[0-7]{4}$/.test(m.value))return [1,m.value];if(m.kind==='SC'){const value=m.value.toUpperCase();let match;if((match=value.match(/^H(\d{1,3})$/)))return [12,String(Number(match[1]))];if((match=value.match(/^S(\d{2,3})$/)))return [9,String(Number(match[1]))];if((match=value.match(/^R(-?\d{1,4})$/)))return [11,String(Math.abs(Number(match[1])))];if(this.bridge.snapshot?.fixes?.some(w=>w.name===value))return [13,value];}return null;}
 async confirmEdit(peer,cs,type,value,created){for(let i=0;i<25;i++){const r=this.row(peer,cs),index=(r.edits||[]).findIndex(e=>e.type===type&&e.value===value&&Math.abs(e.at-created)<=1000);if(index>=0){r.edits.splice(index,1);return;}if(peer.socket.destroyed||!this.bridge.valid())throw Error('Instructor connection changed.');await new Promise(resolve=>setTimeout(resolve,20));}throw Error('No matching local tag edit was observed. Use the command panel for this field.');}
 outgoing(peer,line){this.attach(peer);const m=metadata(line);if(!m||m.sender!==peer.controller)return line;
  if(m.kind==='WH'&&this.enabled()&&this.known(m.callsign)){this.send(peer,['$CQ'+peer.controller+':'+peer.controller+':IH:'+m.callsign,this.shadow(peer,m.callsign)]);return '';}
  if(!['TA','SC','BC'].includes(m.kind))return line;
  // Ordinary notes are shared, not pilot controls. An empty SC clears the
  // public scratchpad. Typed H/S/R/fix control messages remain private.
  if(m.kind==='SC'&&!this.editValue(m)){if(this.known(m.callsign)){const r=this.row(peer,m.callsign);if(!m.value&&r.suppressUntil>Date.now())return '';this.observe(peer,m,line);}return line;}
  // Remain fail-closed if the instructor API/binding becomes unavailable.
  if(this.known(m.callsign)){const r=this.row(peer,m.callsign),edit=this.editValue(m),restoring=r.suppressUntil>Date.now()&&edit&&String(edit[1])===this.baseline(peer,m.callsign,edit[0]);if(m.kind==='BC'&&!m.value)this.send(peer,['$CQSERVER:'+peer.controller+':BC:'+m.callsign+':'+this.baseline(peer,m.callsign,1)]);else if(!restoring){if(edit){r.edits=(r.edits||[]).filter(e=>Date.now()-e.at<10000).slice(-15);r.edits.push({type:edit[0],value:edit[1],at:Date.now()});}this.overlay(peer,m.callsign);}}return '';
 }
 incoming(peer,line){this.attach(peer);const m=metadata(line);
  if(m&&this.known(m.callsign)){
   if(['TA','SC','BC'].includes(m.kind)){this.observe(peer,m,line);if(this.row(peer,m.callsign).until>Date.now())return [];if(this.enabled())return [line,this.shadow(peer,m.callsign)];}
   if(['IT','IC','DR','IH'].includes(m.kind)&&this.enabled())return [this.shadow(peer,m.callsign)];
  }
  if(line.startsWith('#DP')){const cs=line.slice(3).split(':')[0],r=peer.tagState.get(cs);if(r)clearTimeout(r.timer);peer.tagState.delete(cs);peer.tagShadows.delete(cs);peer.tagClaims.delete(cs);}
  if(line.startsWith('$FP')){const cs=line.slice(3).split(':')[0];if(this.enabled()&&this.known(cs)){peer.tagShadows.add(cs);this.claim(peer,cs);return [line,this.shadow(peer,cs)];}}
  return [line];
 }
 shadow(peer,cs){return '$CQ'+peer.controller+':'+peer.controller+':IT:'+cs;}
 claim(peer,cs){const a=this.bridge.snapshot?.aircraft?.find(a=>a.callsign===cs&&a.active);if(!this.enabled()||!peer.controller||!peer.forward||!a||a.trackingController||peer.tagClaims.has(cs))return;peer.tagClaims.add(cs);peer.forward(['$CQ'+peer.controller+':*A:IT:'+cs]).catch(()=>{});}
 sync(){for(const peer of this.peers){if(peer.socket.destroyed){this.drop(peer);continue;}for(const cs of peer.tagState.keys())if(!this.known(cs)){const r=peer.tagState.get(cs);clearTimeout(r.timer);peer.tagState.delete(cs);peer.tagShadows.delete(cs);}if(this.enabled())for(const a of this.bridge.snapshot?.aircraft||[])if(a.active&&!peer.tagShadows.has(a.callsign)){peer.tagShadows.add(a.callsign);this.claim(peer,a.callsign);this.send(peer,[this.shadow(peer,a.callsign)]);}}}
 drop(peer){for(const row of peer.tagState?.values()||[])clearTimeout(row.timer);peer.tagState?.clear();peer.tagShadows?.clear();peer.tagClaims?.clear();this.peers.delete(peer);}
 close(){for(const peer of this.peers)this.drop(peer);}
}
module.exports={InstructorTagControls,metadata};
