const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DepartureDesk } = require('./src/departure-desk');

app.whenReady().then(async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'zyz-departure-phone-'));
  const calls = [];
  const desk = new DepartureDesk({
    authorize() {}, requestPdc: (_, cs) => calls.push(cs),
    interfaces: () => [{ name: 'Test only', ip: '127.0.0.1' }],
  });
  let win;
  try {
    await desk.start(folder, '127.0.0.1');
    const { origin, token, id } = desk.session;
    fs.writeFileSync(path.join(folder, 'DepartureDesk.json'), JSON.stringify({
      at: Math.floor(Date.now() / 1000), session: id,
      rows: [{ callsign: 'ACA123', destination: 'CYUL', runway: '05', route: 'DCT TEST', status: 'TELEX requested' }],
    }));
    win = new BrowserWindow({ width: 390, height: 844, show: false, webPreferences: { backgroundThrottling: false } });
    const js = source => win.webContents.executeJavaScript(source);
    const until = async source => {
      for (let i = 0; i < 45; i++) {
        if (await js(source)) return;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw Error('Timed out: ' + source);
    };
    await win.loadURL(origin + '/#' + token);
    await until("document.querySelector('#roster button') !== null");
    assert.equal(await js('location.hash'), '');
    assert.equal(await js('document.documentElement.scrollWidth <= innerWidth'), true);
    assert.match(await js("document.getElementById('roster').innerText"), /ACA123.*CYUL/s);
    await js("filter.value='CYOW';filter.dispatchEvent(new Event('input'))");
    assert.match(await js("document.getElementById('roster').innerText"), /No matching/);
    await js("filter.value='CYUL';filter.dispatchEvent(new Event('input'));document.querySelector('#roster button').click()");
    await until("document.getElementById('notice').textContent.includes('confirm it there')");
    assert.deepEqual(calls, ['ACA123']);
    await win.webContents.reload();
    await until("document.getElementById('connection').textContent.includes('Scan the QR')");
    assert.equal(await js("document.querySelector('#roster button')"), null);
    console.log('PASS: phone-size departure desk, QR URL, search, PDC request and re-pair on reload.');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
    desk.stop();
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
