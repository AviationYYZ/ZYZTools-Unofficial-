import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invite, roomCode, displayCode, randomCode, randomSecret, expiry, isExpired, body, TTL, MAX_AGE } from '../src/core.ts';
const sample = { url: 'https://synthetic-example.trycloudflare.com', token: 'a'.repeat(64) };
test('valid managed tunnel invite and code normalization', () => {
  assert.deepEqual(invite(sample), sample); assert.equal(roomCode('abcde-fg234'), 'ABCDEFG234'); assert.equal(displayCode('ABCDEFG234'), 'ABCDE-FG234');
  for(let i=0;i<100;i++) assert.match(randomCode(), /^[A-HJ-NP-Z2-9]{10}$/); assert.match(randomSecret(), /^[a-f0-9]{64}$/);
});
test('rejects arbitrary origins, credentials and keys', () => {
  for (const url of ['http://a.trycloudflare.com', 'https://127.0.0.1', 'https://evil.test', 'https://a.trycloudflare.com.evil.test', 'https://a.trycloudflare.com/path', 'https://a.trycloudflare.com/#key=secret', 'https://user:pass@a.trycloudflare.com', 'https://a.trycloudflare.com:8443', 'https://a.trycloudflare.com/?key=secret']) assert.throws(() => invite({ ...sample, url }));
  assert.throws(() => invite({ ...sample, token:'bad' })); assert.throws(() => invite({ ...sample, unexpected:true })); assert.throws(() => roomCode('12345'));
});
test('TTL and absolute expiry boundaries', () => {
  const created=1000; assert.equal(expiry(created,created),created+TTL); assert.equal(expiry(created,created+MAX_AGE-1000),created+MAX_AGE);
  assert(!isExpired({created,expires:created+TTL},created+TTL-1)); assert(isExpired({created,expires:created+TTL},created+TTL));
  assert(isExpired({created,expires:created+MAX_AGE+1000},created+MAX_AGE));
});
test('bounded streamed JSON and exact object type', async () => {
  assert.deepEqual(await body(new Request('https://local/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sample)})),sample);
  for(const value of ['[]','null','broken','"text"'])await assert.rejects(()=>body(new Request('https://local/',{method:'POST',headers:{'Content-Type':'application/json'},body:value})));
  await assert.rejects(()=>body(new Request('https://local/',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'})));
  await assert.rejects(()=>body(new Request('https://local/',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(4097)})),/4096/);
});
