import { DurableObject } from 'cloudflare:workers';
export { AppPolicy } from './admin';
import { ApiError, body, digest, displayCode, expiry, invite, isExpired, json, randomCode, randomSecret, roomCode, type Invite } from './core';

type Row = { url: string; token: string; owner: string; created: number; expires: number };

// One durable coordination object per random room, not one global registry.
export class Room extends DurableObject<Env> {
  private read(): Row | undefined {
    const table = this.ctx.storage.sql.exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name='room'").toArray();
    return table.length ? this.ctx.storage.sql.exec<Row>('SELECT url, token, owner, created, expires FROM room WHERE id=1').toArray()[0] : undefined;
  }
  async create(value: Invite, owner: string): Promise<boolean> {
    const previous = this.read(); const now = Date.now();
    if (previous && !isExpired(previous, now)) return false;
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY CHECK(id=1), url TEXT NOT NULL, token TEXT NOT NULL, owner TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL)');
    const expires = expiry(now, now);
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO room VALUES (1, ?, ?, ?, ?, ?)', value.url, value.token, owner, now, expires);
    await this.ctx.storage.setAlarm(expires);
    return true;
  }
  resolve(): { url: string; token: string; expiresAt: string } | null {
    const row = this.read();
    return !row || isExpired(row, Date.now()) ? null : { url: row.url, token: row.token, expiresAt: new Date(row.expires).toISOString() };
  }
  async change(owner: string, remove: boolean, value: Invite | null): Promise<{ status: number; expiresAt?: string }> {
    const row = this.read(); const now = Date.now();
    if (!row || isExpired(row, now)) return { status: 404 };
    if (!crypto.subtle.timingSafeEqual(new TextEncoder().encode(owner), new TextEncoder().encode(row.owner))) return { status: 403 };
    if (remove) { await this.ctx.storage.deleteAll(); return { status: 200 }; }
    const expires = expiry(row.created, now);
    this.ctx.storage.sql.exec('UPDATE room SET url=?, token=?, expires=? WHERE id=1', value?.url ?? row.url, value?.token ?? row.token, expires);
    await this.ctx.storage.setAlarm(expires);
    return { status: 200, expiresAt: new Date(expires).toISOString() };
  }
  async alarm(): Promise<void> {
    const row = this.read();
    if (!row || isExpired(row, Date.now())) await this.ctx.storage.deleteAll();
    else await this.ctx.storage.setAlarm(row.expires);
  }
}

// Exact per-client limits survive isolate restarts; no room names or raw IPs here.
export class ClientLimiter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS limits (kind TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL)');
  }
  async allow(kind: 'create' | 'lookup' | 'update'): Promise<boolean> {
    // An idle alarm may clear storage without evicting this live object.
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS limits (kind TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL)');
    const now = Date.now(), window = Math.floor(now / 60_000), limit = kind === 'create' ? 5 : kind === 'lookup' ? 30 : 60;
    const allowed = this.ctx.storage.transactionSync(() => {
      const total = this.ctx.storage.sql.exec<{ count: number }>('SELECT count FROM limits WHERE kind=? AND window=?', 'total', window).toArray()[0]?.count ?? 0;
      const count = this.ctx.storage.sql.exec<{ count: number }>('SELECT count FROM limits WHERE kind=? AND window=?', kind, window).toArray()[0]?.count ?? 0;
      if (total >= 60 || count >= limit) return false;
      this.ctx.storage.sql.exec('INSERT OR REPLACE INTO limits VALUES (?, ?, ?)', 'total', window, total + 1);
      this.ctx.storage.sql.exec('INSERT OR REPLACE INTO limits VALUES (?, ?, ?)', kind, window, count + 1);
      return true;
    });
    // Idle limit records are deleted; a wake-up/restart still checks the window.
    await this.ctx.storage.setAlarm(now + 120_000);
    return allowed;
  }
  async alarm(): Promise<void> { await this.ctx.storage.deleteAll(); }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.search) throw new ApiError(400, 'Query strings are not accepted.');
      if (request.method === 'GET' && url.pathname === '/health') return json({ service: 'ZYZTools Room Directory', version: '0.1.0', apiVersion: 1, status: 'ok' });
      if (['/v2/policy','/v2/events','/v2/redeem','/v2/admin'].includes(url.pathname)) {
        if(url.pathname!=='/v2/policy'){
          const ip=request.headers.get('CF-Connecting-IP');
          if(!ip||ip.length>64)throw new ApiError(503,'Client identity unavailable.');
          const limiter=env.LIMITERS.getByName(await digest('zyz-policy-client-v2:'+ip));
          if(!await limiter.allow(url.pathname==='/v2/events'?'lookup':'create'))throw new ApiError(429,'Too many requests. Wait one minute.');
        }
        return env.APP_POLICY.getByName('global-v2').fetch(request);
      }
      const create = request.method === 'POST' && url.pathname === '/v1/rooms';
      const match = url.pathname.match(/^\/v1\/rooms\/([A-Za-z2-9-]{10,11})$/);
      if (!create && !match) throw new ApiError(404, 'Not found.');
      if (!create && !['GET', 'PUT', 'DELETE'].includes(request.method)) throw new ApiError(405, 'Method not allowed.');
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip || ip.length > 64) throw new ApiError(503, 'Client identity unavailable.');
      const limiter = env.LIMITERS.getByName(await digest('zyz-directory-client-v1:' + ip));
      if (!await limiter.allow(create ? 'create' : request.method === 'GET' ? 'lookup' : 'update')) throw new ApiError(429, 'Too many requests. Wait one minute.');
      if (create) {
        const value = invite(await body(request)), ownerToken = randomSecret(), owner = await digest(ownerToken);
        for (let attempt = 0; attempt < 5; attempt++) {
          const code = randomCode();
          if (await env.ROOMS.getByName(code).create(value, owner)) return json({ code: displayCode(code), ownerToken, expiresAt: new Date(expiry(Date.now(), Date.now())).toISOString(), heartbeatSeconds: 45 });
        }
        throw new ApiError(503, 'Could not allocate a room. Retry shortly.');
      }
      const code = roomCode(match![1]), room = env.ROOMS.getByName(code);
      if (request.method === 'GET') { const found = await room.resolve(); if (!found) throw new ApiError(404, 'Room not found or expired.'); return json({ code: displayCode(code), ...found }); }
      const header = request.headers.get('Authorization') || '';
      if (!/^Bearer [a-f0-9]{64}$/.test(header)) throw new ApiError(403, 'Host authorization required.');
      let value: Invite | null = null;
      if (request.method === 'PUT') { const parsed = await body(request) as Record<string, unknown>; if (Object.keys(parsed).length) value = invite(parsed); }
      const result = await room.change(await digest(header.slice(7)), request.method === 'DELETE', value);
      if (result.status !== 200) throw new ApiError(result.status, result.status === 403 ? 'Host authorization required.' : 'Room not found or expired.');
      return json({ ok: true, ...(result.expiresAt ? { expiresAt: result.expiresAt } : {}) });
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, error.status);
      // Do not log request URLs, room codes, access keys or exception messages.
      console.error(JSON.stringify({ event: 'directory_request_failed' }));
      return json({ error: 'Directory temporarily unavailable.' }, 503);
    }
  }
} satisfies ExportedHandler<Env>;
