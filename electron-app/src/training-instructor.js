const https=require('node:https'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {resolveCode,invite}=require('./training-directory'),{parseInvite}=require('./training-invite');
class InstructorClient{
 constructor(folder,safeStorage,options={}){this.file=path.join(folder,'instructor-pairing.bin');this.storage=safeStorage;this.resolve=options.resolve||resolveCode;this.transport=options.transport||this.request.bind(this);this.pair=null;}
 request(pair,route,value){return new Promise((resolve,reject)=>{
  const body=value===undefined?null:JSON.stringify(value);if(body&&Buffer.byteLength(body)>4194304){reject(Error('Scenario exceeds 4 MB.'));return;}
  const req=https.request(pair.url+route,{method:body?'POST':'GET',timeout:25000,headers:{Authorization:'Bearer '+pair.token,...(body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}:{})}},res=>{const chunks=[];let size=0;res.on('data',b=>{size+=b.length;if(size>4194304)req.destroy(Error('Instructor response too large.'));else chunks.push(b);});res.on('error',()=>reject(Error('Instructor connection interrupted.')));res.on('end',()=>{if(res.statusCode===401){reject(Error('Instructor pairing expired or was revoked. Pair again.'));return;}if(res.statusCode!==200){let message='Cannot reach instructor server. Check it is online.';try{const r=JSON.parse(Buffer.concat(chunks));if(res.statusCode===400&&typeof r.error==='string')message=r.error;}catch{}reject(Error(message));return;}try{resolve(JSON.parse(Buffer.concat(chunks)));}catch{reject(Error('Invalid instructor response.'));}});});req.on('timeout',()=>req.destroy());req.on('error',()=>reject(Error('Cannot reach instructor server. Check it is online; pair again if the server app restarted.')));req.end(body);
 });}
 async connect(value,remember=false){const input=String(value||'').trim(),pair=invite(/^https:\/\//i.test(input)?parseInvite(input):await this.resolve(input));const state=await this.transport(pair,'/api/instructor/status');if(state.service!=='ZYZTools Instructor'||state.role!=='instructor'||state.apiVersion!==1||!Array.isArray(state.slots))throw Error('This is a student session, not an instructor pairing code.');
  if(remember){if(!this.storage?.isEncryptionAvailable())throw Error('Windows-encrypted storage is unavailable. Connect without Remember instead.');fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,this.storage.encryptString(JSON.stringify(pair)));}else if(fs.existsSync(this.file))fs.unlinkSync(this.file);
  this.pair=pair;return state;
 }
 async restore(){if(!fs.existsSync(this.file))return {connected:false,remembered:false};if(!this.storage?.isEncryptionAvailable())throw Error('Windows-encrypted storage is unavailable.');let pair;try{pair=invite(JSON.parse(this.storage.decryptString(fs.readFileSync(this.file))));}catch{throw Error('Saved pairing cannot be read. Forget it and pair again.');}const state=await this.transport(pair,'/api/instructor/status');if(state.service!=='ZYZTools Instructor'||state.role!=='instructor')throw Error('The server no longer accepts this pairing.');this.pair=pair;return {connected:true,remembered:true,state};}
 status(){return {connected:!!this.pair,remembered:fs.existsSync(this.file)};}
 async call(route,value){if(!this.pair)throw Error('Pair with your server PC first.');return this.transport(this.pair,route,value);}
 async state(){return this.call('/api/instructor/status');}
 async aircraft(slot){if(![1,2,3].includes(slot))throw Error('Choose a server.');return this.call('/api/instructor/aircraft/'+slot);}
 async action(slot,action,epoch,payload){return this.call('/api/instructor/action',{requestId:crypto.randomUUID(),slot,action,epoch,payload});}
 disconnect(forget=false){this.pair=null;if(forget&&fs.existsSync(this.file))fs.unlinkSync(this.file);return this.status();}
}
module.exports={InstructorClient};
