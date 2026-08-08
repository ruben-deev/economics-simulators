// ============================================================================
// Ядро симуляции. Чистые функции: step(state) -> {state, report}.
// Никакой работы с DOM — модуль можно гонять в тестах и в ноутбуке.
//
// Смысловая структура модели (её же объясняем игроку):
//
//   маркетинг -> узнаваемость -> пробные заказы -> база клиентов (запас)
//                                                        |
//   цена, скорость, ассортимент  ------------------> частота заказов
//                                                        |
//                                             спрос = база x частота
//                                                        |
//                                   пропускная способность курьеров (ограничение)
//                                                        |
//                                   выполненные заказы -> выручка -> P&L -> касса
//
// Ключевая обратная связь: не хватает курьеров -> растёт время доставки ->
// падает удовлетворённость -> растёт отток клиентов -> спрос падает.
// ============================================================================

import { CONFIG, DISTRICTS, DEFAULT_DECISIONS } from './config.js';
import { createRng } from './rng.js';
import { neutralModifiers, applyEvent, rollEvent } from './events.js';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const safe = (x, fallback = 0) => (Number.isFinite(x) ? x : fallback);

export function districtById(id) {
  return DISTRICTS.find((d) => d.id === id);
}

// Средний чек района зависит от уровня дохода
export function aovOf(district) {
  return CONFIG.aovBase * Math.pow(district.income, CONFIG.aovIncomeExponent);
}

// Доступный вам рынок района: часть жителей прочно сидит у конкурента.
// Это потолок охвата — сколько ни трать на маркетинг, всех не заберёшь.
export function reachableOf(district) {
  return district.potential * (1 - district.competitor * CONFIG.competitorLock);
}

// ----------------------------------------------------------------------------
// Начальное состояние
// ----------------------------------------------------------------------------
export function createInitialState(seed = 'novograd') {
  const rng = createRng(seed);
  return {
    seed,
    rngState: rng.state(),
    week: 0,
    cash: CONFIG.startCash,
    equity: 1,               // доля основателей, 1.0 = 100%
    raisedTotal: 0,
    techStock: 0,
    couriers: 0,
    courierMorale: 1,        // отношение заработка курьера к рынку на прошлой неделе
    decisions: { ...DEFAULT_DECISIONS, districts: [] },
    districts: Object.fromEntries(
      DISTRICTS.map((d) => [d.id, {
        id: d.id,
        active: false,
        launchedWeek: null,
        awareness: 0,
        customers: 0,
        restaurants: 0,
        deliveryTime: d.baseTime,
        satisfaction: 1,
      }])
    ),
    flags: { commissionDelta: 0, valuationBonus: 0, regulationRisk: false },
    pendingEvent: null,
    pendingChoice: null,
    history: [],
    over: null,   // 'bankrupt' | 'finished'
  };
}

// ----------------------------------------------------------------------------
// Производные показатели
// ----------------------------------------------------------------------------

export function techLevel(state) {
  return state.techStock / (state.techStock + CONFIG.techSaturation);
}

// Заказов в неделю на одного курьера с учётом плеча доставки, технологий и мотивации.
// Недоплаченный курьер не увольняется мгновенно — он просто работает вполсилы
// и берёт заказы у конкурента (мультиаппинг). Мораль берётся с лагом в неделю.
export function ordersPerCourier(state, avgDistanceKm, capacityMult = 1) {
  const t = techLevel(state);
  const distanceFactor = Math.pow(CONFIG.courierRefDistanceKm / Math.max(0.5, avgDistanceKm), 0.45);
  const morale = clamp(0.85 + 0.15 * (state.courierMorale ?? 1), 0.75, 1.08);
  return CONFIG.courierBaseOrders * (1 + 0.35 * t) * distanceFactor * morale * capacityMult;
}

// Сезонность: годовая волна + новогодний всплеск
function seasonality(week) {
  const wave = 1 + 0.10 * Math.sin((2 * Math.PI * (week - 6)) / 52);
  const newYear = week % 52 >= 50 || week % 52 <= 1 ? 1.15 : 1;
  return wave * newYear;
}

// Эффективная комиссия с учётом сделок с сетями
function effectiveCommission(state, decisions) {
  return clamp(decisions.commissionRate + state.flags.commissionDelta, 0.02, 0.45);
}

// ----------------------------------------------------------------------------
// Главный шаг симуляции
// ----------------------------------------------------------------------------
export function step(prevState, input = {}) {
  const state = structuredClone(prevState);
  if (state.over) return { state, report: state.history[state.history.length - 1] ?? null };

  const decisions = { ...state.decisions, ...(input.decisions ?? {}) };
  state.decisions = decisions;

  const rng = createRng(state.seed);
  rng.restore(state.rngState);

  const week = state.week + 1;

  // --- 1. Событие недели (было объявлено в конце прошлой недели) ---
  const mods = neutralModifiers();
  const event = state.pendingEvent;
  const choice = input.eventChoice ?? state.pendingChoice ?? 0;
  applyEvent(mods, event, choice);
  if (mods.commissionOverrideDelta) state.flags.commissionDelta += mods.commissionOverrideDelta;
  if (mods.valuationBonus) state.flags.valuationBonus += mods.valuationBonus;
  if (mods.regulationRisk) state.flags.regulationRisk = true;

  // --- 2. Запуск и закрытие районов ---
  const wanted = new Set(decisions.districts ?? []);
  let launchCost = 0;
  const launched = [];
  const closed = [];
  for (const def of DISTRICTS) {
    const ds = state.districts[def.id];
    if (wanted.has(def.id) && !ds.active) {
      ds.active = true;
      ds.launchedWeek = week;
      ds.deliveryTime = def.baseTime;
      // Часть жителей уже привыкла заказывать еду — стартовое ядро аудитории
      ds.awareness = Math.max(ds.awareness, 0.02);
      ds.customers = Math.max(ds.customers, reachableOf(def) * 0.005);
      launchCost += def.launchCost;
      launched.push(def.name);
    } else if (!wanted.has(def.id) && ds.active) {
      ds.active = false;
      ds.customers = 0;
      ds.restaurants = 0;
      closed.push(def.name);
    }
  }

  const activeDefs = DISTRICTS.filter((d) => state.districts[d.id].active);
  const commission = effectiveCommission(state, decisions);
  const season = seasonality(week);

  // --- 3. Спрос по районам (время доставки берём прошлой недели — лаг обратной связи) ---
  const totalPotentialActive = activeDefs.reduce((s, d) => s + d.potential, 0) || 1;
  const perDistrict = [];
  let totalDemand = 0;

  for (const def of activeDefs) {
    const ds = state.districts[def.id];
    const aov = aovOf(def);
    const customerPrice = aov + decisions.deliveryFee - decisions.promo;
    const refPrice = aov + CONFIG.refDeliveryFee;
    const priceFactor = clamp(Math.pow(refPrice / Math.max(50, customerPrice), def.elasticity), 0.2, 2.5);

    const selRaw = ds.restaurants / (ds.restaurants + 50);
    const selRef = CONFIG.refRestaurants / (CONFIG.refRestaurants + 50);
    const selectionFactor = clamp(selRaw / selRef, 0, 1.35);

    const speedFactor = clamp(Math.pow(CONFIG.refDeliveryTime / Math.max(8, ds.deliveryTime), 0.6), 0.4, 1.3);

    const freq = def.baseFreq
      * priceFactor
      * Math.pow(speedFactor, 0.5)
      * Math.pow(Math.max(0.001, selectionFactor), 0.5)
      * season
      * mods.demandMult;

    const demand = ds.customers * freq;
    totalDemand += demand;
    perDistrict.push({ def, ds, aov, priceFactor, selectionFactor, speedFactor, freq, demand });
  }

  // --- 4. Пропускная способность курьеров ---
  const demandWeight = totalDemand > 0 ? totalDemand : 1;
  const avgDistance = perDistrict.length
    ? perDistrict.reduce((s, p) => s + p.def.distanceKm * (totalDemand > 0 ? p.demand : p.def.potential), 0)
      / (totalDemand > 0 ? demandWeight : activeDefs.reduce((s, d) => s + d.potential, 0) || 1)
    : CONFIG.courierRefDistanceKm;

  const perCourier = ordersPerCourier(state, avgDistance, mods.capacityMult);
  const capacity = state.couriers * perCourier;
  const utilization = capacity > 0 ? totalDemand / capacity : (totalDemand > 0 ? 3 : 0);
  const fillRate = capacity > 0 ? Math.min(1, capacity / Math.max(1e-9, totalDemand)) : 0;

  let orders = 0;
  let gmv = 0;
  let paymentBase = 0;

  for (const p of perDistrict) {
    p.served = p.demand * fillRate;
    // Новое время доставки: перегрузка кубически бьёт по скорости
    const congestion = 1 + 0.85 * Math.pow(Math.min(utilization, 2.2), 3);
    p.newTime = state.couriers > 0
      ? clamp(p.def.baseTime * congestion * (1 - 0.12 * techLevel(state)), 10, 120)
      : 120;
    orders += p.served;
    gmv += p.served * p.aov;
    paymentBase += p.served * (p.aov + decisions.deliveryFee - decisions.promo);
  }

  // --- 5. P&L недели ---
  const commissionRevenue = gmv * commission;
  const feeRevenue = orders * decisions.deliveryFee;
  const netRevenue = commissionRevenue + feeRevenue;

  const courierCost = orders * decisions.courierPay;
  const promoCost = orders * decisions.promo;
  const paymentCost = Math.max(0, paymentBase) * CONFIG.paymentFeeRate;
  const supportCost = orders * Math.max(2,
    CONFIG.supportCostPerOrder - CONFIG.supportTechDiscount * techLevel(state) + mods.variableCostAdd);
  const variableCost = courierCost + promoCost + paymentCost + supportCost;
  const contribution = netRevenue - variableCost;

  const districtFixed = activeDefs.reduce((s, d) => s + d.weeklyFixed, 0);
  const hqCost = CONFIG.hqWeeklyBase + CONFIG.hqPerCourier * state.couriers;

  // --- 6. Курьеры: наём и отток ---
  // Курьер оценивает не фактический, а ожидаемый заработок: он видит ставку и
  // рассчитывает набрать хотя бы 60% полной смены. Поэтому у ставки есть «пол».
  const realizedPerCourier = state.couriers > 0 ? orders / state.couriers : 0;
  const expectedOrdersPerCourier = Math.max(realizedPerCourier, perCourier * CONFIG.courierExpectedLoad);
  const courierEarnings = expectedOrdersPerCourier * decisions.courierPay;
  const attractiveness = courierEarnings / CONFIG.courierMarketWeeklyPay;
  // Удержание же зависит от фактического заработка: простой злит не меньше низкой ставки.
  const realizedEarnings = state.couriers > 0
    ? realizedPerCourier * decisions.courierPay
    : courierEarnings;
  const realizedAttractiveness = realizedEarnings / CONFIG.courierMarketWeeklyPay;

  const avgAwareness = activeDefs.length
    ? activeDefs.reduce((s, d) => s + state.districts[d.id].awareness, 0) / activeDefs.length
    : 0;

  // Предложение труда: отклики появляются, только когда заработок обгоняет рынок
  const applicants = CONFIG.courierApplicantsBase
    * clamp((attractiveness - CONFIG.courierHireThreshold) / CONFIG.courierHireSpan, 0, 1.4)
    * (1 + 0.6 * avgAwareness)
    * mods.courierSupplyMult
    * (activeDefs.length ? 1 : 0);

  const churnRate = clamp(
    CONFIG.courierBaseChurn
    + Math.max(0, 1 - realizedAttractiveness) * 0.35
    + Math.max(0, utilization - 0.9) * 0.35
    + mods.courierChurnAdd,
    0, 0.7
  );
  state.courierMorale = state.couriers > 0 ? realizedAttractiveness : 1;
  const courierLeft = state.couriers * churnRate;
  const target = Math.max(0, Math.round(decisions.targetCouriers));
  const after = state.couriers - courierLeft;
  const hires = clamp(target - after, 0, applicants);
  const hiringCost = hires * CONFIG.courierHireCost;
  state.couriers = Math.max(0, Math.round(after + hires));

  // --- 7. Рестораны ---
  const remainingPoolTotal = activeDefs.reduce(
    (s, d) => s + Math.max(0, d.restaurantPool - state.districts[d.id].restaurants), 0) || 1;
  const salesPower = clamp(0.35 * Math.pow(decisions.sales / CONFIG.salesRefBudget, 0.6), 0, 0.8);
  const commissionTerm = clamp(Math.pow(CONFIG.restaurantRefCommission / Math.max(0.02, commission), 0.8), 0.3, 1.6);

  for (const def of activeDefs) {
    const ds = state.districts[def.id];
    const p = perDistrict.find((x) => x.def.id === def.id);
    const served = p ? p.served : 0;
    const ordersPerRest = ds.restaurants > 0 ? served / ds.restaurants : 0;
    const volumeTerm = clamp(Math.pow(ordersPerRest / CONFIG.restaurantRefOrders, 0.5), 0, 1.5);
    const attractR = clamp((0.35 + 0.65 * volumeTerm) * commissionTerm, 0, 1.6);

    const remaining = Math.max(0, def.restaurantPool - ds.restaurants);
    const share = remaining / remainingPoolTotal;
    const localSales = salesPower * (activeDefs.length > 1 ? share * activeDefs.length : 1);
    const newRest = remaining * clamp(localSales * attractR * 0.5, 0, 0.4);

    const restChurn = clamp(CONFIG.restaurantBaseChurn
      + Math.max(0, 1 - attractR) * 0.12 + mods.restaurantChurnAdd, 0, 0.5);

    ds.restaurants = clamp(ds.restaurants * (1 - restChurn) + newRest, 0, def.restaurantPool);
    ds.attractR = attractR;
  }

  // Событие «крупная сеть» добавляет рестораны сразу
  if (mods.restaurantsAdd && activeDefs.length) {
    const per = mods.restaurantsAdd / activeDefs.length;
    for (const def of activeDefs) {
      const ds = state.districts[def.id];
      ds.restaurants = Math.min(def.restaurantPool, ds.restaurants + per);
    }
  }

  // --- 8. Клиенты: узнаваемость, приток, отток ---
  let newCustomers = 0;
  let lostCustomers = 0;
  let weightedSat = 0;

  for (const p of perDistrict) {
    const { def, ds } = p;
    const marketingShare = def.potential / totalPotentialActive;
    const spendPerUser = (decisions.marketing * marketingShare) / def.potential;
    const gain = clamp(
      0.30 * Math.pow(spendPerUser / CONFIG.refMarketingPerUser, 0.55),
      0, CONFIG.awarenessMaxGain
    );
    ds.awareness = clamp(
      ds.awareness + (1 - ds.awareness) * safe(gain) - ds.awareness * CONFIG.awarenessDecay + mods.awarenessAdd,
      0, 1
    );

    const newSpeedFactor = clamp(Math.pow(CONFIG.refDeliveryTime / p.newTime, 0.6), 0.4, 1.3);
    const lostShare = 1 - fillRate;
    const satisfaction = clamp(
      0.35 * newSpeedFactor
      + 0.25 * Math.min(p.selectionFactor, 1.2)
      + 0.25 * Math.min(p.priceFactor, 1.3)
      + 0.15 * (1 - lostShare * 2)
      + mods.satisfactionAdd,
      0, 1.4
    );
    ds.satisfaction = satisfaction;
    weightedSat += satisfaction * def.potential;

    const churn = clamp(
      CONFIG.customerBaseChurn + Math.max(0, 1 - satisfaction) * 0.30 + def.competitor * 0.012,
      0, 0.6
    );
    const leaving = ds.customers * churn;

    const untapped = Math.max(0, reachableOf(def) - ds.customers);
    const trial = untapped * ds.awareness * CONFIG.trialRate
      * clamp(satisfaction, 0.3, 1.3) * clamp(p.selectionFactor, 0, 1.2);
    const wom = ds.customers * 0.02 * Math.max(0, satisfaction - 1);

    ds.customers = Math.max(0, ds.customers - leaving + trial + wom);
    ds.deliveryTime = p.newTime;
    newCustomers += trial + wom;
    lostCustomers += leaving;
    p.satisfaction = satisfaction;
  }

  // --- 9. Деньги ---
  const opex = districtFixed + hqCost + decisions.marketing + decisions.sales + decisions.tech;
  const oneOff = launchCost + hiringCost + (mods.oneOffCost ?? 0);
  const profit = contribution - opex;
  state.cash += profit - oneOff;
  state.techStock += decisions.tech;

  // --- 10. Метрики для интерфейса ---
  const totalCustomers = activeDefs.reduce((s, d) => s + state.districts[d.id].customers, 0);
  const totalRestaurants = activeDefs.reduce((s, d) => s + state.districts[d.id].restaurants, 0);
  const avgDeliveryTime = orders > 0
    ? perDistrict.reduce((s, p) => s + p.newTime * p.served, 0) / orders
    : (perDistrict.length ? perDistrict.reduce((s, p) => s + p.newTime, 0) / perDistrict.length : 0);

  const cityMarketOrders = DISTRICTS.reduce((s, d) => s + d.potential * d.baseFreq * 0.45, 0);
  const marketShare = orders / cityMarketOrders;

  const cac = newCustomers > 0 ? (decisions.marketing) / newCustomers : 0;
  const cmPerOrder = orders > 0 ? contribution / orders : 0;
  // LTV = вклад с заказа x частота x ожидаемое число недель жизни клиента
  const avgFreq = totalCustomers > 0 ? orders / totalCustomers : 0;
  const avgChurn = clamp(CONFIG.customerBaseChurn
    + Math.max(0, 1 - (totalPotentialActive ? weightedSat / totalPotentialActive : 1)) * 0.30, 0.01, 0.6);
  const ltv = cmPerOrder * avgFreq / avgChurn;

  const wGeo = (key) => {
    if (!perDistrict.length || totalDemand <= 0) return 1;
    let acc = 0;
    for (const p of perDistrict) acc += Math.log(Math.max(1e-6, p[key])) * (p.demand / totalDemand);
    return Math.exp(acc);
  };

  const report = {
    week,
    orders,
    demand: totalDemand,
    lostOrders: Math.max(0, totalDemand - orders),
    gmv,
    netRevenue,
    commissionRevenue,
    feeRevenue,
    courierCost,
    promoCost,
    paymentCost,
    supportCost,
    variableCost,
    contribution,
    cmPerOrder,
    opex,
    districtFixed,
    hqCost,
    oneOff,
    launchCost,
    hiringCost,
    profit,
    cash: state.cash,
    couriers: state.couriers,
    hires,
    courierLeft,
    applicants,
    courierEarnings: state.couriers > 0 ? realizedEarnings : courierEarnings,
    courierAttractiveness: state.couriers > 0 ? realizedAttractiveness : attractiveness,
    utilization,
    fillRate,
    capacity,
    perCourier,
    avgDeliveryTime,
    customers: totalCustomers,
    newCustomers,
    lostCustomers,
    restaurants: totalRestaurants,
    marketShare,
    commission,
    cac,
    ltv,
    ltvCac: cac > 0 ? ltv / cac : null,
    techLevel: techLevel(state),
    season,
    avgPriceFactor: wGeo('priceFactor'),
    avgSpeedFactor: wGeo('speedFactor'),
    avgSelectionFactor: wGeo('selectionFactor'),
    event: event ? { id: event.id, title: event.title, choice, lesson: event.lesson } : null,
    launched,
    closed,
    districts: perDistrict.map((p) => ({
      id: p.def.id,
      name: p.def.name,
      orders: p.served,
      demand: p.demand,
      customers: state.districts[p.def.id].customers,
      penetration: state.districts[p.def.id].customers / reachableOf(p.def),
      restaurants: state.districts[p.def.id].restaurants,
      awareness: state.districts[p.def.id].awareness,
      deliveryTime: p.newTime,
      satisfaction: p.satisfaction,
      aov: p.aov,
      priceFactor: p.priceFactor,
      selectionFactor: p.selectionFactor,
      speedFactor: p.speedFactor,
      contribution: p.served * (p.aov * commission + decisions.deliveryFee
        - decisions.courierPay - decisions.promo
        - (p.aov + decisions.deliveryFee - decisions.promo) * CONFIG.paymentFeeRate
        - Math.max(2, CONFIG.supportCostPerOrder - CONFIG.supportTechDiscount * techLevel(state))),
    })),
    decisions: { ...decisions, districts: [...(decisions.districts ?? [])] },
  };

  // --- 11. Завершение недели ---
  state.week = week;
  state.history.push(report);
  state.rngState = rng.state();
  state.pendingChoice = null;
  state.pendingEvent = rollEvent(rng, week + 1, state.flags);
  state.rngState = rng.state();

  if (state.cash < 0) state.over = 'bankrupt';
  else if (week >= CONFIG.weeksTotal) state.over = 'finished';

  report.valuation = valuation(state);
  report.equityValue = report.valuation * state.equity;

  return { state, report };
}

// ----------------------------------------------------------------------------
// Оценка компании и раунды инвестиций
// ----------------------------------------------------------------------------
export function valuation(state) {
  const h = state.history;
  if (!h.length) return 40_000_000;
  const last = h[h.length - 1];
  const netRevenueRunRate = last.netRevenue * 52;

  const tail = h.slice(-4).reduce((s, r) => s + r.orders, 0);
  const prev = h.slice(-8, -4).reduce((s, r) => s + r.orders, 0);
  const growth = prev > 0 ? tail / prev : (tail > 0 ? 1.5 : 1);
  const growthScore = clamp(growth - 1, 0, 1);

  const margin = last.netRevenue > 0 ? last.profit / last.netRevenue : -0.5;
  const marginScore = clamp(margin, -0.4, 0.25) / 0.25;

  const multiple = clamp(2.0 + 5 * growthScore + 4 * Math.max(0, marginScore) + 1.5 * Math.min(0, marginScore), 0.5, 12);
  const base = netRevenueRunRate * multiple;
  const bonus = 1 + clamp(state.flags.valuationBonus, -0.4, 0.6);
  return Math.max(40_000_000, base * bonus);
}

export function fundingOffer(state, amount) {
  const pre = valuation(state);
  const dilution = amount / (pre + amount);
  return { pre, post: pre + amount, amount, dilution, newEquity: state.equity * (1 - dilution) };
}

export function raise(state, amount) {
  const offer = fundingOffer(state, amount);
  const next = structuredClone(state);
  next.cash += amount;
  next.equity = offer.newEquity;
  next.raisedTotal += amount;
  return { state: next, offer };
}

// ----------------------------------------------------------------------------
// Разбор недели: раскладываем изменение числа заказов на факторы.
// ln(orders) = ln(клиенты) + ln(частота) + ln(доля выполненных)
// ----------------------------------------------------------------------------
export function explain(prev, cur) {
  if (!prev || !cur) return [];
  const parts = [
    ['База клиентов', prev.customers, cur.customers],
    ['Цена для клиента', prev.avgPriceFactor, cur.avgPriceFactor],
    ['Скорость доставки', Math.pow(prev.avgSpeedFactor, 0.5), Math.pow(cur.avgSpeedFactor, 0.5)],
    ['Выбор ресторанов', Math.pow(prev.avgSelectionFactor, 0.5), Math.pow(cur.avgSelectionFactor, 0.5)],
    ['Сезонность и события', prev.season, cur.season],
    ['Нехватка курьеров', Math.max(0.01, prev.fillRate), Math.max(0.01, cur.fillRate)],
  ];
  return parts
    .map(([label, a, b]) => ({
      label,
      effect: a > 0 && b > 0 ? Math.exp(Math.log(b) - Math.log(a)) - 1 : 0,
    }))
    .filter((p) => Math.abs(p.effect) > 0.002)
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
}

// ----------------------------------------------------------------------------
// Экономика одного заказа «на салфетке» — считается мгновенно, до расчёта недели.
// Именно эту таблицу студент должен научиться держать в голове.
// ----------------------------------------------------------------------------
export function unitEconomics(state, decisions) {
  const active = DISTRICTS.filter((d) => state.districts[d.id].active);
  const weights = active.length
    ? active.map((d) => {
        const ds = state.districts[d.id];
        return Math.max(1, ds.customers || d.potential * 0.01);
      })
    : [1];
  const pool = active.length ? active : [DISTRICTS[0]];
  const wsum = weights.reduce((s, w) => s + w, 0);
  const aov = pool.reduce((s, d, i) => s + aovOf(d) * weights[i], 0) / wsum;

  const commission = effectiveCommission(state, decisions);
  const t = techLevel(state);

  const commissionRevenue = aov * commission;
  const feeRevenue = decisions.deliveryFee;
  const revenue = commissionRevenue + feeRevenue;

  const courier = decisions.courierPay;
  const promo = decisions.promo;
  const payment = (aov + decisions.deliveryFee - decisions.promo) * CONFIG.paymentFeeRate;
  const support = Math.max(2, CONFIG.supportCostPerOrder - CONFIG.supportTechDiscount * t);
  const variable = courier + promo + payment + support;

  return {
    aov, commission,
    commissionRevenue, feeRevenue, revenue,
    courier, promo, payment, support, variable,
    contribution: revenue - variable,
    takeRate: revenue / aov,
    marginOfGmv: (revenue - variable) / aov,
  };
}

// Итоговый счёт партии
export function finalScore(state) {
  const v = valuation(state);
  return {
    valuation: v,
    equity: state.equity,
    equityValue: v * state.equity,
    raised: state.raisedTotal,
    cash: state.cash,
    weeks: state.week,
    bankrupt: state.over === 'bankrupt',
  };
}
