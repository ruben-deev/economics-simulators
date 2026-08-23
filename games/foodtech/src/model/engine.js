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

import { CONFIG, DISTRICTS, CITIES, DEFAULT_DECISIONS, ALGORITHMS } from './config.js';
import { createRng } from '../../../../shared/rng.js';
import { platformUpkeep, infraCost } from '../../../../shared/upkeep.js';
import { windowAvg, windowGrowthStable, revenueMultiple, roundTerms, distressedSale } from '../../../../shared/valuation.js';
import { deepClone } from '../../../../shared/clone.js';
import { neutralModifiers, applyEvent, rollEvent } from './events.js';
import { rollWeather, weatherEffect, bonusHabitStep, seasonOf } from './weather.js';
import { makeGoal, goalProgress, applyGoalOutcome } from './board.js';
import { difficultyById } from '../../../../shared/difficulty.js';
import {
  financeHalfCost, financeStrength, financeMiscRate, financeSpend, financeRoundGain,
} from '../../../../shared/finance.js';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const safe = (x, fallback = 0) => (Number.isFinite(x) ? x : fallback);

export function districtById(id) {
  return DISTRICTS.find((d) => d.id === id);
}

export function cityById(id) {
  return CITIES.find((c) => c.id === id);
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
/**
 * Финансовая команда: сила, цена и то, что она чинит. Цена считается долей
 * недельной выручки — служба растёт вместе с компанией.
 */
function financeRevenue(state) {
  const h = state.history ?? [];
  return h.length ? h[h.length - 1].netRevenue : 0;
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

// Ставка эквайринга: сильная служба выторговывает её у банка
export function paymentRate(state, decisions) {
  return Math.max(0.004,
    CONFIG.paymentFeeRate - CONFIG.finance.paymentCut * financeLevel(state, decisions));
}

export function financeCost(state, decisions) {
  return financeSpend(state.difficulty, decisions?.finance ?? 0);
}

export function createInitialState(seed = 'novograd', difficulty = 'normal') {
  const rng = createRng(seed);
  // Погода первой недели и публичный прогноз на вторую
  const weather = rollWeather(rng, 1);
  const weatherNext = rollWeather(rng, 2);
  const state = {
    seed,
    rngState: rng.state(),
    // Уровень сложности — общая настройка набора: меняет только цену
    // финансовой команды (см. shared/difficulty.js)
    difficulty: difficultyById(difficulty).id,
    weather,
    weatherNext,
    week: 0,
    cash: CONFIG.startCash,
    equity: 1,               // доля основателей, 1.0 = 100%
    raisedTotal: 0,
    techStock: 0,
    rndStock: 0,             // накопленные вложения в data science
    dataStock: 0,            // накопленный объём заказов = обучающая выборка
    installed: {},           // внедрённые алгоритмы
    couriers: 0,
    courierMorale: 1,        // отношение заработка курьера к рынку на прошлой неделе
    bonusHabit: 0,           // привычка курьеров к надбавке за погоду: 0 — свежая, 1 — часть зарплаты
    decisions: { ...DEFAULT_DECISIONS, districts: [] },
    // Вход в город платится один раз; домашний город открыт с самого начала.
    cityEntered: { novograd: true },
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
    // Совет директоров: цель на квартал. Известна с первого хода — это
    // планирование, а не рулетка.
    board: { goal: null, history: [], profitableWeeks: 0 },
    restrictions: null,
    pendingEvent: null,
    pendingChoice: null,
    history: [],
    lastSnapshot: null,      // состояние до последнего хода — для «что было бы, если»
    over: null,   // 'bankrupt' | 'finished'
  };
  // Цель первого квартала объявляется сразу: игрок должен знать, к чему идёт,
  // с первого хода, а не узнавать об этом на тринадцатой неделе.
  state.board.goal = makeGoal(1, state, 0, 0);
  return state;
}


// ----------------------------------------------------------------------------
// Производные показатели
// ----------------------------------------------------------------------------

export function techLevel(state) {
  return state.techStock / (state.techStock + CONFIG.techSaturation);
}

// Данные и команда по отдельности бесполезны — качество алгоритмов растёт
// только когда есть и то и другое. Отсюда среднее геометрическое.
export function dataLevel(state) {
  return (state.dataStock ?? 0) / ((state.dataStock ?? 0) + CONFIG.dataSaturation);
}
export function rndLevel(state) {
  return (state.rndStock ?? 0) / ((state.rndStock ?? 0) + CONFIG.rndSaturation);
}
export function algoQuality(state) {
  return Math.sqrt(dataLevel(state) * rndLevel(state));
}

// Доступен ли алгоритм: либо уже внедрён, либо качество доросло до порога
export function algoAvailable(state, key) {
  const def = ALGORITHMS.find((a) => a.key === key);
  if (!def) return false;
  return Boolean(state.installed?.[key]) || algoQuality(state) >= def.unlock;
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
  const state = deepClone(prevState);
  if (state.over) return { state, report: state.history[state.history.length - 1] ?? null };

  // Компактный снимок «как было до хода» — по нему интерфейс считает контрфактические
  // сценарии «сколько бы мы заработали без этого алгоритма».
  const snapshot = deepClone({
    ...prevState,
    history: prevState.history.slice(-2),
    lastSnapshot: null,
  });

  const decisions = { ...state.decisions, ...(input.decisions ?? {}) };
  state.decisions = decisions;

  const rng = createRng(state.seed);
  rng.restore(state.rngState);

  const week = state.week + 1;

  // --- 0. Ограничения совета ---
  // Порезанный маркетинг режется до того, как из него что-то посчитано:
  // иначе ограничение было бы грустной надписью, а не ограничением.
  const restrictions = state.restrictions && week < state.restrictions.until
    ? state.restrictions : null;
  if (!restrictions) state.restrictions = null;
  let marketingCapped = null;
  if (restrictions?.marketingCap && decisions.marketing > restrictions.marketingCap) {
    marketingCapped = restrictions.marketingCap;
    decisions.marketing = restrictions.marketingCap;
  }

  // Размеры на начало недели: поштучные цены событий считаются от того, что
  // игрок видит на экране в момент выбора, а не от состояния после хода.
  const couriersAtStart = state.couriers;
  const customersAtStart = DISTRICTS.reduce((acc, d) => acc + (state.districts[d.id]?.customers ?? 0), 0);

  // --- 1. Событие недели (было объявлено в конце прошлой недели) ---
  const mods = neutralModifiers();
  const event = state.pendingEvent;
  const choice = input.eventChoice ?? state.pendingChoice ?? 0;
  applyEvent(mods, event, choice);
  if (mods.commissionOverrideDelta) state.flags.commissionDelta += mods.commissionOverrideDelta;
  if (mods.chainDeal) state.flags.chainOn = true;
  // Фанаты сети заказывают у неё и после недели новости — пока сеть на борту
  if (state.flags.chainOn) mods.demandMult *= 1 + CONFIG.chain.fans;
  if (mods.valuationBonus) state.flags.valuationBonus += mods.valuationBonus;
  if (mods.regulationRisk) state.flags.regulationRisk = true;

  // --- 2. Запуск и закрытие районов ---
  // Сохранение из версии без Старгорода: дописываем недостающие районы
  // и города, не трогая существующие. Партия продолжается, а не сбрасывается.
  state.cityEntered = state.cityEntered ?? { novograd: true };
  for (const def of DISTRICTS) {
    if (!state.districts[def.id]) {
      state.districts[def.id] = {
        id: def.id, active: false, launchedWeek: null, awareness: 0,
        customers: 0, restaurants: 0, deliveryTime: def.baseTime, satisfaction: 1,
      };
    }
  }

  const wanted = new Set(decisions.districts ?? []);
  let launchCost = 0;
  let cityEntryCost = 0;
  const launched = [];
  const closed = [];
  const enteredCities = [];
  // Ворота экспансии: совет согласует второй город после первого квартала
  // и при работающей машине дома. Новоградские районы в DISTRICTS идут
  // первыми, так что открытые этой же неделей уже посчитаны.
  const homeActive = () => DISTRICTS
    .filter((d) => d.city === 'novograd' && state.districts[d.id].active).length;
  const expansionOpen = () => week >= CONFIG.expansion.minWeek
    && homeActive() >= CONFIG.expansion.minHomeDistricts;
  for (const def of DISTRICTS) {
    const ds = state.districts[def.id];
    if (wanted.has(def.id) && !ds.active) {
      // Первый район в новом городе тянет за собой вход в город: юрлицо,
      // локальная команда, запуск логистики. Платится один раз за партию.
      if (!state.cityEntered[def.city]) {
        if (!expansionOpen()) continue;   // ворота закрыты — заявка ждёт
        state.cityEntered[def.city] = true;
        cityEntryCost += cityById(def.city)?.entryCost ?? 0;
        enteredCities.push(def.city);
        // Хозяин города отвечает на вход промо-войной — конечной: жечь
        // деньги вечно не может и он.
        state.cityWar = state.cityWar ?? {};
        state.cityWar[def.city] = week + CONFIG.expansion.warWeeks;
      }
      ds.active = true;
      ds.launchedWeek = week;
      ds.deliveryTime = def.baseTime;
      // Часть жителей уже привыкла заказывать еду — стартовое ядро аудитории
      ds.awareness = Math.max(ds.awareness, 0.02);
      ds.customers = Math.max(ds.customers, reachableOf(def) * 0.005);
      launchCost += def.launchCost;
      launched.push(def.id);
    } else if (!wanted.has(def.id) && ds.active) {
      ds.active = false;
      ds.customers = 0;
      ds.restaurants = 0;
      closed.push(def.id);
    }
  }
  launchCost += cityEntryCost;

  const activeDefs = DISTRICTS.filter((d) => state.districts[d.id].active);
  const commission = effectiveCommission(state, decisions);
  const season = seasonality(week);

  // --- 2а. Погода недели ---
  // Игрок знал её заранее: она была объявлена в конце прошлого хода.
  // Бьёт с двух сторон сразу — поднимает спрос и режет пропускную способность.
  const weatherType = state.weather ?? 'clear';
  const wx = weatherEffect(weatherType, decisions.weatherBonus ?? 0, state.bonusHabit ?? 0);

  // --- 2б. Алгоритмы: доступность, внедрение, настройки ---
  const quality = algoQuality(state);
  let installCost = 0;
  const installedNow = [];
  for (const a of ALGORITHMS) {
    if (decisions.algoOn?.[a.key] && !state.installed[a.key] && quality >= a.unlock) {
      state.installed[a.key] = true;
      installCost += a.install;
      installedNow.push(a.key);
    }
  }
  // Интенсивность алгоритма: 0 = выключен или недоступен
  const algo = (key) => (decisions.algoOn?.[key] && state.installed[key]
    ? clamp(decisions.algoParam?.[key] ?? 0, 0, 1)
    : 0);

  const batchLevel = algo('batching');
  const surgeStrength = algo('surge');
  const targetShare = decisions.algoOn?.targeting && state.installed.targeting
    ? clamp(decisions.algoParam?.targeting ?? 1, 0.05, 1) : 1;
  const targetingOn = decisions.algoOn?.targeting && state.installed.targeting;
  const allocSkew = algo('allocation');
  const flexSpread = algo('flexCommission');
  const forecastOn = Boolean(decisions.algoOn?.forecast && state.installed.forecast);
  const serviceTarget = clamp(decisions.algoParam?.forecast ?? 0.8, 0.55, 0.95);

  // Батчинг: курьер везёт несколько заказов за одну поездку. Растёт и число заказов
  // на курьера, и заработок курьера — а ставка за отдельный заказ в связке ниже,
  // потому что второй адрес по пути стоит платформе дешевле первого.
  // Плата за это — время: заказ ждёт попутчика и едет по цепочке.
  const batchCapacityMult = 1 + 0.60 * batchLevel * quality;
  const batchTimeMult = 1 + 0.16 * batchLevel * (1 - 0.6 * quality);
  const courierPayEff = decisions.courierPay * (1 - 0.20 * batchLevel * quality) + wx.payPerOrder;

  // Персональные скидки: платим за долю заказов, а эффект близок к скидке всем.
  // Точность = качество алгоритмов; при плохой модели скидка уходит не туда.
  const precision = quality;
  const promoCostPerOrder = targetingOn ? decisions.promo * targetShare : decisions.promo;
  // Два потолка. Первый: даже идеальная модель не создаст больше спроса, чем
  // скидка всем подряд, а неточная упирается заметно раньше.
  const promoCeiling = decisions.promo * (0.4 + 0.6 * precision);
  // Второй, без которого прицельная скидка становится бесплатной: эффект не
  // может превышать заплаченное больше чем в targetingLeverage раз, и рычаг
  // точности сам решает, где остановиться. Раньше можно было платить за
  // двадцатую часть заказов и получать эффект скидки всем — и ползунок скидки
  // уходил в упор при любых прочих настройках. Прицельный рубль работает как
  // несколько обычных, но не как двадцать.
  const leverage = CONFIG.targetingLeverage * (0.4 + 0.6 * precision);
  const effPromo = targetingOn
    ? Math.min(promoCeiling, promoCostPerOrder * leverage)
    : decisions.promo;
  // В отчёт идёт то, что получилось на самом деле: во сколько раз рубль скидки
  // сработал против рубля, розданного всем.
  const promoLift = promoCostPerOrder > 0 ? effPromo / promoCostPerOrder : 1;
  // Чем уже охват и хуже модель, тем больше клиентов замечают, что скидка досталась
  // не им. Штраф пропорционален размеру скидки: без скидок обижаться не на что.
  const targetingPenalty = targetingOn
    ? Math.pow(1 - targetShare, 2) * (1 - precision) * 0.35
      * Math.min(1, decisions.promo / 50)
    : 0;

  // Гибкая комиссия: крупным партнёрам ниже, остальным выше. Рестораны в среднем
  // довольнее (ниже воспринимаемая ставка), но часть выручки мы отдаём.
  const commissionForRevenue = commission * (1 - 0.06 * flexSpread);
  const commissionPerceived = commission * (1 - 0.35 * flexSpread * quality);

  // --- 3. Спрос по районам (время доставки берём прошлой недели — лаг обратной связи) ---
  const totalPotentialActive = activeDefs.reduce((s, d) => s + d.potential, 0) || 1;
  const perDistrict = [];
  let totalDemand = 0;

  for (const def of activeDefs) {
    const ds = state.districts[def.id];
    // Комиссия выше привычной не остаётся между нами и рестораном: он
    // поднимает цену блюда на нашей витрине, и чек растёт у клиента.
    const markup = 1 + clamp(commissionPerceived - CONFIG.restaurantRefCommission, 0, 0.25)
      * CONFIG.commissionPassThrough;
    const aov = aovOf(def) * markup;
    // Плата за доставку весит больше, чем те же деньги в цене блюда. Она стоит
    // в чеке отдельной строкой, и за неё как будто не дают еды: сто рублей,
    // размазанные по цене пиццы, проходят незаметно, а те же сто рублей в
    // строке «доставка» останавливают заказ. Скидка считается так же — она
    // видна ровно в том же месте и с тем же весом.
    const visible = (decisions.deliveryFee - effPromo) * CONFIG.deliveryFeeSalience;
    const customerPrice = aov + visible;
    const refPrice = aovOf(def) + CONFIG.refDeliveryFee * CONFIG.deliveryFeeSalience;
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
      * wx.demandMult
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

  const perCourier = ordersPerCourier(state, avgDistance,
    mods.capacityMult * batchCapacityMult * wx.capacityMult);
  const capacity = state.couriers * perCourier;

  // Динамическое ценообразование. Надбавка появляется только в перегрузе:
  // surge зарабатывает не столько на цене, сколько на сглаживании пика.
  const rawUtil = capacity > 0 ? totalDemand / capacity : (totalDemand > 0 ? 3 : 0);
  const surgeUp = surgeStrength * clamp((rawUtil - 0.7) / 0.6, 0, 1);
  const surgeFeeMult = 1 + 0.35 * surgeUp;
  const surgeShave = 1 - 0.10 * surgeUp;          // часть пикового спроса отказывается
  const surgeTimeMult = 1 - 0.12 * surgeUp * quality;
  const surgePenalty = Math.pow(surgeStrength, 1.5) * (0.03 + 0.35 * surgeUp) * (1 - 0.5 * quality);

  const effDemandTotal = totalDemand * surgeShave;
  for (const p of perDistrict) p.demandEff = p.demand * surgeShave;

  // Распределение курьеров по районам. Без алгоритма — пропорционально спросу
  // (одинаковая загрузка везде). С алгоритмом — с перекосом в пользу маржи.
  const cmOf = (p) => p.aov * commissionForRevenue + decisions.deliveryFee * surgeFeeMult
    - courierPayEff - promoCostPerOrder
    - (p.aov + decisions.deliveryFee * surgeFeeMult - promoCostPerOrder) * CONFIG.paymentFeeRate
    - Math.max(2, CONFIG.supportCostPerOrder - CONFIG.supportTechDiscount * techLevel(state));
  const cmAvg = effDemandTotal > 0
    ? perDistrict.reduce((acc, p) => acc + cmOf(p) * p.demandEff, 0) / effDemandTotal
    : 1;

  let weightSum = 0;
  for (const p of perDistrict) {
    const edge = cmAvg !== 0 ? cmOf(p) / cmAvg - 1 : 0;
    p.allocWeight = Math.max(0.2 * p.demandEff, p.demandEff * (1 + 2.5 * allocSkew * quality * edge));
    weightSum += p.allocWeight;
  }

  // Мощность закрепляется за районом. Лишние курьеры в одном районе не спасают
  // соседний — они просто простаивают. Поэтому перекос всегда чем-то оплачен.
  for (const p of perDistrict) {
    p.capacity = weightSum > 0 ? capacity * (p.allocWeight / weightSum) : 0;
  }

  const utilization = capacity > 0 ? effDemandTotal / capacity : (effDemandTotal > 0 ? 3 : 0);

  let orders = 0;
  let gmv = 0;
  let paymentBase = 0;

  for (const p of perDistrict) {
    p.util = p.capacity > 0 ? p.demandEff / p.capacity : (p.demandEff > 0 ? 3 : 0);
    p.fill = p.demandEff > 0 ? clamp(p.capacity / p.demandEff, 0, 1) : 1;
    p.served = Math.min(p.demandEff, p.capacity);
    // Новое время доставки: перегрузка кубически бьёт по скорости
    const congestion = 1 + 0.85 * Math.pow(Math.min(p.util, 2.2), 3);
    p.newTime = state.couriers > 0
      ? clamp(p.def.baseTime * congestion * batchTimeMult * surgeTimeMult
          * (1 - CONFIG.techTimeRelief * techLevel(state)), 10, 120)
      : 120;
    orders += p.served;
    gmv += p.served * p.aov;
    paymentBase += p.served * (p.aov + decisions.deliveryFee * surgeFeeMult - promoCostPerOrder);
  }
  const fillRate = effDemandTotal > 0 ? orders / effDemandTotal : (capacity > 0 ? 1 : 0);

  // --- 5. P&L недели ---
  // Сделка с сетью: её заказы идут по льготной ставке. Доля заказов сети —
  // её рестораны с весом популярности против остальной витрины.
  let chainDiscount = 0;
  if (state.flags.chainOn) {
    const totalRests = activeDefs.reduce(
      (sum, d) => sum + state.districts[d.id].restaurants, 0);
    const chainShare = totalRests > 0
      ? Math.min(0.45, CONFIG.chain.popularity * 40 / totalRests) : 0;
    chainDiscount = gmv * chainShare
      * Math.max(0, commissionForRevenue - CONFIG.chain.rate);
  }
  const commissionRevenue = gmv * commissionForRevenue - chainDiscount;
  const feeRevenue = orders * decisions.deliveryFee * surgeFeeMult;
  const netRevenue = commissionRevenue + feeRevenue;

  const courierCost = orders * courierPayEff;
  const promoCost = orders * promoCostPerOrder;
  const payRate = paymentRate(state, decisions);
  const paymentCost = Math.max(0, paymentBase) * payRate;
  const supportCost = orders * Math.max(2,
    CONFIG.supportCostPerOrder - CONFIG.supportTechDiscount * techLevel(state) + mods.variableCostAdd);
  const variableCost = courierCost + promoCost + paymentCost + supportCost;
  const contribution = netRevenue - variableCost;

  // Городской офис — пока в городе открыт хоть один район. Домашний город
  // уже входит в hqWeeklyBase, у него weeklyFixed = 0.
  const activeCities = [...new Set(activeDefs.map((d) => d.city))];
  const cityFixed = activeCities.reduce((s, id) => s + (cityById(id)?.weeklyFixed ?? 0), 0);
  const districtFixed = activeDefs.reduce((s, d) => s + d.weeklyFixed, 0) + cityFixed;
  // Построенное стоит денег каждую неделю, а серверы дорожают вместе с
  // заказами: обе статьи раньше прятались внутри «офиса и менеджмента».
  const techUpkeep = platformUpkeep(
    (state.techStock ?? 0) + (state.rndStock ?? 0), CONFIG.techUpkeepRate);
  const serverCost = infraCost(orders, CONFIG.serverPerOrder, techLevel(state), CONFIG.serverTechRelief);
  const hqCost = CONFIG.hqWeeklyBase + CONFIG.hqPerCourier * state.couriers
    + techUpkeep + serverCost;

  // --- 6. Курьеры: наём и отток ---
  // Курьер оценивает не фактический, а ожидаемый заработок: он видит ставку и
  // рассчитывает набрать хотя бы 60% полной смены. Поэтому у ставки есть «пол».
  const realizedPerCourier = state.couriers > 0 ? orders / state.couriers : 0;
  const expectedOrdersPerCourier = Math.max(realizedPerCourier, perCourier * CONFIG.courierExpectedLoad);
  const courierEarnings = expectedOrdersPerCourier * courierPayEff;
  const attractiveness = courierEarnings / CONFIG.courierMarketWeeklyPay;
  // Удержание же зависит от фактического заработка: простой злит не меньше низкой ставки.
  const realizedEarnings = state.couriers > 0
    ? realizedPerCourier * courierPayEff
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

  // Прогноз спроса: штат подбирается автоматически под ожидаемую нагрузку.
  // Ошибка прогноза детерминирована (не трогает ГПСЧ) и падает с ростом качества.
  // Наём этой недели выходит на линию на следующей, поэтому и прогноз, и ручное
  // решение игрока должны смотреть на погоду СЛЕДУЮЩЕЙ недели. Она объявлена публично.
  const wxNext = weatherEffect(state.weatherNext ?? 'clear', decisions.weatherBonus ?? 0, state.bonusHabit ?? 0);
  let forecastDemand = null;
  let targetCouriers = Math.max(0, Math.round(decisions.targetCouriers));
  if (forecastOn) {
    const hist = state.history;
    const prevDemand = hist.length ? hist[hist.length - 1].demand : effDemandTotal;
    const growth = prevDemand > 0 ? clamp(effDemandTotal / prevDemand, 0.85, 1.35) : 1.1;
    const noise = Math.sin(week * 127.1) * Math.cos(week * 311.7);
    const error = noise * (1 - quality) * 0.30;
    // Спрос текущей недели уже включает сегодняшнюю погоду — переводим его
    // в «безпогодный» вид и накладываем прогноз на следующую
    const weatherShift = wxNext.demandMult / Math.max(0.01, wx.demandMult);
    forecastDemand = Math.max(0, effDemandTotal * growth * weatherShift * (1 + error));
    targetCouriers = Math.round(
      forecastDemand / Math.max(1, perCourier * (wxNext.capacityMult / Math.max(0.01, wx.capacityMult)))
      / serviceTarget);
  }

  const churnRate = clamp(
    CONFIG.courierBaseChurn
    + Math.max(0, 1.15 - realizedAttractiveness) * 0.55
    + Math.max(0, utilization - 0.9) * 0.35
    + wx.churnAdd
    + mods.courierChurnAdd,
    0, 0.7
  );
  state.courierMorale = state.couriers > 0 ? realizedAttractiveness : 1;
  const courierLeft = state.couriers * churnRate;
  const target = targetCouriers;
  const after = state.couriers - courierLeft;
  const hires = clamp(target - after, 0, applicants);
  const hiringCost = hires * CONFIG.courierHireCost;
  state.couriers = Math.max(0, Math.round(after + hires));

  // --- 7. Рестораны ---
  const remainingPoolTotal = activeDefs.reduce(
    (s, d) => s + Math.max(0, d.restaurantPool - state.districts[d.id].restaurants), 0) || 1;
  const salesPower = clamp(0.35 * Math.pow(decisions.sales / CONFIG.salesRefBudget, 0.6), 0, 0.8);
  const commissionTerm = clamp(
    Math.pow(CONFIG.restaurantRefCommission / Math.max(0.02, commissionPerceived), 0.8), 0.3, 1.6);

  for (const def of activeDefs) {
    const ds = state.districts[def.id];
    const p = perDistrict.find((x) => x.def.id === def.id);
    const served = p ? p.served : 0;
    const ordersPerRest = ds.restaurants > 0 ? served / ds.restaurants : 0;
    const volumeTerm = clamp(Math.pow(ordersPerRest / CONFIG.restaurantRefOrders, 0.5), 0, 1.5);
    // Поток заказов компенсирует высокую комиссию лишь до предела: когда доставка
    // перестаёт быть рентабельной для самого ресторана, объём его уже не удержит.
    const viability = clamp(
      (CONFIG.restaurantMaxCommission - commissionPerceived) / CONFIG.restaurantCommissionSpan, 0, 1);
    const attractR = clamp(
      (0.35 + 0.65 * volumeTerm) * commissionTerm * (0.25 + 0.75 * viability), 0, 1.6);

    const remaining = Math.max(0, def.restaurantPool - ds.restaurants);
    const share = remaining / remainingPoolTotal;
    const localSales = salesPower * (activeDefs.length > 1 ? share * activeDefs.length : 1);
    const newRest = remaining * clamp(localSales * attractR * 0.5, 0, 0.4);

    // За планкой рентабельности ресторан не «чуть менее доволен» — он уходит,
    // и тем быстрее, чем глубже за планку. Раньше наказание кончалось ровно
    // на планке в 30%, а ползунок шёл до 40: последняя четверть диапазона
    // была бесплатной, и правильный ответ упирался в потолок.
    const exodus = Math.max(0, commissionPerceived - CONFIG.restaurantMaxCommission)
      / CONFIG.restaurantCommissionSpan;
    const restChurn = clamp(CONFIG.restaurantBaseChurn
      + Math.max(0, 1 - attractR) * 0.12
      + exodus * CONFIG.restaurantExodus + mods.restaurantChurnAdd, 0, 0.6);

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
    const lostShare = 1 - p.fill;
    const satisfaction = clamp(
      0.35 * newSpeedFactor
      + 0.25 * Math.min(p.selectionFactor, 1.2)
      + 0.25 * Math.min(p.priceFactor, 1.3)
      + 0.15 * (1 - lostShare * 2)
      + mods.satisfactionAdd
      - surgePenalty
      - targetingPenalty,
      0, 1.4
    );
    ds.satisfaction = satisfaction;
    weightedSat += satisfaction * def.potential;

    // Насколько мы дороже рынка. priceFactor = 1 — мы стоим как конкурент,
    // и тогда эта величина ровно ноль: наценки нет, и ничего не происходит.
    // Дальше она растёт вместе с чеком — и с ней растёт готовность уйти.
    // Без этого поднимать цену было бы бесплатно: частота заказов падала
    // плавно, а маржа росла быстрее, и упор ползунка оказывался лучшим ходом.
    const pricePremium = clamp(1 / Math.max(0.25, p.priceFactor) - 1, 0, 1.5);
    const rivalPull = def.competitor * pricePremium;

    // Промо-война хозяина города после вашего входа: приток урезан, отток выше.
    const atWar = (state.cityWar?.[def.city] ?? 0) > week;

    const churn = clamp(
      CONFIG.customerBaseChurn + Math.max(0, 1 - satisfaction) * 0.30 + def.competitor * 0.012
      + rivalPull * CONFIG.rivalPricePull
      + (atWar ? CONFIG.expansion.warChurnAdd : 0),
      0, 0.6
    );
    const leaving = ds.customers * churn;

    const untapped = Math.max(0, reachableOf(def) - ds.customers);
    const trial = untapped * ds.awareness * CONFIG.trialRate
      * clamp(satisfaction, 0.3, 1.3) * clamp(p.selectionFactor, 0, 1.2)
      / (1 + rivalPull * CONFIG.rivalTrialPull)
      * (atWar ? 1 - CONFIG.expansion.warTrialCut : 1);
    const wom = ds.customers * 0.02 * Math.max(0, satisfaction - 1);

    ds.customers = Math.max(0, ds.customers - leaving + trial + wom);
    ds.deliveryTime = p.newTime;
    newCustomers += trial + wom;
    lostCustomers += leaving;
    p.satisfaction = satisfaction;
  }

  // --- 9. Деньги ---
  // Прочие расходы: комиссии, списания, штрафы, неразнесённая административка.
  // Единственная строка, которая растёт сама — вместе с выручкой, — и
  // единственная, которую режет не бизнес-решение, а финансовая служба.
  const financeBudget = financeCost(state, decisions);
  const rateMisc = miscRate(state, decisions);
  const miscCost = netRevenue * rateMisc;
  const opex = districtFixed + hqCost + decisions.marketing + decisions.sales
    + decisions.tech + (decisions.rnd ?? 0) + financeBudget + miscCost;
  // Поштучные разовые расходы событий: «доплата всем курьерам» стоит по штату
  // на начало недели, «раздача по базе» — по числу клиентов. Цена решения
  // растёт вместе с компанией — это и делает выбор состояние-зависимым.
  const perUnitCost = (mods.oneOffCostPerCourier ?? 0) * couriersAtStart
    + (mods.oneOffCostPerCustomer ?? 0) * customersAtStart;
  const oneOff = launchCost + hiringCost + installCost + (mods.oneOffCost ?? 0) + perUnitCost;
  const profit = contribution - opex;
  state.cash += profit - oneOff;
  state.techStock += decisions.tech;
  state.rndStock += decisions.rnd ?? 0;
  state.dataStock += orders;   // каждая доставка — строчка в обучающей выборке

  // --- 10. Метрики для интерфейса ---
  const totalCustomers = activeDefs.reduce((s, d) => s + state.districts[d.id].customers, 0);
  const totalRestaurants = activeDefs.reduce((s, d) => s + state.districts[d.id].restaurants, 0);
  const avgDeliveryTime = orders > 0
    ? perDistrict.reduce((s, p) => s + p.newTime * p.served, 0) / orders
    : (perDistrict.length ? perDistrict.reduce((s, p) => s + p.newTime, 0) / perDistrict.length : 0);

  // Категория растёт вместе с нами: если раздать скидки, заказывать начинают
  // чаще, чем «обычно», и город съедает больше доставки, чем съедал раньше.
  // Но весь рынок нашим не станет — часть жителей прочно сидит у конкурента.
  // Доля выше 100% — это ошибка счёта, а не достижение, и показывать её нельзя.
  // Знаменатель — города присутствия: пока вы не вышли в Старгород, его рынок
  // в вашу долю не входит; вышли — доля считается по обоим городам сразу.
  const shareCities = new Set(activeCities.length ? activeCities : ['novograd']);
  const baseCityOrders = DISTRICTS
    .filter((d) => shareCities.has(d.city))
    .reduce((s, d) => s + d.potential * d.baseFreq * 0.45, 0);
  const cityMarketOrders = Math.max(baseCityOrders, orders / CONFIG.maxMarketShare);
  const marketShare = orders / cityMarketOrders;

  const cac = newCustomers > 0 ? (decisions.marketing) / newCustomers : 0;
  const cmPerOrder = orders > 0 ? contribution / orders : 0;

  // --- 10а. Совет директоров ---
  // Цель квартала известна с первого хода; счётчик прибыльных недель копится
  // внутри квартала и обнуляется вместе с целью.
  if (profit > 0) state.board.profitableWeeks += 1;
  const progress = goalProgress(state.board.goal, {
    orders, cmPerOrder, profitableWeeks: state.board.profitableWeeks,
    customers: totalCustomers, marketShare,
  });
  let goalOutcome = null;
  if (state.board.goal && week % CONFIG.boardQuarterWeeks === 0) {
    goalOutcome = applyGoalOutcome(state, state.board.goal, progress, week);
    state.board.history.push(goalOutcome);
    state.board.profitableWeeks = 0;
    const next = state.board.goal.quarter + 1;
    state.board.goal = week < CONFIG.weeksTotal
      ? makeGoal(next, state, orders, totalCustomers) : null;
  }
  // Провал первого квартала: акционеры вводят деньги сами и на своих условиях
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
    demand: effDemandTotal,
    demandRaw: totalDemand,
    lostOrders: Math.max(0, effDemandTotal - orders),
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
    financeLevel: financeLevel(state, decisions),
    financeCost: financeBudget,
    miscRate: rateMisc,
    miscCost,
    paymentRate: payRate,
    techUpkeep,
    serverCost,
    oneOff,
    launchCost,
    cityEntryCost,
    cityFixed,
    enteredCities,
    // Ворота экспансии: совет согласовал второй город или ещё нет. В отчёте,
    // а не только в панели районов, — иначе интерфейс не может отличить
    // «уже можно» от «стало можно только что» и сообщить об этом новостью.
    expansionOpen: expansionOpen(),
    // Сколько недель хозяину второго города осталось воевать (0 — мир)
    cityWarWeeks: Math.max(0, ...CITIES.map((c) => (state.cityWar?.[c.id] ?? 0) - week)),
    hiringCost,
    profit,
    raisedTotal: state.raisedTotal,
    cash: state.cash,
    couriers: state.couriers,
    hires,
    courierLeft,
    applicants,
    courierEarnings: state.couriers > 0 ? realizedEarnings : courierEarnings,
    courierAttractiveness: state.couriers > 0 ? realizedAttractiveness : attractiveness,
    utilization,
    fillRate,
    // Три числа, из которых заказы получаются точно:
    //   заказы = клиенты × средняя_частота × surgeShave × заполнение
    // Средняя частота определена как остаток, поэтому тождество выполняется
    // при любом составе районов — без этого разбор не сходился с фактом.
    demandPerCustomer: totalCustomers > 0 ? totalDemand / totalCustomers : 0,
    surgeShave,
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

    // --- погода ---
    weather: weatherType,
    weatherNext: state.weatherNext ?? 'clear',
    weatherDemandMult: wx.demandMult,
    weatherCapacityMult: wx.capacityMult,
    weatherSeverity: wx.severity,
    weatherBonusPerOrder: wx.payPerOrder,
    weatherBonusCost: orders * wx.payPerOrder,
    weatherChurnAdd: wx.churnAdd,
    bonusHabit: state.bonusHabit,
    seasonName: seasonOf(week),

    // --- алгоритмы ---
    algoQuality: quality,
    dataLevel: dataLevel(state),
    rndLevel: rndLevel(state),
    installCost,
    installedNow,
    algoActive: Object.fromEntries(ALGORITHMS.map((a) => [a.key, Boolean(decisions.algoOn?.[a.key] && state.installed[a.key])])),
    courierPayEff,
    surgeUplift: surgeUp,
    surgeFeeMult,
    effectivePromo: effPromo,
    promoCostPerOrder,
    promoLift: targetingOn ? promoLift : 1,
    batchCapacityMult,
    batchTimeMult,
    forecastDemand,
    commissionForRevenue,
    commissionPerceived,
    chainDiscount,
    chainOn: Boolean(state.flags.chainOn),
    avgPriceFactor: wGeo('priceFactor'),
    avgSpeedFactor: wGeo('speedFactor'),
    avgSelectionFactor: wGeo('selectionFactor'),
    event: event ? { id: event.id, choice } : null,
    launched,
    closed,
    districts: perDistrict.map((p) => ({
      id: p.def.id,
      orders: p.served,
      demand: p.demand,
      customers: state.districts[p.def.id].customers,
      penetration: state.districts[p.def.id].customers / reachableOf(p.def),
      restaurants: state.districts[p.def.id].restaurants,
      awareness: state.districts[p.def.id].awareness,
      deliveryTime: p.newTime,
      satisfaction: p.satisfaction,
      fill: p.fill,
      util: p.util,
      aov: p.aov,
      priceFactor: p.priceFactor,
      selectionFactor: p.selectionFactor,
      speedFactor: p.speedFactor,
      contribution: p.served * cmOf(p),
      cmPerOrder: cmOf(p),
    })),
    // --- совет директоров ---
    goal: state.board.goal ? { ...state.board.goal } : null,
    goalProgress: progress,
    goalOutcome,
    forcedDilution,
    boardInjection,
    marketingCapped,
    restrictions: restrictions ? { ...restrictions } : null,

    decisions: deepClone({ ...decisions, districts: [...(decisions.districts ?? [])] }),
  };

  // --- 11. Завершение недели ---
  state.week = week;
  state.lastSnapshot = snapshot;
  state.history.push(report);
  state.rngState = rng.state();
  state.pendingChoice = null;
  // Показанные события копятся ради мягкой гарантии скрепочного носителя
  if (event) {
    state.seenEvents = state.seenEvents ?? [];
    state.seenEvents.push(event.id);
  }
  state.pendingEvent = rollEvent(rng, week + 1, state.flags, state.seenEvents ?? []);
  state.weather = state.weatherNext ?? 'clear';
  state.weatherNext = rollWeather(rng, week + 2);
  // Привычка к надбавке: копится, пока надбавка включена, рассеивается без неё
  state.bonusHabit = bonusHabitStep(state.bonusHabit, decisions.weatherBonus ?? 0);
  state.rngState = rng.state();

  if (state.cash < 0) state.over = 'bankrupt';
  else if (week >= CONFIG.weeksTotal) state.over = 'finished';

  report.valuation = valuation(state);
  report.equityValue = report.valuation * state.equity;

  return { state, report };
}

// ----------------------------------------------------------------------------
// Контрфактический разбор: «сколько на самом деле принёс каждый алгоритм».
//
// Для каждого включённого алгоритма прошлая неделя пересчитывается заново с
// выключенным алгоритмом — и сравнивается с тем, что получилось на самом деле.
// Это честный ответ на вопрос «а стоило ли оно того», который в реальной
// компании требует A/B-теста, а здесь считается мгновенно.
// ----------------------------------------------------------------------------
export function algorithmImpact(state) {
  const snap = state.lastSnapshot;
  const actual = state.history[state.history.length - 1];
  if (!snap || !actual) return [];

  const out = [];
  for (const a of ALGORITHMS) {
    if (!actual.algoActive?.[a.key]) continue;
    const decisions = deepClone(actual.decisions);
    decisions.algoOn = { ...decisions.algoOn, [a.key]: false };
    let alt;
    try {
      alt = step(snap, { decisions, eventChoice: actual.event?.choice ?? 0 }).report;
    } catch {
      continue;
    }
    if (!alt) continue;
    out.push({
      key: a.key,
      profit: actual.profit - alt.profit,
      orders: actual.orders - alt.orders,
      deliveryTime: actual.avgDeliveryTime - alt.avgDeliveryTime,
      cmPerOrder: actual.cmPerOrder - alt.cmPerOrder,
      customers: actual.customers - alt.customers,
    });
  }
  return out.sort((x, y) => y.profit - x.profit);
}

// ----------------------------------------------------------------------------
// Оценка компании и раунды инвестиций
// ----------------------------------------------------------------------------
export function valuation(state) {
  const h = state.history;
  if (!h.length) return 40_000_000;
  // Выручка и маржа берутся окном, а не последней неделей: иначе оценку можно
  // купить рывком на один ход — задрать плату и обнулить вложения перед самым
  // концом партии. См. shared/valuation.js.
  const netRevenueRunRate = windowAvg(h, CONFIG.valuationWindow, (r) => r.netRevenue) * 52;
  const growth = windowGrowthStable(h, CONFIG.growthWindow, (r) => r.orders, 0.5);
  const marginWindow = windowAvg(h, CONFIG.valuationWindow, (r) => r.netRevenue);
  const margin = marginWindow > 0
    ? windowAvg(h, CONFIG.valuationWindow, (r) => r.profit) / marginWindow : -0.5;

  // Сжатие тоже считается: за падающий бизнес платят меньший множитель —
  // это и есть цена жадности.
  const multiple = revenueMultiple(growth, margin, {
    base: 2.0, growthWeight: 5, marginWeight: 4, marginPenalty: 1.5,
  });
  const base = netRevenueRunRate * multiple;
  const bonus = 1 + clamp(state.flags.valuationBonus, -0.4, 0.6);
  return Math.max(40_000_000, base * bonus);
}

// Насколько лучше компания упакована к раунду: та же выручка, но с внятной
// отчётностью и чистой юнит-экономикой стоит для инвестора дороже. На счёт
// это не влияет — оценку считает рынок; влияет на отдаваемую долю.
export function financeRoundMult(state) {
  return financeRoundGain(CONFIG.finance,
    financeLevel(state, state.decisions ?? DEFAULT_DECISIONS));
}

export function fundingOffer(state, amount) {
  const terms = roundTerms(valuation(state) * financeRoundMult(state), amount,
    { floor: CONFIG.valuationFloor });
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
// Разбор недели: раскладываем изменение числа заказов на факторы.
// ln(orders) = ln(клиенты) + ln(частота) + ln(доля выполненных)
// ----------------------------------------------------------------------------
export function explain(prev, cur) {
  if (!prev || !cur) return [];
  // Первые недели — это запуск, а не динамика: база растёт с нуля, и любые
  // отношения там бессмысленны. Разбирать нечего, пока заказов почти нет.
  if (prev.orders < 100 || cur.orders < 100) return [];

  // Разложение обязано быть точным. Заказы получаются из четырёх множителей
  // по определению:
  //   заказы = клиенты × средняя_частота × surgeShave × заполнение
  // Частоту дальше раскладываем на названные причины, а всё, что они не
  // объясняют, честно называется «состав районов»: когда открывается новый
  // район, средняя частота меняется сама по себе, без единого решения.
  const ratio = (a, b) => (a > 0 && b > 0 ? b / a : 1);
  const named = [
    ['driverPrice', ratio(prev.avgPriceFactor, cur.avgPriceFactor)],
    ['driverSpeed', ratio(Math.pow(prev.avgSpeedFactor, 0.5), Math.pow(cur.avgSpeedFactor, 0.5))],
    ['driverSelection', ratio(Math.pow(prev.avgSelectionFactor, 0.5), Math.pow(cur.avgSelectionFactor, 0.5))],
    ['driverSeason', ratio(prev.season * prev.weatherDemandMult, cur.season * cur.weatherDemandMult)],
  ];
  const freqRatio = ratio(prev.demandPerCustomer, cur.demandPerCustomer);
  const explained = named.reduce((acc, [, r]) => acc * r, 1);
  const mix = explained > 0 ? freqRatio / explained : 1;

  const parts = [
    ['driverCustomers', ratio(prev.customers, cur.customers)],
    ...named,
    ['driverMix', mix],
    ['driverSurge', ratio(prev.surgeShave ?? 1, cur.surgeShave ?? 1)],
    ['driverCapacity', ratio(Math.max(0.01, prev.fillRate), Math.max(0.01, cur.fillRate))],
  ];
  return parts
    .map(([key, r]) => ({ key, effect: r - 1 }))
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

  // Алгоритмы меняют экономику заказа ещё до того, как сыграна неделя
  const on = (key) => Boolean(decisions.algoOn?.[key] && state.installed?.[key]);
  const flexSpread = on('flexCommission') ? clamp(decisions.algoParam?.flexCommission ?? 0, 0, 1) : 0;
  const commissionForRevenue = commission * (1 - 0.06 * flexSpread);
  const targetShare = on('targeting') ? clamp(decisions.algoParam?.targeting ?? 1, 0.05, 1) : 1;
  const promo = on('targeting') ? decisions.promo * targetShare : decisions.promo;

  const commissionRevenue = aov * commissionForRevenue;
  const feeRevenue = decisions.deliveryFee;
  const revenue = commissionRevenue + feeRevenue;

  const courier = decisions.courierPay;
  const payment = (aov + decisions.deliveryFee - promo) * CONFIG.paymentFeeRate;
  const support = Math.max(2, CONFIG.supportCostPerOrder - CONFIG.supportTechDiscount * t);
  const variable = courier + promo + payment + support;

  return {
    aov, commission: commissionForRevenue, commissionBase: commission, targetShare,
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
    weeks: state.week,
    // Кончились деньги — компанию продали за долги: 28% оценки минус долг,
    // остаток по долям. «Банкротство» остаётся только когда долг съел и это.
    bankrupt: state.over === 'bankrupt' && distressedSale(v, state.cash) <= 0,
    sold: state.over === 'bankrupt' && distressedSale(v, state.cash) > 0,
  };
}

// Персональный разбор партии: правила читают историю и называют системные
// промахи, каждый — с ценой, замеренной на 24 кодах (аудит 2026-08).
// Возвращает список { id, ...числа для подстановки }; тексты — в strings.js.
export function debrief(state) {
  const hist = state.history ?? [];
  if (hist.length < 8) return [];
  const out = [];

  // Шторм без ответа: ни надбавки курьерам, ни прогнозного автонайма.
  // Цена: реакция на погоду даёт опоре до +87% к итогу; с прогнозным
  // автонаймом надбавка не нужна — обе механики закрывают один провал.
  // Первые 12 недель — льготные: прогнозный автонайм открывается качеством
  // к 9–13 неделе, и ранние шторма — не системный промах, а часть пути.
  const severe = hist.filter((r) => r.week > 12 && (r.weatherSeverity ?? 0) >= 0.7);
  const stormsIgnored = severe.filter((r) => !(r.decisions?.weatherBonus > 0)
    && !r.algoActive?.forecast).length;
  if (stormsIgnored >= 3 && stormsIgnored > severe.length / 2) {
    out.push({ id: 'storms', n: stormsIgnored });
  }

  // Алгоритмы простаивали. Цена: доведённая стратегия с включёнными
  // алгоритмами — 4.4 млрд против 1.3 у ручной опоры.
  const lateWeeks = hist.filter((r) => r.week > 12);
  const idleWeeks = lateWeeks.filter((r) => Object.values(r.algoActive ?? {})
    .filter(Boolean).length <= 1).length;
  if (lateWeeks.length >= 8 && idleWeeks > lateWeeks.length / 2) {
    out.push({ id: 'algosIdle', n: idleWeeks });
  }

  // Ворота экспансии открыты, а второго города так и не случилось.
  // Цена: опора с алгоритмами 4.4 млрд, она же со Старгородом — 6.4.
  const firstOpen = hist.find((r) => r.expansionOpen);
  const entered = Object.keys(state.cityEntered ?? {}).some((c) => c !== 'novograd');
  if (firstOpen && !entered && state.week - firstOpen.week >= 10) {
    out.push({ id: 'noExpansion', w: firstOpen.week });
  }

  // Партия кончилась продажей за долги: напомнить цену пустой кассы.
  if (state.over === 'bankrupt') out.push({ id: 'ranDry', w: state.week });

  return out.slice(0, 4);
}
