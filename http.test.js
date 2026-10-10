import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../lib/app.js';
import { readConfig } from '../lib/config.js';
import { sign } from './helpers.js';
import { demoGifts } from '../lib/demo.js';
import { quote } from '../lib/analytics.js';
import { pendingAlerts } from '../lib/notifications.js';

test('Telegram preview authenticates and isolates users while labeling demo prices',async()=>{
  const config=readConfig({APP_MODE:'preview',BOT_TOKEN:'123456:test-token',PUBLIC_URL:'https://example.com',DB_PATH:':memory:',PORT:'3001'});
  config.dbPath=':memory:';config.port=0;
  let providerRequests=0;
  const app=createApp(config,{fetcher:async()=>{providerRequests++;throw new Error('Preview must not poll');}});
  await app.start();
  const base=`http://127.0.0.1:${app.server.address().port}`;
  const request=async(endpoint,data,token)=>fetch(base+endpoint,{method:data===undefined?'GET':'POST',headers:{Origin:'https://example.com',...(data===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
  try {
    assert.equal((await request('/api/auth',{})).status,401);
    assert.equal((await request('/api/auth',{initData:sign(42).replace('AA_test','AA_bad')})).status,401);
    const a=await(await request('/api/auth',{initData:sign(42)})).json();
    const b=await(await request('/api/auth',{initData:sign(43)})).json();
    assert.equal(a.mode,'demo');assert.equal(a.user.id,42);
    assert.equal(app.store.positions(42).length,0);assert.equal(app.store.positions(1).length,0);
    const market=await(await request('/api/market',undefined,a.token)).json();
    assert.equal(market.status.mode,'demo');assert.equal(market.status.notifications,false);
    assert.ok(market.gifts.length>0);
    const created=await request('/api/positions',{giftId:'toy-bear',quantity:1,buyPrice:20,purchasedAt:'2026-01-01'},a.token);
    assert.equal(created.status,201);assert.equal(app.store.positions(43).length,0);
    const me=await(await request('/api/me',undefined,b.token)).json();assert.equal(me.portfolio.positions.length,0);
    const assistant=await(await request('/api/assistant',{message:'Где самый большой спред?'},a.token)).json();
    assert.match(assistant.text,/демонстрационным/);
    await request('/api/alerts',{giftId:'toy-bear',direction:'above',target:1},a.token);
    app.store.db.prepare('UPDATE users SET alerts_allowed=1 WHERE id=42').run();
    assert.deepEqual(pendingAlerts(app.store,config),[]);assert.equal(providerRequests,0);
  } finally {await app.close();}
});

async function run(fn,live=false){const config={...readConfig(),port:0,dbPath:':memory:',...(live?{mode:'live',botToken:'123456:test-token',publicUrl:'https://example.com'}:{})};const gifts=demoGifts().map(g=>quote(g));const market=live?{all:()=>gifts,detail:id=>gifts.find(g=>g.id===id),status:()=>({mode:'live',state:'online'}),start(){},stop(){}}:undefined;const app=createApp(config,{market});await app.start();const base=`http://127.0.0.1:${app.server.address().port}`;const request=async(endpoint,method='GET',data,token,headers={})=>fetch(base+endpoint,{method,headers:{...(data!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{ }),...headers},...(data!==undefined?{body:JSON.stringify(data)}:{})});try{await fn(request,app);}finally{await app.close();}}
test('HTTP demo CRUD, editing, watchlist, alert and assistant',()=>run(async(request)=>{const auth=await(await request('/api/auth','POST',{})).json();const token=auth.token;const me=await(await request('/api/me','GET',undefined,token)).json();assert.equal(me.portfolio.positions.length,3);const input={giftId:'toy-bear',quantity:3,buyPrice:20,purchasedAt:'2026-01-01'};const created=await request('/api/positions','POST',input,token);assert.equal(created.status,201);const {id}=await created.json();assert.equal((await request('/api/positions/'+id,'POST',{...input,quantity:4},token)).status,200);const p=await(await request('/api/portfolio','GET',undefined,token)).json();assert.equal(p.positions.find(x=>x.id===id).quantity,4);assert.equal((await request('/api/favorites/loot-bag','POST',undefined,token)).status,200);assert.equal((await request('/api/alerts','POST',{giftId:'toy-bear',direction:'below',target:30},token)).status,201);const assistant=await(await request('/api/assistant','POST',{message:'портфель'},token)).json();assert.match(assistant.text,/демонстрационным/);assert.equal((await request('/api/positions/'+id,'DELETE',undefined,token)).status,200);}));
test('HTTP validates JSON, numeric values and dates',()=>run(async(request)=>{const {token}=await(await request('/api/auth','POST',{})).json();for(const input of [{giftId:'toy-bear',quantity:0,buyPrice:20,purchasedAt:'2026-01-01'},{giftId:'toy-bear',quantity:1,buyPrice:'20',purchasedAt:'2026-01-01'},{giftId:'toy-bear',quantity:1,buyPrice:20,purchasedAt:'2026-02-30'},{giftId:'toy-bear',quantity:1,buyPrice:20,purchasedAt:'2099-01-01'}])assert.equal((await request('/api/positions','POST',input,token)).status,400);const bad=await request('/api/auth','POST',{},undefined,{'Content-Type':'text/plain'});assert.equal(bad.status,415);assert.equal((await request('/api/auth','POST',{initData:'x'.repeat(20000)})).status,413);}));
test('HTTP static assets, CSP, unknown paths and secrets protected',()=>run(async(request)=>{const page=await request('/');assert.equal(page.status,200);assert.match(await page.text(),/Gift Signal/);assert.match(page.headers.get('content-security-policy'),/telegram.org/);for(const endpoint of ['/.env','/lib/config.js','/missing','/api/portfolio'])assert.equal((await request(endpoint)).status,endpoint==='/api/portfolio'?401:404);assert.equal((await request('/assets/gifts.svg')).status,200);assert.equal((await request('/api/auth','POST',{},undefined,{Origin:'https://evil.test'})).status,403);assert.equal((await request('/api/auth','POST',{},undefined,{'X-Forwarded-For':'127.0.0.1'})).status,403);}));
test('HTTP live auth rejects forgery and isolates each user',()=>run(async(request,app)=>{assert.equal((await request('/api/auth','POST',{initData:'hash=abc'})).status,401);const a=await(await request('/api/auth','POST',{initData:sign(42)})).json(),b=await(await request('/api/auth','POST',{initData:sign(43)})).json();const created=await request('/api/positions','POST',{giftId:'toy-bear',quantity:1,buyPrice:20,purchasedAt:'2026-01-01'},a.token);const {id}=await created.json();assert.equal((await request('/api/positions/'+id,'DELETE',undefined,b.token)).status,404);assert.equal((await request('/api/positions/'+id,'POST',{giftId:'toy-bear',quantity:1,buyPrice:1,purchasedAt:'2026-01-01'},b.token)).status,404);const me=await(await request('/api/me','GET',undefined,b.token)).json();assert.equal(me.portfolio.positions.length,0);assert.equal((await request('/api/me','GET',undefined,'A'.repeat(43))).status,401);app.store.db.prepare('UPDATE sessions SET expires=? WHERE user_id=?').run(Date.now()-1,42);assert.equal((await request('/api/me','GET',undefined,a.token)).status,401);},true));
test('Real listing route requires Telegram auth and cannot call arbitrary collection URLs',()=>run(async(request,app)=>{
  let calls=0;app.market.listings=async id=>{calls++;assert.equal(id,'toy-bear');return {results:[{price:32.8}],modelComparisonAvailable:false};};
  assert.equal((await request('/api/gifts/toy-bear/listings')).status,401);assert.equal(calls,0);
  const {token}=await(await request('/api/auth','POST',{initData:sign(42)})).json();
  const result=await request('/api/gifts/toy-bear/listings','GET',undefined,token);assert.equal(result.status,200);assert.equal((await result.json()).results[0].price,32.8);
  assert.equal((await request('/api/gifts/https%3A%2F%2Fevil.test/listings','GET',undefined,token)).status,404);assert.equal(calls,1);
},true));
