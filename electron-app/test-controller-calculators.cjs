const {test}=require('node:test'),assert=require('node:assert/strict');
const {calculate}=require('./src/controller-calculators');
const {releaseHistory}=require('./src/github-updates');
test('controller estimates use the requested units and handle heading wrap',()=>{
 assert.match(calculate(0,[11000,4000,25,230]),/^1073 ft\/min/);
 assert.match(calculate(1,[6000,1500,240]),/^16.0 NM/);
 assert.equal(calculate(2,[10,240]),'2.50 min · 150 seconds');
 assert.equal(calculate(3,[2,240]),'8.0 NM');
 assert.equal(calculate(4,[330,60]),'Right 90°');
 assert.equal(calculate(4,[60,330]),'Left 90°');
 assert.match(calculate(5,[90,180,25]),/25.0 kt crosswind from right/);
 assert.match(calculate(6,[60,240]),/^4.0 NM/);
 assert.throws(()=>calculate(2,[10,0]),/positive/);
});
test('release picker lists only published installers from the selected stream',async()=>{
 const r=(tag_name,prerelease,assets=['ZYZTools-Setup.exe'],draft=false)=>({tag_name,prerelease,draft,assets:assets.map(name=>({name}))});
 const request=async()=>({ok:true,json:async()=>[r('v2.0.2',false),r('v2.0.3-beta',true),r('v1.2.9',false),r('v2.0.4',false,[]),r('v9.0.0',false,undefined,true)]});
 assert.deepEqual((await releaseHistory('stable',request)).map(x=>x.tag),['v2.0.2','v1.2.9']);
 assert.deepEqual((await releaseHistory('beta',request)).map(x=>x.tag),['v2.0.3-beta']);
 await assert.rejects(releaseHistory('other',request),/Stable or Beta/);
});
