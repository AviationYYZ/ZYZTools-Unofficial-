// Starts only the packaged, checksum-pinned helper, targeting our loopback panel.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const release=require('./training-tunnel-release.json');
function probe(origin){return new Promise((resolve,reject)=>{
 const req=http.get(origin,{timeout:3000},res=>{let body='';res.on('data',b=>{body+=b;if(body.length>65536)req.destroy(Error('Unexpected local service.'));});res.on('end',()=>res.statusCode===200&&body.includes('ZYZTools shared sweatbox')?resolve():reject(Error('Shared panel did not respond correctly.')));res.on('error',reject);});req.on('timeout',()=>req.destroy(Error('Shared panel timed out.')));req.on('error',()=>reject(Error('Shared control is not reachable. Start local server and shared control first.')));
});}
class TrainingTunnel{
 constructor(folder,getOrigin,options={}){this.folder=folder;this.getOrigin=getOrigin;this.launch=options.launch||spawn;this.probe=options.probe||probe;this.verify=options.verify||(()=>{const file=path.join(this.folder,release.file);if(!fs.existsSync(file))throw Error('Bundled tunnel helper missing. Reinstall ZYZTools; no separate cloudflared installation is required.');if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==release.sha256)throw Error('Tunnel helper integrity check failed. Reinstall ZYZTools.');return file;});this.state='stopped';this.url='';this.error='';this.generation=0;}
 status(){return {state:this.state,url:this.url,error:this.error,version:release.version,running:!!this.child||this.starting===true};}
 async start(){
  if(this.child||this.starting)throw Error('Tunnel already active or stopping.');const origin=this.getOrigin();if(!origin)throw Error('Start shared control first.');const u=new URL(origin);if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!/^\d+$/.test(u.port)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Only the local shared panel can be tunneled.');
  const generation=++this.generation;this.starting=true;this.state='checking';this.error='';this.url='';
  try{
   await this.probe(origin);const file=this.verify();if(generation!==this.generation||this.getOrigin()!==origin)return this.status();
   // A private empty config prevents accidental use of a user's named tunnel,
   // ingress, credentials, proxy or unrelated origin configuration.
   const configFolder=this.configFolder||this.folder;fs.mkdirSync(configFolder,{recursive:true});const config=path.join(configFolder,'zyztools-tunnel.yml');fs.writeFileSync(config,'{}\n',{mode:0o600});
   const child=this.launch(file,['--no-autoupdate','tunnel','--config',config,'--url',origin],{windowsHide:true,stdio:['ignore','pipe','pipe'],detached:false});this.child=child;this.state='connecting';let buffer='',timer;
   const read=chunk=>{if(generation!==this.generation)return;buffer+=chunk.toString();if(buffer.length>65536){buffer=buffer.slice(-32768);}let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);const url=line.match(/https:\/\/([a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com)(?=[\s/|]|$)/i);if(url)this.url='https://'+url[1].toLowerCase();if(line.includes('Registered tunnel connection')&&this.url){this.state='ready';this.error='';clearTimeout(this.timer);}else if(/Retrying connection|Connection terminated/.test(line)&&this.state==='ready')this.state='reconnecting';if(/Unable to reach the origin service/.test(line))this.error='Tunnel cannot reach shared control. Stop tunnel and check local server/shared control.';}};
   child.stdout.on('data',read);child.stderr.on('data',read);
   child.on('error',()=>{if(generation===this.generation){this.state='error';this.error='Bundled tunnel helper could not start. Check Windows security or reinstall ZYZTools.';this.url='';}clearTimeout(timer);if(this.child===child)this.child=null;});
   child.on('close',code=>{clearTimeout(timer);if(this.child!==child)return;this.child=null;this.url='';if(generation===this.generation){this.state='error';this.error=this.error||'Tunnel ended'+(code===null?'': ' (exit '+code+')')+'. Start again to get a new address.';}else this.state='stopped';});
   this.timer=timer=setTimeout(()=>{if(generation===this.generation&&this.state!=='ready'){this.error='Tunnel did not connect within 90 seconds. Check internet/firewall, then try again.';this.state='error';this.url='';child.kill();}},90000);this.timer.unref?.();
   return this.status();
  }catch(e){if(generation===this.generation){this.state='error';this.error=e.message;this.url='';}throw e;}finally{this.starting=false;}
 }
 stop(){this.generation++;clearTimeout(this.timer);this.url='';this.error='';this.state=this.child?'stopping':'stopped';this.child?.kill();return this.status();}
}
module.exports={TrainingTunnel,probe};
