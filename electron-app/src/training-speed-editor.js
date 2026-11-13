// Shared app editor; changes are explicit and scoped to the selected scenario.
(()=>{const defaults=[{ceiling:1999,ias:136},{ceiling:2999,ias:160},{ceiling:3999,ias:200},{ceiling:8100,ias:210},{ceiling:11099,ias:230},{ceiling:15000,ias:250},{ceiling:60000,ias:270}];
window.ZYZSpeedProfileEditor=class{
 constructor(id,apply,defaultRows=defaults){this.root=document.getElementById(id);this.dirty=false;this.scope='';this.body=document.createElement('tbody');const table=document.createElement('table'),head=document.createElement('thead');head.innerHTML='<tr><th>Up to altitude (feet)</th><th>Knots IAS</th><th></th></tr>';table.append(head,this.body);this.root.append(table);const buttons=document.createElement('div');buttons.className='buttons';for(const [label,fn]of [['Add band',()=>{const rows=this.read(),last=rows.pop();rows.push({ceiling:Math.min(59999,(rows.at(-1)?.ceiling||0)+1000),ias:last.ias},last);this.render(rows);this.dirty=true;}],['Restore defaults',()=>{this.render(defaultRows);this.dirty=true;}],['Apply speed profile',async()=>{try{await apply(this.read());this.dirty=false;this.note.textContent='Applied. Manual aircraft speed assignments remain unchanged.';}catch(e){this.note.textContent=e.message;}}]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;buttons.append(b);}this.note=document.createElement('p');this.note.className='subtle';this.root.append(buttons,this.note);this.render(defaultRows);}
 render(profile){this.body.replaceChildren();for(const r of profile){const row=document.createElement('tr');for(const key of ['ceiling','ias']){const c=document.createElement('td'),input=document.createElement('input');input.type='number';input.min=key==='ias'?'50':'0';input.max=key==='ias'?'400':'60000';input.value=r[key];input.dataset.field=key;input.oninput=()=>this.dirty=true;c.append(input);row.append(c);}const c=document.createElement('td'),remove=document.createElement('button');remove.textContent='Remove';remove.type='button';remove.disabled=r.ceiling===60000;remove.onclick=()=>{row.remove();this.dirty=true;};c.append(remove);row.append(c);this.body.append(row);}}
 read(){return [...this.body.rows].map(r=>Object.fromEntries([...r.querySelectorAll('input')].map(i=>[i.dataset.field,i.value===''?'':Number(i.value)])));}
 set(profile,key){const signature=JSON.stringify(profile||defaults);if(this.scope===key&&(this.dirty||this.loaded===signature))return;this.scope=key;this.loaded=signature;this.dirty=false;this.render(profile||defaults);}
};
window.ZYZAircraftSpeedProfiles=class{
 constructor(id,apply){
  const root=document.getElementById(id);this.editors={};
  const groups={jet:'Jet',light:'Light',medium:'Medium',heavy:'Heavy / Super',prop:'Prop',highProp:'High-performance prop'};
  for(const [key,label] of Object.entries(groups)){
   const panel=document.createElement('details'),summary=document.createElement('summary'),container=document.createElement('div'),state=document.createElement('p');
   summary.textContent=label;container.id=id+'-'+key;panel.append(summary,state,container);root.append(panel);
   const editor=new window.ZYZSpeedProfileEditor(container.id,async rows=>{await apply(rows,key);state.textContent='Custom profile active';},this.suggested(key));
   const reset=document.createElement('button');reset.type='button';reset.textContent=key==='jet'?'Use built-in jet profile':'Use normal aircraft speeds';
   reset.onclick=async()=>{try{await apply(null,key);editor.dirty=false;editor.loaded=null;editor.render(this.suggested(key));state.textContent=key==='jet'?'Built-in profile':'No override';}catch(e){editor.note.textContent=e.message;}};
   panel.append(reset);this.editors[key]={editor,state};
  }
 }
 suggested(key){
  // Medium and Heavy share Jet's factory bands, not the slot's edited Jet profile.
  const values={light:[75,100,125],prop:[75,100,130],highProp:[105,165,220]}[key];
  return values?[{ceiling:3999,ias:values[0]},{ceiling:10000,ias:values[1]},{ceiling:60000,ias:values[2]}]:defaults;
 }
 set(jet,key,profiles={}){
  for(const [group,{editor,state}] of Object.entries(this.editors)){
   const profile=group==='jet'?jet:profiles[group];
   editor.set(profile||this.suggested(group),key);
   state.textContent=profile?'Profile active':group==='jet'?'Built-in profile':'No override · suggested bands below';
  }
 }
};})();
