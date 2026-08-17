// ============================================================================
// Сервер глобальной таблицы результатов для всего набора симуляторов.
// Google Apps Script поверх Google Таблицы. Развёртывание: server/README.md.
// Версия протокола: 2 (обратно совместима с клиентами первой версии).
//
//   GET  ?game=НОВОЕДА&limit=10          -> { ok, top: [...], total }
//   GET  ?game=НОВОЕДА&seed=урок-7б      -> топ только этого кода партии
//   GET  ?games=1                        -> { ok, games: [...] } — какие игры
//                                           уже присылали результаты
//   GET  ?ping=1                         -> { ok, api: 2 } — проверка развёртки
//   POST {game, name, line}              -> { ok, rank, total } | { ok:false }
//
// УНИВЕРСАЛЬНОСТЬ. Списка игр в коде больше нет: игра — это любой тег,
// прошедший проверку формата (буквы, цифры, «+», «·уровень», до 40 символов).
// Новая игра, новый уровень сложности или новый акт означают новый тег в
// строке результата — сервер примет его сам, без правок и переразвёртки.
// Каждый тег живёт своей таблицей: строки разных тегов не смешиваются.
// Если когда-нибудь понадобится закрытый список, впишите его в свойство
// скрипта GAMES (через запятую) — см. README; пустое свойство = приём всех.
//
// ДОВЕРИЕ. Сервер не верит присланным числам: счёт, код партии и ходы
// разбираются из строки результата, а строка проверяется той же контрольной
// суммой djb2-xor, что печатает игра (shared/records.js). Подделать счёт,
// не пересчитав сумму, нельзя; пересчитавший сумму школьник потратил на это
// больше сил, чем на честную партию, — таблица учебная, большего уровня
// защиты ей не нужно.
//
// НАГРУЗКА. Ответы GET кэшируются на минуту (CacheService): класс, разом
// открывший финальные экраны, читает из кэша, а не пересканирует таблицу
// тридцать раз. Отправка результата сбрасывает кэш своей игры.
// ============================================================================

// ЕДИНСТВЕННОЕ, ЧТО ЗДЕСЬ НАСТРАИВАЕТСЯ ВРУЧНУЮ.
// Пусто — и правильно: проект, открытый из самой таблицы (Расширения →
// Apps Script), находит её сам. Если проект создан отдельно на
// script.google.com («Проект без названия»), он никакой таблицы не знает —
// вставьте между кавычками ссылку на неё целиком, прямо из адресной строки:
//   const SHEET_ID = 'https://docs.google.com/spreadsheets/d/…/edit';
// Идентификатор из ссылки сервер вырежет сам. То же самое можно задать
// свойством скрипта SHEET_ID, если так удобнее.
const SHEET_ID = '';

const SHEET_NAME = 'scores';
const NAME_MAX = 24;
const LINE_MAX = 200;
const SEED_MAX = 40;
const TAG_MAX = 40;
const TURNS_MAX = 500;
const SCORE_MAX = 1e15;
const TOP_LIMIT_MAX = 100;
// Сколько верхних строк игры попадает в кэш и в выдачу с фильтром по коду.
// ~150 байт на строку, лимит значения кэша 100 КБ — 500 строк с запасом.
const CACHED_ROWS = 500;
const CACHE_SECONDS = 60;

// Тег игры: буквы (латиница и кириллица), цифры, «+», внутри — пробел,
// точка, дефис и «·» перед уровнем. Никаких «|» и управляющих символов:
// тег живёт внутри строки результата, где «|» — разделитель.
const TAG_RE = /^[0-9A-Za-zА-Яа-яЁё+][0-9A-Za-zА-Яа-яЁё+\-·. ]{0,39}$/;

// Та же сумма, что в shared/records.js
function checksum_(text) {
  let h = 5381;
  const s = String(text);
  for (const ch of s) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return h.toString(16).toUpperCase().padStart(4, '0').slice(-4);
}

// Закрытый список игр — только если он явно задан в свойствах скрипта.
// Обычный режим — свойства нет, сервер принимает любой корректный тег.
function allowedTags_() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty('GAMES');
    if (!raw) return null;
    const list = raw.split(',').map(function (s) { return s.trim(); }).filter(String);
    return list.length ? list : null;
  } catch (err) {
    return null;
  }
}

function tagOk_(tag) {
  if (!TAG_RE.test(tag)) return false;
  const allow = allowedTags_();
  return !allow || allow.indexOf(tag) >= 0;
}

// Разбор и проверка строки «ИГРА|vX.Y.Z|код|счёт|ходов|#СУММА»
function parseLine_(line) {
  const text = String(line == null ? '' : line).trim();
  if (!text || text.length > LINE_MAX) return null;
  const at = text.lastIndexOf('|#');
  if (at < 0) return null;
  if (checksum_(text.slice(0, at)) !== text.slice(at + 2).trim().toUpperCase()) return null;
  const parts = text.slice(0, at).split('|');
  if (parts.length !== 5) return null;
  const tag = parts[0].trim();
  const score = Number(parts[3]);
  const turns = Number(parts[4]);
  if (!tagOk_(tag)) return null;
  if (!isFinite(score) || score < 0 || score > SCORE_MAX) return null;
  if (!isFinite(turns) || turns < 0 || turns > TURNS_MAX) return null;
  return {
    tag: tag,
    version: parts[1].replace(/^v/, '').slice(0, 20),
    seed: cleanText_(parts[2], SEED_MAX),
    score: Math.round(score),
    turns: Math.round(turns),
    line: text,
  };
}

// Имя и код партии — живой пользовательский ввод: срезаем управляющие
// символы и лишние пробелы, длину — по потолку поля.
function cleanText_(value, max) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// Таблица достаётся двумя способами, потому что проект бывает двух видов.
// Привязанный (создан из таблицы: Расширения → Apps Script) знает свою
// таблицу сам. Отдельный (создан на script.google.com) не знает никакой —
// ему адрес таблицы задают свойством скрипта SHEET_ID. Раньше поддерживался
// только первый вид, и отдельный проект молча падал на пустой таблице.
function spreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  let id = String(SHEET_ID || '').trim();
  if (!id) {
    try { id = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || ''; } catch (err) { id = ''; }
  }
  if (!id) return null;
  // Из свойства принимается и полная ссылка на таблицу — на телефоне копируют её
  const m = String(id).match(/[-\w]{25,}/);
  return SpreadsheetApp.openById(m ? m[0] : id);
}

function sheet_() {
  const ss = spreadsheet_();
  if (!ss) throw new Error('нет таблицы: проект не привязан к ней, а SHEET_ID в начале файла пуст');
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['date', 'game', 'name', 'score', 'seed', 'turns', 'version', 'line']);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function cache_() {
  try { return CacheService.getScriptCache(); } catch (err) { return null; }
}

function cacheKey_(game) {
  // Ключ кэша ограничен 250 знаками и не должен зависеть от регистра байтов
  // тега напрямую — кодируем
  return 'top1:' + encodeURIComponent(game);
}

// Все записи игры по убыванию счёта — из кэша или со свежим сканом листа.
// В кэш кладётся верх таблицы (CACHED_ROWS строк): для топа и фильтра по
// коду партии этого достаточно, а полный лист сканируется только на записи.
function rowsFor_(game, freshScan) {
  const c = cache_();
  if (!freshScan && c) {
    const hit = c.get(cacheKey_(game));
    if (hit) {
      try { return JSON.parse(hit); } catch (err) { /* пересканируем */ }
    }
  }
  const sh = sheet_();
  const last = sh.getLastRow();
  let rows = [];
  if (last >= 2) {
    const values = sh.getRange(2, 1, last - 1, 8).getValues();
    rows = values
      .filter(function (r) { return String(r[1]) === game; })
      .map(function (r) {
        return {
          date: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
          game: String(r[1]), name: String(r[2]), score: Number(r[3]) || 0,
          seed: String(r[4]), turns: Number(r[5]) || 0, version: String(r[6]),
          line: String(r[7]),
        };
      })
      .sort(function (a, b) { return b.score - a.score; });
  }
  if (c) {
    try { c.put(cacheKey_(game), JSON.stringify(rows.slice(0, CACHED_ROWS)), CACHE_SECONDS); } catch (err) { /* большой топ не кэшируем */ }
  }
  return rows;
}

function dropCache_(game) {
  const c = cache_();
  if (c) { try { c.remove(cacheKey_(game)); } catch (err) { /* не критично */ } }
}

// Список игр, которые уже присылали результаты, — для проверки развёртки
// и отладки клиента. Считается по листу, кэшируется как обычный топ.
function gamesSeen_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 2, last - 1, 1).getValues();
  const seen = {};
  for (let i = 0; i < values.length; i++) seen[String(values[i][0])] = true;
  return Object.keys(seen).sort();
}

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    // Пинг отвечает не только «жив», но и «дотягиваюсь ли до таблицы»:
    // с телефона это единственный способ отличить «развёртка не та» от
    // «таблица недоступна», не открывая редактор.
    if (p.ping) {
      let mode = 'none';
      let rows = null;
      let error = '';
      try {
        mode = SpreadsheetApp.getActiveSpreadsheet() ? 'bound' : 'byId';
        rows = Math.max(0, sheet_().getLastRow() - 1);
      } catch (err) {
        error = String(err.message || err);
      }
      const out = { ok: !error, api: 2, mode: mode, rows: rows };
      if (error) out.error = error;
      return json_(out);
    }
    if (p.games) return json_({ ok: true, api: 2, games: gamesSeen_() });

    // Слишком длинный тег не обрезается до валидного, а отвергается:
    // обрезка молча спрашивала бы другую игру
    const game = cleanText_(p.game, TAG_MAX + 1);
    if (!tagOk_(game)) return json_({ ok: false, error: 'bad game tag' });
    const limit = Math.min(TOP_LIMIT_MAX, Math.max(1, Number(p.limit || 10) || 10));
    const seed = cleanText_(p.seed, SEED_MAX);

    let rows = rowsFor_(game, false);
    const total = rows.length;
    if (seed) rows = rows.filter(function (r) { return r.seed === seed; });
    const top = rows.slice(0, limit).map(function (r) {
      return {
        name: r.name, score: r.score, seed: r.seed, turns: r.turns,
        version: r.version, date: r.date,
      };
    });
    return json_({ ok: true, api: 2, top: top, total: total });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    lock.waitLock(10000);
    locked = true;
    let body = {};
    try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) {
      return json_({ ok: false, error: 'bad json' });
    }
    const name = cleanText_(body.name, NAME_MAX);
    if (!name) return json_({ ok: false, error: 'name required' });
    const parsed = parseLine_(body.line);
    if (!parsed) return json_({ ok: false, error: 'bad result line' });
    // Поле game — сверка ожиданий клиента с содержимым строки, не источник
    if (String(body.game || '') !== parsed.tag) return json_({ ok: false, error: 'game mismatch' });

    // Запись — только по свежему скану листа: кэш здесь не источник правды
    const sh = sheet_();
    const rows = rowsFor_(parsed.tag, true);
    // Одна и та же строка от того же имени второй раз не записывается —
    // повторное нажатие просто возвращает место в таблице.
    const mine = rows.filter(function (r) { return r.line === parsed.line && r.name === name; });
    if (!mine.length) {
      sh.appendRow([new Date(), parsed.tag, name, parsed.score, parsed.seed,
        parsed.turns, parsed.version, parsed.line]);
      rows.push({ name: name, score: parsed.score, seed: parsed.seed, line: parsed.line });
      rows.sort(function (a, b) { return b.score - a.score; });
      dropCache_(parsed.tag);
    }
    let rank = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].line === parsed.line && rows[i].name === name) { rank = i + 1; break; }
    }
    return json_({ ok: true, api: 2, rank: rank, total: rows.length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (ignored) { /* уже отпущен */ } }
  }
}
