export const TTL = 120_000;
export const MAX_AGE = 12 * 60 * 60 * 1_000;
export const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export type Invite = { url: string; token: string };
export function invite(value: unknown): Invite {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'Expected a JSON object.');
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !['url', 'token'].includes(key)) || typeof data.url !== 'string' || typeof data.token !== 'string') throw new ApiError(400, 'Expected session url and token only.');
  let url: URL;
  try { url = new URL(data.url); } catch { throw new ApiError(400, 'Invalid session URL.'); }
  if (url.protocol !== 'https:' || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(url.hostname) || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) throw new ApiError(400, 'Expected a root HTTPS trycloudflare.com session URL.');
  if (!/^[a-f0-9]{64}$/.test(data.token)) throw new ApiError(400, 'Invalid session access key.');
  return { url: url.origin, token: data.token };
}
export function roomCode(input: string): string {
  const code = input.replace(/-/g, '').toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{10}$/.test(code)) throw new ApiError(404, 'Room not found or expired.');
  return code;
}
export const displayCode = (code: string): string => code.slice(0, 5) + '-' + code.slice(5);
export const expiry = (created: number, now: number): number => Math.min(now + TTL, created + MAX_AGE);
export const isExpired = (record: { created: number; expires: number }, now: number): boolean => now >= record.expires || now >= record.created + MAX_AGE;
export function randomCode(): string { return Array.from(crypto.getRandomValues(new Uint8Array(10)), value => ALPHABET[value & 31]).join(''); }
export function randomSecret(): string { return Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join(''); }
export async function digest(value: string): Promise<string> { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), v => v.toString(16).padStart(2, '0')).join(''); }
export async function body(request: Request): Promise<unknown> {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) throw new ApiError(415, 'JSON body required.');
  const length = request.headers.get('Content-Length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 4096)) throw new ApiError(413, 'Body exceeds 4096 bytes.');
  if (!request.body) return {};
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const item = await reader.read(); if (item.done) break; size += item.value.byteLength; if (size > 4096) { await reader.cancel(); throw new ApiError(413, 'Body exceeds 4096 bytes.'); } chunks.push(item.value); }
  } finally { reader.releaseLock(); }
  if (!size) return {};
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; } catch { throw new ApiError(400, 'Invalid JSON object.'); }
}
export function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", ...(status === 429 ? { 'Retry-After': '60' } : {}) } });
}
