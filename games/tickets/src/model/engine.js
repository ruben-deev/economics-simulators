// ============================================================================
// Движок билетного сервиса «БИЛЕТВИЛЬ».
//
// Чистая функция: step(state, input) -> { state, report }. Ни одного обращения
// к DOM, поэтому модель можно прогнать в тестах и в оптимизаторе баланса.
//
// Порядок месяца:
//   1  ограничения акционеров и эффекты кризиса
//   2  уровни: платформа, продукт, данные, качество алгоритмов
//   3  ход конкурента
//   4  организаторы: приток, отток, переток
//   5  афиша: события и места по типам
//   6  охват зрителей
//   7  спрос по сегментам и его разнос по типам событий
//   8  продажи по каналам и заполняемость
//   9  выручка, расходы, прибыль
//   10 доверие
//   11 метрики, совет, кризисы, отчёт
//
// Ключевая мысль модели: организаторы приходят за зрителями, зрители приходят
// за афишей. Ни одна сторона не приходит первой сама по себе.
// ============================================================================

import {
  CONFIG, ORGANIZERS, AUDIENCES, ALGORITHMS, LEVERS, DEFAULT_DECISIONS,
  clamp, organizerById, audienceById, algorithmByKey,
} from './config.js';
import { createRng } from '../../../../shared/rng.js';
import { deepClone } from '../../../../shared/clone.js';
import { platformUpkeep, infraCost } from '../../../../shared/upkeep.js';
import { windowAvg, windowGrowthStable, revenueMultiple, roundTerms, distressedSale } from '../../../../shared/valuation.js';
import {
  seasonOf, eventSeason, demandSeason, rollHit, hitById,
} from './market.js';
import {
  serviceQuality, platformFit, organizerAppeal, preferenceAgainst,
  organizerChurn, listing, breadth,
} from './supply.js';
import {
  reachGain, segmentInterest, feeFactor, conversion, segmentDemand, soldTickets,
  buyerPreference,
} from './demand.js';
import {
  platformLevelOf, channelSplit, platformCost, subscriptionDrag, subscriptionValue,
  widgetAdoption, rivalHoldOf,
} from './channel.js';
import {
  createRival, stepRival, rivalOrgTotal, rivalAppealFor, rivalPlatformLevel,
  switchFlow, STANCES,
} from './rival.js';
import { makeGoal, goalProgress, applyGoalOutcome } from './board.js';
import {
  crisisById, crisisEffects, resolutionCost, rollCrisis, CRISIS_COOLDOWN,
} from './crises.js';
import { neutralModifiers, applyEvent, rollEvent, eventById } from './events.js';
import { difficultyById } from '../../../../shared/difficulty.js';
import {
  financeHalfCost, financeStrength, financeMiscRate, financeSpend, financeRoundGain,
} from '../../../../shared/finance.js';

export { clamp, organizerById, audienceById };

// ----------------------------------------------------------------------------
// Начальное состояние
// ----------------------------------------------------------------------------
/**
 * Финансовая команда: сила и цена. Цена — доля месячной выручки: служба
 * растёт вместе с компанией (см. shared/finance.js).
 */
function financeRevenue(state) {
  const h = state.history ?? [];
  return h.length ? h[h.length - 1].revenue : 0;
}

export function financeHalf(state) {
  return financeHalfCost(CONFIG.finance, state.difficulty, financeRevenue(state));
}

export function financeLevel(state, decisions) {
  return financeStrength(CONFIG.finance, state.difficulty,
    financeRevenue(state), decisions?.finance ?? 0);
}

export function miscRate(state, decisions) {
  return financeMiscRate(CONFIG.finance, state.difficulty, financeLevel(state, decisions));
}

// Ставка эквайринга: сильная служба выторговывает её у банка. С оборота
// она снимается целиком, поэтому десятые доли процента здесь — деньги.
export function acquiringRate(state, decisions) {
  return Math.max(0.008,
    CONFIG.acquiringRate - CONFIG.finance.acquiringCut * financeLevel(state, decisions));
}

export function financeCost(state, decisions) {
  return financeSpend(state.difficulty, decisions?.finance ?? 0);
}

export function createInitialState(seed = 'biletville', difficulty = 'normal') {
  const rng = createRng(seed);
  const state = {
    seed,
    // Уровень сложности — общая настройка набора (shared/difficulty.js)
    difficulty: difficultyById(difficulty).id,
    month: 0,
    cash: CONFIG.startCash,
    equity: 1,
    raisedTotal: 0,

    // Ваши организаторы по типам. Начинаете маленьким оператором:
    // несколько театров, десяток клубов и один-два всего остального.
    orgs: { theatre: 16, concert: 3, club: 45, sport: 2 },
    // Кому уже поставлен билетный виджет. В начале — никому: платформы ещё нет.
    prevPlatformFor: Object.fromEntries(ORGANIZERS.map((o) => [o.id, false])),
    // Что приезжает в город в следующем месяце. В первый месяц — ничего:
    // афиши ещё нет, и приезжать не к кому.
    pendingHit: null,

    // Выданные организаторам авансы под будущие продажи. Это не расход,
    // а актив: деньги ушли из кассы, но должны вернуться из их выручки.
    advances: [],

    // Какая доля организаторов каждого типа уже переехала на ваш виджет.
    // Не да/нет: тип из сорока пяти клубов переезжает месяцами и по частям.
    platformShare: Object.fromEntries(ORGANIZERS.map((o) => [o.id, 0])),

    // Охват по сегментам зрителей — доля потенциала, который вас помнит
    audiences: {
      regulars: { reach: 0.055 },
      music: { reach: 0.040 },
      fans: { reach: 0.030 },
      casual: { reach: 0.020 },
    },

    trust: 0.72,

    platformStock: 40_000_000,
    productStock: 60_000_000,
    dataStock: 0,
    rndStock: 0,
    installed: Object.fromEntries(ALGORITHMS.map((a) => [a.key, false])),

    decisions: deepClone(DEFAULT_DECISIONS),

    rivalState: createRival(),
    exclusives: {},        // ваши эксклюзивы: тип -> сколько месяцев осталось
    exclusiveOffer: null,  // предложение на этот месяц

    board: { goal: null, history: [], profitableMonths: 0 },
    restrictions: null,
    crisis: null,
    lastCrisisResolved: -99,

    pendingEvent: null,
    pendingChoice: null,

    lastFill: CONFIG.refFill,
    lastFillByType: Object.fromEntries(ORGANIZERS.map((o) => [o.id, CONFIG.refFill])),

    history: [],
    over: null,
    flags: { valuationBonus: 0 },
    rngState: seed,
    tick: 0,
  };
  state.board.goal = makeGoal(1, state, orgTotal(state), rivalOrgTotal(state.rivalState));
  // Первое событие бросается сразу, чтобы первый ход не был пустым
  state.pendingEvent = null;
  void rng;
  return state;
}

export function orgTotal(state) {
  return ORGANIZERS.reduce((s, def) => s + (state.orgs[def.id] ?? 0), 0);
}

export function weightedOrgs(state) {
  return ORGANIZERS.reduce((s, def) => s + (state.orgs[def.id] ?? 0) * def.serviceWeight, 0);
}

export function totalReach(state) {
  return AUDIENCES.reduce((s, aud) => s + aud.potential * (state.audiences[aud.id]?.reach ?? 0), 0);
}

// ----------------------------------------------------------------------------
// Уровни, копящиеся вложениями
// ----------------------------------------------------------------------------
export function platformLevel(state) {
  return platformLevelOf(state.platformStock);
}
export function productLevel(state) {
  return clamp(state.productStock / (state.productStock + CONFIG.productSaturation), 0, 0.95);
}
export function dataLevel(state) {
  return clamp(state.dataStock / (state.dataStock + CONFIG.dataSaturation), 0, 1);
}
export function rndLevel(state) {
  return clamp(state.rndStock / (state.rndStock + CONFIG.rndSaturation), 0, 1);
}
/**
 * Качество алгоритмов. Данные без команды бесполезны, команда без данных —
 * тоже: качество растёт только когда есть и то, и другое.
 */
export function algoQuality(state) {
  return clamp(Math.sqrt(dataLevel(state) * rndLevel(state)), 0, 1);
}

// ----------------------------------------------------------------------------
// Ход
// ----------------------------------------------------------------------------
export function step(prevState, input = {}) {
  const state = deepClone(prevState);
  const month = prevState.month + 1;
  const rng = createRng(`${prevState.seed}:${month}`);
  const decisions = { ...deepClone(prevState.decisions), ...deepClone(input.decisions ?? {}) };

  const snapshot = deepClone({
    orgs: prevState.orgs, audiences: prevState.audiences, trust: prevState.trust,
  });

  // --- 1. Ограничения акционеров ---
  const restrictions = prevState.restrictions && month < prevState.restrictions.until
    ? prevState.restrictions : null;
  if (!restrictions) state.restrictions = null;
  let marketingCapped = null;
  if (restrictions?.marketingCap && decisions.marketing > restrictions.marketingCap) {
    marketingCapped = restrictions.marketingCap;
    decisions.marketing = restrictions.marketingCap;
  }

  // --- 1a. Событие месяца ---
  const event = prevState.pendingEvent;
  const choice = input.eventChoice ?? prevState.pendingChoice ?? 0;
  let mods = neutralModifiers();
  if (event) mods = applyEvent(mods, event, choice);

  // --- 1b. Кризис ---
  let crisisResolved = null;
  let crisisCost = 0;
  if (state.crisis && input.crisisChoice) {
    const def = crisisById(state.crisis.id);
    const res = def?.resolutions.find((r) => r.id === input.crisisChoice);
    if (res) {
      crisisCost = resolutionCost(state.crisis, input.crisisChoice);
      if (res.resolves) {
        crisisResolved = { id: state.crisis.id, resolution: res.id };
        state.crisis = null;
        state.lastCrisisResolved = month;
      }
    }
  }
  const crisisMods = crisisEffects(state.crisis);

  // Потолок сбора от регулятора — жёсткий, его не обойти рычагом
  if (crisisMods.feeCap != null && decisions.buyerFee > crisisMods.feeCap) {
    decisions.buyerFee = crisisMods.feeCap;
  }

  // --- 2. Уровни и алгоритмы ---
  state.platformStock += decisions.platformDev;
  state.productStock += decisions.product;
  state.rndStock += decisions.rnd;

  const pLevel = platformLevel(state);
  const prodLevel = productLevel(state);
  const quality = clamp(algoQuality(state) - (crisisMods.dataPenalty ?? 0) * 0.1, 0, 1);

  const installedNow = [];
  let installCost = 0;
  for (const key of input.install ?? []) {
    const algo = algorithmByKey(key);
    if (!algo || state.installed[key] || quality < algo.unlock) continue;
    state.installed[key] = true;
    installCost += algo.install;
    installedNow.push(key);
  }
  const algoOn = (key) => Boolean(decisions.algoOn?.[key] && state.installed[key]);
  const algoParam = (key) => decisions.algoParam?.[key] ?? 0;

  const feedOn = algoOn('personalFeed');
  const feedPower = feedOn ? algoParam('personalFeed') : 0;
  const dynamicOn = algoOn('dynamicFee');
  const dynamicSpread = dynamicOn ? algoParam('dynamicFee') : 0;
  const antiBotOn = algoOn('antiBot');
  const antiBotStrict = antiBotOn ? algoParam('antiBot') : 0;
  const dripOn = algoOn('dripPricing');
  const dripPower = dripOn ? algoParam('dripPricing') : 0;

  // --- 3. Ход конкурента ---
  const riv = state.rivalState;
  const rivalOrgsBefore = rivalOrgTotal(riv);
  const rivalStep = stepRival(riv, {
    yourOrgs: orgTotal(prevState),
    theirOrgs: rivalOrgsBefore,
    yourReach: totalReach(prevState),
  }, rng);
  const rivalStance = riv.stance;

  // --- 4. Организаторы ---
  // Решение о виджете принимается по типам. Снятие уже
  // подключённых организаторов — отдельная боль: они это запомнят.
  const connectedFor = { ...(decisions.platformFor ?? {}) };
  let disconnectAnger = 0;
  for (const def of ORGANIZERS) {
    if (prevState.prevPlatformFor?.[def.id] && !connectedFor[def.id]) {
      // Злость пропорциональна тому, скольких вы успели переселить: снять
      // виджет у типа, где он стоял у двух организаторов из тридцати, —
      // не то же самое, что выключить его у всех.
      disconnectAnger += 0.09 * def.platformNeed * (prevState.platformShare?.[def.id] ?? 0);
    }
  }
  state.prevPlatformFor = { ...connectedFor };

  // --- Переезд на виджет: не галочка, а проект ---
  // У каждого организатора уже что-то стоит — своё или конкурента. Поэтому
  // «поставить виджет типу» это не переключатель, а доля переехавших, которая
  // растёт ровно настолько, насколько оплачен переезд. Отключение мгновенно:
  // выключить чужой сайт можно сразу, а вот включить — нет.
  const wanted = ORGANIZERS.filter((d) => connectedFor[d.id]);
  const wantedOrgs = wanted.reduce((sum, d) => sum + (prevState.orgs[d.id] ?? 0), 0);
  const onboarding = Math.max(0, decisions.onboarding ?? 0);
  const spendPerOrg = wantedOrgs > 0 ? onboarding / wantedOrgs : 0;
  const rivalPLevel = rivalPlatformLevel(riv);
  state.platformShare = { ...(prevState.platformShare ?? {}) };
  const adoptionByType = {};
  for (const def of ORGANIZERS) {
    const was = clamp(state.platformShare[def.id] ?? 0, 0, 1);
    if (!connectedFor[def.id]) { state.platformShare[def.id] = 0; adoptionByType[def.id] = 0; continue; }
    const hold = rivalHoldOf(def, rivalPLevel, riv.orgs[def.id] ?? 0, prevState.orgs[def.id] ?? 0);
    const gain = widgetAdoption(def, was, spendPerOrg, pLevel, hold, decisions.platformRate);
    adoptionByType[def.id] = gain;
    state.platformShare[def.id] = clamp(was + gain, 0, 1);
  }
  // Бюджет тратится целиком, как и любой другой: интеграторы и менеджеры по
  // подключению получают зарплату независимо от того, остался ли кто-то
  // непереехавший. Поэтому держать его на максимуме, когда тип уже весь
  // ваш, — это просто выбрасывать деньги.
  const migratedNow = ORGANIZERS.reduce(
    (sum, d) => sum + adoptionByType[d.id] * (prevState.orgs[d.id] ?? 0), 0);
  const onboardingSpend = onboarding;

  const service = serviceQuality(decisions.managers, weightedOrgs(prevState));
  const reachBefore = totalReach(prevState);

  const perOrg = [];
  let joined = 0;
  let left = 0;
  let switchedIn = 0;
  let switchedOut = 0;

  for (const def of ORGANIZERS) {
    const mine = prevState.orgs[def.id] ?? 0;
    const theirs = riv.orgs[def.id] ?? 0;
    const widgetShare = clamp(state.platformShare[def.id] ?? 0, 0, 1);
    const connected = widgetShare > 0.02;
    const fillSeen = prevState.lastFillByType?.[def.id] ?? CONFIG.refFill;

    // Организатор считает, сколько у него забирают со всего оборота, а не
    // только с той части, что идёт через афишу. Получив виджет, он платит
    // комиссию с одних билетов и ставку платформы с других — и в переговорах
    // называет одно число. Без этого ставку платформы можно было поднять до
    // потолка, и ни один организатор бы не заметил.
    const splitNow = channelSplit(def, widgetShare, pLevel, decisions.platformRate);
    const feltTake = splitNow.market + splitNow.platform > 0
      ? (decisions.orgCommission * splitNow.market + decisions.platformRate * splitNow.platform)
        / (splitNow.market + splitNow.platform)
      : decisions.orgCommission;

    // Абонплата вычитает и одновременно даёт: организатор покупает не пропуск
    // к виджету, а тариф — приоритет в афише, аналитику, своего менеджера.
    // Чистым вычетом она была мёртвым рычагом: правильный ответ всегда
    // сводился к «не брать ничего».
    const tariff = connected ? decisions.platformFee : 0;

    const appeal = organizerAppeal(def, {
      orgCommission: feltTake,
      buyerFee: decisions.buyerFee,
      reach: reachBefore,
      platformLevel: pLevel,
      connected,
      service,
      fill: fillSeen,
      trust: prevState.trust,
    }) * subscriptionDrag(def, tariff) * subscriptionValue(def, tariff, pLevel);

    const rivalAppeal = rivalAppealFor(def, riv);
    const preference = preferenceAgainst(appeal, rivalAppeal);

    // Эксклюзив закрывает тип целиком на срок контракта
    const theirExclusive = (riv.exclusives?.[def.id] ?? 0) > 0;
    const myExclusive = (prevState.exclusives?.[def.id] ?? 0) > 0;

    // Приток свободных: тех, кто ещё ни с кем. Пул один на двоих, поэтому
    // делится он по той же привлекательности — иначе вы съедали бы рынок,
    // пока конкурент стоит на месте.
    const free = Math.max(0, def.pool - mine - theirs);
    const joinRate = CONFIG.baseJoinRate * mods.orgJoinMult
      * (theirExclusive ? 0.25 : 1) * (myExclusive ? 1.4 : 1);
    const contested = free * joinRate;
    // Доля рынка делится предпочтением, а абсолютная привлекательность решает,
    // пойдёт ли организатор вообще к кому-нибудь из вас.
    const gained = contested * preference * clamp(appeal, 0.05, 1.5);
    const rivalGained = riv.alive
      ? contested * (1 - preference) * clamp(rivalAppeal, 0.05, 1.5) : 0;

    // Отток
    const churn = organizerChurn(def, appeal)
      + (mods.orgAngerAdd ?? 0) + (crisisMods.orgAngerAdd ?? 0) + disconnectAnger * 0.2;
    const leaving = mine * clamp(churn, 0.003, 0.5);

    // Переток с конкурентом
    const survivors = Math.max(0, mine - leaving);
    let flow = switchFlow(def, preference, survivors, theirs);
    if (theirExclusive) flow = Math.min(flow, 0);
    if (myExclusive) flow = Math.max(flow, 0);
    flow = clamp(flow, -survivors * 0.4, theirs * 0.4);
    if (flow >= 0) switchedIn += flow; else switchedOut += -flow;

    const next = Math.max(0, survivors + flow + gained);
    state.orgs[def.id] = next;
    // Конкурент тоже теряет часть клиентов сам по себе — иначе он бессмертен
    const rivalChurn = theirs * CONFIG.baseOrgChurn * def.loyalty * 0.8;
    riv.orgs[def.id] = Math.max(0, theirs - flow - rivalChurn + rivalGained);

    joined += gained;
    left += leaving;

    perOrg.push({
      def, count: next, connected, widgetShare, appeal, rivalAppeal, preference,
      gained, leaving, flow, fillSeen,
    });
  }

  // --- 5. Афиша ---
  // Важно, какая именно афиша: зритель видит только те места, которые продаются
  // через вас. Всё, что организатор продаёт виджетом, в вашей афише не
  // появляется — и работать на ваш охват не может. Именно поэтому раздача
  // виджетов всем подряд подрезает ту самую аудиторию, ради которой
  // организаторы к вам и приходят.
  let totalSeats = 0;
  let marketSeatsTotal = 0;
  let totalEvents = 0;
  const seatsByType = {};
  const marketSeatsByType = {};
  for (const p of perOrg) {
    const l = listing(p.def, p.count, month);
    p.events = l.events;
    p.seats = l.seats;
    p.season = l.season;
    p.split = channelSplit(p.def, p.widgetShare, pLevel, decisions.platformRate);
    p.marketSeats = l.seats * p.split.market;
    seatsByType[p.def.id] = l.seats;
    marketSeatsByType[p.def.id] = p.marketSeats;
    totalSeats += l.seats;
    marketSeatsTotal += p.marketSeats;
    totalEvents += l.events;
  }
  // Доли считаются по витрине, а не по всему обороту
  const seatShare = {};
  for (const p of perOrg) {
    seatShare[p.def.id] = marketSeatsTotal > 0 ? p.marketSeats / marketSeatsTotal : 0;
  }
  const listingBreadth = breadth(marketSeatsByType);

  // --- 5a. Хит месяца ---
  // Хит объявляется за месяц. Раньше он выпадал в тот же ход, и запас
  // мощности приходилось покупать вслепую: сайт лёг, деньги потеряны, а
  // решение принять было негде. Теперь тур виден заранее — и становится
  // решением, а не случайностью. Заодно это единственная новость, которую
  // в игре про билеты человек ждёт: что приезжает в город.
  const orgCounts = Object.fromEntries(perOrg.map((p) => [p.def.id, p.count]));
  const hit = prevState.pendingHit ?? null;
  const hitDef = hit ? hitById(hit.id) : null;
  state.pendingHit = rollHit(rng, month + 1, orgCounts);

  // --- 6. Охват зрителей ---
  // Маркетинг растит охват, но приводить людей некуда, если афиша пуста:
  // сила афиши считается для каждого сегмента отдельно.
  const marketing = decisions.marketing;
  const perAud = [];
  let reachAfter = 0;
  for (const aud of AUDIENCES) {
    const seg = state.audiences[aud.id];
    const interest = segmentInterest(aud, seatShare);
    // Пустая витрина обесценивает маркетинг: приводить людей некуда.
    // Масштаб витрины важен не меньше её разнообразия.
    const scale = clamp(marketSeatsTotal / 900_000, 0.15, 1.25);
    const listingPower = clamp(interest * (0.55 + 0.45 * listingBreadth) * scale, 0, 2);
    const spendPerViewer = marketing / Math.max(1, aud.potential);
    const gain = reachGain(spendPerViewer, listingPower);
    seg.reach = clamp(
      seg.reach + (1 - seg.reach) * gain
      - seg.reach * CONFIG.awarenessDecay
      + (mods.awarenessAdd ?? 0),
      0.002, 0.85,
    );
    reachAfter += aud.potential * seg.reach;
    perAud.push({ aud, seg, interest });
  }

  // --- 7. Спрос ---
  const visibleFee = decisions.buyerFee * (1 - dripPower * 0.55);
  const discoveryBoost = feedPower * 0.42 * (0.3 + 0.7 * quality);
  const season = demandSeason(month);
  const hitPull = hit ? 1 + (hitDef.pull - 1) * hit.size * 0.55 : 1;

  // Жёсткие проверки отсекают и живых людей — тем чаще, чем хуже модель
  const falsePositives = antiBotOn ? 0.16 * antiBotStrict * (1 - quality) : 0;

  // Сторона зрителя тоже конкурентная: события есть у обоих операторов,
  // и покупатель сравнивает итоговую цену. Именно это и делает сервисный
  // сбор решением, а не бесплатной прибавкой к выручке.
  const mySide = { visibleFee, trust: prevState.trust, productLevel: prodLevel };
  const rivalSide = riv.alive
    ? { visibleFee: riv.buyerFee, trust: 0.70, productLevel: 0.50 + 0.25 * rivalPlatformLevel(riv) }
    : null;

  let demandTotal = 0;
  let buyerPrefSum = 0;
  for (const p of perAud) {
    const conv = conversion(p.aud, {
      visibleFee,
      productLevel: prodLevel,
      trust: prevState.trust,
      discoveryBoost,
    }) * (mods.conversionMult ?? 1) * (crisisMods.conversionMult ?? 1) * (1 - falsePositives);
    p.conv = clamp(conv, 0.005, 0.95);
    p.buyerPref = buyerPreference(p.aud, mySide, rivalSide);
    p.demand = segmentDemand(p.aud, {
      reach: p.seg.reach,
      interest: p.interest,
      conv: p.conv,
      season,
      hitPull,
    }) * p.buyerPref * (mods.demandMult ?? 1) * (crisisMods.demandMult ?? 1);
    demandTotal += p.demand;
    buyerPrefSum += p.buyerPref * p.aud.potential;
  }
  const avgBuyerPref = buyerPrefSum / AUDIENCES.reduce((s, a) => s + a.potential, 0);

  // Разнос спроса по типам событий: зритель идёт не «в сервис», а на событие
  const demandByType = Object.fromEntries(ORGANIZERS.map((o) => [o.id, 0]));
  for (const p of perAud) {
    let weightSum = 0;
    const weights = {};
    for (const def of ORGANIZERS) {
      const w = (p.aud.affinity[def.id] ?? 0) * (seatShare[def.id] ?? 0);
      weights[def.id] = w;
      weightSum += w;
    }
    if (weightSum <= 0) continue;
    for (const def of ORGANIZERS) {
      demandByType[def.id] += p.demand * (weights[def.id] / weightSum);
    }
  }

  // Персонализация при слабых данных схлопывает ленту в хиты: крупные события
  // продаются лучше, длинный хвост перестаёт продаваться вовсе.
  const concentration = feedPower * (1 - quality);
  if (concentration > 0.001) {
    const bigTypes = new Set(['concert', 'sport']);
    let moved = 0;
    for (const def of ORGANIZERS) {
      if (bigTypes.has(def.id)) continue;
      const cut = demandByType[def.id] * 0.35 * concentration;
      demandByType[def.id] -= cut;
      moved += cut;
    }
    const bigSeats = ORGANIZERS.filter((d) => bigTypes.has(d.id))
      .reduce((s, d) => s + (seatsByType[d.id] ?? 0), 0);
    for (const def of ORGANIZERS) {
      if (!bigTypes.has(def.id)) continue;
      const share = bigSeats > 0 ? (seatsByType[def.id] ?? 0) / bigSeats : 0;
      demandByType[def.id] += moved * share;
    }
  }

  // --- 8. Продажи по каналам ---
  // Хит будит перекупщиков: они покупают быстрее людей, оборот растёт,
  // доверие падает. Антибот отбирает у них скорость.
  const botPressure = hit ? hitDef.botPressure * hit.size : 0.35;
  const antiBotPower = antiBotOn
    ? clamp((0.3 + 0.7 * antiBotStrict) * (0.35 + 0.65 * quality), 0, 1) : 0;
  const botShare = clamp(0.085 * botPressure * (1 - antiBotPower), 0, 0.4);

  // Мощность: если запаса нет, старт продаж хита частично теряется
  const loadSpike = hit ? hitDef.loadSpike * hit.size : 1;
  const headroom = decisions.capacityTech / Math.max(1, 3_500_000 * loadSpike * Math.sqrt(Math.max(1, totalSeats / 100_000)));
  const outageLoss = clamp(0.16 * (loadSpike - 1) * (1 - clamp(headroom, 0, 1)), 0, 0.3);

  let marketSold = 0;
  let platformSold = 0;
  let ownSold = 0;
  let gmvMarket = 0;
  let gmvPlatform = 0;
  let connectedCount = 0;
  let ticketsTotal = 0;

  for (const p of perOrg) {
    const split = p.split;
    connectedCount += p.count * p.widgetShare;

    const addressable = p.marketSeats;
    const demand = demandByType[p.def.id] ?? 0;
    const soldHere = soldTickets(demand, addressable) * (1 - outageLoss);
    // Часть купленного забирают перекупщики: оборот тот же, доверие нет
    p.marketSold = soldHere;
    p.botSold = soldHere * botShare;

    // Свой канал организатора продаётся его собственной публикой
    const ownRate = 0.55 + 0.12 * pLevel;
    p.platformSold = p.seats * split.platform * ownRate;
    p.ownSold = p.seats * split.lost * 0.55;

    p.sold = p.marketSold + p.platformSold + p.ownSold;
    p.fill = p.seats > 0 ? clamp(p.sold / p.seats, 0, 1) : CONFIG.refFill;

    marketSold += p.marketSold;
    platformSold += p.platformSold;
    ownSold += p.ownSold;
    gmvMarket += p.marketSold * p.def.avgPrice;
    gmvPlatform += p.platformSold * p.def.avgPrice;
    ticketsTotal += p.marketSold + p.platformSold;
  }

  const gmv = (gmvMarket + gmvPlatform) * (crisisMods.gmvMult ?? 1);
  const fill = totalSeats > 0
    ? clamp((marketSold + platformSold + ownSold) / totalSeats, 0, 1) : CONFIG.refFill;

  state.lastFill = fill;
  state.lastFillByType = Object.fromEntries(perOrg.map((p) => [p.def.id, p.fill]));
  state.dataStock += ticketsTotal;

  // --- 9. Выручка и расходы ---
  // Динамический сбор поднимает выручку с того же оборота: там, где разберут,
  // берём больше. Но покупатель это замечает.
  const dynamicUplift = 1 + 0.14 * dynamicSpread * (0.35 + 0.65 * quality);
  const marketTake = decisions.buyerFee + decisions.orgCommission;
  const marketplaceRevenue = gmvMarket * marketTake * dynamicUplift * (crisisMods.gmvMult ?? 1);
  const platformRevenue = gmvPlatform * decisions.platformRate * (crisisMods.gmvMult ?? 1);
  const subscriptionRevenue = connectedCount * decisions.platformFee;
  const revenue = marketplaceRevenue + platformRevenue + subscriptionRevenue;

  const acqRate = acquiringRate(state, decisions);
  const acquiring = gmv * acqRate;
  const supportLoad = ticketsTotal * CONFIG.supportPerTicket
    * clamp(CONFIG.refSupport / Math.max(1, decisions.support), 0.35, 2.4);
  const variableCost = acquiring + supportLoad;
  const contribution = revenue - variableCost;

  const managerCost = decisions.managers * CONFIG.managerCost;
  const platformSeats = platformCost(connectedCount, decisions.platformFee);
  // Построенное надо содержать, а серверы растут вместе с билетами: обе
  // статьи дорожают ровно тогда, когда дела идут хорошо.
  const techUpkeep = platformUpkeep(
    state.platformStock + state.productStock + state.rndStock, CONFIG.techUpkeepRate);
  const serverCost = infraCost(ticketsTotal, CONFIG.serverPerTicket, prodLevel, CONFIG.serverTechRelief);
  // Штат растёт вместе с числом организаторов: интеграции, финансы, юристы,
  // вторая линия поддержки. Аккаунт-менеджеры — отдельный ползунок и другая
  // работа; этот штат в ноль не уведёшь — фикс-кост масштаба.
  const staffCost = orgTotal(state) * CONFIG.staffPerOrg;
  // Прочие расходы: комиссии, списания, штрафы, неразнесённая
  // административка. Растёт сама вместе с выручкой; режет её не
  // бизнес-решение, а финансовая служба.
  const financeBudget = financeCost(state, decisions);
  const rateMisc = miscRate(state, decisions);
  const miscCost = revenue * rateMisc;
  const fixed = CONFIG.hqMonthly + staffCost + decisions.marketing + managerCost
    + decisions.platformDev + decisions.product + decisions.support
    + decisions.capacityTech + decisions.rnd + platformSeats
    + onboardingSpend + techUpkeep + serverCost + financeBudget + miscCost;

  const refundHit = crisisMods.refundHit ?? 0;
  const oneOff = installCost + crisisCost + refundHit
    + (mods.oneOffCost ?? 0) + gmv * (mods.gmvShareCost ?? 0) - (mods.oneOffGain ?? 0);
  const profit = contribution - fixed;

  state.cash += profit - oneOff;

  // --- 10. Доверие ---
  // Копится медленно, рушится быстро. Бьют по нему все сразу: перекупщики,
  // скрытый сбор, динамический сбор, упавший сайт и плохая поддержка.
  const supportQuality = clamp(decisions.support / (decisions.support + CONFIG.refSupport), 0, 1);
  const trustDamage = botShare * 0.28
    + dripPower * 0.030
    + dynamicSpread * 0.016 * (1 - quality * 0.5)
    + outageLoss * 0.35
    + (crisisMods.trustHit ?? 0)
    + Math.max(0, 0.5 - supportQuality) * 0.05;
  const trustRepair = CONFIG.trustRecovery * (0.4 + 0.6 * supportQuality);
  state.trust = clamp(
    prevState.trust + (1 - prevState.trust) * trustRepair - trustDamage + (mods.trustAdd ?? 0),
    CONFIG.trustFloor, 1,
  );

  // --- 11. Метрики ---
  const orgsNow = orgTotal(state);
  const rivalOrgsNow = rivalOrgTotal(riv);
  const takeRate = gmv > 0 ? revenue / gmv : 0;
  const revenuePerTicket = ticketsTotal > 0 ? revenue / ticketsTotal : 0;
  const orgShare = orgsNow + rivalOrgsNow > 0 ? orgsNow / (orgsNow + rivalOrgsNow) : 0;
  const marketplaceShareOfGmv = gmv > 0 ? gmvMarket / gmv : 0;

  const wAvg = (key) => {
    if (!perOrg.length || orgsNow <= 0) return 0;
    return perOrg.reduce((s, p) => s + p[key] * p.count, 0) / orgsNow;
  };
  const wAudience = (key) => {
    const total = perAud.reduce((s, p) => s + p.demand, 0);
    if (total <= 0) return 0;
    return perAud.reduce((s, p) => s + p[key] * p.demand, 0) / total;
  };

  // --- 12. Совет акционеров ---
  if (profit > 0) state.board.profitableMonths += 1;
  const boardCtx = {
    gmv, profitableMonths: state.board.profitableMonths,
    orgs: orgsNow, rivalOrgs: rivalOrgsNow,
  };
  const progress = goalProgress(state.board.goal, boardCtx);
  let goalOutcome = null;
  if (state.board.goal && month % CONFIG.boardYearMonths === 0) {
    goalOutcome = applyGoalOutcome(state, state.board.goal, progress, month);
    state.board.history.push(goalOutcome);
    state.board.profitableMonths = 0;
    const nextYear = state.board.goal.year + 1;
    state.board.goal = month < CONFIG.monthsTotal
      ? makeGoal(nextYear, state, orgsNow, rivalOrgsNow) : null;
  }

  let forcedDilution = 0;
  let boardInjection = 0;
  if (state.pendingDilution) {
    forcedDilution = state.pendingDilution;
    boardInjection = 500_000_000;
    state.equity *= (1 - forcedDilution);
    state.cash += boardInjection;
    state.raisedTotal += boardInjection;
    state.pendingDilution = 0;
  }

  // --- 13. Эксклюзивы ---
  // --- Возврат авансов ---
  // Каждый месяц удерживаем часть оборота того типа, кому дали денег. Пока
  // долг не закрыт, эти деньги — не выручка, а возврат тела: в отчёте о
  // прибыли их нет, в кассе они есть. Разницу между этими двумя вещами
  // и надо увидеть.
  let advanceRecouped = 0;
  let advanceWrittenOff = 0;
  // Оборот по типам считаем по доле выставленных мест: отдельного счётчика
  // на тип нет, а места — ровно то, чем тип участвует в обороте.
  const seatsTotal = Object.values(seatsByType).reduce((sum, v) => sum + v, 0) || 1;
  const gmvByOrg = Object.fromEntries(
    Object.entries(seatsByType).map(([id, seats]) => [id, gmv * (seats / seatsTotal)]));
  for (const adv of state.advances) {
    const flow = (gmvByOrg[adv.org] ?? 0) * CONFIG.advanceRecoupRate;
    const take = Math.min(adv.outstanding, flow);
    adv.outstanding -= take;
    advanceRecouped += take;
    adv.monthsLeft -= 1;
  }
  state.cash += advanceRecouped;
  // Срок вышел — что не вернулось, то потеряно. Организатор не обязан
  // доплачивать из своего кармана: он продал столько, сколько продал.
  for (const adv of state.advances) {
    if (adv.monthsLeft <= 0 && adv.outstanding > 0) advanceWrittenOff += adv.outstanding;
  }
  state.advances = state.advances.filter((adv) => adv.monthsLeft > 0 && adv.outstanding > 1);
  const advanceOutstanding = state.advances.reduce((sum, adv) => sum + adv.outstanding, 0);

  for (const key of Object.keys(state.exclusives)) {
    state.exclusives[key] -= 1;
    if (state.exclusives[key] <= 0) delete state.exclusives[key];
  }
  let exclusiveSigned = null;
  if (input.exclusiveAnswer === 'accept' && prevState.exclusiveOffer) {
    const offer = prevState.exclusiveOffer;
    state.exclusives[offer.org] = CONFIG.exclusiveHoldMonths;
    state.cash -= offer.advance;
    // Это не плата за права, а деньги в долг под будущие продажи: организатор
    // берёт их сейчас на постановку и тур, а возвращает из выручки своих же
    // билетов. Отсюда и риск, которого нет у обычной комиссии: если зал не
    // соберётся, возвращать будет не из чего, и остаток придётся списать.
    state.advances.push({
      org: offer.org, amount: offer.advance, outstanding: offer.advance,
      monthsLeft: CONFIG.exclusiveHoldMonths, signed: month,
    });
    exclusiveSigned = offer;
  }
  state.exclusiveOffer = null;
  if (rng() < CONFIG.exclusiveOfferChance && month >= 5) {
    const candidates = ORGANIZERS.filter((d) => (state.orgs[d.id] ?? 0) >= 2);
    if (candidates.length) {
      const pick = candidates[Math.floor(rng() * candidates.length)];
      state.exclusiveOffer = {
        org: pick.id,
        advance: Math.round(120_000_000 + rng() * 380_000_000),
        months: CONFIG.exclusiveHoldMonths,
      };
    }
  }

  // --- 14. Кризисы и события следующего месяца ---
  if (state.crisis) state.crisis.months += 1;
  const newCrisis = rollCrisis(rng, month, {
    gmv, active: Boolean(state.crisis), lastResolved: state.lastCrisisResolved ?? -99,
  });
  if (newCrisis) state.crisis = newCrisis;

  // Показанные события копятся ради мягкой гарантии скрепочного носителя
  if (event) {
    state.seenEvents = state.seenEvents ?? [];
    state.seenEvents.push(event.id);
  }
  state.pendingEvent = rollEvent(rng, month + 1, state.seenEvents ?? []);
  state.pendingChoice = null;

  // --- 15. Итог ---
  state.month = month;
  state.decisions = decisions;
  if (state.cash < 0) state.over = 'bankrupt';
  else if (month >= CONFIG.monthsTotal) state.over = 'finished';

  const report = {
    month,
    season: seasonOf(month),

    // --- Организаторы ---
    orgs: orgsNow,
    orgsByType: Object.fromEntries(perOrg.map((p) => [p.def.id, p.count])),
    orgJoined: joined,
    orgLeft: left,
    orgSwitchedIn: switchedIn,
    orgSwitchedOut: switchedOut,
    orgNetSwitch: switchedIn - switchedOut,
    orgShare,
    service,
    connectedCount,
    connectedTypes: ORGANIZERS.filter((d) => (state.platformShare[d.id] ?? 0) > 0.02).map((d) => d.id),
    targetedTypes: ORGANIZERS.filter((d) => connectedFor[d.id]).map((d) => d.id),
    platformShare: { ...state.platformShare },
    onboardingSpend,
    migratedNow,

    // --- Афиша ---
    events: totalEvents,
    seats: totalSeats,
    marketSeats: marketSeatsTotal,
    seatShare,
    breadth: listingBreadth,
    hit: hit ? { id: hit.id, size: hit.size } : null,
    hitNext: state.pendingHit ? { ...state.pendingHit } : null,
    advanceRecouped,
    advanceWrittenOff,
    advanceOutstanding,

    // --- Зрители ---
    reach: reachAfter,
    reachShare: reachAfter / AUDIENCES.reduce((s, a) => s + a.potential, 0),
    demand: demandTotal,
    conversion: wAudience('conv'),
    buyerPreference: avgBuyerPref,
    trust: state.trust,
    botShare,
    outageLoss,

    // --- Продажи ---
    tickets: ticketsTotal,
    marketTickets: marketSold,
    platformTickets: platformSold,
    lostTickets: ownSold,
    fill,
    fillByType: Object.fromEntries(perOrg.map((p) => [p.def.id, p.fill])),

    // --- Деньги ---
    gmv,
    gmvMarket,
    gmvPlatform,
    marketplaceShareOfGmv,
    revenue,
    financeLevel: financeLevel(state, decisions),
    financeCost: financeBudget,
    miscRate: rateMisc,
    miscCost,
    acquiringRate: acqRate,
    marketplaceRevenue,
    platformRevenue,
    subscriptionRevenue,
    takeRate,
    revenuePerTicket,
    acquiring,
    supportCost: supportLoad,
    variableCost,
    contribution,
    managerCost,
    staffCost,
    platformSeats,
    techUpkeep,
    serverCost,
    fixed,
    oneOff,
    installCost,
    crisisCost,
    refundHit,
    installedNow,
    profit,
    raisedTotal: state.raisedTotal,
    cash: state.cash,

    // --- Конкурент ---
    rivalOrgs: rivalOrgsNow,
    rivalOrgsDelta: rivalOrgsNow - rivalOrgsBefore,
    rivalStance,
    rivalCommission: riv.commission,
    rivalBuyerFee: riv.buyerFee,
    rivalReach: riv.reach,
    rivalPlatform: rivalPlatformLevel(riv),
    rivalAlive: riv.alive,
    rivalCash: riv.cash,
    rivalRevenue: rivalStep.revenue,
    rivalJustCut: Boolean(riv.justCut),
    rivalExclusives: { ...riv.exclusives },

    // --- Уровни ---
    platformLevel: pLevel,
    productLevel: prodLevel,
    dataLevel: dataLevel(state),
    rndLevel: rndLevel(state),
    algoQuality: quality,
    algoActive: Object.fromEntries(ALGORITHMS.map((a) => [a.key, algoOn(a.key)])),
    visibleFee,

    // --- Средние по сегментам, для разбора ---
    avgAppeal: wAvg('appeal'),
    avgPreference: wAvg('preference'),
    avgFillSeen: wAvg('fillSeen'),
    avgConversion: wAudience('conv'),
    avgInterest: wAudience('interest'),

    // --- Совет, кризисы, события ---
    goal: state.board.goal ? { ...state.board.goal } : null,
    goalProgress: progress,
    goalOutcome,
    forcedDilution,
    boardInjection,
    marketingCapped,
    restrictions: restrictions ? { ...restrictions } : null,
    crisis: state.crisis ? { ...state.crisis } : null,
    crisisResolved,
    exclusiveOffer: state.exclusiveOffer,
    exclusiveSigned,
    exclusives: { ...state.exclusives },
    event: event ? { id: event.id, choice } : null,

    segments: perAud.map((p) => ({
      id: p.aud.id,
      reach: p.seg.reach,
      interest: p.interest,
      conversion: p.conv,
      buyerPref: p.buyerPref,
      demand: p.demand,
    })),
    organizers: perOrg.map((p) => ({
      id: p.def.id,
      count: p.count,
      connected: p.connected,
      widgetShare: p.widgetShare,
      appeal: p.appeal,
      rivalAppeal: p.rivalAppeal,
      preference: p.preference,
      events: p.events,
      seats: p.seats,
      fill: p.fill,
      marketSold: p.marketSold,
      platformSold: p.platformSold,
      lostSold: p.ownSold,
      gained: p.gained,
      leaving: p.leaving,
      flow: p.flow,
      split: p.split,
    })),

    decisions: deepClone(decisions),
    snapshot,
  };

  report.valuation = valuation(state);
  report.equityValue = report.valuation * state.equity;
  state.history.push(report);
  state.lastSnapshot = { decisions: deepClone(decisions) };
  return { state, report };
}

// ----------------------------------------------------------------------------
// Экономика одного билета — считается мгновенно, до расчёта месяца
// ----------------------------------------------------------------------------
export function unitEconomics(state, decisions) {
  const last = state.history[state.history.length - 1];
  // Средняя цена билета по вашей афише, а не по рынку
  let price = 0;
  let weight = 0;
  for (const def of ORGANIZERS) {
    const count = state.orgs[def.id] ?? 0;
    const seats = count * def.eventsPerMonth * def.seats;
    price += seats * def.avgPrice;
    weight += seats;
  }
  const avgPrice = weight > 0 ? price / weight : 2_000;
  const marketShare = last ? last.marketplaceShareOfGmv : 1;

  const marketRevenue = avgPrice * (decisions.buyerFee + decisions.orgCommission);
  const platformRevenuePerTicket = avgPrice * decisions.platformRate;
  const blended = marketRevenue * marketShare + platformRevenuePerTicket * (1 - marketShare);
  const acquiring = avgPrice * CONFIG.acquiringRate;
  const support = CONFIG.supportPerTicket
    * clamp(CONFIG.refSupport / Math.max(1, decisions.support), 0.35, 2.4);

  return {
    avgPrice,
    marketRevenue,
    platformRevenue: platformRevenuePerTicket,
    blended,
    acquiring,
    support,
    variable: acquiring + support,
    contribution: blended - acquiring - support,
    marketShare,
  };
}

// ----------------------------------------------------------------------------
// Контрфактический разбор: что дал каждый включённый алгоритм
// ----------------------------------------------------------------------------
export function algorithmImpact(state) {
  const actual = state.history[state.history.length - 1];
  if (!actual) return [];
  const out = [];
  for (const algo of ALGORITHMS) {
    if (!state.installed[algo.key] || !actual.algoActive?.[algo.key]) continue;
    const base = { ...actual.decisions };
    base.algoOn = { ...base.algoOn, [algo.key]: false };
    const probe = deepClone(state);
    probe.history = state.history.slice(0, -1);
    probe.month = actual.month - 1;
    // Прогон того же месяца без этого алгоритма
    const before = state.history[state.history.length - 2];
    if (!before) continue;
    const counter = step({ ...probe, month: actual.month - 1 }, {
      decisions: base, eventChoice: actual.event?.choice ?? 0,
    });
    out.push({
      key: algo.key,
      revenue: actual.revenue - counter.report.revenue,
      gmv: actual.gmv - counter.report.gmv,
      trust: actual.trust - counter.report.trust,
    });
  }
  return out;
}

// ----------------------------------------------------------------------------
// Оценка компании
// ----------------------------------------------------------------------------
export function valuation(state) {
  const h = state.history;
  const last = h[h.length - 1];
  if (!last) return 0;
  // Год у билетного сервиса устроен волной: август и май отличаются вдвое.
  // Считать оценку по одному месяцу значит оценивать сезон, а не бизнес,
  // поэтому выручка, рост и маржа берутся одним окном. Маржа раньше бралась
  // из последнего месяца — и обнулив на нём маркетинг и разработку, множитель
  // можно было задрать рывком. См. shared/valuation.js.
  const runRate = windowAvg(h, CONFIG.valuationWindow, (r) => r.revenue) * 12;
  const growth = windowGrowthStable(h, CONFIG.growthWindow, (r) => r.gmv, 0.25);
  const marginWindow = windowAvg(h, CONFIG.valuationWindow, (r) => r.revenue);
  const margin = marginWindow > 0
    ? windowAvg(h, CONFIG.valuationWindow, (r) => r.profit) / marginWindow : -1;
  const multiple = revenueMultiple(growth, margin, {
    base: 2.4, growthWeight: 5.5, marginWeight: 3.0, marginPenalty: 1.6,
    marginFloor: -1, marginCap: 1, max: 11,
  });
  // Договоры с организаторами — актив: их нельзя купить деньгами за месяц
  const contracts = ORGANIZERS.reduce(
    (s, def) => s + (state.orgs[def.id] ?? 0) * def.eventsPerMonth * def.seats * def.avgPrice * 0.11,
    0,
  );
  const position = clamp(0.5 + 1.1 * (last.orgShare ?? 0), 0.5, 1.6);
  const trustFactor = clamp(0.7 + 0.45 * (last.trust ?? 0.7), 0.7, 1.15);

  return Math.max(0,
    (runRate * multiple + contracts) * position * trustFactor
    * (1 + (state.flags?.valuationBonus ?? 0)));
}

// Упаковка к раунду: оценку считает рынок, финансовая команда меняет
// только долю, которую вы отдаёте за те же деньги.
export function financeRoundMult(state) {
  return financeRoundGain(CONFIG.finance,
    financeLevel(state, state.decisions ?? DEFAULT_DECISIONS));
}

export function fundingOffer(state, amount) {
  const terms = roundTerms(valuation(state) * financeRoundMult(state), amount,
    { floor: CONFIG.valuationFloor });
  return { ...terms, valuation: terms.pre, newEquity: state.equity * (1 - terms.dilution) };
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
// Разбор месяца: баланс потоков, а не набор «влияний».
// Строки обязаны складываться в ту же цифру, что стоит в заголовке.
// ----------------------------------------------------------------------------
export function explain(prev, cur) {
  if (!cur) return [];
  const base = prev ? prev.orgs : 0;
  if (base <= 0) return [];
  const parts = [
    ['flowJoined', cur.orgJoined],
    ['flowLeft', -cur.orgLeft],
    ['flowSwitch', cur.orgNetSwitch],
  ];
  return parts
    .map(([key, people]) => ({ key, people, effect: people / base }))
    .filter((p) => Math.abs(p.effect) > 0.0005)
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
}

/**
 * Почему организаторы решили так: изменение условий месяц к месяцу.
 * У всех строк знак читается одинаково — вверх значит в вашу пользу.
 */
export function explainFactors(prev, cur) {
  if (!prev || !cur) return [];
  const parts = [
    ['factorAppeal', prev.avgAppeal, cur.avgAppeal],
    ['factorStanding', prev.avgPreference, cur.avgPreference],
    ['factorFill', prev.fill, cur.fill],
    ['factorReach', prev.reach, cur.reach],
    ['factorTrust', prev.trust, cur.trust],
    ['factorService', prev.service, cur.service],
    ['factorConversion', prev.conversion, cur.conversion],
  ];
  return parts
    .map(([key, a, b]) => ({ key, effect: a > 0 && b > 0 ? b / a - 1 : 0 }))
    .filter((p) => Math.abs(p.effect) > 0.005)
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
}

export function finalScore(state) {
  const v = valuation(state);
  const last = state.history[state.history.length - 1];
  // Стоимость доли = доля × (оценка бизнеса + деньги на счету). Кэш в кассе
  // принадлежит акционерам: рубль, не потраченный к финалу, стоит рубль,
  // а потраченный обязан вернуться ростом оценки. Без этого разовые расходы
  // в конце партии были бы бесплатными.
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
    orgShare: last?.orgShare ?? 0,
    gmv: last?.gmv ?? 0,
    takeRate: last?.takeRate ?? 0,
    trust: last?.trust ?? 0,
    rivalAlive: state.rivalState?.alive ?? true,
    goals: state.board?.history ?? [],
  };
}

export { STANCES, rivalOrgTotal, platformFit, feeFactor, hitById, eventById, crisisById };

// Персональный разбор партии: правила читают историю и называют системные
// промахи; цены — из телеметрии самой партии и замеров аудита 2026-08.
// Возвращает список { id, ...числа для подстановки }; тексты — в strings.js.
export function debrief(state) {
  const hist = state.history ?? [];
  if (hist.length < 8) return [];
  const out = [];
  const sum = (fn) => hist.reduce((a, r) => a + (fn(r) ?? 0), 0);

  // Авансы организаторам списывались чаще, чем возвращались: ставки на
  // хиты без запаса. Цена — собственные списания партии.
  const writtenOff = sum((r) => r.advanceWrittenOff);
  const recouped = sum((r) => r.advanceRecouped);
  if (writtenOff >= 30e6 && writtenOff > 0.35 * (writtenOff + recouped)) {
    out.push({ id: 'advances', lost: writtenOff, back: recouped });
  }

  // Боты держали заметную долю продаж, а антибот-фильтр стоял на нуле:
  // доверие зрителей — это спрос следующих месяцев. Порог 18%: фоновая
  // доля ботов на опорах не поднимается выше 15% — правило ловит
  // запущенное нашествие, а не обычный шум.
  const botMonths = hist.filter((r) => (r.botShare ?? 0) >= 0.18
    && (r.decisions?.antiBot ?? 0) === 0).length;
  if (botMonths >= 3) out.push({ id: 'bots', n: botMonths });

  // Касса жила ниже месяца расходов при убыточной операционке: любой шок
  // в такой момент — продажа за долги (28% оценки минус долг).
  const thinMonths = hist.filter((r) => r.profit < 0
    && r.cash < (r.revenue - r.profit)).length;
  if (thinMonths >= 3) out.push({ id: 'thinCash', n: thinMonths });

  // Партия кончилась продажей за долги: напомнить цену пустой кассы.
  if (state.over === 'bankrupt') out.push({ id: 'ranDry', m: state.month });

  return out.slice(0, 4);
}
