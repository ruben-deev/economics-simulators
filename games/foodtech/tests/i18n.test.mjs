// Проверка целостности перевода: забытая строка должна ронять тест, а не всплывать
// в интерфейсе у преподавателя посреди занятия.

import test from 'node:test';
import assert from 'node:assert/strict';

import { t, tx, setLang, getLang, setStrings } from '../../../shared/i18n.js';
import { STRINGS } from '../src/strings.js';
import { DEFAULT_DECISIONS } from '../src/model/config.js';
import { createInitialState, step, explain } from '../src/model/engine.js';

setStrings(STRINGS);
import { DISTRICTS, LEVERS, ALGORITHMS } from '../src/model/config.js';
import { EVENTS } from '../src/model/events.js';

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

// Двуязычные поля моделей: { ru, en }
function checkBilingual(label, field, missing) {
  if (field === undefined || field === null) return;
  if (typeof field === 'string') { missing.push(`${label} — одноязычная строка`); return; }
  for (const lang of LANGS) {
    if (typeof field[lang] !== 'string' || field[lang].trim() === '') missing.push(`${label}.${lang}`);
  }
}

test('районы переведены полностью', () => {
  const missing = [];
  for (const d of DISTRICTS) {
    checkBilingual(`district ${d.id}.name`, d.name, missing);
    checkBilingual(`district ${d.id}.hint`, d.hint, missing);
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

test('погодные и сезонные подписи существуют на обоих языках', () => {
  for (const key of ['wxClear', 'wxRain', 'wxStorm', 'wxHeat', 'wxSnow', 'wxIce', 'wxFrost',
    'seasonWinter', 'seasonSpring', 'seasonSummer', 'seasonAutumn']) {
    assert.ok(STRINGS[key], key);
  }
});

// Ключи берутся у самого движка, а не переписываются сюда руками: список,
// скопированный в тест, продолжает проходить и после того, как движок
// переименовал строки — именно так подпись однажды разъехалась со смыслом.
test('подписи разбора недели существуют для всех ключей движка', () => {
  const keys = new Set();
  let state = createInitialState('i18n-drivers');
  let prev = null;
  const decisions = { ...DEFAULT_DECISIONS, districts: ['center', 'univer'],
    sales: 300_000, marketing: 1_200_000, targetCouriers: 240 };
  for (let i = 0; i < 30 && !state.over; i++) {
    const res = step(state, { decisions, eventChoice: 0 });
    state = res.state;
    if (prev) for (const d of explain(prev, res.report)) keys.add(d.key);
    prev = res.report;
  }
  assert.ok(keys.size >= 4, `движок вернул слишком мало ключей: ${keys.size}`);
  for (const key of [...keys, 'driversTitle', 'driversNet']) {
    assert.ok(STRINGS[key], key);
  }
});

test('t() подставляет переменные и переключается вместе с языком', () => {
  setLang('ru');
  assert.equal(getLang(), 'ru');
  assert.match(t('btnNext', { week: 7 }), /7/);
  const ru = t('kpiCash');
  setLang('en');
  const en = t('kpiCash');
  assert.notEqual(ru, en);
  assert.equal(t('btnNext', { week: 7 }), 'Run week 7 →');
  setLang('ru');
});

test('t() для неизвестного ключа возвращает сам ключ, а не пустоту', () => {
  assert.equal(t('какого-то-ключа-нет'), 'какого-то-ключа-нет');
});

test('tx() отдаёт нужный язык и переживает одноязычные строки', () => {
  const center = DISTRICTS.find((d) => d.id === 'center');
  setLang('ru');
  assert.equal(tx(center.name), 'Центр');
  setLang('en');
  assert.equal(tx(center.name), 'Downtown');
  assert.equal(tx('уже строка'), 'уже строка');
  assert.equal(tx(undefined), '');
  setLang('ru');
});
