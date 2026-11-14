const http = require('node:http');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, timingSafeEqual } = require('node:crypto');
const QRCode = require('qrcode');

const isPrivate = ip => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
const addresses = () => Object.entries(os.networkInterfaces()).flatMap(([name, interfaces]) =>
  interfaces.filter(n => n.family === 'IPv4' && !n.internal && isPrivate(n.address))
    .map(n => ({ name, ip: n.address })))
  .sort((a, b) => Number(/wi-fi|ethernet/i.test(b.name)) - Number(/wi-fi|ethernet/i.test(a.name)));
const files = {
  '/': ['departure-phone.html', 'text/html; charset=utf-8'],
  '/phone.js': ['departure-phone.js', 'text/javascript; charset=utf-8'],
  '/phone.css': ['departure-phone.css', 'text/css; charset=utf-8'],
};

function readSnapshot(folder, session) {
  try {
    const snapshot = JSON.parse(fs.readFileSync(path.join(folder, 'DepartureDesk.json'), 'utf8'));
    const age = Math.floor(Date.now() / 1000) - snapshot.at;
    if (snapshot.session === session && age >= 0 && age < 8 && Array.isArray(snapshot.rows))
      return { ready: true, rows: snapshot.rows.slice(0, 300) };
  } catch {}
  return { ready: false, rows: [] };
}

class DepartureDesk {
  constructor({ authorize, requestPdc, interfaces = addresses, lifetime = 2 * 60 * 60 * 1000 }) {
    Object.assign(this, { authorize, requestPdc, interfaces, lifetime });
  }

  status() {
    return { interfaces: this.interfaces(), active: Boolean(this.session), expires: this.session?.expires, qr: this.session?.qr };
  }

  async start(folder, ip) {
    if (!this.interfaces().some(n => n.ip === ip)) throw Error('Choose a local network adapter first.');
    this.stop();
    const session = {
      folder, id: randomBytes(16).toString('hex'), token: randomBytes(24).toString('base64url'),
      expires: Date.now() + this.lifetime, lastRequest: 0,
    };
    session.server = http.createServer({ requestTimeout: 8000, headersTimeout: 5000, maxHeaderSize: 8192 },
      (req, res) => this.handle(session, req, res).catch(() => {
        if (!res.headersSent) this.send(res, 503, { error: 'Departure desk is temporarily unavailable.' });
        else res.destroy();
      }));
    session.server.maxConnections = 16;
    this.session = session;
    try {
      await new Promise((resolve, reject) => {
        session.server.once('error', reject);
        session.server.listen(0, ip, resolve);
      });
      if (this.session !== session) { session.server.close(); throw Error('Sharing was stopped.'); }
      session.host = ip + ':' + session.server.address().port;
      session.origin = 'http://' + session.host;
      const heartbeat = () => {
        if (this.session !== session) return;
        if (Date.now() >= session.expires) return this.stop();
        const file = path.join(folder, 'DepartureDeskSession.txt');
        fs.writeFileSync(file + '.tmp', session.id + ' ' + Math.floor(Date.now() / 1000));
        fs.renameSync(file + '.tmp', file);
      };
      heartbeat();
      session.timer = setInterval(async () => {
        try { await this.authorize(folder); heartbeat(); }
        catch { if (this.session === session) this.stop(); }
      }, 2000);
      const { modules } = QRCode.create(session.origin + '/#' + session.token, { errorCorrectionLevel: 'M' });
      session.qr = { size: modules.size, data: Array.from(modules.data) };
      return this.status();
    } catch (error) {
      if (this.session === session) this.stop();
      throw error;
    }
  }

  stop() {
    const session = this.session;
    this.session = null;
    if (!session) return;
    clearInterval(session.timer);
    session.server.close();
    session.server.closeAllConnections();
    try {
      const file = path.join(session.folder, 'DepartureDeskSession.txt');
      if (fs.readFileSync(file, 'utf8').startsWith(session.id + ' ')) {
        fs.unlinkSync(file);
        fs.rmSync(path.join(session.folder, 'DepartureDesk.json'), { force: true });
      }
    } catch {}
  }

  send(res, status, body, type = 'application/json; charset=utf-8') {
    res.writeHead(status, {
      'Content-Type': type, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  }

  async handle(session, req, res) {
    const send = (status, body, type) => this.send(res, status, body, type);
    if (this.session !== session || Date.now() >= session.expires) return send(410, { error: 'Sharing ended.' });
    if (req.headers.host !== session.host) return send(421, { error: 'Use the address on the QR code.' });
    if (req.method === 'GET' && Object.hasOwn(files, req.url)) {
      const [name, type] = files[req.url];
      return send(200, fs.readFileSync(path.join(__dirname, name), 'utf8'), type);
    }
    const supplied = Buffer.from(req.headers.authorization || '');
    const expected = Buffer.from('Bearer ' + session.token);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
      return send(401, { error: 'Scan a fresh QR code in ZYZTools.' });
    try { await this.authorize(session.folder); }
    catch { return send(403, { error: 'Departure desk is unavailable. Check ZYZTools on the desktop.' }); }
    if (this.session !== session || Date.now() >= session.expires) return send(410, { error: 'Sharing ended.' });
    const snapshot = readSnapshot(session.folder, session.id);
    if (req.method === 'GET' && req.url === '/api/roster') return send(200, snapshot);
    const action = /^\/api\/pdc\/([A-Z0-9]{1,12})$/.exec(req.url);
    if (req.method !== 'POST' || !action) return send(404, { error: 'Not found.' });
    if (req.headers.origin !== session.origin || req.headers['content-type'] !== 'application/json' ||
        req.headers['transfer-encoding'] || Number(req.headers['content-length'] || 0) !== 0)
      return send(403, { error: 'Open the departure desk directly on your phone.' });
    if (!snapshot.ready || !snapshot.rows.some(row => row.callsign === action[1]))
      return send(409, { error: 'That aircraft is no longer available in the departure list.' });
    if (Date.now() - session.lastRequest < 3000) return send(429, { error: 'Wait a few seconds before requesting another PDC.' });
    session.lastRequest = Date.now();
    try {
      await this.requestPdc(session.folder, action[1], session.id);
      return send(200, { message: 'Request opened in EuroScope. Review and confirm it there to send.' });
    } catch { return send(409, { error: 'EuroScope could not open the request. Check for an existing confirmation or a disconnected aircraft.' }); }
  }
}

module.exports = { DepartureDesk, addresses };
