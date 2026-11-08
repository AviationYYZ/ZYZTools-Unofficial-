import { DurableObject } from 'cloudflare:workers';
import { ApiError, body, digest, json } from './core';
import catalog from '../../../electron-app/src/policy-catalog.json';

type Feature = keyof typeof catalog;
type Mode = 'open'|'disabled'|'code';
type Code = { id:string; hash:string; label:string; features:Feature[]; expires:number; uses:number };
type Policy = { revision:number; announcement:null|{message:string;until:number}; maintenance:boolean; rules:Partial<Record<Feature,Mode>> };
type Administrator = {id:string;label:string;hash:string;created:number};
type Data = Policy & {codes:Code[];audit:{at:number;action:string}[];admins?:Administrator[]};
const blank = ():Data => ({revision:0,announcement:null,maintenance:false,rules:{},codes:[],audit:[],admins:[]});
const isFeature = (x:unknown):x is Feature => typeof x==='string'&&Object.hasOwn(catalog,x);
const bytes = (v:string) => new TextEncoder().encode(v);
const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();

export class AppPolicy extends DurableObject<Env> {
  private load(){return this.ctx.storage.get<Data>('policy').then(x=>x??blank());}
  private state(d:Data):Policy {
    return {revision:d.revision,announcement:d.announcement&&d.announcement.until>Date.now()?d.announcement:null,maintenance:d.maintenance,rules:d.rules};
  }
  private adminState(d:Data,owner:boolean){
    return {...this.state(d),owner,supportedFeatures:Object.keys(catalog),codes:d.codes.map(({hash,...rest})=>rest),audit:d.audit.slice(0,30),
      admins:owner?(d.admins||[]).map(({hash,...entry})=>entry):[]};
  }
  private async commit(d:Data,action:string){
    d.audit=[{at:Date.now(),action},...d.audit].slice(0,100);
    await this.ctx.storage.put('policy',d);
  }
  private push(d:Data){
    const message=JSON.stringify(this.state(d));
    for(const ws of this.ctx.getWebSockets())try{ws.send(message);}catch{try{ws.close(1011,'Reconnect');}catch{}}
  }
  private locked(fn:()=>Promise<Response>){
    return this.ctx.blockConcurrencyWhile(async()=>{
      try{return await fn();}
      catch(error){
        if(error instanceof ApiError)return json({error:error.message},error.status);
        return json({error:'Policy service temporarily unavailable.'},503);
      }
    });
  }
  async fetch(request:Request):Promise<Response>{
    const route=new URL(request.url).pathname;
    try{
      if(request.method==='GET'&&route==='/v2/policy')return json(this.state(await this.load()));
      if(request.method==='GET'&&route==='/v2/events'){
        if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')throw new ApiError(426,'WebSocket required.');
        if(this.ctx.getWebSockets().length>=3000)throw new ApiError(503,'Use HTTPS policy refresh.');
        const d=await this.load(),pair=new WebSocketPair();
        this.ctx.acceptWebSocket(pair[1]);pair[1].send(JSON.stringify(this.state(d)));
        return new Response(null,{status:101,webSocket:pair[0]});
      }
      if(request.method!=='POST')throw new ApiError(405,'Method not allowed.');
      if(route==='/v2/redeem'){
        const v=await body(request) as Record<string,unknown>;
        if(typeof v?.code!=='string'||!/^[A-F0-9]{24}$/i.test(v.code))throw new ApiError(400,'Invalid feature access code.');
        const hashed=await digest(v.code.toUpperCase());
        return this.locked(async()=>{
          const d=await this.load(),c=d.codes.find(x=>x.expires>Date.now()&&crypto.subtle.timingSafeEqual(bytes(x.hash),bytes(hashed)));
          if(!c)throw new ApiError(403,'Invalid or expired feature access code.');
          c.uses++;await this.commit(d,'Access code redeemed: '+c.label);
          return json({revision:d.revision,features:c.features,expires:Math.min(c.expires,Date.now()+8*3600000)});
        });
      }
      if(route!=='/v2/admin')throw new ApiError(404,'Not found.');
      const expected=(this.env as Env & {ZYZTOOLS_ADMIN_KEY?:string}).ZYZTOOLS_ADMIN_KEY,supplied=request.headers.get('Authorization')||'';
      if(!/^Bearer [a-f0-9]{64}$/i.test(supplied))throw new ApiError(403,'Admin authorization required.');
      const candidate=await digest(supplied.slice(7));
      const owner=!!expected&&expected.length>=32&&crypto.subtle.timingSafeEqual(bytes(candidate),bytes(await digest(expected)));
      const v=await body(request) as Record<string,unknown>;
      const issued=v?.action==='create'?randomCode():undefined,hashed=issued?await digest(issued):'';
      const adminCredential=owner&&v?.action==='createAdmin'?Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join(''):undefined;
      const adminHash=adminCredential?await digest(adminCredential):'';
      return this.locked(async()=>{
        const d=await this.load(),action=v?.action;
        const delegate=(d.admins||[]).find(a=>crypto.subtle.timingSafeEqual(bytes(a.hash),bytes(candidate)));
        if(!owner&&!delegate)throw new ApiError(403,'Admin authorization required.');
        if(action==='status')return json(this.adminState(d,owner));
        if(action==='createAdmin'||action==='revokeAdmin'){
          if(!owner)throw new ApiError(403,'Only the owner can manage administrators.');
          d.admins??=[];
          if(action==='createAdmin'){
            const label=typeof v.label==='string'?v.label.trim():'';
            if(!label||label.length>60||d.admins.length>=20)throw new ApiError(400,'Enter an administrator label; up to 20 administrators are allowed.');
            d.admins.push({id:crypto.randomUUID(),label,hash:adminHash,created:Date.now()});
          }else{
            if(!d.admins.some(a=>a.id===v.id))throw new ApiError(404,'Administrator not found.');
            d.admins=d.admins.filter(a=>a.id!==v.id);
          }
        }else if(action==='announcement'){
          const message=typeof v.message==='string'?v.message.trim():'',hours=Number(v.hours);
          if(message.length>500||message&&(!Number.isInteger(hours)||hours<1||hours>168))throw new ApiError(400,'Use at most 500 characters and an expiry of 1–168 hours.');
          d.announcement=message?{message,until:Date.now()+hours*3600000}:null;
        }else if(action==='maintenance'){
          if(typeof v.enabled!=='boolean')throw new ApiError(400,'Invalid maintenance value.');
          d.maintenance=v.enabled;
        }else if(action==='policy'){
          if(!isFeature(v.feature)||(v.mode!=='open'&&v.mode!=='disabled'&&v.mode!=='code'))throw new ApiError(400,'Invalid feature policy.');
          d.rules[v.feature]=v.mode;
        }else if(action==='create'||action==='edit'||action==='delete'){
          const existing=d.codes.find(c=>c.id===v.id);
          if(action!=='create'&&!existing)throw new ApiError(404,'Access code not found.');
          if(action==='delete')d.codes=d.codes.filter(c=>c!==existing);
          else{
            const label=typeof v.label==='string'?v.label.trim():'',hours=Number(v.hours),scopes=v.features;
            if(!label||label.length>60||!Number.isInteger(hours)||hours<1||hours>720||!Array.isArray(scopes)||!scopes.length||scopes.some(x=>!isFeature(x)))throw new ApiError(400,'Enter a label, an expiry of 1–720 hours, and at least one feature.');
            const fields={label,expires:Date.now()+hours*3600000,features:[...new Set(scopes as Feature[])]};
            if(existing)Object.assign(existing,fields);
            else{
              if(d.codes.length>=100)throw new ApiError(400,'Delete a code before adding another.');
              d.codes.push({...fields,id:crypto.randomUUID(),hash:hashed,uses:0});
            }
          }
          if(action!=='create')d.revision++;
        }else throw new ApiError(400,'Invalid admin action.');
        await this.commit(d,action+(delegate?' by '+delegate.label:''));this.push(d);return json({...this.adminState(d,owner),issued,adminCredential});
      });
    }catch(error){
      if(error instanceof ApiError)return json({error:error.message},error.status);
      return json({error:'Policy service temporarily unavailable.'},503);
    }
  }
  webSocketMessage(ws:WebSocket){ws.close(1008,'Read-only channel');}
}
