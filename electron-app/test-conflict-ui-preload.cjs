const {contextBridge}=require('electron');
let config={enabled:true,situAdapter:true,muted:false,arrivalAirports:'CYYZ'};
const snapshot={status:'Synthetic playback fixture — no live aircraft',aircraft:[{callsign:'SOUTH',owned:true,altitude:7000,speed:240},{callsign:'EAST',owned:true,altitude:7000,speed:240}],alerts:[{callsign:'SOUTH',other:'EAST',stage:1,seconds:140,reason:'IFR'}],recommendationStatus:'Synthetic southern-before-eastern scenario',recommendations:[{text:'TEST FIXTURE: Consider SOUTH direct MERGE; SOUTH before EAST. Advisory only.'}]};
contextBridge.exposeInMainWorld('preferredCyyzPdc',{
 initialState:async()=>{throw Error('Isolated UI test: native actions disabled.');},
 loadConflict:async()=>({config,snapshot}),
 saveConflict:async(_folder,next)=>{config=next;return {config,snapshot};}
});
