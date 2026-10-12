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
async function check(repo, installed, request = fetch, kind = 'production') {
  repo = repository(repo);
  const beta = kind === 'test';
  const result = await request(`https://api.github.com/repos/${repo}/releases${beta ? '?per_page=100' : '/latest'}`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ZYZTools' }, signal: AbortSignal.timeout(10000)
  });
  if (!result.ok) throw new Error(result.status === 404 ? 'No published release found for this repository.' : `GitHub release check failed (${result.status}).`);
  const data = await result.json();
  const releases = beta ? data.filter(release => !release.draft && release.prerelease && /^v?\d+\.\d+\.\d+-beta(?:\.\d+)?$/.test(release.tag_name)
    && (release.assets || []).some(asset => /^ZYZTools-Test-Setup.*\.exe$/i.test(asset.name))) : [data];
  if (!releases.length) return { repo, available: false, currentVersionPublished: false, message: 'No beta releases have been published yet.' };
  releases.sort((a, b) => newer(a.tag_name, b.tag_name) ? -1 : newer(b.tag_name, a.tag_name) ? 1 : 0);
  const release = releases[0];
  const available = !release.draft && (beta || !release.prerelease) && newer(release.tag_name, installed);
  const asset = kind === 'test'
    ? (release.assets || []).find(a => /^ZYZTools-Test-Setup(?:[-.][\w.-]+)?\.exe$/i.test(a.name))
    : (release.assets || []).find(a => /^ZYZTools-Setup(?:[-.][\w.-]+)?\.exe$/i.test(a.name))
      || (release.assets || []).find(a => /^PreferredCYYZPdcPlugin-Setup(?:[-.][\w.-]+)?\.exe$/i.test(a.name));
  return { repo, tag: release.tag_name, available: available && !!asset, asset,
    currentVersionPublished: beta && releases.some(r => r.tag_name.replace(/^v/, '').replace(/-beta(?:\.\d+)?$/, '') === installed),
    message: available ? (asset ? `Version ${release.tag_name} is available.` : 'A newer release has no compatible setup EXE attached.') : `You are up to date (${installed}).` };
}
async function download(release, folder, request = fetch) {
  const asset = release.asset;
  if (!release.available || !asset) throw new Error('Check for a new release first.');
  const url = new URL(asset.browser_download_url);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || !url.pathname.startsWith(`/${release.repo}/releases/download/`)) throw new Error('Invalid GitHub release asset.');
  const result = await request(url, { signal: AbortSignal.timeout(120000) });
  if (!result.ok) throw new Error(`Update download failed (${result.status}).`);
  const bytes = Buffer.from(await result.arrayBuffer());
  if (bytes.length !== asset.size || bytes.subarray(0, 2).toString() !== 'MZ') throw new Error('The downloaded installer is incomplete or invalid.');
  if (asset.digest?.startsWith('sha256:') && crypto.createHash('sha256').update(bytes).digest('hex') !== asset.digest.slice(7)) throw new Error('Installer checksum does not match GitHub.');
  fs.mkdirSync(folder, { recursive: true });
  const target = path.join(folder, 'ZYZTools-Update.exe');
  fs.writeFileSync(target + '.tmp', bytes);
  fs.renameSync(target + '.tmp', target);
  return target;
}
module.exports = { DEFAULT_REPOSITORY, repository, newer, check, download };
