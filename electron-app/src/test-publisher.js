const fs = require('node:fs');
const crypto = require('node:crypto');
const { DEFAULT_REPOSITORY } = require('./github-updates');
async function publish({ token, version, installer, snapshot, stream = 'beta', essential = false }, request = fetch) {
  if (!['beta', 'stable'].includes(stream)) throw new Error('Choose beta or stable.');
  const beta = stream === 'beta';
  if (!token || token.length < 20) throw new Error('Connect GitHub with a token that has Contents write permission for this repository.');
  if (snapshot.version !== version || snapshot.repository !== DEFAULT_REPOSITORY || !snapshot.files?.length) throw new Error('The source snapshot does not match this beta.');
  const bytes = fs.readFileSync(installer);
  if (bytes.subarray(0, 2).toString() !== 'MZ') throw new Error('The bundled ZYZTools installer is invalid.');
  const tag = `v${version}${beta ? '-beta' : ''}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'ZYZTools-Beta-Publisher' };
  const repoPath = `/repos/${DEFAULT_REPOSITORY}`;
  async function api(method, endpoint, body, allow404 = false) {
    const response = await request(`https://api.github.com${endpoint}`, { method,
      headers: { ...headers, 'Content-Type': 'application/json' }, redirect: 'error',
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    if (allow404 && response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub request failed (${response.status}). Check your account and repository Contents write permission.`);
    return response.json();
  }
  const account = await api('GET', '/user');
  if (account.login.toLowerCase() !== 'aviationyyz') throw new Error('Connect the AviationYYZ GitHub account.');
  if (await api('GET', `${repoPath}/releases/tags/${tag}`, undefined, true)) throw new Error(`${stream} ${version} is already published or drafted. Nothing changed.`);
  if (await api('GET', `${repoPath}/git/ref/tags/${tag}`, undefined, true)) throw new Error(`Tag ${tag} already exists. Nothing changed.`);
  const branch = beta ? 'beta' : 'main';
  const betaHead = await api('GET', `${repoPath}/git/ref/heads/${branch}`, undefined, true);
  let head = betaHead;
  if (!head) {
    const repo = await api('GET', repoPath);
    head = await api('GET', `${repoPath}/git/ref/heads/${encodeURIComponent(repo.default_branch)}`);
  }
  const parent = await api('GET', `${repoPath}/git/commits/${head.object.sha}`);
  const tree = [];
  for (const file of snapshot.files) {
    if (!file.path || file.path.startsWith('/') || file.path.split('/').includes('..')) throw new Error('Invalid source snapshot path.');
    const entry = { path: file.path, mode: '100644', type: 'blob' };
    if (file.encoding === 'base64') {
      const blob = await api('POST', `${repoPath}/git/blobs`, { content: file.content, encoding: 'base64' });
      entry.sha = blob.sha;
    } else entry.content = file.content;
    tree.push(entry);
  }
  const createdTree = await api('POST', `${repoPath}/git/trees`, { base_tree: parent.tree.sha, tree });
  const commit = await api('POST', `${repoPath}/git/commits`, { message: `Publish beta ${version}`, tree: createdTree.sha, parents: [head.object.sha] });
  if (betaHead) await api('PATCH', `${repoPath}/git/refs/heads/${branch}`, { sha: commit.sha, force: false });
  else await api('POST', `${repoPath}/git/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha });
  let release;
  try {
    release = await api('POST', `${repoPath}/releases`, { tag_name: tag, target_commitish: commit.sha,
      name: `ZYZTools ${stream} ${version}`, draft: true, prerelease: beta,
      body: `<!-- zyztools-update:${essential ? 'essential' : 'optional'} -->\nZYZTools ${stream} ${version}. ${essential ? 'Essential fix: automatically installs on next app launch.' : 'Optional update: download from Advanced.'}` });
    const upload = new URL(release.upload_url.replace(/\{.*$/, ''));
    if (upload.hostname !== 'uploads.github.com' || upload.protocol !== 'https:') throw new Error('Invalid GitHub upload endpoint.');
    upload.searchParams.set('name', `ZYZTools-Setup-${version}.exe`);
    const response = await request(upload, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream' },
      body: bytes, redirect: 'error', signal: AbortSignal.timeout(180000) });
    if (!response.ok) throw new Error(`Beta installer upload failed (${response.status}).`);
    const asset = await response.json();
    if (asset.size !== bytes.length) throw new Error('Uploaded installer size mismatch.');
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    if (asset.digest && asset.digest !== `sha256:${digest}`) throw new Error('Uploaded installer checksum mismatch.');
    const published = await api('PATCH', `${repoPath}/releases/${release.id}`, { draft: false, prerelease: beta, make_latest: beta ? 'false' : 'true' });
    return { url: published.html_url, version, tag };
  } catch (error) {
    throw new Error(`${error.message} ${stream} source was pushed. ${release ? 'The release may remain a draft; check GitHub Releases before retrying.' : 'The release was not created.'}`);
  }
}
module.exports = { publish };
