import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG, DEFAULT_DECISIONS, DISTRICTS } from '../src/model/config.js';
import {
  createInitialState, step, unitEconomics, valuation, fundingOffer, raise, explain, finalScore,
  ordersPerCourier, techLevel, reachableOf, aovOf,
  algoQuality, dataLevel, rndLevel, algorithmImpact,
} from '../src/model/engine.js';

const baseDecisions = (over = {}) => ({ ...DEFAULT_DECISIONS, districts: ['center'], ...over });

// Прогоняет n недель с фиксированными решениями
function run(weeks, decisions, seed = 'test') {
  let state = createInitialState(seed);
  const reports = [];
  for (let i = 0; i < weeks && !state.over; i++) {
    const res = step(state, { decisions, eventChoice: 0 });
    state = res.state;
    reports.push(res.report);
  }
  return { state, reports };
}

test('стартовое состояние согласовано', () => {
  const s = createInitialState('a');
  assert.equal(s.cash, CONFIG.startCash);
  assert.equal(s.week, 0);
  assert.equal(s.equity, 1);
  assert.equal(Object.values(s.districts).filter((d) => d.active).length, 0);
});

test('симуляция детерминирована при одном seed', () => {
  const d = baseDecisions({ sales: 300_000, marketing: 1_000_000, targetCouriers: 200 });
  const a = run(20, d, 'seed-42');
  const b = run(20, d, 'seed-42');
  assert.deepEqual(
    a.reports.map((r) => [r.orders, r.cash, r.couriers]),
    b.reports.map((r) => [r.orders, r.cash, r.couriers]),
  );
});

test('разные seed дают разные партии', () => {
  const d = baseDecisions({ sales: 300_000, marketing: 1_000_000, targetCouriers: 200 });
  const a = run(30, d, 'seed-1');
  const b = run(30, d, 'seed-2');
  assert.notDeepEqual(a.reports.map((r) => r.cash), b.reports.map((r) => r.cash));
});

test('ни одна метрика не становится NaN или бесконечной', () => {
  const { reports } = run(52, baseDecisions({
    sales: 500_000, marketing: 3_000_000, targetCouriers: 600, tech: 500_000, promo: 50,
  }));
  for (const r of reports) {
    for (const [key, value] of Object.entries(r)) {
      if (typeof value === 'number') {
        assert.ok(Number.isFinite(value), `${key} на неделе ${r.week} = ${value}`);
      }
    }
    assert.ok(r.orders >= 0 && r.customers >= 0 && r.couriers >= 0);
    assert.ok(r.orders <= r.demand + 1e-6, 'нельзя выполнить больше заказов, чем есть спрос');
  }
});

test('P&L сходится: вклад = выручка − переменные, прибыль = вклад − постоянные', () => {
  const { reports } = run(15, baseDecisions({ sales: 400_000, marketing: 2_000_000, targetCouriers: 300 }));
  for (const r of reports) {
    const variable = r.courierCost + r.promoCost + r.paymentCost + r.supportCost;
    assert.ok(Math.abs(variable - r.variableCost) < 1e-6);
    assert.ok(Math.abs((r.netRevenue - r.variableCost) - r.contribution) < 1e-6);
    assert.ok(Math.abs((r.contribution - r.opex) - r.profit) < 1e-6);
    assert.ok(Math.abs((r.commissionRevenue + r.feeRevenue) - r.netRevenue) < 1e-6);
  }
});

test('касса меняется ровно на прибыль минус разовые расходы', () => {
  let state = createInitialState('cash');
  const d = baseDecisions({ sales: 300_000, marketing: 1_500_000, targetCouriers: 250 });
  for (let i = 0; i < 12 && !state.over; i++) {
    const before = state.cash;
    const res = step(state, { decisions: d, eventChoice: 0 });
    state = res.state;
    assert.ok(Math.abs((before + res.report.profit - res.report.oneOff) - state.cash) < 1e-6,
      `неделя ${res.report.week}`);
  }
});

test('рост цены доставки снижает спрос при прочих равных', () => {
  // Прогреваем одинаковую стартовую позицию, затем меняем только цену на один ход:
  // так виден чистый эффект эластичности, без обратной связи через скорость доставки.
  const warm = run(20, baseDecisions({ sales: 400_000, marketing: 2_000_000, targetCouriers: 400 }), 'price');
  const cheap = step(warm.state, { decisions: baseDecisions({ deliveryFee: 79, sales: 400_000, marketing: 2_000_000, targetCouriers: 400 }), eventChoice: 0 });
  const pricey = step(warm.state, { decisions: baseDecisions({ deliveryFee: 349, sales: 400_000, marketing: 2_000_000, targetCouriers: 400 }), eventChoice: 0 });
  assert.ok(cheap.report.demand > pricey.report.demand,
    `дешёвая доставка должна давать больше спроса: ${cheap.report.demand} vs ${pricey.report.demand}`);
  assert.ok(cheap.report.avgPriceFactor > pricey.report.avgPriceFactor);
});

test('перегрузка курьеров разворачивает эффект дешёвой доставки', () => {
  // Важный учебный сюжет: спрос, который нечем везти, ломает удержание.
  // При жёстком ограничении по курьерам низкая цена даёт меньше заказов, а не больше.
  const cheap = run(30, baseDecisions({ deliveryFee: 79, sales: 400_000, marketing: 2_000_000, targetCouriers: 150 }), 'spiral');
  const pricey = run(30, baseDecisions({ deliveryFee: 249, sales: 400_000, marketing: 2_000_000, targetCouriers: 150 }), 'spiral');
  const a = cheap.reports.at(-1);
  const b = pricey.reports.at(-1);
  assert.ok(a.avgDeliveryTime > b.avgDeliveryTime, 'дешёвая доставка перегружает курьеров');
  assert.ok(a.fillRate < b.fillRate, 'часть спроса остаётся невыполненной');
});

test('высокая комиссия отпугивает рестораны', () => {
  const low = run(25, baseDecisions({ commissionRate: 0.10, sales: 400_000, targetCouriers: 200, marketing: 1_000_000 }));
  const high = run(25, baseDecisions({ commissionRate: 0.40, sales: 400_000, targetCouriers: 200, marketing: 1_000_000 }));
  const a = low.reports[low.reports.length - 1];
  const b = high.reports[high.reports.length - 1];
  assert.ok(a.restaurants > b.restaurants, `${a.restaurants} должно быть > ${b.restaurants}`);
});

test('низкая оплата курьеров ломает найм и разгоняет время доставки', () => {
  const paid = run(25, baseDecisions({ courierPay: 220, sales: 400_000, marketing: 2_000_000, targetCouriers: 500 }));
  const cheap = run(25, baseDecisions({ courierPay: 60, sales: 400_000, marketing: 2_000_000, targetCouriers: 500 }));
  const a = paid.reports[paid.reports.length - 1];
  const b = cheap.reports[cheap.reports.length - 1];
  assert.ok(a.couriers > b.couriers, 'при нормальной ставке курьеров больше');
  assert.ok(a.avgDeliveryTime <= b.avgDeliveryTime, 'при нехватке курьеров доставка дольше');
});

test('без ресторанов маркетинг почти не создаёт заказов', () => {
  const noRest = run(12, baseDecisions({ sales: 0, marketing: 20_000_000, targetCouriers: 500 }), 'sel');
  const withRest = run(12, baseDecisions({ sales: 600_000, marketing: 20_000_000, targetCouriers: 500 }), 'sel');
  const a = noRest.reports.at(-1);
  const b = withRest.reports.at(-1);
  assert.equal(a.restaurants, 0);
  assert.ok(a.orders < b.orders * 0.02,
    `без ассортимента заказов почти нет: ${a.orders} против ${b.orders}`);
});

test('технологии повышают производительность курьера', () => {
  const plain = createInitialState('tech');
  const invested = { ...createInitialState('tech'), techStock: 40_000_000 };
  assert.ok(ordersPerCourier(invested, 3.5) > ordersPerCourier(plain, 3.5));
  assert.ok(techLevel(invested) > techLevel(plain));

  const withTech = run(30, baseDecisions({ sales: 400_000, marketing: 2_000_000, targetCouriers: 400, tech: 2_000_000 }));
  const r = withTech.reports.at(-1);
  assert.ok(r.techLevel > 0, 'уровень технологий накапливается');
});

test('длинное плечо снижает производительность курьера', () => {
  const s = createInitialState('dist');
  assert.ok(ordersPerCourier(s, 2.4) > ordersPerCourier(s, 9.0));
});

test('мотивация курьеров влияет на пропускную способность', () => {
  const happy = { ...createInitialState('m'), courierMorale: 1.5 };
  const unhappy = { ...createInitialState('m'), courierMorale: 0.5 };
  assert.ok(ordersPerCourier(happy, 3.5) > ordersPerCourier(unhappy, 3.5));
});

test('юнит-экономика: вклад = выручка − переменные расходы', () => {
  const s = createInitialState('u');
  s.districts.center.active = true;
  const u = unitEconomics(s, { ...DEFAULT_DECISIONS, deliveryFee: 149, commissionRate: 0.2, courierPay: 180, promo: 0 });
  assert.ok(Math.abs(u.revenue - (u.commissionRevenue + u.feeRevenue)) < 1e-9);
  assert.ok(Math.abs(u.contribution - (u.revenue - u.variable)) < 1e-9);
  assert.ok(u.takeRate > 0.2 && u.takeRate < 0.5);
});

test('промо-скидка уменьшает вклад ровно на свою величину', () => {
  const s = createInitialState('u2');
  s.districts.center.active = true;
  const base = unitEconomics(s, { ...DEFAULT_DECISIONS, promo: 0 });
  const promo = unitEconomics(s, { ...DEFAULT_DECISIONS, promo: 100 });
  const diff = base.contribution - promo.contribution;
  // 100 ₽ скидки минус экономия на эквайринге с меньшей суммы платежа
  assert.ok(Math.abs(diff - (100 - 100 * CONFIG.paymentFeeRate)) < 1e-6, `получено ${diff}`);
});

test('банкротство наступает при уходе кассы в минус', () => {
  const { state } = run(52, baseDecisions({ marketing: 20_000_000, sales: 5_000_000, tech: 8_000_000, promo: 300 }));
  assert.equal(state.over, 'bankrupt');
  assert.ok(state.cash < 0);
  assert.ok(finalScore(state).bankrupt);
});

test('раунд инвестиций даёт деньги и размывает долю', () => {
  const { state } = run(10, baseDecisions({ sales: 300_000, marketing: 1_000_000, targetCouriers: 200 }));
  const before = { cash: state.cash, equity: state.equity };
  const { state: after, offer } = raise(state, 50_000_000);
  assert.equal(after.cash, before.cash + 50_000_000);
  assert.ok(after.equity < before.equity);
  assert.ok(offer.dilution > 0 && offer.dilution < 1);
  assert.ok(Math.abs(after.equity - before.equity * (1 - offer.dilution)) < 1e-12);
});

test('оценка компании не отрицательна и растёт вместе с выручкой', () => {
  const weak = run(30, baseDecisions({ sales: 200_000, marketing: 300_000, targetCouriers: 100 }));
  const strong = run(30, baseDecisions({ sales: 600_000, marketing: 4_000_000, targetCouriers: 900, tech: 800_000 }));
  assert.ok(valuation(weak.state) > 0);
  assert.ok(valuation(strong.state) >= valuation(weak.state));
});

test('разбор недели раскладывает изменение заказов на факторы', () => {
  const { reports } = run(12, baseDecisions({ sales: 400_000, marketing: 2_000_000, targetCouriers: 300 }));
  const parts = explain(reports.at(-2), reports.at(-1));
  assert.ok(Array.isArray(parts));
  for (const p of parts) {
    assert.equal(typeof p.label, 'string');
    assert.ok(Number.isFinite(p.effect));
  }
});

test('игра завершается ровно через заданное число недель', () => {
  const { state } = run(60, baseDecisions({ sales: 300_000, marketing: 500_000, targetCouriers: 150 }));
  assert.ok(state.week <= CONFIG.weeksTotal);
  assert.ok(state.over === 'finished' || state.over === 'bankrupt');
});

test('запуск района списывает разовую стоимость', () => {
  let state = createInitialState('launch');
  const res = step(state, { decisions: baseDecisions({ districts: ['center', 'univer'] }), eventChoice: 0 });
  assert.equal(res.report.launched.length, 2);
  assert.equal(res.report.launchCost, 3_000_000 + 1_200_000);
});

test('доступный рынок меньше населения района на долю конкурента', () => {
  for (const d of DISTRICTS) {
    assert.ok(reachableOf(d) < d.potential, d.name);
    assert.ok(reachableOf(d) > 0, d.name);
  }
});

test('средний чек растёт вместе с доходом района', () => {
  const rich = DISTRICTS.find((d) => d.id === 'zagorod');
  const poor = DISTRICTS.find((d) => d.id === 'univer');
  assert.ok(aovOf(rich) > aovOf(poor));
});

// ============================================================================
// Алгоритмы: оптимизации второго порядка
// ============================================================================

// Прогреваем реальную партию, затем выдаём готовые данные и команду: так тесты
// проверяют сам алгоритм, а не то, успел ли игрок до него дожить.
function warmState(seed = 'algo', weeks = 30, over = {}) {
  let state = createInitialState(seed);
  const d = baseDecisions({ sales: 400_000, marketing: 0, targetCouriers: 40, ...over });
  for (let i = 0; i < weeks; i++) {
    const last = state.history.at(-1);
    if (over.targetCouriers === undefined && last) {
      d.targetCouriers = Math.min(4000,
        Math.ceil(last.demand * 1.15 / Math.max(1, last.perCourier) / 0.8));
    }
    if (over.marketing === undefined) d.marketing = (last?.restaurants ?? 0) > 60 ? 1_000_000 : 0;
    state = step(state, { decisions: d, eventChoice: 0 }).state;
    assert.ok(!state.over, `прогрев партии не должен заканчиваться банкротством (${seed}, неделя ${state.week})`);
  }
  state.dataStock = 1_600_000;
  state.rndStock = 100_000_000;   // качество ≈ 0.89
  return state;
}

const algoDecisions = (algos, over = {}) => baseDecisions({
  sales: 400_000, marketing: 1_500_000, targetCouriers: 600, ...over,
  algoOn: Object.fromEntries(Object.keys(algos).map((k) => [k, true])),
  algoParam: { ...DEFAULT_DECISIONS.algoParam, ...algos },
});

test('качество алгоритмов требует и данных, и команды', () => {
  const empty = createInitialState('q');
  assert.equal(algoQuality(empty), 0);

  const onlyTeam = { ...createInitialState('q'), rndStock: 100_000_000 };
  assert.equal(algoQuality(onlyTeam), 0, 'команда без данных ничего не умеет');

  const onlyData = { ...createInitialState('q'), dataStock: 5_000_000 };
  assert.equal(algoQuality(onlyData), 0, 'данные без команды никто не превратит в решения');

  const both = { ...createInitialState('q'), rndStock: 25_000_000, dataStock: 400_000 };
  assert.ok(Math.abs(algoQuality(both) - 0.5) < 1e-9);
  assert.ok(dataLevel(both) > 0 && rndLevel(both) > 0);
});

test('данные копятся только от выполненных заказов', () => {
  const { state, reports } = run(20, baseDecisions({ sales: 400_000, marketing: 1_000_000, targetCouriers: 300, rnd: 500_000 }));
  const totalOrders = reports.reduce((s, r) => s + r.orders, 0);
  assert.ok(Math.abs(state.dataStock - totalOrders) < 1e-6);
  assert.equal(state.rndStock, 500_000 * reports.length);
});

test('алгоритм недоступен без качества и оплачивается один раз', () => {
  // Свежая партия: качество 0, включённый алгоритм не должен ни работать, ни списывать деньги
  const fresh = createInitialState('fresh');
  const first = step(fresh, { decisions: algoDecisions({ batching: 0.5 }), eventChoice: 0 });
  assert.equal(first.report.algoActive.batching, false);
  assert.equal(first.report.installCost, 0);

  // Прогретая партия: внедряется на первом же ходу и больше не списывается
  const warm = warmState('install');
  const a = step(warm, { decisions: algoDecisions({ batching: 0.5 }), eventChoice: 0 });
  assert.equal(a.report.algoActive.batching, true);
  assert.ok(a.report.installCost > 0);
  assert.deepEqual(a.report.installedNow, ['Объединение заказов']);
  const b = step(a.state, { decisions: algoDecisions({ batching: 0.5 }), eventChoice: 0 });
  assert.equal(b.report.installCost, 0);
  assert.equal(b.report.algoActive.batching, true);
});

test('батчинг: больше заказов на курьера, ниже ставка за заказ, дольше доставка', () => {
  const warm = warmState('batch');
  const off = step(warm, { decisions: algoDecisions({}), eventChoice: 0 }).report;
  const on = step(warm, { decisions: algoDecisions({ batching: 1 }), eventChoice: 0 }).report;
  assert.ok(on.perCourier > off.perCourier, 'производительность курьера выше');
  assert.ok(on.batchTimeMult > off.batchTimeMult, 'время доставки страдает');
  assert.ok(on.courierPayEff < off.courierPayEff, 'ставка за отдельный заказ в связке ниже');
  assert.ok(on.cmPerOrder > off.cmPerOrder, 'себестоимость доставки заказа падает');
});

test('персональные скидки дешевле сплошной скидки при том же промо', () => {
  const warm = warmState('target', 30, { promo: 0 });
  const flat = step(warm, { decisions: algoDecisions({}, { promo: 100 }), eventChoice: 0 }).report;
  const aimed = step(warm, { decisions: algoDecisions({ targeting: 0.3 }, { promo: 100 }), eventChoice: 0 }).report;

  assert.equal(flat.promoCostPerOrder, 100);
  assert.ok(aimed.promoCostPerOrder < flat.promoCostPerOrder, 'платим за меньшую долю заказов');
  assert.ok(aimed.effectivePromo / aimed.promoCostPerOrder > flat.effectivePromo / flat.promoCostPerOrder,
    'каждый рубль скидки работает эффективнее');
  assert.ok(aimed.cmPerOrder > flat.cmPerOrder, 'вклад с заказа выше');
  assert.ok(aimed.effectivePromo < flat.effectivePromo,
    'но абсолютный эффект на спрос всё же меньше, чем у скидки всем');
});

test('чем уже охват скидки, тем дешевле рубль спроса', () => {
  const warm = warmState('share', 30, { promo: 0 });
  const wide = step(warm, { decisions: algoDecisions({ targeting: 0.8 }, { promo: 100 }), eventChoice: 0 }).report;
  const narrow = step(warm, { decisions: algoDecisions({ targeting: 0.15 }, { promo: 100 }), eventChoice: 0 }).report;
  assert.ok(narrow.effectivePromo / narrow.promoCostPerOrder > wide.effectivePromo / wide.promoCostPerOrder);
  assert.ok(narrow.effectivePromo < wide.effectivePromo, 'узкий охват создаёт меньше спроса');
});

test('таргетинг без скидки ничего не меняет', () => {
  const warm = warmState('nopromo', 30, { promo: 0 });
  const off = step(warm, { decisions: algoDecisions({}, { promo: 0 }), eventChoice: 0 }).report;
  const on = step(warm, { decisions: algoDecisions({ targeting: 0.3 }, { promo: 0 }), eventChoice: 0 }).report;
  assert.equal(on.orders, off.orders);
  assert.equal(on.customers, off.customers);
});

test('surge поднимает цену только при высокой загрузке', () => {
  const warm = warmState('surge');
  const starved = { ...warm, couriers: Math.round(warm.couriers * 0.5) };
  const flush = { ...warm, couriers: Math.round(warm.couriers * 2.5) };

  const hot = step(starved, { decisions: algoDecisions({ surge: 1 }), eventChoice: 0 }).report;
  const cold = step(flush, { decisions: algoDecisions({ surge: 1 }), eventChoice: 0 }).report;

  assert.ok(hot.utilization > 0.7 && hot.surgeUplift > 0, 'при перегрузе надбавка обязана появиться');
  assert.ok(hot.surgeFeeMult > 1);
  assert.ok(cold.utilization <= 0.7 && cold.surgeUplift === 0, 'при свободных курьерах надбавки нет');
  assert.equal(cold.surgeFeeMult, 1);
});

test('гибкая комиссия снижает воспринимаемую ресторанами ставку и часть выручки', () => {
  const warm = warmState('flex');
  const r = step(warm, { decisions: algoDecisions({ flexCommission: 1 }), eventChoice: 0 }).report;
  assert.ok(r.commissionPerceived < r.commission, 'рестораны видят более низкую ставку');
  assert.ok(r.commissionForRevenue < r.commission, 'часть комиссии мы отдаём');
  assert.ok(r.commission - r.commissionPerceived > r.commission - r.commissionForRevenue,
    'выигрыш партнёров больше нашей потери');
});

test('прогноз спроса сам подбирает штат под целевую загрузку', () => {
  const warm = warmState('forecast');
  const low = step(warm, { decisions: algoDecisions({ forecast: 0.55 }), eventChoice: 0 }).report;
  const high = step(warm, { decisions: algoDecisions({ forecast: 0.95 }), eventChoice: 0 }).report;
  assert.ok(low.forecastDemand > 0 && high.forecastDemand > 0);
  assert.ok(Math.abs(low.forecastDemand - high.forecastDemand) < 1e-6, 'прогноз спроса один и тот же');
  assert.ok(low.couriers > high.couriers, 'низкая целевая загрузка требует большего штата');
});

test('точность прогноза растёт вместе с качеством алгоритмов', () => {
  const warm = warmState('acc');
  const smart = step(warm, { decisions: algoDecisions({ forecast: 0.8 }), eventChoice: 0 }).report;
  const dumb = step({ ...warm, rndStock: 1_500_000 },
    { decisions: algoDecisions({ forecast: 0.8 }), eventChoice: 0 }).report;
  const errSmart = Math.abs(smart.forecastDemand / smart.demand - 1);
  const errDumb = Math.abs(dumb.forecastDemand / dumb.demand - 1);
  assert.ok(errSmart < errDumb, `${errSmart} должно быть меньше ${errDumb}`);
});

test('аллокация перекашивает загрузку между районами', () => {
  const two = { districts: ['center', 'sever'] };
  const warm = warmState('alloc', 32, two);
  const off = step(warm, { decisions: algoDecisions({}, two), eventChoice: 0 }).report;
  const on = step(warm, { decisions: algoDecisions({ allocation: 1 }, two), eventChoice: 0 }).report;

  const spread = (r) => {
    const u = r.districts.map((d) => d.util);
    return Math.max(...u) - Math.min(...u);
  };
  assert.ok(spread(off) < 1e-9, 'без алгоритма загрузка районов одинакова');
  assert.ok(spread(on) > 1e-6, 'с приоритетом маржи она перестаёт быть одинаковой');

  const rich = on.districts.find((d) => d.id === 'center');
  const poor = on.districts.find((d) => d.id === 'sever');
  assert.ok(rich.cmPerOrder > poor.cmPerOrder);
  assert.ok(rich.util < poor.util, 'район с лучшей маржой получает больше курьеров');
});

test('контрфактический разбор считает вклад каждого включённого алгоритма', () => {
  const warm = warmState('impact');
  const { state } = step(warm, { decisions: algoDecisions({ batching: 0.5, surge: 0.5 }), eventChoice: 0 });
  const impact = algorithmImpact(state);
  assert.equal(impact.length, 2);
  assert.deepEqual(new Set(impact.map((i) => i.key)), new Set(['batching', 'surge']));
  for (const i of impact) {
    for (const field of ['profit', 'orders', 'deliveryTime', 'cmPerOrder']) {
      assert.ok(Number.isFinite(i[field]), `${i.key}.${field}`);
    }
  }
  assert.deepEqual(algorithmImpact(createInitialState('x')), []);
});

test('контрфактический расчёт не портит состояние партии', () => {
  const warm = warmState('pure');
  const { state } = step(warm, { decisions: algoDecisions({ surge: 0.6, batching: 0.4 }), eventChoice: 0 });
  const before = JSON.stringify(state);
  algorithmImpact(state);
  assert.equal(JSON.stringify(state), before);
});

test('рестораны уходят при комиссии выше порога рентабельности', () => {
  const ok = run(30, baseDecisions({ commissionRate: 0.20, sales: 400_000, marketing: 1_000_000, targetCouriers: 300 }));
  const greedy = run(30, baseDecisions({ commissionRate: 0.38, sales: 400_000, marketing: 1_000_000, targetCouriers: 300 }));
  assert.ok(greedy.reports.at(-1).restaurants < ok.reports.at(-1).restaurants * 0.5,
    'выше порога поток заказов уже не удерживает партнёров');
});
