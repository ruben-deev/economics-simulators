// ============================================================================
// Тесты сервера мировой таблицы (server/leaderboard.gs).
//
// Сам сервер живёт в Google Apps Script и деплоится владельцем вручную, но
// его логика — обычный JS: здесь он исполняется в песочнице node с заглушками
// служб GAS (таблица в памяти, кэш-словарь, замок-пустышка). Это единственный
// способ поймать регрессию протокола ДО ручного деплоя: строки результата
// собираются тем же shared/records.js, что печатают игры.
// ============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { resultString } from '../records.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, '../../server/leaderboard.gs'), 'utf-8');

// Свежая песочница на каждый тест: таблица, кэш и свойства — с нуля
function makeServer({ props = {} } = {}) {
  const data = [];
  const sheet = {
    appendRow(row) { data.push(row.slice()); },
    getLastRow() { return data.length; },
    getRange(r, c, nr, nc) {
      return {
        getValues: () => data.slice(r - 1, r - 1 + nr)
          .map((row) => row.slice(c - 1, c - 1 + nc)),
      };
    },
  };
  let sheetCreated = false;
  const cacheStore = new Map();
  const cacheOps = { puts: 0, gets: 0, removes: 0 };
  const ctx = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: () => (sheetCreated ? sheet : null),
        insertSheet: () => { sheetCreated = true; return sheet; },
      }),
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text) => ({ setMimeType: () => ({ body: JSON.parse(text) }) }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => { cacheOps.gets += 1; return cacheStore.has(k) ? cacheStore.get(k) : null; },
        put: (k, v) => { cacheOps.puts += 1; cacheStore.set(k, v); },
        remove: (k) => { cacheOps.removes += 1; cacheStore.delete(k); },
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return {
    data,
    cacheStore,
    cacheOps,
    get: (params) => ctx.doGet({ parameter: params }).body,
    post: (body) => ctx.doPost({ postData: { contents: JSON.stringify(body) } }).body,
    postRaw: (contents) => ctx.doPost({ postData: { contents } }).body,
  };
}

const line = (tag, opts = {}) => resultString({
  tag, version: '1.0.0', seed: opts.seed ?? 'урок-7б',
  score: opts.score ?? 1_000_000, turns: opts.turns ?? 48,
});

test('пинг отвечает версией протокола', () => {
  const srv = makeServer();
  assert.deepEqual(srv.get({ ping: '1' }), { ok: true, api: 2 });
});

test('честная строка записывается и попадает в топ', () => {
  const srv = makeServer();
  const out = srv.post({ game: 'НОВОЕДА', name: 'Аня', line: line('НОВОЕДА') });
  assert.equal(out.ok, true);
  assert.equal(out.rank, 1);
  assert.equal(out.total, 1);
  const top = srv.get({ game: 'НОВОЕДА' });
  assert.equal(top.ok, true);
  assert.equal(top.top.length, 1);
  assert.equal(top.top[0].name, 'Аня');
  assert.equal(top.top[0].score, 1_000_000);
  assert.equal(top.top[0].seed, 'урок-7б');
});

test('подделанный счёт отбрасывается контрольной суммой', () => {
  const srv = makeServer();
  const forged = line('НОВОЕДА').replace('1000000', '9000000');
  const out = srv.post({ game: 'НОВОЕДА', name: 'Хакер', line: forged });
  assert.equal(out.ok, false);
  assert.equal(srv.data.length, 0);
});

test('повторная отправка той же строки не плодит записей', () => {
  const srv = makeServer();
  const l = line('НОВОЕДА');
  srv.post({ game: 'НОВОЕДА', name: 'Аня', line: l });
  const again = srv.post({ game: 'НОВОЕДА', name: 'Аня', line: l });
  assert.equal(again.ok, true);
  assert.equal(again.total, 1);
  // та же строка под другим именем — отдельная запись (списали у соседа —
  // видно по одинаковому коду и счёту, разберёт учитель, а не сервер)
  srv.post({ game: 'НОВОЕДА', name: 'Боря', line: l });
  assert.equal(srv.data.filter((r) => r[1] === 'НОВОЕДА').length + 1, 3); // + заголовок
});

test('новая игра принимается без правки сервера', () => {
  const srv = makeServer();
  const out = srv.post({ game: 'МАРСОГРАД·сложный', name: 'Вика', line: line('МАРСОГРАД·сложный') });
  assert.equal(out.ok, true);
  const top = srv.get({ game: 'МАРСОГРАД·сложный' });
  assert.equal(top.top.length, 1);
  const games = srv.get({ games: '1' });
  assert.deepEqual(games.games, ['МАРСОГРАД·сложный']);
});

test('кривые теги не проходят проверку формата', () => {
  const srv = makeServer();
  for (const bad of ['', '  ', '<script>', 'игра|игра', '·сложный', 'x'.repeat(41)]) {
    const res = srv.get({ game: bad });
    assert.equal(res.ok, false, `тег «${bad}» должен быть отвергнут`);
  }
});

test('закрытый список в свойствах ограничивает приём', () => {
  const srv = makeServer({ props: { GAMES: 'НОВОЕДА, КИНОРЕКА' } });
  assert.equal(srv.post({ game: 'НОВОЕДА', name: 'Аня', line: line('НОВОЕДА') }).ok, true);
  assert.equal(srv.post({ game: 'МАРСОГРАД', name: 'Боря', line: line('МАРСОГРАД') }).ok, false);
});

test('фильтр по коду партии отдаёт только этот код', () => {
  const srv = makeServer();
  srv.post({ game: 'НОВОЕДА', name: 'Аня', line: line('НОВОЕДА', { seed: 'урок-7б', score: 5e6 }) });
  srv.post({ game: 'НОВОЕДА', name: 'Боря', line: line('НОВОЕДА', { seed: 'дом', score: 7e6 }) });
  const all = srv.get({ game: 'НОВОЕДА' });
  assert.equal(all.top.length, 2);
  assert.equal(all.total, 2);
  const cls = srv.get({ game: 'НОВОЕДА', seed: 'урок-7б' });
  assert.equal(cls.top.length, 1);
  assert.equal(cls.top[0].name, 'Аня');
});

test('límite обрезается потолком, отправка сбрасывает кэш', () => {
  const srv = makeServer();
  for (let i = 0; i < 5; i++) {
    srv.post({ game: 'НОВОЕДА', name: `И${i}`, line: line('НОВОЕДА', { seed: `к${i}`, score: i * 1e6 + 1 }) });
  }
  assert.equal(srv.get({ game: 'НОВОЕДА', limit: '999' }).top.length, 5);
  assert.equal(srv.get({ game: 'НОВОЕДА', limit: '2' }).top.length, 2);
  // топ по убыванию
  const top = srv.get({ game: 'НОВОЕДА' }).top;
  for (let i = 1; i < top.length; i++) assert.ok(top[i - 1].score >= top[i].score);
  // повторное чтение — из кэша (лист не сканируется заново)
  const before = srv.cacheOps.gets;
  srv.get({ game: 'НОВОЕДА' });
  assert.ok(srv.cacheOps.gets > before);
  // отправка чистит кэш, и свежая строка видна сразу
  srv.post({ game: 'НОВОЕДА', name: 'Юля', line: line('НОВОЕДА', { score: 9e6 }) });
  assert.equal(srv.get({ game: 'НОВОЕДА' }).top[0].name, 'Юля');
});

test('имя чистится от управляющих символов, пустое имя — отказ', () => {
  const srv = makeServer();
  const out = srv.post({ game: 'НОВОЕДА', name: '   Аня\tПетрова  ', line: line('НОВОЕДА') });
  assert.equal(out.ok, true);
  assert.equal(srv.data[1][2], 'Аня Петрова');
  assert.equal(srv.post({ game: 'НОВОЕДА', name: '', line: line('НОВОЕДА') }).ok, false);
});

test('расхождение поля game со строкой — отказ', () => {
  const srv = makeServer();
  const out = srv.post({ game: 'КИНОРЕКА', name: 'Аня', line: line('НОВОЕДА') });
  assert.equal(out.ok, false);
  assert.equal(out.error, 'game mismatch');
});

test('битый JSON тела и пустое тело не роняют сервер', () => {
  const srv = makeServer();
  assert.equal(srv.postRaw('{сломано').ok, false);
  assert.equal(srv.postRaw('').ok, false);
  assert.equal(srv.data.length, 0);
});

test('длинная строка и абсурдные числа отбрасываются', () => {
  const srv = makeServer();
  assert.equal(srv.post({ game: 'НОВОЕДА', name: 'А', line: 'x'.repeat(300) }).ok, false);
  const huge = line('НОВОЕДА', { score: 2e15 });
  assert.equal(srv.post({ game: 'НОВОЕДА', name: 'А', line: huge }).ok, false);
  const marathon = line('НОВОЕДА', { turns: 900 });
  assert.equal(srv.post({ game: 'НОВОЕДА', name: 'А', line: marathon }).ok, false);
});
