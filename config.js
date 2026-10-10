import path from 'node:path';

function number(env, key, fallback, min, max) {
  const value = Number(env[key] || fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${key}`);
  return value;
}

export function readConfig(env = process.env) {
  const mode = env.APP_MODE || 'demo';
  if (!['demo', 'preview', 'live'].includes(mode)) throw new Error('APP_MODE must be demo, preview or live');
  const host = env.HOST || (mode === 'live' ? '0.0.0.0' : '127.0.0.1');
  if (mode === 'demo' && !['127.0.0.1', '::1', 'localhost'].includes(host)) throw new Error('Demo must bind to loopback');
  if (mode !== 'demo' && !env.BOT_TOKEN) throw new Error('BOT_TOKEN is required for Telegram mode');
  const publicUrl = env.PUBLIC_URL || '';
  if (mode !== 'demo' && (!publicUrl || new URL(publicUrl).protocol !== 'https:')) throw new Error('PUBLIC_URL must be HTTPS for Telegram mode');
  return {
    mode, host, publicUrl, port: number(env, 'PORT', 3000, 0, 65535),
    dbPath: path.resolve(env.DB_PATH || './data/gifts.sqlite'), botToken: env.BOT_TOKEN || '',
    initDataMaxAge: number(env, 'INIT_DATA_MAX_AGE', 3600, 60, 86400),
    sessionTtl: number(env, 'SESSION_TTL', 43200, 300, 604800),
    pollSeconds: number(env, 'POLL_INTERVAL_SECONDS', 60, 30, 3600),
    staleSeconds: number(env, 'STALE_AFTER_SECONDS', 300, 60, 86400),
    provider: env.MARKET_PROVIDER || 'giftasset',
    portalsBase: env.PORTALS_BASE_URL || 'https://portal-market.com/api',
    providerBase: env.GIFTASSET_BASE_URL || 'https://giftasset.gifts',
    feedUrl: env.MARKET_FEED_URL || '',
    authHeader: env.PROVIDER_AUTH_HEADER || '', authValue: env.PROVIDER_AUTH_VALUE || '',
    openaiKey: env.OPENAI_API_KEY || '', openaiModel: env.OPENAI_MODEL || 'gpt-4.1-mini',
  };
}
