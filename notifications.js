import { quote } from './analytics.js';

export async function telegramCall(token, method, payload, fetcher = fetch) {
  const response = await fetcher(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(35000),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    const error = new Error(`Telegram HTTP ${data.error_code || response.status}`);
    error.status = data.error_code || response.status; error.retryAfter = data.parameters?.retry_after;
    throw error;
  }
  return data.result;
}

export function pendingAlerts(store, config, now = Date.now()) {
  if (config.mode !== 'live') return [];
  const cached = store.cachedMarket('live');
  if (!cached) return [];
  const gifts = new Map(cached.gifts.map(g => { const q = quote(g, now, config.staleSeconds); return [g.id, q]; }));
  return store.db.prepare('SELECT a.* FROM alerts a JOIN users u ON u.id=a.user_id WHERE a.triggered_at IS NULL AND u.alerts_allowed=1').all().flatMap(alert => {
    const gift = gifts.get(alert.gift_id);
    if (!gift?.fresh || gift.floor === null) return [];
    const hit = alert.direction === 'above' ? gift.floor >= alert.target : gift.floor <= alert.target;
    return hit ? [{ alert, gift }] : [];
  });
}

export async function deliverAlerts(store, config, send, now = Date.now(), retries = new Map()) {
  for (const { alert, gift } of pendingAlerts(store, config, now)) {
    if ((retries.get(alert.id) || 0) > now) continue;
    try {
      await send('sendMessage', { chat_id: alert.user_id, text: `🔔 ${gift.name}\nФлор ${gift.floor} TON ${alert.direction === 'above' ? '≥' : '≤'} ${alert.target} TON.\nИсточник: Gift Signal. Котировка от ${new Date(gift.updatedAt).toISOString()}.\nЦена предложения, без комиссий.`, reply_markup: { inline_keyboard: [[{ text: 'Открыть аналитику', web_app: { url: config.publicUrl } }]] } });
      store.db.prepare('UPDATE alerts SET triggered_at=?,last_error=NULL WHERE id=? AND triggered_at IS NULL').run(now, alert.id);
      retries.delete(alert.id);
    } catch (error) {
      store.db.prepare('UPDATE alerts SET last_error=? WHERE id=?').run('Не удалось доставить в Telegram', alert.id);
      retries.set(alert.id, now + Math.max(error.retryAfter || 60, 60) * 1000);
      if (error.status === 403) store.db.prepare('UPDATE users SET alerts_allowed=0 WHERE id=?').run(alert.user_id);
    }
  }
}
