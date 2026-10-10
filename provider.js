import { demoGifts } from './demo.js';
import { quote } from './analytics.js';
import { ResearchService } from './research.js';
import { getPortalsCollections, normalizePortalsListings } from './portals.js';

const artById = Object.fromEntries(demoGifts().map(g => [g.id, g.art]));
export const slug = name => name.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const numeric = (value, min = 0, max = 1e12) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max ? Number(value) : null;

export async function fetchJson(url, headers = {}, fetcher = fetch) {
  if (new URL(url).protocol !== 'https:') throw new Error('Provider URL must use HTTPS');
  const response = await fetcher(url, { headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(12000), redirect: 'error' });
  if (!response.ok) {
    const error = new Error(`Provider HTTP ${response.status}`);
    const retry = response.headers.get('retry-after');
    error.retrySeconds = /^\d+$/.test(retry || '') ? Number(retry) : Math.max(0, (Date.parse(retry) - Date.now()) / 1000) || 0;
    throw error;
  }
  if (Number(response.headers.get('content-length')) > 4 * 1024 * 1024) throw new Error('Provider response too large');
  const reader = response.body.getReader();
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4 * 1024 * 1024) throw new Error('Provider response too large');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel(); throw error; }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function normalizeFeed(payload) {
  if (!Array.isArray(payload?.gifts) || !payload.gifts.length || payload.gifts.length > 1000) throw new Error('Invalid provider gifts');
  const ids = new Set();
  return payload.gifts.map(item => {
    if (!item || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 100 || !/^[a-z0-9-]{1,80}$/.test(item.id || '') || ids.has(item.id)) throw new Error('Invalid provider collection');
    ids.add(item.id);
    const updatedAt = typeof item.updatedAt === 'number' ? item.updatedAt : Date.parse(item.updatedAt);
    if (!Number.isFinite(updatedAt) || updatedAt <= 0 || updatedAt > Date.now() + 30000) throw new Error('Invalid provider timestamp');
    if (!Array.isArray(item.markets) || !item.markets.length || item.markets.length > 10) throw new Error('Invalid provider markets');
    const names = new Set();
    const markets = item.markets.map(m => {
      if (!m || typeof m.name !== 'string' || !m.name.trim() || m.name.length > 40 || names.has(m.name) || numeric(m.floor, .000000001, 1e9) === null) throw new Error('Invalid provider quote');
      names.add(m.name);
      return { name: m.name, floor: Number(m.floor), listings: numeric(m.listings) };
    });
    return { id: item.id, name: item.name, art: artById[item.id] || 'gift', updatedAt, markets,
      change24h: numeric(item.change24h, -100, 100000), sales24h: numeric(item.sales24h),
      volume24h: numeric(item.volume24h), avgSale24h: numeric(item.avgSale24h, .000000001), history: [], traits: [] };
  });
}

export function normalizeGiftAsset(prices, volumes) {
  if (!prices?.collection_floors || typeof prices.collection_floors !== 'object') throw new Error('Invalid GiftAsset price list');
  const stats = new Map();
  if (volumes) {
    for (const source of Object.values(volumes)) for (const row of source?.collections || []) {
      const count = numeric(row.sales_count), revenue = numeric(row.sales_sum);
      if (count === null || revenue === null || typeof row.collection_name !== 'string') continue;
      const stat = stats.get(row.collection_name) || { count: 0, revenue: 0 };
      stat.count += count; stat.revenue += revenue; stats.set(row.collection_name, stat);
    }
  }
  const labels = { portals: 'Portals', mrkt: 'MRKT', tonnel: 'Tonnel', getgems: 'Getgems' };
  const gifts = Object.entries(prices.collection_floors).flatMap(([name, floors]) => {
    if (!floors || typeof floors !== 'object') return [];
    const markets = Object.entries(labels).filter(([key]) => numeric(floors[key], .000000001) !== null).map(([key, label]) => ({ name: label, floor: Number(floors[key]) }));
    if (!markets.length) return [];
    const stat = stats.get(name);
    return [{ id: slug(name), name, updatedAt: floors.last_update, markets,
      sales24h: stat?.count ?? null, volume24h: stat?.revenue ?? null,
      avgSale24h: stat?.count > 0 ? stat.revenue / stat.count : null, change24h: null }];
  });
  return normalizeFeed({ gifts });
}

export class MarketService {
  constructor(config, store, fetcher = fetch) {
    this.config = config; this.store = store; this.fetcher = fetcher; this.error = null; this.warning = null; this.timer = null; this.running = false; this.failures = 0; this.nextPollAt = 0;
    this.isDemo = config.mode !== 'live';
    this.listingCache = new Map();
    this.research = new ResearchService(this, store, url => fetchJson(url, {}, this.fetcher));
    const cached = config.mode === 'live' ? store.cachedMarket('live') : null;
    this.gifts = this.isDemo ? demoGifts() : cached?.gifts || [];
    this.fetchedAt = this.isDemo ? Date.now() : cached?.fetchedAt || null;
    if (this.isDemo) store.saveMarket('demo', this.gifts);
  }
  status() {
    const gifts = this.all();
    const freshCount = gifts.filter(g => g.fresh).length;
    const sourceState = name => this.isDemo || !gifts.some(g=>g.markets.some(m=>m.name===name)) ? 'not-connected' : gifts.some(g=>g.fresh&&g.markets.some(m=>m.name===name)) ? 'connected' : 'stale';
    return { mode: this.isDemo ? 'demo' : 'live', telegramPreview: this.config.mode === 'preview', provider: this.isDemo ? 'Демонстрация' : this.config.provider === 'portals' ? 'Portals · публичные данные' : this.config.provider === 'feed' ? 'JSON Feed' : 'GiftAsset',
      state: this.isDemo ? 'demo' : !gifts.length ? 'unavailable' : this.error || freshCount !== gifts.length ? 'degraded' : 'online',
      fetchedAt: this.fetchedAt, freshCount, collectionCount: gifts.length, error: this.error, warning: this.warning, retryAt: this.error ? this.nextPollAt : null,
      assistant: this.config.openaiKey ? 'openai' : 'local', notifications: this.config.mode === 'live' && !!this.config.botToken,
      listings: !this.isDemo && this.config.provider === 'portals', timestampKind: !this.isDemo && this.config.provider === 'portals' ? 'observed' : 'source',
      sources: [
        { name: 'Portals', url: 'https://t.me/portals', state: sourceState('Portals') },
        { name: 'MRKT', state: sourceState('MRKT') },
        { name: 'Getgems', state: 'requires-key' },
        { name: 'Gift Charts', url: 'https://t.me/gift_charts_bot', state: 'requires-access' },
      ] };
  }
  all() {
    // Demo freshness is irrelevant to fixture expiry but still visibly marked demo.
    return this.gifts.map(g => quote(g, this.isDemo ? g.updatedAt : Date.now(), this.config.staleSeconds));
  }
  detail(id) {
    const gift = this.all().find(g => g.id === id);
    if (!gift) return null;
    const research = this.research.snapshot(id);
    const history = this.isDemo ? gift.history : research?.history?.length ? research.history : this.store.history('live', id);
    return { ...gift, history, historySource: research?.history?.length ? 'Portals · часовые данные' : 'Gift Signal · наблюдения', research };
  }
  async listings(id) {
    if (this.isDemo || this.config.provider !== 'portals') throw Object.assign(new Error('Предложения пока недоступны для этого источника'), { status: 503 });
    const gift = this.all().find(g=>g.id===id);
    if (!gift?.providerIds?.portals) throw Object.assign(new Error('Коллекция не найдена'), { status: 404 });
    const cached = this.listingCache.get(id);
    if (cached?.retryAt > Date.now()) throw Object.assign(new Error('Источник временно недоступен. Повтори позже'), { status: 503 });
    if (cached?.expires > Date.now()) return cached.value;
    if (cached?.pending) return cached.pending;
    const pending = (async()=>{
      try {
        const base = this.config.portalsBase.replace(/\/$/, '');
        const payload = await fetchJson(`${base}/nfts/search?offset=0&limit=20&sort_by=price%20asc&status=listed&collection_ids=${gift.providerIds.portals}`, {}, this.fetcher);
        const value = normalizePortalsListings(payload, gift);
        this.listingCache.set(id, { value, expires: Date.now()+60000 });
        if (this.listingCache.size > 100) this.listingCache.delete(this.listingCache.keys().next().value);
        return value;
      } catch(error) {
        this.listingCache.set(id, { retryAt: Date.now()+Math.max(60,Math.min(error.retrySeconds||0,86400))*1000 });
        throw Object.assign(new Error('Не удалось получить предложения Portals. Повтори позже'), { status: 503 });
      }
    })();
    this.listingCache.set(id,{pending}); return pending;
  }
  async poll() {
    if (this.isDemo || this.running || Date.now() < this.nextPollAt) return;
    this.running = true;
    try {
      const { config } = this;
      const headers = config.authHeader && config.authValue ? { [config.authHeader]: config.authValue } : {};
      let gifts, metricsRetrySeconds = 0;
      this.warning = null;
      if (config.provider === 'portals') {
        const base = config.portalsBase.replace(/\/$/, '');
        gifts = await getPortalsCollections(url => fetchJson(url, {}, this.fetcher), base);
      } else if (config.provider === 'feed') {
        if (!config.feedUrl) throw new Error('MARKET_FEED_URL is not configured');
        gifts = normalizeFeed(await fetchJson(config.feedUrl, headers, this.fetcher));
      } else if (config.provider === 'giftasset') {
        if (!config.authHeader || !config.authValue) throw new Error('GiftAsset access is not configured');
        const base = config.providerBase.replace(/\/$/, '');
        const results = await Promise.allSettled([
          fetchJson(`${base}/api/v1/gifts/get_gifts_price_list`, headers, this.fetcher),
          fetchJson(`${base}/api/v1/gifts/get_custom_collections_volumes?maxtime=86400`, headers, this.fetcher),
        ]);
        if (results[0].status === 'rejected') throw results[0].reason;
        if (results[1].status === 'rejected') {
          this.warning = 'Статистика продаж недоступна';
          metricsRetrySeconds = Math.min(results[1].reason.retrySeconds || 0, 86400);
        }
        gifts = normalizeGiftAsset(results[0].value, results[1].status === 'fulfilled' ? results[1].value : null);
      } else throw new Error('Unknown MARKET_PROVIDER');
      for (const gift of gifts) {
        if (gift.change24h !== null) continue;
        const old = this.store.db.prepare('SELECT floor,at FROM snapshots WHERE namespace=? AND gift_id=? AND at<=? AND at>=? ORDER BY at DESC LIMIT 1').get('live', gift.id, gift.updatedAt - 86400000, gift.updatedAt - 86400000 - config.staleSeconds * 1000);
        if (old) gift.change24h = (Math.min(...gift.markets.map(m => m.floor)) - old.floor) / old.floor * 100;
      }
      if (this.research.closed) return;
      const now = Date.now();
      this.store.saveMarket('live', gifts, now); this.gifts = gifts; this.fetchedAt = now; this.error = null; this.failures = 0; this.nextPollAt = metricsRetrySeconds ? now + metricsRetrySeconds * 1000 : 0;
    } catch (error) {
      // Deliberately do not expose upstream bodies, auth headers, URLs or tokens.
      const safe = ['MARKET_FEED_URL is not configured', 'GiftAsset access is not configured', 'Unknown MARKET_PROVIDER'];
      this.error = safe.includes(error.message) || /^Provider HTTP \d+$/.test(error.message) ? error.message : 'Не удалось обновить источник данных';
      this.failures++;
      const waitSeconds = Math.max(Math.min(this.config.pollSeconds * 2 ** Math.min(this.failures, 6), 3600), Math.min(error.retrySeconds || 0, 86400));
      this.nextPollAt = Date.now() + waitSeconds * 1000;
    } finally { this.running = false; }
  }
  start() { if (this.config.mode === 'live') { this.poll().then(()=>{if(!this.research.closed)this.research.scan();}); this.timer = setInterval(() => this.poll().then(()=>this.research.scan()), this.config.pollSeconds * 1000); this.timer.unref(); } }
  stop() { clearInterval(this.timer); this.research.stop(); }
}
