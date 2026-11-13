const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const DEFAULT_REPOSITORY = 'AviationYYZ/ZYZTools-Unofficial-';
function repository(value) {
  const match = String(value || '').trim().match(/^(?:https:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+)\/?$/);
  if (!match) throw new Error('Enter a GitHub repository URL, such as https://github.com/owner/project.');
  return `${match[1]}/${match[2].replace(/\.git$/, '')}`;
}
function version(value) {
  const match = String(value).match(/^v?(\d+)\.(\d+)\.(\d+)(?:-beta(?:\.\d+)?)?$/);
  if (!match) throw new Error('Release tags must use a stable version such as v1.2.0.');
  return match.slice(1).map(Number);
}
function newer(tag, installed) {
  const a = version(tag), b = version(installed);
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return false;
}
function readPreferences(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {stream: data.stream === 'beta' ? 'beta' : 'stable', paused: data.paused === true};
  } catch { return {stream:'stable', paused:false}; }
}
function savePreferences(file, changes) {
  const next = {...readPreferences(file), ...changes};
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, JSON.stringify(next));
  return next;
}
async function check(repo, installed, request = fetch, kind = 'production', {essentialOnly=false, preferEssential=false}={}) {
  repo = repository(repo);
  const beta = kind === 'test' || kind === 'beta';
  const result = await request(`https://api.github.com/repos/${repo}/releases?per_page=100`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ZYZTools' }, signal: AbortSignal.timeout(10000)
  });
  if (!result.ok) throw new Error(result.status === 404 ? 'No published release found for this repository.' : `GitHub release check failed (${result.status}).`);
  const data = await result.json();
  const essential = release => String(release.body || '').includes('<!-- zyztools-update:essential -->');
  const releases = (Array.isArray(data) ? data : [data]).filter(release => !release.draft && !!release.prerelease === beta && /^v?\d+\.\d+\.\d+(?:-beta(?:\.\d+)?)?$/.test(release.tag_name) && (!essentialOnly||essential(release)));
  if (!releases.length) return { repo, available: false, currentVersionPublished: false, message: `No ${beta ? 'beta' : 'stable'} releases have been published yet.` };
  releases.sort((a, b) => newer(a.tag_name, b.tag_name) ? -1 : newer(b.tag_name, a.tag_name) ? 1 : 0);
  const installerFor = r => kind === 'test'
    ? (r.assets || []).find(a => /^ZYZTools-Test-Setup(?:[-.][\w.-]+)?\.exe$/i.test(a.name))
    : (r.assets || []).find(a => /^ZYZTools-Setup(?:[-.][\w.-]+)?\.exe$/i.test(a.name))
      || (r.assets || []).find(a => /^PreferredCYYZPdcPlugin-Setup(?:[-.][\w.-]+)?\.exe$/i.test(a.name));
  const release = ((preferEssential || essentialOnly) && releases.find(r => essential(r) && newer(r.tag_name, installed) && installerFor(r))) || releases[0];
  const available = newer(release.tag_name, installed);
  const asset = installerFor(release);
  return { repo, tag: release.tag_name, available: available && !!asset, asset, essential: essential(release),
    currentVersionPublished: beta && releases.some(r => r.tag_name.replace(/^v/, '').replace(/-beta(?:\.\d+)?$/, '') === installed),
    message: available ? (asset ? `Version ${release.tag_name} is available.` : 'A newer release has no compatible setup EXE attached.') : `You are up to date (${installed}).` };
}
async function download(release, folder, request = fetch, onProgress = () => {}) {
  const asset = release.asset;
  if (!release.available || !asset) throw new Error('Check for a new release first.');
  const url = new URL(asset.browser_download_url);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || !url.pathname.startsWith(`/${release.repo}/releases/download/`)) throw new Error('Invalid GitHub release asset.');
  const target = path.join(folder, 'ZYZTools-Update.exe');
  const digest = /^sha256:([a-f0-9]{64})$/i.exec(asset.digest || '')?.[1]?.toLowerCase();
  if (digest) {
    try {
      if (fs.statSync(target).size === asset.size) {
        const bytes = fs.readFileSync(target);
        if (bytes.subarray(0, 2).toString() === 'MZ' && crypto.createHash('sha256').update(bytes).digest('hex') === digest) { onProgress(100); return target; }
      }
    } catch { /* Missing or inaccessible cache: try a fresh download. */ }
  }
  const result = await request(url, { signal: AbortSignal.timeout(120000) });
  if (!result.ok) throw new Error(`Update download failed (${result.status}).`);
  let bytes;
  onProgress(0);
  if (result.body?.getReader) {
    const reader = result.body.getReader(), chunks = [];
    let received = 0, last = 0;
    try {
      for (;;) {
        const {done,value} = await reader.read();
        if (done) break;
        received += value.length;
        if (received > asset.size) { await reader.cancel(); throw new Error('The downloaded installer exceeds the expected size.'); }
        chunks.push(Buffer.from(value));
        const percent = Math.min(99, Math.floor(100 * received / asset.size));
        if (percent > last) { last = percent; onProgress(percent); }
      }
    } finally { reader.releaseLock(); }
    bytes = Buffer.concat(chunks, received);
  } else bytes = Buffer.from(await result.arrayBuffer());
  if (bytes.length !== asset.size || bytes.subarray(0, 2).toString() !== 'MZ') throw new Error('The downloaded installer is incomplete or invalid.');
  if (asset.digest?.startsWith('sha256:') && crypto.createHash('sha256').update(bytes).digest('hex') !== asset.digest.slice(7)) throw new Error('Installer checksum does not match GitHub.');
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(target + '.tmp', bytes);
  fs.renameSync(target + '.tmp', target);
  onProgress(100);
  return target;
}
const essentialInstallerArgs = tag => newer('1.2.77', tag) ? ['/S', '--updated', '--force-run'] : ['--updated', '--force-run'];
async function releaseHistory(stream,request=fetch){
 if(!['stable','beta'].includes(stream))throw Error('Choose Stable or Beta.');
 const result=await request('https://api.github.com/repos/'+DEFAULT_REPOSITORY+'/releases?per_page=100',{
  headers:{Accept:'application/vnd.github+json','User-Agent':'ZYZTools'},signal:AbortSignal.timeout(10000)
 });
 if(!result.ok)throw Error('GitHub release history unavailable ('+result.status+').');
 const rows=await result.json();
 return (Array.isArray(rows)?rows:[]).filter(r=>!r.draft&&!!r.prerelease===(stream==='beta')&&/^v?\d+\.\d+\.\d+(?:-beta(?:\.\d+)?)?$/.test(r.tag_name))
  .filter(r=>Array.isArray(r.assets)&&r.assets.some(a=>/^(?:ZYZTools(?:-Test)?|PreferredCYYZPdcPlugin)-Setup(?:[-.][\w.-]+)?\.exe$/i.test(a.name)))
  .sort((a,b)=>newer(a.tag_name,b.tag_name)?-1:newer(b.tag_name,a.tag_name)?1:String(b.published_at).localeCompare(String(a.published_at)))
  .map(r=>({tag:r.tag_name,essential:String(r.body||'').includes('<!-- zyztools-update:essential -->')}));
}
module.exports = { DEFAULT_REPOSITORY, repository, newer, readPreferences, savePreferences, check, download, essentialInstallerArgs, releaseHistory };
