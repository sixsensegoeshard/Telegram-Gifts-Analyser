import { readConfig } from './lib/config.js';
import { createApp } from './lib/app.js';

try {
  const config = readConfig();
  const app = createApp(config);
  await app.start();
  console.log(`Gift Signal · ${config.mode} · http://${config.host}:${app.server.address().port}`);
  let closing = false;
  const shutdown = async () => { if (closing) return; closing = true; await app.close(); process.exit(0); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
} catch (error) { console.error('Startup failed:', error.message); process.exitCode = 1; }
