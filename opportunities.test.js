import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeListings,resaleScenario,numberTraits} from '../lib/opportunities.js';
import {normalizeAverage,normalizeCatalog,normalizeHistory,ResearchService} from '../lib/research.js';
import {Store} from '../lib/store.js';
const now=Date.now(), gift={id:'toy-bear',fresh:true,sales24h:200};
const row=(id,price,extra={})=>({id,price,giftId:gift.id,name:'Toy Bear',model:'Watermelon',backdrop:'Blue',symbol:'Star',number:12349+Number(id),observedAt:now,unlocksAt:now-10000,...extra});

test('candidate is excluded from reference, duplicates and other models never inflate the gap',()=>{
 const one=row('1',10),rows=[one,one,row('2',12),row('3',14),row('4',999,{model:'Rare'})];
 const result=analyzeListings(gift,rows,{}, {},now).find(r=>r.id==='1');
 assert.equal(result.nextAsk,12);assert.equal(result.peerCount,2);assert.equal(result.gapPct,20);assert.equal(result.executable,false);assert.equal(result.status,'gap');
});
test('historical API average below purchase price rejects apparent listing arbitrage',()=>{
 const r=analyzeListings(gift,[row('1',32.8),row('2',40),row('3',45)],{}, {'1':{price:32.07,history:[]}},now).find(r=>r.id==='1');
 assert.equal(r.status,'pass');assert.ok(r.scenario.net<0);assert.equal(r.reference,32.07);assert.equal(r.averageSampleCount,null);
});
test('stale prices disable net return and priority, not merely a freshness badge',()=>{
 const r=analyzeListings(gift,[row('1',10,{observedAt:now-301000}),row('2',20),row('3',22)],{}, {},now).find(r=>r.id==='1');
 assert.equal(r.status,'stale');assert.equal(r.scenario,null);assert.equal(r.score,null);
});
test('model, backdrop and symbol floors are separate; differing attributes are flagged',()=>{
 const r=analyzeListings(gift,[row('1',10),row('2',20,{backdrop:'Gold'}),row('3',22,{symbol:'Moon'})],{models:[{name:'Watermelon',floor:10}],backdrops:[{name:'Blue',floor:8}],symbols:[{name:'Star',floor:7}]},{},now).find(r=>r.id==='1');
 assert.equal(r.modelFloor,10);assert.equal(r.reference,20);assert.equal(r.exactPeerCount,0);assert.match(r.risks.join(' '),/совпадением/);
});
test('special serials, crafted gifts and unavailable listings cannot inflate comparables',()=>{
 assert.ok(numberTraits(777).length);assert.ok(numberTraits(12321).length);assert.ok(numberTraits(1).length);
 const r=analyzeListings(gift,[row('1',10),row('2',100,{number:777}),row('3',90,{crafted:true}),row('4',80,{unavailable:true})],{}, {},now).find(r=>r.id==='1');
 assert.equal(r.peerCount,0);assert.equal(r.reference,null);assert.equal(r.status,'pass');
});
test('resale math includes both commissions, transfer and price undercut',()=>{
 const r=resaleScenario(10,15,{buyFee:2,sellFee:5,transfer:1,undercut:1});
 assert.equal(r.entry,11.2);assert.equal(r.exit,14.85);assert.equal(r.net,2.9075);assert.equal(r.breakEven,11.7895);
 assert.equal(resaleScenario(10,15,{sellFee:100}),null);assert.equal(resaleScenario(10,NaN),null);assert.equal(resaleScenario(10,15,{transfer:-1}),null);
});
test('catalog is scoped to exact collection short name and history validates collection',()=>{
 const catalog=normalizeCatalog({collections:{toybear:{models:[{name:'Watermelon',floor_price:'32.8'}]},other:{models:[{name:'Watermelon',floor_price:'1'}]}}},'toybear');
 assert.equal(catalog.models[0].floor,32.8);
 assert.throws(()=>normalizeCatalog({collections:{}},'toybear'));
 assert.equal(normalizeHistory({history:[{collection_id:'wrong',floor_price:'1',interval_time:new Date().toISOString()}]},'right').length,0);
 assert.deepEqual(normalizeAverage({avg_price:'0',points:[{ts:'bad',avg_price:'10'}]}),{price:null,history:[]});
});
test('research survives restart and reevaluates freshness, without demo substitution',()=>{
 const store=new Store(':memory:');
 const cached={giftId:gift.id,listings:[row('1',10),row('2',20),row('3',22)],catalog:{},averages:{},observedAt:now,history:[]};
 store.db.prepare('INSERT INTO market_cache VALUES(?,?,?)').run('research:'+gift.id,JSON.stringify(cached),now);
 const market={all:()=>[{...gift,fresh:false}],isDemo:false,config:{provider:'portals'}};
 const service=new ResearchService(market,store,()=>{throw Error('unexpected request');});
 assert.equal(service.snapshot(gift.id).candidates[0].status,'stale');assert.equal(service.overview().scanned,1);
 service.stop();store.close();
});
