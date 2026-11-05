(()=>{
 const api=window.preferredCyyzPdc?.trainingInstructor,host=document.getElementById('instructorSpeedPresets');if(!api||!host)return;
 const root=document.createElement('details'),summary=document.createElement('summary'),help=document.createElement('p');summary.textContent='Quick control presets · all categories';help.textContent='Put your most-used choices first, separated by commas (up to 12 per category). These appear at the top of EuroScope instructor tag/list menus. All other choices remain below. Altitudes are flight levels, e.g. 030, 080, 110; headings are magnetic. Empty fields disable quick choices. Saved separately for test/production; browser menus are separate.';root.append(summary,help);host.append(root);
 const names={ALT:'Altitude / approach',IAS:'IAS knots',MACH:'Mach',HDG:'Heading',DCT:'Direct waypoints',SQ:'Squawk',RATE:'Vertical rate',APP:'Approach',ADV:'Advanced actions'},inputs={};
 for(const [key,name]of Object.entries(names)){const label=document.createElement('label'),input=document.createElement('input');label.textContent=name+' ';input.type='text';input.maxLength=600;input.setAttribute('aria-label',name+' quick presets');inputs[key]=input;label.append(input);root.append(label);}
 const save=document.createElement('button'),reset=document.createElement('button'),note=document.createElement('p');save.type=reset.type='button';save.textContent='Save quick control presets';reset.textContent='Restore default quick presets';root.append(save,reset,note);
 function fill(fields){for(const [key,input]of Object.entries(inputs))input.value=(fields[key]||[]).join(', ');}
 async function store(fields){save.disabled=reset.disabled=true;try{fill((await api('controlPresets',{fields})).fields);note.textContent='Saved. Close and reopen the EuroScope dropdown to use these presets.';}catch(e){note.textContent=e.message;}finally{save.disabled=reset.disabled=false;}}
 save.onclick=()=>store(Object.fromEntries(Object.entries(inputs).map(([key,input])=>[key,input.value.split(',').map(v=>v.trim()).filter(Boolean)])));
 reset.onclick=()=>store({});api('controlPresets').then(v=>fill(v.fields)).catch(e=>note.textContent=e.message);
})();
