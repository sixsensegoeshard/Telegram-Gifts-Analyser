import { readConfig } from './lib/config.js';
import { Store } from './lib/store.js';
import { telegramCall, deliverAlerts } from './lib/notifications.js';
import { setupBotProfile, ensureWelcome } from './lib/bot-profile.js';
import { setTimeout as delay } from 'node:timers/promises';
import { openSync, readFileSync, unlinkSync, closeSync } from 'node:fs';

const config = readConfig();
if (config.mode === 'demo' || !config.botToken || !config.publicUrl) throw new Error('Bot requires preview/live mode, BOT_TOKEN and HTTPS PUBLIC_URL');
const store = new Store(config.dbPath);
const lock = `${config.dbPath}.bot.lock`;
try {
  try { const previous = Number(readFileSync(lock, 'utf8')); process.kill(previous, 0); throw new Error('Bot is already running'); }
  catch(error) { if (error.code === 'ESRCH') unlinkSync(lock); else if (error.code !== 'ENOENT') throw error; }
  const fd = openSync(lock, 'wx', 0o600);
  const { writeSync } = await import('node:fs'); writeSync(fd, String(process.pid)); closeSync(fd);
} catch(error) { store.close(); throw error; }
let active = true;
const stop = () => { active = false; };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
const send = (method, payload) => telegramCall(config.botToken, method, payload);
const retries = new Map();
let offset = Number(store.db.prepare("SELECT value FROM bot_state WHERE key='offset'").get()?.value || 0);
console.log('Gift Signal bot started');
try {
  await setupBotProfile(config, send);
  for (const user of store.db.prepare("SELECT id FROM users WHERE alerts_allowed=1 OR EXISTS (SELECT 1 FROM bot_state WHERE key='welcome:' || users.id)").all()) {
    try { await ensureWelcome(store, config, user.id, send); }
    catch (error) { if (error.status === 403) store.db.prepare('UPDATE users SET alerts_allowed=0 WHERE id=?').run(user.id); console.error('Welcome update failed:', error.status || error.name); }
  }
  while (active) {
    try {
      const updates = await send('getUpdates', { offset, timeout: 20, allowed_updates: ['message'] });
      for (const update of updates) {
        const message = update.message;
        if (message?.chat?.type === 'private' && message.from?.id === message.chat.id) {
          const command = message.text?.split(/\s/)[0]?.split('@')[0];
          if (command === '/start') {
            store.user(message.from.id, message.from.first_name || 'Коллекционер');
            store.db.prepare('UPDATE users SET alerts_allowed=1 WHERE id=?').run(message.from.id);
            await ensureWelcome(store, config, message.chat.id, send);
          } else if (command === '/stop') {
            store.db.prepare('UPDATE users SET alerts_allowed=0 WHERE id=?').run(message.from.id);
            await send('sendMessage', { chat_id: message.chat.id, text: 'Доставка уведомлений отключена. /start — включить снова.' });
          }
        }
        offset = update.update_id + 1;
        store.db.prepare("INSERT INTO bot_state VALUES('offset',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(offset));
      }
      await deliverAlerts(store, config, send, Date.now(), retries);
    } catch(error) {
      console.error('Bot request failed:', error.status || error.name);
      if (error.status === 409) { console.error('Another polling process or webhook is active. Stopping.'); break; }
      await delay(Math.max(5, error.retryAfter || 5) * 1000);
    }
  }
} finally { unlinkSync(lock); store.close(); }
