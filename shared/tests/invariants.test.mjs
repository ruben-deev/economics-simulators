// Инварианты моделей: то, что обязано выполняться в ЛЮБОЙ партии, включая
// абсурдную. Играют случайные решения — именно они находят дыры, потому что
// разумная политика обходит их стороной.
//
// Проверяется три вещи:
//
//   1. в отчёте нет нечисел (NaN, Infinity) — ни в одном поле, на любой
//      глубине. Нечисло в отчёте — это «—» в интерфейсе и сломанный график;
//   2. запасы не уходят в минус: клиентов, курьеров, водителей и подписчиков
//      не бывает отрицательное число (дельты и оттоки — бывают, их не трогаем);
//   3. касса сходится с тождеством: касса′ = касса + прибыль − разовые
//      + то, что модель льёт мимо P&L намеренно (вливание совета, годовые
//      предоплаты, возврат авансов). Это главный тест: если тождество
//      разошлось, значит где-то деньги появились или исчезли.

import test from 'node:test';
import assert from 'node:assert/strict';

import * as foodEngine from '../../games/foodtech/src/model/engine.js';
import * as foodConfig from '../../games/foodtech/src/model/config.js';
import * as cinemaEngine from '../../games/cinema/src/model/engine.js';
import * as cinemaConfig from '../../games/cinema/src/model/config.js';
import * as ticketsEngine from '../../games/tickets/src/model/engine.js';
import * as ticketsConfig from '../../games/tickets/src/model/config.js';
import * as ecoEngine from '../../games/ecosystem/src/model/engine.js';
import * as ecoConfig from '../../games/ecosystem/src/model/config.js';

// Свой генератор: партии должны воспроизводиться при падении теста
const makeRnd = (seed) => {
  let x = seed;
  return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
};

const GAMES = [
  {
    name: 'НОВОЕДА', engine: foodEngine, config: foodConfig,
    turns: foodConfig.CONFIG.weeksTotal,
    decide: (rnd) => ({
      ...foodConfig.DEFAULT_DECISIONS,
      districts: foodConfig.DISTRICTS.filter(() => rnd() < 0.5).map((d) => d.id),
      deliveryFee: Math.round(rnd() * 300), commissionRate: rnd() * 0.4,
      courierPay: 120 + Math.round(rnd() * 150), targetCouriers: Math.round(rnd() * 1500),
      marketing: rnd() * 3e6, sales: rnd() * 1e6, promo: rnd() * 1e6,
      tech: rnd() * 2e6, rnd: rnd() * 1e6, finance: rnd() * 1e6,
    }),
  },
  {
    name: 'КИНОРЕКА', engine: cinemaEngine, config: cinemaConfig,
    turns: cinemaConfig.CONFIG.monthsTotal,
    decide: (rnd) => ({
      ...cinemaConfig.DEFAULT_DECISIONS,
      priceNew: 199 + Math.round(rnd() * 800), priceAds: Math.round(rnd() * 400),
      adLoad: Math.round(rnd() * 12), licensing: rnd() * 800e6,
      brandMarketing: rnd() * 400e6, studioSlots: Math.round(rnd() * 5),
      tech: rnd() * 50e6, rnd: rnd() * 50e6, finance: rnd() * 30e6,
    }),
  },
  {
    name: 'БИЛЕТВИЛЬ', engine: ticketsEngine, config: ticketsConfig,
    turns: ticketsConfig.CONFIG.monthsTotal,
    decide: (rnd) => ({
      ...ticketsConfig.DEFAULT_DECISIONS,
      buyerFee: rnd() * 0.22, orgCommission: rnd() * 0.14, marketing: rnd() * 200e6,
      managers: Math.round(rnd() * 120), onboarding: rnd() * 40e6, product: rnd() * 80e6,
      support: rnd() * 50e6, capacityTech: rnd() * 50e6, finance: rnd() * 12e6,
      platformFor: Object.fromEntries(ticketsConfig.ORGANIZERS.map((o) => [o.id, rnd() < 0.5])),
    }),
  },
  {
    name: 'НОВОГРАД', engine: ecoEngine, config: ecoConfig,
    turns: ecoConfig.CONFIG.monthsTotal,
    decide: (rnd) => ({
      ...ecoConfig.DEFAULT_DECISIONS,
      verticals: ['taxi', 'ecom', 'plus'].filter(() => rnd() < 0.6),
      foodTake: 0.9 + rnd() * 0.3, foodOps: rnd() * 10e6, foodMarketing: rnd() * 8e6,
      crossSell: rnd() * 10e6, mgmt: rnd() * 12e6, taxiSupply: rnd() * 15e6,
      taxiMarketing: rnd() * 20e6, ecomOps: rnd() * 6e6, ecomMarketing: rnd() * 10e6,
      ecomLogistics: rnd() * 6e6, finance: rnd() * 12e6,
    }),
  },
];

const STOCK = /users|customers|subs|orders|couriers|drivers|restaurants|tickets/i;
const FLOW = /delta|change|diff|growth|lost|churn|left|joined/i;

function scanNumbers(node, path, problems, seen = new Set()) {
  if (node === null || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) problems.push(`${path}.${key} = ${value}`);
      if (value < 0 && STOCK.test(key) && !FLOW.test(key)) {
        problems.push(`${path}.${key} = ${Math.round(value)} — отрицательный запас`);
      }
    } else if (value && typeof value === 'object') {
      scanNumbers(value, `${path}.${key}`, problems, seen);
    }
  }
}

for (const game of GAMES) {
  test(`${game.name}: случайные партии не ломают инварианты`, () => {
    const problems = [];
    for (let n = 0; n < 6; n++) {
      const rnd = makeRnd(1000 + n * 7);
      let state = game.engine.createInitialState(`инвариант-${n}`);
      for (let i = 0; i < game.turns && !state.over; i++) {
        if (rnd() < 0.25) {
          const options = game.config.CONFIG.fundingOptions ?? [];
          const amount = options[Math.floor(rnd() * options.length)];
          if (amount) state = game.engine.raise(state, amount).state ?? state;
        }
        const cashBefore = state.cash;
        const { state: next, report } = game.engine.step(state, {
          decisions: game.decide(rnd), eventChoice: rnd() < 0.5 ? 0 : 1,
        });
        state = next;
        scanNumbers(report ?? {}, `${game.name} код ${n} ход ${i + 1}`, problems);
        if (report && typeof report.profit === 'number') {
          const outside = (report.boardInjection ?? 0) + (report.annualCash ?? 0)
            + (report.advanceRecouped ?? 0);
          const expected = cashBefore + report.profit - (report.oneOff ?? 0) + outside;
          if (Math.abs(expected - state.cash) > 1) {
            problems.push(`${game.name} код ${n} ход ${i + 1}: касса разошлась с тождеством `
              + `на ${Math.round(Math.abs(expected - state.cash))} ₽`);
          }
        }
      }
    }
    assert.deepEqual(problems.slice(0, 5), []);
  });
}
