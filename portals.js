const number = (value, min = 0) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) < 1e12 ? Number(value) : null;
export function safePhoto(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const allowed = url.hostname === 'storage.portal-market.com' || url.hostname === 'nft.fragment.com' || url.hostname === 'storage.googleapis.com' && url.pathname.startsWith('/generate_gifts/');
    return allowed && value.length < 1000 ? url.href : null;
  } catch { return null; }
}
const slug = name => name.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function normalizePortals(payload, observedAt = Date.now()) {
  if (!Array.isArray(payload?.collections) || !payload.collections.length) throw new Error('Invalid Portals collections');
  const ids = new Set();
  const gifts = payload.collections.flatMap(row => {
    if (row.is_premarket || number(row.floor_price, 1e-9) === null) return [];
    if (typeof row.name !== 'string' || !row.name.trim() || row.name.length > 100 || !/^[a-f0-9-]{36}$/.test(row.id || '')) throw new Error('Invalid Portals collection');
    const id = slug(row.name);
    if (!id || ids.has(id)) throw new Error('Duplicate Portals collection');
    ids.add(id);
    const sales = number(row.sales_24h_count), volume = number(row.day_volume);
    return [{ id, name: row.name, updatedAt: observedAt, timestampKind: 'observed', photoUrl: safePhoto(row.photo_url), providerIds: { portals: row.id }, providerShortName: /^[a-z0-9]+$/.test(row.short_name || '') ? row.short_name : null,
      markets: [{ name: 'Portals', floor: Number(row.floor_price), listings: number(row.listed_count) }],
      sales24h: sales, volume24h: volume, avgSale24h: sales > 0 && volume !== null ? volume / sales : null,
      change24h: null, history: [], traits: [], art: 'gift' }];
  });
  if (!gifts.length) throw new Error('No priced Portals collections');
  return gifts;
}

export async function getPortalsCollections(getJson, base) {
  const collections = [];
  const seen = new Set();
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await getJson(`${base}/collections?limit=100&offset=${offset}`);
    if (!Array.isArray(page?.collections) || page.collections.length > 100) throw new Error('Invalid Portals page');
    for (const row of page.collections) {
      if (seen.has(row.id)) throw new Error('Repeated Portals page');
      seen.add(row.id); collections.push(row);
    }
    if (page.collections.length < 100) return normalizePortals({ collections });
  }
  throw new Error('Portals pagination limit reached');
}

export function normalizePortalsListings(payload, gift, observedAt = Date.now()) {
  if (!Array.isArray(payload?.results) || payload.results.length > 100) throw new Error('Invalid Portals listings');
  const results = payload.results.filter(row => row.status === 'listed' && row.collection_id === gift.providerIds?.portals && number(row.price, 1e-9) !== null && /^[a-f0-9-]{36}$/.test(row.id || '') && typeof row.tg_id === 'string' && /^[A-Za-z0-9]+-\d+$/.test(row.tg_id)).map(row => {
    const attributes = Array.isArray(row.attributes) ? row.attributes : [];
    const attribute = type => { const value = attributes.find(a => a.type === type)?.value; return typeof value === 'string' && value.length <= 100 ? value : null; };
    return { id: row.id, giftId: gift.id, name: gift.name, number: number(row.external_collection_number), telegramGiftId: row.tg_id,
      price: Number(row.price), market: 'Portals', model: attribute('model'), backdrop: attribute('backdrop'), symbol: attribute('symbol'), photoUrl: safePhoto(row.photo_url),
      observedAt, listedAt: Number.isFinite(Date.parse(row.listed_at)) ? Date.parse(row.listed_at) : null,
      collectionFloor: gift.fresh === false ? null : gift.floor, premiumPct: gift.fresh !== false && gift.floor > 0 ? (Number(row.price) / gift.floor - 1) * 100 : null,
      marketplaceUrl: `https://t.me/portals/market?startapp=gift_${row.id}`, giftUrl: `https://t.me/nft/${row.tg_id}`,
      // Collection floor is a reference, never a valuation of this model/backdrop.
      unlocksAt: Number.isFinite(Date.parse(row.unlocks_at)) ? Date.parse(row.unlocks_at) : null,
      crafted: !!row.is_crafted, unavailable: !!row.bundle_id || !!row.fiat_purchase_in_progress,
      modelFloor: null, executable: false };
  }).sort((a,b) => a.price - b.price);
  const reportedTotal = number(payload.total_count);
  return { results, total: reportedTotal !== null && reportedTotal >= results.length ? reportedTotal : null, observedAt, market: 'Portals', reference: 'collection-floor', modelComparisonAvailable: false };
}
