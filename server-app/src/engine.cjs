const fs=require('node:fs'),path=require('node:path');
const folder=fs.existsSync(path.join(__dirname,'engine','local-training.js'))?path.join(__dirname,'engine'):path.join(__dirname,'../../electron-app/src');
module.exports=name=>require(path.join(folder,name));
