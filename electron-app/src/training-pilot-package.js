const fs=require('node:fs'),path=require('node:path');
function exportPlugin(source,parent,runtime,test){
 const name='zyztools-local-pilots'+(test?'-test':''),root=path.join(parent,'zyztools-pilot-marketplace'+(test?'-test':'')),folder=path.join(root,'plugins',name);
 if(fs.existsSync(root))throw Error('That pilot marketplace folder already exists. Choose another parent folder; existing files were not overwritten.');
 fs.mkdirSync(root);
 // fs.cpSync uses native opendir and cannot traverse Electron ASAR directories.
 // This fixed allowlist also prevents credentials or unrelated files entering exports.
 for(const relative of ['plugin.json','mcp.json','server.cjs','launch.ps1','skills/local-pilots/SKILL.md']){const target=path.join(folder,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,fs.readFileSync(path.join(source,relative)),{flag:'wx'});}
 const manifest=JSON.parse(fs.readFileSync(path.join(folder,'plugin.json'),'utf8'));manifest.name=name;manifest.extensions['com.openai'].interface.displayName='ZYZTools Local Pilots'+(test?' test':'');fs.writeFileSync(path.join(folder,'plugin.json'),JSON.stringify(manifest,null,2));
 const config=JSON.parse(fs.readFileSync(path.join(folder,'mcp.json'),'utf8')),server=config.mcpServers['zyztools-pilots'];server.args[server.args.length-1]=test?'test':'production';fs.writeFileSync(path.join(folder,'mcp.json'),JSON.stringify(config,null,2));
 fs.writeFileSync(path.join(folder,'runtime.json'),JSON.stringify({executable:runtime}));
 const compatibility={name,version:manifest.version,description:manifest.description,author:manifest.author,requires_local_executor:true,interface:manifest.extensions['com.openai'].interface,skills:'./skills/',mcpServers:'./.mcp.json'};fs.mkdirSync(path.join(folder,'.codex-plugin'),{recursive:true});fs.writeFileSync(path.join(folder,'.codex-plugin/plugin.json'),JSON.stringify(compatibility,null,2));
 fs.writeFileSync(path.join(folder,'.mcp.json'),JSON.stringify({mcpServers:{'zyztools-pilots':{command:'powershell.exe',args:['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(folder,'launch.ps1'),test?'test':'production']}}},null,2));
 fs.mkdirSync(path.join(root,'.agents/plugins'),{recursive:true});fs.writeFileSync(path.join(root,'.agents/plugins/marketplace.json'),JSON.stringify({name:'zyztools-pilots-local'+(test?'-test':''),interface:{displayName:'ZYZTools Local Pilots'+(test?' test':'')},plugins:[{name,source:{source:'local',path:'./plugins/'+name},policy:{installation:'AVAILABLE',authentication:'ON_INSTALL'},category:'Productivity'}]},null,2));
 return {folder,marketplaceRoot:root};
}
module.exports={exportPlugin};
