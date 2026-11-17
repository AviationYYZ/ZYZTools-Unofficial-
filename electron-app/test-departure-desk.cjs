const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const QRCode = require('qrcode');
const { DepartureDesk } = require('./src/departure-desk');

test('QR opens local phone desk; only paired users can access a fresh roster and request confirmation', async t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'zyz-departure-desk-'));
  const requests = [];
  let allowed = true;
  const desk = new DepartureDesk({
    interfaces: () => [{ name: 'Local test', ip: '127.0.0.1' }],
    authorize: () => { if (!allowed) throw Error('Disabled'); },
    requestPdc: (...args) => { requests.push(args); },
  });
  t.after(() => { desk.stop(); fs.rmSync(folder, { force: true, recursive: true }); });

  await assert.rejects(desk.start(folder, '0.0.0.0'), /adapter/);
  const result = await desk.start(folder, '127.0.0.1');
  const first = desk.session;
  const qr = QRCode.create(first.origin + '/#' + first.token);
  assert.equal(result.qr.size, qr.modules.size);
  assert.deepEqual(result.qr.data, Array.from(qr.modules.data));
  assert.equal(JSON.stringify(result).includes(first.token), false);

  const headers = { Authorization: 'Bearer ' + first.token };
  const call = (route, options) => fetch(first.origin + route, options);
  const page = await call('/');
  assert.match(await page.text(), /Departure desk/);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal((await call('/api/roster')).status, 401);
  assert.deepEqual(await (await call('/api/roster', { headers })).json(), { ready: false, rows: [] });

  const file = path.join(folder, 'DepartureDesk.json');
  const rows = [{ callsign: 'ACA123', destination: 'CYUL', runway: '05', status: 'Not sent' }];
  const at = Math.floor(Date.now() / 1000);
  const snapshot = (session, at) => fs.writeFileSync(file, JSON.stringify({ session, at, rows }));
  const request = (origin, callsign = 'ACA123') => call('/api/pdc/' + callsign, {
    method: 'POST', headers: { ...headers, Origin: origin, 'Content-Type': 'application/json' },
  });
  snapshot('old-session', at);
  assert.equal((await request(first.origin)).status, 409);
  snapshot(first.id, at - 30);
  assert.equal((await request(first.origin)).status, 409);
  snapshot(first.id, at);
  assert.deepEqual(await (await call('/api/roster', { headers })).json(), { ready: true, rows });
  assert.equal((await request('http://example.invalid')).status, 403);
  assert.equal((await request(first.origin, 'ACA456')).status, 409);
  assert.equal(requests.length, 0);
  assert.equal((await request(first.origin)).status, 200);
  assert.deepEqual(requests, [[folder, 'ACA123', first.id]]);
  assert.equal((await request(first.origin)).status, 429);
  allowed = false;
  assert.equal((await call('/api/roster', { headers })).status, 403);

  desk.stop();
  assert.equal(fs.existsSync(path.join(folder, 'DepartureDeskSession.txt')), false);
  assert.equal(fs.existsSync(file), false);
  allowed = true;
  await desk.start(folder, '127.0.0.1');
  assert.notEqual(desk.session.token, first.token);
  assert.equal((await fetch(desk.session.origin + '/api/roster', { headers })).status, 401);
});
