export const botDescription = '🎁 Gift Signal — твой помощник на рынке Telegram Gifts.\n\nСмотри цены подарков, сравнивай предложения и веди свой портфель.\n\nНажми «Начать», затем открой Mini App. Цены предложения не гарантируют продажу или прибыль.';
export const botShortDescription = 'Рынок Telegram Gifts, поиск предложений, портфель и ценовые уведомления в одной Mini App.';

export async function setupBotProfile(config, send) {
  for (const language_code of ['', 'ru']) {
    await send('setMyDescription', { description: botDescription, language_code });
    await send('setMyShortDescription', { short_description: botShortDescription, language_code });
  }
  await send('setMyCommands', { commands: [{ command: 'start', description: 'Открыть приложение' }, { command: 'stop', description: 'Отключить уведомления' }] });
  await send('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Открыть Mini App', web_app: { url: config.publicUrl } } });
}

export async function ensureWelcome(store, config, userId, send) {
  const key = `welcome:${userId}`;
  const previous = store.db.prepare('SELECT value FROM bot_state WHERE key=?').get(key);
  let saved; try { saved = JSON.parse(previous?.value || 'null'); } catch {}
  const payload = {
    chat_id: userId,
    text: '🎁 Gift Signal · терминал подарков\n\nИщи недооценённые NFT и проверяй идею перепродажи по цифрам.\n\n• Сканер — конкретные подарки и разрывы цен внутри модели.\n• Разбор — конкуренты, история и расчёт после затрат.\n• Рынок — флоры, оборот и скорость продаж.\n• Портфель — твои покупки и P/L.\n\n' + (config.mode === 'preview' ? 'Сейчас включена демонстрация.' : 'В каждой карточке указаны источник, время проверки и ограничения оценки.') + '\n\nОткрой терминал кнопкой ниже. Он всегда под рукой в этом закреплённом сообщении.',
    reply_markup: { inline_keyboard: [
      [{ text: 'Открыть Mini App', web_app: { url: config.publicUrl } }],
    ] },
  };
  const content = JSON.stringify(payload);
  let messageId = saved?.messageId;
  if (messageId && saved.content !== content) {
    try { await send('editMessageText', { ...payload, message_id: messageId }); }
    catch (error) { if (error.status !== 400) throw error; messageId = null; }
  }
  if (!messageId) messageId = (await send('sendMessage', payload)).message_id;
  store.db.prepare('INSERT INTO bot_state VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify({ messageId, content }));
  try { await send('pinChatMessage', { chat_id: userId, message_id: messageId, disable_notification: true }); }
  catch (error) {
    if (error.status !== 400) throw error;
    // The saved welcome may have been deleted by the user. Recreate it once.
    messageId = (await send('sendMessage', payload)).message_id;
    store.db.prepare('UPDATE bot_state SET value=? WHERE key=?').run(JSON.stringify({ messageId, content }), key);
    await send('pinChatMessage', { chat_id: userId, message_id: messageId, disable_notification: true });
  }
  return messageId;
}
