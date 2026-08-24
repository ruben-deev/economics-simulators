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

// seed передаётся и серверу: сервер второй версии фильтрует по коду партии
// сам, а первой — просто не знает такого параметра и отдаёт обычный топ
// (страховкой работает клиентский фильтр в lbMount).
export async function lbTop(game, limit = 10, seed = '') {
  const base = lbEndpoint();
  if (!base) return null;
  const url = `${base}?game=${encodeURIComponent(game)}&limit=${limit}`
    + (seed ? `&seed=${encodeURIComponent(seed)}` : '');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`leaderboard ${res.status}`);
  const data = await res.json();
  const top = Array.isArray(data.top) ? data.top : [];
  // Сколько строк во всей таблице, а не только в загруженном топе, — нужно,
  // чтобы отличить «хуже всех вообще» от «хуже всех загруженных».
  top.total = Number(data.total) || top.length;
  return top;
}

// Место в сегодняшней таблице. Место, записанное при отправке (lb-mine-*), —
// снимок: таблица живая, и «место 1», полученное в пустой таблице, через
// месяц превращается в неправду. Считаем по загруженному топу: строки строго
// лучше + 1. Если счёт хуже всех загруженных строк, а таблица глубже
// загрузки, точное место неизвестно — возвращаем нижнюю оценку с exact:false
// (показывается как «N+»).
export function lbLiveRank(top, score) {
  if (!Array.isArray(top) || !Number.isFinite(score)) return null;
  const better = top.filter((r) => Number(r.score) > score).length;
  if (better >= top.length && (top.total ?? top.length) > top.length) {
    return { rank: top.length + 1, exact: false };
  }
  return { rank: better + 1, exact: true };
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

export function lbMount({ root, t, money, game, line, myScore, submitted, onSubmitted, viewOnly = false, seed = '' }) {
  if (!root || !lbEndpoint()) return;

  // Фильтр по коду партии: класс играет один город — сравнение честное
  // по построению. Фильтруется на клиенте по расширенному топу: сервер
  // не меняется (правило набора: leaderboard.gs не деплоим отсюда).
  let filterSeed = '';

  const esc = (s) => String(s).replace(/[&<>"]/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  // Своя строка узнаётся по имени и счёту: сервер в топе строк не помечает.
  const isMine = (r) => {
    const mine = lbMine(game);
    const name = lbName();
    if (!name || r.name !== name) return false;
    return r.score === Math.round(myScore ?? -1) || (mine && r.score === mine.score);
  };

  // full — весь загруженный топ (до 100 строк): по нему считается живое
  // место; показывается из него только первая десятка.
  const tableHtml = (full) => {
    const top = filterSeed
      ? full.filter((r) => (r.seed ?? '') === filterSeed)
      : full.slice(0, 10);
    if (!top.length) return `<p class="funding-note">${t(filterSeed ? 'lbEmptySeed' : 'lbEmpty')}</p>`;
    const mine = lbMine(game);
    const inTop = top.some(isMine);
    const rows = top.map((r, i) => `<tr${isMine(r) ? ' class="total"' : ''}>
      <td>${i + 1}</td><td>${esc(r.name)}${isMine(r) ? ` ${t('lbYou')}` : ''}</td>
      <td>${money(r.score)}</td>
      <td>${esc(r.seed ?? '')}</td><td>${esc((r.date ?? '').slice(0, 10))}</td>
    </tr>`);
    // Не дотянули до топа — своя строка дописывается снизу со своим номером,
    // чтобы место было видно, а не только надпись «вы 47-й».
    if (!inTop && mine && !filterSeed) {
      const live = lbLiveRank(full, Number(mine.score));
      rows.push(`<tr class="total"><td>${live ? `${live.rank}${live.exact ? '' : '+'}` : ''}</td>
        <td>${esc(mine.name)} ${t('lbYou')}</td><td>${money(mine.score)}</td>
        <td></td><td>${esc((mine.date ?? '').slice(0, 10))}</td></tr>`);
    }
    return `<div style="overflow-x:auto"><table class="data">
      <thead><tr><th>#</th><th>${t('lbColPlayer')}</th><th>${t('lbColScore')}</th><th>${t('lbColCode')}</th><th>${t('lbColDate')}</th></tr></thead>
      <tbody>${rows.join('')}</tbody></table></div>`;
  };

  // Пока свежий топ не загружен, место не показываем вовсе: снимок из
  // localStorage успел устареть, а мигание «место 1 → место 14» хуже паузы.
  const placeHtml = (full) => {
    const mine = lbMine(game);
    if (!mine) return '';
    const live = full ? lbLiveRank(full, Number(mine.score)) : null;
    if (!live) return '';
    return `<p class="funding-note">${t('lbYourPlace', {
      score: money(mine.score), rank: `${live.rank}${live.exact ? '' : '+'}`,
      total: full.total ?? mine.total,
    })}</p>`;
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
  const filterHtml = `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">
    <input id="lb-seed" type="text" maxlength="40" placeholder="${t('lbSeedPlaceholder')}"
      value="${esc(filterSeed)}"
      style="flex:1;min-width:140px;padding:6px 8px;background:transparent;border:1px solid var(--line);border-radius:6px;color:inherit;font:inherit">
    ${seed ? `<button class="btn small" id="lb-seed-mine" type="button">${t('lbSeedMine')}</button>` : ''}
  </div>`;

  // Топ недели — второй топ рядом с мировым: лучшие результаты, присланные
  // с понедельника, любым городом. Сначала вкладка фильтровала по коду
  // города недели, но читалась как «рекорды этой недели» — автор решил, что
  // так и лучше: города различаются не настолько, чтобы дробить
  // соревнование. Фильтр по дате на клиенте поверх мирового топ-100:
  // строка недели ниже сотого места мира сюда не попадёт — для учебной
  // таблицы это приемлемо.
  const weekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // назад до понедельника
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const weekHtml = (top) => {
    const rows = top.filter((r) => (r.date ?? '').slice(0, 10) >= weekStart).slice(0, 10);
    if (!rows.length) return `<p class="funding-note">${t('lbWeekEmpty')}</p>`;
    return `<div style="overflow-x:auto"><table class="data">
      <thead><tr><th>#</th><th>${t('lbColPlayer')}</th><th>${t('lbColScore')}</th><th>${t('lbColDate')}</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr${isMine(r) ? ' class="total"' : ''}>
        <td>${i + 1}</td><td>${esc(r.name)}${isMine(r) ? ` ${t('lbYou')}` : ''}</td>
        <td>${money(r.score)}</td><td>${esc((r.date ?? '').slice(0, 10))}</td>
      </tr>`).join('')}</tbody></table></div>`;
  };

  // Два топа — двумя вкладками: мировой открыт по умолчанию, неделя рядом.
  root.innerHTML = `<div id="lb-form">${formHtml}</div>
    <p class="funding-note" id="lb-status"></p>
    <div id="lb-place"></div>
    <div style="display:flex;gap:6px;margin-top:10px">
      <button type="button" class="btn small primary" id="lb-tab-world">${t('lbTabWorld')}</button>
      <button type="button" class="btn small" id="lb-tab-week">${t('lbTabWeek')}</button>
    </div>
    <div id="lb-pane-world">
      ${filterHtml}
      <div id="lb-table" style="margin-top:6px"><p class="funding-note">${t('lbLoading')}</p></div>
    </div>
    <div id="lb-pane-week" hidden style="margin-top:6px">
      <div id="lb-week"><p class="funding-note">${t('lbLoading')}</p></div>
    </div>`;

  const paneWorld = root.querySelector('#lb-pane-world');
  const paneWeek = root.querySelector('#lb-pane-week');
  const tabWorld = root.querySelector('#lb-tab-world');
  const tabWeek = root.querySelector('#lb-tab-week');
  const showPane = (week) => {
    paneWorld.hidden = week;
    paneWeek.hidden = !week;
    tabWorld.classList.toggle('primary', !week);
    tabWeek.classList.toggle('primary', week);
  };
  tabWorld.addEventListener('click', () => showPane(false));
  tabWeek.addEventListener('click', () => showPane(true));

  const tableEl = root.querySelector('#lb-table');
  const weekEl = root.querySelector('#lb-week');
  const statusEl = root.querySelector('#lb-status');
  // Топ всегда запрашивается глубиной 100: по нему считается живое место
  // (место из снимка на момент отправки устаревает), из него же фильтруется
  // топ недели — обе вкладки живут с одного запроса. С фильтром по коду
  // глубина нужна и сама по себе: код партии — редкая строка, в первой
  // десятке его может не оказаться вовсе (страховка для сервера первой
  // версии; второй фильтрует сам по seed).
  const refreshTop = () => lbTop(game, 100, filterSeed)
    .then((top) => {
      tableEl.innerHTML = tableHtml(top ?? []);
      // Живое место и неделя — только по нефильтрованному топу:
      // отфильтрованный по коду список ничего не говорит ни о месте в
      // мировой таблице, ни о неделе целиком.
      if (!filterSeed) {
        root.querySelector('#lb-place').innerHTML = placeHtml(top ?? []);
        weekEl.innerHTML = weekHtml(top ?? []);
      }
    })
    .catch(() => {
      tableEl.innerHTML = `<p class="funding-note">${t('lbError')}</p>`;
      if (!filterSeed) weekEl.innerHTML = `<p class="funding-note">${t('lbError')}</p>`;
    });

  refreshTop();

  const seedInput = root.querySelector('#lb-seed');
  let seedTimer = null;
  seedInput?.addEventListener('input', () => {
    clearTimeout(seedTimer);
    seedTimer = setTimeout(() => {
      filterSeed = seedInput.value.trim();
      refreshTop();
    }, 350);
  });
  root.querySelector('#lb-seed-mine')?.addEventListener('click', () => {
    seedInput.value = seed;
    filterSeed = seed;
    refreshTop();
  });

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
        root.querySelector('#lb-form').innerHTML = `<p class="funding-note">${t('lbAlreadySent')}</p>`;
        onSubmitted?.(out.rank, out.total);
        // Место обновит refreshTop — по свежему топу, а не по снимку.
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
