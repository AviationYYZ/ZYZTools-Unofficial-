const fs = require('node:fs');
const path = require('node:path');
async function find({ version, directories, inspect, choose }) {
  const valid = details => details?.ProductName === 'ZYZTools test' && details.ProductVersion?.match(/\d+\.\d+\.\d+/)?.[0] === version;
  for (const directory of [...new Set(directories)]) {
    for (const name of [`ZYZTools-Test-Setup-${version}.exe`, 'ZYZTools-Test-Setup.exe']) {
      const file = path.join(directory, name);
      if (!fs.existsSync(file)) continue;
      try { if (valid(await inspect(file))) return file; } catch {}
    }
  }
  const file = await choose();
  if (!file) return null;
  if (!valid(await inspect(file))) throw new Error(`Select the ZYZTools test ${version} installer. A production installer is not needed.`);
  return file;
}
module.exports = { find };
