import { normalizePortalsListings } from './portals.js';
import { analyzeListings } from './opportunities.js';

const positive = value => value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value)>0 && Number(value)<1e12 ? Number(value) : null;
export function normalizeCatalog(payload, shortName) {
  const collection = payload?.collections?.[shortName];
  if (!collection) throw new Error('Missing attribute catalog');
  return Object.fromEntries(['models','backdrops','symbols'].map(type=>[type,(collection[type] || []).filter(r=>typeof r.name==='string' && r.name.length<100).map(r=>({name:r.name,floor:positive(r.floor_price)}))]));
}
export function normalizeHistory(payload, collectionId) {
  if (!Array.isArray(payload?.history)) throw new Error('Invalid price history');
  return payload.history.filter(r=>r.collection_id===collectionId && positive(r.floor_price) && Number.isFinite(Date.parse(r.interval_time))).map(r=>({time:Date.parse(r.interval_time),price:Number(r.floor_price),average:positive(r.avg_price),volume:positive(r.total_volume)})).sort((a,b)=>a.time-b.time);
}
export function normalizeAverage(payload) {
  if (!Array.isArray(payload?.points)) throw new Error('Invalid NFT average');
  return {price:positive(payload.avg_price),history:payload.points.filter(r=>positive(r.avg_price) && Number.isFinite(Date.parse(r.ts))).map(r=>({time:Date.parse(r.ts),price:Number(r.avg_price)})).sort((a,b)=>a.time-b.time)};
}

export class ResearchService {
  constructor(market, store, getJson) {
    this.market=market; this.store=store; this.getJson=getJson; this.pending=new Map(); this.closed=false; this.running=false; this.active=0; this.queue=[];
    this.cache=new Map(); this.errors=new Map(); this.retryAt=0; this.startedAt=null;
    for (const row of store.db.prepare("SELECT namespace,payload FROM market_cache WHERE namespace LIKE 'research:%'").all()) {
      try { this.cache.set(row.namespace.slice(9),JSON.parse(row.payload)); } catch {}
    }
  }
  snapshot(id) {
    const value=this.cache.get(id); if (!value) return null;
    const gift=this.market.all().find(g=>g.id===id);
    if (!gift) return null;
    return {...value, candidates:analyzeListings(gift,value.listings,value.catalog,value.averages), error:this.errors.get(id)||null};
  }
  overview() {
    const results=[...this.cache.keys()].map(id=>this.snapshot(id)).filter(Boolean);
    const candidates=results.flatMap(r=>r.candidates).sort((a,b)=>(b.score ?? -1)-(a.score ?? -1));
    return { candidates:candidates.filter(r=>r.gapPct>0).slice(0,120), scanned:results.length, freshScanned:results.filter(r=>Date.now()-r.observedAt<300000 && r.candidates.some(c=>c.fresh)).length,
      listingCount:results.reduce((s,r)=>s+r.listings.length,0), running:this.running, pending:this.pending.size,
      updatedAt:results.length?Math.max(...results.map(r=>r.observedAt)):null, errors:[...this.errors].map(([id,message])=>({id,message})),
      scope:'12 коллекций с наибольшим оборотом; первые 50 объявлений и до 3 моделей в каждой. Другую коллекцию можно проверить вручную.',
      collections:results.map(r=>({id:r.giftId,name:r.name,observedAt:r.observedAt,modelCount:r.catalog.models?.length||0,models:(r.catalog.models||[]).filter(m=>m.floor!==null).sort((a,b)=>a.floor-b.floor).slice(0,8)})),
      assumptions:{buyFee:0,sellFee:5,transfer:0,undercut:1}, supported:!this.market.isDemo && this.market.config.provider==='portals',
      sources:[{name:'Portals',state:results.length?'connected':'pending'},{name:'MRKT',state:'requires-access'},{name:'Gift Charts',state:'requires-access'},{name:'Getgems',state:'requires-key'}] };
  }
  async verify(giftId, id) {
    const candidate=this.snapshot(giftId)?.candidates.find(r=>r.id===id);
    if(!candidate) throw Object.assign(new Error('Сначала открой разбор коллекции'),{status:404});
    const gift=this.market.all().find(g=>g.id===giftId), base=this.market.config.portalsBase.replace(/\/$/,'');
    const payload=await this.getJson(`${base}/nfts/search?offset=0&limit=20&sort_by=price%20asc&status=listed&collection_ids=${gift.providerIds.portals}&filter_by_models=${encodeURIComponent(candidate.model)}`);
    const listing=normalizePortalsListings(payload,gift).results.find(r=>r.id===id && !r.unavailable);
    return {available:!!listing,listing:listing||null,checkedAt:Date.now(),message:listing?'Объявление подтверждено источником':'Объявление не найдено среди 20 самых дешёвых в модели. Возможно, цена изменилась или подарок купили.'};
  }
  async get(id) {
    if (this.closed) return this.snapshot(id);
    if (this.pending.has(id)) return this.pending.get(id);
    const saved=this.cache.get(id);
    if (saved && Date.now()-saved.observedAt<240000) return this.snapshot(id);
    if (Date.now()<this.retryAt) return this.snapshot(id);
    const job=this.load(id).finally(()=>this.pending.delete(id)); this.pending.set(id,job); return job;
  }
  async load(id) {
    if (this.active>=2) await new Promise(resolve=>this.queue.push(resolve));
    if (this.closed) return null;
    this.active++;
    try {
      const gift=this.market.all().find(g=>g.id===id);
      if (this.market.isDemo || !gift?.providerShortName || !gift.fresh) return null;
      const base=this.market.config.portalsBase.replace(/\/$/,''), col=gift.providerIds.portals;
      const get=path=>this.getJson(base+path);
      const outcomes=await Promise.allSettled([
        get(`/nfts/search?offset=0&limit=50&sort_by=price%20asc&status=listed&collection_ids=${col}`),
        get(`/collections/filters?short_names=${encodeURIComponent(gift.providerShortName)}`),
        get(`/collections/${col}/metrics?group_by=hour`),
      ]);
      if (outcomes[0].status==='rejected') throw outcomes[0].reason;
      const observedAt=Date.now();
      let listings=normalizePortalsListings(outcomes[0].value,gift,observedAt).results;
      const catalog=outcomes[1].status==='fulfilled'?normalizeCatalog(outcomes[1].value,gift.providerShortName):{};
      const history=outcomes[2].status==='fulfilled'?normalizeHistory(outcomes[2].value,col):[];
      const warnings=outcomes.map((r,i)=>r.status==='rejected'?['Объявления','Каталог атрибутов','История'][i]+' недоступны':null).filter(Boolean);
      const preliminary=analyzeListings(gift,listings,catalog);
      const models=[...new Set(preliminary.map(r=>r.model))].slice(0,3);
      for (const model of models) {
        if(this.closed) return null;
        try { const result=await get(`/nfts/search?offset=0&limit=20&sort_by=price%20asc&status=listed&collection_ids=${col}&filter_by_models=${encodeURIComponent(model)}`);
          const rows=normalizePortalsListings(result,gift).results.filter(r=>r.model===model);
          listings=[...new Map([...listings,...rows].map(r=>[r.id,r])).values()];
        } catch(e) { if(e.retrySeconds) throw e; warnings.push(`Конкуренты ${model}: неполная выборка`); }
      }
      const averages={};
      const top=analyzeListings(gift,listings,catalog).filter(r=>r.gapPct>0).sort((a,b)=>Number(['research','gap'].includes(b.status))-Number(['research','gap'].includes(a.status)) || (b.score||0)-(a.score||0)).slice(0,3);
      for (const row of top) {
        if(this.closed) return null;
        try { averages[row.id]=normalizeAverage(await get(`/nfts/${row.id}/price/average/detailed?period=7%20days`)); }
        catch(e) { if(e.retrySeconds) throw e; warnings.push('Средняя цена части NFT недоступна'); }
      }
      const result={giftId:id,name:gift.name,observedAt,listings,catalog,history,averages,warnings:[...new Set(warnings)],source:'Portals'};
      if(this.closed) return null;
      this.cache.set(id,result); this.errors.delete(id);
      this.store.db.prepare('INSERT INTO market_cache VALUES(?,?,?) ON CONFLICT(namespace) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at').run('research:'+id,JSON.stringify(result),observedAt);
      return this.snapshot(id);
    } catch(error) {
      this.errors.set(id,'Источник временно недоступен; показан предыдущий снимок');
      if (error.retrySeconds || /HTTP 429/.test(error.message)) this.retryAt=Date.now()+Math.max(60,Math.min(error.retrySeconds||60,86400))*1000;
      return this.snapshot(id);
    } finally { this.active--; this.queue.shift()?.(); }
  }
  async scan() {
    if(this.running || this.closed || this.market.isDemo || this.market.config.provider!=='portals' || Date.now()<this.retryAt) return;
    this.running=true; this.startedAt=Date.now();
    try {
      const gifts=this.market.all().filter(g=>g.fresh).sort((a,b)=>(b.volume24h||0)-(a.volume24h||0)).slice(0,12);
      for (const gift of gifts) { if(this.closed || Date.now()<this.retryAt) break; await this.get(gift.id); }
    } finally {this.running=false;}
  }
  stop() {this.closed=true; for(const resolve of this.queue.splice(0))resolve();}
}
