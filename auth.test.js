import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInitData, RateLimiter } from '../lib/auth.js';
import { readConfig } from '../lib/config.js';

import { sign } from './helpers.js';
test('valid Telegram HMAC including signature field',()=>assert.equal(validateInitData(sign(42,{signature:'ed25519-string'}),'123456:test-token').id,42));
test('modified user and wrong bot token rejected',()=>{assert.throws(()=>validateInitData(sign().replace('AA_test','AA_fake'),'123456:test-token'));assert.throws(()=>validateInitData(sign(),'different-token'));});
test('expired and future initData rejected',()=>{const now=Math.floor(Date.now()/1000);for(const date of [now-7200,now+120])assert.throws(()=>validateInitData(sign(42,{auth_date:String(date)}),'123456:test-token'));});
test('duplicate keys and malformed hash rejected',()=>{assert.throws(()=>validateInitData(sign()+'&auth_date=1','123456:test-token'));assert.throws(()=>validateInitData('hash=00','123456:test-token'));});
test('invalid user ids rejected',()=>{for(const id of [0,-1,'42',1e20])assert.throws(()=>validateInitData(sign(id),'123456:test-token'));});
test('rate limit resets at expiry',()=>{const limiter=new RateLimiter(2,100);assert.ok(limiter.allow('ip',1));assert.ok(limiter.allow('ip',2));assert.equal(limiter.allow('ip',3),false);assert.ok(limiter.allow('ip',101));});
test('unsafe deployment configuration fails closed',()=>{assert.throws(()=>readConfig({APP_MODE:'demo',HOST:'0.0.0.0'}));assert.throws(()=>readConfig({APP_MODE:'live'}));assert.throws(()=>readConfig({APP_MODE:'live',BOT_TOKEN:'token',PUBLIC_URL:'http://example.com'}));});
test('Telegram preview requires credentials and HTTPS, defaults to loopback',()=>{
  assert.throws(()=>readConfig({APP_MODE:'preview'}));
  assert.throws(()=>readConfig({APP_MODE:'preview',BOT_TOKEN:'token',PUBLIC_URL:'http://example.com'}));
  const config=readConfig({APP_MODE:'preview',BOT_TOKEN:'token',PUBLIC_URL:'https://example.com'});
  assert.equal(config.mode,'preview');assert.equal(config.host,'127.0.0.1');
});
