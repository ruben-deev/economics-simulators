// ============================================================================
// Ядро симуляции «НОВОГРАДА». Чистые функции: step(state) -> {state, report}.
// Никакой работы с DOM — модуль можно гонять в тестах и в скриптах замеров.
//
// Смысловая структура модели (её же объясняем игроку):
//
//   стартовый актив (хаб, насыщен) --- вклад ---> касса холдинга
//        |            |                                |
//        |            +-- кросс-селл --> такси --------+--> вклад завтра
//        |            +-- кросс-селл --> е-ком --------+
//        |                     |
//   общая база клиентов    подписка Plus (склейка: частота и удержание)
//
// Топология базы — «хаб и спицы»: пересечения считаются между стартовым
// активом и каждой вертикалью (кросс-селл предлагает клиенту хаба ВТОРОЙ
// сервис, а не третий — поэтому тройных пересечений в модели нет).
// Форма экосистемы диктуется стартовым активом буквально: он — центр графа.
//
// Ключевая петля: дожим хаба даёт деньги сейчас, но сжигает базу — а база
// это пул кросс-селла всех вертикалей и подписки. Дескриптор актива
// (START_ASSETS) параметризует всё: синергии, перки, цену запусков.
// ============================================================================

import {
  CONFIG, DEFAULT_DECISIONS, assetById, verticalById, clamp,
} from './config.js';
import { difficultyById } from '../../../../shared/difficulty.js';
import {
  financeHalfCost, financeStrength, financeMiscRate, financeSpend, financeRoundGain,
} from '../../../../shared/finance.js';
import { createRng } from '../../../../shared/rng.js';
import { windowAvg, windowGrowthStable, revenueMultiple, roundTerms, distressedSale } from '../../../../shared/valuation.js';
import { deepClone } from '../../../../shared/clone.js';
import { neutralModifiers, applyEvent, rollEvent } from './events.js';
import { makeGoal, makeEndlessGoal, goalProgress, applyGoalOutcome } from './board.js';

// Сезонность: такси зимой возит больше (пик в январе), еда колышется слабее
export function seasonFood(month) {
  return 1 + CONFIG.foodSeasonAmp * Math.cos((2 * Math.PI * (month - 1)) / 12);
}
export function seasonTaxi(month) {
  return 1 + CONFIG.taxiSeasonAmp * Math.cos((2 * Math.PI * (month - 1)) / 12);
}
// Самокаты: сезон задан таблицей по календарю (январь..декабрь) — косинусом
// такую яму не описать: зима ×0.1, июль ×1.7. Месяц 37 — январь.
export function seasonScooters(month) {
  return CONFIG.scooters.season[(month - 1) % 12];
}

export const hasPerk = (asset, key) => Boolean(asset.perks?.includes(key));

// ----------------------------------------------------------------------------
// Начальное состояние. assetId — дескриптор стартового актива («класс
// персонажа»). legacy — бонусы наследия из мета-прогрессии витрины:
//   { asset: bool, cinema: bool, tickets: bool }
// asset  — сыгран финал игры-источника ЭТОГО актива («известный бренд»),
// cinema — финал КИНОРЕКИ (скидка на лицензию в Plus),
// tickets — финал БИЛЕТВИЛЯ (готовое партнёрство по билетам).
// ----------------------------------------------------------------------------
// Насколько крупнее «крепкой» победы был финал игры-источника. Всё, что
// переносится числами, считается отсюда.
function carryOver(legacy) {
  const ratio = Math.max(0, Number(legacy?.assetRatio) || 0);
  return ratio > 1 ? ratio - 1 : 0;
}

// Касса победителя: базовая казна актива плюс то, что вы реально скопили
// в прошлой игре. Прибавка ограничена — иначе рекордная прошлая партия
// решала бы новую до первого хода.
// Клиенты победителя: дескриптор актива — это КРЕПКИЙ финал игры-источника.
// Если вы там сделали больше, база и пул возврата приходят больше — вместе,
// потому что это одна и та же компания. Планки правления считаются от этой
// же базы (см. board.makeGoal): большой холдинг обязан и вторую ногу
// построить большую.
export function startingUsers(asset, legacy = {}) {
  const over = carryOver(legacy);
  const mult = 1 + clamp(CONFIG.legacyCarry.usersPerRatio * over, 0, CONFIG.legacyCarry.usersCap);
  return {
    users: Math.round(asset.users * mult),
    returnPool: Math.round(asset.returnPool * mult),
    mult,
  };
}

export function startingCash(asset, legacy = {}) {
  const base = asset.startCash ?? CONFIG.startCash;
  const over = carryOver(legacy);
  const bonus = clamp(CONFIG.legacyCarry.cashPerRatio * over, 0, CONFIG.legacyCarry.cashCap);
  return Math.round(base * (1 + bonus));
}

// Оценка прошлой компании переносится репутацией у инвесторов: она не
// прибавляется к оценке холдинга (её считает рынок), но улучшает условия
// раунда — за те же деньги вы отдаёте меньшую долю. Работает только если
// вы действительно берёте раунд: это бонус к решению, а не к счёту.
export function legacyReputationMult(legacy = {}) {
  const over = carryOver(legacy);
  return 1 + clamp(CONFIG.legacyCarry.roundPerRatio * over, 0, CONFIG.legacyCarry.roundCap);
}

// Пол под оценкой в раунде: победителю рынка не выкручивают руки, даже
// если холдинг в моменте выглядит слабо.
export function legacyValuationFloor(legacy = {}) {
  const over = carryOver(legacy);
  const bonus = clamp(CONFIG.legacyCarry.floorPerRatio * over, 0, CONFIG.legacyCarry.floorCap);
  return Math.round(CONFIG.valuationFloor * (1 + bonus));
}

export function createInitialState(seed = 'novograd', assetId = 'delivery', legacy = {}, difficulty = 'normal') {
  const asset = assetById(assetId);
  const rng = createRng(seed);
  const carried = startingUsers(asset, legacy);
  const state = {
    seed,
    rngState: rng.state(),
    month: 0,
    cash: startingCash(asset, legacy),
    equity: 1,
    raisedTotal: 0,
    assetId: asset.id,
    // Уровень сложности: меняет только цену финансовой команды (см. financeLevel)
    difficulty: difficultyById(difficulty).id,
    // Бонусы наследия: «чувствуются, но не решают партию» (замерено)
    legacy: {
      asset: Boolean(legacy.asset),
      cinema: Boolean(legacy.cinema),
      tickets: Boolean(legacy.tickets),
      // Числа финала игры-источника: во сколько раз он крупнее «крепкого»
      // порога той игры. Отсюда растут касса и пол оценки — см. ниже.
      assetScore: Number(legacy.assetScore) || 0,
      assetRatio: Math.max(0, Number(legacy.assetRatio) || 0),
    },
    // Стартовый актив (хаб) на портфельном уровне
    food: {
      users: carried.users,
      returnPool: carried.returnPool,
      // База на старте: от неё считает планки правление
      startUsers: carried.users,
    },
    taxi: {
      on: false,
      launchedMonth: null,
      users: 0,
      drivers: 0,
      warUntil: 0,
      lockAdd: 0,
    },
    ecom: {
      on: false,
      launchedMonth: null,
      users: 0,
    },
    plus: {
      on: false,
      launchedMonth: null,
      subs: 0,
    },
    // Самокаты открываются только в год конгломерата; до него парк пуст,
    // не стоит ни рубля и не считается вертикалью.
    scoot: {
      cohorts: [],    // партии закупки: { units, wear } — износ в уличных месяцах
      users: 0,       // активные райдеры
    },
    both: 0,          // хаб ∩ такси
    bothEcom: 0,      // хаб ∩ е-ком
    bothScoot: 0,     // хаб ∩ самокаты
    trustUntil: 0,
    story: {},
    seenEvents: [],
    endless: false,
    scored: null,
    decisions: { ...DEFAULT_DECISIONS, verticals: [], partners: [] },
    flags: { valuationBonus: 0, regulationRisk: false, cofounder: false },
    board: { goal: null, history: [], profitableMonths: 0 },
    restrictions: null,
    pendingDilution: 0,
    pendingEvent: null,
    pendingChoice: null,
    history: [],
    over: null,   // 'bankrupt' | 'finished'
  };
  state.board.goal = makeGoal(1, state, carried.users);
  return state;
}

// ----------------------------------------------------------------------------
// Производные показатели
// ----------------------------------------------------------------------------

/**
 * Сила финансовой команды, 0…1. На лёгком уровне команда уже собрана и
 * стоит ноль — новичку нужна читаемая игра, а не её бухгалтерия. На
 * остальных её покупают, и разница уровней ровно одна: насколько быстро
 * деньги превращаются в силу.
 */
// Выручка прошлого месяца — от неё считается цена команды. До первого
// отчёта берём выручку стартового актива: холдинг не начинается с нуля.
function financeRevenue(state) {
  const h = state.history ?? [];
  const asset = assetById(state.assetId);
  return h.length ? h[h.length - 1].revenue : asset.users * asset.arpu;
}

export function financeSaturation(state) {
  return financeHalfCost(CONFIG.finance, state.difficulty, financeRevenue(state));
}

export function financeLevel(state, decisions) {
  return financeStrength(CONFIG.finance, state.difficulty,
    financeRevenue(state), decisions.finance ?? 0);
}

// Во что обходится месяц слабой финансовой службы: доля выручки, которая
// уходит эквайрингом, комиссиями, списаниями и штрафами.
export function miscRate(state, decisions) {
  return financeMiscRate(CONFIG.finance, state.difficulty, financeLevel(state, decisions));
}

// Бюджет команды: на лёгком уровне её содержит не игрок
export function financeCost(state, decisions) {
  return financeSpend(state.difficulty, decisions.finance ?? 0);
}

export function mgmtLevel(decisions) {
  const m = decisions.mgmt ?? 0;
  return m / (m + CONFIG.mgmtSaturation);
}

export function verticalsCount(state) {
  return 1 + (state.taxi.on ? 1 : 0) + (state.ecom.on ? 1 : 0);
}

// Конгломератный штраф: каждая вертикаль сверх первой размывает фокус.
// Подписка вертикалью не считается — это склейка, а не отдельный бизнес.
// Самокаты весят полвертикали (CONFIG.scooters.focusWeight) и только пока
// парк существует: операционно это склад, бригада и календарь, а не второе
// такси — но внимание совета директоров они всё же едят. Замер: с полным
// весом штраф фокуса стоил дороже всей самокатной экономики, и вертикаль
// становилась ловушкой по построению.
export function focusPenalty(state, decisions) {
  const n = verticalsCount(state)
    + (scooterFleet(state) > 0 ? CONFIG.scooters.focusWeight : 0);
  const relief = state.flags?.cofounder ? (1 - CONFIG.cofounder.focusRelief) : 1;
  return CONFIG.focusPenaltyPerVertical * (n - 1) * (1 - mgmtLevel(decisions)) * relief;
}

export function foodQuality(state, decisions) {
  const ops = decisions.foodOps ?? 0;
  const level = ops / (ops + CONFIG.foodOpsSaturation);
  return clamp((CONFIG.foodQualityFloor + 0.55 * level) * (1 - focusPenalty(state, decisions)), 0.2, 1.1);
}

export function taxiQuality(state, decisions) {
  return clamp(0.78 * (1 - focusPenalty(state, decisions)), 0.2, 1);
}

export function ecomQuality(state, decisions) {
  const ops = decisions.ecomOps ?? 0;
  const level = ops / (ops + 5_000_000);
  return clamp((0.5 + 0.5 * level) * (1 - focusPenalty(state, decisions)), 0.2, 1.1);
}

/**
 * Мощность логистики е-кома: 0…1 от месячного бюджета на склады, машины и
 * слоты доставки. Отдельно от ecomQuality нарочно: ассортимент и обработка
 * заказов — это «что продаём», логистика — «чем везём». Первое упирается в
 * федеральные маркетплейсы, второе — единственное, чем город их обходит.
 */
export function ecomCapacity(decisions) {
  const b = decisions.ecomLogistics ?? 0;
  return b > 0 ? b / (b + verticalById('ecom').logisticsSaturation) : 0;
}

// Парк самокатов: сумма живых партий закупки
export function scooterFleet(state) {
  return (state.scoot?.cohorts ?? []).reduce((s, c) => s + c.units, 0);
}

// Остаточная стоимость парка: за сколько его можно продать прямо сейчас.
// Стареет только на улице — склад сохраняет цену (см. CONFIG.scooters).
export function scooterResidualValue(state) {
  const sc = CONFIG.scooters;
  return Math.round((state.scoot?.cohorts ?? []).reduce((s, c) => s
    + c.units * sc.unitCost * sc.resaleShare
    * Math.max(0, 1 - c.wear / sc.streetLifeMonths), 0));
}

// Клиенты двух и более сервисов: пересечения хаба с вертикалями
export function multiUsers(state) {
  return state.both + (state.bothEcom ?? 0) + (state.bothScoot ?? 0);
}

export function uniqueUsers(state) {
  return Math.max(0,
    state.food.users + state.taxi.users + (state.ecom?.users ?? 0)
    + (state.scoot?.users ?? 0)
    - state.both - (state.bothEcom ?? 0) - (state.bothScoot ?? 0));
}

// Ворота совета: у такси их нет, е-ком выходит за воротами по метрикам
export function expansionOpen(state, vertical) {
  const gate = vertical.gate;
  const nextMonth = state.month + 1;
  if (nextMonth < gate.minMonth) return false;
  if (gate.assetContributionMonths > 0) {
    const h = state.history.slice(-gate.assetContributionMonths);
    if (h.length < gate.assetContributionMonths) return false;
    const avg = h.reduce((s, r) => s + (r.foodFullContribution ?? 0), 0) / h.length;
    if (avg <= 0) return false;
  }
  return true;
}

// Подписке нужно, что склеивать: хаб + хотя бы одна вертикаль
// Партнёрская сеть билетного старта: афиши и кассы города — это канал к тем,
// кто ЕЩЁ НЕ ваш клиент. Раньше перк давал только скидку на кросс-селл, а его
// ёмкость упирается в размер базы хаба — а она у билетов тогда была самой
// маленькой, и скидка выдавалась на канал, которым этот актив не мог
// воспользоваться (замер: кросс-селл выше 3 млн там ухудшал итог). База с
// тех пор пересобрана в самую широкую, но привязка осталась верной: сеть
// удешевляет и
// холодное привлечение вертикалей: тот же охват за меньшие деньги.
// Замер на 24 кодах, билеты, такси с 1-го месяца: без перка 2.05 млрд,
// с множителем 0.8 -> 2.21, 0.7 -> 2.29, 0.6 -> 2.44. Взято 0.7. Доставка и
// стриминг не двигаются вовсе — перк есть только у билетного старта.
export function partnerAcqMult(asset) {
  return hasPerk(asset, 'partner-network') ? CONFIG.partnerNetworkAcqMult : 1;
}

export function plusAvailable(state) {
  return verticalsCount(state) >= CONFIG.plus.minVerticals;
}

// Цена запуска Plus: привычка платить (стриминговый хаб) удешевляет запуск
export function plusLaunchCost(state) {
  const asset = assetById(state.assetId);
  return CONFIG.plus.launchCost * (hasPerk(asset, 'subscription-habit') ? 0.6 : 1);
}

// Льготный период наследия: фора действует первый год партии. Постоянная
// льгота на 36 месяцев компаундилась и решала партию — замер показал +11.5%
// от одной снятой абонентки, что вне правила «ощутимо, но не решает».
export function legacyGraceActive(state) {
  return (state.month ?? 0) < CONFIG.legacyCarry.graceMonths;
}

// Лицензия кино в подписку: со своим контентом не нужна, наследие КИНОРЕКИ
// даёт скидку на первый год.
export function cinemaLicenseFee(state) {
  const asset = assetById(state.assetId);
  if (hasPerk(asset, 'own-content')) return 0;
  const discounted = state.legacy?.cinema && legacyGraceActive(state);
  return CONFIG.partners.cinemaLicenseMonthly
    * (discounted ? CONFIG.legacyCarry.cinemaFeeMult : 1);
}

// Партнёрство по билетам: своему билетному сервису бесплатно всегда,
// наследию БИЛЕТВИЛЯ — льготный тариф на первый год.
export function ticketsPartnerFee(state) {
  const asset = assetById(state.assetId);
  if (hasPerk(asset, 'own-tickets')) return 0;
  const discounted = state.legacy?.tickets && legacyGraceActive(state);
  return CONFIG.partners.ticketsMonthly
    * (discounted ? CONFIG.legacyCarry.ticketsFeeMult : 1);
}

// ----------------------------------------------------------------------------
// Главный шаг симуляции
// ----------------------------------------------------------------------------
export function step(prevState, input = {}) {
  const state = deepClone(prevState);
  if (state.over) return { state, report: state.history[state.history.length - 1] ?? null };

  const asset = assetById(state.assetId);
  const taxiDef = verticalById('taxi');
  const ecomDef = verticalById('ecom');

  const decisions = { ...state.decisions, ...(input.decisions ?? {}) };
  state.decisions = decisions;

  const rng = createRng(state.seed);
  rng.restore(state.rngState);

  const month = state.month + 1;

  // --- 0. Ограничения совета ---
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
  capBudget('ecomMarketing');
  capBudget('crossSell');

  // Размеры на начало месяца: поштучные цены событий считаются от того,
  // что игрок видит на экране в момент выбора
  const driversAtStart = state.taxi.drivers;
  const foodUsersAtStart = state.food.users;
  const taxiUsersAtStart = state.taxi.users;
  const ecomUsersAtStart = state.ecom.users;
  const uniqueAtStart = uniqueUsers(state);

  // --- 1. Событие месяца ---
  const mods = neutralModifiers();
  const event = state.pendingEvent;
  const choice = input.eventChoice ?? state.pendingChoice ?? 0;
  applyEvent(mods, event, choice);
  if (mods.valuationBonus) state.flags.valuationBonus += mods.valuationBonus;
  if (mods.regulationRisk) state.flags.regulationRisk = true;
  if (mods.trustMonths) state.trustUntil = Math.max(state.trustUntil, month + mods.trustMonths);
  if (mods.endWar) state.taxi.warUntil = month;
  if (mods.lockAdd) state.taxi.lockAdd += mods.lockAdd;
  state.story = state.story ?? {};
  if (mods.fedMonths) {
    state.story.fedUntil = month + mods.fedMonths - 1;
    state.story.fedSoft = Boolean(mods.fedSoft);
  }
  if (mods.crisisMonths) {
    state.story.crisisUntil = month + mods.crisisMonths - 1;
    state.story.crisisCut = Boolean(mods.crisisCut);
  }
  // Контракт с аэропортом срочный: год выделенных стоянок, потом новый тендер.
  // Вечная прибавка частоты была викториной (24/24 за «выиграть» при любой
  // цене): тонкая маржа такси умножает любой вечный плюс частоты в десятки
  // процентов итога, а поздний буст ещё и целиком попадает в окно роста
  // оценки. Срок возвращает решению цену.
  if (mods.tripsPerUserAdd) {
    state.story.tripsAdd = (state.story.tripsAdd ?? 0) + mods.tripsPerUserAdd;
    state.story.tripsUntil = month + CONFIG.airportContractMonths - 1;
  }
  if (mods.crossCacMult !== 1) {
    state.story.crossCacMult = (state.story.crossCacMult ?? 1) * mods.crossCacMult;
  }
  if (mods.crossReachMult !== 1) {
    state.story.crossReachMult = (state.story.crossReachMult ?? 1) * mods.crossReachMult;
  }
  // Антимонопольное дело: исход остаётся с холдингом до конца партии
  if (mods.splitLogistics) state.story.logisticsSplit = true;
  if (mods.plusConvMult !== 1) {
    state.story.plusConvMult = (state.story.plusConvMult ?? 1) * mods.plusConvMult;
  }
  if (mods.plusChurnAdd) {
    state.story.plusChurnAdd = (state.story.plusChurnAdd ?? 0) + mods.plusChurnAdd;
  }
  if (mods.ecoReliefCut) {
    state.story.ecoReliefCut = (state.story.ecoReliefCut ?? 0) + mods.ecoReliefCut;
  }
  if (mods.legalMonths) state.story.legalUntil = month + mods.legalMonths - 1;
  if (mods.supervisionOn) state.story.supervision = true;
  // Сооснователь: доля отдаётся один раз и навсегда, отдача — вечная
  if (mods.cofounder && !state.flags.cofounder) {
    state.flags.cofounder = true;
    state.equity *= 1 - CONFIG.cofounder.equity;
  }
  const legalActive = (state.story.legalUntil ?? 0) >= month;
  const fedActive = (state.story.fedUntil ?? 0) >= month;
  const fedChurnAdd = fedActive ? (state.story.fedSoft ? 0.004 : 0.008) : 0;
  const fedAcqMult = fedActive ? (state.story.fedSoft ? 0.85 : 0.75) : 1;
  const crisisActive = (state.story.crisisUntil ?? 0) >= month;
  const crisisFoodDemand = crisisActive ? 0.93 : 1;
  const crisisTaxiDemand = crisisActive ? 0.88 : 1;
  const crisisEcomDemand = crisisActive ? 0.90 : 1;
  // Срез экономит 35% фикса ценой 4% качества. Прежние 25%/7% делали выбор
  // викториной: «держать сервис» побеждало в 94% состояний — экономия не
  // окупала оттока никогда. На 35%/4% выбор живой (23/48) и зависит от
  // месяца и структуры: ранний кризис выгоднее резать, поздний на одной
  // вертикали — переждать.
  const crisisFixedMult = crisisActive && state.story.crisisCut ? 0.65 : 1;
  const crisisQualityMult = crisisActive && state.story.crisisCut ? 0.96 : 1;

  // --- 2. Запуски: вертикали и подписка ---
  const wanted = new Set(decisions.verticals ?? []);
  let launchCost = 0;
  let taxiLaunched = false;
  let taxiClosed = false;
  let ecomLaunched = false;
  let plusLaunched = false;

  if (wanted.has('taxi') && !state.taxi.on) {
    if (expansionOpen(prevState, taxiDef)) {
      state.taxi.on = true;
      state.taxi.launchedMonth = month;
      state.taxi.warUntil = month + taxiDef.warMonths;
      state.taxi.drivers = 200;
      state.taxi.users = 3_000;
      launchCost += taxiDef.launchCost * (asset.launchCostMult?.taxi ?? 1);
      taxiLaunched = true;
    }
  } else if (!wanted.has('taxi') && state.taxi.on) {
    state.taxi.on = false;
    state.taxi.users = 0;
    state.taxi.drivers = 0;
    state.both = 0;
    taxiClosed = true;
  }

  if (wanted.has('ecom') && !state.ecom.on) {
    if (expansionOpen(prevState, ecomDef)) {
      state.ecom.on = true;
      state.ecom.launchedMonth = month;
      state.ecom.users = 2_000;
      // Готовая курьерская логистика хаба удешевляет запуск — из дескриптора
      launchCost += ecomDef.launchCost * (asset.launchCostMult?.ecom ?? 1);
      ecomLaunched = true;
    }
  } else if (!wanted.has('ecom') && state.ecom.on) {
    state.ecom.on = false;
    state.ecom.users = 0;
    state.bothEcom = 0;
  }

  if (wanted.has('plus') && !state.plus.on && plusAvailable(state)) {
    state.plus.on = true;
    state.plus.launchedMonth = month;
    launchCost += plusLaunchCost(state);
    plusLaunched = true;
  } else if (!wanted.has('plus') && state.plus.on) {
    state.plus.on = false;
    state.plus.subs = 0;
  }

  const taxiOn = state.taxi.on;
  const ecomOn = state.ecom.on;
  const plusOn = state.plus.on;
  const atWar = taxiOn && state.taxi.warUntil > month;
  const trustBroken = state.trustUntil > month;
  const partners = new Set(decisions.partners ?? []);
  const cinemaOn = plusOn && (partners.has('cinema') || hasPerk(asset, 'own-content'));
  const ticketsOn = partners.has('tickets') || hasPerk(asset, 'own-tickets');

  // --- 3. Фокус, качество, подписка как множитель удержания ---
  const penalty = focusPenalty(state, decisions);
  let qFood = foodQuality(state, decisions) * crisisQualityMult;
  const qTaxi = taxiQuality(state, decisions) * crisisQualityMult;
  const qEcom = ecomQuality(state, decisions) * crisisQualityMult;
  // Общая логистика: курьеры хаба возят посылки в непик — е-ком маржинальнее,
  // но переиспользование мощности имеет цену: пиковые конфликты бьют по еде
  const logistics = hasPerk(asset, 'courier-logistics') && ecomOn
    && !state.story.logisticsSplit;
  // Мощность логистики: главный рычаг е-кома. Уровень 0…1 — сколько складов,
  // машин и слотов доставки куплено на месяц.
  const logisticsLevel = ecomOn ? ecomCapacity(decisions) : 0;
  if (logistics && state.food.users > 0) {
    const share = Math.min(1, state.ecom.users / state.food.users);
    // Общий парк: базовый конфликт пиков плюс мощность, уведённая в посылки
    qFood *= 1 - (ecomDef.logisticsPeakPenalty
      + ecomDef.logisticsHubPenalty * logisticsLevel) * share;
  }

  const multiAtStart = multiUsers(state);
  const subsShare = multiAtStart > 0 ? clamp(state.plus.subs / multiAtStart, 0, 1) : 0;
  // Подписчик уходит реже: Plus усиливает экосистемное удержание
  // Открытая конкурентам подписка ослабляет саму склейку: клиент двух
  // сервисов держится за холдинг слабее, чем держался бы за эксклюзив.
  const reliefBoth = clamp(
    CONFIG.ecoChurnRelief - (state.story.ecoReliefCut ?? 0)
    + CONFIG.plus.churnReliefMax * subsShare, 0, 0.6,
  );

  // --- 4. Хаб (стартовый актив): дожим, выручка, отток, возврат ---
  const takeIdx = clamp(decisions.foodTake ?? 1, 0.8, 1.3);
  const takeFreqFactor = Math.pow(takeIdx, -CONFIG.foodTakeElasticity);
  const foodSeason = seasonFood(month);
  // Подписчики пользуются чаще: все они — клиенты хаба
  const plusFoodBoost = state.food.users > 0
    ? 1 + CONFIG.plus.freqBoostFood * (state.plus.subs / Math.max(1, state.food.users)) : 1;
  const arpuFood = asset.arpu * takeIdx * takeFreqFactor
    * (0.94 + 0.08 * qFood) * foodSeason * mods.foodDemandMult * crisisFoodDemand
    * plusFoodBoost;
  const revenueFood = state.food.users * arpuFood;
  const contribFood = revenueFood * asset.margin;

  const takePressure = CONFIG.foodTakePressure * Math.pow(Math.max(0, takeIdx - 1), 1.2)
    + CONFIG.foodTakeExodus * Math.pow(Math.max(0, takeIdx - CONFIG.foodTakeThreshold), 1.5);
  const churnFoodRate = clamp(
    asset.baseChurn
    + CONFIG.foodChurnQuality * Math.max(0, CONFIG.foodQualityRef - qFood)
    + takePressure
    + mods.foodChurnAdd
    + fedChurnAdd,
    0.005, 0.5,
  );
  const hubOnly = Math.max(0, state.food.users - state.both - state.bothEcom);
  const lostFoodOnly = hubOnly * churnFoodRate;
  const lostFoodBoth = state.both * churnFoodRate * (1 - reliefBoth);
  const lostFoodBothEcom = state.bothEcom * churnFoodRate * (1 - reliefBoth);
  const lostFood = lostFoodOnly + lostFoodBoth + lostFoodBothEcom;

  // Возврат ушедших: «известный бренд» наследия удешевляет его
  const winbackCac = CONFIG.foodWinbackCac * (state.legacy?.asset ? 0.85 : 1);
  const winbackBudget = decisions.foodMarketing ?? 0;
  const winbackCap = state.food.returnPool * CONFIG.foodWinbackReach * (0.5 + 0.5 * qFood);
  const wonBack = Math.min(winbackBudget / winbackCac, winbackCap);
  const winbackWasted = Math.max(0, winbackBudget - wonBack * winbackCac);
  const organicFood = Math.max(0, asset.reachableCap - state.food.users)
    * CONFIG.foodOrganicShare * qFood * (state.legacy?.asset ? 1.3 : 1);

  // --- 5. Такси ---
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
    // Прибавка частоты живёт, пока действует контракт с аэропортом.
    // В старых сохранениях срока нет — там прибавка остаётся вечной.
    const tripsBoostOn = (state.story.tripsAdd ?? 0) > 0
      && (state.story.tripsUntil == null || month <= state.story.tripsUntil);
    const tripsPerUser = taxiDef.tripsPerUser + (tripsBoostOn ? state.story.tripsAdd : 0);
    const subsInTaxi = multiAtStart > 0 ? state.plus.subs * (state.both / multiAtStart) : 0;
    const plusTaxiBoost = state.taxi.users > 0
      ? 1 + CONFIG.plus.freqBoostTaxi * (subsInTaxi / Math.max(1, state.taxi.users)) : 1;
    demandTrips = state.taxi.users * tripsPerUser * taxiPriceFactor
      * seasonTaxi(month) * mods.taxiDemandMult * crisisTaxiDemand * plusTaxiBoost;
    const capacity = state.taxi.drivers * CONFIG.taxiTripsPerDriver * mods.taxiCapacityMult;
    servedTrips = Math.min(demandTrips, capacity);
    fill = demandTrips > 0 ? servedTrips / demandTrips : 1;
    utilDrivers = capacity > 0 ? servedTrips / capacity : 0;

    const subsidyPerTrip = taxiDef.fare * Math.max(0, 1 - priceIdx) * CONFIG.taxiSubsidyShare;
    cmPerTrip = fareEff * taxiDef.takeRate
      - (CONFIG.taxiCostPerTrip + mods.costPerTripAdd) - subsidyPerTrip;
    revenueTaxi = servedTrips * fareEff * taxiDef.takeRate;
    contribTaxi = servedTrips * cmPerTrip;

    driverHires = ((decisions.taxiSupply ?? 0) / CONFIG.taxiDriverOnboardCost)
      * mods.driverSupplyMult;
    const idle = Math.max(0, CONFIG.taxiDriverIdleFloor - utilDrivers) / CONFIG.taxiDriverIdleFloor;
    const driverChurn = clamp(
      CONFIG.taxiDriverBaseChurn + CONFIG.taxiDriverIdleChurn * idle + mods.driverChurnAdd,
      0.01, 0.6,
    );
    driversLost = state.taxi.drivers * driverChurn;
    // Единовременный исход парка: событие может увести долю водителей разом,
    // а не поднять месячный отток. Прибавка к оттоку в модели слишком мягкая —
    // бюджет предложения восстанавливает парк за месяц, и «не ввязываться»
    // становилось бесплатным (замер: платный вариант выигрывал 4–7% партий).
    if (mods.driverLossShare) {
      driversLost += (state.taxi.drivers - driversLost) * mods.driverLossShare;
    }
    state.taxi.drivers = Math.max(0, state.taxi.drivers - driversLost + driverHires);

    churnTaxiRate = clamp(
      CONFIG.taxiBaseChurn
      + CONFIG.taxiChurnQuality * Math.max(0, 0.8 - qTaxi)
      + CONFIG.taxiChurnFill * (1 - fill)
      + 0.08 * Math.max(0, priceIdx - 1)
      + mods.taxiChurnAdd
      + fedChurnAdd,
      0.01, 0.6,
    );
    const taxiOnly = Math.max(0, state.taxi.users - state.both);
    const lostTaxiOnly = taxiOnly * churnTaxiRate;
    const lostTaxiBoth = state.both * churnTaxiRate * (1 - reliefBoth);
    lostTaxi = lostTaxiOnly + lostTaxiBoth;

    const mBudget = decisions.taxiMarketing ?? 0;
    coldAcq = taxiPool * CONFIG.taxiMarketingReach
      * (mBudget / (mBudget + CONFIG.taxiMarketingSaturation * partnerAcqMult(asset)))
      * clamp(Math.pow(taxiPriceFactor, 0.7), 0.5, 1.3)
      * (atWar ? 1 - taxiDef.warAcqCut : 1)
      * fedAcqMult;

    state.both = Math.max(0, state.both - lostTaxiBoth);
    state.taxi.users = Math.max(0, state.taxi.users - lostTaxi + coldAcq);
  }

  // --- 6. Е-ком: портфельная модель против маркетплейсов ---
  let revenueEcom = 0; let contribEcom = 0; let arpuEcom = 0;
  let ecomColdAcq = 0; let lostEcom = 0; let churnEcomRate = 0; let ecomPool = 0;
  // Отделённая логистика: владелец курьерской сети теряет свой бонус маржи,
  // остальные — рыночную наценку на чужую доставку. Наказание одно, не два.
  const splitCut = state.story.logisticsSplit && !hasPerk(asset, 'courier-logistics')
    ? CONFIG.antitrust.ecomMarginCut : 0;
  // Своя мощность дешевле подряда: маржа растёт с уровнем логистики, а не
  // выдаётся за перк. Перк курьерского актива остаётся стартовым преимуществом.
  // Модель торговли: 1 — свой склад, 0 — чистая площадка
  const ownShare = ecomOn ? clamp(decisions.ecomOwnShare ?? 1, 0, 1) : 1;
  const modelMargin = ecomDef.ownMarginBase - ecomDef.ownMarginCut * ownShare;
  const marginEcom = modelMargin + (logistics ? ecomDef.logisticsMarginBonus : 0)
    + ecomDef.logisticsMarginGain * logisticsLevel - splitCut;
  if (ecomOn) {
    ecomPool = Math.max(0, ecomDef.potential * (1 - ecomDef.incumbentLock) - state.ecom.users);
    const subsInEcom = multiAtStart > 0 ? state.plus.subs * (state.bothEcom / multiAtStart) : 0;
    const plusEcomBoost = state.ecom.users > 0
      ? 1 + CONFIG.plus.freqBoostFood * (subsInEcom / Math.max(1, state.ecom.users)) : 1;
    // У площадки выручкой считается только комиссия — чек тот же, но ваш
    // из него лишь кусок. Поэтому 3P дешевле в капитале и тоньше в выручке.
    arpuEcom = ecomDef.arpu * (ecomDef.ownArpuBase + ecomDef.ownArpuGain * ownShare)
      * (0.9 + 0.12 * qEcom) * crisisEcomDemand * plusEcomBoost
      * (1 + ecomDef.logisticsArpuGain * logisticsLevel);
    revenueEcom = state.ecom.users * arpuEcom;
    contribEcom = revenueEcom * marginEcom;

    churnEcomRate = clamp(
      ecomDef.baseChurn
      + ecomDef.churnQuality * Math.max(0, 0.75 - qEcom)
      - ecomDef.logisticsChurnCut * logisticsLevel
      + ecomDef.platformChurnAdd * (1 - ownShare)
      + fedChurnAdd,
      0.01, 0.5,
    );
    const ecomOnly = Math.max(0, state.ecom.users - state.bothEcom);
    const lostEcomOnly = ecomOnly * churnEcomRate;
    const lostEcomBoth = state.bothEcom * churnEcomRate * (1 - reliefBoth);
    lostEcom = lostEcomOnly + lostEcomBoth;

    const mBudget = decisions.ecomMarketing ?? 0;
    ecomColdAcq = ecomPool * ecomDef.marketingReach
      * (mBudget / (mBudget + ecomDef.marketingSaturation * partnerAcqMult(asset)))
      * fedAcqMult;

    state.bothEcom = Math.max(0, state.bothEcom - lostEcomBoth);
    state.ecom.users = Math.max(0, state.ecom.users - lostEcom + ecomColdAcq);
  }

  // --- 7. Кросс-селл: хаб раздаёт вторые сервисы -----------------------------
  // Канал имеет цену и ёмкость; перерасход сгорает. Прямые направления делят
  // бюджет пропорционально ёмкостям, обратные возвращают клиентов в хаб.
  let crossConv = 0; let crossEcomConv = 0; let crossBackConv = 0;
  let crossSpent = 0; let crossWasted = 0; let crossCac = 0;
  const anySpokeOn = taxiOn || ecomOn;
  const crossBudget = anySpokeOn ? (decisions.crossSell ?? 0) : 0;
  if (crossBudget > 0) {
    const trustMult = (trustBroken ? 0.55 : 1) * mods.crossSellMult
      * (legalActive ? CONFIG.antitrust.legalCrossMult : 1);
    const storyCac = (state.story.crossCacMult ?? 1)
      * (hasPerk(asset, 'partner-network') ? 0.8 : 1);
    const storyReach = (state.story.crossReachMult ?? 1)
      * (state.story.supervision ? CONFIG.antitrust.supervisionReachMult : 1);
    const hubFree = Math.max(0, state.food.users - state.both - state.bothEcom);

    // Прямые направления: хаб -> вертикаль
    const targets = [];
    if (taxiOn) {
      const attract = clamp(0.25 + 0.75 * qTaxi, 0, 1.1)
        * clamp(taxiPriceFactor, 0.6, 1.15) * (0.5 + 0.5 * fill);
      targets.push({
        id: 'taxi',
        cac: (CONFIG.crossSellCac / (asset.synergy?.taxi ?? 1)) * storyCac,
        cap: hubFree * CONFIG.crossSellMonthlyReach * attract * trustMult * storyReach,
      });
    }
    if (ecomOn) {
      // Мощность логистики расширяет ёмкость канала: клиенту хаба легче
      // попробовать посылки, когда их привозят те же курьеры и в тот же день.
      const attract = clamp(0.25 + 0.75 * qEcom, 0, 1.1)
        * (1 + ecomDef.logisticsCrossGain * logisticsLevel)
        * (1 + ecomDef.platformAttractGain * (1 - ownShare));
      targets.push({
        id: 'ecom',
        cac: (CONFIG.crossSellCac / (asset.synergy?.ecom ?? 1)) * storyCac,
        cap: hubFree * ecomDef.crossReach * attract * trustMult * storyReach,
      });
    }
    const capSum = targets.reduce((s, tgt) => s + tgt.cap, 0) || 1;
    const budgetF = crossBudget * (1 - CONFIG.crossBackShare);
    for (const tgt of targets) {
      const share = budgetF * (tgt.cap / capSum);
      const conv = Math.min(share / tgt.cac, tgt.cap);
      crossSpent += conv * tgt.cac;
      if (tgt.id === 'taxi') crossConv = conv;
      else crossEcomConv = conv;
    }

    // Обратные направления: вертикаль -> хаб
    const backCac = CONFIG.crossBackCac * storyCac;
    const attractFood = clamp(0.25 + 0.75 * qFood, 0, 1.1);
    const hubRoom = Math.max(0, asset.reachableCap - state.food.users);
    const backs = [];
    if (taxiOn) {
      backs.push({
        id: 'taxi',
        cap: Math.max(0, state.taxi.users - state.both)
          * CONFIG.crossBackMonthlyReach * attractFood * trustMult * storyReach,
      });
    }
    if (ecomOn) {
      backs.push({
        id: 'ecom',
        cap: Math.max(0, state.ecom.users - state.bothEcom)
          * CONFIG.crossBackMonthlyReach * attractFood * trustMult * storyReach,
      });
    }
    const backCapSum = backs.reduce((s, b) => s + b.cap, 0) || 1;
    const budgetB = crossBudget * CONFIG.crossBackShare;
    let roomLeft = hubRoom;
    for (const b of backs) {
      const share = budgetB * (b.cap / backCapSum);
      const conv = Math.min(share / backCac, b.cap, roomLeft);
      roomLeft -= conv;
      crossSpent += conv * backCac;
      crossBackConv += conv;
      if (b.id === 'taxi') state.both += conv;
      else state.bothEcom += conv;
    }

    crossWasted = Math.max(0, crossBudget - crossSpent);
    const totalConv = crossConv + crossEcomConv + crossBackConv;
    crossCac = totalConv > 0 ? crossBudget / totalConv : 0;

    // Прямые конверсии: клиент хаба получает второй сервис
    state.taxi.users += crossConv;
    state.both += crossConv;
    state.ecom.users += crossEcomConv;
    state.bothEcom += crossEcomConv;
    // Обратные: клиент вертикали становится клиентом хаба
    state.food.users += crossBackConv;
  }

  // Итог месяца по базе хаба
  state.food.users = Math.max(0, state.food.users - lostFood + wonBack + organicFood);
  state.both = Math.max(0, state.both - lostFoodBoth);
  state.bothEcom = Math.max(0, state.bothEcom - lostFoodBothEcom);
  state.food.returnPool = Math.max(0,
    state.food.returnPool * (1 - CONFIG.foodReturnPoolDecay)
    + lostFood * CONFIG.foodReturnShare
    - wonBack);
  state.both = Math.min(state.both, state.food.users, state.taxi.users);
  state.bothEcom = Math.min(state.bothEcom, state.food.users, state.ecom.users);

  // --- 7б. Самокаты: парк как капитал (только год конгломерата) ---
  // Деньги превращаются в железо. Железо возит, стареет на улице и продаётся
  // дешевле, чем куплено. Управление — не бюджет, а календарь: план года
  // решает, какие месяцы парк зарабатывает, а какие пережидает на складе.
  if (!state.scoot) state.scoot = { cohorts: [], users: 0 };
  if (state.bothScoot == null) state.bothScoot = 0;
  const sc = CONFIG.scooters;
  let revenueScoot = 0; let scootRides = 0; let scootCosts = 0;
  let scootCapex = 0; let scootResale = 0;
  let scootBought = 0; let scootSold = 0; let scootScrapped = 0;
  let scootStreet = false;
  if (state.endless) {
    // Закупка: очередь решения исполняется и сбрасывается — это заказ,
    // а не ставка бюджета
    const buyBatches = clamp(Math.floor(decisions.scooterBuy ?? 0), 0, sc.maxBatchesPerMonth);
    if (buyBatches > 0) {
      scootBought = buyBatches * sc.batchUnits;
      scootCapex = scootBought * sc.unitCost;
      state.scoot.cohorts.push({ units: scootBought, wear: 0 });
    }
    decisions.scooterBuy = 0;
    // Продажа: сперва самые изношенные — у них меньше всего остаточной жизни
    let sellLeft = Math.max(0, Math.floor(decisions.scooterSell ?? 0)) * sc.batchUnits;
    if (sellLeft > 0) {
      const worn = [...state.scoot.cohorts].sort((a, b) => b.wear - a.wear);
      for (const cohort of worn) {
        if (sellLeft <= 0) break;
        const take = Math.min(cohort.units, sellLeft);
        scootResale += take * sc.unitCost * sc.resaleShare
          * Math.max(0, 1 - cohort.wear / sc.streetLifeMonths);
        cohort.units -= take;
        sellLeft -= take;
        scootSold += take;
      }
      state.scoot.cohorts = state.scoot.cohorts.filter((c) => c.units > 0);
      scootResale = Math.round(scootResale);
    }
    decisions.scooterSell = 0;

    const fleet = scooterFleet(state);
    const plan = Array.isArray(decisions.scooterPlan) && decisions.scooterPlan.length === 12
      ? decisions.scooterPlan : null;
    const calIdx = (month - 1) % 12;
    scootStreet = fleet > 0
      && (mods.scootForceStreet || !plan || plan[calIdx] !== 'store');
    if (scootStreet) {
      // Поездки: спрос города против ёмкости парка. Лишние самокаты зимой
      // не возят никого — но стареть продолжают.
      const demand = sc.cityDemandRides * seasonScooters(month) * (mods.scootDemandMult ?? 1);
      scootRides = Math.round(Math.min(demand, fleet * sc.ridesPerUnitMonth));
      revenueScoot = scootRides * sc.ridePrice;
      scootCosts += fleet * sc.maintenancePerUnit;
      // Износ — только уличный: месяц на улице съедает месяц жизни.
      // Зимняя улица съедает два: реагенты, соль и морозы убивают батареи.
      const wearAdd = seasonScooters(month) < sc.winterSeasonMax ? sc.winterWearMult : 1;
      for (const cohort of state.scoot.cohorts) cohort.wear += wearAdd;
      scootScrapped = state.scoot.cohorts
        .filter((c) => c.wear >= sc.streetLifeMonths)
        .reduce((s, c) => s + c.units, 0);
      state.scoot.cohorts = state.scoot.cohorts.filter((c) => c.wear < sc.streetLifeMonths);
      // Райдеры подтягиваются к ёмкости живого парка
      const capRiders = scooterFleet(state) * sc.ridersPerUnit;
      state.scoot.users += Math.round((capRiders - state.scoot.users) * sc.riderAdopt);
    } else {
      if (fleet > 0) scootCosts += fleet * sc.storagePerUnit;
      // Без самокатов на улице привычка тает — склейка зимой проседает
      state.scoot.users = Math.round(state.scoot.users * (1 - sc.riderDecay));
    }
    if (fleet > 0) scootCosts += sc.fixedMonthly;
    state.scoot.users = Math.max(0, state.scoot.users);
    // Склейка: райдеры в большинстве своём уже клиенты хаба, Plus даёт
    // бесплатный доступ и увеличивает пересечение
    const overlap = clamp(sc.hubOverlap + (state.plus.on ? sc.plusOverlapBoost : 0), 0, 0.95);
    state.bothScoot = Math.min(Math.round(state.scoot.users * overlap), state.food.users);
  }
  const scootOn = scooterFleet(state) > 0 || scootSold > 0 || scootScrapped > 0;
  const scootFullContribution = state.endless
    ? scootRides * (sc.ridePrice - sc.rideVarCost) - scootCosts : 0;

  // --- 8. Подписка «Новоград Plus»: покупка удержания за маржу ---
  let plusConv = 0; let plusChurned = 0; let revenuePlus = 0; let plusPerkCost = 0;
  const plusPrice = clamp(decisions.plusPrice ?? CONFIG.plus.priceRef, 199, 399);
  const multiNow = multiUsers(state);
  if (plusOn) {
    const priceAttract = Math.pow(CONFIG.plus.priceRef / plusPrice, CONFIG.plus.priceElasticity);
    const habitMult = hasPerk(asset, 'subscription-habit') ? 1.25 : 1;
    const cinemaBoost = cinemaOn ? 1 + CONFIG.partners.cinemaConvBoost : 1;
    plusConv = Math.max(0, multiNow - state.plus.subs)
      * CONFIG.plus.baseConvShare * priceAttract * habitMult * cinemaBoost
      * (state.story.plusConvMult ?? 1)
      * (trustBroken ? 0.7 : 1);
    const plusChurn = clamp(
      CONFIG.plus.baseChurn
      + (state.story.plusChurnAdd ?? 0)
      + 0.10 * Math.max(0, plusPrice / CONFIG.plus.priceRef - 1)
      - (cinemaOn ? CONFIG.partners.cinemaChurnRelief : 0)
      - (ticketsOn ? 0.008 : 0),
      0.01, 0.4,
    );
    plusChurned = state.plus.subs * plusChurn;
    state.plus.subs = clamp(state.plus.subs - plusChurned + plusConv, 0, multiNow);
    revenuePlus = state.plus.subs * plusPrice;
    plusPerkCost = state.plus.subs * CONFIG.plus.perkCostPerSub;
  }

  // Партнёрство по билетам: событийная выручка с мульти-клиентов
  const revenueTickets = ticketsOn ? multiNow * CONFIG.partners.ticketsArpuPerMulti : 0;
  const licenseFee = cinemaOn ? cinemaLicenseFee(state) : 0;
  const ticketsFee = ticketsOn ? ticketsPartnerFee(state) : 0;

  // --- 9. P&L холдинга ---
  const revenue = revenueFood + revenueTaxi + revenueEcom + revenuePlus
    + revenueTickets + revenueScoot;
  const contribution = contribFood + contribTaxi + contribEcom
    + (revenuePlus - plusPerkCost) + revenueTickets * 0.7
    + scootRides * (sc.ridePrice - sc.rideVarCost);
  const fixedFood = asset.fixedMonthly * crisisFixedMult;
  const fixedTaxi = (taxiOn ? taxiDef.fixedMonthly : 0) * crisisFixedMult;
  // Фикс е-кома — это склады: у площадки их нет, товар лежит у продавца
  const fixedEcom = (ecomOn
    ? ecomDef.fixedMonthly * (ecomDef.ownFixedBase + ecomDef.ownFixedGain * ownShare)
    : 0) * crisisFixedMult;
  const taxiBudgets = taxiOn ? (decisions.taxiSupply ?? 0) + (decisions.taxiMarketing ?? 0) : 0;
  const ecomBudgets = ecomOn
    ? (decisions.ecomOps ?? 0) + (decisions.ecomMarketing ?? 0) + (decisions.ecomLogistics ?? 0) : 0;
  // Пока идёт антимонопольное дело, юристы — такой же фикс, как офис
  const legalCost = legalActive ? CONFIG.antitrust.legalMonthly : 0;
  // Прочие расходы: эквайринг, комиссии, списания, штрафы, неразнесённая
  // административка. Единственная строка, которая растёт сама по себе —
  // вместе с выручкой, — и единственная, которую режет не бизнес-решение,
  // а финансовая служба.
  const financeBudget = financeCost(state, decisions);
  const rateMisc = miscRate(state, decisions);
  const miscCost = revenue * rateMisc;
  const opex = CONFIG.hqMonthly + legalCost + (decisions.mgmt ?? 0) + crossBudget
    + (decisions.foodOps ?? 0) + (decisions.foodMarketing ?? 0)
    + fixedFood + fixedTaxi + fixedEcom + taxiBudgets + ecomBudgets
    + licenseFee + ticketsFee + financeBudget + miscCost + scootCosts;

  const foodFullContribution = contribFood - fixedFood
    - (decisions.foodOps ?? 0) - (decisions.foodMarketing ?? 0);
  const taxiFullContribution = taxiOn ? contribTaxi - fixedTaxi - taxiBudgets : 0;
  const ecomFullContribution = ecomOn ? contribEcom - fixedEcom - ecomBudgets : 0;
  const plusFullContribution = plusOn
    ? revenuePlus - plusPerkCost - licenseFee : 0;

  const profit = contribution - opex;
  const perUnitCost = (mods.oneOffCostPerDriver ?? 0) * driversAtStart
    + (mods.oneOffCostPerFoodUser ?? 0) * foodUsersAtStart
    + (mods.oneOffCostPerTaxiUser ?? 0) * taxiUsersAtStart
    + (mods.oneOffCostPerUniqueUser ?? 0) * uniqueAtStart;
  // Оборотный капитал своего склада: товар покупают до того, как продадут.
  // Растущий 1P-е-ком ест кассу вперёд выручки — это и есть его настоящая
  // цена, и в отчёте она стоит рядом с разовыми, а не прячется в марже.
  const ecomGrowthUsers = Math.max(0, state.ecom.users - ecomUsersAtStart);
  const workingCapital = ecomOn
    ? ecomGrowthUsers * ecomDef.workingCapitalPerUser * ownShare : 0;
  // Закупка самокатов — капитальные расходы: касса меняется на цену партии,
  // но в операционную прибыль они не входят (в оценке парк живёт остаточной
  // стоимостью — см. sumOfParts). Продажа возвращает деньги той же строкой.
  const oneOff = launchCost + (mods.oneOffCost ?? 0) + perUnitCost + workingCapital
    + scootCapex;
  state.cash += profit - oneOff + scootResale;

  // --- 10. Метрики ---
  const unique = uniqueUsers(state);
  const multi = multiUsers(state);
  const multiShare = unique > 0 ? multi / unique : 0;
  const arpuHolding = unique > 0 ? revenue / unique : 0;
  const cacCold = coldAcq > 0 ? (decisions.taxiMarketing ?? 0) / coldAcq : 0;
  const cacColdEcom = ecomColdAcq > 0 ? (decisions.ecomMarketing ?? 0) / ecomColdAcq : 0;

  // --- 11. Совет директоров ---
  if (profit > 0) state.board.profitableMonths += 1;
  const progress = goalProgress(state.board.goal, {
    taxiUsers: state.taxi.users,
    multiShare,
    profitableMonths: state.board.profitableMonths,
    uniqueUsers: unique,
    // Рост за пост-эндгейм считается от замороженного зачётного счёта
    growth: endlessGrowth(state),
  });
  let goalOutcome = null;
  if (state.board.goal && month % CONFIG.boardYearMonths === 0 && !state.endless) {
    goalOutcome = applyGoalOutcome(state, state.board.goal, progress, month);
    state.board.history.push(goalOutcome);
    state.board.profitableMonths = 0;
    const next = state.board.goal.year + 1;
    state.board.goal = state.endless ? state.board.goal
      : (month < CONFIG.monthsTotal ? makeGoal(next, state, unique) : null);
  }
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
    revenueEcom,
    revenuePlus,
    revenueTickets,
    contribution,
    contribFood,
    contribTaxi,
    contribEcom,
    foodFullContribution,
    taxiFullContribution,
    ecomFullContribution,
    ecomCapacity: logisticsLevel,
    ecomOwnShare: ownShare,
    ecomWorkingCapital: workingCapital,
    financeLevel: financeLevel(state, decisions),
    financeCost: financeBudget,
    miscRate: rateMisc,
    miscCost,
    plusFullContribution,
    opex,
    fixedFood,
    fixedTaxi,
    fixedEcom,
    licenseFee,
    legalCost,
    legalMonthsLeft: legalActive ? state.story.legalUntil - month + 1 : 0,
    logisticsSplit: Boolean(state.story.logisticsSplit),
    supervision: Boolean(state.story.supervision),
    plusConvStoryMult: state.story.plusConvMult ?? 1,
    ticketsFee,
    plusPerkCost,
    hqCost: CONFIG.hqMonthly,
    profit,
    oneOff,
    launchCost,
    raisedTotal: state.raisedTotal,
    cash: state.cash,
    // --- база (хаб и спицы) ---
    foodUsers: state.food.users,
    taxiUsers: state.taxi.users,
    ecomUsers: state.ecom.users,
    bothUsers: state.both,
    bothEcomUsers: state.bothEcom,
    multiUsers: multi,
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
    ecomQuality: qEcom,
    logistics,
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
    // --- е-ком ---
    ecomOn,
    ecomLaunched,
    arpuEcom,
    marginEcom,
    ecomPool,
    churnEcomRate,
    lostEcom,
    ecomColdAcq,
    cacColdEcom,
    // --- самокаты: поля появляются только в году конгломерата, чтобы
    // отчёты зачётной партии не менялись задним числом ---
    ...(state.endless ? {
      scootOn,
      scootStreet,
      scootUnits: scooterFleet(state),
      scootUsers: state.scoot.users,
      bothScootUsers: state.bothScoot,
      revenueScoot,
      scootRides,
      scootFullContribution,
      scootCapex,
      scootResale,
      scootBought,
      scootSold,
      scootScrapped,
      scootResidual: scooterResidualValue(state),
      scootSeason: seasonScooters(month),
    } : {}),
    // --- подписка и партнёрства ---
    plusOn,
    plusLaunched,
    plusSubs: state.plus.subs,
    plusConv,
    plusChurned,
    plusPrice,
    cinemaOn,
    ticketsOn,
    // --- кросс-селл ---
    crossConv,
    crossEcomConv,
    crossBackConv,
    crossCac,
    crossSpent,
    crossWasted,
    trustBroken,
    trustMonthsLeft: Math.max(0, state.trustUntil - month),
    // --- сюжетные повороты ---
    fedActive,
    fedMonthsLeft: fedActive ? state.story.fedUntil - month + 1 : 0,
    crisisActive,
    crisisMonthsLeft: crisisActive ? state.story.crisisUntil - month + 1 : 0,
    crisisCut: Boolean(crisisActive && state.story.crisisCut),
    // Прибавка частоты показывается, только пока контракт действует;
    // рядом — сколько месяцев ему осталось (null у бессрочных старых сейвов)
    tripsAdd: ((state.story.tripsAdd ?? 0) > 0
      && (state.story.tripsUntil == null || month <= state.story.tripsUntil))
      ? state.story.tripsAdd : 0,
    tripsMonthsLeft: (state.story.tripsAdd ?? 0) > 0 && state.story.tripsUntil != null
      ? Math.max(0, state.story.tripsUntil - month + 1) : null,
    crossCacStoryMult: state.story.crossCacMult ?? 1,
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

    decisions: deepClone({
      ...decisions,
      verticals: [...(decisions.verticals ?? [])],
      partners: [...(decisions.partners ?? [])],
    }),
  };

  // --- 12. Завершение месяца ---
  state.month = month;
  state.history.push(report);
  state.pendingChoice = null;
  if (event) {
    state.seenEvents = state.seenEvents ?? [];
    state.seenEvents.push(event.id);
  }
  state.pendingEvent = rollEvent(rng, month + 1, state.flags, {
    taxiOn: state.taxi.on,
    atWar: state.taxi.on && state.taxi.warUntil > month + 1,
    // «Связывать» регулятору есть что, только если работает подписка или
    // общая логистика: иначе выбор в антимонопольном деле фиктивный.
    glued: state.plus.on || (state.ecom.on && hasPerk(asset, 'courier-logistics')),
    scooters: scooterFleet(state) > 0,
    seen: state.seenEvents ?? [],
    lastId: event?.id ?? null,
  });
  state.rngState = rng.state();

  if (state.cash < 0) state.over = 'bankrupt';
  else if (month >= CONFIG.monthsTotal && !state.endless) state.over = 'finished';
  else if (state.endless && month >= (state.endlessUntil ?? Infinity)) state.over = 'endless-done';

  const sop = sumOfParts(state);
  report.valuation = sop.total;
  report.equityValue = report.valuation * state.equity;
  report.sopFoodValue = sop.parts.find((p) => p.id === 'food')?.value ?? 0;
  report.sopTaxiValue = sop.parts.find((p) => p.id === 'taxi')?.value ?? 0;
  report.sopEcomValue = sop.parts.find((p) => p.id === 'ecom')?.value ?? 0;
  report.sopPlusValue = sop.parts.find((p) => p.id === 'plus')?.value ?? 0;

  // Зачётный счёт фиксируется в момент финиша: пост-эндгейм сможет
  // продолжать партию, не трогая результат для таблиц и строки.
  if (state.over === 'finished' && !state.scored) {
    state.scored = finalScore(state);
  }

  return { state, report };
}

// ----------------------------------------------------------------------------
// Пост-эндгейм: партия продолжается после финиша, счёт уже зафиксирован.
// ----------------------------------------------------------------------------
/**
 * Пост-эндгейм — «год конгломерата». Партия уже зачтена (state.scored
 * заморожен в момент финиша), поэтому счёт этим актом не переписывается:
 * играют не за оценку, а за зрелость. Правило акта — чужих денег больше нет,
 * раунды закрыты; совет ставит одну цель на двенадцать месяцев.
 */
export function enterEndless(state) {
  const next = deepClone(state);
  if (next.over !== 'finished') return next;
  next.endless = true;
  next.over = null;
  next.endlessUntil = CONFIG.monthsTotal + CONFIG.endless.months;
  next.board.goal = makeEndlessGoal(next);
  next.board.profitableMonths = 0;
  next.restrictions = null;
  // Самокаты открываются вместе с актом — автоматически, но парк пуст:
  // пока не куплен первый самокат, вертикаль не стоит ни рубля и не
  // размывает фокус. План года по умолчанию наивный — «улица весь год»;
  // догадаться про склад должен игрок.
  next.scoot = next.scoot ?? { cohorts: [], users: 0 };
  next.bothScoot = next.bothScoot ?? 0;
  next.decisions.scooterBuy = 0;
  next.decisions.scooterSell = 0;
  if (!Array.isArray(next.decisions.scooterPlan) || next.decisions.scooterPlan.length !== 12) {
    next.decisions.scooterPlan = Array(12).fill('street');
  }
  return next;
}

// Раунды в пост-эндгейме закрыты: это и есть его главное ограничение
export function fundingOpen(state) {
  return !state.endless && state.month >= CONFIG.minMonthForFunding;
}

// ----------------------------------------------------------------------------
// Оценка холдинга: sum-of-parts.
//
// Каждая часть — своим окном выручки и своим множителем: зрелый хаб как
// дойная корова, растущие вертикали как истории роста, подписка — дороже
// всех (повторяющаяся выручка). Премия — за замеряемую склейку. Третий акт
// (последний год): инвесторы требуют прибыльную экосистему, а не зоопарк —
// убыточные части дисконтируются жёстче.
// ----------------------------------------------------------------------------
export function sumOfParts(state) {
  const h = state.history;
  const parts = [];
  const thirdAct = state.month >= CONFIG.monthsTotal - CONFIG.boardYearMonths - 1;
  const zooMarginFloor = thirdAct ? -0.05 : -0.1;
  const burnMult = CONFIG.lossBurnMultiple * (thirdAct ? 1.7 : 1);

  const mkPart = (id, pickRevenue, pickFull, k) => {
    const runRate = windowAvg(h, CONFIG.valuationWindow, pickRevenue) * 12;
    const growth = windowGrowthStable(h, CONFIG.growthWindow, pickRevenue, 0.05);
    const fullAvg = windowAvg(h, CONFIG.valuationWindow, pickFull);
    const revAvg = windowAvg(h, CONFIG.valuationWindow, pickRevenue);
    const margin = revAvg > 0 ? fullAvg / revAvg : (fullAvg < 0 ? -1 : 0);
    let value;
    let zoo = false;
    if (fullAvg < 0 && growth < 0.05 && fullAvg < zooMarginFloor * Math.max(1, revAvg)) {
      zoo = true;
      value = Math.max(fullAvg * 12 * burnMult, -700_000_000);
    } else {
      const multiple = revenueMultiple(growth, margin, k);
      value = runRate * multiple;
    }
    parts.push({ id, runRate, growth, margin, value, zoo });
  };

  if (!h.length) {
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
    if (state.ecom.on || h.some((r) => r.ecomOn)) {
      mkPart('ecom', (r) => r.revenueEcom ?? 0, (r) => r.ecomFullContribution ?? 0, CONFIG.multiples.taxi);
    }
    if (state.plus.on || h.some((r) => r.plusOn)) {
      mkPart('plus', (r) => r.revenuePlus ?? 0, (r) => r.plusFullContribution ?? 0, CONFIG.plus.multiple);
    }
  }

  // Самокаты в оценке — не «история роста», а железо по остаточной
  // стоимости: инвестор платит за то, что можно продать. Операционная
  // прибыль парка уже пришла кассой; мультипликатор на неё не даётся —
  // иначе закупка парка накачивала бы рост года конгломерата.
  if (state.endless) {
    const residual = scooterResidualValue(state);
    if (residual > 0) {
      parts.push({ id: 'scoot', runRate: 0, growth: 0, margin: 0, value: residual, zoo: false });
    }
  }

  const unique = uniqueUsers(state);
  const multi = multiUsers(state);
  const multiShare = unique > 0 ? multi / unique : 0;
  const crossPremium = Math.min(CONFIG.crossPremiumCap, CONFIG.crossPremiumPerShare * multiShare);

  const posSum = parts.filter((p) => p.value > 0).reduce((s, p) => s + p.value, 0);
  const negSum = parts.filter((p) => p.value < 0).reduce((s, p) => s + p.value, 0);
  const beforeBonus = posSum * (1 + crossPremium) + negSum;
  const bonus = 1 + clamp(state.flags.valuationBonus, -0.4, 0.6);
  const total = Math.max(200_000_000, beforeBonus * bonus);
  return { parts, multiShare, crossPremium, bonus, total, thirdAct };
}

export function valuation(state) {
  return sumOfParts(state).total;
}

// Насколько лучше холдинг упакован к раунду: та же компания, но с внятной
// отчётностью, чистой юнит-экономикой и подготовленной презентацией стоит
// для инвестора дороже. На счёт это не влияет — рынок считает оценку сам;
// влияет только на цену денег, то есть на долю, которую вы отдаёте.
export function financeRoundMult(state) {
  return financeRoundGain(CONFIG.finance,
    financeLevel(state, state.decisions ?? DEFAULT_DECISIONS));
}

export function fundingOffer(state, amount) {
  const terms = roundTerms(
    valuation(state) * legacyReputationMult(state.legacy) * financeRoundMult(state),
    amount,
    { floor: legacyValuationFloor(state.legacy) },
  );
  return { ...terms, newEquity: state.equity * (1 - terms.dilution) };
}

export function raise(state, amount) {
  // В «году конгломерата» раунды закрыты: акт про то, чтобы держаться
  // без чужих денег. Отказ молчаливый — интерфейс кнопку и не показывает.
  if (state.endless) return { state, offer: null };
  const offer = fundingOffer(state, amount);
  const next = deepClone(state);
  next.cash += amount;
  next.equity = offer.newEquity;
  next.raisedTotal += amount;
  return { state: next, offer };
}

// ----------------------------------------------------------------------------
// Разбор месяца: выручка холдинга = уникальные клиенты x ARPU.
// Точно по определению — и это главный урок игры.
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
// Рост холдинга с момента заморозки зачётного счёта — мера «года
// конгломерата»: выросли ли вы, когда чужие деньги кончились.
export function endlessGrowth(state) {
  const ranked = state.scored?.equityValue ?? 0;
  if (!state.endless || ranked <= 0) return 0;
  const now = (valuation(state) + Math.max(0, state.cash)) * state.equity;
  return now / ranked - 1;
}

export function finalScore(state) {
  const v = valuation(state);
  return {
    valuation: v,
    equity: state.equity,
    equityValue: (state.over === 'bankrupt'
      ? distressedSale(v, state.cash)
      : v + Math.max(0, state.cash)) * state.equity,
    raised: state.raisedTotal,
    cash: state.cash,
    months: state.month,
    // Кончились деньги — компанию продали за долги: 28% оценки минус долг,
    // остаток по долям. «Банкротство» остаётся только когда долг съел и это.
    bankrupt: state.over === 'bankrupt' && distressedSale(v, state.cash) <= 0,
    sold: state.over === 'bankrupt' && distressedSale(v, state.cash) > 0,
  };
}

/**
 * Итог «года конгломерата». Зачётный счёт партии не переписывается —
 * он заморожен на 36-м месяце (state.scored). Здесь считается отдельный
 * итог акта: выполнена ли цель совета и во что вырос холдинг без раундов.
 */
export function endlessScore(state) {
  const now = finalScore(state);
  const ranked = state.scored ?? now;
  const goal = state.board?.goal;
  const unique = uniqueUsers(state);
  const multiShare = unique > 0 ? multiUsers(state) / unique : 0;
  const progress = goalProgress(goal, {
    taxiUsers: state.taxi.users,
    multiShare,
    profitableMonths: state.board?.profitableMonths ?? 0,
    uniqueUsers: unique,
    growth: endlessGrowth(state),
  });
  return {
    ...now,
    rankedValue: ranked.equityValue,
    // Рост за год конгломерата — то, ради чего этот акт и играют
    growth: endlessGrowth(state),
    multiShare,
    profitableMonths: state.board?.profitableMonths ?? 0,
    goalDone: Boolean(progress?.done),
    progress,
    raisedInAct: 0,
  };
}

// Персональный разбор партии: правила читают историю и называют системные
// промахи; цены — из замеров аудита 2026-08 и телеметрии самой партии.
// Возвращает список { id, ...числа для подстановки }; тексты — в strings.js.
export function debrief(state) {
  const hist = state.history ?? [];
  if (hist.length < 8) return [];
  const out = [];

  // Ни одного раунда за партию: самая частая причина провала и самая
  // непрозрачная. Стартовый актив насыщен и с середины партии не покрывает
  // собственный фикс, а второй сервис тратит задолго до того, как начнёт
  // приносить. Замер: без раундов 24 кода из 24 кончаются продажей за долги.
  if ((state.raisedTotal ?? 0) === 0 && hist.length >= 20) out.push({ id: 'noRounds' });

  // Вертикали подняты, а Плюса нет: подписка и партнёрства — клей
  // экосистемы. Цена: экосистемная опора с Плюсом 8.7 млрд, без — 6.7.
  const taxiEver = hist.some((r) => r.taxiOn);
  const plusEver = hist.some((r) => r.plusOn);
  if (taxiEver && !plusEver && hist.length >= 30) out.push({ id: 'noPlus' });

  // Обратная ошибка: управляющая компания раздута. Подсказка рычага обещает
  // выкуп штрафа, про цену денег там раньше не было ни слова, и игрок
  // естественно крутил вверх. Замер (24 кода, доставка): при двух сервисах
  // оптимум 6-8 млн, при трёх 4-6, на 14 млн итог падает с 11.1 до 8.6 млрд.
  const fatMgmt = hist.filter((r) => (r.decisions?.mgmt ?? 0) >= 12_000_000).length;
  if (fatMgmt >= 10) out.push({ id: 'fatMgmt', n: fatMgmt });

  // Расфокус: вертикали открывались быстрее, чем рос менеджмент, и штраф
  // качества держался месяцами. Цена — собственный средний штраф партии.
  const focusRows = hist.filter((r) => (r.focusPenalty ?? 0) >= 0.1);
  if (focusRows.length >= 6) {
    const avg = focusRows.reduce((a, r) => a + r.focusPenalty, 0) / focusRows.length;
    out.push({ id: 'unfocused', n: focusRows.length, pct: Math.round(avg * 100) });
  }

  // Касса жила ниже месяца расходов при убыточной операционке: любой шок
  // в такой момент — продажа за долги (28% оценки минус долг). Порог 5:
  // опоры с подушкой 200 млн задевают 1–3 таких месяца между раундами.
  const thinMonths = hist.filter((r) => r.profit < 0
    && r.cash < (r.revenue - r.profit)).length;
  if (thinMonths >= 5) out.push({ id: 'thinCash', n: thinMonths });

  // Партия кончилась продажей за долги: напомнить цену пустой кассы.
  if (state.over === 'bankrupt') out.push({ id: 'ranDry', m: state.month });

  return out.slice(0, 4);
}
