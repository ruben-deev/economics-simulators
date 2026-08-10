// Проверка целостности перевода: забытая строка должна ронять тест, а не всплывать
// в интерфейсе у преподавателя посреди занятия.

import test from 'node:test';
import assert from 'node:assert/strict';

import { t, tx, setLang, getLang, setStrings } from '../../../shared/i18n.js';
import { STRINGS } from '../src/strings.js';

setStrings(STRINGS);
import { SEGMENTS, GENRES, LEVERS, ALGORITHMS, DEFAULT_DECISIONS } from '../src/model/config.js';
import { createInitialState, step, explain, explainFactors } from '../src/model/engine.js';
import { EVENTS } from '../src/model/events.js';
import { RIVAL_RELEASES } from '../src/model/market.js';

const LANGS = ['ru', 'en'];

test('у каждой строки интерфейса есть обе версии и они непустые', () => {
  const missing = [];
  for (const [key, entry] of Object.entries(STRINGS)) {
    for (const lang of LANGS) {
      if (typeof entry[lang] !== 'string' || entry[lang].trim() === '') missing.push(`${key}.${lang}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('у каждой строки интерфейса совпадает набор подстановок {var}', () => {
  const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const mismatched = [];
  for (const [key, entry] of Object.entries(STRINGS)) {
    const ru = placeholders(entry.ru);
    const en = placeholders(entry.en);
    if (JSON.stringify(ru) !== JSON.stringify(en)) mismatched.push(`${key}: ru=${ru} en=${en}`);
  }
  assert.deepEqual(mismatched, []);
});

test('в английских строках нет кириллицы и посторонних алфавитов', () => {
  const bad = [];
  // langTitle — подпись кнопки переключения: она намеренно на другом языке
  for (const [key, entry] of Object.entries(STRINGS)) {
    if (key === 'langTitle') continue;
    if (/[а-яА-ЯёЁ]/.test(entry.en)) bad.push(`${key}.en: кириллица`);
    if (/[぀-ヿ一-鿿]/.test(entry.en + entry.ru)) bad.push(`${key}: иероглифы`);
  }
  assert.deepEqual(bad, []);
});

// Двуязычные поля моделей: { ru, en }
function checkBilingual(label, field, missing) {
  if (field === undefined || field === null) return;
  if (typeof field === 'string') { missing.push(`${label} — одноязычная строка`); return; }
  for (const lang of LANGS) {
    if (typeof field[lang] !== 'string' || field[lang].trim() === '') missing.push(`${label}.${lang}`);
  }
}

test('сегменты аудитории переведены полностью', () => {
  const missing = [];
  for (const s of SEGMENTS) {
    checkBilingual(`segment ${s.id}.name`, s.name, missing);
    checkBilingual(`segment ${s.id}.hint`, s.hint, missing);
  }
  assert.deepEqual(missing, []);
});

test('жанры переведены полностью', () => {
  const missing = [];
  for (const g of GENRES) {
    checkBilingual(`genre ${g.id}.name`, g.name, missing);
    checkBilingual(`genre ${g.id}.hint`, g.hint, missing);
  }
  assert.deepEqual(missing, []);
});

test('рычаги переведены полностью', () => {
  const missing = [];
  for (const l of LEVERS) {
    checkBilingual(`lever ${l.key}.label`, l.label, missing);
    checkBilingual(`lever ${l.key}.tip`, l.tip, missing);
    checkBilingual(`lever ${l.key}.unit`, l.unit, missing);
  }
  assert.deepEqual(missing, []);
});

test('алгоритмы переведены полностью', () => {
  const missing = [];
  for (const a of ALGORITHMS) {
    for (const field of ['name', 'short', 'what', 'tradeoff', 'lesson']) {
      checkBilingual(`algo ${a.key}.${field}`, a[field], missing);
    }
    checkBilingual(`algo ${a.key}.param.label`, a.param.label, missing);
    checkBilingual(`algo ${a.key}.param.unit`, a.param.unit, missing);
  }
  assert.deepEqual(missing, []);
});

test('события и варианты выбора переведены полностью', () => {
  const missing = [];
  for (const e of EVENTS) {
    checkBilingual(`event ${e.id}.title`, e.title, missing);
    checkBilingual(`event ${e.id}.text`, e.text, missing);
    checkBilingual(`event ${e.id}.lesson`, e.lesson, missing);
    for (const [i, o] of (e.options ?? []).entries()) {
      checkBilingual(`event ${e.id}.option${i}.label`, o.label, missing);
      checkBilingual(`event ${e.id}.option${i}.detail`, o.detail, missing);
    }
  }
  assert.deepEqual(missing, []);
});

test('у каждого типа чужой премьеры есть подпись на обоих языках', () => {
  for (const id of Object.keys(RIVAL_RELEASES)) {
    const key = `rival${id[0].toUpperCase()}${id.slice(1)}`;
    assert.ok(STRINGS[key], `нет строки ${key}`);
  }
});

test('сезоны подписаны на обоих языках', () => {
  for (const key of ['seasonWinter', 'seasonSpring', 'seasonSummer', 'seasonAutumn']) {
    assert.ok(STRINGS[key], key);
  }
});

// Ключи берутся у самого движка, а не переписываются сюда руками: список,
// скопированный в тест, продолжает проходить и после того, как движок
// переименовал строки — именно так подпись однажды разъехалась со смыслом.
test('подписи разбора месяца существуют для всех ключей движка', () => {
  const keys = new Set();
  let state = createInitialState('i18n-drivers');
  let prev = null;
  for (let i = 0; i < 30 && !state.over; i++) {
    const res = step(state, { decisions: DEFAULT_DECISIONS, eventChoice: 0 });
    state = res.state;
    if (prev) {
      for (const d of explain(prev, res.report)) keys.add(d.key);
      for (const f of explainFactors(prev, res.report)) keys.add(f.key);
    }
    prev = res.report;
  }
  assert.ok(keys.size >= 5, `движок вернул слишком мало ключей: ${keys.size}`);
  for (const key of [...keys, 'driversTitle', 'driversNet', 'factorsIntro']) {
    assert.ok(STRINGS[key], key);
  }
});

test('оценки финала подписаны на обоих языках', () => {
  for (const key of ['gradeBankrupt', 'gradeExcellent', 'gradeSolid', 'gradeSurvived', 'gradeModest']) {
    assert.ok(STRINGS[key], key);
  }
});

test('t() подставляет переменные и переключается вместе с языком', () => {
  setLang('ru');
  assert.equal(getLang(), 'ru');
  assert.match(t('btnNext', { month: 7 }), /7/);
  const ru = t('kpiCash');
  setLang('en');
  const en = t('kpiCash');
  assert.notEqual(ru, en);
  assert.match(t('btnNext', { month: 7 }), /7/);
  setLang('ru');
});

test('t() для неизвестного ключа возвращает сам ключ, а не пустоту', () => {
  assert.equal(t('какого-то-ключа-нет'), 'какого-то-ключа-нет');
});

test('tx() отдаёт нужный язык и переживает одноязычные строки', () => {
  const mass = SEGMENTS.find((s) => s.id === 'mass');
  setLang('ru');
  const ru = tx(mass.name);
  setLang('en');
  const en = tx(mass.name);
  assert.ok(ru && en && ru !== en);
  assert.equal(tx('уже строка'), 'уже строка');
  assert.equal(tx(undefined), '');
  setLang('ru');
});

// ----------------------------------------------------------------------------
// Переходы по подсказкам
//
// Ссылка вида <a data-jump="lever:licensing"> должна вести на существующий
// рычаг или блок. Опечатка в адресе не роняет игру — она просто молча
// перестаёт работать, поэтому проверяем адреса здесь.
// ----------------------------------------------------------------------------

const JUMP_PANELS = new Set([
  'slate', 'partners', 'rival', 'board', 'algos', 'funding',
  'price', 'report', 'charts', 'turn',
]);
const JUMP_TABS = new Set(['unit', 'pnl', 'algos', 'segments', 'help']);
const LEVER_KEYS = new Set(LEVERS.map((l) => l.key));

test('все переходы в подсказках ведут на существующие рычаги и блоки', () => {
  const bad = [];
  for (const [key, entry] of Object.entries(STRINGS)) {
    for (const lang of LANGS) {
      for (const m of entry[lang].matchAll(/data-jump="([^"]+)"/g)) {
        const [kind, target] = m[1].split(':');
        const known = (kind === 'lever' && LEVER_KEYS.has(target))
          || (kind === 'panel' && JUMP_PANELS.has(target))
          || (kind === 'tab' && JUMP_TABS.has(target));
        if (!known) bad.push(`${key}.${lang}: ${m[1]}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('ссылки-переходы есть в обеих версиях строки', () => {
  const jumps = (s) => [...s.matchAll(/data-jump="([^"]+)"/g)].map((m) => m[1]).sort();
  const mismatched = [];
  for (const [key, entry] of Object.entries(STRINGS)) {
    const ru = jumps(entry.ru);
    const en = jumps(entry.en);
    if (JSON.stringify(ru) !== JSON.stringify(en)) mismatched.push(`${key}: ru=${ru} en=${en}`);
  }
  assert.deepEqual(mismatched, []);
});
