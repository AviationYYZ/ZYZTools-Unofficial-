const path = require('node:path');
const info = require('../package.json');
function settings(kind) {
  const test = kind === 'test';
  return { test, name: test ? 'ZYZTools test' : 'ZYZTools',
    appId: test ? 'com.zyztools.test' : 'com.preferredcyyz.pdcsettings',
    userDataName: test ? 'ZYZTools-test' : 'ZYZTools',
    localSettingsName: test ? 'ZYZTools-test' : 'PreferredCYYZPdcPlugin',
    pluginFolderName: test ? 'ZYZTools-test' : 'PreferredCYYZPdcPlugin',
    replayPipe: '\\\\.\\pipe\\PreferredCYYZAudioReplay' + (test ? '.Test' : '') };
}
const channel = settings(info.zyzBuildChannel);
function destination(selected, root, current = channel) {
  let folder = String(selected || root).replace(/[\\/]+$/, '');
  const base = path.basename(folder).toLowerCase();
  if (base === current.pluginFolderName.toLowerCase()) return folder;
  if (base === 'zyztools-test' || base === 'preferredcyyzpdcplugin') folder = path.dirname(folder);
  return path.join(folder, current.pluginFolderName);
}
function assertDestination(folder, config, current = channel) {
  const testFolder = path.basename(folder).toLowerCase() === 'zyztools-test' || config?.build_channel === 'test';
  if (testFolder !== current.test) throw new Error('Production and test plugin folders must remain separate. Choose this app’s own plugin destination.');
}
module.exports = { channel, settings, destination, assertDestination };
