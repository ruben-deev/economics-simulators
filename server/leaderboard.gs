// ============================================================================
// Сервер глобальной таблицы результатов для четырёх симуляторов.
// Google Apps Script поверх Google Таблицы. Развёртывание: server/README.md.
//
//   GET  ?game=НОВОЕДА&limit=10 -> { ok, top: [{name, score, seed, turns,
//                                               version, date}] }
//   POST {game, name, line}     -> { ok, rank, total } | { ok:false, error }
//
// Сервер не верит присланным числам: счёт, код партии и ходы разбираются из
// строки результата, а строка проверяется той же контрольной суммой djb2-xor,
// что печатает игра (shared/records.js). Подделать счёт, не пересчитав сумму,
// нельзя; пересчитавший сумму школьник потратил на это больше сил, чем на
// честную партию, — таблица учебная, большего уровня защиты ей не нужно.
// ============================================================================

const SHEET_NAME = 'scores';
// «НОВОГРАД+» — год конгломерата (пост-эндгейм). Он ведётся отдельной
// таблицей: зачётные партии на 36 месяцев и партии на 48 месяцев несопоставимы.
const GAMES = ['НОВОЕДА', 'КИНОРЕКА', 'БИЛЕТВИЛЬ', 'НОВОГРАД', 'НОВОГРАД+'];
const NAME_MAX = 24;
const TOP_LIMIT_MAX = 50;

// Та же сумма, что в shared/records.js
function checksum_(text) {
  let h = 5381;
  const s = String(text);
  for (const ch of s) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return h.toString(16).toUpperCase().padStart(4, '0').slice(-4);
}

// Разбор и проверка строки «ИГРА|vX.Y.Z|код|счёт|ходов|#СУММА»
function parseLine_(line) {
  const text = String(line).trim();
  if (text.length > 200) return null;
  const at = text.lastIndexOf('|#');
  if (at < 0) return null;
  if (checksum_(text.slice(0, at)) !== text.slice(at + 2).trim().toUpperCase()) return null;
  const parts = text.slice(0, at).split('|');
  if (parts.length !== 5) return null;
  const tag = parts[0];
  const score = Number(parts[3]);
  const turns = Number(parts[4]);
  if (GAMES.indexOf(tag) < 0) return null;
  if (!isFinite(score) || score < 0 || !isFinite(turns) || turns < 0 || turns > 500) return null;
  return {
    tag: tag,
    version: parts[1].replace(/^v/, ''),
    seed: parts[2].slice(0, 40),
    score: Math.round(score),
    turns: Math.round(turns),
    line: text,
  };
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

// Все записи игры, по убыванию счёта
function rowsFor_(game) {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, 8).getValues();
  return values
    .filter(function (r) { return r[1] === game; })
    .map(function (r) {
      return {
        date: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
        game: r[1], name: String(r[2]), score: Number(r[3]),
        seed: String(r[4]), turns: Number(r[5]), version: String(r[6]),
        line: String(r[7]),
      };
    })
    .sort(function (a, b) { return b.score - a.score; });
}

function doGet(e) {
  const game = ((e && e.parameter && e.parameter.game) || '').trim();
  const limit = Math.min(TOP_LIMIT_MAX, Math.max(1, Number((e && e.parameter && e.parameter.limit) || 10) || 10));
  if (GAMES.indexOf(game) < 0) return json_({ ok: false, error: 'unknown game' });
  const top = rowsFor_(game).slice(0, limit).map(function (r) {
    return { name: r.name, score: r.score, seed: r.seed, turns: r.turns, version: r.version, date: r.date };
  });
  return json_({ ok: true, top: top });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const name = String(body.name || '').trim().slice(0, NAME_MAX);
    if (!name) return json_({ ok: false, error: 'name required' });
    const parsed = parseLine_(body.line);
    if (!parsed) return json_({ ok: false, error: 'bad result line' });
    if (String(body.game || '') !== parsed.tag) return json_({ ok: false, error: 'game mismatch' });

    const sh = sheet_();
    const rows = rowsFor_(parsed.tag);
    // Одна и та же строка от того же имени второй раз не записывается —
    // повторное нажатие просто возвращает место в таблице.
    let mine = rows.filter(function (r) { return r.line === parsed.line && r.name === name; });
    if (!mine.length) {
      sh.appendRow([new Date(), parsed.tag, name, parsed.score, parsed.seed,
        parsed.turns, parsed.version, parsed.line]);
      rows.push({ name: name, score: parsed.score, line: parsed.line });
      rows.sort(function (a, b) { return b.score - a.score; });
    }
    const rank = rows.findIndex(function (r) { return r.line === parsed.line && r.name === name; }) + 1;
    return json_({ ok: true, rank: rank, total: rows.length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) { /* не был взят */ }
  }
}
