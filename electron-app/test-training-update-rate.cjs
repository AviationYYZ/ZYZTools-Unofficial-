const {test}=require('node:test'),assert=require('node:assert/strict');
const {LocalTraining,normalize}=require('./src/local-training');const demo=()=>structuredClone(require('./src/training-demo.json'));
test('fixed five-second position interval, legacy migration, continuous physics and no command/reset-rate bypass',()=>{
 for(const legacy of [undefined,.2,1,2,5])assert.equal(normalize({...demo(),positionUpdateHz:legacy}).positionUpdateHz,.2);
 for(const invalid of [0,3,10,-1,'5',NaN,Infinity])assert.throws(()=>normalize({...demo(),positionUpdateHz:invalid}),/update rate/);
 const sim=new LocalTraining();sim.load(demo());sim.running=true;let packets=[];sim.broadcast=line=>packets.push(line);
 for(let i=0;i<49;i++)sim.frame(.1);assert.equal(packets.length,0);assert(sim.elapsed>4.8);const a=sim.aircraft[0],before=a.altitude;sim.command(a.callsign,'ALT 3000');assert.equal(packets.length,0,'Commands do not force a position refresh');sim.updateRate(5);assert.equal(sim.scenario.positionUpdateHz,.2);sim.frame(.1);assert.equal(packets.length,2,'Same-rate attempts cannot reset the publication clock');assert(a.altitude<before);
 packets=[];for(let i=0;i<50;i++)sim.frame(.1);assert.equal(packets.length,2);assert(packets.every(p=>p.startsWith('@')));packets=[];sim.frame(30);assert.equal(packets.length,2,'No catchup bursts');sim.reset();assert.equal(sim.scenario.positionUpdateHz,.2);
});
