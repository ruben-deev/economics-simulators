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
 * таблицу топа и форму отправки. Отправка — только по кнопке: результат не
 * уходит в сеть без явного действия игрока.
 *
 * opts: { root, t, money, game, line, submitted, onSubmitted }
 *   t        — переводчик строк игры (ключи lb*)
 *   money    — форматтер счёта
 *   submitted— результат уже отправлялся в этой партии (не слать дважды)
 *   onSubmitted(rank, total) — колбэк после успешной отправки (сохранить флаг)
 */
export function lbMount({ root, t, money, game, line, submitted, onSubmitted }) {
  if (!root || !lbEndpoint()) return;

  const esc = (s) => String(s).replace(/[&<>"]/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  const tableHtml = (top) => top.length
    ? `<div style="overflow-x:auto"><table class="data">
        <thead><tr><th>#</th><th>${t('lbColPlayer')}</th><th>${t('lbColScore')}</th><th>${t('lbColCode')}</th><th>${t('lbColDate')}</th></tr></thead>
        <tbody>${top.map((r, i) => `<tr>
          <td>${i + 1}</td><td>${esc(r.name)}</td><td>${money(r.score)}</td>
          <td>${esc(r.seed ?? '')}</td><td>${esc((r.date ?? '').slice(0, 10))}</td>
        </tr>`).join('')}</tbody></table></div>`
    : `<p class="funding-note">${t('lbEmpty')}</p>`;

  const formHtml = submitted
    ? `<p class="funding-note">${t('lbAlreadySent')}</p>`
    : `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px">
        <input id="lb-name" type="text" maxlength="24" placeholder="${t('lbNamePlaceholder')}"
          value="${esc(lbName())}"
          style="flex:1;min-width:140px;padding:7px 9px;background:transparent;border:1px solid var(--line);border-radius:6px;color:inherit;font:inherit">
        <button class="btn small" id="lb-send" type="button">${t('lbSubmit')}</button>
      </div>
      <p class="funding-note" style="margin-top:4px">${t('lbConsent')}</p>`;

  root.innerHTML = `<h3 style="margin:12px 0 6px">${t('lbTitle')}</h3>
    <div id="lb-table"><p class="funding-note">${t('lbLoading')}</p></div>
    <div id="lb-form">${formHtml}</div>
    <p class="funding-note" id="lb-status"></p>`;

  const tableEl = root.querySelector('#lb-table');
  const statusEl = root.querySelector('#lb-status');

  lbTop(game).then((top) => { tableEl.innerHTML = tableHtml(top ?? []); })
    .catch(() => { tableEl.innerHTML = `<p class="funding-note">${t('lbError')}</p>`; });

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
        root.querySelector('#lb-form').innerHTML = `<p class="funding-note">${t('lbAlreadySent')}</p>`;
        onSubmitted?.(out.rank, out.total);
        lbTop(game).then((top) => { tableEl.innerHTML = tableHtml(top ?? []); }).catch(() => {});
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
