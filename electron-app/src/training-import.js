const fs=require('node:fs'),path=require('node:path');
async function readScenario(file,catalogue,review){
 if(fs.statSync(file).size>3*1024*1024)throw Error('Scenario exceeds 3 MB.');const bytes=fs.readFileSync(file),text=require('./training-sweatbox').decode(bytes);
 if(/^\s*\{/.test(text)){let raw;try{raw=JSON.parse(text);}catch{throw Error('Scenario JSON is invalid.');}return require('./local-training').normalize(require('./training-sector').resolveScenario(raw,catalogue));}
 const result=require('./training-sweatbox').parse(text,catalogue,path.basename(file,path.extname(file)));
 const r=result.report;if(!await review(r))return null;return result.scenario;
}
module.exports={readScenario};
