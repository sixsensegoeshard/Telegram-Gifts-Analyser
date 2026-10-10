export const round = (value, digits = 2) => Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function quote(gift, now = Date.now(), staleSeconds = 300) {
  const markets = (gift.markets || []).filter(m => Number.isFinite(m.floor) && m.floor > 0).sort((a, b) => a.floor - b.floor);
  const floor = markets[0]?.floor ?? null;
  const spreadTon = markets.length >= 2 ? round(markets.at(-1).floor - floor) : null;
  const spreadPct = spreadTon === null ? null : round(spreadTon / floor * 100);
  const fresh = Number.isFinite(gift.updatedAt) && now - gift.updatedAt <= staleSeconds * 1000 && gift.updatedAt <= now + 30000;
  const sales = gift.sales24h ?? null;
  // An attention score, not a probability of profit. Unavailable factors contribute zero.
  const liquidity = sales === null ? 0 : clamp(Math.log1p(sales) / Math.log(501), 0, 1);
  const momentum = gift.change24h === null || gift.change24h === undefined ? 0 : clamp(gift.change24h / 15, 0, 1);
  const discount = gift.avgSale24h && floor ? clamp((gift.avgSale24h - floor) / gift.avgSale24h / 0.2, 0, 1) : 0;
  const coverage = Math.min(markets.length / 3, 1);
  const score = fresh && floor !== null ? Math.round(45 * liquidity + 30 * momentum + 15 * discount + 10 * coverage) : null;
  const measured = [sales, gift.change24h, gift.avgSale24h, floor].filter(v => v !== null && v !== undefined).length;
  const quality = !fresh ? 'stale' : measured === 4 && sales >= 30 && markets.length >= 2 ? 'high' : measured >= 2 ? 'medium' : 'low';
  const reasons = [];
  if (sales !== null) reasons.push(`${sales} продаж за 24 часа по данным источника`);
  if (gift.change24h !== null && gift.change24h !== undefined) reasons.push(`Изменение флора за 24ч: ${gift.change24h > 0 ? '+' : ''}${round(gift.change24h)}%`);
  if (discount > 0) reasons.push(`Флор ниже средней продажи на ${round((gift.avgSale24h - floor) / gift.avgSale24h * 100)}%`);
  if (spreadPct !== null) reasons.push(`Разница флоров между маркетами: ${spreadPct}% — это не исполнимый арбитраж`);
  if (!fresh) reasons.push('Данные устарели. Сигнал приостановлен');
  return { ...gift, markets, floor, spreadTon, spreadPct, fresh, score, quality, reasons, velocity: sales === null ? null : round(sales / 24) };
}

export function portfolio(positions, gifts) {
  const byId = new Map(gifts.map(gift => [gift.id, gift]));
  let invested = 0, value = 0, unpricedCost = 0, unpriced = 0;
  const rows = positions.map(position => {
    const gift = byId.get(position.giftId);
    const cost = round(position.quantity * position.buyPrice);
    invested += cost;
    const current = gift?.floor === null || !gift ? null : round(gift.floor * position.quantity);
    if (current === null) { unpriced++; unpricedCost += cost; } else value += current;
    const pnl = current === null ? null : round(current - cost);
    return { ...position, gift: gift || { id: position.giftId, name: position.giftName, art: 'gift', floor: null }, cost, value: current, pnl, roi: pnl === null || cost === 0 ? null : round(pnl / cost * 100) };
  });
  const pricedCost = invested - unpricedCost;
  const pnl = pricedCost > 0 ? round(value - pricedCost) : null;
  return { positions: rows, invested: round(invested), value: rows.length && !unpriced ? round(value) : null, pricedValue: round(value), pnl, roi: pricedCost > 0 ? round(pnl / pricedCost * 100) : null, unpriced, stale: rows.some(row => row.gift.fresh === false) };
}

export function spreadScenario(gift, sellFeePct = 0, buyFeePct = 0, transferTon = 0) {
  if (gift.markets.length < 2) return null;
  const buy = gift.markets[0], sell = gift.markets.at(-1);
  const cost = buy.floor * (1 + buyFeePct / 100) + transferTon;
  const proceeds = sell.floor * (1 - sellFeePct / 100);
  return { buy: buy.name, sell: sell.name, cost: round(cost), proceeds: round(proceeds), hypotheticalNet: round(proceeds - cost), hypotheticalPct: round((proceeds - cost) / cost * 100), executable: false };
}
