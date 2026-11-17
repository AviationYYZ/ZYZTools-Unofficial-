const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { repository, newer, check, readPreferences, savePreferences } = require('./src/github-updates');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'zyz-update-prefs-'));
  try {
    const file=path.join(dir,'update-stream.json');
    assert.deepEqual(readPreferences(file),{stream:'stable',paused:false});
    savePreferences(file,{paused:true});
    savePreferences(file,{stream:'beta'});
    assert.deepEqual(readPreferences(file),{stream:'beta',paused:true});
    savePreferences(file,{paused:false});
    assert.deepEqual(readPreferences(file),{stream:'beta',paused:false});
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
  assert.equal(repository('https://github.com/example/project.git'), 'example/project');
  assert.throws(() => repository('https://unrelated.example/repo'));
  assert(newer('v1.2.0', '1.1.1'));
  assert(!newer('1.1.1', '1.1.1'));
  assert(!newer('1.1.0', '1.1.1'));
  const mock = async url => { assert(url.endsWith('/example/project/releases?per_page=100')); return {
    ok: true, json: async () => ({ tag_name: 'v1.2.0', assets: [{ name: 'PreferredCYYZPdcPlugin-Setup.exe' }] })
  }; };
  assert((await check('example/project', '1.1.1', mock)).available);
  assert(!(await check('example/project', '1.2.0', mock)).available);
  const renamed = await check('example/project', '1.1.1', async () => ({ ok: true, json: async () => ({
    tag_name: 'v1.2.0', assets: [{ name: 'PreferredCYYZPdcPlugin-Setup.exe' }, { name: 'ZYZTools-Setup.exe' }]
  }) }));
  assert.equal(renamed.asset.name, 'ZYZTools-Setup.exe');
  const channelAssets = async () => ({ ok: true, json: async () => ({ tag_name: 'v1.2.0', assets: [{name:'ZYZTools-Setup.exe'},{name:'ZYZTools-Test-Setup.exe'}] }) });
  const betaAssets = async () => ({ ok: true, json: async () => [
    { tag_name: 'v9.0.0', assets: [{name:'ZYZTools-Setup.exe'}] },
    { tag_name: 'v1.2.0-beta', prerelease: true, assets: [{name:'ZYZTools-Test-Setup-1.2.0.exe'}] }
  ] });
  const beta = await check('example/project', '1.1.1', betaAssets, 'test');
  assert.equal(beta.asset.name, 'ZYZTools-Test-Setup-1.2.0.exe');
  assert.equal(beta.tag, 'v1.2.0-beta');
  assert(beta.available);
  assert((await check('example/project', '1.2.0', betaAssets, 'test')).currentVersionPublished);
  assert(!(await check('example/project', '1.1.1', async () => ({ok:true,json:async()=>[]}), 'test')).available);
  assert.equal((await check('example/project', '1.1.1', channelAssets, 'production')).asset.name, 'ZYZTools-Setup.exe');
  const mixed = async () => ({ok:true,json:async()=>[
    {tag_name:'v1.6.0',assets:[{name:'ZYZTools-Server-Setup-1.6.0.exe'}]},
    {tag_name:'v1.4.0',assets:[{name:'ZYZTools-Setup.exe'}]},
    {tag_name:'v1.3.0',body:'<!-- zyztools-update:essential -->',assets:[{name:'ZYZTools-Setup.exe'}]},
    {tag_name:'v1.5.0-beta',prerelease:true,body:'<!-- zyztools-update:essential -->',assets:[{name:'ZYZTools-Setup.exe'}]}
  ]});
  assert.equal((await check('example/project','1.2.0',mixed,'stable')).tag,'v1.4.0');
  assert.equal((await check('example/project','1.2.0',mixed,'stable',{essentialOnly:true})).tag,'v1.3.0');
  assert.equal((await check('example/project','1.2.0',mixed,'stable',{preferEssential:true})).tag,'v1.3.0');
  assert.equal((await check('example/project','1.3.0',mixed,'stable',{preferEssential:true})).tag,'v1.4.0');
  assert.equal((await check('example/project','1.2.0',mixed,'beta',{essentialOnly:true})).tag,'v1.5.0-beta');
  assert(!(await check('example/project','1.3.0',mixed,'stable',{essentialOnly:true})).available);
  await assert.rejects(check('example/project', '1.1.1', async () => ({ ok: false, status: 404 })), /No published release/);
  console.log('PASS: repository validation, semantic versions, release update button eligibility, offline/API errors');
})().catch(error => { console.error(error); process.exitCode = 1; });
