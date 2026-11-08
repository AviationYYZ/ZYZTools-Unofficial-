const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pkg = require('./package.json');
const files = [];
function add(relative) {
  if(relative==='electron-app/src/generated-workspace-ui.js')return;
  if (/(^|\/)(?:\.env(?:\..*)?|[^/]+\.env(?:\..*)?|openai-key\.bin|chatgpt-plan\.bin(?:\..*)?|pilot-bridge\.json|training-sector\.json)$/i.test(relative)) return;
  const file = path.join(root, relative);
  if (fs.statSync(file).isDirectory()) {
    for (const name of fs.readdirSync(file)) add(`${relative}/${name}`);
  } else if (/\.(cpp|h|js|jsx|cjs|mjs|ts|html|css|json|jsonc|md|bat|ps1|patch|rc|manifest|wav|csv|ini|txt|nsh)$/.test(relative) || relative === '.gitignore') {
    const binary = relative.endsWith('.wav');
    files.push({ path: relative.replaceAll('\\', '/'), content: fs.readFileSync(file, binary ? 'base64' : 'utf8'), encoding: binary ? 'base64' : 'utf-8' });
  }
}
for (const entry of ['src', 'tools', 'docs', 'scenarios', 'assets/sounds', 'assets/conflict', 'electron-app/src', 'electron-app/package.json', 'electron-app/package-lock.json',
  'electron-app/build-test-source.cjs', 'electron-app/build-channel.cjs', 'electron-app/build-config.cjs', 'electron-app/installer-progress.nsh', 'server-app/src', 'server-app/test', 'server-app/package.json', 'server-app/build.cjs', 'README.md', '.gitignore', 'build.bat', 'PreferredCYYZPdcPlugin.json', 'installer/CHANGELOG.md']) add(entry);
for (const entry of ['src','test','wrangler.jsonc','tsconfig.json','package.json','package-lock.json','worker-configuration.d.ts','README.md']) add('cloudflare/room-directory/'+entry);
add('electron-app/test-app-policy.cjs');
add('electron-app/test-euroscope-launch.cjs');
add('electron-app/build-workspace-ui.cjs');
const config = JSON.parse(files.find(file => file.path === 'PreferredCYYZPdcPlugin.json').content);
add('electron-app/test-training-control-presets.cjs');
add('electron-app/test-training-conflict-telemetry.cjs');
add('electron-app/test-training-control-slots.cjs');
add('electron-app/test-training-go-around.cjs');
add('electron-app/test-training-downwind.cjs');
add('electron-app/test-training-weather.cjs');
for(const name of ['test-conflict-settings.cjs','test-conflict-ui.cjs','test-conflict-ui-preload.cjs','test-conflict-retirement.cjs']) add('electron-app/'+name);
for (const name of ['rework','mobile','command-bridge','native-command','connector','flight','guidance','sweatbox','speed-profiles','update-rate','tag-controls','navdata','pilot-tags','pilot-secondary','restrictions','tag-workflow','profile-ui','sfi-scenario','initial-owner','list-controls','heading-ils','speed-presets','all-aircraft-list','speed-altitude-basis','browser-pilots','pilot-invite']) add(`electron-app/test-training-${name}.cjs`);
if (files.some(file => /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}\b/.test(file.content))) throw new Error('A possible API secret was found in source; refusing to bundle it.');
if (config.hoppie_logon_code !== 'REPLACE_WITH_YOUR_HOPPIE_LOGON_CODE') throw new Error('Source snapshot must contain only the default placeholder Hoppie configuration.');
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build/TestSourceSnapshot.json'), JSON.stringify({ version: pkg.version, repository: 'AviationYYZ/ZYZTools-Unofficial-', files }));
console.log(`Prepared ${files.length} source files for local test build ${pkg.version}; nothing published.`);
