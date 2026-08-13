// ============================================================================
// Глобальная таблица результатов — общий клиент для всех трёх игр.
//
// Работает только там, где страница знает адрес сервера: window.__lbEndpoint
// ставится в онлайн-версии (блок only-modular в index.html). В раздаваемых
// однофайловых сборках адреса нет — там блок просто не показывается, игра
// ничего никуда не отправляет.
//
// Сервер — Google Apps Script поверх Google Таблицы (server/leaderboard.gs):
//   GET  ?game=НОВОЕДА&limit=10  ->  { ok, top: [{name, score, seed, turns,
//                                                 version, date}] }
//   POST {game, name, line}      ->  { ok, rank, total } | { ok:false, error }
// Строка результата уходит целиком: сервер сам проверяет контрольную сумму
// (тот же djb2-xor, что в records.js) и разбирает счёт из строки — присланное
// отдельным полем число ему не указ.
//
// POST уходит с Content-Type: text/plain — это «простой» запрос без
// CORS-preflight, на который Apps Script отвечать не умеет.
// ============================================================================

export function lbEndpoint() {
  return (typeof window !== 'undefined' && window.__lbEndpoint) || null;
}

export async function lbTop(game, limit = 10) {
  const base = lbEndpoint();
  if (!base) return null;
  const res = await fetch(`${base}?game=${encodeURIComponent(game)}&limit=${limit}`);
  if (!res.ok) throw new Error(`leaderboard ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.top) ? data.top : [];
}

export async function lbSubmit({ game, name, line }) {
  const base = lbEndpoint();
  if (!base) return null;
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ game, name, line }),
  });
  if (!res.ok) throw new Error(`leaderboard ${res.status}`);
  return res.json();
}

// Имя игрока — на устройстве, чтобы не спрашивать каждый раз
const NAME_KEY = 'lb-name';
export function lbName() {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}
export function lbSaveName(name) {
  try { localStorage.setItem(NAME_KEY, String(name).slice(0, 24)); } catch { /* приватный режим */ }
}

/**
 * Живой блок мировой таблицы на финальном экране. Строит DOM внутри root:
 * таблицу топа, ваше место и форму отправки. Отправка — только по кнопке:
 * результат не уходит в сеть без явного действия игрока.
 *
 * opts: { root, t, money, game, line, myScore, submitted, onSubmitted, viewOnly }
 *   viewOnly — только посмотреть топ (кнопка 🏆 в шапке): без формы отправки
 *   t        — переводчик строк игры (ключи lb*)
 *   money    — форматтер счёта
 *   myScore  — счёт этой партии (для подсветки своей строки в топе)
 *   submitted— результат уже отправлялся в этой партии (не слать дважды)
 *   onSubmitted(rank, total) — колбэк после успешной отправки (сохранить флаг)
 */

// Лучшая отправка с этого устройства — чтобы место было видно и при
// повторном открытии финала, и в следующих партиях. Место фиксируется
// на момент отправки: таблица живая, и старое место могло съехать.
const mineKey = (game) => `lb-mine-${game}`;
export function lbMine(game) {
  try { return JSON.parse(localStorage.getItem(mineKey(game))); } catch { return null; }
}
function lbRemember(game, entry) {
  try {
    const prev = lbMine(game);
    if (!prev || entry.score >= prev.score) {
      localStorage.setItem(mineKey(game), JSON.stringify(entry));
    }
  } catch { /* приватный режим */ }
}

export function lbMount({ root, t, money, game, line, myScore, submitted, onSubmitted, viewOnly = false }) {
  if (!root || !lbEndpoint()) return;

  const esc = (s) => String(s).replace(/[&<>"]/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  // Своя строка узнаётся по имени и счёту: сервер в топе строк не помечает.
  const isMine = (r) => {
    const mine = lbMine(game);
    const name = lbName();
    if (!name || r.name !== name) return false;
    return r.score === Math.round(myScore ?? -1) || (mine && r.score === mine.score);
  };

  const tableHtml = (top) => {
    if (!top.length) return `<p class="funding-note">${t('lbEmpty')}</p>`;
    const mine = lbMine(game);
    const inTop = top.some(isMine);
    const rows = top.map((r, i) => `<tr${isMine(r) ? ' class="total"' : ''}>
      <td>${i + 1}</td><td>${esc(r.name)}${isMine(r) ? ` ${t('lbYou')}` : ''}</td>
      <td>${money(r.score)}</td>
      <td>${esc(r.seed ?? '')}</td><td>${esc((r.date ?? '').slice(0, 10))}</td>
    </tr>`);
    // Не дотянули до топа — своя строка дописывается снизу со своим номером,
    // чтобы место было видно, а не только надпись «вы 47-й».
    if (!inTop && mine) {
      rows.push(`<tr class="total"><td>${mine.rank}</td>
        <td>${esc(mine.name)} ${t('lbYou')}</td><td>${money(mine.score)}</td>
        <td></td><td>${esc((mine.date ?? '').slice(0, 10))}</td></tr>`);
    }
    return `<div style="overflow-x:auto"><table class="data">
      <thead><tr><th>#</th><th>${t('lbColPlayer')}</th><th>${t('lbColScore')}</th><th>${t('lbColCode')}</th><th>${t('lbColDate')}</th></tr></thead>
      <tbody>${rows.join('')}</tbody></table></div>`;
  };

  const placeHtml = () => {
    const mine = lbMine(game);
    return mine
      ? `<p class="funding-note">${t('lbYourPlace', {
          score: money(mine.score), rank: mine.rank, total: mine.total,
        })}</p>` : '';
  };

  // Форма стоит выше таблицы и зовёт вписаться: имя подставляется из прошлой
  // отправки на этом устройстве, остаётся одно нажатие.
  const formHtml = viewOnly
    ? ''
    : submitted
    ? `<p class="funding-note">${t('lbAlreadySent')}</p>`
    : `<p class="funding-note" style="margin:2px 0 0">${t('lbInvite')}</p>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">
        <input id="lb-name" type="text" maxlength="24" placeholder="${t('lbNamePlaceholder')}"
          value="${esc(lbName())}"
          style="flex:1;min-width:140px;padding:7px 9px;background:transparent;border:1px solid var(--line);border-radius:6px;color:inherit;font:inherit">
        <button class="btn small primary" id="lb-send" type="button">${t('lbSubmit')}</button>
      </div>
      <p class="funding-note" style="margin-top:4px">${t('lbConsent')}</p>`;

  // В режиме просмотра заголовок не рисуется: блок открывается в модалке,
  // у которой уже есть свой заголовок «Мировая таблица», — не дублируем.
  root.innerHTML = `${viewOnly ? '' : `<h3 style="margin:12px 0 6px">${t('lbTitle')}</h3>`}
    <div id="lb-form">${formHtml}</div>
    <p class="funding-note" id="lb-status"></p>
    <div id="lb-place">${placeHtml()}</div>
    <div id="lb-table" style="margin-top:6px"><p class="funding-note">${t('lbLoading')}</p></div>`;

  const tableEl = root.querySelector('#lb-table');
  const statusEl = root.querySelector('#lb-status');
  const refreshTop = () => lbTop(game)
    .then((top) => { tableEl.innerHTML = tableHtml(top ?? []); })
    .catch(() => { tableEl.innerHTML = `<p class="funding-note">${t('lbError')}</p>`; });

  refreshTop();

  root.querySelector('#lb-send')?.addEventListener('click', async () => {
    const btn = root.querySelector('#lb-send');
    const name = (root.querySelector('#lb-name')?.value ?? '').trim();
    if (!name) { statusEl.textContent = t('lbNameNeeded'); return; }
    lbSaveName(name);
    btn.disabled = true;
    statusEl.textContent = t('lbSending');
    try {
      const out = await lbSubmit({ game, name, line });
      if (out?.ok) {
        statusEl.textContent = t('lbSent', { rank: out.rank, total: out.total });
        lbRemember(game, {
          name, score: Math.round(myScore ?? 0), rank: out.rank, total: out.total,
          date: new Date().toISOString().slice(0, 10),
        });
        root.querySelector('#lb-place').innerHTML = placeHtml();
        root.querySelector('#lb-form').innerHTML = `<p class="funding-note">${t('lbAlreadySent')}</p>`;
        onSubmitted?.(out.rank, out.total);
        refreshTop();
      } else {
        statusEl.textContent = t('lbError');
        btn.disabled = false;
      }
    } catch {
      statusEl.textContent = t('lbError');
      btn.disabled = false;
    }
  });
}
