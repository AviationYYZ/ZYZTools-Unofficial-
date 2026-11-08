const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
// EuroScope's restored-window menu order, as stored in m_ScreenPosition.
const nativePositions={full:0,left:1,right:2,top:3,bottom:4,leftThird:5,middleThird:6,rightThird:7,leftTwoThirds:8,rightTwoThirds:9};
const orientations=['unchanged','maximize',...Object.keys(nativePositions)];
const legacyVertical={topThird:'top',centerThird:'full',bottomThird:'bottom',topTwoThirds:'top',bottomTwoThirds:'bottom'};
function localFile(value,extension){
 const input=String(value||'').trim();
 if(!/^[a-z]:[\\/]/i.test(input)||/[\u0000-\u001f]/.test(input)||path.win32.extname(input).toLowerCase()!==extension)throw Error('Choose a local '+extension+' file.');
 const target=path.win32.normalize(input);
 if(extension==='.exe'&&path.win32.basename(target).toLowerCase()!=='euroscope.exe')throw Error('Choose EuroScope.exe.');
 return target;
}
function normalize(value){
 if(!value||!Array.isArray(value.presets)||value.presets.length>20)throw Error('Use up to 20 launch presets.');
 const presets=value.presets.map(p=>{
  const name=String(p.name||'').trim();
  if(!name||name.length>60||!Array.isArray(p.windows)||p.windows.length<1||p.windows.length>6)throw Error('Each preset needs a name and one to six windows.');
  return {id:/^[\w-]{8,64}$/.test(p.id||'')?p.id:crypto.randomUUID(),name,windows:p.windows.map(w=>{
   const orientation=Object.hasOwn(legacyVertical,w.orientation)?legacyVertical[w.orientation]:w.orientation;
   if(!orientations.includes(orientation))throw Error('Invalid window layout.');
   return {profile:localFile(w.profile,'.prf'),asr:w.asr?localFile(w.asr,'.asr'):'',orientation,display:/^-?\d{1,18}$/.test(String(w.display))?String(w.display):'primary'};
  })};
 });
 if(new Set(presets.map(p=>p.id)).size!==presets.length)throw Error('Duplicate preset.');
 return {exe:value.exe?localFile(value.exe,'.exe'):'',presets,selected:presets.some(p=>p.id===value.selected)?value.selected:presets[0]?.id||''};
}
function rectangle(area,orientation){
 const {x,y,width,height}=area,w=Math.floor(width/2),h=Math.floor(height/2);
 if(orientation==='left')return {x,y,width:w,height};
 if(orientation==='right')return {x:x+w,y,width:width-w,height};
 if(orientation==='top')return {x,y,width,height:h};
 if(orientation==='bottom')return {x,y:y+h,width,height:height-h};
 const horizontal={leftThird:[0,1],middleThird:[1,2],rightThird:[2,3],leftTwoThirds:[0,2],rightTwoThirds:[1,3]}[orientation];
 const vertical={topThird:[0,1],centerThird:[1,2],bottomThird:[2,3],topTwoThirds:[0,2],bottomTwoThirds:[1,3]}[orientation];
 if(horizontal){const [a,b]=horizontal.map(i=>Math.floor(width*i/3));return {x:x+a,y,width:b-a,height};}
 if(vertical){const [a,b]=vertical.map(i=>Math.floor(height*i/3));return {x,y:y+a,width,height:b-a};}
 return {x,y,width,height};
}
function withAsr(profile,asr,layout){
 const bytes=fs.readFileSync(profile);
 if(bytes.length>4*1024*1024)throw Error('EuroScope profile exceeds 4 MB.');
 const encoding=bytes[0]===255&&bytes[1]===254?'utf16le':'latin1',raw=bytes.toString(encoding);
 if(encoding==='latin1'&&/[^\u0000-\u00ff]/.test(asr))throw Error('This profile uses legacy encoding. Choose an ASR path without non-Latin characters.');
 const line='RecentFiles\tRecent1\t'+asr;
 let updated=!asr?raw:/^RecentFiles\tRecent1\t[^\r\n]*/mi.test(raw)?raw.replace(/^RecentFiles\tRecent1\t[^\r\n]*/mi,()=>line):raw.replace(/\s*$/,'')+'\r\n'+line+'\r\n';
 const target=path.join(path.dirname(profile),'.ZYZTools-'+crypto.randomUUID()+'.prf');
 const sidecar=target+'.screen.txt';
 if(layout){
  const pattern=/^Settings\tSettingsfileSCREEN\t([^\r\n]*)/mi,reference=pattern.exec(raw)?.[1]?.trim();
  let screenBytes=Buffer.alloc(0);
  if(reference){
   const source=/^[a-z]:[\\/]/i.test(reference)?reference:path.join(path.dirname(profile),reference.replace(/^[\\/]+/,''));
   screenBytes=fs.readFileSync(source);
   if(screenBytes.length>4*1024*1024)throw Error('EuroScope screen layout exceeds 4 MB.');
  }
  const screenEncoding=screenBytes[0]===255&&screenBytes[1]===254?'utf16le':'latin1';
  let settings=screenBytes.toString(screenEncoding);
  const bom=settings.startsWith('\uFEFF')?'\uFEFF':'';if(bom)settings=settings.slice(1);
  for(const [key,value] of Object.entries({m_ScreenNumber:layout.monitor,m_ScreenPosition:layout.position,m_ScreenMaximized:layout.maximized?1:0})){
   const keyLine=new RegExp('^'+key+':[^\\r\\n]*','mi');
   settings=keyLine.test(settings)?settings.replace(keyLine,key+':'+value):settings.replace(/\s*$/,'')+(settings?'\r\n':'')+key+':'+value+'\r\n';
  }
  const row='Settings\tSettingsfileSCREEN\t\\'+path.basename(sidecar);
  updated=pattern.test(updated)?updated.replace(pattern,()=>row):updated.replace(/\s*$/,'')+'\r\n'+row+'\r\n';
  fs.writeFileSync(sidecar,Buffer.from(bom+settings,screenEncoding),{flag:'wx'});
 }
 try{fs.writeFileSync(target,Buffer.from(updated,encoding),{flag:'wx'});}catch(e){if(layout)try{fs.unlinkSync(sidecar);}catch{}throw e;}
 return target;
}
async function launch(config,id,{screen,spawn=cp.spawn,exists=fs.existsSync,prepare=withAsr}={}){
 const c=normalize(config),preset=c.presets.find(p=>p.id===id);
 if(!preset||!c.exe||!exists(c.exe))throw Error('Choose EuroScope.exe and save a launch preset first.');
 for(const w of preset.windows){if(!exists(w.profile))throw Error('A profile file no longer exists: '+path.win32.basename(w.profile));if(w.asr&&!exists(w.asr))throw Error('An ASR file no longer exists: '+path.win32.basename(w.asr));}
 const profileCounts=new Map();
 for(const w of preset.windows){const key=w.profile.toLowerCase();profileCounts.set(key,(profileCounts.get(key)||0)+1);}
 const displays=screen.getAllDisplays(),primary=screen.getPrimaryDisplay();
 for(const [index,w] of preset.windows.entries()){
  const display=displays.find(d=>String(d.id)===w.display)||primary;
  const layout=w.orientation==='unchanged'?null:{monitor:Math.max(0,displays.findIndex(d=>d.id===display.id)),position:nativePositions[w.orientation]??0,maximized:w.orientation==='maximize'};
  await new Promise((resolve,reject)=>{
   const profile=layout||w.asr||profileCounts.get(w.profile.toLowerCase())>1?prepare(w.profile,w.asr,layout):w.profile;
   const child=spawn(c.exe,[profile],{cwd:path.win32.dirname(w.profile),detached:true,stdio:'ignore'});
   const cleanup=()=>{if(profile!==w.profile)for(const file of [profile,profile+'.screen.txt'])try{fs.unlinkSync(file);}catch{}};
   if(profile!==w.profile)child.once('exit',cleanup);
   child.once('error',()=>{cleanup();reject(Error('Could not open EuroScope window '+(index+1)+'. Verify the executable and profile.'));});
   child.once('spawn',()=>{child.unref();resolve();});
  });
 }
 return {opened:preset.windows.length,warnings:[]};
}
module.exports={normalize,rectangle,launch,orientations,withAsr};
