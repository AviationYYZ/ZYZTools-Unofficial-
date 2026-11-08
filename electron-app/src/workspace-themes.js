(function(root){
  const rows = [
    ['spaces','NAV CANADA SPACES','portal','Segoe UI', '#f2f5f9','#183651','#223e58','#ffffff','#eaf0f7','#c9d4e1','#1b2c3c','#496276','#005cb2','#d8e7f5'],
    ['flightdesk','Flight Desk','sidebar','Segoe UI', '#edf1f5','#142638','#e2e9f0','#ffffff','#f2f5f8','#c3cfda','#172b3d','#4e6275','#195a82','#dfebf4'],
    ['dispatch','Dispatch','rail','Bahnschrift', '#151b20','#202931','#1a2128','#222b33','#2b3640','#455563','#eef4f8','#b2c0cc','#3778a6','#34434e'],
    ['paper','Paper Briefing','document','Georgia', '#f7f4ed','#eee8dc','#f1ebdf','#fffdfa','#f7f1e6','#d2c6b2','#2f2a25','#665e51','#774826','#efe1cf'],
    ['atlas','Atlas','portal','Trebuchet MS', '#ecf3f3','#153f48','#204c55','#ffffff','#e6f0ef','#b9cecb','#1c3435','#456463','#12695d','#d7ebe6'],
    ['signal','Signal','rail','Consolas', '#13171e','#1f2834','#191f29','#202834','#2a3443','#485568','#f0f3f9','#b7c2d4','#4766ad','#343f5c'],
    ['nightshift','Night Shift','sidebar','Segoe UI', '#101417','#171e23','#141a1e','#1c2429','#253239','#3b4d53','#e9f2f1','#a8bdbc','#217568','#2e4643'],
    ['terminal','Terminal Ops','rail','Cascadia Mono', '#191916','#25231c','#211f19','#29271e','#343025','#575041','#f4efe2','#cac0aa','#896227','#453a28'],
    ['cirrus','Cirrus','portal','Segoe UI', '#f6f6fa','#332c56','#413961','#ffffff','#f1eff9','#d3cee4','#29233d','#585170','#635394','#e9e4f3'],
    ['runway','Runway','document','Arial', '#efefef','#1f2428','#e1e3e5','#ffffff','#f2f2f2','#bfc5ca','#20252a','#4d565e','#3e515f','#e4e9ed']
  ];
  const themes = Object.fromEntries(rows.map(([id,label,layout,font,bg,header,nav,panel,alt,line,text,muted,accent,button]) =>
    [id,{label,layout,dark:['dispatch','signal','nightshift','terminal'].includes(id),variables:{
      '--bg':bg,'--header':header,'--nav':nav,'--panel':panel,'--panel-alt':alt,'--line':line,
      '--text':text,'--muted':muted,'--accent':accent,'--accent-2':accent,'--button':button,'--button-hover':alt,
      '--input':panel,'--input-line':line,'--focus':accent,'--font':`"${font}", "Segoe UI", sans-serif`
    }}]));
  if(typeof module!=='undefined')module.exports=themes;else root.ZYZWorkspaceThemes=themes;
})(globalThis);
