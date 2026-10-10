import test from 'node:test';
import assert from 'node:assert/strict';
import { quote, portfolio, spreadScenario } from '../lib/analytics.js';
import { demoGifts } from '../lib/demo.js';
import { localAnswer, answer } from '../lib/assistant.js';

const gifts=demoGifts().map(g=>quote(g));
test('portfolio uses per-unit purchase price and quantities',()=>{const p=portfolio([{giftId:'candy-cane',giftName:'Candy Cane',quantity:100,buyPrice:3.1},{giftId:'toy-bear',giftName:'Toy Bear',quantity:2,buyPrice:28}],gifts);assert.equal(p.invested,366);assert.equal(p.value,442.8);assert.equal(p.pnl,76.8);assert.equal(p.roi,20.98);});
test('missing quotes do not silently value holdings at zero',()=>{const p=portfolio([{giftId:'unknown',quantity:2,buyPrice:10}],gifts);assert.equal(p.value,null);assert.equal(p.pnl,null);assert.equal(p.unpriced,1);assert.equal(p.invested,20);});
test('partial portfolio P/L covers priced cost only',()=>{const p=portfolio([{giftId:'toy-bear',quantity:1,buyPrice:28},{giftId:'unknown',quantity:1,buyPrice:100}],gifts);assert.equal(p.value,null);assert.equal(p.pricedValue,31.4);assert.equal(p.pnl,3.4);assert.equal(p.roi,12.14);});
test('stale and future prices suspend score',()=>{const gift=demoGifts()[0];assert.equal(quote(gift,gift.updatedAt+301000).score,null);assert.equal(quote({...gift,updatedAt:gift.updatedAt+60000},gift.updatedAt).score,null);});
test('missing metrics mean low quality, zero factor contribution',()=>{const gift={...demoGifts()[0],sales24h:null,change24h:null,avgSale24h:null};const result=quote(gift);assert.equal(result.quality,'low');assert.equal(result.score,7);});
test('spread scenario includes buy, sell and transfer costs',()=>{const result=spreadScenario(gifts.find(g=>g.id==='toy-bear'),2,1,.5);assert.equal(result.cost,32.21);assert.equal(result.proceeds,31.36);assert.equal(result.hypotheticalNet,-.85);assert.equal(result.executable,false);});
test('all demo scores are bounded and deterministic',()=>{for(const g of gifts){assert.ok(g.score>=0&&g.score<=100);assert.equal(g.score,quote(g,g.updatedAt).score);}});
test('assistant labels demo and explains floor spread limitations',()=>{const text=localAnswer('Где арбитраж?',gifts,[],'demo');assert.match(text,/демонстрационным/);assert.match(text,/переноса/);});
test('AI errors produce an explicitly labeled local fallback',async()=>{const response=await answer({mode:'demo',openaiKey:'fake',openaiModel:'test'},'портфель',gifts,[],async()=>new Response('{}',{status:500}));assert.equal(response.engine,'local');assert.equal(response.fallback,true);assert.match(response.text,/AI временно недоступен/);});
