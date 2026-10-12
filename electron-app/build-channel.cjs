const { execFileSync } = require('node:child_process');
const path = require('node:path');
const arg = process.argv[2] || 'test';
if (!['test', 'production', 'both'].includes(arg)) throw new Error('Choose test or production.');
execFileSync(process.execPath, [path.join(__dirname, 'build-test-source.cjs')], { stdio: 'inherit' });
for (const kind of arg === 'both' ? ['test', 'production'] : [arg]) {
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, '../tools/Build-Channel.ps1'), '-Channel', kind], { stdio: 'inherit', windowsHide: true });
  execFileSync(process.execPath, [path.join(__dirname, 'node_modules/electron-builder/out/cli/cli.js'), '--config', 'build-config.cjs', '--win', 'nsis', '--ia32'],
    { cwd: __dirname, stdio: 'inherit', env: { ...process.env, ZYZTOOLS_BUILD_CHANNEL: kind } });
}
