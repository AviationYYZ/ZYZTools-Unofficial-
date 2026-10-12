const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const allowed = new Set(['apply', 'reject', 'reject-fp', 'link-test', 'test-pdc', 'export']);
let busy = false;
async function sendPluginAction(folder, action, callsign = '', timeoutMs = 8000) {
  if (!allowed.has(action)) throw new Error('Unknown plugin action.');
  callsign = String(callsign).trim().toUpperCase();
  if (action.startsWith('reject') && !/^[A-Z0-9]{1,12}$/.test(callsign)) throw new Error('Enter a valid aircraft callsign.');
  if (!fs.existsSync(path.join(folder, 'PreferredCYYZPdcPlugin.dll'))) throw new Error('Install the EuroScope plugin first.');
  if (busy) throw new Error('Another plugin action is still running.');
  const request = path.join(folder, 'SettingsAction.json');
  const response = path.join(folder, 'SettingsActionResult.json');
  const id = crypto.randomUUID();
  busy = true;
  try {
    if (fs.existsSync(request)) {
      const pending = JSON.parse(fs.readFileSync(request, 'utf8'));
      if (Date.now() / 1000 - pending.sent_at > 15) fs.unlinkSync(request);
      else throw new Error('Another plugin action is waiting for EuroScope.');
    }
    fs.writeFileSync(request, JSON.stringify({ id, action, callsign, sent_at: Math.floor(Date.now() / 1000) }), { flag: 'wx' });
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const result = JSON.parse(fs.readFileSync(response, 'utf8'));
        if (result.id === id) {
          if (!result.ok) throw new Error('Action failed. Check EuroScope messages and the selected configuration.');
          return { ok: true, message: 'Action processed by EuroScope. Check EuroScope for the result.' };
        }
      } catch (error) {
        if (!['ENOENT', undefined].includes(error.code)) throw error;
        if (error.message.startsWith('Action failed.')) throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('EuroScope did not respond. Open EuroScope with the updated plugin loaded.');
  } finally {
    try { if (JSON.parse(fs.readFileSync(request, 'utf8')).id === id) fs.unlinkSync(request); } catch {}
    busy = false;
  }
}
module.exports = { sendPluginAction };
