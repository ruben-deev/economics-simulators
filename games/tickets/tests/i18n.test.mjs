// Проверка целостности перевода: забытая строка должна ронять тест, а не
// всплывать в интерфейсе у преподавателя посреди занятия.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { t, tx, setLang, getLang, setStrings } from '../../../shared/i18n.js';
import { STRINGS } from '../src/strings.js';

setStrings(STRINGS);
import {
  ORGANIZERS, AUDIENCES, LEVERS, LEVER_GROUPS, ALGORITHMS, DEFAULT_DECISIONS,
} from '../src/model/config.js';
import { EVENTS } from '../src/model/events.js';
import { CRISES } from '../src/model/crises.js';
import { HITS, seasonLabel, SEASONS } from '../src/model/market.js';
import { STANCES } from '../src/model/rival.js';
import { createInitialState, step, explain, explainFactors } from '../src/model/engine.js';

const LANGS = ['ru', 'en'];
const here = dirname(fileURLToPath(import.meta.url));

test('у каждой строки интерфейса есть обе версии и они непустые', () => {
  const missing = [];
  for (const [key, entry] of Object.entries(STRINGS)) {
    for (const lang of LANGS) {
      if (typeof entry[lang] !== 'string' || entry[lang].trim() === '') missing.push(`${key}.${lang}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('двуязычны все тексты модели, а не только интерфейса', () => {
  const missing = [];
  const check = (obj, path) => {
    if (!obj) { missing.push(`${path}: нет поля`); return; }
    for (const lang of LANGS) {
      if (typeof obj[lang] !== 'string' || !obj[lang].trim()) missing.push(`${path}.${lang}`);
    }
  };
  for (const o of ORGANIZERS) { check(o.name, `org.${o.id}.name`); check(o.short, `org.${o.id}.short`); check(o.hint, `org.${o.id}.hint`); }
  for (const a of AUDIENCES) { check(a.name, `aud.${a.id}.name`); check(a.hint, `aud.${a.id}.hint`); }
  for (const l of LEVERS) { check(l.label, `lever.${l.key}.label`); check(l.unit, `lever.${l.key}.unit`); check(l.tip, `lever.${l.key}.tip`); }
  for (const g of LEVER_GROUPS) check(g.label, `group.${g.id}.label`);
  for (const a of ALGORITHMS) {
    check(a.name, `algo.${a.key}.name`); check(a.short, `algo.${a.key}.short`);
    check(a.what, `algo.${a.key}.what`); check(a.tradeoff, `algo.${a.key}.tradeoff`);
    check(a.lesson, `algo.${a.key}.lesson`); check(a.param.label, `algo.${a.key}.param.label`);
    check(a.param.unit, `algo.${a.key}.param.unit`);
  }
  for (const e of EVENTS) {
    check(e.title, `event.${e.id}.title`); check(e.text, `event.${e.id}.text`); check(e.lesson, `event.${e.id}.lesson`);
    for (const [i, o] of (e.options ?? []).entries()) {
      check(o.label, `event.${e.id}.opt${i}.label`); check(o.detail, `event.${e.id}.opt${i}.detail`);
    }
  }
  for (const c of CRISES) {
    check(c.title, `crisis.${c.id}.title`); check(c.text, `crisis.${c.id}.text`); check(c.lesson, `crisis.${c.id}.lesson`);
    for (const r of c.resolutions) {
      check(r.label, `crisis.${c.id}.${r.id}.label`); check(r.detail, `crisis.${c.id}.${r.id}.detail`);
    }
  }
  for (const h of HITS) { check(h.name, `hit.${h.id}.name`); check(h.note, `hit.${h.id}.note`); }
  for (const s of Object.values(STANCES)) { check(s.name, `stance.${s.id}.name`); check(s.hint, `stance.${s.id}.hint`); }
  for (const s of SEASONS) check(seasonLabel(s), `season.${s}`);
  assert.deepEqual(missing, []);
});

// Ключи берутся у самого движка, а не переписываются сюда руками: список,
// скопированный в тест, продолжает проходить и после переименования.
test('подписи разбора месяца существуют для всех ключей движка', () => {
  const keys = new Set();
  let state = createInitialState('i18n-drivers');
  let prev = null;
  for (let i = 0; i < 24 && !state.over; i++) {
    const res = step(state, { decisions: DEFAULT_DECISIONS, eventChoice: 0 });
    state = res.state;
    if (prev) {
      for (const d of explain(prev, res.report)) keys.add(d.key);
      for (const f of explainFactors(prev, res.report)) keys.add(f.key);
    }
    prev = res.report;
  }
  assert.ok(keys.size >= 4, `движок вернул слишком мало ключей: ${keys.size}`);
  for (const key of [...keys, 'driversTitle', 'driversNet', 'factorsIntro']) {
    assert.ok(STRINGS[key], key);
  }
});

test('каждый ключ, который просит интерфейс, есть в словаре', () => {
  const app = readFileSync(join(here, '..', 'src', 'ui', 'app.js'), 'utf8');
  const missing = new Set();
  // t('key') и t(`key`) — динамические вызовы проверяются отдельными тестами
  for (const m of app.matchAll(/\bt\('([A-Za-z0-9_]+)'/g)) {
    if (!STRINGS[m[1]]) missing.add(m[1]);
  }
  assert.deepEqual([...missing], []);
});

test('составные ключи интерфейса тоже разрешаются', () => {
  for (const s of SEASONS) {
    assert.ok(STRINGS[`season${s.charAt(0).toUpperCase()}${s.slice(1)}`], `season${s}`);
  }
  for (const effect of ['dilution', 'marketingCap', 'valuation']) {
    assert.ok(STRINGS[`alertGoalFailed_${effect}`], effect);
  }
  for (const tab of ['unit', 'pnl', 'sides', 'algos', 'help']) {
    assert.ok(STRINGS[`tab${tab.charAt(0).toUpperCase()}${tab.slice(1)}`], tab);
  }
});

test('переходы по подсказкам ведут в существующие блоки', () => {
  const app = readFileSync(join(here, '..', 'src', 'ui', 'app.js'), 'utf8');
  const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
  const panels = new Set();
  for (const m of html.matchAll(/id="([\w-]+)"/g)) panels.add(m[1]);

  const jumpPanels = {};
  const block = app.match(/const JUMP_PANELS = \{([\s\S]*?)\};/)[1];
  for (const m of block.matchAll(/(\w+):\s*'([\w-]+)'/g)) jumpPanels[m[1]] = m[2];
  for (const [key, id] of Object.entries(jumpPanels)) {
    assert.ok(panels.has(id), `цель перехода ${key} → #${id} не существует в разметке`);
  }

  const leverKeys = new Set(LEVERS.map((l) => l.key));
  const tabs = new Set(['unit', 'pnl', 'sides', 'algos', 'help']);
  for (const m of app.matchAll(/data-jump="(\$\{[^"]*\}|[^"]+)"/g)) {
    const raw = m[1];
    if (raw.startsWith('${')) continue;      // подставляется из данных, проверено ниже
    const [kind, key] = raw.split(':');
    if (kind === 'lever') assert.ok(leverKeys.has(key), `нет рычага ${key}`);
    else if (kind === 'tab') assert.ok(tabs.has(key), `нет вкладки ${key}`);
    else assert.ok(jumpPanels[key] ?? panels.has(key), `нет блока ${raw}`);
  }
  // Цели, которые собираются в коде предупреждений
  for (const target of ['panel:supply', 'panel:channel', 'panel:rival', 'panel:board',
    'lever:managers', 'lever:buyerFee', 'lever:orgCommission', 'lever:capacityTech',
    'lever:platformDev', 'tab:algos', 'tab:help']) {
    const [kind, key] = target.split(':');
    if (kind === 'lever') assert.ok(leverKeys.has(key), target);
    else if (kind === 'tab') assert.ok(tabs.has(key), target);
    else assert.ok(jumpPanels[key], target);
  }
});

test('t() подставляет переменные и переключается вместе с языком', () => {
  const before = getLang();
  setLang('ru');
  assert.match(t('btnNext', { month: 7 }), /7/);
  setLang('en');
  assert.match(t('btnNext', { month: 7 }), /7/);
  assert.notEqual(t('brandSub'), STRINGS.brandSub.ru);
  setLang(before);
});

test('tx() отдаёт нужный язык и переживает одноязычные строки', () => {
  setLang('en');
  assert.equal(tx({ ru: 'привет', en: 'hello' }), 'hello');
  assert.equal(tx('plain'), 'plain');
  assert.equal(tx(null), '');
  setLang('ru');
  assert.equal(tx({ ru: 'привет', en: 'hello' }), 'привет');
});
