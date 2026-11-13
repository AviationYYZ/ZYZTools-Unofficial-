const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {newestServer,ServerUpdater}=require('../src/auto-updates.cjs');
const {DEFAULT_REPOSITORY}=require('../src/engine.cjs')('github-updates');
const bytes=Buffer.from('MZ synthetic data; never executed');
function release(tag,overrides={}){
 const name='ZYZTools-Server-Setup-'+tag.slice(1)+'.exe';
 return {tag_name:tag,assets:[{name,size:bytes.length,digest:'sha256:'+crypto.createHash('sha256').update(bytes).digest('hex'),browser_download_url:'https://github.com/'+DEFAULT_REPOSITORY+'/releases/download/'+tag+'/'+name}],...overrides};
}
const json=rows=>new Response(JSON.stringify(rows),{status:200});
test('stable server updater rejects beta, drafts, desktop, older and digest-less assets',async()=>{
 const bad=release('v2.0.20');delete bad.assets[0].digest;
 const desktop=release('v2.0.18');desktop.assets[0].name='ZYZTools-Setup.exe';
 const wrong=release('v2.0.19');wrong.assets[0].browser_download_url='https://example.invalid/installer.exe';
 const request=async()=>json([release('v2.1.0',{prerelease:true}),release('v2.0.99',{draft:true}),bad,desktop,wrong,release('v2.0.14'),release('v2.0.10')]);
 assert.equal((await newestServer('2.0.13',request)).tag,'v2.0.14');
 assert.equal(await newestServer('2.0.14',request),null);
});
test('verified installer waits for idle and is never retried in the same cooldown',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zyz-updater-test-'));
 let idle=false,checks=0,downloads=0,launches=0,now=1000;
 const updater=new ServerUpdater({version:'2.0.13',folder,idle:()=>idle,now:()=>now,
  request:async url=>{if(String(url).startsWith('https://api.github.com/')){checks++;return json([release('v2.0.14')]);}
   downloads++;idle=false;return new Response(bytes,{status:200});},
  install:async file=>{assert.deepEqual(fs.readFileSync(file),bytes);launches++;}});
 try{
  await updater.tick();assert.equal(downloads,0);assert.match(updater.message,/all slots stop/);
  idle=true;await updater.tick();assert.equal(downloads,1);assert.equal(launches,0);assert.match(updater.message,/ready/);
  idle=true;await updater.tick();assert.equal(launches,1);assert.equal(downloads,1);assert.equal(checks,1);
  now+=300001;await updater.tick();assert.equal(launches,1);assert.match(updater.message,/retrying/);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
