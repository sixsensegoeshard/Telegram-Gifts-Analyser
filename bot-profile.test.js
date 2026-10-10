import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureWelcome, setupBotProfile, botDescription, botShortDescription } from '../lib/bot-profile.js';
import { Store } from '../lib/store.js';
const config={mode:'live',publicUrl:'https://example.com'};
test('Welcome stays pinned without duplicate messages, and updates changed tunnel URL',async()=>{
  const store=new Store(':memory:'),calls=[];
  const send=async(method,payload)=>{calls.push({method,payload});return {message_id:12};};
  try {
    await ensureWelcome(store,config,42,send);await ensureWelcome(store,config,42,send);
    assert.equal(calls.filter(x=>x.method==='sendMessage').length,1);assert.equal(calls.filter(x=>x.method==='pinChatMessage').length,2);
    await ensureWelcome(store,{...config,publicUrl:'https://new.example.com'},42,send);
    assert.equal(calls.filter(x=>x.method==='sendMessage').length,1);
    const edit=calls.find(x=>x.method==='editMessageText');assert.equal(edit.payload.reply_markup.inline_keyboard[0][0].web_app.url,'https://new.example.com');
  }finally{store.close();}
});
test('Deleted welcome is recreated on /start; network failures are retried without duplicates',async()=>{
  const store=new Store(':memory:');let id=10,deleted=false,pins=0;
  const send=async(method)=>{if(method==='pinChatMessage'){pins++;if(deleted){deleted=false;throw Object.assign(new Error('deleted'),{status:400});}}return {message_id:id++};};
  try {const first=await ensureWelcome(store,config,42,send);deleted=true;
    const second=await ensureWelcome(store,config,42,send);assert.notEqual(second,first);assert.equal(pins,3);
    await assert.rejects(()=>ensureWelcome(store,{...config,publicUrl:'https://changed.example.com'},42,async()=>{throw Object.assign(new Error('network'),{status:500});}));
    assert.equal(JSON.parse(store.db.prepare('SELECT value FROM bot_state WHERE key=?').get('welcome:42').value).messageId,second);
  }finally{store.close();}
});
test('Bot descriptions appear before Start and fit Telegram limits',async()=>{
  assert.ok(botDescription.length<=512);assert.ok(botShortDescription.length<=120);
  const calls=[];await setupBotProfile(config,async(method,payload)=>calls.push({method,payload}));
  assert.equal(calls.filter(c=>c.method==='setMyDescription').length,2);
  assert.equal(calls.find(c=>c.method==='setChatMenuButton').payload.menu_button.web_app.url,config.publicUrl);
});
