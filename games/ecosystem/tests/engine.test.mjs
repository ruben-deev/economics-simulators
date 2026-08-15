import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONFIG, DEFAULT_DECISIONS, START_ASSETS, VERTICALS, DIFFICULTIES,
  assetById, verticalById, difficultyById,
} from '../src/model/config.js';
import {
  createInitialState, step, valuation, sumOfParts, fundingOffer, raise,
  legacyValuationFloor, enterEndless, endlessScore,
  financeLevel, financeSaturation, miscRate, financeRoundMult,
  finalScore, explain, expansionOpen, uniqueUsers, focusPenalty, foodQuality,
  multiUsers, cinemaLicenseFee, ticketsPartnerFee, plusLaunchCost,
} from '../src/model/engine.js';
import { makeGoal, goalProgress, applyGoalOutcome } from '../src/model/board.js';
import {
  EVENTS, VANITY_EVENTS, eventById, neutralModifiers, applyEvent, rollEvent,
} from '../src/model/events.js';

const taxiDef = verticalById('taxi');

const baseDecisions = (over = {}) => ({ ...DEFAULT_DECISIONS, ...over });

// Разумная стратегия экспансии: запуск такси после ворот, бюджеты по фазам
const expansionDecisions = (s, over = {}) => baseDecisions({
  verticals: ['taxi'],
  foodOps: 5_000_000,
  foodMarketing: 2_000_000,
  crossSell: s.taxi.on ? 4_000_000 : 0,
  mgmt: s.taxi.on ? 6_000_000 : 0,
  taxiSupply: s.taxi.on ? 6_000_000 : 0,
  taxiMarketing: s.taxi.on ? 10_000_000 : 0,
  ...over,
});

// Прогоняет n месяцев; decide может быть объектом или функцией от состояния.
// Раунды обязательны: прогон без денег сравнивает даты смерти, а не стратегии.
function run(months, decide, seed = 'test', { rounds = true } = {}) {
  let state = createInitialState(seed);
  const reports = [];
  for (let i = 0; i < months && !state.over; i++) {
    if (rounds && state.month >= CONFIG.minMonthForFunding) {
      const lastR = state.history[state.history.length - 1];
      if (lastR && lastR.profit < 0 && state.cash < -lastR.profit * 3) {
        state = raise(state, CONFIG.fundingOptions[1]).state;
      }
    }
    const d = typeof decide === 'function' ? decide(state) : decide;
    // Перемирие не принимается автоматически: иначе прогоны «случайно»
    // заканчивают войну, и тесты войны меряют выбор события, а не модель.
    // Престижные траты прогон не покупает: разумный игрок от них отказывается,
    // а прогон изображает разумного игрока (см. тест про престижные траты)
    const evId = state.pendingEvent?.id;
    const choice = evId === 'truce_offer' ? 1
      : (VANITY_EVENTS.some((e) => e.id === evId) ? 1 : 0);
    const res = step(state, { decisions: d, eventChoice: choice });
    state = res.state;
    reports.push(res.report);
  }
  return { state, reports };
}

// Прогретая партия с работающим такси (после войны)
function warmEcosystem(seed = 'warm', months = 20) {
  return run(months, (s) => expansionDecisions(s), seed);
}

test('стартовое состояние согласовано и читается из дескриптора актива', () => {
  const s = createInitialState('a');
  const asset = assetById('delivery');
  assert.equal(s.cash, CONFIG.startCash);
  assert.equal(s.month, 0);
  assert.equal(s.equity, 1);
  assert.equal(s.food.users, asset.users);
  assert.equal(s.taxi.on, false);
  assert.equal(s.both, 0);
  assert.equal(uniqueUsers(s), asset.users);
  assert.ok(s.board.goal, 'цель первого года объявлена до первого хода');
  assert.equal(s.board.goal.year, 1);
});

test('дескриптор стартового актива параметризует движок, а не хардкод', () => {
  // Архитектурное требование ТЗ: старты от других игр добавляются данными.
  // Проверяем, что движок реально читает поля дескриптора.
  for (const a of START_ASSETS) {
    assert.ok(a.users > 0 && a.arpu > 0 && a.margin > 0, a.id);
    assert.ok(a.synergy && typeof a.synergy.taxi === 'number', `${a.id}: профиль синергий`);
  }
  const s = createInitialState('d', 'delivery');
  assert.equal(s.assetId, 'delivery');
  const r = step(s, { decisions: baseDecisions() }).report;
  const asset = assetById('delivery');
  // Выручка первого месяца собрана из agрегатов дескриптора
  assert.ok(Math.abs(r.revenueFood / (asset.users * asset.arpu) - 1) < 0.25,
    'выручка еды считается от базы и ARPU дескриптора');
});

test('симуляция детерминирована при одном seed', () => {
  const a = run(20, (s) => expansionDecisions(s), 'seed-42');
  const b = run(20, (s) => expansionDecisions(s), 'seed-42');
  assert.deepEqual(
    a.reports.map((r) => [r.revenue, r.cash, r.taxiUsers]),
    b.reports.map((r) => [r.revenue, r.cash, r.taxiUsers]),
  );
});

test('разные seed дают разные партии', () => {
  const a = run(30, (s) => expansionDecisions(s), 'seed-1');
  const b = run(30, (s) => expansionDecisions(s), 'seed-2');
  assert.notDeepEqual(a.reports.map((r) => r.cash), b.reports.map((r) => r.cash));
});

test('ни одна метрика не становится NaN или бесконечной', () => {
  const { reports } = run(36, (s) => expansionDecisions(s, {
    foodTake: 1.2, taxiPrice: 0.9, crossSell: 20_000_000, taxiMarketing: 25_000_000,
  }));
  assert.ok(reports.length >= 12, 'партия прожила заметный срок');
  for (const r of reports) {
    for (const [key, value] of Object.entries(r)) {
      if (typeof value === 'number') {
        assert.ok(Number.isFinite(value), `${key} в месяце ${r.month} = ${value}`);
      }
    }
    assert.ok(r.foodUsers >= 0 && r.taxiUsers >= 0 && r.bothUsers >= 0);
    assert.ok(r.bothUsers <= r.foodUsers + 1e-6 && r.bothUsers <= r.taxiUsers + 1e-6,
      'пересечение не больше любой из баз');
    assert.ok(Math.abs(r.uniqueUsers - (r.foodUsers + r.taxiUsers - r.bothUsers)) < 1e-6,
      'уникальные = еда + такси − оба');
  }
});

test('P&L сходится: выручка, вклад, прибыль и касса', () => {
  let state = createInitialState('pnl');
  for (let i = 0; i < 14 && !state.over; i++) {
    const before = state.cash;
    const res = step(state, { decisions: expansionDecisions(state), eventChoice: 0 });
    state = res.state;
    const r = res.report;
    assert.ok(Math.abs((r.revenueFood + r.revenueTaxi) - r.revenue) < 1e-6);
    assert.ok(Math.abs((r.contribFood + r.contribTaxi) - r.contribution) < 1e-6);
    assert.ok(Math.abs((r.contribution - r.opex) - r.profit) < 1e-6);
    // Инъекция совета (за провал годовой цели) — тоже строка кассы
    assert.ok(Math.abs((before + r.profit - r.oneOff + r.boardInjection) - state.cash) < 1e-6,
      `касса в месяце ${r.month}`);
  }
});

// ----------------------------------------------------------------------------
// Ворота и война: открытие вертикали — решение с ценой и таймингом
// ----------------------------------------------------------------------------

test('у такси ворот нет: запуск доступен первым же ходом', () => {
  // Решение пользователя: первый ход партии — «что запускаем», а не «когда
  // разрешат». Цена входа — разовый платёж, война и убыточный первый год.
  const s = createInitialState('gate');
  assert.equal(expansionOpen(s, taxiDef), true, 'ворота открыты с месяца 1');
  const res = step(s, { decisions: baseDecisions({ verticals: ['taxi'] }) });
  assert.equal(res.state.taxi.on, true, 'такси запускается первым ходом');
  assert.ok(res.report.launchCost > 0);
});

test('механика ворот жива для вертикалей следующих фаз', () => {
  // Е-ком и подписка выйдут за воротами по метрикам — механизм проверяем
  // на синтетической вертикали, не трогая такси.
  const gated = { gate: { minMonth: 5, assetContributionMonths: 3 } };
  const early = createInitialState('gate2');
  assert.equal(expansionOpen(early, gated), false, 'до минимального месяца закрыто');

  // Прибыльная еда: после минимального месяца открыто
  let ok = createInitialState('gate2');
  for (let i = 0; i < 6; i++) ok = step(ok, { decisions: baseDecisions() }).state;
  assert.equal(expansionOpen(ok, gated), true, 'прибыльный актив открывает ворота');

  // Убыточная еда: максимальные траты при нулевой отдаче — ворота закрыты
  let bad = createInitialState('gate2');
  const badD = baseDecisions({ foodOps: 12_000_000, foodMarketing: 15_000_000, foodTake: 0.8 });
  for (let i = 0; i < 6; i++) bad = step(bad, { decisions: badD }).state;
  const h = bad.history.slice(-3);
  const avg = h.reduce((acc, r) => acc + r.foodFullContribution, 0) / h.length;
  assert.ok(avg < 0, 'выбранная стратегия действительно делает еду убыточной');
  assert.equal(expansionOpen(bad, gated), false, 'убыточный актив держит ворота закрытыми');
});

test('запуск такси платит разовую цену и начинает войну', () => {
  const { state: ready } = run(taxiDef.gate.minMonth, baseDecisions(), 'launch', { rounds: false });
  const res = step(ready, { decisions: baseDecisions({ verticals: ['taxi'] }) });
  assert.equal(res.state.taxi.on, true);
  assert.equal(res.report.launchCost, taxiDef.launchCost);
  // В этом месяце могло случиться и событие с разовой ценой — запуск
  // обязан входить в разовые расходы, но не обязан быть их единственной строкой
  assert.ok(res.report.oneOff >= taxiDef.launchCost);
  assert.ok(res.report.atWar, 'хозяин рынка отвечает войной сразу');
  assert.equal(res.report.warMonthsLeft, taxiDef.warMonths);
});

test('война конечна и режет приток холодного маркетинга', () => {
  const { state } = warmEcosystem('war', 6 + 1);
  const r = state.history[state.history.length - 1];
  assert.ok(r.atWar, 'на этом сроке война ещё идёт');
  // Тот же самый месяц без войны: снимаем флаг и сравниваем приток
  const peace = JSON.parse(JSON.stringify(state));
  peace.taxi.warUntil = 0;
  const dWar = expansionDecisions(state);
  const inWar = step(state, { decisions: dWar }).report;
  const inPeace = step(peace, { decisions: dWar }).report;
  assert.ok(inPeace.coldAcq > inWar.coldAcq * 1.5,
    `в мирное время холодный приток заметно больше: ${inPeace.coldAcq} против ${inWar.coldAcq}`);
  assert.ok(inPeace.fareEff > inWar.fareEff, 'война продавливает цены рынка');

  const long = warmEcosystem('war', taxiDef.gate.minMonth + taxiDef.warMonths + 2);
  const lastR = long.state.history[long.state.history.length - 1];
  assert.equal(lastR.warMonthsLeft, 0, 'война заканчивается');
});

// ----------------------------------------------------------------------------
// Кросс-селл и общая база
// ----------------------------------------------------------------------------

test('кросс-селл дешевле холодного привлечения, но упирается в ёмкость', () => {
  const { state } = warmEcosystem('cross', 14);
  const d = expansionDecisions(state, { crossSell: 4_000_000, taxiMarketing: 10_000_000 });
  const r = step(state, { decisions: d }).report;
  assert.ok(r.crossConv > 0, 'кросс-селл приводит клиентов');
  assert.ok(r.coldAcq > 0, 'маркетинг приводит клиентов');
  assert.ok(r.crossCac > 0 && r.cacCold > 0);
  assert.ok(r.crossCac < r.cacCold * 0.7,
    `клиент из кросс-селла в разы дешевле: ${r.crossCac} против ${r.cacCold}`);

  // Ёмкость: двадцатикратный бюджет не даёт двадцатикратной конверсии
  const heavy = step(state, { decisions: expansionDecisions(state, { crossSell: 25_000_000 }) }).report;
  assert.ok(heavy.crossConv < r.crossConv * 3,
    'перерасход упирается в ёмкость канала');
  assert.ok(heavy.crossWasted > 0, 'сгоревший бюджет виден в отчёте');
});

test('кросс-селл не спасает мёртвую вертикаль: конверсия зависит от качества', () => {
  const { state } = warmEcosystem('dead', 14);
  // Здоровое такси против такси без водителей (подача сорвана)
  const healthy = step(state, { decisions: expansionDecisions(state) }).report;
  const starved = JSON.parse(JSON.stringify(state));
  starved.taxi.drivers = Math.round(starved.taxi.drivers * 0.1);
  const broken = step(starved, { decisions: expansionDecisions(starved) }).report;
  assert.ok(broken.fill < healthy.fill, 'подача действительно сорвана');
  assert.ok(broken.crossConv < healthy.crossConv,
    `в сломанный продукт конвертится хуже: ${broken.crossConv} против ${healthy.crossConv}`);
});

test('клиент двух сервисов уходит реже — экосистемное удержание', () => {
  const { state } = warmEcosystem('eco', 16);
  const withBoth = JSON.parse(JSON.stringify(state));
  const noBoth = JSON.parse(JSON.stringify(state));
  noBoth.both = 0;   // те же базы, но пересечения нет
  const d = expansionDecisions(state, { crossSell: 0 });
  const a = step(withBoth, { decisions: d }).report;
  const b = step(noBoth, { decisions: d }).report;
  assert.ok(withBoth.both > 10_000, 'в прогретой партии есть пересечение');
  assert.ok(a.lostFood < b.lostFood, 'отток еды ниже при живом пересечении');
  assert.ok(a.lostTaxi < b.lostTaxi, 'отток такси ниже при живом пересечении');
});

test('пересечение растёт только через кросс-селл, холодный маркетинг ведёт новичков', () => {
  const { state } = warmEcosystem('mix', 14);
  const before = state.both;
  const onlyCold = step(state, {
    decisions: expansionDecisions(state, { crossSell: 0, taxiMarketing: 20_000_000 }),
  });
  assert.ok(onlyCold.report.coldAcq > 0);
  assert.ok(onlyCold.state.both <= before + 1e-6, 'холодный приток не создаёт пересечения');
  const onlyCross = step(state, {
    decisions: expansionDecisions(state, { crossSell: 6_000_000, taxiMarketing: 0 }),
  });
  assert.ok(onlyCross.state.both > before, 'кросс-селл наращивает пересечение');
});

// ----------------------------------------------------------------------------
// Дожим стартового актива
// ----------------------------------------------------------------------------

test('дожим даёт деньги сейчас и сжигает базу потом', () => {
  const gentle = run(12, baseDecisions({ foodTake: 1.0 }), 'milk', { rounds: false });
  const greedy = run(12, baseDecisions({ foodTake: 1.28 }), 'milk', { rounds: false });
  const g1 = gentle.reports[0];
  const m1 = greedy.reports[0];
  assert.ok(m1.revenueFood > g1.revenueFood * 1.05,
    'в первый месяц дожим приносит заметно больше выручки');
  const gEnd = gentle.reports[gentle.reports.length - 1];
  const mEnd = greedy.reports[greedy.reports.length - 1];
  assert.ok(mEnd.foodUsers < gEnd.foodUsers * 0.8,
    `за год дожатая база заметно меньше: ${mEnd.foodUsers} против ${gEnd.foodUsers}`);
});

test('дожатая корова кормит кросс-селл хуже: пул донора тает', () => {
  const mk = (take) => {
    const { state } = run(16, (s) => expansionDecisions(s, { foodTake: take }), 'milk2');
    const r = step(state, { decisions: expansionDecisions(state, { foodTake: take, crossSell: 25_000_000 }) }).report;
    return r.crossConv;
  };
  const gentleConv = mk(1.0);
  const greedyConv = mk(1.28);
  assert.ok(greedyConv < gentleConv,
    `ёмкость кросс-селла при дожиме меньше: ${greedyConv} против ${gentleConv}`);
});

// ----------------------------------------------------------------------------
// Водители и мощность такси
// ----------------------------------------------------------------------------

test('водителей мало — подача сорвана, клиенты уходят быстрее', () => {
  const { state } = warmEcosystem('drv', 16);
  const starved = JSON.parse(JSON.stringify(state));
  starved.taxi.drivers = Math.round(starved.taxi.drivers * 0.15);
  const d = expansionDecisions(state);
  const ok = step(state, { decisions: d }).report;
  const bad = step(starved, { decisions: d }).report;
  assert.ok(bad.fill < ok.fill);
  assert.ok(bad.churnTaxiRate > ok.churnTaxiRate, 'недовоз гонит клиентов');
  assert.ok(bad.servedTrips < ok.servedTrips);
});

test('водители без поездок уходят сами: простой ускоряет отток парка', () => {
  const { state } = warmEcosystem('idle', 16);
  const bloated = JSON.parse(JSON.stringify(state));
  bloated.taxi.drivers = state.taxi.drivers * 5;
  const d = expansionDecisions(state, { taxiSupply: 0 });
  const lean = step(state, { decisions: d }).report;
  const fat = step(bloated, { decisions: d }).report;
  assert.ok(fat.utilDrivers < lean.utilDrivers, 'раздутый парк простаивает');
  assert.ok(fat.driversLost / bloated.taxi.drivers > lean.driversLost / state.taxi.drivers,
    'доля уходящих водителей выше при простое');
});

test('низкий тариф даёт спрос, высокий — маржу', () => {
  const { state } = warmEcosystem('price', 16);
  // Парк с запасом: иначе дешёвый тариф перегружает подачу, и отток от
  // недовоза заслоняет отток от цены — сравнение перестаёт быть чистым
  const padded = JSON.parse(JSON.stringify(state));
  padded.taxi.drivers = state.taxi.drivers * 3;
  const cheap = step(padded, { decisions: expansionDecisions(padded, { taxiPrice: 0.87 }) }).report;
  const dear = step(padded, { decisions: expansionDecisions(padded, { taxiPrice: 1.2 }) }).report;
  assert.ok(cheap.demandTrips > dear.demandTrips, 'дешёвый тариф создаёт больше спроса');
  assert.ok(dear.cmPerTrip > cheap.cmPerTrip, 'дорогой тариф даёт больший вклад с поездки');
  assert.ok(dear.churnTaxiRate > cheap.churnTaxiRate, 'и больший отток');
});

// ----------------------------------------------------------------------------
// Фокус и управляющая компания
// ----------------------------------------------------------------------------

test('вторая вертикаль размывает фокус, управляющая компания выкупает штраф', () => {
  const one = createInitialState('focus');
  assert.equal(focusPenalty(one, baseDecisions()), 0, 'с одной вертикалью штрафа нет');
  const two = createInitialState('focus');
  two.taxi.on = true;
  const bare = focusPenalty(two, baseDecisions({ mgmt: 0 }));
  const managed = focusPenalty(two, baseDecisions({ mgmt: 12_000_000 }));
  assert.ok(bare > 0.08, 'без управляющей компании штраф ощутим');
  assert.ok(managed < bare * 0.5, 'управляющая компания выкупает большую часть');
  assert.ok(foodQuality(two, baseDecisions({ mgmt: 0 }))
    < foodQuality(one, baseDecisions({ mgmt: 0 })), 'штраф бьёт и по стартовому активу');
});

// ----------------------------------------------------------------------------
// Оценка: sum-of-parts
// ----------------------------------------------------------------------------

test('оценка холдинга — сумма частей с премией за пересечение', () => {
  const { state } = warmEcosystem('sop', 20);
  const sop = sumOfParts(state);
  assert.ok(sop.parts.length === 2, 'две вертикали — две части');
  assert.ok(sop.multiShare > 0.02, 'пересечение накопилось');
  assert.ok(sop.crossPremium > 0, 'премия за кросс-селл действует');
  assert.ok(sop.total > 0);
  // Премия исчезает вместе с пересечением
  const flat = JSON.parse(JSON.stringify(state));
  flat.both = 0;
  const sopFlat = sumOfParts(flat);
  assert.equal(sopFlat.crossPremium, 0);
  assert.ok(sopFlat.total < sop.total, 'без склейки холдинг стоит дешевле');
});

test('убыточная вертикаль без роста — «зоопарк» и вычитается из оценки', () => {
  const { state } = warmEcosystem('zoo', 20);
  // Ломаем такси: без водителей и бюджетов выручка падает, фиксы остаются
  let s = JSON.parse(JSON.stringify(state));
  s.taxi.drivers = 0;
  for (let i = 0; i < 8 && !s.over; i++) {
    s = step(s, { decisions: expansionDecisions(s, {
      taxiSupply: 0, taxiMarketing: 0, crossSell: 0 }) }).state;
  }
  const sop = sumOfParts(s);
  const taxiPart = sop.parts.find((p) => p.id === 'taxi');
  assert.ok(taxiPart.zoo, 'мёртвое такси распознано как зоопарк');
  assert.ok(taxiPart.value < 0, 'и вычитается из суммы');
});

test('за сжимающийся бизнес платят меньший множитель', () => {
  const grow = run(16, (s) => expansionDecisions(s), 'mult-a');
  const shrinkState = run(16, baseDecisions({ foodTake: 1.3, foodOps: 0 }), 'mult-a', { rounds: false });
  const a = sumOfParts(grow.state).parts.find((p) => p.id === 'food');
  const b = sumOfParts(shrinkState.state).parts.find((p) => p.id === 'food');
  assert.ok(b.growth < a.growth);
  assert.ok(b.value < a.value, 'тающая еда стоит дешевле ухоженной');
});

test('раунд даёт деньги и размывает долю; итоговый счёт учитывает кассу', () => {
  const { state } = run(10, baseDecisions(), 'fund', { rounds: false });
  const before = { cash: state.cash, equity: state.equity };
  const { state: after, offer } = raise(state, 400_000_000);
  assert.equal(after.cash, before.cash + 400_000_000);
  assert.ok(offer.dilution > 0 && offer.dilution < 1);
  assert.ok(Math.abs(after.equity - before.equity * (1 - offer.dilution)) < 1e-12);

  const f = finalScore(after);
  assert.ok(Math.abs(f.equityValue - (f.valuation + Math.max(0, after.cash)) * after.equity) < 1);
});

test('банкротство наступает при уходе кассы в минус', () => {
  const { state } = run(36, (s) => expansionDecisions(s, {
    taxiMarketing: 25_000_000, crossSell: 25_000_000, taxiSupply: 20_000_000,
    mgmt: 15_000_000, foodMarketing: 15_000_000,
  }), 'burn', { rounds: false });
  assert.equal(state.over, 'bankrupt');
  assert.ok(state.cash < 0);
  assert.ok(finalScore(state).bankrupt);
});

test('игра завершается ровно через заданное число месяцев', () => {
  const { state } = run(50, baseDecisions(), 'end');
  assert.ok(state.month <= CONFIG.monthsTotal);
  assert.ok(state.over === 'finished' || state.over === 'bankrupt');
});

// ----------------------------------------------------------------------------
// Совет директоров
// ----------------------------------------------------------------------------

test('цели трёх лет разные и тянут в разные стороны', () => {
  const s = createInitialState('goals');
  const types = [1, 2, 3].map((y) => makeGoal(y, s, 200_000).type);
  assert.equal(new Set(types).size, 3, `цели должны быть разными: ${types}`);
});

test('совет подводит итог ровно на границе года', () => {
  const { reports } = run(CONFIG.boardYearMonths + 1, (s) => expansionDecisions(s), 'edge');
  const atBorder = reports[CONFIG.boardYearMonths - 1];
  assert.ok(atBorder.goalOutcome, 'на двенадцатом месяце итог подводится');
  assert.equal(atBorder.goalOutcome.year, 1);
  assert.equal(reports[CONFIG.boardYearMonths - 2].goalOutcome, null, 'а на одиннадцатом ещё нет');
  assert.equal(reports[reports.length - 1].goal.year, 2, 'и сразу объявляется следующая цель');
});

test('провал цели имеет последствия, а не грустную надпись', () => {
  const state = createInitialState('fail');
  const goal = makeGoal(2, state, 200_000);
  applyGoalOutcome(state, goal, { done: false }, 24);
  assert.ok(state.restrictions?.marketingCap > 0, 'бюджеты режутся');
  assert.ok(state.flags.valuationBonus < 0, 'и оценка страдает');

  const ok = createInitialState('pass');
  applyGoalOutcome(ok, makeGoal(2, ok, 200_000), { done: true }, 24);
  assert.ok(ok.flags.valuationBonus > 0, 'выполненная цель вознаграждается');
  assert.equal(ok.restrictions, null);
});

test('порезанные бюджеты реально режутся, а не только в надписи', () => {
  let state = createInitialState('cap');
  state.restrictions = { marketingCap: 6_000_000, until: 10 };
  const r = step(state, { decisions: baseDecisions({ foodMarketing: 15_000_000 }) }).report;
  assert.equal(r.marketingCapped, 6_000_000);
  assert.equal(r.decisions.foodMarketing, 6_000_000, 'решение действительно урезано');
});

test('прогресс по целям читается и считается без сюрпризов', () => {
  const s = createInitialState('prog');
  const ctx = { taxiUsers: 50_000, multiShare: 0.2, profitableMonths: 8, uniqueUsers: 250_000 };
  for (const y of [1, 2, 3]) {
    const g = makeGoal(y, s, 200_000);
    const p = goalProgress(g, ctx);
    assert.equal(typeof p.done, 'boolean');
    assert.ok(Number.isFinite(p.value) && Number.isFinite(p.target));
  }
  const weak = { taxiUsers: 0, multiShare: 0, profitableMonths: 0, uniqueUsers: 1000 };
  for (const y of [1, 2, 3]) {
    assert.equal(goalProgress(makeGoal(y, s, 200_000), weak).done, false);
  }
});

// ----------------------------------------------------------------------------
// События
// ----------------------------------------------------------------------------

test('поштучные цены событий растут вместе с размером холдинга', () => {
  const { state } = warmEcosystem('ev', 16);
  const leak = eventById('data_leak');
  assert.ok(leak.options[0].effects.oneOffCostPerUniqueUser > 0,
    'компенсация утечки — поштучная цена по базе');
  const strike = eventById('driver_strike');
  assert.ok(strike.options[0].effects.oneOffCostPerDriver > 0,
    'доплата бастующим — поштучная цена по парку');

  // Цена решения в отчёте реально зависит от размера
  const sBig = JSON.parse(JSON.stringify(state));
  sBig.pendingEvent = { ...leak };
  const sSmall = JSON.parse(JSON.stringify(state));
  sSmall.food.users = Math.round(sSmall.food.users * 0.3);
  sSmall.taxi.users = Math.round(sSmall.taxi.users * 0.3);
  sSmall.both = Math.round(sSmall.both * 0.3);
  sSmall.pendingEvent = { ...leak };
  const big = step(sBig, { decisions: expansionDecisions(sBig), eventChoice: 0 }).report;
  const small = step(sSmall, { decisions: expansionDecisions(sSmall), eventChoice: 0 }).report;
  assert.ok(big.oneOff > small.oneOff * 2,
    `большому холдингу извинение дороже: ${big.oneOff} против ${small.oneOff}`);
});

test('замолчать утечку — подорвать доверие: кросс-селл работает вполсилы', () => {
  const { state } = warmEcosystem('trust', 16);
  const leak = eventById('data_leak');
  const sQuiet = JSON.parse(JSON.stringify(state));
  sQuiet.pendingEvent = { ...leak };
  const afterQuiet = step(sQuiet, { decisions: expansionDecisions(sQuiet), eventChoice: 1 });
  assert.ok(afterQuiet.state.trustUntil > afterQuiet.state.month, 'недоверие включено');
  const rNext = step(afterQuiet.state, { decisions: expansionDecisions(afterQuiet.state) }).report;

  const sPaid = JSON.parse(JSON.stringify(state));
  sPaid.pendingEvent = { ...leak };
  const afterPaid = step(sPaid, { decisions: expansionDecisions(sPaid), eventChoice: 0 });
  const rPaidNext = step(afterPaid.state, { decisions: expansionDecisions(afterPaid.state) }).report;
  assert.ok(rNext.crossConv < rPaidNext.crossConv,
    'после замалчивания кросс-селл конвертит хуже');
});

test('перемирие заканчивает войну, но отдаёт конкуренту часть рынка', () => {
  const { state } = warmEcosystem('truce', taxiDef.gate.minMonth + 2);
  assert.ok(state.taxi.warUntil > state.month, 'война идёт');
  const truce = eventById('truce_offer');
  const s = JSON.parse(JSON.stringify(state));
  s.pendingEvent = { ...truce };
  const lockBefore = s.taxi.lockAdd;
  const after = step(s, { decisions: expansionDecisions(s), eventChoice: 0 });
  assert.equal(after.report.warMonthsLeft, 0, 'война закончилась немедленно');
  assert.ok(after.state.taxi.lockAdd > lockBefore, 'но рынок стал меньше');
});

test('штраф регулятора прилетает только решившим ждать закона', () => {
  const mods = neutralModifiers();
  const reg = eventById('taxi_regulation');
  applyEvent(mods, reg, 1);
  assert.equal(mods.regulationRisk, true);
  const fine = eventById('regulation_fine');
  assert.ok(fine.effects.oneOffCostPerDriver > 0);
});

test('события переведены и имеют нужную структуру', () => {
  for (const e of EVENTS) {
    assert.ok(e.id && e.weight > 0);
    assert.ok(e.title?.ru && e.title?.en, e.id);
    for (const o of e.options ?? []) {
      assert.ok(o.label?.ru && o.label?.en, e.id);
      assert.ok(o.effects, e.id);
    }
  }
});

// ----------------------------------------------------------------------------
// Разбор месяца
// ----------------------------------------------------------------------------

test('разбор месяца перемножается ровно в изменение выручки', () => {
  const { reports } = run(24, (s) => expansionDecisions(s), 'drv');
  for (let i = 1; i < reports.length; i++) {
    const p = reports[i - 1];
    const c = reports[i];
    const drivers = explain(p, c);
    if (!drivers.length) continue;
    const product = drivers.reduce((acc, d) => acc * (1 + d.effect), 1);
    const actual = c.revenue / p.revenue;
    assert.ok(Math.abs(product - actual) / actual < 0.02,
      `м${c.month}: произведение ${product.toFixed(3)}, факт ${actual.toFixed(3)}`);
  }
});

test('ворота экспансии видны интерфейсу тем же вызовом, что и движку', () => {
  const early = createInitialState('ui-gate');
  assert.equal(expansionOpen(early, taxiDef), true, 'такси доступно сразу');
  assert.equal(expansionOpen(early, { gate: { minMonth: 10, assetContributionMonths: 0 } }),
    false, 'а гипотетическая поздняя вертикаль — нет');
});

// ----------------------------------------------------------------------------
// Сюжетные повороты и архитектурные крючки
// ----------------------------------------------------------------------------

test('сюжетные события не повторяются, обычные не идут два месяца подряд', () => {
  const seeds = ['п-1', 'п-2', 'п-3', 'п-4', 'п-5', 'п-6', 'п-7', 'п-8'];
  const onceIds = new Set(EVENTS.filter((e) => e.once).map((e) => e.id));
  for (const seed of seeds) {
    const { reports } = run(36, (s) => expansionDecisions(s), seed);
    const fired = reports.filter((r) => r.event).map((r) => r.event.id);
    const onceFired = fired.filter((id) => onceIds.has(id));
    assert.equal(onceFired.length, new Set(onceFired).size,
      `${seed}: сюжетное событие выпало дважды (${onceFired})`);
    for (let i = 1; i < fired.length; i++) {
      // fired подряд по списку — но между ними могли быть пустые месяцы;
      // проверяем именно соседние месяцы
    }
    for (let i = 1; i < reports.length; i++) {
      const a = reports[i - 1].event?.id;
      const b = reports[i].event?.id;
      if (a && b) assert.notEqual(a, b, `${seed}: событие ${a} два месяца подряд`);
    }
  }
});

test('набег федеральной экосистемы: дороже привлечение, выше отток, конечен', () => {
  const { state } = warmEcosystem('fed', 16);
  const ev = eventById('fed_ecosystem');
  const s = JSON.parse(JSON.stringify(state));
  s.pendingEvent = { ...ev };
  const raidState = step(s, { decisions: expansionDecisions(s), eventChoice: 1 }).state;
  const inRaid = step(raidState, { decisions: expansionDecisions(raidState) }).report;
  assert.ok(inRaid.fedMonthsLeft > 0, 'набег идёт');

  const calm = step(state, { decisions: expansionDecisions(state) }).report;
  const calmNext = step(step(state, { decisions: expansionDecisions(state) }).state,
    { decisions: expansionDecisions(state) }).report;
  assert.ok(inRaid.coldAcq < calmNext.coldAcq, 'холодный приток в набег дороже/меньше');
  assert.ok(inRaid.churnFoodRate > calm.churnFoodRate, 'отток еды выше');

  // Оборона короче и мягче
  const s2 = JSON.parse(JSON.stringify(state));
  s2.pendingEvent = { ...ev };
  const defended = step(s2, { decisions: expansionDecisions(s2), eventChoice: 0 });
  assert.ok(defended.state.story.fedUntil < raidState.story.fedUntil,
    'оборона сокращает набег');
  assert.ok(defended.report.oneOff > 0, 'и стоит поштучных денег');
});

test('аэропорт даёт постоянную частоту, кобренд удешевляет кросс-селл навсегда', () => {
  const { state } = warmEcosystem('perk', 16);
  const airport = eventById('airport_tender');
  const sa = JSON.parse(JSON.stringify(state));
  sa.pendingEvent = { ...airport };
  const withAirport = step(sa, { decisions: expansionDecisions(sa), eventChoice: 0 }).state;
  const after = step(withAirport, { decisions: expansionDecisions(withAirport) }).report;
  const plain = step(step(state, { decisions: expansionDecisions(state) }).state,
    { decisions: expansionDecisions(state) }).report;
  assert.ok(withAirport.story.tripsAdd > 0);
  assert.ok(after.demandTrips / after.taxiUsers > plain.demandTrips / plain.taxiUsers,
    'поездок на клиента больше');

  const bank = eventById('bank_card');
  const sb = JSON.parse(JSON.stringify(state));
  sb.pendingEvent = { ...bank };
  const withCard = step(sb, { decisions: expansionDecisions(sb), eventChoice: 0 }).state;
  assert.ok((withCard.story.crossCacMult ?? 1) < 1, 'кросс-селл дешевле навсегда');
  const cardR = step(withCard, { decisions: expansionDecisions(withCard, { crossSell: 2_000_000 }) }).report;
  const plainR = step(step(state, { decisions: expansionDecisions(state) }).state,
    { decisions: expansionDecisions(state, { crossSell: 2_000_000 }) }).report;
  assert.ok(cardR.crossConv > plainR.crossConv, 'тот же бюджет приводит больше клиентов');
});

test('дескриптор актива управляет ценой запуска вертикали', () => {
  // Архитектурный крючок для новых игр-источников: готовая инфраструктура
  // актива удешевляет родственный запуск. Проверяем через сам дескриптор.
  const asset = assetById('delivery');
  assert.ok(asset.launchCostMult.ecom < 1, 'у доставки е-ком дешевле: курьеры уже есть');
  assert.ok(Array.isArray(asset.perks) && asset.perks.includes('courier-logistics'),
    'грань актива объявлена данными');
  const s = createInitialState('mult');
  const r = step(s, { decisions: baseDecisions({ verticals: ['taxi'] }) }).report;
  assert.ok(Math.abs(r.launchCost - taxiDef.launchCost * asset.launchCostMult.taxi) < 1,
    'движок читает множитель из дескриптора');
});

test('пост-эндгейм: счёт фиксируется на финише, партия может продолжаться', () => {
  // Политика осмысленная, а не пустая: тест про фиксацию счёта, и партия
  // должна дожить до финиша, а не проверять выживаемость безучастного игрока
  const { state } = run(40, (s) => expansionDecisions(s, { finance: 3_000_000 }), 'endless');
  assert.equal(state.over, 'finished');
  assert.ok(state.scored, 'зачётный счёт зафиксирован');
  const frozen = state.scored.equityValue;

  const cont = enterEndless(state);
  assert.equal(cont.over, null, 'партия продолжается');
  const res = step(cont, { decisions: baseDecisions({ finance: 3_000_000 }) });
  assert.equal(res.report.month, CONFIG.monthsTotal + 1, 'месяцы идут дальше');
  assert.equal(res.state.scored.equityValue, frozen, 'зачётный счёт не меняется');
});

// ----------------------------------------------------------------------------
// Полная экосистема: е-ком, подписка Plus, партнёрства, активы, наследие
// ----------------------------------------------------------------------------

const ecomDef = verticalById('ecom');

// Прогретая полная экосистема: такси с 1-го, е-ком с 8-го, Plus с 10-го
function fullDecisions(s, over = {}) {
  return baseDecisions({
    verticals: ['taxi', ...(s.month + 1 >= 8 ? ['ecom'] : []),
      ...(s.taxi.on && s.month + 1 >= 10 ? ['plus'] : [])],
    partners: s.plus.on ? ['cinema', 'tickets'] : [],
    foodOps: 5_000_000,
    foodMarketing: 2_000_000,
    crossSell: s.ecom.on ? 6_000_000 : (s.taxi.on ? 3_000_000 : 0),
    mgmt: s.ecom.on ? 11_000_000 : (s.taxi.on ? 8_000_000 : 0),
    taxiSupply: s.taxi.on ? 9_000_000 : 0,
    taxiMarketing: s.taxi.on ? 14_000_000 : 0,
    ecomOps: s.ecom.on ? 4_000_000 : 0,
    ecomMarketing: s.ecom.on ? 8_000_000 : 0,
    // Разумная политика на зачётном уровне включает финансовую команду:
    // замер даёт оптимум около 3 млн ₽/мес (см. docs/ecosystem/economics.md)
    finance: 3_000_000,
    plusPrice: 299,
    ...over,
  });
}

function warmFull(seed = 'full', months = 20) {
  return run(months, (s) => fullDecisions(s), seed);
}

test('е-ком выходит за воротами по метрикам и дешевле с логистикой хаба', () => {
  const early = createInitialState('ecom-gate');
  assert.equal(expansionOpen(early, ecomDef), false, 'до 8-го месяца ворота закрыты');
  const { state } = warmFull('ecom-gate', 12);
  assert.equal(state.ecom.on, true, 'е-ком запущен после ворот');
  const launch = state.history.find((r) => r.ecomLaunched);
  assert.ok(launch, 'запуск виден в отчёте');
  const asset = assetById('delivery');
  assert.ok(asset.launchCostMult.ecom < 1);
  assert.ok(Math.abs(launch.launchCost - ecomDef.launchCost * asset.launchCostMult.ecom) < 1,
    'скидка логистики применена к цене запуска');
});

test('мощность логистики: чек, отток и кросс-селл против общего парка', () => {
  const { state } = warmFull('logi-cap', 14);
  assert.ok(state.ecom.on, 'е-ком запущен');
  const at = (budget) => step(state, {
    decisions: fullDecisions(state, { ecomLogistics: budget }),
  }).report;
  const zero = at(0);
  const mid = at(3_000_000);
  const high = at(12_000_000);

  assert.equal(zero.ecomCapacity, 0, 'без бюджета мощности нет');
  assert.ok(mid.ecomCapacity > 0 && high.ecomCapacity > mid.ecomCapacity, 'мощность растёт с бюджетом');
  assert.ok(high.ecomCapacity < 1, 'предел не достигается — насыщение');

  assert.ok(mid.arpuEcom > zero.arpuEcom, 'привезли вовремя — корзина крупнее');
  assert.ok(mid.churnEcomRate < zero.churnEcomRate, 'и отток ниже');
  assert.ok(mid.marginEcom > zero.marginEcom, 'своя мощность дешевле подряда');
  assert.ok(mid.crossEcomConv > zero.crossEcomConv, 'база охотнее пробует посылки');

  // Общий парк курьеров: мощность, ушедшая в посылки, снимается с пиков хаба
  assert.ok(high.logistics, 'актив с курьерами');
  assert.ok(high.foodQuality < zero.foodQuality, 'качество стартового сервиса платит за мощность');

  // Рычаг обязан быть решением, а не кнопкой «лучше»: максимум разоряет
  assert.ok(high.ecomFullContribution < mid.ecomFullContribution,
    'предельная мощность не окупается — у рычага есть внутренний оптимум');
});

test('общая логистика: маржа е-кома выше, но качество еды платит за пики', () => {
  const { state } = warmFull('logi', 16);
  assert.ok(state.ecom.on);
  const r = step(state, { decisions: fullDecisions(state) }).report;
  assert.ok(r.logistics, 'перк курьерской логистики активен');
  assert.ok(r.marginEcom > ecomDef.margin, 'маржа выше базовой');
  // Тот же холдинг без перка (стриминговый хаб): маржа ниже, еда целее
  let sStream = createInitialState('logi-s', 'streaming');
  for (let i = 0; i < 16 && !sStream.over; i++) {
    if (sStream.month >= 2 && sStream.cash < 120_000_000) {
      sStream = raise(sStream, CONFIG.fundingOptions[1]).state;
    }
    sStream = step(sStream, { decisions: fullDecisions(sStream), eventChoice: 0 }).state;
  }
  if (sStream.ecom.on) {
    const rs = step(sStream, { decisions: fullDecisions(sStream) }).report;
    assert.ok(!rs.logistics);
    assert.ok(rs.marginEcom < r.marginEcom, 'без перка маржа ниже');
  }
});

test('подписка Plus: конверсия из мульти-клиентов, цена против массовости', () => {
  const { state } = warmFull('plus', 18);
  assert.equal(state.plus.on, true);
  assert.ok(state.plus.subs > 1000, 'подписчики копятся');
  assert.ok(state.plus.subs <= multiUsers(state) + 1e-6, 'подписчики — подмножество мульти');

  const cheap = step(state, { decisions: fullDecisions(state, { plusPrice: 199 }) }).report;
  const dear = step(state, { decisions: fullDecisions(state, { plusPrice: 399 }) }).report;
  assert.ok(cheap.plusConv > dear.plusConv, 'дешёвая подписка конвертит лучше');
  assert.ok(dear.revenuePlus / Math.max(1, dear.plusSubs)
    > cheap.revenuePlus / Math.max(1, cheap.plusSubs), 'дорогая берёт больше с подписчика');
});

test('Plus покупает удержание: отток мульти-клиентов ниже при подписке', () => {
  const { state } = warmFull('plus-ret', 18);
  const withSubs = step(state, { decisions: fullDecisions(state) }).report;
  const noSubs = JSON.parse(JSON.stringify(state));
  noSubs.plus.subs = 0;
  const without = step(noSubs, { decisions: fullDecisions(noSubs) }).report;
  assert.ok(withSubs.lostFood < without.lostFood, 'отток хаба ниже с подписчиками');
  assert.ok(withSubs.lostTaxi < without.lostTaxi, 'и такси тоже');
});

test('подписка сама по себе почти не зарабатывает — дилемма Amazon Prime', () => {
  const { state } = warmFull('plus-econ', 20);
  const r = step(state, { decisions: fullDecisions(state, { plusPrice: 199 }) }).report;
  const perSub = (r.revenuePlus - r.plusPerkCost) / Math.max(1, r.plusSubs);
  assert.ok(perSub < 60, `на массовой цене подписка почти в ноль: ${perSub.toFixed(0)} ₽`);
});

test('партнёрства: лицензия кино усиливает Plus, билеты дают событийную выручку', () => {
  const { state } = warmFull('partners', 18);
  const withP = step(state, { decisions: fullDecisions(state) }).report;
  const withoutP = step(state, { decisions: fullDecisions(state, { partners: [] }) }).report;
  assert.ok(withP.licenseFee > 0, 'лицензия платная для доставки-хаба');
  assert.ok(withP.plusConv > withoutP.plusConv, 'с кино подписка конвертит лучше');
  assert.ok(withP.revenueTickets > 0 && withoutP.revenueTickets === 0);
});

test('стартовые активы — данными: у стриминга свой контент, у билетов партнёрство', () => {
  const stream = createInitialState('a-s', 'streaming');
  assert.equal(cinemaLicenseFee(stream), 0, 'своему контенту лицензия не нужна');
  assert.ok(plusLaunchCost(stream) < CONFIG.plus.launchCost, 'привычка платить удешевляет Plus');
  const tick = createInitialState('a-t', 'tickets');
  assert.equal(ticketsPartnerFee(tick), 0, 'своим билетам абонентка не нужна');
  assert.ok(tick.cash < stream.cash, 'у билетов казна меньше — сложный класс');
});

test('наследие: бонусы применяются и складываются, но не решают партию', () => {
  const plain = createInitialState('legacy', 'delivery');
  const blessed = createInitialState('legacy', 'delivery', { asset: true, cinema: true, tickets: true });
  // Наследие даёт льготу на первый год, а не ренту на всю партию: снятая
  // навсегда абонентка компаундилась и давала +11.5% к итогу (замер).
  assert.equal(cinemaLicenseFee(blessed),
    CONFIG.partners.cinemaLicenseMonthly * CONFIG.legacyCarry.cinemaFeeMult);
  assert.equal(ticketsPartnerFee(blessed),
    CONFIG.partners.ticketsMonthly * CONFIG.legacyCarry.ticketsFeeMult);
  assert.equal(cinemaLicenseFee(plain), CONFIG.partners.cinemaLicenseMonthly);

  // После льготного года платят все одинаково
  const later = { ...blessed, month: CONFIG.legacyCarry.graceMonths };
  assert.equal(cinemaLicenseFee(later), CONFIG.partners.cinemaLicenseMonthly,
    'льгота на лицензию кончается через год');
  assert.equal(ticketsPartnerFee(later), CONFIG.partners.ticketsMonthly,
    'льгота на партнёрство кончается через год');

  // По одному сиду наследие не мерят: разница попадает в шум событий и
  // таймингов раундов. Усредняем по нескольким партиям — как в замерах.
  const runLeg = (legacy, seed = 'legacy-run') => {
    let s = createInitialState(seed, 'delivery', legacy);
    for (let i = 0; i < 36 && !s.over; i++) {
      // Подушка под события: раунд при тонкой кассе, а не только при убытке
      if (s.month >= 2 && s.cash < 120_000_000) {
        s = raise(s, CONFIG.fundingOptions[1]).state;
      }
      // Капитальные варианты событий — только при живой кассе:
      // так их и задумано выбирать (см. аудит доминации в events.js)
      const ev = s.pendingEvent?.id;
      const choice = ev === 'truce_offer' ? 1
        : (ev === 'fed_ecosystem' || ev === 'data_leak') && s.cash < 200_000_000 ? 1
        : 0;
      s = step(s, { decisions: fullDecisions(s), eventChoice: choice }).state;
    }
    const f = finalScore(s);
    return f.bankrupt ? 0 : f.equityValue;
  };
  const seeds = ['legacy-run', 'legacy-2', 'legacy-3', 'legacy-4', 'legacy-5', 'legacy-6'];
  const avg = (legacy) => seeds.reduce((a, seed) => a + runLeg(legacy, seed), 0) / seeds.length;
  const base = avg({});
  const full = avg({ asset: true, cinema: true, tickets: true });
  const lift = full / base - 1;
  assert.ok(lift > 0.005, `стак наследия должен чувствоваться: ${(lift * 100).toFixed(1)}%`);
  assert.ok(lift < 0.20, `но не решать партию: ${(lift * 100).toFixed(1)}%`);
});

test('хаб-топология: уникальные и мульти согласованы при трёх вертикалях', () => {
  const { reports } = warmFull('topo', 30);
  for (const r of reports) {
    assert.ok(Math.abs(r.uniqueUsers
      - (r.foodUsers + r.taxiUsers + r.ecomUsers - r.bothUsers - r.bothEcomUsers)) < 1e-6,
      `м${r.month}: уникальные = сумма − пересечения`);
    assert.ok(r.multiUsers <= r.foodUsers + 1e-6, 'мульти — клиенты хаба');
    assert.ok(r.plusSubs <= r.multiUsers + 1e-6, 'подписчики — подмножество мульти');
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'number') assert.ok(Number.isFinite(v), `${k} м${r.month}`);
    }
  }
});

test('третий акт: в последний год убыточные части дисконтируются жёстче', () => {
  const { state } = warmFull('act3', 30);
  const sopNow = sumOfParts(state);
  assert.equal(sopNow.thirdAct, true, 'третий акт активен');
  const early = JSON.parse(JSON.stringify(state));
  early.month = 12;
  assert.equal(sumOfParts(early).thirdAct, false);
});

test('шкала вердиктов у каждого актива своя и упорядочена', () => {
  // Замеры дали разные потолки: доставка 13.6, стриминг 13.7, билеты 3.4 млрд.
  // Общая шкала объявляла бы отличную партию за билеты «скромным итогом»,
  // поэтому пороги живут в дескрипторе — и должны быть согласованы.
  for (const asset of START_ASSETS) {
    const g = asset.grades;
    assert.ok(g, `${asset.id}: у актива есть шкала вердиктов`);
    assert.ok(g.excellent > g.solid && g.solid > g.survived && g.survived > 0,
      `${asset.id}: пороги строго убывают`);
    assert.ok(g.worthy >= g.solid && g.worthy <= g.excellent,
      `${asset.id}: «достойный финал» лежит между крепким и отличным`);
  }
  const byId = Object.fromEntries(START_ASSETS.map((a) => [a.id, a.grades]));
  assert.ok(byId.tickets.excellent < byId.delivery.excellent,
    'у сложного актива планка ниже: иначе она недостижима');
});

test('кризис середины партии приходит сам и его исход остаётся навсегда', () => {
  // Середина партии проседала по решениям: запуски позади, третий акт впереди.
  // Антимонопольное дело — единственное событие с расписанием, а не с костью.
  const grown = (choice) => {
    let s = createInitialState('дело', 'delivery', {});
    for (let i = 0; i < 26 && !s.over; i++) {
      if (s.month >= 2 && s.cash < 150e6) s = raise(s, CONFIG.fundingOptions[1]).state;
      const m = s.month + 1;
      const ev = s.pendingEvent?.id;
      s = step(s, {
        decisions: {
          ...DEFAULT_DECISIONS,
          verticals: [
            ...(m >= 1 ? ['taxi'] : []), ...(m >= 8 ? ['ecom'] : []),
            ...(m >= 10 && s.taxi.on ? ['plus'] : []),
          ],
          crossSell: 4e6, mgmt: 9e6, foodOps: 5e6, taxiSupply: 9e6,
          taxiMarketing: 12e6, ecomOps: 2e6, ecomMarketing: 6e6,
        },
        eventChoice: ev === 'antitrust' ? choice : 0,
      }).state;
    }
    return s;
  };
  const split = grown(0);
  assert.ok(split.seenEvents.includes('antitrust'),
    'к 26-му месяцу дело случилось: оно приходит принудительно, а не по кости');
  assert.equal(split.story.logisticsSplit, true, 'исход «отделить логистику» закреплён');

  const opened = grown(1);
  assert.ok((opened.story.plusChurnAdd ?? 0) > 0, 'открытая подписка навсегда теряет удержание');
  assert.ok((opened.story.ecoReliefCut ?? 0) > 0, 'и склейка экосистемы слабеет');

  const sued = grown(2);
  assert.equal(sued.story.supervision, true, 'после суда остаётся надзор');
  const legalPaid = sued.history.some((r) => r.legalCost > 0);
  assert.ok(legalPaid, 'юристы попали в расходы месяца');
  const legalOver = sued.history[sued.history.length - 1].legalMonthsLeft;
  assert.equal(legalOver, 0, 'дело конечно: юристы не платятся вечно');
});

test('дело не приходит, пока холдингу нечего связывать', () => {
  // Без подписки и без общей логистики выбор в деле был бы фиктивным
  let s = createInitialState('без-склейки', 'streaming', {});
  for (let i = 0; i < 26 && !s.over; i++) {
    if (s.month >= 2 && s.cash < 150e6) s = raise(s, CONFIG.fundingOptions[1]).state;
    s = step(s, {
      decisions: {
        ...DEFAULT_DECISIONS,
        verticals: s.month >= 0 ? ['taxi'] : [],
        crossSell: 3e6, mgmt: 6e6, foodOps: 5e6, taxiSupply: 9e6, taxiMarketing: 12e6,
      },
      eventChoice: 0,
    }).state;
  }
  assert.ok(!s.seenEvents.includes('antitrust'),
    'без подписки и общей логистики связывать нечего — дела нет');
});

test('касса и оценка прошлой игры переносятся в старт, но с потолком', () => {
  const asset = assetById('delivery');
  const base = createInitialState('перенос', 'delivery', {});
  assert.equal(base.cash, asset.startCash, 'без наследия — базовая казна актива');

  // Крепкая победа (ровно порог) ничего не добавляет: прибавка растёт
  // с того, что вы заработали СВЕРХ крепкого финала
  const solid = createInitialState('перенос', 'delivery', { asset: true, assetRatio: 1 });
  assert.equal(solid.cash, asset.startCash);

  const big = createInitialState('перенос', 'delivery', { asset: true, assetRatio: 3 });
  assert.ok(big.cash > solid.cash, 'крупный финал приносит кассу в новую партию');
  const huge = createInitialState('перенос', 'delivery', { asset: true, assetRatio: 40 });
  assert.ok(huge.cash / asset.startCash <= 1 + CONFIG.legacyCarry.cashCap + 1e-9,
    'перенос кассы ограничен: рекорд прошлой партии не решает новую');

  // Оценка прошлой компании — репутация у инвесторов: растёт пол оценки
  assert.ok(legacyValuationFloor({ assetRatio: 3 }) > legacyValuationFloor({}),
    'крупный финал поднимает пол оценки в раунде');
  assert.ok(legacyValuationFloor({ assetRatio: 40 })
    <= CONFIG.valuationFloor * (1 + CONFIG.legacyCarry.floorCap) + 1,
    'пол оценки тоже ограничен');

  // Раунд на старте по перенесённой репутации дороже для инвестора
  const offerPlain = fundingOffer(base, CONFIG.fundingOptions[1]);
  const offerCarried = fundingOffer(big, CONFIG.fundingOptions[1]);
  assert.ok(offerCarried.dilution < offerPlain.dilution,
    'та же сумма стоит меньшей доли: прошлая оценка работает');
});

test('год конгломерата: свой акт, свои правила, зачётный счёт заморожен', () => {
  let s = createInitialState('пост', 'delivery', {});
  const dec = (st) => ({
    ...DEFAULT_DECISIONS,
    verticals: [
      ...(st.month >= 0 ? ['taxi'] : []), ...(st.month >= 8 ? ['ecom'] : []),
      ...(st.month >= 10 && st.taxi.on ? ['plus'] : []),
    ],
    crossSell: 4e6, mgmt: 10e6, foodOps: 5e6, foodMarketing: 2e6,
    taxiSupply: 9e6, taxiMarketing: 12e6, ecomOps: 2e6, ecomMarketing: 6e6,
    ecomLogistics: 3e6, finance: 3e6,
  });
  while (!s.over) {
    if (s.month >= 2 && s.cash < 120e6) s = raise(s, CONFIG.fundingOptions[1]).state;
    s = step(s, { decisions: dec(s), eventChoice: 0 }).state;
  }
  assert.equal(s.over, 'finished');
  const ranked = s.scored.equityValue;

  s = enterEndless(s);
  assert.equal(s.over, null, 'акт продолжает ту же партию');
  assert.equal(s.board.goal.type, 'conglomerate', 'совет ставит цель акта');
  assert.equal(s.endlessUntil, CONFIG.monthsTotal + CONFIG.endless.months);

  // Раунды закрыты: главное ограничение акта
  const before = s.equity;
  const attempt = raise(s, CONFIG.fundingOptions[2]);
  assert.equal(attempt.offer, null, 'раунд в акте не выдаётся');
  assert.equal(attempt.state.equity, before, 'доля не размывается');
  assert.equal(attempt.state.cash, s.cash, 'касса не пополняется');

  while (!s.over) s = step(s, { decisions: dec(s), eventChoice: 0 }).state;
  assert.equal(s.over, 'endless-done', 'акт конечен: год и не больше');
  assert.equal(s.month, CONFIG.monthsTotal + CONFIG.endless.months);
  assert.equal(s.scored.equityValue, ranked, 'зачётный счёт партии не переписан');

  const e = endlessScore(s);
  assert.equal(e.rankedValue, ranked);
  assert.ok(Number.isFinite(e.growth) && Number.isFinite(e.multiShare));
  assert.equal(typeof e.goalDone, 'boolean');
  // Рост считается от замороженного счёта, а не от нуля
  assert.ok(Math.abs(e.growth - (e.equityValue / ranked - 1)) < 1e-9);
});

// ----------------------------------------------------------------------------
// Финансовая команда и уровни сложности
// ----------------------------------------------------------------------------

test('финансовая команда: сила растёт с бюджетом, а цена — с выручкой холдинга', () => {
  const s = createInitialState('fin', 'delivery', {}, 'normal');
  assert.equal(financeLevel(s, baseDecisions()), 0, 'без бюджета команды нет');
  const mid = financeLevel(s, baseDecisions({ finance: financeSaturation(s) }));
  assert.ok(Math.abs(mid - 0.5) < 1e-9, 'на насыщении ровно половина силы');
  assert.ok(financeLevel(s, baseDecisions({ finance: 50_000_000 })) < 1, 'полной силы не купить');

  // Цена команды считается долей выручки: у крупного холдинга она выше
  const { state: grown } = warmFull('fin-grown', 20);
  assert.ok(financeSaturation(grown) > financeSaturation(s),
    'выросшему холдингу нужна более дорогая финансовая служба');

  // Прочие расходы: слабая служба стоит молча, сильная режет строку
  assert.ok(miscRate(s, baseDecisions()) > miscRate(s, baseDecisions({ finance: 10_000_000 })));
  const r = step(s, { decisions: baseDecisions({ finance: 4_000_000 }) }).report;
  assert.ok(Math.abs(r.miscCost - r.revenue * r.miscRate) < 1, 'строка считается от выручки');
  assert.ok(r.miscCost > 0 && r.financeCost === 4_000_000, 'обе строки в P&L');
});

test('уровни сложности: одни механики, разная цена финансовой команды', () => {
  const decisions = baseDecisions({ finance: 3_000_000 });
  const level = {};
  const misc = {};
  for (const d of DIFFICULTIES) {
    const s = createInitialState('diff', 'delivery', {}, d.id);
    level[d.id] = financeLevel(s, decisions);
    misc[d.id] = miscRate(s, decisions);
    // Механики не подменяются: город, актив и рычаги те же
    assert.equal(s.assetId, 'delivery');
    assert.equal(s.difficulty, d.id);
  }
  assert.equal(level.easy, 1, 'на лёгком команда уже собрана');
  assert.ok(level.normal > level.hard, 'за те же деньги на сложном покупается меньше');
  assert.ok(misc.easy < misc.normal && misc.normal < misc.hard, 'прочие расходы растут со сложностью');

  // Лёгкий уровень не стоит игроку ничего
  const easy = createInitialState('diff', 'delivery', {}, 'easy');
  const rEasy = step(easy, { decisions }).report;
  assert.equal(rEasy.financeCost, 0, 'на лёгком команду содержит не игрок');
  assert.equal(rEasy.financeLevel, 1);

  // Ранжируются обычный и сложный, и разными таблицами
  assert.equal(difficultyById('easy').ranked, false);
  assert.equal(difficultyById('normal').ranked, true);
  assert.equal(difficultyById('hard').ranked, true);
  assert.notEqual(difficultyById('hard').tagSuffix, difficultyById('normal').tagSuffix);
  assert.equal(difficultyById('чужое').id, 'normal', 'неизвестный уровень — зачётный');
});

test('финансовая команда улучшает условия раунда, но не счёт', () => {
  const { state } = warmFull('fin-round', 14);
  const weak = { ...state, decisions: { ...state.decisions, finance: 0 } };
  const strong = { ...state, decisions: { ...state.decisions, finance: 15_000_000 } };
  assert.ok(financeRoundMult(strong) > financeRoundMult(weak));
  const offerWeak = fundingOffer(weak, CONFIG.fundingOptions[1]);
  const offerStrong = fundingOffer(strong, CONFIG.fundingOptions[1]);
  assert.ok(offerStrong.dilution < offerWeak.dilution,
    'за те же деньги отдаёте меньшую долю');
  // Оценку холдинга рынок считает сам — упаковка на неё не влияет
  assert.equal(valuation(strong), valuation(weak));
});

test('модель торговли: площадка дешевле в фиксе и капитале, склад — жирнее с клиента', () => {
  const { state } = warmFull('model', 14);
  assert.ok(state.ecom.on);
  const at = (own) => step(state, {
    decisions: fullDecisions(state, { ecomOwnShare: own, ecomLogistics: 3_000_000 }),
  }).report;
  const platform = at(0);
  const own = at(1);

  assert.ok(own.arpuEcom > platform.arpuEcom, 'у своего склада весь чек — выручка');
  assert.ok(own.marginEcom < platform.marginEcom, 'зато маржа товарная, а не комиссионная');
  assert.ok(own.contribEcom > platform.contribEcom, 'вклад с клиента у склада больше');
  assert.ok(own.fixedEcom > platform.fixedEcom, 'фикс е-кома — это склады');
  assert.ok(own.ecomWorkingCapital > 0 && platform.ecomWorkingCapital === 0,
    'товар покупают заранее — но только свой');
  assert.ok(platform.churnEcomRate > own.churnEcomRate,
    'качество чужого продавца вы не контролируете');
  assert.ok(platform.crossEcomConv > own.crossEcomConv,
    'чужие продавцы наполняют витрину быстрее');

  // Смешанная модель лежит между крайностями по всем осям
  const mixed = at(0.5);
  assert.ok(mixed.arpuEcom > platform.arpuEcom && mixed.arpuEcom < own.arpuEcom);
  assert.ok(mixed.fixedEcom > platform.fixedEcom && mixed.fixedEcom < own.fixedEcom);
});

test('престижная трата: считается заранее и не окупается никогда', () => {
  // Форма предложения: платная опция и бесплатный отказ, эффект — на месяц
  const permanent = ['splitLogistics', 'supervisionOn', 'legalMonths', 'plusChurnAdd',
    'ecoReliefCut', 'crossCacMult', 'crossReachMult', 'tripsPerUserAdd', 'lockAdd',
    'valuationBonus', 'trustMonths', 'fedMonths', 'crisisMonths'];
  for (const ev of VANITY_EVENTS) {
    assert.equal(ev.options.length, 2, `${ev.id}: купить или отказаться`);
    const buy = ev.options[0].effects;
    const skip = ev.options[1].effects;
    assert.ok(buy.oneOffCostPerUniqueUser > 0, `${ev.id}: цена растёт с размером холдинга`);
    assert.deepEqual(skip, {}, `${ev.id}: отказ не стоит ничего и ничем не грозит`);
    for (const key of permanent) {
      assert.ok(!(key in buy), `${ev.id}: у престижной траты нет постоянных эффектов (${key})`);
    }
    assert.ok(eventById(ev.id), `${ev.id}: событие находится по идентификатору`);
  }

  // За партию приходит не больше одной: урок один
  const rng = createRngLike();
  const seen = VANITY_EVENTS.map((e) => e.id).slice(0, 1);
  for (let i = 0; i < 200; i++) {
    const picked = rollEvent(rng, 20, {}, { taxiOn: true, glued: true, seen, lastId: null });
    if (picked) {
      assert.ok(!VANITY_EVENTS.some((e) => e.id === picked.id),
        'вторая престижная трата за партию не приходит');
    }
  }

  // И главное: купить хуже, чем отказаться, — на всех сидах
  const play = (choice) => {
    const seeds = ['в-1', 'в-2', 'в-4', 'в-6', 'в-9', 'в-10'];
    let sum = 0;
    for (const seed of seeds) {
      let st = createInitialState(seed, 'delivery', {}, 'normal');
      for (let i = 0; i < CONFIG.monthsTotal && !st.over; i++) {
        if (st.month >= 2 && st.cash < 120_000_000) {
          st = raise(st, CONFIG.fundingOptions[1]).state;
        }
        const ev = st.pendingEvent?.id;
        const vanity = VANITY_EVENTS.some((e) => e.id === ev);
        st = step(st, {
          decisions: fullDecisions(st),
          eventChoice: vanity ? choice : (ev === 'truce_offer' ? 1 : 0),
        }).state;
      }
      const f = finalScore(st);
      sum += f.bankrupt ? 0 : f.equityValue;
    }
    return sum / seeds.length;
  };
  const bought = play(0);
  const declined = play(1);
  assert.ok(bought < declined,
    `купленная престижная трата обязана быть хуже отказа: ${(bought / declined - 1) * 100}%`);
});

// Простейший детерминированный генератор для проверки пула событий
function createRngLike() {
  let x = 12345;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}
