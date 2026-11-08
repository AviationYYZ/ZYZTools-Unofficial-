(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZYZCalculators=api;})(globalThis,()=>{
 const rad=Math.PI/180;
 const data=[
  ['Descent planning',['Current altitude ft','Target altitude ft','Distance NM','Groundspeed kt'],[11000,4000,25,230],([a,b,d,s])=>{if(a<b||!d||!s)throw Error('Enter a lower target altitude and positive distance and speed.');const t=d/s*60;return `${Math.round((a-b)/t)} ft/min · ${t.toFixed(1)} min · ${((a-b)/d).toFixed(0)} ft/NM`; }],
  ['Distance for descent',['Altitude to lose ft','Descent rate ft/min','Groundspeed kt'],[7000,1800,230],([a,r,s])=>{if(!r||!s)throw Error('Enter a positive rate and groundspeed.');return `${(a/r*s/60).toFixed(1)} NM · ${(a/r).toFixed(1)} min`; }],
  ['Spacing at current speed',['Distance in trail NM','Groundspeed kt'],[10,210],([d,s])=>{if(!s)throw Error('Groundspeed must be positive.');return `${(d/s*60).toFixed(2)} min · ${Math.round(d/s*3600)} seconds`; }],
  ['Distance in a time window',['Minutes','Groundspeed kt'],[3,210],([m,s])=>`${(m*s/60).toFixed(1)} NM`],
  ['Wind components',['Runway course °','Wind from °','Wind speed kt'],[237,270,25],([c,w,s])=>{if(c>360||w>360)throw Error('Directions must be between 0 and 360.');const h=s*Math.cos((w-c)*rad),x=s*Math.sin((w-c)*rad);return `${Math.abs(h).toFixed(1)} kt ${h>=0?'headwind':'tailwind'} · ${Math.abs(x).toFixed(1)} kt crosswind from ${x>=0?'right':'left'}`; }],
  ['Rate to spacing',['Aircraft per hour','Groundspeed kt'],[40,180],([r,s])=>{if(!r||!s)throw Error('Enter a positive rate and groundspeed.');return `${(s/r).toFixed(1)} NM · ${(3600/r).toFixed(0)} sec between aircraft`; }],
  ['Speed for spacing',['Distance NM','Target time minutes'],[8,2.5],([d,m])=>{if(!m)throw Error('Enter a positive target time.');return `${(d/m*60).toFixed(0)} kt groundspeed`; }],
  ['Vertical trend',['Current gap ft','Closing rate ft/min','Minutes'],[2000,500,2],([g,r,m])=>g<r*m?'Altitude crossing within interval':`${(g-r*m).toFixed(0)} ft remaining (constant rates)`]
 ];
 function calculate(id,values){const item=data[id];if(!item||values.length!==item[1].length||values.some(v=>v===''||!Number.isFinite(Number(v))||Number(v)<0||Number(v)>100000))throw Error('Enter a valid non-negative value in each field.');return item[3](values.map(Number));}
 function mount(root){
  if(!root)return;
  for(const [i,[title,fields,defaults]] of data.entries()){
   const form=document.createElement('form');form.className='calculator-card';
   const heading=document.createElement('h3');heading.textContent=title;form.append(heading);
   const inputs=fields.map((field,n)=>{const label=document.createElement('label');label.textContent=field;const input=document.createElement('input');input.type='number';input.min='0';input.max='100000';input.step='any';input.inputMode='decimal';input.value=defaults[n];label.append(input);form.append(label);return input;});
   const out=document.createElement('output');out.setAttribute('aria-live','polite');form.append(out);
   const update=()=>{try{out.textContent=calculate(i,inputs.map(x=>x.value));}catch(e){out.textContent=e.message;}};
   form.oninput=update;form.onsubmit=e=>e.preventDefault();update();root.append(form);
  }
 }
 return {calculate,mount};
});
