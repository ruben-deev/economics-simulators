// Инварианты строк интерфейса всех четырёх игр.
//
// Родились из двух живых багов, пойманных при съёмке скриншотов:
// НОВОГРАД показывал сырые ключи lbInvite/lbSubmit на финале (строки
// мировой таблицы жили только в играх первого уровня), а английские
// тексты кое-где показывали рубли — «₽200M» и «399 ₽» там, где весь
// остальной интерфейс говорит в долларах.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

const GAMES = [
  ['НОВОЕДА', '../../games/foodtech/src/strings.js'],
  ['КИНОРЕКА', '../../games/cinema/src/strings.js'],
  ['БИЛЕТВИЛЬ', '../../games/tickets/src/strings.js'],
  ['НОВОГРАД', '../../games/ecosystem/src/strings.js'],
];

// Ключи, которые t()-ит shared/leaderboard.js: без них финал показывает
// сырые имена ключей вместо текста
const lbSource = readFileSync(here('../leaderboard.js'), 'utf8');
const LB_KEYS = [...new Set([...lbSource.matchAll(/t\('(lb\w+)'/g)].map((m) => m[1]))];

for (const [tag, path] of GAMES) {
  test(`строки ${tag}: мировая таблица укомплектована, оба языка на месте`, async () => {
    const { STRINGS } = await import(path);
    assert.ok(LB_KEYS.length >= 10, 'ключи мировой таблицы нашлись в исходнике');
    for (const key of LB_KEYS) {
      assert.ok(STRINGS[key], `нет ключа ${key}`);
      assert.ok(STRINGS[key].ru && STRINGS[key].en, `ключ ${key} без одного из языков`);
    }
  });

  test(`строки ${tag}: английский текст не говорит в рублях`, async () => {
    const { STRINGS } = await import(path);
    const offenders = [];
    const walk = (obj, trail) => {
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v === 'object') walk(v, `${trail}${k}.`);
        else if (k === 'en' && typeof v === 'string' && v.includes('₽')) offenders.push(trail.slice(0, -1));
      }
    };
    walk(STRINGS, '');
    assert.deepEqual(offenders, [], `рубль в английских строках: ${offenders.join(', ')}`);
  });
}

// Та же проверка для английских текстов событий: они живут не в strings.js,
// а прямо в модели (label/detail двуязычны на месте)
for (const [tag, dir] of [
  ['НОВОЕДА', 'foodtech'], ['КИНОРЕКА', 'cinema'], ['БИЛЕТВИЛЬ', 'tickets'], ['НОВОГРАД', 'ecosystem'],
]) {
  test(`события ${tag}: английский текст не говорит в рублях`, () => {
    const src = readFileSync(here(`../../games/${dir}/src/model/events.js`), 'utf8');
    const bad = [...src.matchAll(/en: '([^']*₽[^']*)'/g)].map((m) => m[1].slice(0, 60));
    assert.deepEqual(bad, [], `рубль в английских текстах событий: ${bad.join(' | ')}`);
  });
}
