import { round } from './analytics.js';

export const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a,b)=>a-b);
  return sorted.length ? (sorted[Math.floor((sorted.length-1)/2)] + sorted[Math.ceil((sorted.length-1)/2)]) / 2 : null;
};
export function numberTraits(number) {
  const s = String(number || '');
  return [number > 0 && number <= 100 ? 'Низкий номер' : null, /^(\d)\1{2,}$/.test(s) ? 'Повторяющиеся цифры' : null,
    s.length >= 4 && s === [...s].reverse().join('') ? 'Зеркальный номер' : null].filter(Boolean);
}
import { resaleScenario } from '../public/economics.js';
export { resaleScenario };

// Listing gaps are hypotheses. Neither an ask nor an API average is a firm buyer.
export function analyzeListings(gift, listings, catalog = {}, averages = {}, now = Date.now()) {
  const unique = [...new Map(listings.map(row=>[row.id,row])).values()];
  return unique.filter(row=>row.model && !row.unavailable && !row.crafted).map(row=>{
    const model = catalog.models?.find(m=>m.name===row.model);
    const backdrop = catalog.backdrops?.find(m=>m.name===row.backdrop);
    const symbol = catalog.symbols?.find(m=>m.name===row.symbol);
    const peers = unique.filter(p=>p.id!==row.id && p.model===row.model && !p.unavailable && !p.crafted && !numberTraits(p.number).length).sort((a,b)=>a.price-b.price);
    const exact = peers.filter(p=>p.backdrop===row.backdrop && p.symbol===row.symbol);
    const nextAsk = peers[0]?.price ?? null;
    const gapPct = nextAsk === null ? null : round((nextAsk-row.price)/row.price*100);
    const average = averages[row.id];
    const avgPrice = average?.price > 0 ? average.price : null;
    // Cap the exit reference by available historic API average, never extrapolate it upwards.
    const reference = nextAsk === null ? null : avgPrice === null ? nextAsk : Math.min(nextAsk,avgPrice);
    const scenario = reference === null ? null : resaleScenario(row.price,reference);
    const fresh = gift.fresh !== false && now-row.observedAt<=300000 && row.observedAt<=now+30000;
    const flags = numberTraits(row.number);
    const reasons = [], risks = [];
    if (nextAsk !== null) reasons.push(`Следующее предложение модели: ${round(nextAsk,4)} TON (${gapPct > 0 ? '+' : ''}${gapPct}%)`);
    if (model?.floor > 0) reasons.push(`Флор модели ${row.model}: ${round(model.floor,4)} TON`);
    if (avgPrice !== null) reasons.push(`Средняя API для NFT за 7 дней: ${round(avgPrice,4)} TON`);
    if (gift.sales24h != null) reasons.push(`${gift.sales24h} продаж коллекции за 24ч · ${round(gift.sales24h/24)} в час`);
    if (!exact.length) risks.push('Нет конкурента с совпадением модели, фона и узора');
    risks.push('Заявка покупателя не проверена; срок перепродажи неизвестен');
    if (avgPrice === null) risks.push('Нет исторического ориентира для этого NFT');
    else risks.push('API не раскрывает число сделок и состав выборки средней цены');
    if (peers.length < 3) risks.push('Мало конкурентов этой модели в выборке');
    if ((gift.sales24h ?? 0) < 20) risks.push('Низкая ликвидность коллекции');
    if (row.unlocksAt === null || row.unlocksAt > now) risks.push(row.unlocksAt > now ? 'Перенос заблокирован до указанной даты' : 'Срок разблокировки переноса неизвестен');
    if (flags.length) risks.push('Номер может иметь премию: отдельная оценка не подтверждена');
    if (!fresh) risks.push('Снимок устарел: расчёт приостановлен');
    const eligible = fresh && scenario?.net > 0 && gapPct >= 3 && peers.length >= 2 && (gift.sales24h ?? 0) >= 20;
    const status = !fresh ? 'stale' : eligible ? avgPrice !== null && exact.length > 0 ? 'research' : 'gap' : 'pass';
    const score = !fresh ? null : Math.round(Math.min(25,Math.max(0,scenario?.roi || 0)*1.5) + Math.min(40,Math.log1p(gift.sales24h || 0)/Math.log(501)*40) + Math.min(15,peers.length*3) + (avgPrice!==null?15:0) + (exact.length?5:0));
    return {...row, fresh, modelFloor:model?.floor ?? null, backdropFloor:backdrop?.floor ?? null, symbolFloor:symbol?.floor ?? null,
      nextAsk, gapPct, peerCount:peers.length, exactPeerCount:exact.length, peerMedian:median(peers.map(p=>p.price)),
      peers:peers.slice(0,8).map(({id,number,price,model,backdrop,symbol})=>({id,number,price,model,backdrop,symbol})),
      apiAverage7d:avgPrice, averageHistory:average?.history || [], averageSampleCount:null,
      collectionSales24h:gift.sales24h, collectionVelocity:gift.sales24h==null?null:round(gift.sales24h/24),
      reference, scenario:fresh?scenario:null, status, score, reasons, risks, numberTraits:flags, executable:false};
  }).sort((a,b)=>(b.scenario?.roi ?? -1e9)-(a.scenario?.roi ?? -1e9));
}
