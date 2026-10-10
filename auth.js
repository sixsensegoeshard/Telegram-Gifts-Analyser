import { createHmac, timingSafeEqual, randomBytes, createHash } from 'node:crypto';

export function validateInitData(raw, token, maxAge = 3600, now = Math.floor(Date.now() / 1000)) {
  if (typeof raw !== 'string' || raw.length > 16384 || !token) throw new Error('Invalid Telegram authorization');
  const pairs = [...new URLSearchParams(raw)];
  if (new Set(pairs.map(([key]) => key)).size !== pairs.length) throw new Error('Duplicate authorization fields');
  const fields = Object.fromEntries(pairs);
  if (!/^[0-9a-f]{64}$/.test(fields.hash || '')) throw new Error('Invalid signature');
  // In bot-token HMAC validation only hash is excluded. Ed25519 uses different rules.
  const check = pairs.filter(([key]) => key !== 'hash').sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const expected = createHmac('sha256', secret).update(check).digest();
  if (!timingSafeEqual(expected, Buffer.from(fields.hash, 'hex'))) throw new Error('Invalid signature');
  const date = Number(fields.auth_date);
  if (!Number.isInteger(date) || date > now + 30 || now - date > maxAge) throw new Error('Expired authorization');
  let user;
  try { user = JSON.parse(fields.user); } catch { throw new Error('Invalid user'); }
  if (!Number.isSafeInteger(user?.id) || user.id <= 0) throw new Error('Invalid user');
  return { id: user.id, name: String(user.first_name || 'Коллекционер').slice(0, 80) };
}

export function newSession() { return randomBytes(32).toString('base64url'); }
export function sessionHash(token) { return createHash('sha256').update(token).digest('hex'); }

export class RateLimiter {
  constructor(limit = 120, windowMs = 60000) { this.limit = limit; this.windowMs = windowMs; this.entries = new Map(); }
  allow(key, now = Date.now()) {
    let item = this.entries.get(key);
    if (!item || item.until <= now) { item = { count: 0, until: now + this.windowMs }; this.entries.set(key, item); }
    if (this.entries.size > 10000) for (const [id, entry] of this.entries) if (entry.until <= now) this.entries.delete(id);
    return ++item.count <= this.limit;
  }
}
