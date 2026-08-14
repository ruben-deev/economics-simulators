// ============================================================================
// Ядро симуляции «НОВОГРАДА». Чистые функции: step(state) -> {state, report}.
// Никакой работы с DOM — модуль можно гонять в тестах и в скриптах замеров.
//
// Смысловая структура модели (её же объясняем игроку):
//
//   стартовый актив (насыщен) --- вклад ---> касса холдинга
//         |                                      |
//         | общая база клиентов                  v
//         +--- кросс-селл ---> новая вертикаль (растёт) ---> вклад завтра
//                                   ^
//                война хозяина рынка, водители, тарифы
//
// Ключевая петля: дожим стартового актива даёт деньги сейчас, но сжигает
// базу — а base это ещё и пул кросс-селла новой вертикали. Форма экосистемы
// диктуется стартовым активом: движок читает дескриптор из START_ASSETS.
// ============================================================================

import { CONFIG, DEFAULT_DECISIONS, assetById, verticalById, clamp } from './config.js';
import { createRng } from '../../../../shared/rng.js';
import { windowAvg, windowGrowth, revenueMultiple, roundTerms } from '../../../../shared/valuation.js';
import { deepClone } from '../../../../shared/clone.js';
import { neutralModifiers, applyEvent, rollEvent } from './events.js';
import { makeGoal, goalProgress, applyGoalOutcome } from './board.js';

// Сезонность: такси зимой возит больше (пик в январе), еда колышется слабее
export function seasonFood(month) {
  return 1 + CONFIG.foodSeasonAmp * Math.cos((2 * Math.PI * (month - 1)) / 12);
}
export function seasonTaxi(month) {
  return 1 + CONFIG.taxiSeasonAmp * Math.cos((2 * Math.PI * (month - 1)) / 12);
}

// ----------------------------------------------------------------------------
// Начальное состояние. assetId — ссылка на дескриптор стартового актива:
// сюда позже встанут старты от КИНОРЕКИ и БИЛЕТВИЛЯ (данными, не кодом).
// ----------------------------------------------------------------------------
export function createInitialState(seed = 'novograd', assetId = 'delivery') {
  const asset = assetById(assetId);
  const rng = createRng(seed);
  const state = {
    seed,
    rngState: rng.state(),
    month: 0,
    cash: CONFIG.startCash,
    equity: 1,
    raisedTotal: 0,
    assetId: asset.id,
    // Стартовый актив на портфельном уровне: агрегаты, не микроменеджмент
    food: {
      users: asset.users,
      returnPool: asset.returnPool,
    },
    taxi: {
      on: false,
      launchedMonth: null,
      users: 0,
      drivers: 0,
      warUntil: 0,
      lockAdd: 0,     // рынок, отданный конкуренту за перемирие
    },
    both: 0,          // клиенты двух и более сервисов — сердце экосистемы
    trustUntil: 0,    // до какого месяца подорвано доверие к единому аккаунту
    decisions: { ...DEFAULT_DECISIONS, verticals: [] },
    flags: { valuationBonus: 0, regulationRisk: false },
    board: { goal: null, history: [], profitableMonths: 0 },
    restrictions: null,
    pendingDilution: 0,
    pendingEvent: null,
    pendingChoice: null,
    history: [],
    over: null,   // 'bankrupt' | 'finished'
  };
  state.board.goal = makeGoal(1, state, asset.users);
  return state;
}

// ----------------------------------------------------------------------------
// Производные показатели
// ----------------------------------------------------------------------------

export function mgmtLevel(decisions) {
  const m = decisions.mgmt ?? 0;
  return m / (m + CONFIG.mgmtSaturation);
}

// Конгломератный штраф: каждая вертикаль сверх первой размывает фокус.
// Управляющая компания выкупает штраф, но не бесплатно.
export function focusPenalty(state, decisions) {
  const n = 1 + (state.taxi.on ? 1 : 0);
  return CONFIG.focusPenaltyPerVertical * (n - 1) * (1 - mgmtLevel(decisions));
}

export function foodQuality(state, decisions) {
  const ops = decisions.foodOps ?? 0;
  const level = ops / (ops + CONFIG.foodOpsSaturation);
  return clamp((CONFIG.foodQualityFloor + 0.55 * level) * (1 - focusPenalty(state, decisions)), 0.2, 1.1);
}

export function taxiQuality(state, decisions) {
  return clamp(0.78 * (1 - focusPenalty(state, decisions)), 0.2, 1);
}

export function uniqueUsers(state) {
  return Math.max(0, state.food.users + state.taxi.users - state.both);
}

// Ворота совета: диверсификацию согласуют после квартала истории
// и при положительном вкладе стартового актива за последние месяцы.
export function expansionOpen(state, vertical) {
  const gate = vertical.gate;
  const nextMonth = state.month + 1;
  if (nextMonth < gate.minMonth) return false;
  const h = state.history.slice(-gate.assetContributionMonths);
  if (h.length < gate.assetContributionMonths) return false;
  const avg = h.reduce((s, r) => s + (r.foodFullContribution ?? 0), 0) / h.length;
  return avg > 0;
}

// ----------------------------------------------------------------------------
// Главный шаг симуляции
// ----------------------------------------------------------------------------
export function step(prevState, input = {}) {
  const state = deepClone(prevState);
  if (state.over) return { state, report: state.history[state.history.length - 1] ?? null };

  const asset = assetById(state.assetId);
  const taxiDef = verticalById('taxi');

  const decisions = { ...state.decisions, ...(input.decisions ?? {}) };
  state.decisions = decisions;

  const rng = createRng(state.seed);
  rng.restore(state.rngState);

  const month = state.month + 1;

  // --- 0. Ограничения совета ---
  // Порезанные бюджеты режутся до того, как из них что-то посчитано.
  const restrictions = state.restrictions && month < state.restrictions.until
    ? state.restrictions : null;
  if (!restrictions) state.restrictions = null;
  let marketingCapped = null;
  const capBudget = (key) => {
    if (restrictions?.marketingCap && decisions[key] > restrictions.marketingCap) {
      marketingCapped = restrictions.marketingCap;
      decisions[key] = restrictions.marketingCap;
    }
  };
  capBudget('foodMarketing');
  capBudget('taxiMarketing');
  capBudget('crossSell');

  // Размеры на начало месяца: поштучные цены событий считаются от того,
  // что игрок видит на экране в момент выбора.
  const driversAtStart = state.taxi.drivers;
  const foodUsersAtStart = state.food.users;
  const taxiUsersAtStart = state.taxi.users;
  const uniqueAtStart = uniqueUsers(state);

  // --- 1. Событие месяца (объявлено в конце прошлого месяца) ---
  const mods = neutralModifiers();
  const event = state.pendingEvent;
  const choice = input.eventChoice ?? state.pendingChoice ?? 0;
  applyEvent(mods, event, choice);
  if (mods.valuationBonus) state.flags.valuationBonus += mods.valuationBonus;
  if (mods.regulationRisk) state.flags.regulationRisk = true;
  if (mods.trustMonths) state.trustUntil = Math.max(state.trustUntil, month + mods.trustMonths);
  if (mods.endWar) state.taxi.warUntil = month;   // перемирие: война кончается сейчас
  if (mods.lockAdd) state.taxi.lockAdd += mods.lockAdd;

  // --- 2. Запуск вертикалей (ворота + разовая цена + ответ хозяина рынка) ---
  const wanted = new Set(decisions.verticals ?? []);
  let launchCost = 0;
  let taxiLaunched = false;
  let taxiClosed = false;
  if (wanted.has('taxi') && !state.taxi.on) {
    if (expansionOpen(prevState, taxiDef)) {
      state.taxi.on = true;
      state.taxi.launchedMonth = month;
      state.taxi.warUntil = month + taxiDef.warMonths;
      // Стартовый парк и ранние клиенты входят в цену запуска
      state.taxi.drivers = 200;
      state.taxi.users = 3_000;
      launchCost += taxiDef.launchCost;
      taxiLaunched = true;
    }
    // ворота закрыты — заявка ждёт следующего месяца
  } else if (!wanted.has('taxi') && state.taxi.on) {
    // Закрытие вертикали: бизнес останавливается, клиенты и парк распускаются.
    // Повторный запуск снова платит цену запуска — юрлицо продали.
    state.taxi.on = false;
    state.taxi.users = 0;
    state.taxi.drivers = 0;
    state.both = 0;
    taxiClosed = true;
  }

  const taxiOn = state.taxi.on;
  const atWar = taxiOn && state.taxi.warUntil > month;
  const trustBroken = state.trustUntil > month;

  // --- 3. Фокус и качество исполнения ---
  const penalty = focusPenalty(state, decisions);
  const qFood = foodQuality(state, decisions);
  const qTaxi = taxiQuality(state, decisions);

  // --- 4. Еда: дожим, выручка, отток, возврат ---
  const takeIdx = clamp(decisions.foodTake ?? 1, 0.8, 1.3);
  // Часть повышения монетизации съедает частота заказов
  const takeFreqFactor = Math.pow(takeIdx, -CONFIG.foodTakeElasticity);
  const foodSeason = seasonFood(month);
  const arpuFood = asset.arpu * takeIdx * takeFreqFactor
    * (0.94 + 0.08 * qFood) * foodSeason * mods.foodDemandMult;
  const revenueFood = state.food.users * arpuFood;
  const contribFood = revenueFood * asset.margin;

  // Отток: базовый + жадность + качество. За порогом монетизации клиенты
  // не «чуть недовольнее» — уходят к конкуренту ускоренно.
  const takePressure = CONFIG.foodTakePressure * Math.pow(Math.max(0, takeIdx - 1), 1.2)
    + CONFIG.foodTakeExodus * Math.pow(Math.max(0, takeIdx - CONFIG.foodTakeThreshold), 1.5);
  const churnFoodRate = clamp(
    asset.baseChurn
    + CONFIG.foodChurnQuality * Math.max(0, CONFIG.foodQualityRef - qFood)
    + takePressure
    + mods.foodChurnAdd,
    0.005, 0.5,
  );
  // Клиент двух сервисов уходит реже — экосистемная привычка
  const foodOnly = Math.max(0, state.food.users - state.both);
  const lostFoodOnly = foodOnly * churnFoodRate;
  const lostFoodBoth = state.both * churnFoodRate * (1 - CONFIG.ecoChurnRelief);
  const lostFood = lostFoodOnly + lostFoodBoth;

  // Возврат ушедших: единственный «маркетинг» насыщенного рынка
  const winbackBudget = decisions.foodMarketing ?? 0;
  const winbackCap = state.food.returnPool * CONFIG.foodWinbackReach * (0.5 + 0.5 * qFood);
  const wonBack = Math.min(winbackBudget / CONFIG.foodWinbackCac, winbackCap);
  const winbackWasted = Math.max(0, winbackBudget - wonBack * CONFIG.foodWinbackCac);
  // Немного органики: город циркулирует, но насыщение оставляет крохи
  const organicFood = Math.max(0, asset.reachableCap - state.food.users)
    * CONFIG.foodOrganicShare * qFood;

  // --- 5. Такси: спрос, парк, война ---
  let demandTrips = 0; let servedTrips = 0; let fill = 1; let utilDrivers = 0;
  let revenueTaxi = 0; let contribTaxi = 0; let fareEff = 0; let cmPerTrip = 0;
  let driverHires = 0; let driversLost = 0;
  let coldAcq = 0; let lostTaxi = 0; let churnTaxiRate = 0;
  let taxiPool = 0;
  const priceIdx = clamp(decisions.taxiPrice ?? 1, 0.85, 1.25);
  const taxiPriceFactor = Math.pow(priceIdx, -CONFIG.taxiPriceElasticity);

  if (taxiOn) {
    const lock = clamp(taxiDef.incumbentLock + state.taxi.lockAdd, 0, 0.9);
    taxiPool = Math.max(0, taxiDef.potential * (1 - lock) - state.taxi.users);

    fareEff = taxiDef.fare * priceIdx * (atWar ? 1 - taxiDef.warFareCut : 1);
    demandTrips = state.taxi.users * taxiDef.tripsPerUser * taxiPriceFactor
      * seasonTaxi(month) * mods.taxiDemandMult;
    const capacity = state.taxi.drivers * CONFIG.taxiTripsPerDriver * mods.taxiCapacityMult;
    servedTrips = Math.min(demandTrips, capacity);
    fill = demandTrips > 0 ? servedTrips / demandTrips : 1;
    utilDrivers = capacity > 0 ? servedTrips / capacity : 0;

    cmPerTrip = fareEff * taxiDef.takeRate - (CONFIG.taxiCostPerTrip + mods.costPerTripAdd);
    revenueTaxi = servedTrips * fareEff * taxiDef.takeRate;
    contribTaxi = servedTrips * cmPerTrip;

    // Водители: найм из бюджета, отток от базы и от простоя.
    // Водитель без поездок не ждёт лучших времён — уходит к конкуренту.
    driverHires = ((decisions.taxiSupply ?? 0) / CONFIG.taxiDriverOnboardCost)
      * mods.driverSupplyMult;
    const idle = Math.max(0, CONFIG.taxiDriverIdleFloor - utilDrivers) / CONFIG.taxiDriverIdleFloor;
    const driverChurn = clamp(
      CONFIG.taxiDriverBaseChurn + CONFIG.taxiDriverIdleChurn * idle + mods.driverChurnAdd,
      0.01, 0.6,
    );
    driversLost = state.taxi.drivers * driverChurn;
    state.taxi.drivers = Math.max(0, state.taxi.drivers - driversLost + driverHires);

    // Отток клиентов: цена, качество, недовоз (долгая подача)
    churnTaxiRate = clamp(
      CONFIG.taxiBaseChurn
      + CONFIG.taxiChurnQuality * Math.max(0, 0.8 - qTaxi)
      + CONFIG.taxiChurnFill * (1 - fill)
      + 0.08 * Math.max(0, priceIdx - 1)
      + mods.taxiChurnAdd,
      0.01, 0.6,
    );
    const taxiOnly = Math.max(0, state.taxi.users - state.both);
    const lostTaxiOnly = taxiOnly * churnTaxiRate;
    const lostTaxiBoth = state.both * churnTaxiRate * (1 - CONFIG.ecoChurnRelief);
    lostTaxi = lostTaxiOnly + lostTaxiBoth;

    // Холодное привлечение: дорого, в войну — вдвое дороже (демпинг перехватывает)
    const mBudget = decisions.taxiMarketing ?? 0;
    coldAcq = taxiPool * CONFIG.taxiMarketingReach
      * (mBudget / (mBudget + CONFIG.taxiMarketingSaturation))
      * clamp(Math.pow(taxiPriceFactor, 0.7), 0.5, 1.3)
      * (atWar ? 1 - taxiDef.warAcqCut : 1);

    // Пересечение: ушедшие «оба» из такси остаются клиентами еды
    state.both = Math.max(0, state.both - lostTaxiBoth);
    state.taxi.users = Math.max(0, state.taxi.users - lostTaxi + coldAcq);
  }

  // --- 6. Кросс-селл: общая база как канал --------------------------------
  // Клиент соседней вертикали дешевле холодного, но канал имеет ёмкость
  // и не спасает мёртвый продукт: конверсия зависит от принимающей стороны.
  let crossConv = 0; let crossBackConv = 0; let crossSpent = 0; let crossWasted = 0;
  let crossCac = 0;
  const crossBudget = taxiOn ? (decisions.crossSell ?? 0) : 0;
  if (taxiOn && crossBudget > 0) {
    const trustMult = (trustBroken ? 0.55 : 1) * mods.crossSellMult;
    const synergy = asset.synergy?.taxi ?? 1;
    const cacEff = CONFIG.crossSellCac / synergy;

    // еда -> такси: главное направление
    const budgetF = crossBudget * (1 - CONFIG.crossBackShare);
    const poolF = Math.max(0, state.food.users - state.both);
    const attractTaxi = clamp(0.25 + 0.75 * qTaxi, 0, 1.1)
      * clamp(taxiPriceFactor, 0.6, 1.15) * (0.5 + 0.5 * fill);
    const capF = poolF * CONFIG.crossSellMonthlyReach * attractTaxi * trustMult;
    crossConv = Math.min(budgetF / cacEff, capF);
    // такси -> еда: обратное направление, у него свой пул и своя цена
    const budgetB = crossBudget * CONFIG.crossBackShare;
    const poolB = Math.max(0, state.taxi.users - state.both);
    const attractFood = clamp(0.25 + 0.75 * qFood, 0, 1.1);
    const capB = Math.min(
      poolB * CONFIG.crossBackMonthlyReach * attractFood * trustMult,
      Math.max(0, asset.reachableCap - state.food.users),
    );
    crossBackConv = Math.min(budgetB / CONFIG.crossBackCac, capB);

    crossSpent = crossConv * cacEff + crossBackConv * CONFIG.crossBackCac;
    // Перерасход сверх ёмкости канала сгорает — и виден в отчёте
    crossWasted = Math.max(0, crossBudget - crossSpent);
    crossCac = (crossConv + crossBackConv) > 0
      ? crossBudget / (crossConv + crossBackConv) : 0;

    state.taxi.users += crossConv;
    state.food.users += crossBackConv;
    state.both += crossConv + crossBackConv;
  }

  // Итог месяца по базе еды. Ушедший из еды клиент «двух сервисов»
  // остаётся клиентом такси — пересечение сжимается вместе с ним.
  state.food.users = Math.max(0, state.food.users - lostFood + wonBack + organicFood);
  state.both = Math.max(0, state.both - lostFoodBoth);
  state.food.returnPool = Math.max(0,
    state.food.returnPool * (1 - CONFIG.foodReturnPoolDecay)
    + lostFood * CONFIG.foodReturnShare
    - wonBack);
  // Пересечение не может превышать ни одну из баз
  state.both = Math.min(state.both, state.food.users, state.taxi.users);

  // --- 7. P&L холдинга ---
  const revenue = revenueFood + revenueTaxi;
  const contribution = contribFood + contribTaxi;
  const fixedFood = asset.fixedMonthly;
  const fixedTaxi = taxiOn ? taxiDef.fixedMonthly : 0;
  const taxiBudgets = taxiOn ? (decisions.taxiSupply ?? 0) + (decisions.taxiMarketing ?? 0) : 0;
  const opex = CONFIG.hqMonthly + (decisions.mgmt ?? 0) + crossBudget
    + (decisions.foodOps ?? 0) + (decisions.foodMarketing ?? 0)
    + fixedFood + fixedTaxi + taxiBudgets;

  // Полный вклад вертикали (для оценки sum-of-parts и ворот экспансии):
  // переменный вклад минус фиксы и бюджеты самой вертикали.
  const foodFullContribution = contribFood - fixedFood
    - (decisions.foodOps ?? 0) - (decisions.foodMarketing ?? 0);
  const taxiFullContribution = taxiOn
    ? contribTaxi - fixedTaxi - taxiBudgets : 0;

  const profit = contribution - opex;
  const perUnitCost = (mods.oneOffCostPerDriver ?? 0) * driversAtStart
    + (mods.oneOffCostPerFoodUser ?? 0) * foodUsersAtStart
    + (mods.oneOffCostPerTaxiUser ?? 0) * taxiUsersAtStart
    + (mods.oneOffCostPerUniqueUser ?? 0) * uniqueAtStart;
  const oneOff = launchCost + (mods.oneOffCost ?? 0) + perUnitCost;
  state.cash += profit - oneOff;

  // --- 8. Метрики ---
  const unique = uniqueUsers(state);
  const multiShare = unique > 0 ? state.both / unique : 0;
  const arpuHolding = unique > 0 ? revenue / unique : 0;
  const cacCold = coldAcq > 0 ? (decisions.taxiMarketing ?? 0) / coldAcq : 0;

  // --- 9. Совет директоров ---
  if (profit > 0) state.board.profitableMonths += 1;
  const progress = goalProgress(state.board.goal, {
    taxiUsers: state.taxi.users,
    multiShare,
    profitableMonths: state.board.profitableMonths,
    uniqueUsers: unique,
  });
  let goalOutcome = null;
  if (state.board.goal && month % CONFIG.boardYearMonths === 0) {
    goalOutcome = applyGoalOutcome(state, state.board.goal, progress, month);
    state.board.history.push(goalOutcome);
    state.board.profitableMonths = 0;
    const next = state.board.goal.year + 1;
    state.board.goal = month < CONFIG.monthsTotal
      ? makeGoal(next, state, unique) : null;
  }
  // Провал первого года: акционеры вводят деньги сами и на своих условиях
  let forcedDilution = 0;
  let boardInjection = 0;
  if (state.pendingDilution) {
    forcedDilution = state.pendingDilution;
    boardInjection = CONFIG.boardInjection;
    state.equity *= (1 - forcedDilution);
    state.cash += boardInjection;
    state.raisedTotal += boardInjection;
    state.pendingDilution = 0;
  }

  const report = {
    month,
    // --- деньги ---
    revenue,
    revenueFood,
    revenueTaxi,
    contribution,
    contribFood,
    contribTaxi,
    foodFullContribution,
    taxiFullContribution,
    opex,
    fixedFood,
    fixedTaxi,
    hqCost: CONFIG.hqMonthly,
    profit,
    oneOff,
    launchCost,
    cash: state.cash,
    // --- база ---
    foodUsers: state.food.users,
    taxiUsers: state.taxi.users,
    bothUsers: state.both,
    uniqueUsers: unique,
    multiShare,
    arpuHolding,
    arpuFood,
    churnFoodRate,
    lostFood,
    wonBack,
    winbackWasted,
    organicFood,
    returnPool: state.food.returnPool,
    // --- качество и фокус ---
    focusPenalty: penalty,
    mgmtLevel: mgmtLevel(decisions),
    foodQuality: qFood,
    taxiQuality: qTaxi,
    // --- такси ---
    taxiOn,
    taxiLaunched,
    taxiClosed,
    atWar,
    warMonthsLeft: taxiOn ? Math.max(0, state.taxi.warUntil - month) : 0,
    drivers: state.taxi.drivers,
    driverHires,
    driversLost,
    utilDrivers,
    demandTrips,
    servedTrips,
    fill,
    fareEff,
    cmPerTrip,
    taxiPool,
    churnTaxiRate,
    lostTaxi,
    coldAcq,
    cacCold,
    // --- кросс-селл ---
    crossConv,
    crossBackConv,
    crossCac,
    crossSpent,
    crossWasted,
    trustBroken,
    trustMonthsLeft: Math.max(0, state.trustUntil - month),
    // --- совет ---
    goal: state.board.goal ? { ...state.board.goal } : null,
    goalProgress: progress,
    goalOutcome,
    forcedDilution,
    boardInjection,
    marketingCapped,
    restrictions: restrictions ? { ...restrictions } : null,
    event: event ? { id: event.id, choice } : null,
    seasonFood: foodSeason,
    seasonTaxi: seasonTaxi(month),

    decisions: deepClone({ ...decisions, verticals: [...(decisions.verticals ?? [])] }),
  };

  // --- 10. Завершение месяца ---
  state.month = month;
  state.history.push(report);
  state.pendingChoice = null;
  state.pendingEvent = rollEvent(rng, month + 1, state.flags, {
    taxiOn: state.taxi.on,
    atWar: state.taxi.on && state.taxi.warUntil > month + 1,
  });
  state.rngState = rng.state();

  if (state.cash < 0) state.over = 'bankrupt';
  else if (month >= CONFIG.monthsTotal) state.over = 'finished';

  const sop = sumOfParts(state);
  report.valuation = sop.total;
  report.equityValue = report.valuation * state.equity;
  // Части оценки — в отчёт: график «Оценка» показывает их без пересчёта истории
  report.sopFoodValue = sop.parts.find((p) => p.id === 'food')?.value ?? 0;
  report.sopTaxiValue = sop.parts.find((p) => p.id === 'taxi')?.value ?? 0;

  return { state, report };
}

// ----------------------------------------------------------------------------
// Оценка холдинга: sum-of-parts.
//
// Каждая вертикаль оценивается своим окном выручки и своим множителем:
// зрелая еда — как дойная корова, растущее такси — как история роста.
// Убыточная вертикаль БЕЗ роста — «зоопарк»: она входит в сумму
// отрицательным слагаемым (годовой burn с множителем). Премия — за
// замеряемый кросс-селл: долю клиентов с двумя и более сервисами.
// ----------------------------------------------------------------------------
export function sumOfParts(state) {
  const h = state.history;
  const parts = [];
  const mkPart = (id, pickRevenue, pickFull, k) => {
    const runRate = windowAvg(h, CONFIG.valuationWindow, pickRevenue) * 12;
    const growth = windowGrowth(h, CONFIG.growthWindow, pickRevenue, 0.05);
    const fullAvg = windowAvg(h, CONFIG.valuationWindow, pickFull);
    const revAvg = windowAvg(h, CONFIG.valuationWindow, pickRevenue);
    const margin = revAvg > 0 ? fullAvg / revAvg : (fullAvg < 0 ? -1 : 0);
    let value;
    let zoo = false;
    if (fullAvg < 0 && growth < 0.05 && fullAvg < -0.1 * Math.max(1, revAvg)) {
      // Глубоко убыточное и не растущее — «зоопарк»: инвестор вычитает
      // годовой burn как обязательство. Слегка убыточную зрелую вертикаль
      // наказывает обычный множитель через маржу, не эта ветка.
      zoo = true;
      value = Math.max(fullAvg * 12 * CONFIG.lossBurnMultiple, -500_000_000);
    } else {
      const multiple = revenueMultiple(growth, margin, k);
      value = runRate * multiple;
    }
    parts.push({ id, runRate, growth, margin, value, zoo });
  };

  if (!h.length) {
    // До первого хода: стартовый актив по той же формуле, что и после, —
    // чтобы оценка не прыгала между «до» и «после» первого месяца.
    const asset = assetById(state.assetId);
    const revMonthly = asset.users * asset.arpu;
    const fullMonthly = revMonthly * asset.margin - asset.fixedMonthly
      - (DEFAULT_DECISIONS.foodOps ?? 0);
    const margin = fullMonthly / revMonthly;
    const multiple = revenueMultiple(0.05, margin, CONFIG.multiples.food);
    parts.push({ id: 'food', runRate: revMonthly * 12, growth: 0.05, margin, value: revMonthly * 12 * multiple, zoo: false });
  } else {
    mkPart('food', (r) => r.revenueFood, (r) => r.foodFullContribution, CONFIG.multiples.food);
    if (state.taxi.on || h.some((r) => r.taxiOn)) {
      mkPart('taxi', (r) => r.revenueTaxi, (r) => r.taxiFullContribution, CONFIG.multiples.taxi);
    }
  }

  const unique = uniqueUsers(state);
  const multiShare = unique > 0 ? state.both / unique : 0;
  const crossPremium = Math.min(CONFIG.crossPremiumCap, CONFIG.crossPremiumPerShare * multiShare);

  const posSum = parts.filter((p) => p.value > 0).reduce((s, p) => s + p.value, 0);
  const negSum = parts.filter((p) => p.value < 0).reduce((s, p) => s + p.value, 0);
  const beforeBonus = posSum * (1 + crossPremium) + negSum;
  const bonus = 1 + clamp(state.flags.valuationBonus, -0.4, 0.6);
  const total = Math.max(200_000_000, beforeBonus * bonus);
  return { parts, multiShare, crossPremium, bonus, total };
}

export function valuation(state) {
  return sumOfParts(state).total;
}

export function fundingOffer(state, amount) {
  const terms = roundTerms(valuation(state), amount, { floor: CONFIG.valuationFloor });
  return { ...terms, newEquity: state.equity * (1 - terms.dilution) };
}

export function raise(state, amount) {
  const offer = fundingOffer(state, amount);
  const next = deepClone(state);
  next.cash += amount;
  next.equity = offer.newEquity;
  next.raisedTotal += amount;
  return { state: next, offer };
}

// ----------------------------------------------------------------------------
// Разбор месяца: выручка холдинга = уникальные клиенты x ARPU.
// Двухфакторное разложение точно по определению — и это и есть главный
// урок игры: после насыщения растить можно только второй множитель.
// ----------------------------------------------------------------------------
export function explain(prev, cur) {
  if (!prev || !cur) return [];
  if (prev.revenue < 1_000_000 || cur.revenue < 1_000_000) return [];
  const ratio = (a, b) => (a > 0 && b > 0 ? b / a : 1);
  const parts = [
    ['driverUnique', ratio(prev.uniqueUsers, cur.uniqueUsers)],
    ['driverArpu', ratio(prev.arpuHolding, cur.arpuHolding)],
  ];
  return parts
    .map(([key, r]) => ({ key, effect: r - 1 }))
    .filter((p) => Math.abs(p.effect) > 0.002)
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
}

// Итоговый счёт партии: стоимость доли = доля x (оценка + касса).
// Кэш принадлежит акционерам: рубль, не потраченный к финалу, стоит рубль,
// а потраченный обязан вернуться ростом оценки.
export function finalScore(state) {
  const v = valuation(state);
  return {
    valuation: v,
    equity: state.equity,
    equityValue: (v + Math.max(0, state.cash)) * state.equity,
    raised: state.raisedTotal,
    cash: state.cash,
    months: state.month,
    bankrupt: state.over === 'bankrupt',
  };
}
