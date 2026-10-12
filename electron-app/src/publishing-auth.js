const fs = require('node:fs');
const path = require('node:path');
function load(folder, storage) {
  const file = path.join(folder, 'beta-publishing.bin');
  if (!fs.existsSync(file) || !storage?.isEncryptionAvailable()) return null;
  try { return storage.decryptString(fs.readFileSync(file)); } catch { return null; }
}
function save(folder, token, storage) {
  if (!storage?.isEncryptionAvailable()) throw new Error('Secure credential storage is unavailable. Leave Remember access unchecked.');
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, 'beta-publishing.bin');
  fs.writeFileSync(file + '.tmp', storage.encryptString(token));
  fs.renameSync(file + '.tmp', file);
}
module.exports = { load, save };
