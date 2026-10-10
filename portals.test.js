import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePortals, normalizePortalsListings, getPortalsCollections, safePhoto } from '../lib/portals.js';
import { MarketService } from '../lib/provider.js';
import { Store } from '../lib/store.js';
import { readConfig } from '../lib/config.js';

const collectionId='060d4cef-3a21-47e6-98fc-cd338ae0b5e0';
const collection=()=>({id:collectionId,name:'Toy Bear',floor_price:'32.799999999',day_volume:'2983.59',sales_24h_count:84,listed_count:1039,photo_url:'https://storage.portal-market.com/gifts/toybear.png',created_at:'0001-01-01T00:00:00Z'});
const listing=()=>({id:'f182caf7-ba6f-4b7d-adcc-a2805138f651',tg_id:'ToyBear-34996',collection_id:collectionId,external_collection_number:34996,status:'listed',price:'32.8',attributes:[{type:'model',value:'Watermelon'},{type:'backdrop',value:'Dark Lilac'}],photo_url:'https://nft.fragment.com/gift/toybear-34996.medium.jpg'});
const config=()=>({...readConfig({}),mode:'live',provider:'portals',pollSeconds:120});

test('Portals numbers, observation timestamp and unknown 24h change remain honest',()=>{
  const [gift]=normalizePortals({collections:[collection()]},1700000000000);
  assert.equal(gift.id,'toy-bear');assert.equal(gift.markets[0].floor,32.799999999);
  assert.equal(gift.updatedAt,1700000000000);assert.equal(gift.timestampKind,'observed');
  assert.equal(gift.change24h,null);assert.equal(gift.avgSale24h,2983.59/84);
  const incomplete=collection();delete incomplete.sales_24h_count;
  assert.equal(normalizePortals({collections:[incomplete]})[0].sales24h,null);
});
test('Portals pagination includes second page and rejects repeated or malformed pages',async()=>{
  const calls=[];const rows=Array.from({length:100},(_,i)=>({...collection(),id:`${String(i).padStart(8,'0')}-3a21-47e6-98fc-cd338ae0b5e0`,name:`Gift ${i}`}));
  const gifts=await getPortalsCollections(async url=>{calls.push(url);return {collections:calls.length===1?rows:[{...collection(),name:'Last Gift'}]};},'https://example.com/api');
  assert.equal(gifts.length,101);assert.match(calls[1],/offset=100/);
  await assert.rejects(()=>getPortalsCollections(async()=>({collections:rows}),'https://example.com'),/Repeated/);
  assert.throws(()=>normalizePortals({collections:[collection(),collection()]}),/Duplicate/);
});
test('Only HTTPS images on gift CDNs and matching listed NFTs are exposed',()=>{
  for(const url of ['javascript:alert(1)','https://evil.test/x','https://storage.portal-market.com@evil.test/x','https://storage.googleapis.com/private/x'])assert.equal(safePhoto(url),null);
  const gift={...normalizePortals({collections:[collection()]})[0],floor:32.8};
  const data=normalizePortalsListings({results:[listing(),{...listing(),collection_id:'other'},{...listing(),status:'sold'},{...listing(),price:-1}],total_count:10},gift);
  assert.equal(data.results.length,1);assert.equal(data.modelComparisonAvailable,false);assert.equal(data.results[0].modelFloor,null);
  assert.equal(data.results[0].executable,false);assert.match(data.results[0].marketplaceUrl,/^https:\/\/t.me\/portals\/market\?startapp=gift_/);
  assert.equal(data.results[0].model,'Watermelon');assert.equal(data.results[0].premiumPct,0);
});
test('Portals offers share pending requests, cache results, and honor 429 backoff',async()=>{
  const store=new Store(':memory:');let calls=0,fail=false;
  const market=new MarketService(config(),store,async url=>{
    if(url.includes('/collections?'))return Response.json({collections:[collection()]});
    calls++;assert.match(url,/collection_ids=060d4cef/);
    await new Promise(resolve=>setTimeout(resolve,10));
    return fail?new Response('{}',{status:429,headers:{'retry-after':'600'}}):Response.json({results:[listing()],total_count:1});
  });
  try {
    await market.poll();assert.equal(market.status().sources[0].state,'connected');assert.equal(market.status().sources[1].state,'not-connected');
    const [a,b]=await Promise.all([market.listings('toy-bear'),market.listings('toy-bear')]);assert.deepEqual(a,b);assert.equal(calls,1);
    await market.listings('toy-bear');assert.equal(calls,1);
    fail=true;market.listingCache.clear();await assert.rejects(()=>market.listings('toy-bear'),/Portals/);
    await assert.rejects(()=>market.listings('toy-bear'),/позже/);assert.equal(calls,2);
    assert.ok(market.listingCache.get('toy-bear').retryAt>Date.now()+599000);
  }finally{store.close();}
});
test('A failed or absent live source cannot inject demo prices or keep fresh scores forever',async()=>{
  const store=new Store(':memory:');const market=new MarketService(config(),store,async()=>new Response('{}',{status:403}));
  try {await market.poll();assert.equal(market.all().length,0);assert.equal(market.status().state,'unavailable');
    market.gifts=normalizePortals({collections:[collection()]},Date.now()-600000);
    assert.equal(market.all()[0].score,null);assert.equal(market.status().sources[0].state,'stale');
  }finally{store.close();}
});
