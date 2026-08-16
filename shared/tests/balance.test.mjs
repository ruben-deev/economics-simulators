// Страж баланса.
//
// Модель у всех четырёх игр детерминированная, поэтому якорная стратегия на
// фиксированных кодах партии даёт один и тот же итог. Здесь записан коридор
// вокруг измеренных медиан: правка модели, которая двигает опору больше чем
// на четверть, роняет этот тест.
//
// Это не «правильные» числа игры и не цель баланса — это отпечаток текущего
// состояния. Сдвинули баланс сознательно (замерами, по методологии из
// HANDOFF.md) — перезапишите коридор здесь тем, что показали инструменты:
//
//   node games/foodtech/tools/anchors.mjs
//   node games/cinema/tools/anchors.mjs
//   node games/tickets/tools/anchors.mjs
//   node games/ecosystem/tools/anchors.mjs
//
// Смысл теста в том, чтобы такая перезапись была ОСОЗНАННОЙ. Тихо уехавший
// баланс — самая дорогая поломка в наборе: тесты зелёные, партия сломана, а
// замечают это через месяц.

import test from 'node:test';
import assert from 'node:assert/strict';

import { measure as measureFood } from '../../games/foodtech/tools/anchors.mjs';
import { measure as measureCinema } from '../../games/cinema/tools/anchors.mjs';
import { measure as measureTickets } from '../../games/tickets/tools/anchors.mjs';
import { measure as measureEco } from '../../games/ecosystem/tools/anchors.mjs';
import { SEEDS } from '../tools/measure.js';

// Коридор: во сколько раз медиана может уехать вверх и вниз, прежде чем это
// считается изменением баланса, а не шумом правки.
const LOW = 0.75;
const HIGH = 1.25;
// Банкротств может стать больше на два кода — дальше это уже другая игра
const BANKRUPT_SLACK = 2;

// Измерено на SEEDS (24 кода), уровень «обычный», формат: [медиана, банкротств]
const BASE = {
  // Переснято после второй волны аудита 2026-08: сглаживание окна роста
  // (windowGrowthStable) слегка опустило все оценки, продажа за долги
  // убрала часть нулей (банкротством считается только настоящий ноль).
  НОВОЕДА: {
    осторожная: [1.32e9, 0],
    сбалансированная: [871e6, 0],
    агрессивная: [359e6, 0],
  },
  // КИНОРЕКА пересобрана целиком: премиальная эластичность, внутренние веса
  // цены входа, выпуклая реклама, симметричный конкурент (его рекламный
  // тариф считается по 45% прайса — единственная объявленная несимметрия),
  // сезонный CPM. Опоры доведены спуском с закреплённой идентичностью
  // (слоты и закупка), см. tools/anchors.mjs.
  КИНОРЕКА: {
    лицензионная: [14.11e9, 0],
    ровная: [10.85e9, 0],
    студийная: [6.01e9, 0],
  },
  // Платформенная опора выросла с 1.80: три её прежних нуля стали
  // продажами за долги с ликвидационной стоимостью
  БИЛЕТВИЛЬ: {
    'сбор с покупателя': [2.05e9, 1],
    'сбор с организатора': [2.62e9, 0],
    платформенная: [2.15e9, 0],
  },
  // Числа НОВОГРАДА пересняты четырежды: события «сооснователь», цены
  // событий, аудит 2026-08 (промо 420→600, срез кризиса, срочный аэропорт),
  // сглаживание окна роста
  НОВОГРАД: {
    'только хаб': [657e6, 0],
    'хаб и такси': [8.01e9, 0],
    экосистема: [8.66e9, 0],
  },
};

const MEASURE = {
  НОВОЕДА: () => measureFood('normal', SEEDS),
  КИНОРЕКА: () => measureCinema('normal', SEEDS),
  БИЛЕТВИЛЬ: () => measureTickets('normal', SEEDS),
  НОВОГРАД: () => measureEco('normal', 'delivery', SEEDS),
};

const money = (v) => (Math.abs(v) >= 1e9 ? `${(v / 1e9).toFixed(2)} млрд` : `${(v / 1e6).toFixed(0)} млн`);

// Замеры считаются один раз на весь файл: партии детерминированные, а
// повторный прогон стоил бы столько же, сколько первый
const RESULTS = Object.fromEntries(Object.entries(MEASURE).map(([game, run]) => [game, run()]));

for (const [game, anchors] of Object.entries(BASE)) {
  test(`${game}: якорные стратегии остались в коридоре`, () => {
    const res = RESULTS[game];
    const drifted = [];
    for (const [name, [median, bankrupts]] of Object.entries(anchors)) {
      const r = res[name];
      assert.ok(r, `опора «${name}» пропала из инструмента замеров`);
      if (r.median < median * LOW || r.median > median * HIGH) {
        drifted.push(`${name}: было ${money(median)}, стало ${money(r.median)}`);
      }
      if (r.bankrupts > bankrupts + BANKRUPT_SLACK) {
        drifted.push(`${name}: банкротств было ${bankrupts}, стало ${r.bankrupts} из ${SEEDS.length}`);
      }
    }
    assert.deepEqual(drifted, []);
  });
}

test('ни одна опора не выродилась в банкротство', () => {
  // Опора, которая разоряется на большинстве кодов, перестаёт быть
  // стратегией — и коридор вокруг неё меряет пустоту
  const dead = [];
  for (const [game, res] of Object.entries(RESULTS)) {
    for (const [name, r] of Object.entries(res)) {
      if (r.bankrupts > SEEDS.length / 2) dead.push(`${game} · ${name}: ${r.bankrupts}/${SEEDS.length}`);
      if (r.median <= 0) dead.push(`${game} · ${name}: медиана ноль`);
    }
  }
  assert.deepEqual(dead, []);
});
