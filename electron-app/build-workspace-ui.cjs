const path=require('node:path');
require('esbuild').buildSync({
  entryPoints:[path.join(__dirname,'src/workspace-ui.jsx')],
  outfile:path.join(__dirname,'src/generated-workspace-ui.js'),
  bundle:true,platform:'browser',format:'iife',minify:true,legalComments:'eof',
  define:{'process.env.NODE_ENV':'"production"'}
});
