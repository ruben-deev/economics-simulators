// Самокаты — вертикаль года конгломерата.
//
// Главные инварианты: в зачётной партии (36 месяцев) вертикаль полностью
// инертна — ни полей в отчётах, ни расходов, ни изменения отпечатков;
// в году конгломерата работает физика «парк как капитал»: закупка партиями,
// износ только на улице (зимой двойной), списание по концу жизни, продажа
// самых изношенных, склейка через райдеров.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialState, step, enterEndless, scooterFleet, scooterResidualValue,
  sumOfParts, multiUsers, uniqueUsers, seasonScooters, focusPenalty,
} from '../src/model/engine.js';
import { CONFIG, DEFAULT_DECISIONS } from '../src/model/config.js';
import { EVENTS } from '../src/model/events.js';
import { createRng } from '../../../shared/rng.js';

const sc = CONFIG.scooters;
const STORE_ALL = Array(12).fill('store');

// Год конгломерата без прожитой партии: зачёт заморожен вручную —
// тестам нужна физика самокатов, а не 36 месяцев прелюдии
function endlessState(seed = 'scoot-test') {
  const s = createInitialState(seed, 'delivery', {}, 'normal');
  s.over = 'finished';
  s.month = CONFIG.monthsTotal;
  s.scored = { equityValue: 1_000_000_000 };
  return enterEndless(s);
}

test('зачётная партия: самокаты инертны — ни флота, ни полей в отчёте', () => {
  const s = createInitialState('scoot-off', 'delivery', {}, 'normal');
  const out = step(s, { decisions: { scooterBuy: 5, scooterPlan: Array(12).fill('street') } });
  assert.equal(scooterFleet(out.state), 0);
  assert.ok(!('scootUnits' in out.report), 'полей самокатов нет в отчёте зачётной партии');
  assert.ok(!('scootFullContribution' in out.report));
  assert.equal(sumOfParts(out.state).parts.some((p) => p.id === 'scoot'), false);
});

test('вход в год конгломерата: план по умолчанию — улица весь год, очереди пусты', () => {
  const s = endlessState();
  assert.deepEqual(s.decisions.scooterPlan, Array(12).fill('street'));
  assert.equal(s.decisions.scooterBuy, 0);
  assert.equal(s.decisions.scooterSell, 0);
  assert.deepEqual(s.scoot, { cohorts: [], users: 0 });
});

test('закупка: партия приходит сразу, капекс списан из кассы, очередь сброшена', () => {
  const s = endlessState();
  const out = step(s, { decisions: { scooterBuy: 2, scooterPlan: STORE_ALL } });
  assert.equal(scooterFleet(out.state), 2 * sc.batchUnits);
  assert.equal(out.report.scootCapex, 2 * sc.batchUnits * sc.unitCost);
  assert.equal(out.state.decisions.scooterBuy, 0);
});

test('пустой парк ничего не стоит и не размывает фокус', () => {
  const s = endlessState();
  const out = step(s, {});
  assert.equal(out.report.scootFullContribution, 0);
  assert.equal(out.report.scootUnits, 0);
  // фокус равен фокусу без самокатов: полвертикали добавляется только с парком
  const withFleet = endlessState();
  withFleet.scoot.cohorts.push({ units: 100, wear: 0 });
  assert.ok(focusPenalty(withFleet, withFleet.decisions)
    > focusPenalty(s, s.decisions), 'парк добавляет штраф фокуса');
});

test('износ: улица летом +1, зимой +2, склад не старит', () => {
  // Январь (сезон 0.05 < winterSeasonMax): улица со двойным износом
  let s = endlessState();
  let out = step(s, { decisions: { scooterBuy: 1 } }); // план по умолчанию — улица
  assert.equal(out.state.scoot.cohorts[0].wear, sc.winterWearMult);
  // Склад: износ не растёт
  out = step(out.state, { decisions: { scooterPlan: STORE_ALL } });
  assert.equal(out.state.scoot.cohorts[0].wear, sc.winterWearMult);
  // Апрель (сезон 0.9): обычный износ +1
  const apr = endlessState();
  apr.month = CONFIG.monthsTotal + 3; // следующий шаг — месяц 40, апрель
  assert.ok(seasonScooters(apr.month + 1) >= sc.winterSeasonMax);
  const aprOut = step(apr, { decisions: { scooterBuy: 1 } });
  assert.equal(aprOut.state.scoot.cohorts[0].wear, 1);
});

test('списание: отъездивший парк уходит в ноль без остаточной стоимости', () => {
  const s = endlessState();
  s.scoot.cohorts.push({ units: 200, wear: sc.streetLifeMonths - 1 });
  s.month = CONFIG.monthsTotal + 5; // июнь: обычный износ
  const out = step(s, {});
  assert.equal(out.report.scootScrapped, 200);
  assert.equal(scooterFleet(out.state), 0);
  assert.equal(scooterResidualValue(out.state), 0);
});

test('продажа: сперва самые изношенные, выручка по остатку жизни', () => {
  const s = endlessState();
  s.scoot.cohorts.push({ units: 100, wear: 4 }, { units: 100, wear: 1 });
  const out = step(s, { decisions: { scooterSell: 1, scooterPlan: STORE_ALL } });
  const expected = Math.round(100 * sc.unitCost * sc.resaleShare * (1 - 4 / sc.streetLifeMonths));
  assert.equal(out.report.scootResale, expected);
  assert.equal(out.state.scoot.cohorts.length, 1);
  assert.equal(out.state.scoot.cohorts[0].wear, 1);
  assert.equal(out.state.decisions.scooterSell, 0);
});

test('склейка: райдеры пересекаются с хабом и считаются мульти-клиентами', () => {
  let s = endlessState();
  s.month = CONFIG.monthsTotal + 3; // апрель: улица работает
  let out = step(s, { decisions: { scooterBuy: 5 } });
  out = step(out.state, {});
  const st = out.state;
  assert.ok(st.scoot.users > 0, 'райдеры появились');
  assert.equal(st.bothScoot,
    Math.min(Math.round(st.scoot.users * sc.hubOverlap), st.food.users));
  assert.equal(multiUsers(st) - st.both - st.bothEcom, st.bothScoot);
  // уникальные клиенты не двоятся: райдеры хаба вычтены
  const expectedUnique = Math.max(0, st.food.users + st.taxi.users + st.ecom.users
    + st.scoot.users - st.both - st.bothEcom - st.bothScoot);
  assert.equal(uniqueUsers(st), expectedUnique);
});

test('склад: платится хранение, райдеры тают, поездок нет', () => {
  const s = endlessState();
  s.scoot.cohorts.push({ units: 500, wear: 2 });
  s.scoot.users = 1000;
  const out = step(s, { decisions: { scooterPlan: STORE_ALL } });
  assert.equal(out.report.scootRides, 0);
  assert.equal(out.report.revenueScoot, 0);
  assert.equal(out.state.scoot.users, Math.round(1000 * (1 - sc.riderDecay)));
  // вклад отрицательный ровно на хранение и штаб
  assert.equal(out.report.scootFullContribution,
    -(500 * sc.storagePerUnit + sc.fixedMonthly));
});

test('оценка: остаток парка входит в sum-of-parts только в году конгломерата', () => {
  const s = endlessState();
  s.scoot.cohorts.push({ units: 300, wear: 2 });
  const part = sumOfParts(s).parts.find((p) => p.id === 'scoot');
  assert.ok(part, 'часть «самокаты» есть в оценке');
  assert.equal(part.value, scooterResidualValue(s));
  const normal = createInitialState('scoot-sop', 'delivery', {}, 'normal');
  normal.scoot.cohorts.push({ units: 300, wear: 2 }); // невозможно в игре, но оценка всё равно не должна их видеть
  assert.equal(sumOfParts(normal).parts.some((p) => p.id === 'scoot'), false);
});

test('поездки: спрос города против ёмкости парка, сезон таблицей', () => {
  const s = endlessState();
  s.month = CONFIG.monthsTotal + 6; // июль, пик сезона
  s.scoot.cohorts.push({ units: 1000, wear: 0 });
  const out = step(s, {});
  const season = seasonScooters(CONFIG.monthsTotal + 7);
  const expected = Math.round(Math.min(
    sc.cityDemandRides * season, 1000 * sc.ridesPerUnitMonth));
  assert.equal(out.report.scootRides, expected);
  assert.equal(out.report.revenueScoot, expected * sc.ridePrice);
});

test('событие «тёплая зима»: только год конгломерата, только зима, только с парком', () => {
  const ev = EVENTS.find((e) => e.id === 'scoot_warm_winter');
  assert.ok(ev, 'событие существует');
  assert.ok(ev.minMonth >= CONFIG.monthsTotal + 1, 'не раньше 37-го месяца — пул зачётной партии не тронут');
  assert.equal(ev.needsScooters, true);
  assert.ok(ev.calMonths.every((m) => sc.season[m] < sc.winterSeasonMax),
    'календарное окно — только зимние месяцы');
  assert.equal(ev.options.length, 2);
  // Вариант «выкатить»: улица вне плана и разовая цена бригад
  assert.equal(ev.options[0].effects.scootForceStreet, true);
  assert.ok(ev.options[0].effects.oneOffCost > 0);
});

test('DEFAULT_DECISIONS не таскает общий массив плана между партиями', () => {
  // План создаётся в enterEndless на каждую партию отдельно: мутация плана
  // одной партии не должна протекать в другую через общий объект
  const a = endlessState('a');
  const b = endlessState('b');
  a.decisions.scooterPlan[0] = 'store';
  assert.equal(b.decisions.scooterPlan[0], 'street');
  assert.ok(!('scooterPlan' in DEFAULT_DECISIONS));
});
