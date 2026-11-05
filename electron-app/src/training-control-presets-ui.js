(()=>{
 const api=window.preferredCyyzPdc?.trainingInstructor,host=document.getElementById('instructorSpeedPresets');if(!api||!host)return;
 const root=document.createElement('details'),summary=document.createElement('summary'),help=document.createElement('p');summary.textContent='Quick control presets · all categories';help.textContent='Add up to 12 quick choices per category. Adding another keeps existing choices. Remove a choice with its × button, then Save. Several comma-separated values can be added together. Altitudes are flight levels (030, 080, 110); headings are magnetic. Choices appear first in their own EuroScope dropdown. Browser presets are separate.';root.append(summary,help);host.append(root);
 const names={ALT:'Altitude / approach',IAS:'IAS knots',MACH:'Mach',HDG:'Heading',DCT:'Direct waypoints',SQ:'Squawk',RATE:'Vertical rate',APP:'Approach',ADV:'Advanced actions'},inputs={},lists={},rows={};let ready=false,busy=false;
 const save=document.createElement('button'),reset=document.createElement('button'),note=document.createElement('p');save.type=reset.type='button';save.textContent='Save quick control presets';reset.textContent='Restore default quick presets';
 function render(key){lists[key].replaceChildren();for(const [index,value]of rows[key].entries()){
  const chip=document.createElement('span'),text=document.createElement('span'),remove=document.createElement('button');chip.style.cssText='display:inline-flex;align-items:center;gap:4px;margin:3px;padding:2px 6px;background:#333;color:#eee;border-radius:4px';text.textContent=value;remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remove '+names[key]+' preset '+value);remove.disabled=busy;remove.onclick=()=>{if(busy)return;rows[key].splice(index,1);render(key);note.textContent='Unsaved changes. Click Save quick control presets.';};chip.append(text,remove);lists[key].append(chip);
 }}
 function add(key){const values=inputs[key].value.split(',').map(v=>v.trim()).filter(Boolean),merged=[...new Set([...rows[key],...values])];if(merged.length>12)throw Error(names[key]+': use up to 12 presets. Remove an existing choice first.');rows[key]=merged;inputs[key].value='';render(key);}
 for(const [key,name]of Object.entries(names)){
  rows[key]=[];const group=document.createElement('div'),label=document.createElement('label'),input=document.createElement('input'),addButton=document.createElement('button'),list=document.createElement('div');group.dataset.presetCategory=key;label.textContent=name+' ';input.type='text';input.maxLength=600;input.setAttribute('aria-label',name+' quick presets');input.placeholder='New choice(s)';inputs[key]=input;lists[key]=list;label.append(input);addButton.type='button';addButton.textContent='Add';addButton.setAttribute('aria-label','Add '+name+' preset');addButton.onclick=()=>{if(!ready||busy)return;try{add(key);note.textContent='Unsaved changes. Click Save quick control presets.';}catch(e){note.textContent=e.message;}};input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addButton.click();}};group.append(label,addButton,list);root.append(group);
 }
 root.append(save,reset,note);
 function lock(value){busy=value;for(const element of root.querySelectorAll('input,button'))element.disabled=value||!ready;}
 function fill(fields){for(const key of Object.keys(names)){rows[key]=[...(fields[key]||[])];inputs[key].value='';render(key);}}
 async function store(resetDefaults=false){if(!ready||busy)return;try{
  if(!resetDefaults)for(const key of Object.keys(names))add(key);
  lock(true);fill((await api('controlPresets',{fields:resetDefaults?{}:structuredClone(rows)})).fields);note.textContent='Saved. Close and reopen the EuroScope dropdown to use all your presets.';
 }catch(e){note.textContent=e.message;}finally{lock(false);}}
 save.onclick=()=>store();reset.onclick=()=>store(true);lock(true);
 api('controlPresets').then(v=>{fill(v.fields);ready=true;lock(false);}).catch(e=>{note.textContent='Could not load saved presets: '+e.message;lock(false);});
})();
