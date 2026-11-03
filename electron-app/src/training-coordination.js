// Classic-FSD coordination for synthetic private sessions only. Never log login
// packets or infer pilot instructions from controller ownership/annotations.
function coordinate(sim,c,line){
 let sender,recipient,kind,cs,value;
 if(line.startsWith('$HO')||line.startsWith('$HA')){[sender,recipient,cs]=line.slice(3).split(':');kind=line.startsWith('$HO')?'HT':'ACCEPT';value=recipient;}
 else if(line.startsWith('$CQ')||line.startsWith('$CR')||line.startsWith('#PC')){const p=line.slice(3).split(':'),o=line.startsWith('#PC')?3:2;if(o===3&&p[2]!=='CCP')return false;[sender,recipient]=p;kind=p[o];cs=p[o+1];value=p[o+2];}
 else return false;
 if(!['IT','IH','WH','IC','DR','HT','HC','ACCEPT'].includes(kind))return false;
 if(sender!==c.callsign)return true;
 const a=sim.aircraft.find(a=>a.callsign===cs&&a.active);if(!a)return true;
 const present=cs=>[...sim.clients].some(p=>p.callsign===cs&&!p.socket.destroyed);
 const owner=()=>sim.broadcast('$CQ'+a.trackingController+':*A:IT:'+a.callsign);
 const clear=()=>{a.handoffTarget='';a.handoffPacket='';};
 if(kind==='WH'){if(a.trackingController)sim.write(c,'$CQ'+a.trackingController+':'+c.callsign+':IH:'+a.callsign);return true;}
 if(kind==='IH'){if(a.trackingController===c.callsign)for(const peer of sim.clients)if(peer!==c&&peer.callsign)sim.write(peer,'$CQ'+c.callsign+':'+peer.callsign+':IH:'+a.callsign);return true;}
 if(kind==='IT'||kind==='ACCEPT'){
  if(kind==='ACCEPT'&&(a.handoffTarget!==c.callsign||recipient!==a.trackingController))throw Error('No handoff to accept from that controller.');
  if(a.trackingController&&a.trackingController!==c.callsign&&a.handoffTarget!==c.callsign)throw Error('Accept the handoff before taking this aircraft.');
  if(a.handoffTarget&&a.handoffTarget!==c.callsign&&a.trackingController!==c.callsign)throw Error('That aircraft is offered to another controller.');
  const previous=a.trackingController;a.trackingController=c.callsign;clear();if(previous&&previous!==c.callsign)sim.broadcast('$HA'+c.callsign+':'+previous+':'+a.callsign);owner();return true;
 }
 if(kind==='HT'){
  const target=value||recipient;if(target===c.callsign||!present(target))throw Error('Choose a different connected private controller for the handoff.');
  if(a.trackingController&&a.trackingController!==c.callsign)throw Error('Only the tracking controller can offer this handoff.');
  if(a.handoffTarget===target&&a.trackingController===c.callsign)return true;
  if(!a.trackingController){a.trackingController=c.callsign;owner();}
  a.handoffTarget=target;a.handoffPacket='$HO'+c.callsign+':'+target+':'+a.callsign;
  sim.broadcast('$CQ'+c.callsign+':*A:HT:'+a.callsign+':'+target);sim.broadcast(a.handoffPacket);return true;
 }
 if(kind==='HC'){
  if(a.trackingController!==c.callsign&&a.handoffTarget!==c.callsign)throw Error('Only the owner or offered controller can cancel/refuse a handoff.');
  const previous=a.trackingController;clear();sim.broadcast('$CQ'+previous+':*A:HC:'+a.callsign);return true;
 }
 if(kind==='DR'||kind==='IC'){if(a.trackingController!==c.callsign)return true;clear();a.trackingController='';sim.broadcast('$CQ'+c.callsign+':*A:DR:'+a.callsign);return true;}
 return true;
}
module.exports={coordinate};
