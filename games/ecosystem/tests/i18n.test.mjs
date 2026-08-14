// Проверка целостности перевода: забытая строка должна ронять тест, а не всплывать
// в интерфейсе у преподавателя посреди занятия.

import test from 'node:test';
import assert from 'node:assert/strict';

import { t, tx, setLang, getLang, setStrings } from '../../../shared/i18n.js';
import { STRINGS } from '../src/strings.js';
import { DEFAULT_DECISIONS } from '../src/model/config.js';
import { createInitialState, step, explain } from '../src/model/engine.js';

setStrings(STRINGS);
import {
  START_ASSETS, VERTICALS, FUTURE_VERTICALS, LEVERS, LEVER_GROUPS,
} from '../src/model/config.js';
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

test('стартовые активы переведены полностью', () => {
  const missing = [];
  for (const a of START_ASSETS) {
    checkBilingual(`asset ${a.id}.name`, a.name, missing);
    checkBilingual(`asset ${a.id}.hint`, a.hint, missing);
    checkBilingual(`asset ${a.id}.fromGame`, a.fromGame, missing);
    checkBilingual(`asset ${a.id}.synergyNote`, a.synergyNote, missing);
  }
  assert.deepEqual(missing, []);
});

test('вертикали переведены полностью', () => {
  const missing = [];
  for (const v of VERTICALS) {
    checkBilingual(`vertical ${v.id}.name`, v.name, missing);
    checkBilingual(`vertical ${v.id}.hint`, v.hint, missing);
    checkBilingual(`vertical ${v.id}.incumbentName`, v.incumbentName, missing);
  }
  for (const v of FUTURE_VERTICALS) {
    checkBilingual(`future ${v.id}.name`, v.name, missing);
    checkBilingual(`future ${v.id}.hint`, v.hint, missing);
  }
  assert.deepEqual(missing, []);
});

test('рычаги и группы переведены полностью', () => {
  const missing = [];
  for (const l of LEVERS) {
    checkBilingual(`lever ${l.key}.label`, l.label, missing);
    checkBilingual(`lever ${l.key}.tip`, l.tip, missing);
    checkBilingual(`lever ${l.key}.unit`, l.unit, missing);
  }
  for (const g of LEVER_GROUPS) {
    checkBilingual(`group ${g.id}.label`, g.label, missing);
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

// Ключи берутся у самого движка, а не переписываются сюда руками
test('подписи разбора месяца существуют для всех ключей движка', () => {
  const keys = new Set();
  let state = createInitialState('i18n-drivers');
  let prevR = null;
  for (let i = 0; i < 20 && !state.over; i++) {
    const decisions = {
      ...DEFAULT_DECISIONS,
      verticals: ['taxi'],
      crossSell: state.taxi.on ? 4_000_000 : 0,
      taxiSupply: state.taxi.on ? 6_000_000 : 0,
      taxiMarketing: state.taxi.on ? 8_000_000 : 0,
    };
    const res = step(state, { decisions, eventChoice: 0 });
    state = res.state;
    if (prevR) for (const d of explain(prevR, res.report)) keys.add(d.key);
    prevR = res.report;
  }
  assert.ok(keys.size >= 1, `движок вернул слишком мало ключей: ${keys.size}`);
  for (const key of [...keys, 'driversTitle', 'driversNet']) {
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
  assert.equal(t('btnNext', { month: 7 }), 'Run month 7 →');
  setLang('ru');
});

test('tx() отдаёт нужный язык и переживает одноязычные строки', () => {
  const taxi = VERTICALS[0];
  setLang('ru');
  assert.match(tx(taxi.name), /Такси/);
  setLang('en');
  assert.match(tx(taxi.name), /taxi/i);
  assert.equal(tx('уже строка'), 'уже строка');
  assert.equal(tx(undefined), '');
  setLang('ru');
});
