import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { readConfig } from '../lib/config.js';
import { createApp } from '../lib/app.js';
import { telegramCall } from '../lib/notifications.js';
import { tunnelUrl } from '../lib/tunnel.js';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const runtime = path.join(root, '.runtime');
mkdirSync(runtime, { recursive: true, mode: 0o700 });
const lock = path.join(runtime, 'telegram-local.lock');
const children = [];
let app, ownsLock = false, stopping = false;

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  if (app) await app.close();
  // Bot long polling has a bounded HTTP timeout; allow its finally block to release the lock.
  await Promise.all(children.map(child => new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 40000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  })));
  if (ownsLock) { try { unlinkSync(lock); } catch {} }
  process.exit(code);
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

function launch(command, args, options = {}) {
  const child = spawn(command, args, { cwd: root, ...options });
  children.push(child);
  return child;
}

try {
  if (!process.env.BOT_TOKEN) throw new Error('Заполни BOT_TOKEN в локальном .env');
  try {
    const previous = Number(readFileSync(lock, 'utf8'));
    if (!Number.isSafeInteger(previous) || previous <= 0) throw new Error('Неверный файл блокировки');
    process.kill(previous, 0);
    throw new Error('Локальная Mini App уже запущена');
  } catch (error) {
    if (error.code === 'ESRCH') unlinkSync(lock);
    else if (error.code !== 'ENOENT') throw error;
  }
  const fd = openSync(lock, 'wx', 0o600); closeSync(fd);
  ownsLock = true; writeFileSync(lock, String(process.pid));

  const me = await telegramCall(process.env.BOT_TOKEN, 'getMe', {});
  const expected = process.env.BOT_USERNAME || 'tradingnftgift_bot';
  if (me.username !== expected) throw new Error('Токен относится к другому боту; проверь BOT_USERNAME');
  const webhook = await telegramCall(process.env.BOT_TOKEN, 'getWebhookInfo', {});
  if (webhook.url) throw new Error('У бота установлен webhook; сначала отключи прежний запуск');

  const localPort = Number(process.env.LOCAL_PORT || 3001);
  if (!Number.isInteger(localPort) || localPort < 1024 || localPort > 65535) throw new Error('Неверный LOCAL_PORT');
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(localPort, '127.0.0.1', () => probe.close(resolve));
  });

  const localBinary = path.join(root, '.tools', 'cloudflared');
  const binary = existsSync(localBinary) ? localBinary : 'cloudflared';
  console.log(`Проверен @${me.username}. Создаю HTTPS-туннель…`);
  const tunnel = launch(binary, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${localPort}`, '--protocol', 'http2'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const publicUrl = await new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error('Туннель не выдал адрес за 45 секунд')), 45000);
    const collect = chunk => {
      buffer = (buffer + chunk.toString()).slice(-16000);
      const found = tunnelUrl(buffer);
      if (found) { clearTimeout(timer); resolve(found); }
    };
    tunnel.stdout.on('data', collect); tunnel.stderr.on('data', collect);
    tunnel.once('error', () => { clearTimeout(timer); reject(new Error('Не найден cloudflared. Установи: brew install cloudflared')); });
    tunnel.once('exit', () => { clearTimeout(timer); reject(new Error('HTTPS-туннель завершился')); });
  });
  tunnel.on('exit', () => { if (!stopping) { console.error('HTTPS-туннель остановился'); stop(1); } });

  const mode = process.env.LOCAL_APP_MODE || (process.env.APP_MODE === 'live' ? 'live' : 'preview');
  if (!['live','preview'].includes(mode)) throw new Error('LOCAL_APP_MODE must be live or preview');
  const env = { ...process.env, APP_MODE: mode, HOST: '127.0.0.1', PORT: String(localPort), PUBLIC_URL: publicUrl, DB_PATH: process.env.DB_PATH || path.join(root, 'data', 'telegram-preview.sqlite') };
  app = createApp(readConfig(env));
  await app.start();
  const bot = launch(process.execPath, ['bot.js'], { env, stdio: ['ignore', 'inherit', 'inherit'] });
  bot.once('error', () => { console.error('Не удалось запустить бот'); stop(1); });
  bot.once('exit', () => { if (!stopping) { console.error('Бот остановился'); stop(1); } });
  if (process.platform === 'darwin') {
    const awake = launch('/usr/bin/caffeinate', ['-i'], { stdio: 'ignore' });
    awake.once('error', () => console.warn('Не удалось отключить автоматический сон'));
  }
  writeFileSync(path.join(runtime, 'telegram-local.json'), JSON.stringify({ pid: process.pid, username: me.username, publicUrl, port: localPort, mode, startedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  console.log(`Mini App: ${publicUrl}\nОткрой https://t.me/${me.username}, отправь /start и нажми «Открыть Mini App».\n${mode==='live'?'Подключены реальные данные рынка.':'Цены демонстрационные.'} Закрытие этого процесса или сон компьютера отключит приложение.\nCtrl+C — остановить. При следующем запуске кнопка бота получит новый адрес.`);
} catch (error) {
  // Never print request URLs or error stacks that might contain a bot credential.
  const safe = ['Заполни BOT_TOKEN в локальном .env', 'Неверный файл блокировки', 'Локальная Mini App уже запущена', 'Токен относится к другому боту; проверь BOT_USERNAME', 'У бота установлен webhook; сначала отключи прежний запуск', 'Неверный LOCAL_PORT', 'Туннель не выдал адрес за 45 секунд', 'Не найден cloudflared. Установи: brew install cloudflared', 'HTTPS-туннель завершился'];
  console.error('Не удалось запустить:', safe.includes(error.message) ? error.message : error.status ? `Telegram HTTP ${error.status}` : error.code || error.name);
  await stop(1);
}
