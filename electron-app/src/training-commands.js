// Shared, bounded command grammar for the local simulator and instructor bridge.
function commands(value){
 const text=String(value||'').trim().toUpperCase();
 if(!text||text.length>512)throw Error('Enter up to 8 commands, separated by commas (maximum 512 characters).');
 const parts=text.split(',');if(parts.length>8)throw Error('Maximum 8 commands per message.');
 return parts.map(part=>{
  let s=part.trim().replace(/^\./,'').replace(/\s+/g,' ');
  if(s==='DELETE')s='DELETE AIRCRAFT';if(s==='APP')s='APP CLEAR';
  if(s==='HDG PRESENT')return s;
  if(/^IAS \d{2,3} UNTIL [A-Z0-9_-]{1,16}$/.test(s)||/^CROSS [A-Z0-9_-]{1,16} AT \d{1,5}$/.test(s)||/^RESTRICTIONS (SPEED|ALT) CLEAR$/.test(s))return s;
  if(/^MACH (?:0?\.\d{1,2}|1(?:\.0{1,2})?)$/.test(s))return 'MACH '+Number(s.slice(5));
  if(s==='IDENT'||/^(ALT|RATE|SPD|IAS|HDG|LHDG|RHDG) \d+(?:\.\d+)?$/.test(s)||/^DCT [A-Z0-9_-]{1,16}$/.test(s)||/^(APP (CLEAR|CANCEL)|PAUSE (ON|OFF)|SPEED PUBLISHED|ROUTE RESUME|MODE (C|STBY)|SQ [0-7]{4}|DELETE AIRCRAFT)$/.test(s))return s;
  throw Error('Use ALT, RATE, IAS, HDG/LHDG/RHDG, DCT, SQ, IDENT, MODE, APP, PAUSE, SPEED PUBLISHED or ROUTE RESUME. Separate commands with commas.');
 });
}
module.exports={commands,normalizeCommand:value=>commands(value).join(', ')};
