'use strict';
const {wind,atis,quality}=require('./aeroview-observation.cjs');
const url='https://spaces.navcanada.ca/workspace/aeroview/CYYZ';
// Read the same rendered widgets a person sees, using the page's ordinary tabs.
// No requests to internal endpoints, cookies, login tokens or page state.
async function readField(name){
 const wanted=name.toUpperCase()+' FIELD';
 const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const tabs=()=>[...document.querySelectorAll('[role=tab]')];
 const match=x=>new RegExp('(?:^|\\s)'+wanted+'(?:$|\\s)').test(x.innerText.toUpperCase());
 const deadline=Date.now()+15_000;
 let field=tabs().find(match);
 while(!field&&Date.now()<deadline){await delay(350);field=tabs().find(match);}
 if(!field)return null;
 if(field.getAttribute('aria-selected')!=='true'){
  field.click();
  await delay(1200);
 }
 const widget=(pattern)=>{
  let shortest='';
  for(const x of document.querySelectorAll('div,span,p')){
   if(!x.getClientRects().length)continue;
   const text=(x.innerText||'').replace(/\s+/g,' ').trim();
   if(text.length<2400&&(!shortest||text.length<shortest.length)&&pattern.test(text))shortest=text;
  }
  return shortest;
 };
 const dataDeadline=Date.now()+8000;
 let result=null;
 do{
  if(tabs().find(match)?.getAttribute('aria-selected')==='true'){
   result={
    wind:widget(/^(?:\d{1,3}|VRB)\s*°?\s*\d{1,3}\s*(?:G\s*\d{1,3}\s*)?kts?\b.*Wind Data Last Updated at\s+\d{4}-\d\d-\d\d/i),
    atis:widget(/^ATIS Message\s+Last Updated\s+\d{4}-\d\d-\d\d.+CYYZ\s+(?:(?:ARR|DEP)\s+)?ATIS\b/i)
   };
   if(result.wind&&result.atis)return result;
  }
  await delay(500);
 }while(Date.now()<dataDeadline);
 return tabs().find(match)?.getAttribute('aria-selected')==='true'?result:null;
}
class AeroViewReader{
 constructor(BrowserWindow){this.BrowserWindow=BrowserWindow;this.timer=null;this.busy=false;this.current=null;this.status='Off';}
 start(){
  if(this.window&&!this.window.isDestroyed()){this.window.show();return;}
  const window=this.window=new this.BrowserWindow({width:1050,height:800,title:'NAV CANADA AeroView – CYYZ',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false,partition:'aeroview-observer'}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  window.webContents.on('will-navigate',(e,destination)=>{if(destination!==url)e.preventDefault();});
  window.webContents.on('will-redirect',(e,destination)=>{if(destination!==url)e.preventDefault();});
  window.on('closed',()=>{clearInterval(this.timer);this.window=null;this.current=null;this.status='Off';});
  this.status='Opening AeroView…';
  window.loadURL(url).then(()=>this.poll()).catch(()=>{if(this.window===window)this.status='AeroView did not load.';});
  this.timer=setInterval(()=>this.poll(),60_000);
 }
 stop(){if(this.window&&!this.window.isDestroyed())this.window.destroy();}
 async poll(){
  const window=this.window;
  if(this.busy||!window||window.isDestroyed()||window.webContents.getURL()!==url)return;
  this.busy=true;
  try{
   const samples={wind:{},atis:{},receivedAt:0};
   let fieldsFound=0;
   for(const name of ['south','north']){
    const row=await window.webContents.executeJavaScript('('+readField.toString()+')('+JSON.stringify(name)+')');
    if(this.window!==window)return;
    if(row)fieldsFound++;
    const now=Date.now();
    samples.wind[name]=wind(name,row?.wind||'',now);
    const report=atis(row?.atis||'',now);
    if(report&&(!samples.atis[report.kind]||report.updatedAt>=samples.atis[report.kind].updatedAt))samples.atis[report.kind]=report;
   }
   if(this.window!==window)return;
   samples.receivedAt=Date.now();this.current=samples;
   this.status=fieldsFound===0?'AeroView field tabs not found. Check the opened page.':['south','north'].map(name=>name+' '+samples.wind[name].status).join(' · ')+(Object.keys(samples.atis).length?' · ATIS available':' · ATIS unavailable');
  }catch{if(this.window===window){this.current=null;this.status='AeroView readings unavailable.';}}
  finally{this.busy=false;}
 }
 snapshot(now=Date.now()){
  if(!this.current||now-this.current.receivedAt>120_000)return null;
  const {wind,atis}=this.current;
  const fresh=(rows,key)=>Object.fromEntries(Object.entries(rows).map(([name,row])=>[name,{...row,status:quality(row[key],now)}]));
  return {wind:fresh(wind,'observedAt'),atis:fresh(atis,'updatedAt')};
 }
}
module.exports={AeroViewReader,readField};
