import { resaleScenario } from '/economics.js';
const icons = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  market: '<path d="M4 19V9m5 10V5m6 14v-7m5 7V3M2 21h20"/>',
  signals: '<path d="m13 2-9 12h7l-1 8 10-13h-7l0-7Z"/>',
  portfolio: '<rect x="3" y="6" width="18" height="15" rx="3"/><path d="M3 9V5a2 2 0 0 1 2-2h13M15 12h6v5h-6a2 2 0 0 1 0-5Z"/>',
  assistant: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Zm8-2v4m-2-2h4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10M10 22h4"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
  up: '<path d="m4 16 6-6 4 4 6-10m-6 0h6v6"/>', down: '<path d="m4 8 6 6 4-4 6 10m-6 0h6v-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  star: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  refresh: '<path d="M20 7a9 9 0 1 0 1 9M20 2v6h-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  edit: '<path d="m14 5 5 5M4 20l1-6L16 3a2 2 0 0 1 5 5L10 19l-6 1Z"/>',
  export: '<path d="M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6"/>',
  check: '<path d="m5 12 4 4 10-10"/>', list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/>',
  send: '<path d="m3 3 19 8-9 3-3 8-7-19Zm0 0 10 11"/>',
  gift: '<rect x="4" y="10" width="16" height="11" rx="1"/><path d="M12 7v14M3 7h18v4H3V7Zm9 0C3 8 6-2 12 7c6-9 9 1 0 0Z"/>',
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.info}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const num = (value, digits = 2) => value === null || value === undefined ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(value);
const signed = value => value === null || value === undefined ? '—' : (value > 0 ? '+' : '') + num(value);
const change = value => `<span class="change ${value > 0 ? 'up' : value === null || value === undefined || value === 0 ? 'flat' : ''}">${value > 0 ? '↗' : value < 0 ? '↘' : ''} ${signed(value)}${value !== null && value !== undefined ? '%' : ''}</span>`;
const giftImage = gift => gift.photoUrl ? `<img src="${esc(gift.photoUrl)}" alt="${esc(gift.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : `<svg viewBox="0 0 200 200" role="img" aria-label="Иллюстрация ${esc(gift.name)}"><use href="/assets/gifts.svg#${esc(gift.art || 'gift')}"/></svg>`;
const art = (gift, large = false) => `<div class="gift-art ${large ? 'large' : ''}">${giftImage(gift)}</div>`;
const button = (label, action, name, extra = '', primary = false) => `<button type="button" class="button ${primary ? 'primary' : ''}" data-action="${action}" ${extra}>${name ? icon(name) : ''}${label}</button>`;
const routes = [['overview','Сканер'],['market','Рынок'],['signals','Модели'],['portfolio','Портфель'],['assistant','Ассистент']];
const state = { scanner:null, scannerSearch:'', scannerBudget:'', scannerFilter:'positive', scannerSort:'score', token: '', status: null, user: null, gifts: [], me: null, route: 'overview', giftId: null, detail: null, sort: 'volume', search: '', view: 'grid', onlyFavorites: false, portfolioTab: 'portfolio', signalQuality: 'all', range: '24h', messages: [], chatBusy: false, refreshing: false, requestError: '', returnRoute: 'market' };
const main = document.querySelector('#main'), modal = document.querySelector('#modal'), modalContent = document.querySelector('#modal-content');
const tg = window.Telegram?.WebApp;
let modalReturnFocus, toastTimer, detailRequest = 0, offersRequest = 0, offersData = null, offersBudget = '';
const time = value => value ? new Intl.DateTimeFormat('ru-RU', { hour:'2-digit', minute:'2-digit' }).format(value) : '—';

function haptic() { try { if (tg?.initData && tg.isVersionAtLeast?.('6.1')) tg.HapticFeedback?.selectionChanged(); } catch {} }
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3500); }
async function api(endpoint, method = 'GET', data) {
  let response;
  try { response = await fetch('/api/' + endpoint, { method, headers: { ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(25000) }); }
  catch { throw new Error('Нет связи с сервером. Проверь интернет и повтори запрос'); }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Не удалось выполнить запрос');
  return result;
}
const favorite = id => state.me?.favorites.includes(id);
const favoriteButton = id => `<button class="favorite-button ${favorite(id) ? 'selected' : ''}" data-action="favorite" data-id="${esc(id)}" aria-label="${favorite(id) ? 'Убрать из избранного' : 'В избранное'}" aria-pressed="${!!favorite(id)}">${icon('star')}</button>`;
function heading(title, description, actions = '') { return `<div class="page-heading"><div><div class="eyebrow">TELEGRAM GIFTS</div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`; }
function banner() {
  if (state.requestError) return `<div class="demo-banner error">${icon('info')}<span>${esc(state.requestError)}. Показан последний загруженный снимок.</span><button data-action="refresh">Повторить</button></div>`;
  if (state.status?.mode === 'demo') return `<div class="demo-banner">${icon('info')}<span>${state.status.telegramPreview ? 'Проверка в Telegram · цены демонстрационные, портфель твой.' : 'Демо-режим · пример цен и портфеля.'} Котировки не для сделок.</span><button data-action="status">Подробнее</button></div>`;
  if (state.status?.state !== 'online' || state.status.warning) return `<div class="demo-banner error">${icon('info')}<span>${state.status?.state === 'unavailable' ? 'Источник цен пока не подключён.' : 'Источник работает с ограничениями.'} ${esc(state.status?.warning || '')} Устаревшие сигналы приостановлены.</span><button data-action="status">Источники</button></div>`;
  return `<button class="source-strip" data-action="status"><span class="source-dot"></span><b>${esc(state.status.provider)}</b><span>получено ${time(state.status.fetchedAt)}</span>${icon('arrow')}</button>`;
}
function empty(title, description, action = '', name = 'search') { return `<div class="empty-state">${icon(name)}<h2>${title}</h2><p>${description}</p>${action}</div>`; }
function quality(gift) { const labels = { high:'Полные данные', medium:'Частичные данные', low:'Мало данных', stale:'Данные устарели' }; return `<span class="quality"><i class="quality-dot ${gift.quality}"></i>${labels[gift.quality]}</span>`; }

function chart(history, id = 'main', mini = false, period = null) {
  if (!history || history.length < 2) return mini ? '<span class="muted">—</span>' : '<div class="chart-empty">История ещё накапливается.<br>Для графика нужны минимум две котировки.</div>';
  const end = history.at(-1).time, duration = period || (state.range === '7d' ? 7 * 86400000 : 86400000);
  const points = mini ? history : history.filter(p => p.time >= end - duration);
  if (points.length < 2) return '<div class="chart-empty">За выбранный период пока недостаточно котировок.</div>';
  const width = mini ? 80 : 560, height = mini ? 28 : 190, padX = mini ? 1 : 0, padY = mini ? 3 : 15;
  const values = points.map(p => p.price), low = Math.min(...values), high = Math.max(...values), span = high - low || Math.max(high * .02, .001);
  const coords = points.map(p => [padX + (p.time - points[0].time) / (end - points[0].time || 1) * (width - 2 * padX - (mini ? 0 : 46)), height - padY - (mini ? 0 : 22) - (p.price - low) / span * (height - 2 * padY - (mini ? 0 : 22))]);
  const path = coords.map(([x,y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const up = values.at(-1) >= values[0], color = up ? '#94dcb4' : '#e99098';
  if (mini) return `<svg class="mini-chart" viewBox="0 0 80 28" aria-hidden="true"><path d="${path}" fill="none" stroke="${color}" stroke-width="1.6"/></svg>`;
  const timeLabel = time => new Intl.DateTimeFormat('ru-RU', state.range === '7d' ? { day:'numeric', month:'short' } : { hour:'2-digit', minute:'2-digit' }).format(time);
  const area = path + ` L${coords.at(-1)[0]},${height - padY - 22} L0,${height - padY - 22} Z`;
  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="История флора: ${points.length} котировок, от ${num(values[0])} до ${num(values.at(-1))} TON" data-chart="${id}"><defs><linearGradient id="fade-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity=".16"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${[0,1,2].map(i => `<path class="chart-grid" d="M0 ${padY + i * (height - 2 * padY - 22) / 2}H${width - 46}"/><text class="chart-axis" x="${width - 38}" y="${padY + i * (height - 2 * padY - 22) / 2 + 3}">${num(high - span * i / 2)}</text>`).join('')}<path d="${area}" fill="url(#fade-${id})"/><path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" vector-effect="non-scaling-stroke"/><circle cx="${coords.at(-1)[0]}" cy="${coords.at(-1)[1]}" r="3" fill="${color}"/>${[0,.25,.5,.75,1].map(r => `<text class="chart-axis" x="${r * (width - 46)}" y="${height - 2}" text-anchor="${r === 0 ? 'start' : r === 1 ? 'end' : 'middle'}">${timeLabel(points[0].time + (end - points[0].time) * r)}</text>`).join('')}</svg>`;
}
function rangeTabs() { return `<div class="tabs" aria-label="Период графика"><button data-action="range" data-range="24h" class="${state.range === '24h' ? 'active' : ''}" aria-pressed="${state.range === '24h'}">24ч</button><button data-action="range" data-range="7d" class="${state.range === '7d' ? 'active' : ''}" aria-pressed="${state.range === '7d'}">7д</button></div>`; }
function marketTable(gifts, compact = false) {
  return `<div class="panel table-wrap"><table class="market-table"><thead><tr><th>Коллекция</th><th>Флор, TON</th><th>24ч</th><th class="${compact ? 'optional-col' : ''}">Объём, TON</th><th class="optional-col">Спред</th><th class="optional-col">График</th><th><span class="sr-only">Избранное</span></th></tr></thead><tbody>${gifts.map((g,i) => `<tr><td><a class="table-gift" href="#gift/${esc(g.id)}"><span class="rank">${i + 1}</span>${art(g)}<span><b>${esc(g.name)}</b><small>${g.markets.length} маркета${!g.fresh ? ' · устарело' : ''}</small></span></a></td><td>${num(g.floor)}</td><td>${change(g.change24h)}</td><td class="${compact ? 'optional-col' : ''}">${num(g.volume24h, 0)}</td><td class="optional-col">${g.spreadPct === null ? '—' : num(g.spreadPct) + '%'}</td><td class="optional-col">${chart(g.history, `mini-${i}`, true)}</td><td>${favoriteButton(g.id)}</td></tr>`).join('')}</tbody></table></div>`;
}
function scannerCandidates() {
  return (state.scanner?.candidates || []).filter(r=> `${r.name} ${r.model} ${r.backdrop} ${r.number}`.toLowerCase().includes(state.scannerSearch.toLowerCase()) && (!state.scannerBudget || r.price<=Number(state.scannerBudget)) && (state.scannerFilter==='all' || state.scannerFilter==='positive' && ['research','gap'].includes(r.status) || state.scannerFilter==='history' && r.apiAverage7d!==null && r.status!=='stale')).sort((a,b)=>state.scannerSort==='price'?a.price-b.price:state.scannerSort==='roi'?(b.scenario?.roi??-1e9)-(a.scenario?.roi??-1e9):(b.score??-1)-(a.score??-1));
}
function candidateCard(r) {
  const labels={research:'ЕСТЬ ИСТОРИЧЕСКИЙ ОРИЕНТИР',gap:'РАЗРЫВ В ОБЪЯВЛЕНИЯХ',pass:'МАРЖА НЕ ПОДТВЕРЖДЕНА',stale:'СНИМОК УСТАРЕЛ'};
  return `<article class="deal-card ${r.status}"><div class="deal-top"><span class="deal-state">${labels[r.status]}</span><span class="deal-age">${time(r.observedAt)}</span></div><div class="deal-identity">${art(r,true)}<div><h2>${esc(r.name)} <small>#${num(r.number,0)}</small></h2><b>${esc(r.model)}</b><p>${esc(r.backdrop)} · ${esc(r.symbol)}</p></div></div><div class="deal-numbers"><div><span>Купить · TON</span><strong>${num(r.price,4)}</strong></div><div><span>Следующая цена</span><strong>${num(r.nextAsk,4)}</strong></div><div class="deal-profit"><span>Сценарий после затрат</span><strong class="${r.scenario?.net>0?'up-text':'muted'}">${r.scenario?signed(r.scenario.net):'—'} <small>TON</small></strong></div></div><div class="deal-evidence"><span>${r.apiAverage7d!==null?'Средняя API / 7д: '+num(r.apiAverage7d,4)+' TON':'Историческая цена не получена'}</span><span>${r.peerCount} конкурентов в выборке · ${num(r.collectionSales24h,0)} продаж коллекции / 24ч</span></div><div class="deal-bottom"><span class="deal-score">${r.score??'—'}<small>/100 · приоритет проверки</small></span>${button('Разобрать','candidate','arrow',`data-id="${r.id}" data-gift="${r.giftId}"`)}</div></article>`;
}
function scannerResults() {
  const candidates=scannerCandidates();
  return `<div class="result-label">${candidates.length} кандидатов по фильтру · оценка объявления, не заявка покупателя</div>`+(candidates.length?`<div class="deals-grid">${candidates.map(candidateCard).join('')}</div>`:empty(state.scanner?.running?'Сканируем рынок…':'Под этот фильтр кандидатов нет',state.scanner?.running?'Проверяем объявления, модели и историю. Первые результаты появятся автоматически.':'Попробуй все разрывы цен, увеличь бюджет или открой нужную коллекцию на рынке.',button('Все разрывы','scanner-filter','list','data-filter="all"'),'signals'));
}
function overview() {
  const scan=state.scanner, valid=(scan?.candidates||[]).filter(r=>['gap','research'].includes(r.status)).length;
  return heading('Найди вход дешевле','Конкретный подарок. Сопоставимые цены. Экономика перепродажи.',button('Как отбираем','methodology','info')+button('Обновить','refresh','refresh'))+banner()+`
    <div class="scan-summary"><div><span class="scan-live ${scan?.running?'scanning':''}"></span><b>${scan?.running?'Сканер работает':'Последняя проверка'}</b><span>${time(scan?.updatedAt)}</span></div><div><strong>${scan?.listingCount||0}</strong><span>объявлений</span></div><div><strong>${scan?.freshScanned||0}</strong><span>свежих коллекций</span></div><div><strong>${valid}</strong><span>кандидатов с маржой*</span></div></div>
    <div class="scanner-controls"><label class="search-field">${icon('search')}<span class="sr-only">Поиск кандидата</span><input id="scanner-search" type="search" value="${esc(state.scannerSearch)}" placeholder="Подарок, модель, фон или номер"></label><label class="budget-field"><span>Бюджет, TON</span><input id="scanner-budget" type="number" min="0" step="any" placeholder="Любой" value="${esc(state.scannerBudget)}"></label><label class="sort-field"><span>Сортировать</span><select id="scanner-sort"><option value="score" ${state.scannerSort==='score'?'selected':''}>Приоритет проверки</option><option value="roi" ${state.scannerSort==='roi'?'selected':''}>Маржа сценария</option><option value="price" ${state.scannerSort==='price'?'selected':''}>Цена входа</option></select></label></div>
    <div class="scanner-filters filter-scroll">${[['positive','С положительной маржой'],['all','Все разрывы цен'],['history','Есть история цены']].map(([key,label])=>`<button class="filter ${state.scannerFilter===key?'active':''}" data-action="scanner-filter" data-filter="${key}" aria-pressed="${state.scannerFilter===key}">${label}</button>`).join('')}</div>
    <p class="scenario-caption">* Допущения: комиссия 5% · отступ цены 1% · покупка и перенос 0. Настройки меняются в разборе.</p>
    ${scan?.errors?.length?`<p class="scan-warning">${scan.errors.length} коллекций не удалось обновить. Старые снимки исключены из активных кандидатов.</p>`:''}<div id="scanner-results">${scannerResults()}</div><div class="scan-footer"><span>${esc(scan?.scope||'Сканер доступен при подключении реальных данных Portals.')}</span><button class="text-link" data-action="status">Покрытие источников ${icon('info')}</button></div>`;
}

const sortOptions = [['volume','Объём'],['floor','Флор'],['growth','Рост'],['decline','Падение'],['spread','Спред']];
function filteredGifts() {
  let gifts = state.gifts.filter(g => g.name.toLowerCase().includes(state.search.toLowerCase()) && (!state.onlyFavorites || favorite(g.id)));
  const metric = { volume:'volume24h',floor:'floor',growth:'change24h',decline:'change24h',spread:'spreadPct' }[state.sort];
  return gifts.sort((a,b) => a[metric] === null || a[metric] === undefined ? b[metric] === null || b[metric] === undefined ? a.name.localeCompare(b.name) : 1 : b[metric] === null || b[metric] === undefined ? -1 : ['floor','decline'].includes(state.sort) ? a[metric] - b[metric] : b[metric] - a[metric]);
}
function giftGrid(gifts) {
  return `<div class="gift-grid">${gifts.map(g => `<article class="gift-card"><a href="#gift/${g.id}" class="gift-card-art">${giftImage(g)}</a>${favoriteButton(g.id)}<div class="gift-card-info"><h3><a href="#gift/${g.id}">${esc(g.name)}</a></h3><div class="gift-card-price"><strong>${num(g.floor)}<small>TON</small></strong>${change(g.change24h)}</div><div class="gift-card-stats"><span>${num(g.sales24h,0)} продаж / 24ч</span><span>${g.markets.length>1 ? num(g.spreadPct,1) + '% спред' : 'Portals'}</span></div>${!g.fresh ? '<div class="position-note down-text">Котировка устарела</div>' : ''}</div></article>`).join('')}</div>`;
}
function marketResults() {
  const gifts = filteredGifts();
  return `<div class="result-label">${gifts.length} коллекций · цены в TON${state.status.listings?' · реальные предложения Portals':' · спред до комиссий'}</div>` + (gifts.length ? state.view === 'grid' ? giftGrid(gifts) : marketTable(gifts) : empty(state.onlyFavorites ? 'Здесь будет твоё избранное' : 'Коллекции не найдены', state.onlyFavorites ? 'Нажми на звезду у подарка, чтобы добавить его на радар.' : 'Попробуй другое название или проверь подключение источника.'));
}
function marketPage() {
  return heading('Рынок подарков',state.status.listings?'Открой коллекцию и выбери конкретный NFT.':'Найди коллекцию. Сравни цены на маркетах.',button('Обновить','refresh','refresh')) + banner() + `<div class="toolbar"><label class="search-field">${icon('search')}<span class="sr-only">Поиск коллекции</span><input id="market-search" type="search" placeholder="Поиск подарка…" value="${esc(state.search)}" maxlength="100" autocomplete="off"></label><div class="view-switch"><button data-action="view" data-view="grid" class="${state.view==='grid'?'active':''}" aria-label="Сетка" aria-pressed="${state.view==='grid'}">${icon('overview')}</button><button data-action="view" data-view="list" class="${state.view==='list'?'active':''}" aria-label="Таблица" aria-pressed="${state.view==='list'}">${icon('list')}</button></div><div class="filter-scroll" aria-label="Сортировка рынка">${sortOptions.map(([key,label])=>`<button class="filter ${state.sort===key&&!state.onlyFavorites?'active':''}" data-action="sort" data-sort="${key}" aria-pressed="${state.sort===key&&!state.onlyFavorites}">${label}</button>`).join('')}<button class="filter ${state.onlyFavorites?'active':''}" data-action="favorites-filter" aria-pressed="${state.onlyFavorites}">☆ Избранное</button></div></div><div id="market-results">${marketResults()}</div>`;
}
function signalsPage() {
  const collections=state.scanner?.collections || [];
  return heading('Цена начинается с модели','Флоры атрибутов внутри коллекции. Редкость сама по себе не определяет спрос.',button('Факторы цены','price-factors','info'))+banner()+ (collections.length?`<div class="model-grid">${collections.map(c=>`<section class="panel model-panel"><div class="panel-heading"><div><h2>${esc(c.name)}</h2><p>${c.modelCount} моделей · получено ${time(c.observedAt)}</p></div><a class="text-link" href="#gift/${c.id}">${icon('arrow')}</a></div><div class="model-rows">${c.models.map(m=>`<div><span>${esc(m.name)}</span><b>${num(m.floor,4)} <small>TON</small></b></div>`).join('')}</div><a class="model-all" href="#gift/${c.id}">Разбор коллекции ${icon('arrow')}</a></section>`).join('')}</div>`:empty('Модели ещё загружаются','Открой коллекцию на рынке, чтобы запросить её атрибуты.'));
}

function portfolioPage() {
  const p = state.me.portfolio;
  const rows = p.positions.map(row => `<div class="portfolio-row"><a href="#gift/${esc(row.giftId)}">${art(row.gift,true)}</a><div class="position-details"><h3><a href="#gift/${esc(row.giftId)}">${esc(row.gift.name)}</a> <small>×${num(row.quantity,0)}</small></h3><p>Куплено ${num(row.buyPrice)} → флор ${num(row.gift.floor)} TON</p><div class="position-note">${esc(row.purchasedAt)}${row.gift.fresh === false ? ' · котировка устарела' : ''}</div></div><div class="position-metrics"><b>${num(row.value)} <small>TON</small></b><small class="${row.pnl >= 0 ? 'up-text' : 'down-text'}">P/L ${signed(row.pnl)} TON</small><div>${change(row.roi)}</div></div><button class="icon-button" data-action="edit-position" data-id="${esc(row.id)}" aria-label="Редактировать ${esc(row.gift.name)}">${icon('edit')}</button><button class="icon-button" data-action="delete-position" data-id="${esc(row.id)}" aria-label="Удалить ${esc(row.gift.name)}">${icon('trash')}</button></div>`).join('');
  return heading('Твой портфель','Покупки, текущая оценка и результат.',button('Экспорт','export','export', 'title="Скачать CSV"') + button('Добавить','add-position','plus','',true)) + banner() +
    `<div class="portfolio-toolbar"><div class="filter-scroll"><button class="filter ${state.portfolioTab==='portfolio'?'active':''}" data-action="portfolio-tab" data-tab="portfolio" aria-pressed="${state.portfolioTab==='portfolio'}">Портфель</button><button class="filter ${state.portfolioTab==='watchlist'?'active':''}" data-action="portfolio-tab" data-tab="watchlist" aria-pressed="${state.portfolioTab==='watchlist'}">Избранное и уведомления</button></div></div>` +
    (state.portfolioTab === 'portfolio' ? `<section class="portfolio-hero"><div><div class="hero-label">Оценка по текущему флору</div><div class="metric-value">${num(p.value)} <small>TON</small></div><div class="hero-label">${p.positions.length} позиций · ${p.positions.reduce((a,r)=>a+r.quantity,0)} подарков${p.stale ? ' · есть устаревшие цены' : ''}</div></div><div class="portfolio-breakdown"><div><span>Вложено</span><strong>${num(p.invested)}</strong><small> TON</small></div><div><span>P/L ${p.unpriced?'оценённых':''}</span><strong class="${p.pnl>=0?'up-text':'down-text'}">${signed(p.pnl)}</strong><small> TON</small></div><div><span>ROI</span><strong class="${p.roi>=0?'up-text':'down-text'}">${signed(p.roi)}${p.roi!==null?'%':''}</strong></div></div></section>${p.unpriced?`<div class="info-note">Для ${p.unpriced} позиций нет цены. Полная стоимость портфеля не вычисляется; P/L показан только для оценённых позиций.</div>`:''}<div class="section-heading"><h2>Мои подарки</h2><small>Ручной учёт покупок</small></div><div class="panel">${rows || empty('Добавь первую покупку','Укажи количество подарков и цену за один. Портфель сохранится после перезапуска.',button('Добавить подарок','add-position','plus','',true),'portfolio')}</div><div class="info-note">Оценка по минимальному флору коллекции. Атрибуты конкретного подарка, комиссии и фактическая цена продажи не учтены. P/L — нереализованный результат.</div>` : `<div class="section-heading"><h2>Избранное</h2><small>${state.me.favorites.length} коллекций</small></div>${state.me.favorites.length ? giftGrid(state.gifts.filter(g=>favorite(g.id))) : empty('Собери свой радар','Добавляй коллекции через звезду на рынке.', '<a class="button" href="#market">Открыть рынок</a>','star')}<div class="section-heading"><h2>Ценовые уведомления</h2>${button('Создать','add-alert','plus')}</div><div class="panel">${alertsMarkup()}</div><div class="info-note">${state.status.mode==='demo'?'В демо условия сохраняются, сообщения в Telegram не отправляются.':state.me.user.alertsAllowed?'Бот отправит уведомление один раз, когда свежий флор выполнит условие. /stop отключает доставку.':'Для доставки нажми /start в своём боте. До этого уведомления сохраняются, но отправка приостановлена.'}</div>`);
}

function alertsMarkup() {
  return state.me.alerts.length ? `<div class="calculator">${state.me.alerts.map(a => { const gift = state.gifts.find(g=>g.id===a.giftId) || { name:a.giftId,art:'gift' }; return `<div class="alert-row">${art(gift)}<div class="gift-label"><b>${esc(gift.name)}</b><small>Флор ${a.direction==='above'?'≥':'≤'} ${num(a.target)} TON · ${a.triggeredAt?'отправлено':state.status.mode==='demo'?'демо':state.me.user.alertsAllowed?'ожидание':'доставка на паузе'}</small>${a.lastError?`<small class="down-text">${esc(a.lastError)}</small>`:''}</div><button class="icon-button" data-action="delete-alert" data-id="${esc(a.id)}" aria-label="Удалить уведомление">${icon('trash')}</button></div>`; }).join('')}</div>` : empty('Не пропускай нужную цену','Задай порог флора для коллекции. Одно условие — одно уведомление.',button('Создать уведомление','add-alert','bell'),'bell');
}

function detailPage() {
  const g = state.detail;
  if (!g || g.id !== state.giftId) return `<button class="back-link" data-action="back">${icon('back')}Назад</button><div class="loading-state"><span class="loader"></span><p>Загружаем коллекцию…</p></div>`;
  return `<button class="back-link" data-action="back">${icon('back')}К ${state.returnRoute==='portfolio'?'портфелю':state.returnRoute==='signals'?'сигналам':'рынку'}</button><div class="detail-heading">${art(g,true)}<div><div class="eyebrow">КОЛЛЕКЦИЯ</div><h1>${esc(g.name)}</h1><p>${g.markets.length} маркета · ${quality(g)}</p></div>${favoriteButton(g.id)}</div>${banner()}${state.status.listings?`<div class="research-callout"><div><span class="eyebrow">АНАЛИТИКА КОЛЛЕКЦИИ</span><h2>Найти вход в ${esc(g.name)}</h2><p>Модели, конкуренты, история и экономика перепродажи.</p></div>${button('Анализировать','research','signals',`data-id="${g.id}"`,true)}</div>`:''}${!g.fresh?'<div class="info-note down-text">Эта котировка устарела. Сигнал приостановлен.</div>':''}<div class="detail-grid"><section class="panel detail-chart"><div class="detail-floor"><small>Минимальный флор коллекции</small><div class="metric-value">${num(g.floor)} <small>TON</small></div><div>${change(g.change24h)} <small>за 24 часа</small></div></div><div class="panel-heading"><h2>История флора</h2>${rangeTabs()}</div><div class="chart-wrap">${chart(g.history,'detail')}</div><div class="detail-stats"><div><small>Продажи / 24ч</small><b>${num(g.sales24h,0)}</b></div><div><small>Скорость / час</small><b>${num(g.velocity)}</b></div><div><small>Средняя продажа</small><b>${num(g.avgSale24h)} TON</b></div></div><div class="chart-footer"><span>${state.status.mode==='demo'?'Демонстрационная история':esc(g.historySource || 'История наблюдений')}</span><span>Получено ${time(g.updatedAt)}</span></div></section><div><section class="panel"><div class="panel-heading"><h2>Флоры маркетов</h2><span class="muted">TON</span></div><div class="market-prices">${g.markets.map((m,i)=>`<div class="market-price-row"><span class="market-logo">${esc(m.name.slice(0,1))}</span><span>${esc(m.name)}</span>${i===0?'<span class="best-label">МИН. ФЛОР</span>':''}<b>${num(m.floor)}</b></div>`).join('')}<div class="position-note">Разница флоров ${num(g.spreadTon)} TON · ${num(g.spreadPct)}%</div></div></section>${g.markets.length>1?`<section class="panel calculator" id="calculator-panel"><h2>Сценарий со спредом</h2><p>Сравнение цен предложения, без гарантии продажи.</p><form id="calculator-form"><div class="calculator-fields"><div class="field"><label for="buy-fee">Покупка, %</label><input id="buy-fee" name="buyFee" type="number" value="0" min="0" max="100" step=".1"></div><div class="field"><label for="sell-fee">Продажа, %</label><input id="sell-fee" name="sellFee" type="number" value="0" min="0" max="100" step=".1"></div><div class="field"><label for="transfer-fee">Перенос, TON</label><input id="transfer-fee" name="transfer" type="number" value="0" min="0" max="100000" step=".01"></div></div>${button('Рассчитать','calculate','market')}</form><div class="calc-result"><span>Разница после затрат</span><strong id="calc-value">${num(g.scenario?.hypotheticalNet)} <small>TON</small></strong></div><p id="calc-note">Комиссии не заданы. Тарифы введи по условиям своих маркетов.</p></section>`:`<div class="info-note">Подключён один маркет. Спред между Portals и MRKT появится после подключения второго источника.</div>`}</div></div><div class="section-heading"><h2>На что обратить внимание</h2>${button('Ценовой алерт','add-alert','bell',`data-id="${g.id}"`)}</div><div class="info-note">${g.reasons.map(esc).join('<br>')}<br>Сравнивай одинаковые модели, фон и узор. Проверь покупателя, доступность переноса и комиссии перед сделкой.</div>${g.traits?.length?`<section class="panel"><div class="panel-heading"><h2>Атрибуты · демонстрация</h2></div><div class="traits">${g.traits.map(t=>`<div class="trait"><small>${esc(t.type)}</small><strong>${esc(t.name)}</strong><p>Флор ${num(t.floor)} TON<br>${t.sales} продаж / 24ч</p></div>`).join('')}</div></section>`:''}`;
}

function assistantPage() {
  return heading('Твой аналитик','Задавай вопросы. Проверяй причины.', `<span class="status-chip"><span class="dot"></span>${state.status.assistant==='openai'?'AI подключён':'Аналитик на правилах'}</span>`) + banner() + `<div class="assistant-layout"><div class="assistant-intro"><div class="assistant-orb">${icon('assistant')}</div><div><h2>Разберём рынок вместе</h2><p>Сравню коллекции, объясню сигналы и посчитаю результат портфеля по данным приложения. ${state.status.assistant==='local'?'Сейчас отвечаю по заданным правилам. Свободный AI-диалог появится после подключения ключа.':'AI получает рыночный снимок и данные портфеля; проверяй выводы по цифрам.'}</p></div></div><div class="quick-questions">${[['signals','Что можно перепродать?','Кандидаты и причины'],['market','Что влияет на цену?','Модель, фон и ликвидность'],['portfolio','Как дела у портфеля?','P/L и текущая оценка']].map(([ic,q,desc])=>`<button class="question-card" data-action="question" data-question="${q}">${icon(ic)}<span>${q}</span><small>${desc}</small></button>`).join('')}</div><div class="chat-log" id="chat-log" aria-live="polite">${chatMarkup()}</div><form class="chat-form" id="chat-form"><label class="sr-only" for="chat-input">Вопрос аналитику</label><input id="chat-input" placeholder="Спроси про подарок или портфель…" maxlength="1500" autocomplete="off" required ${state.chatBusy?'disabled':''}><button class="button primary" type="submit" aria-label="Отправить вопрос" ${state.chatBusy?'disabled':''}>${icon('send')}</button></form><p class="chat-note">Цифры из приложения · без прогнозов прибыли${state.status.mode==='demo'?' · демо-данные':''}</p></div>`;
}
function chatMarkup() { return state.messages.map(m=>`<div class="chat-message ${m.role==='user'?'user':''}">${m.role==='assistant'?`<div class="message-label">${m.engine==='openai'?'GIFT SIGNAL · AI':'GIFT SIGNAL · АНАЛИТИК НА ПРАВИЛАХ'}</div>`:''}${esc(m.text)}</div>`).join('') + (state.chatBusy?'<div class="chat-message"><span class="muted">Анализирую снимок рынка…</span></div>':''); }

function updateNav() {
  const selected = state.route === 'gift' ? state.returnRoute : state.route;
  const markup = routes.map(([key,label])=>`<a class="nav-item ${key===selected?'active':''}" href="#${key}" ${key===selected?'aria-current="page"':''}>${icon(key)}<span>${label}</span>${key==='signals'?`<span class="nav-count">${state.scanner?.scanned || 0}</span>`:''}</a>`).join('');
  document.querySelector('.desktop-nav').innerHTML = markup; document.querySelector('.mobile-nav').innerHTML = markup;
  document.querySelector('#breadcrumb-title').textContent = routes.find(([key])=>key===selected)?.[1] || 'Коллекция';
  document.querySelector('#avatar').textContent = state.user?.name?.slice(0,1) || 'А';
  document.querySelector('#bell-button').innerHTML = icon('bell');
  const chip = document.querySelector('#source-chip'), labels={ demo:'ДЕМО',online:'PORTALS · LIVE',degraded:'ДАННЫЕ С ЗАДЕРЖКОЙ',unavailable:'НЕТ ДАННЫХ' };
  chip.dataset.state=state.requestError?'unavailable':state.status?.state||'unavailable';
  chip.innerHTML = `<span class="dot"></span>${state.requestError?'НЕТ СВЯЗИ':labels[state.status?.state]||'ПОДКЛЮЧЕНИЕ'}`;
}
function render() {
  if (!state.me) return;
  updateNav();
  main.innerHTML = ({ overview,market:marketPage,signals:signalsPage,portfolio:portfolioPage,assistant:assistantPage,gift:detailPage }[state.route] || overview)();
  document.title = `${state.route==='gift'&&state.detail?state.detail.name:routes.find(([r])=>r===state.route)?.[1]||'Обзор'} · Gift Signal`;
  try { if (tg?.initData && tg.isVersionAtLeast?.('6.1') && tg.BackButton) { if (state.route==='gift') tg.BackButton.show(); else tg.BackButton.hide(); } } catch {}
}
async function loadDetail(id, forOverview = false) {
  const request = ++detailRequest;
  try { const detail = await api('gifts/' + id); if (request !== detailRequest) return; state.detail = detail; if (forOverview ? state.route==='overview' : state.route==='gift'&&state.giftId===id) render(); }
  catch(error) { if (!forOverview && request === detailRequest) main.innerHTML = empty('Не удалось открыть коллекцию',error.message,button('К рынку','back','back')); }
}
function navigate() {
  const previous = state.route, raw = location.hash.slice(1) || 'overview';
  const gift = raw.match(/^gift\/([a-z0-9-]+)$/);
  if (gift) { if (previous !== 'gift') state.returnRoute = previous; state.route='gift'; state.giftId=gift[1]; render(); loadDetail(gift[1]); }
  else { state.route=routes.some(([key])=>key===raw)?raw:'overview'; state.giftId=null; state.detail=null; render(); if (state.route==='overview') { const focus=state.gifts.find(g=>g.id==='toy-bear')||state.gifts[0]; if(focus) loadDetail(focus.id,true); } }
  window.scrollTo(0,0); haptic();
}
async function refresh(manual = false) {
  if (state.refreshing) return;
  state.refreshing=true;
  try {
    const [market,me] = await Promise.all([api('market'),api('me')]);
    state.scanner=market.scanner; state.gifts=market.gifts; state.status=market.status; state.me=me; state.requestError='';
    if (state.route==='gift') { state.detail=await api('gifts/'+state.giftId); }
    else if(state.route==='overview' && state.detail) state.detail=await api('gifts/'+state.detail.id);
    if (!modal.open && !['INPUT','SELECT'].includes(document.activeElement.tagName) && state.route!=='assistant') render(); else updateNav();
    if (manual) toast('Снимок данных обновлён');
  } catch(error) { state.requestError=error.message; updateNav(); if (!modal.open && state.route!=='assistant') render(); if (manual) toast(error.message); }
  finally { state.refreshing=false; }
}
function openModal(title, content) {
  modalReturnFocus=document.activeElement;
  modalContent.innerHTML=`<div class="dialog-heading"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Закрыть">${icon('close')}</button></div>${content}`;
  modal.setAttribute('aria-labelledby','dialog-title');
  if(!modal.open) modal.showModal();
}
function closeModal() { activeCandidate=null; candidateVerification=null; offersRequest++; offersData=null; modal.close(); if(modalReturnFocus?.isConnected) modalReturnFocus.focus(); }
async function showOffers(id) {
  const request=++offersRequest, gift=state.gifts.find(g=>g.id===id);
  offersData=null; offersBudget='';
  openModal(esc(gift?.name || 'Предложения'), '<div class="loading-state"><span class="loader"></span><p>Загружаем предложения Portals…</p></div>');
  try {
    const data=await api(`gifts/${id}/listings`);
    if(request!==offersRequest || !modal.open)return;
    offersData=data;
    openModal(esc(gift?.name || 'Предложения'), `<p class="dialog-description offers-note">20 самых дешёвых предложений Portals. Получено ${time(data.observedAt)}. Список может измениться до покупки.</p><div class="field offers-filter"><label for="offers-budget">Бюджет до, TON</label><input id="offers-budget" type="number" min="0" step="any" inputmode="decimal" placeholder="Без ограничения"></div><div id="offers-results" aria-live="polite"></div><p class="info-note">Флор коллекции — только ориентир. Цена модели, фон, комиссии и реальные продажи определяют выгоду. Между маркетами сделки здесь не сравниваются.</p>`);
    renderOffers();
  }catch(error){if(request===offersRequest&&modal.open)openModal('Предложения недоступны', `<p class="dialog-description">${esc(error.message)}</p>${button('Повторить','offers','refresh',`data-id="${esc(id)}"`)}`);}
}
function renderOffers() {
  const el=document.querySelector('#offers-results');if(!el||!offersData)return;
  const budget=offersBudget.trim()===''?Infinity:Number(offersBudget), results=offersData.results.filter(r=>r.price<=budget);
  el.innerHTML=`<p class="result-label">${results.length} из ${offersData.results.length} загруженных${offersData.total!==null?' · на маркете '+num(offersData.total,0):''}</p>`+(results.length?`<div class="offer-list">${results.map(r=>`<article class="offer-card">${art({...r,name:r.name+' #'+r.number})}<div class="offer-info"><h3>${esc(r.name)} <span>#${esc(r.number)}</span></h3><p>${esc(r.model || 'Модель не указана')}</p><small>${esc(r.backdrop||'—')} · ${esc(r.symbol||'—')}</small></div><div class="offer-price"><strong>${num(r.price,4)} <small>TON</small></strong><span>${r.premiumPct===null?'':r.premiumPct<=.01?'На уровне флора':signed(r.premiumPct)+'% к флору'}</span></div><a class="button primary offer-open" href="${esc(r.marketplaceUrl)}" target="_blank" rel="noopener noreferrer">Открыть в Portals ${icon('arrow')}</a></article>`).join('')}</div>`:empty('В этом бюджете нет предложений','Увеличь бюджет или выбери другую коллекцию.'));
}
function showStatus() {
  const s=state.status, labels={connected:'Данные подключены',stale:'Снимок устарел','not-connected':'Статистика не подключена','requires-access':'API требует доступ','requires-key':'API требует ключ'};
  openModal('Источники и профиль', `<p class="dialog-description">${s.telegramPreview?'Проверка внутри Telegram. Вход настоящий, цены демонстрационные.':s.mode==='demo'?'Локальная демонстрация. Цены и портфель — примеры.':'Котировки загружаются сервером из источника. Время «получено» означает время нашего запроса; источник может обновляться с задержкой.'}</p><div class="source-list">${(s.sources||[]).map(source=>`<div class="source-card"><span class="market-logo">${esc(source.name[0])}</span><span><b>${esc(source.name)}</b><small class="${source.state==='connected'?'up-text':''}">${labels[source.state]}</small></span></div>`).join('')}</div><div class="status-list"><div class="status-row"><span>Профиль</span><b>${esc(state.user?.name)}</b></div><div class="status-row"><span>Режим</span><b>${s.mode==='demo'?'Демонстрация':'Реальные данные'}</b></div><div class="status-row"><span>Получено</span><b>${time(s.fetchedAt)}</b></div><div class="status-row"><span>Свежие коллекции</span><b>${s.freshCount} / ${s.collectionCount}</b></div><div class="status-row"><span>Ассистент</span><b>${s.assistant==='openai'?'OpenAI':'Аналитик на правилах'}</b></div><div class="status-row"><span>Доставка алертов</span><b>${s.mode==='demo'?'Недоступна в демо':state.me.user.alertsAllowed?'Разрешена пользователем':'Нужен /start в боте'}</b></div></div>${s.error?`<p class="form-error">${esc(s.error)}</p>`:''}<p class="dialog-description">Покупки добавляются вручную. История флора и изменение за 24 часа накапливаются с момента подключения. Portals: публичные объявления, флоры атрибутов, часовая история и средняя API для NFT. MRKT и Gift Charts требуют доступ к данным; Getgems — API-ключ. Межмаркетные сделки пока не подтверждаются.</p>${button('Обновить снимок','refresh','refresh')}`);
}
function showScoring() {
  openModal('Что означает score',`<div class="explanation"><p><strong>0–100 — рейтинг внимания к коллекции.</strong> Это прозрачная формула без проверки прогнозной точности. Значение 80 не означает 80% вероятности роста.</p><p>Ликвидность — до 45 баллов: логарифм числа продаж / 24ч, максимум при 500 продажах.<br>Рост — до 30: от 0 до +15% / 24ч.<br>Флор ниже средней продажи — до 15: от 0 до 20% скидки.<br>Покрытие — до 10: максимум при 3 маркетах.</p><p>Пропущенные метрики дают 0 баллов. Устаревший флор отключает сигнал. «Полные данные» требуют всех четырёх метрик, минимум 30 продаж и двух маркетов.</p><p>Спред показан для сравнения и не увеличивает score. Цены коллекций могут отличаться из-за моделей, фона и узоров.</p></div>`);
}
function positionForm(id) {
  const p=id?state.me.portfolio.positions.find(r=>r.id===id):null;
  const date=p?.purchasedAt||new Intl.DateTimeFormat('en-CA').format(new Date());
  openModal(p?'Редактировать покупку':'Добавить покупку',`<p class="dialog-description">Укажи цену за один подарок. Сумма вложений = цена × количество.</p><form class="dialog-form" id="position-form" data-id="${esc(id||'')}"><div class="field"><label for="position-gift">Коллекция</label><select id="position-gift" name="giftId" required>${state.gifts.map(g=>`<option value="${g.id}" ${g.id===p?.giftId?'selected':''}>${esc(g.name)}</option>`).join('')}</select></div><div class="form-row"><div class="field"><label for="position-quantity">Количество</label><input id="position-quantity" name="quantity" type="number" min="1" max="100000" step="1" value="${p?.quantity||1}" required></div><div class="field"><label for="position-price">Цена за 1, TON</label><input id="position-price" name="buyPrice" type="number" min="0.000000001" max="1000000000" step="any" placeholder="0.00" value="${p?.buyPrice||''}" required></div></div><div class="field"><label for="position-date">Дата покупки</label><input id="position-date" name="purchasedAt" type="date" value="${date}" max="${new Date().toISOString().slice(0,10)}" required></div><p class="form-error" role="alert" id="form-error"></p><button class="button primary" type="submit">${icon('check')}Сохранить покупку</button></form>`);
}
function alertForm(id) {
  openModal('Ценовое уведомление',`<p class="dialog-description">Одно уведомление, когда свежий минимальный флор достигнет порога.${state.status.mode==='demo'?' В демо сообщение не отправляется.':!state.me.user.alertsAllowed?' Сначала напиши /start своему боту для доставки.':''}</p><form class="dialog-form" id="alert-form"><div class="field"><label for="alert-gift">Коллекция</label><select id="alert-gift" name="giftId" required>${state.gifts.map(g=>`<option value="${g.id}" ${g.id===id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></div><div class="form-row"><div class="field"><label for="alert-direction">Условие</label><select id="alert-direction" name="direction"><option value="below">Флор ≤</option><option value="above">Флор ≥</option></select></div><div class="field"><label for="alert-target">Порог, TON</label><input id="alert-target" name="target" type="number" min="0.000000001" max="1000000000" step="any" placeholder="0.00" required></div></div><p class="form-error" role="alert" id="form-error"></p><button class="button primary" type="submit">${icon('bell')}Создать уведомление</button></form>`);
}
function confirmDelete(id) {
  const p=state.me.portfolio.positions.find(r=>r.id===id);
  openModal('Удалить покупку?',`<p class="dialog-description">${esc(p?.gift.name)} × ${num(p?.quantity,0)}. Запись будет удалена из портфеля.</p><button class="button danger-button" data-action="confirm-delete" data-id="${esc(id)}">${icon('trash')}Удалить запись</button>`);
}
async function ask(question) {
  if(state.chatBusy || !question.trim()) return;
  if(state.route!=='assistant') { location.hash='assistant'; await new Promise(resolve=>setTimeout(resolve,0)); }
  state.messages.push({role:'user',text:question.trim()}); state.chatBusy=true; render();
  try { const response=await api('assistant','POST',{message:question.trim()}); state.messages.push({role:'assistant',...response}); }
  catch(error) { state.messages.push({role:'assistant',text:error.message,engine:'local'}); }
  finally { state.chatBusy=false; if(state.route==='assistant'){render(); document.querySelector('#chat-log').lastElementChild?.scrollIntoView({block:'nearest',behavior:'smooth'});} }
}
function exportPortfolio() {
  const safe=value=>{let text=String(value ?? '');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
  const rows=[['Коллекция','Количество','Цена покупки TON','Дата','Оценка TON','P/L TON','ROI %'],...state.me.portfolio.positions.map(p=>[p.gift.name,p.quantity,p.buyPrice,p.purchasedAt,p.value,p.pnl,p.roi])];
  const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(safe).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download='gift-signal-portfolio.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Портфель экспортирован в CSV');
}

document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');if(!target||target.disabled)return;
  const action=target.dataset.action;
  if(!state.me && !['skip','close-modal','reload'].includes(action))return;
  haptic();
  try {
    if(action==='skip'){event.preventDefault();main.focus();}
    if(action==='status')showStatus();
    if(action==='methodology')showMethodology();
    if(action==='price-factors')showPriceFactors();
    if(action==='scanner-filter'){state.scannerFilter=target.dataset.filter;render();}
    if(action==='candidate')await showCandidate(target.dataset.gift,target.dataset.id);
    if(action==='verify-candidate')await verifyCandidate();
    if(action==='research')await showResearch(target.dataset.id);
    if(action==='resale-calc')renderResale();
    if(action==='offers')await showOffers(target.dataset.id);
    if(action==='close-modal')closeModal();
    if(action==='refresh'){await refresh(true);if(modal.open&&modalContent.textContent.includes('Источники и профиль'))showStatus();}
    if(action==='scoring')showScoring();
    if(action==='sort'){state.sort=target.dataset.sort;state.onlyFavorites=false;render();}
    if(action==='view'){state.view=target.dataset.view;render();}
    if(action==='favorites-filter'){state.onlyFavorites=!state.onlyFavorites;render();}
    if(action==='quality'){state.signalQuality=target.dataset.quality;render();}
    if(action==='range'){state.range=target.dataset.range;render();}
    if(action==='portfolio-tab'){state.portfolioTab=target.dataset.tab;render();}
    if(action==='back')location.hash=state.returnRoute==='gift'?'market':state.returnRoute;
    if(action==='add-position'){if(!state.gifts.length)return toast('Для выбора коллекции подключи источник');positionForm();}
    if(action==='edit-position')positionForm(target.dataset.id);
    if(action==='delete-position')confirmDelete(target.dataset.id);
    if(action==='confirm-delete'){target.disabled=true;await api('positions/'+target.dataset.id,'DELETE');closeModal();await refresh();toast('Покупка удалена');}
    if(action==='favorite'){target.disabled=true;const result=await api('favorites/'+target.dataset.id,favorite(target.dataset.id)?'DELETE':'POST');state.me.favorites=result.favorites;render();}
    if(action==='add-alert'){if(!state.gifts.length)return toast('Для алерта нужны коллекции');alertForm(target.dataset.id);}
    if(action==='alerts'){state.portfolioTab='watchlist';if(modal.open)closeModal();if(state.route==='portfolio')render();else location.hash='portfolio';}
    if(action==='delete-alert'){target.disabled=true;await api('alerts/'+target.dataset.id,'DELETE');await refresh();toast('Уведомление удалено');}
    if(action==='question')await ask(target.dataset.question);
    if(action==='explain'){const gift=state.gifts.find(g=>g.id===target.dataset.id);await ask('Объясни сигнал '+gift.name);}
    if(action==='export')exportPortfolio();
    if(action==='calculate'){
      const form=document.querySelector('#calculator-form');if(!form.reportValidity())return;
      const query=new URLSearchParams(new FormData(form));const detail=await api(`gifts/${state.giftId}?${query}`);const s=detail.scenario;
      document.querySelector('#calc-value').innerHTML=s?`${signed(s.hypotheticalNet)} <small>TON</small>`:'—';
      document.querySelector('#calc-value').className=s?.hypotheticalNet>0?'up-text':'down-text';
      document.querySelector('#calc-note').textContent=s?`${s.buy} → ${s.sell}. Только сценарий по флорам: наличие покупателя и перенос не подтверждены.`:'Для сравнения нужны два маркета.';
    }
  }catch(error){toast(error.message);target.disabled=false;}
});
document.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement){const parent=event.target.parentElement;event.target.remove();parent.classList.add('image-fallback');}},true);
document.addEventListener('input',event=>{if(event.target.id==='scanner-search'||event.target.id==='scanner-budget'){state[event.target.id==='scanner-search'?'scannerSearch':'scannerBudget']=event.target.value;document.querySelector('#scanner-results').innerHTML=scannerResults();}if(event.target.closest('#resale-form'))renderResale();if(event.target.id==='offers-budget'){offersBudget=event.target.value;renderOffers();}if(event.target.id==='market-search'){state.search=event.target.value;document.querySelector('#market-results').innerHTML=marketResults();}});
document.addEventListener('submit',async event=>{
  const form=event.target;
  if(!['position-form','alert-form','chat-form','calculator-form'].includes(form.id))return;
  event.preventDefault();
  if(form.id==='resale-form')return renderResale();
  if(form.id==='chat-form')return ask(document.querySelector('#chat-input').value);
  if(form.id==='calculator-form'){document.querySelector('[data-action="calculate"]').click();return;}
  const submit=form.querySelector('[type="submit"]');submit.disabled=true;
  const data=Object.fromEntries(new FormData(form));
  try {
    if(form.id==='position-form'){data.quantity=Number(data.quantity);data.buyPrice=Number(data.buyPrice);await api(form.dataset.id?'positions/'+form.dataset.id:'positions','POST',data);}
    else {data.target=Number(data.target);await api('alerts','POST',data);}
    closeModal();await refresh();toast(form.id==='position-form'?'Покупка сохранена':'Условие уведомления сохранено');
  }catch(error){document.querySelector('#form-error').textContent=error.message;submit.disabled=false;}
});
modal.addEventListener('click',event=>{if(event.target===modal){const rect=modal.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeModal();}});
modal.addEventListener('cancel',()=>{offersRequest++;offersData=null;});
document.addEventListener('change',event=>{if(event.target.id==='scanner-sort'){state.scannerSort=event.target.value;document.querySelector('#scanner-results').innerHTML=scannerResults();}});
window.addEventListener('hashchange',navigate);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
window.addEventListener('online',()=>refresh());

let activeCandidate=null, candidateVerification=null;
const candidateCache=new Map();
function showMethodology() {
  openModal('Как работает отбор',`<div class="explanation"><p><b>1. Найти ценовой разрыв.</b> Берём актуальные объявления внутри одной коллекции и модели. Сам сравниваемый NFT исключаем из конкурентов. Низкие, повторяющиеся и зеркальные номера конкурентов не используем как обычный ориентир.</p><p><b>2. Проверить историческую цену.</b> Для трёх первых кандидатов коллекции запрашиваем среднюю API Portals за 7 дней. Число сделок и состав выборки не раскрываются, поэтому это дополнительный ориентир. Для расчёта берём меньшую из средней и следующей цены.</p><p><b>3. Посчитать затраты.</b> Цена выхода уменьшается на заданный шаг, затем вычитаются комиссия продажи, стоимость покупки и переноса. Настройки по умолчанию: 1%, 5%, 0%, 0 TON. Их можно изменить в карточке.</p><p><b>4. Отделить гипотезу от сделки.</b> Положительная маржа, разрыв от 3% хотя бы два конкурента и от 20 продаж коллекции за сутки дают кандидата. Без свежих данных расчёт приостанавливается через 5 минут. Проверенного покупателя сейчас нет.</p><p><b>Приоритет / 100:</b> до 25 баллов за маржу сценария, 40 за продажи коллекции, 15 за число конкурентов, 15 за исторический ориентир, 5 за точное совпадение атрибутов конкурента. Это порядок проверки, не вероятность прибыли.</p></div>`);
}
function showPriceFactors() {
  openModal('Что влияет на цену подарка',`<div class="factor-list">${[
    ['Коллекция и спрос','Узнаваемость, доступный выпуск и спрос на конкретную коллекцию. Сравниваем оборот, число продаж и предложение.'],
    ['Модель','Внешний вид и востребованность модели важнее одного процента редкости. Используем её собственный флор и конкурентов.'],
    ['Фон и узор','Цвет, сочетание с моделью и редкость могут давать премию. Флоры модели, фона и узора нельзя складывать: это пересекающиеся группы подарков.'],
    ['Номер','Низкие номера, одинаковые цифры и зеркальные комбинации могут оцениваться отдельно. Автоматически премию не придумываем.'],
    ['Ликвидность','Последние сделки и заявки покупателей показывают, есть ли выход. Средняя цена коллекции смешивает разные модели; дорогие объявления могут висеть месяцами.'],
    ['Время и затраты','Скорость изменения цены, комиссии, разблокировка передачи и стоимость переноса меняют итог сделки. Межмаркетный арбитраж требует доступного переноса и реального покупателя.']
  ].map(([title,text],i)=>`<div><span>0${i+1}</span><section><h3>${title}</h3><p>${text}</p></section></div>`).join('')}</div>`);
}
async function showResearch(id) {
  const request=++offersRequest;
  openModal('Разбор коллекции','<div class="loading-state"><span class="loader"></span><p>Сопоставляем объявления, атрибуты и историю…</p></div>');
  try {
    const r=await api(`gifts/${id}/research`);
    if(request!==offersRequest || !modal.open)return;
    for(const c of r.candidates)candidateCache.set(c.id,c);
    const rows=r.candidates.filter(c=>c.gapPct>0).slice(0,8);
    openModal(esc(r.name),`<p class="dialog-description">Portals · ${r.listings.length} объявлений в выборке · получено ${time(r.observedAt)}</p>${r.warnings.length?`<p class="scan-warning">${r.warnings.map(esc).join('. ')}</p>`:''}<h3>История флора · последние сутки</h3><div class="research-chart">${chart(r.history,'research')}</div><h3>Кандидаты на проверку</h3>${rows.length?`<div class="research-candidates">${rows.map(c=>`<button data-action="candidate" data-gift="${id}" data-id="${c.id}">${art(c)}<span><b>${esc(c.model)} #${num(c.number,0)}</b><small>${esc(c.backdrop)} · ${num(c.price,4)} TON</small></span><strong>${c.scenario?signed(c.scenario.net):'—'}<small>TON · сценарий</small></strong>${icon('arrow')}</button>`).join('')}</div>`:'<p class="dialog-description">В выборке пока нет разрывов цен внутри модели.</p>'}<details class="attribute-details"><summary>Все модели и их флоры (${r.catalog.models?.length||0})</summary><div class="model-rows">${(r.catalog.models||[]).sort((a,b)=>(a.floor??Infinity)-(b.floor??Infinity)).map(m=>`<div><span>${esc(m.name)}</span><b>${num(m.floor,4)} TON</b></div>`).join('')}</div></details><p class="info-note">Это статистика Portals. Модель, фон и узор оцениваются отдельно; их флоры не складываются.</p>`);
    const result=await api('opportunities');state.scanner=result;
  }catch(e){if(request===offersRequest && modal.open)openModal('Разбор пока недоступен',`<p class="dialog-description">${esc(e.message)}</p>${button('Повторить','research','refresh',`data-id="${id}"`)}`);}
}
async function showCandidate(giftId,id) {
  const row=(state.scanner?.candidates||[]).find(c=>c.id===id)||candidateCache.get(id);
  if(!row)return showResearch(giftId);
  activeCandidate=row;candidateVerification=null;
  openModal('Экономика перепродажи',`<div class="candidate-header">${art(row,true)}<div><h2>${esc(row.name)} #${num(row.number,0)}</h2><p>${esc(row.model)} · ${esc(row.backdrop)}</p><small>${esc(row.symbol)} · Portals · ${time(row.observedAt)}</small></div></div><div class="candidate-facts"><div><span>Цена входа</span><b id="entry-price">${num(row.price,4)} TON</b></div><div><span>Следующее объявление модели</span><b>${num(row.nextAsk,4)} TON</b></div><div><span>Средняя API для NFT · 7д</span><b>${num(row.apiAverage7d,4)} TON</b></div><div><span>Продажи всей коллекции · 24ч</span><b>${num(row.collectionSales24h,0)}</b></div></div><h3>Настрой сценарий</h3><p class="dialog-description">Ориентир выхода — меньшая из следующей цены и средней API, если она доступна. Комиссии ниже — твои допущения.</p><form id="resale-form" class="resale-fields"><label>Ориентир, TON<input name="target" type="number" min="0.000000001" step="any" value="${row.reference??row.price}"></label><label>Ниже ориентира, %<input name="undercut" type="number" min="0" max="99" step=".1" value="1"></label><label>Покупка, %<input name="buyFee" type="number" min="0" max="100" step=".1" value="0"></label><label>Продажа, %<input name="sellFee" type="number" min="0" max="99" step=".1" value="5"></label><label>Перенос, TON<input name="transfer" type="number" min="0" step=".01" value="0"></label></form><div id="resale-result" aria-live="polite"></div><details class="attribute-details" open><summary>Почему попал в разбор</summary><ul>${row.reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul></details><details class="attribute-details"><summary>Что может помешать перепродаже (${row.risks.length})</summary><ul>${row.risks.map(r=>`<li>${esc(r)}</li>`).join('')}</ul></details><details class="attribute-details"><summary>Конкуренты модели (${row.peerCount}) · полное совпадение ${row.exactPeerCount}</summary><div class="peer-table"><table><thead><tr><th>Номер / фон</th><th>Узор</th><th>TON</th></tr></thead><tbody>${row.peers.map(p=>`<tr><td>#${num(p.number,0)}<small>${esc(p.backdrop)}</small></td><td>${esc(p.symbol)}</td><td>${num(p.price,4)}</td></tr>`).join('')}</tbody></table></div></details>${row.averageHistory.length?`<details class="attribute-details"><summary>История средней API · 7 дней</summary><div class="research-chart">${chart(row.averageHistory,'average',false,7*86400000)}</div><p>Точки — средние за дни, а не отдельные сделки.</p></details>`:''}<div class="candidate-check">${button('Проверить объявление сейчас','verify-candidate','refresh','',true)}<div id="verification-result" aria-live="polite"></div></div>`);
  // No inline handlers: all interactions respect the application CSP.
  renderResale();
}
function renderResale() {
  const form=document.querySelector('#resale-form');if(!form||!activeCandidate)return;
  const values=Object.fromEntries([...new FormData(form)].map(([k,v])=>[k,v.trim()===''?NaN:Number(v)]));
  const price=candidateVerification?.listing?.price??activeCandidate.price;
  const result=resaleScenario(price,values.target,values);
  const fresh=Date.now()-activeCandidate.observedAt<=300000 && activeCandidate.fresh;
  document.querySelector('#resale-result').innerHTML=!fresh?'<p class="scan-warning">Снимок устарел. Повторно проанализируй коллекцию.</p>':!result?'<p class="form-error">Проверь числа: комиссии и отступ должны быть меньше 100%, затраты — неотрицательными.</p>':`<div class="resale-result"><div><span>Цена выставления</span><strong>${num(result.exit,4)} <small>TON</small></strong></div><div><span>Результат сценария</span><strong class="${result.net>0?'up-text':'down-text'}">${signed(result.net)} <small>TON</small></strong></div><div><span>Доходность сценария</span><strong>${signed(result.roi)}<small>%</small></strong></div></div><p class="scenario-caption">Безубыточная цена продажи: ${num(result.breakEven,4)} TON. Покупатель и срок продажи не подтверждены.</p>`;
}
async function verifyCandidate() {
  if(!activeCandidate)return;
  const candidate=activeCandidate,btn=document.querySelector('[data-action="verify-candidate"]');btn.disabled=true;
  try {
    const result=await api(`gifts/${candidate.giftId}/verify/${candidate.id}`);
    if(!modal.open||activeCandidate!==candidate)return;
    candidateVerification=result;
    document.querySelector('#verification-result').innerHTML=result.available?`<p class="verification-ok">${result.listing.price===candidate.price?'Цена подтверждена':'Цена изменилась: '+num(result.listing.price,4)+' TON'}. Проверено ${time(result.checkedAt)}.</p><a class="button primary" href="${esc(result.listing.marketplaceUrl)}" target="_blank" rel="noopener noreferrer">Открыть именно этот NFT ${icon('arrow')}</a>`:`<p class="scan-warning">${esc(result.message)}</p>`;
    if(result.available){document.querySelector('#entry-price').textContent=num(result.listing.price,4)+' TON';renderResale();}
  }catch(e){if(modal.open&&activeCandidate===candidate)document.querySelector('#verification-result').textContent=e.message;}
  finally{if(btn.isConnected)btn.disabled=false;}
}

async function boot() {
  try {
    try {if(tg?.initData){tg.ready();tg.expand();if(tg.isVersionAtLeast?.('6.1')){tg.setHeaderColor('#101215');tg.setBackgroundColor('#101215');tg.BackButton?.onClick(()=>{location.hash=state.returnRoute;});}}}catch{}
    state.status=await api('status');
    if((state.status.mode==='live'||state.status.telegramPreview)&&!tg?.initData){updateNav();main.innerHTML=empty('Открой внутри Telegram','Вход доступен через кнопку мини-апки в твоём боте. Этот адрес в браузере показывает только экран входа.','','portfolio');return;}
    const auth=await api('auth','POST',{initData:tg?.initData||''});state.token=auth.token;state.user=auth.user;
    const [market,me]=await Promise.all([api('market'),api('me')]);state.scanner=market.scanner; state.gifts=market.gifts;state.status=market.status;state.me=me;
    navigate();setInterval(()=>{if(!document.hidden)refresh();},30000);
  }catch(error){main.innerHTML=empty('Не удалось подключиться',error.message,button('Повторить','reload','refresh'));document.querySelector('[data-action="reload"]')?.addEventListener('click',()=>location.reload());}
}
boot();
