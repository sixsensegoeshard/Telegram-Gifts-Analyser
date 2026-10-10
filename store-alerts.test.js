import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../lib/store.js';
import { demoGifts } from '../lib/demo.js';
import { pendingAlerts, deliverAlerts } from '../lib/notifications.js';

test('SQLite restart persists edits and does not reseed deleted demo positions',()=>{const dir=mkdtempSync(path.join(tmpdir(),'gift-store-'));const file=path.join(dir,'db.sqlite');let store=new Store(file);store.seedDemo();store.db.exec('DELETE FROM positions WHERE user_id=1');store.close();store=new Store(file);store.seedDemo();assert.equal(store.positions(1).length,0);assert.deepEqual(store.favorites(1),['toy-bear']);store.close();rmSync(dir,{recursive:true,force:true});});
function setup(){const store=new Store(':memory:');store.user(42,'Test');store.db.prepare('UPDATE users SET alerts_allowed=1 WHERE id=42').run();store.saveMarket('live',demoGifts());store.db.prepare('INSERT INTO alerts(id,user_id,gift_id,direction,target) VALUES(?,?,?,?,?)').run('alert-1',42,'toy-bear','above',30);return store;}
const config={mode:'live',staleSeconds:300,publicUrl:'https://example.com'};
test('alerts only fire for fresh quotes and allowed users',()=>{const store=setup();assert.equal(pendingAlerts(store,config).length,1);assert.equal(pendingAlerts(store,config,Date.now()+400000).length,0);assert.equal(pendingAlerts(store,{...config,mode:'demo'}).length,0);store.db.exec('UPDATE users SET alerts_allowed=0');assert.equal(pendingAlerts(store,config).length,0);store.close();});
test('delivered alert is sent only once and recipient comes from stored owner',async()=>{const store=setup();let sent=0;const send=async(method,payload)=>{sent++;assert.equal(method,'sendMessage');assert.equal(payload.chat_id,42);};await deliverAlerts(store,config,send);await deliverAlerts(store,config,send);assert.equal(sent,1);assert.ok(store.alerts(42)[0].triggeredAt);store.close();});
test('failed delivery retains pending alert and backs off',async()=>{const store=setup();const retries=new Map();let sent=0;const now=Date.now();const send=async()=>{sent++;throw new Error('offline');};await deliverAlerts(store,config,send,now,retries);await deliverAlerts(store,config,send,now+1000,retries);assert.equal(sent,1);assert.equal(store.alerts(42)[0].triggeredAt,null);assert.ok(store.alerts(42)[0].lastError);store.close();});
