// ============================================================================
// Ядро симуляции онлайн-кинотеатра. Чистые функции: step(state) -> {state, report}.
// Никакой работы с DOM — модуль можно гонять в тестах и в скриптах.
//
// Смысловая структура модели:
//
//   деньги -> лицензии (сразу) ─┐
//   деньги -> производство ─────┼─► КАТАЛОГ: глубина + свежесть
//             (лаг 6 месяцев)   ┘         │
//                                         ▼
//   маркетинг -> узнаваемость -> пробные подписки -> ПОДПИСЧИКИ (запас)
//                    ▲                    │                   │
//                    │   цена, реклама, каталог -> отток       ▼
//         ПЕРЕТОК ◄──┴──► КОНКУРЕНТ                      часы просмотра
//                                                             │
//                                        выручка (подписка + реклама)
//                                        минус трафик (растёт с часами!)
//                                                             │
//                                                        P&L -> касса
//
// Главная особенность жанра: чем больше зритель смотрит, тем он лояльнее —
// и тем дороже обходится. Трафик здесь единственная крупная переменная
// статья, и она растёт вместе с любовью аудитории к сервису.
//
// Среда нестационарна: конкурент отвечает на ваши решения, права и талант
// дорожают вместе с вашим успехом, совет директоров меняет цель каждый год,
// а кризисы длятся, пока их не решить. Поэтому постоянной оптимальной
// политики в этой игре не существует — стратегию приходится пересобирать.
// ============================================================================

import {
  CONFIG, SEGMENTS, GENRES, ALGORITHMS, DEFAULT_DECISIONS, clamp, segmentById, genreById,
} from './config.js';
import { createRng } from '../../../../shared/rng.js';
import { neutralModifiers, applyEvent, rollEvent } from './events.js';
import { classifyRelease, rivalEffect, seasonHours, seasonOf } from './market.js';
import {
  createRival, stepRival, rivalSubs, segmentPreference, switchFlow, STANCES,
} from './rival.js';
import { makeGoal, goalProgress, applyGoalOutcome } from './board.js';
import {
  rollCrisis, crisisEffects, crisisById, resolutionById, resolutionCost,
} from './crises.js';
import {
  SCALES, scaleById, projectPrice, projectMonths, commission, advanceProduction,
  releaseBuzz, projectAppeal, inProduction, readyToRelease, slotsUsed, resetProjectIds,
} from './slate.js';
import {
  createPricing, annualShare, annualSubs, raiseShock, tickAnnual, addAnnualCohort,
} from './pricing.js';
import {
  PARTNERS, partnerById, rollPartnerOffer, partnerInflow, partnerRevenue, partnerTotals,
} from './partners.js';

// Справочники и clamp живут в config.js; здесь они переэкспортируются,
// чтобы у интерфейса и тестов была одна точка входа в модель.
export { clamp, segmentById, genreById };

// Во сколько обходится один проект выбранного жанра при текущей цене таланта
export function projectCost(genre, talentIndex = 1) {
  return genre.hours * CONFIG.originalCostPerHour * genre.costPerHour * talentIndex;
}

// ----------------------------------------------------------------------------
// Дорожающие ресурсы
// ----------------------------------------------------------------------------

/** Индекс цен на права: общий для рынка, растёт от совокупной закупки. */
export function licenseIndexOf(state) {
  return state.licenseIndex ?? 1;
}

/**
 * Индекс стоимости таланта. Растёт вместе с вашим успехом: успешному сервису
 * звёзды выставляют другой счёт. Это и есть причина, по которой себестоимость
 * хита растёт быстрее его аудитории.
 */
export function talentIndexOf(state) {
  const subs = lastSubs(state);
  const fromSuccess = Math.pow(clamp(subs / CONFIG.refSubsForTalent, 0, 4), 0.7);
  return 1 + CONFIG.talentInflation * fromSuccess + (state.talentPenalty ?? 0);
}

// Общая база: розница плюс опт. Обе ветки считают одинаково — иначе
// в первый месяц «размер компании» означал бы одно, а дальше другое.
function lastSubs(state) {
  const last = state.history[state.history.length - 1];
  if (last) return last.subs;
  const retail = SEGMENTS.reduce(
    (s, def) => s + state.segments[def.id].premium + state.segments[def.id].ads, 0);
  return retail + partnerTotals(state.partners ?? []).subs;
}

// ----------------------------------------------------------------------------
// Начальное состояние
// ----------------------------------------------------------------------------
export function createInitialState(seed = 'kinopotok') {
  const rng = createRng(seed);
  resetProjectIds(1);
  const rival = createRival(rng);
  const state = {
    seed,
    rngState: rng.state(),
    month: 0,
    cash: CONFIG.startCash,
    equity: 1,
    raisedTotal: 0,
    techStock: 0,
    rndStock: 0,
    dataStock: 0,          // накопленные часы просмотра — обучающая выборка
    installed: {},
    catalogLicensed: 900,  // стартовая библиотека, доставшаяся от прежнего владельца
    catalogOriginal: 0,
    originalsByGenre: Object.fromEntries(GENRES.map((g) => [g.id, 0])),
    freshHours: 0,         // «новинки»: стареют каждый месяц
    slate: [],             // проекты: в производстве, готовые в запасе, вышедшие
    lastRaiseMonth: -99,   // когда последний раз поднимали цену действующим
    lastBuzz: 0,           // остаточный шум прошлой премьеры (для календаря релизов)
    hangover: 0,           // сколько зрителей досмотрели премьеру и готовы уйти
    segments: Object.fromEntries(SEGMENTS.map((s) => [s.id, {
      id: s.id,
      awareness: 0.03,
      premium: 0,
      ads: 0,
      pricing: createPricing(DEFAULT_DECISIONS.priceNew),
    }])),

    // --- Живой конкурент ---
    rivalState: rival,
    rival: 'none',         // категория его премьеры в этом месяце
    rivalNext: 'none',     // что он анонсировал на следующий

    // --- Дорожающие ресурсы ---
    licenseIndex: 1,
    talentPenalty: 0,

    // --- Совет директоров ---
    board: { goal: null, history: [], profitableMonths: 0 },
    restrictions: null,
    pendingDilution: 0,

    // --- Кризисы ---
    crisis: null,          // { id, months }
    crisisHistory: [],
    lastCrisisResolved: -99,

    // --- Партнёрства ---
    partners: [],          // действующие контракты: { id, monthsLeft, subs }
    partnerOffer: null,    // предложение, ждущее ответа
    partnerHistory: [],

    decisions: structuredClone(DEFAULT_DECISIONS),
    flags: { valuationBonus: 0 },
    pendingEvent: null,
    pendingChoice: null,
    history: [],
    lastSnapshot: null,
    over: null,
  };
  // Цель первого года объявляется сразу: игрок должен её видеть с первого хода
  state.board.goal = makeGoal(1, state, 0, rivalSubs(rival));
  return state;
}

// ----------------------------------------------------------------------------
// Производные показатели
// ----------------------------------------------------------------------------
export function techLevel(state) {
  return state.techStock / (state.techStock + CONFIG.techSaturation);
}
export function dataLevel(state) {
  return (state.dataStock ?? 0) / ((state.dataStock ?? 0) + CONFIG.dataSaturation);
}
export function rndLevel(state) {
  return (state.rndStock ?? 0) / ((state.rndStock ?? 0) + CONFIG.rndSaturation);
}
// Ни данные, ни команда по отдельности не работают
export function algoQuality(state) {
  return Math.sqrt(dataLevel(state) * rndLevel(state));
}

// Глубина каталога: насыщающаяся функция, нормированная так, что эталон даёт 1.0
export function catalogDepth(hours) {
  const raw = hours / (hours + CONFIG.refCatalogHours);
  const ref = CONFIG.refCatalogHours / (CONFIG.refCatalogHours + CONFIG.refCatalogHours);
  return clamp(raw / ref, 0, 1.6);
}

// Свежесть: сколько новинок вышло относительно эталона
export function catalogFreshness(freshHours) {
  return clamp(Math.pow(Math.max(0, freshHours) / CONFIG.refFreshHours, 0.5), 0, 1.7);
}

/** Взвешенный «полезный» каталог: час драмы и час реалити стоят разного. */
export function weightedOriginals(originalsByGenre) {
  let acc = 0;
  for (const g of GENRES) acc += (originalsByGenre?.[g.id] ?? 0) * g.depthValue;
  return acc;
}

/**
 * Насколько сильно собственный каталог тянет к вам именно этот сегмент.
 * Учитывает не только объём, но и то, для кого вы снимали: гора реалити
 * не удержит киноманов, сколько бы её ни было.
 */
export function exclusivePullOf(weightedHours, segDef, byGenre) {
  let relevant = weightedHours;
  if (byGenre) {
    relevant = 0;
    for (const g of GENRES) {
      relevant += (byGenre[g.id] ?? 0) * g.depthValue * CONFIG.originalDepthWeight
        * (g.appeal[segDef.id] ?? 1);
    }
  }
  return relevant / (relevant + CONFIG.refExclusiveHours * CONFIG.originalDepthWeight);
}

/** Действующий потолок контентного бюджета, если совет его порезал. */
export function contentCap(state) {
  const r = state.restrictions;
  if (!r || state.month >= r.until) return null;
  return r.contentCap;
}

// ----------------------------------------------------------------------------
// Главный шаг симуляции
// ----------------------------------------------------------------------------
export function step(prevState, input = {}) {
  const state = structuredClone(prevState);
  if (state.over) return { state, report: state.history[state.history.length - 1] ?? null };

  const snapshot = structuredClone({
    ...prevState,
    history: prevState.history.slice(-2),
    lastSnapshot: null,
  });

  const decisions = { ...state.decisions, ...(input.decisions ?? {}) };
  state.decisions = decisions;

  const rng = createRng(state.seed);
  rng.restore(state.rngState);

  const month = state.month + 1;
  const season = seasonHours(month);

  // --- 1. Ограничения совета директоров ---
  // Порезанный бюджет — это не совет, а потолок: лишние деньги просто не тратятся.
  // Уже запущенные проекты порезать нельзя: съёмочной группе платят до конца.
  // Потолок бьёт по закупке лицензий и запрещает запускать новое дорогое.
  const cap = contentCap(state);
  const contentBudget = { licensing: cap === null ? decisions.licensing : Math.min(decisions.licensing, cap) };
  const capApplied = cap !== null && contentBudget.licensing < decisions.licensing - 1;

  // --- 2. Событие месяца и кризис ---
  const mods = neutralModifiers();
  const event = state.pendingEvent;
  const choice = input.eventChoice ?? state.pendingChoice ?? 0;
  applyEvent(mods, event, choice);
  if (mods.valuationBonus) state.flags.valuationBonus += mods.valuationBonus;

  // Решение по кризису принимается до расчёта месяца: подействует сразу
  let crisisResolved = null;
  let crisisCost = 0;
  const crisisChoice = input.crisisChoice ?? null;
  if (state.crisis && crisisChoice) {
    const res = resolutionById(state.crisis.id, crisisChoice);
    if (res) {
      crisisCost = resolutionCost(state.crisis, crisisChoice);
      if (res.talentPenalty) state.talentPenalty = (state.talentPenalty ?? 0) + res.talentPenalty;
      if (res.techGain) state.techStock += crisisCost * res.techGain;
      if (res.pipelineDelay) for (const p of state.slate) if (p.status === 'production') p.monthsLeft += res.pipelineDelay;
      if (res.qualityHit) for (const p of state.slate) if (p.status === 'production') p.quality *= (1 - res.qualityHit);
      if (res.resolves) {
        crisisResolved = { id: state.crisis.id, resolution: res.id, months: state.crisis.months };
        state.crisisHistory.push(crisisResolved);
        state.crisis = null;
        state.lastCrisisResolved = month;
      }
    }
  }
  const crisisMods = crisisEffects(state.crisis);

  // --- 3. Алгоритмы: доступность, внедрение, настройки ---
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
  const algo = (key) => (decisions.algoOn?.[key] && state.installed[key]
    ? clamp(decisions.algoParam?.[key] ?? 0, 0, 1) : 0);

  const recoStrength = algo('recommendations');
  const forecastTrust = algo('contentForecast');
  const winbackDiscount = algo('winback');
  const adSpread = algo('adaptiveAds');
  const compression = algo('encoding');
  const pacing = algo('pacing');

  // --- 4. Дорожающие ресурсы ---
  // Индекс прав общий: сбить его в одиночку нельзя, можно только выйти из торгов.
  const rivalLicSpend = state.rivalState.spend?.licensing ?? 0;
  const bidPressure = Math.max(0,
    (contentBudget.licensing + rivalLicSpend - CONFIG.licenseCalmSpend) / CONFIG.refLicenseSpend);
  const targetIndex = 1 + CONFIG.licenseInflation * clamp(bidPressure, 0, 2.4);
  state.licenseIndex = state.licenseIndex * CONFIG.licenseIndexInertia
    + targetIndex * (1 - CONFIG.licenseIndexInertia);
  const licenseIndex = state.licenseIndex;
  const talentIndex = talentIndexOf(state);

  // --- 5. Ход конкурента ---
  const yourSubsBefore = lastSubs(state);
  const rivalBefore = rivalSubs(state.rivalState);
  stepRival(state.rivalState, {
    yourPrice: decisions.priceNew,
    yourSubs: yourSubsBefore,
    yourOriginalsByGenre: state.originalsByGenre,
    month,
    licenseIndex,
    seasonMult: season,
  }, rng);
  const riv = state.rivalState;

  // --- 6. Производство: слейт, готовые проекты, релизы ---
  //
  // Три разных решения, которые раньше были одним ползунком:
  //   что запустить (жанр × масштаб × сегмент),
  //   когда выпустить готовое,
  //   сколько дать кампании под конкретный релиз.

  // Запуск новых проектов. Слотов ограниченное число, и слот стоит денег
  // независимо от того, занят он или пуст.
  const slots = Math.round(decisions.studioSlots);
  const started = [];
  const rejected = [];
  // Потолок совета считается по месячным тратам на контент: закупка лицензий
  // плюс взносы по уже идущим проектам. Новый проект отклоняется, если его
  // взнос в этот потолок не помещается — резать уже начатое нельзя.
  let committed = inProduction(state.slate).reduce((sum, p) => sum + p.monthlyCost, 0);
  for (const order of (input.commission ?? [])) {
    if (slotsUsed(state.slate) >= slots) { rejected.push({ ...order, reason: 'slots' }); continue; }
    const price = projectPrice(order.genre, order.scale, talentIndex);
    const instalment = price / projectMonths(order.scale);
    if (cap !== null && contentBudget.licensing + committed + instalment > cap) {
      rejected.push({ ...order, reason: 'cap' });
      continue;
    }
    committed += instalment;
    // Чем больше проектов идёт параллельно, тем меньше внимания каждому.
    // Мощность покупается не только деньгами за слот, но и качеством.
    const load = slotsUsed(state.slate) / Math.max(1, slots);
    const project = commission(order.genre, order.scale, order.segment, talentIndex, rng,
      techLevel(state) - CONFIG.slotQualityDrag * load);
    state.slate.push(project);
    started.push({ id: project.id, genre: project.genre, scale: project.scale, segment: project.segment });
  }

  // Ход производства. Кризис с уходом команды останавливает конвейер.
  const stall = crisisMods.pipelineStall ?? 0;
  const { spent: productionSpend, finished } = advanceProduction(state.slate, {
    stallMonths: stall,
    qualityMult: crisisMods.qualityMult ?? 1,
  });

  // Релизы: выпускает игрок, а не движок. Готовый проект может лежать в запасе —
  // выйти в тихий месяц, ответить на чужую премьеру или дождаться высокого сезона.
  const releaseOrders = input.release ?? [];
  const premieres = [];
  let campaignSpend = 0;
  for (const order of releaseOrders) {
    const project = state.slate.find((p) => p.id === order.id && p.status === 'ready');
    if (!project) continue;
    const campaign = Math.max(0, order.campaign ?? 0);
    campaignSpend += campaign;
    // Кампания работает только вместе с релизом: рекламировать нечего,
    // если в этом месяце ничего не выходит.
    const lift = 1 + CONFIG.campaignPower * (campaign / (campaign + CONFIG.refCampaign));
    project.status = 'released';
    project.releasedMonth = month;
    project.campaign = campaign;
    state.originalsByGenre[project.genre] = (state.originalsByGenre[project.genre] ?? 0) + project.hours;
    state.freshHours += project.hours;
    // Сезон работает не только на часы, но и на премьеру: зимой зритель дома
    // и ищет, что посмотреть, летом — нет. Поэтому месяц выхода — решение,
    // а не формальность: ради высокого сезона имеет смысл придержать готовое.
    premieres.push({
      id: project.id,
      genre: project.genre,
      scale: project.scale,
      segment: project.segment,
      quality: project.quality,
      hours: project.hours,
      held: project.monthsHeld,
      campaign,
      season,
      buzz: releaseBuzz(project) * lift * Math.pow(season, CONFIG.seasonBuzzPower),
    });
  }

  const vault = readyToRelease(state.slate);
  const producing = inProduction(state.slate);
  const slotCost = Math.round(CONFIG.studioSlotMonthly * Math.pow(slots, CONFIG.studioSlotExponent));

  // Час реалити стареет быстро, час драмы почти не стареет: дешёвая полка
  // наполняется быстро и так же быстро пустеет.
  for (const g of GENRES) {
    state.originalsByGenre[g.id] = (state.originalsByGenre[g.id] ?? 0) * (1 - g.decay);
  }
  state.catalogOriginal = GENRES.reduce((s, g) => s + state.originalsByGenre[g.id], 0);

  // Календарь релизов растягивает премьеру: часть шума переносится на следующий
  // месяц, зато пик ниже. Отток после «досмотрел всё» сглаживается.
  const rawBuzz = premieres.reduce((s, p) => s + p.buzz, 0);
  const heldBuzz = rawBuzz * pacing * 0.45;
  const buzz = rawBuzz - heldBuzz + (state.lastBuzz ?? 0);
  state.lastBuzz = heldBuzz;

  // Волна отписок от тех, кто досмотрел прошлую премьеру и больше не видит
  // причин платить. Растянутый по неделям релиз её заметно сглаживает.
  const hangover = state.hangover ?? 0;
  state.hangover = premieres.reduce(
    (s, p) => s + p.buzz * (genreById(p.genre)?.hangover ?? 0.4), 0) * (1 - 0.55 * pacing);

  // --- 7. Каталог ---
  // Прогноз спроса делает тот же бюджет эффективнее, но тянет закупку
  // к уже известному: глубина растёт медленнее, чем просмотры.
  const licensingEfficiency = 1 + 0.45 * forecastTrust * quality;
  const boughtHours = (contentBudget.licensing / (CONFIG.licenseCostPerHour * licenseIndex))
    * licensingEfficiency;
  state.catalogLicensed = state.catalogLicensed * (1 - CONFIG.licenseDecay) + boughtHours;
  // Лицензии почти не считаются новинками: это чужое и часто не первой свежести.
  // Ощущение «тут появилось что-то новое» создают премьеры собственных проектов.
  state.freshHours = state.freshHours * (1 - CONFIG.freshDecay) + boughtHours * CONFIG.licenseFreshShare;

  // Иск замораживает часть арендованной библиотеки — своё отобрать нельзя
  const freeze = crisisMods.licensedFreeze ?? 0;
  const availableLicensed = state.catalogLicensed * (1 - freeze);

  const catalogHours = availableLicensed + state.catalogOriginal;
  // Чужой каталог хуже удерживает: он есть и у конкурентов
  const weightedLicensed = availableLicensed * CONFIG.licenseDepthWeight;
  const weightedOriginal = weightedOriginals(state.originalsByGenre) * CONFIG.originalDepthWeight;
  const effectiveCatalog = weightedLicensed + weightedOriginal;
  const originalShare = effectiveCatalog > 0 ? weightedOriginal / effectiveCatalog : 0;
  const depth = catalogDepth(effectiveCatalog) * (1 - 0.10 * forecastTrust * quality);
  const freshness = catalogFreshness(state.freshHours);

  // Рекомендации достают контент с полки: воспринимаемый каталог больше
  // реального. Но при слабой модели лента схлопывается в пузырь.
  //
  // Польза линейна по силе персонализации, вред — квадратичен. Поэтому у
  // ползунка всегда есть безопасное положение, и оно тем правее, чем лучше
  // модель: осторожная лента помогает даже на слабых данных, агрессивная
  // на них же схлопывает каталог в десяток одинаковых карточек.
  const recoLift = 1 + 0.35 * recoStrength * quality;
  const bubble = 1 - 0.30 * recoStrength ** 2 * (1 - quality);
  const perceivedDepth = depth * recoLift * bubble;

  // --- 8. Внешний фон: борьба за внимание в месяц чужой премьеры ---
  const rivalType = classifyRelease(riv.buzz);
  const rivalNextType = classifyRelease(riv.announced?.buzz ?? 0);
  state.rival = rivalType;
  state.rivalNext = rivalNextType;
  const rival = rivalEffect(rivalType, buzz);

  // Каталог конкурента глазами зрителя — для сравнения сервисов
  const rivalEffectiveCatalog = riv.catalogLicensed * CONFIG.licenseDepthWeight
    + riv.catalogOriginal * CONFIG.originalDepthWeight;
  const rivalDepth = catalogDepth(rivalEffectiveCatalog);
  const rivalFreshness = catalogFreshness(riv.freshHours);

  // --- 9. Подписчики по сегментам ---
  const refPrice = 399;
  // Оптовые подписчики — это те же люди. Они занимают ёмкость сегментов
  // наравне с розничными, иначе рынок начинает считаться дважды.
  const partnerBefore = partnerTotals(state.partners).subs;
  const marketPotential = SEGMENTS.reduce((s, x) => s + x.potential, 0);
  // Повышение цены действующей базе — отдельное решение с отдельной ценой.
  // Повторять его каждый месяц нельзя: у людей есть память.
  const wantRaise = Boolean(input.raisePrice);
  const raiseAllowed = wantRaise && (month - (state.lastRaiseMonth ?? -99)) >= CONFIG.raiseCooldown;
  let raiseApplied = false;
  let raiseLost = 0;
  let annualCash = 0;
  let annualNew = 0;
  let annualExpired = 0;
  let newSubs = 0;
  let lostSubs = 0;
  let trialsTotal = 0;
  let winbackCost = 0;
  let switchedIn = 0;
  let switchedOut = 0;
  const perSegment = [];

  for (const def of SEGMENTS) {
    const seg = state.segments[def.id];

    const pricing = seg.pricing;

    // Годовые когорты: у всех тикает срок, истёкшие возвращаются в обычную базу
    annualExpired += tickAnnual(pricing);

    // Повышение цены действующей базе. Годовых оно не задевает: их цена
    // зафиксирована до конца срока — именно за это они и платили вперёд.
    const lockedBefore = pricing.lockedPrice;
    if (raiseAllowed && decisions.priceNew > lockedBefore + 1) {
      const shock = raiseShock(lockedBefore, decisions.priceNew, def);
      const monthly = Math.max(0, seg.premium + seg.ads - annualSubs(pricing));
      const lost = monthly * shock;
      raiseLost += lost;
      const keep = monthly > 0 ? 1 - lost / monthly : 1;
      seg.premium *= keep;
      seg.ads *= keep;
      pricing.lockedPrice = decisions.priceNew;
      raiseApplied = true;
    }

    // Выбор тарифа: чем больше экономия и чем терпимее сегмент к рекламе,
    // тем охотнее он идёт на дешёвый тариф с рекламой.
    const saving = decisions.priceNew > 0
      ? clamp((decisions.priceNew - decisions.priceAds) / decisions.priceNew, 0, 1) : 0;
    const adLoadPain = clamp((decisions.adLoad / CONFIG.refAdLoad) / Math.max(0.2, def.adTolerance), 0, 3);
    const adShare = clamp(0.12 + 0.85 * saving * def.adTolerance - 0.12 * adLoadPain, 0.02, 0.94);

    // Новые смотрят на прайс, а платит база свою заблокированную цену.
    // Разрыв между этими двумя числами — главный скрытый показатель игры.
    const listPrice = decisions.priceNew * (1 - adShare) + decisions.priceAds * adShare;
    const paidPrice = pricing.lockedPrice * (1 - adShare) + decisions.priceAds * adShare;
    const blendedPrice = listPrice;
    // Новый смотрит на прайс — он решает, подписываться ли вообще
    const priceFactor = clamp(Math.pow(refPrice / Math.max(30, listPrice), def.elasticity), 0.15, 2.6);
    // Действующий подписчик злится на ту цену, которую платит сам. Пока база
    // не переведена на новый прайс, повышение её не раздражает — и в этом
    // весь смысл разрыва: он даёт расти цене, не платя оттоком сразу.
    const paidFactor = clamp(Math.pow(refPrice / Math.max(30, paidPrice), def.elasticity), 0.15, 2.6);

    // Ценность каталога для сегмента: глубина и свежесть весят по-разному
    const appeal = clamp(
      Math.pow(Math.max(0.05, perceivedDepth), def.depthWeight * 0.6)
      * Math.pow(Math.max(0.05, freshness), def.freshnessWeight * 0.5),
      0, 2.2
    );

    // Реклама раздражает тем сильнее, чем меньше её терпит сегмент.
    // Адаптивная реклама перераспределяет нагрузку и снимает часть раздражения.
    const adRelief = 1 - 0.45 * adSpread * quality;
    const adPenalty = clamp(1 - 0.16 * adLoadPain * adShare * adRelief, 0.45, 1);

    // Премьера тянет к себе именно свой сегмент — и тем точнее, чем прицельнее
    // она снята. Проект «под киноманов» соберёт их и оставит равнодушными всех
    // остальных: фокус — это всегда и отказ.
    const premiereAppeal = premieres.reduce(
      (s, p) => s + p.buzz * projectAppeal(p, def.id), 0);

    // Узнаваемость — накопительный запас. Маркетинг насыщается: чем глубже
    // проникновение, тем дороже обходится следующий зритель.
    const subsBefore = seg.premium + seg.ads;
    const penetration = clamp(subsBefore / def.potential, 0, 1);
    const saturation = 1 / (1 + CONFIG.marketingSaturation * penetration * penetration);
    const shareOfMarket = def.potential / SEGMENTS.reduce((s, x) => s + x.potential, 0);
    // Кампания под релиз считается маркетингом именно того сегмента,
    // под который снят проект: реклама сериала — это не реклама бренда.
    const targetedCampaign = premieres.reduce(
      (s, p) => s + (p.campaign ?? 0) * (p.segment === def.id ? 0.75 : p.segment ? 0.08 : 0.25), 0);
    const segMarketing = decisions.brandMarketing * shareOfMarket + targetedCampaign;
    const spendPerViewer = segMarketing / def.potential;
    const gain = clamp(
      0.28 * Math.pow(spendPerViewer / CONFIG.refMarketingPerViewer, 0.55) * saturation,
      0, CONFIG.awarenessMaxGain);
    seg.awareness = clamp(
      seg.awareness + (1 - seg.awareness) * gain
      - seg.awareness * CONFIG.awarenessDecay * (crisisMods.awarenessMult ? 2 : 1)
      + (mods.awarenessAdd ?? 0) + premiereAppeal * 0.02,
      0, 1);

    // --- Рынок один на двоих ---
    const rivalSegSubs = riv.segments[def.id] ?? 0;
    const partnerHere = partnerBefore * (def.potential / marketPotential);
    const untapped = Math.max(0, def.potential - subsBefore - rivalSegSubs - partnerHere);

    // Оба сервиса описываются одним и тем же набором характеристик, и оба
    // приводят зрителя по одной и той же формуле. Симметрия здесь принципиальна:
    // иначе выигрывает не тот, кто лучше, а тот, кому модель дала фору.
    const youSide = {
      priceFactor, appeal, adPenalty, awareness: seg.awareness, buzz,
      exclusive: exclusivePullOf(weightedOriginal, def, state.originalsByGenre),
    };
    const rivalSide = {
      priceFactor: clamp(Math.pow(refPrice / Math.max(30, riv.price * 0.82), def.elasticity), 0.15, 2.6),
      appeal: clamp(
        Math.pow(Math.max(0.05, rivalDepth), def.depthWeight * 0.6)
        * Math.pow(Math.max(0.05, rivalFreshness), def.freshnessWeight * 0.5), 0, 2.2),
      adPenalty: clamp(1 - 0.16 * clamp((riv.adLoad / CONFIG.refAdLoad) / Math.max(0.2, def.adTolerance), 0, 3) * 0.45, 0.45, 1),
      awareness: riv.awareness,
      buzz: riv.buzz,
      exclusive: exclusivePullOf(riv.catalogOriginal * CONFIG.originalDepthWeight, def, null),
    };
    const preference = segmentPreference(def, youSide, rivalSide);

    // Приток делится на два независимых вопроса, и путать их нельзя:
    //   1. сколько людей вообще решат завести подписку в этом месяце —
    //      это зависит от лучшего предложения на рынке, а не только вашего;
    //   2. кому из двоих они достанутся — это уже preference.
    // Если качество сервиса входит в оба множителя сразу, оно фактически
    // возводится в квадрат: любой перекос превращается в разгром, а ландшафт
    // решений становится не крутым, а хаотичным — из эксперимента нельзя
    // вынести урок.
    const offerQuality = (side) => side.priceFactor * side.appeal * side.adPenalty;
    const categoryPull = Math.max(offerQuality(youSide), riv.alive ? offerQuality(rivalSide) : 0);
    const categoryAwareness = clamp(
      1 - (1 - seg.awareness) * (1 - (riv.alive ? riv.awareness : 0)), 0, 1);
    const categoryTrials = untapped * categoryAwareness * CONFIG.trialRate * categoryPull
      * rival.acquisitionMult * mods.demandMult * (crisisMods.demandMult ?? 1);

    const trialFactor = clamp(0.55 + 0.45 * (decisions.trialDays / CONFIG.refTrialDays), 0.5, 1.45);
    const trials = categoryTrials * preference * (1 + premiereAppeal * 0.6);
    const converted = trials * CONFIG.trialConversion * trialFactor;

    // Конкурент забирает вторую половину той же поляны
    const rivalConverted = riv.alive
      ? categoryTrials * (1 - preference) * CONFIG.trialConversion * (1 + riv.buzz * 0.6)
      : 0;
    const rivalAfterOwn = Math.max(0, rivalSegSubs + rivalConverted
      - rivalSegSubs * clamp(CONFIG.baseChurn * def.loyalty * 1.15, 0.005, 0.5));

    // Отток: скучный каталог, дорогая подписка, назойливая реклама, чужая премьера
    const boredom = Math.max(0, 1 - freshness) * def.freshnessWeight * 0.055;
    const priceAnger = Math.max(0, 1 - paidFactor) * 0.045;
    const adAnger = (1 - adPenalty) * 0.11;
    const techAnnoyance = Math.max(0, 1 - decisions.bitrate / CONFIG.refBitrate) * 0.03
      + compression * (1 - quality) * 0.02 / Math.max(0.3, def.adTolerance);
    // Персональное удержание: скидка тем, кто уже собрался уходить
    const winbackPower = winbackDiscount > 0
      ? clamp(0.55 * quality + 0.2, 0, 0.75) * clamp(winbackDiscount / 0.4, 0, 1) : 0;

    // Эксклюзив держит: уйти от того, чего больше нигде нет, труднее.
    // Зато после того, как громкую премьеру досмотрели, уходят волной —
    // и чем громче была премьера, тем выше волна.
    const exclusiveHold = 1 - CONFIG.exclusiveRetention * originalShare;
    let churnRate = clamp(
      (CONFIG.baseChurn * def.loyalty + boredom + priceAnger + adAnger + techAnnoyance) * exclusiveHold
      + rival.churnAdd + (mods.churnAdd ?? 0) + (crisisMods.churnAdd ?? 0)
      + hangover * 0.018 * def.freshnessWeight
      - buzz * 0.030,
      0.005, 0.5);
    const savedShare = winbackPower * 0.45;
    churnRate = churnRate * (1 - savedShare);

    // Годовой подписчик физически не может уйти: он уже заплатил за год.
    // В этом и ценность годового тарифа — не в скидке, а в том, что эти
    // люди выключены из оттока до конца срока.
    const lockedIn = annualSubs(pricing);
    const churnable = Math.max(0, subsBefore - lockedIn);
    const leaving = churnable * churnRate;
    // Скидку получают удержанные и часть тех, кто и так остался бы (промахи модели)
    const discounted = churnable * churnRate * savedShare / Math.max(0.05, 1 - savedShare)
      + churnable * (1 - quality) * winbackDiscount * 0.03;
    winbackCost += discounted * pricing.lockedPrice * winbackDiscount;

    // --- Переток между сервисами ---
    // Отдельный поток от общего оттока: эти люди не ушли из категории,
    // они ушли к соседу. Или пришли от него.
    // Годовой подписчик не может уйти и к конкуренту: он оплачен на год вперёд.
    // Переманивать можно только тех, кто платит помесячно.
    const survivorsBeforeSwitch = subsBefore - leaving;
    const switchable = Math.max(0, survivorsBeforeSwitch - lockedIn);
    let flow = switchFlow(def, preference, switchable, rivalAfterOwn);
    flow = clamp(flow, -switchable * 0.5, rivalAfterOwn * 0.5);
    if (flow >= 0) switchedIn += flow; else switchedOut += -flow;
    riv.segments[def.id] = Math.max(0, rivalAfterOwn - flow);

    // Доля рекламного тарифа среди помесячных — нужна и для дрейфа цены,
    // и ниже для распределения выживших по тарифам
    const survivorAdShareGuess = Math.max(0, subsBefore - lockedIn) > 0
      ? clamp(seg.ads / Math.max(1, subsBefore - lockedIn), 0, 1) : adShare;

    // Часть новых берёт годовой тариф: деньги приходят сразу за двенадцать
    // месяцев, но цена фиксируется и повышения их не касаются.
    const annualPortion = annualShare(decisions.annualDiscount, def);
    const annualTakers = converted * (1 - adShare) * annualPortion;
    if (annualTakers > 0) {
      const annualPrice = decisions.priceNew * (1 - decisions.annualDiscount);
      annualCash += addAnnualCohort(pricing, annualTakers, annualPrice);
      annualNew += annualTakers;
    }

    // Средняя цена базы дрейфует к прайсу по мере обновления: старые уходят
    // со своей ценой, новые приходят с прайсом. Именно поэтому разрыв
    // закрывается сам — но медленно, за время оборота базы.
    const monthlyNew = Math.max(0, converted * (1 - adShare) - annualTakers);
    const monthlyStaying = Math.max(0, survivorsBeforeSwitch + flow - lockedIn) * (1 - survivorAdShareGuess);
    const monthlyTotal = monthlyStaying + monthlyNew;
    if (monthlyTotal > 0 && monthlyNew > 0) {
      pricing.lockedPrice = (pricing.lockedPrice * monthlyStaying
        + decisions.priceNew * monthlyNew) / monthlyTotal;
    }

    // Обновляем запасы по тарифам. Годовые подписчики целиком остаются
    // на платном тарифе: годовой продукт — это подписка без рекламы.
    const survivors = survivorsBeforeSwitch + flow;
    const movable = Math.max(0, survivors - lockedIn);
    const survivorAdShare = survivorAdShareGuess;
    seg.ads = Math.max(0, movable * survivorAdShare + converted * adShare);
    seg.premium = Math.max(0, lockedIn + movable * (1 - survivorAdShare) + converted * (1 - adShare));

    newSubs += converted;
    lostSubs += leaving;
    trialsTotal += trials;

    perSegment.push({
      def, seg, pricing, adShare, blendedPrice, listPrice, paidPrice, priceFactor, appeal, adPenalty,
      churnRate, converted, leaving, flow, preference,
      awareness: Math.max(1e-4, seg.awareness),
      subs: seg.premium + seg.ads, rivalSubs: riv.segments[def.id],
    });
  }

  // --- 10. Партнёрства: оптовый канал ---
  // Эти подписчики живут отдельным пулом: у них своя доля выручки, свой отток
  // и свои часы просмотра. Складывать их с розничными в одну цифру можно,
  // но именно так и обманывают себя графиком роста.
  // Розница до партнёрского блока: по ней считается, сколько места на рынке
  // ещё осталось. Итоговая розница пересчитывается ниже — после того как
  // остатки закрытых контрактов перейдут в собственную базу.
  const retailBeforePartners = perSegment.reduce((s, p) => s + p.subs, 0);
  if (input.partnerAnswer && state.partnerOffer) {
    if (input.partnerAnswer === 'accept') {
      const def = partnerById(state.partnerOffer);
      if (def) {
        // Ставка фиксируется прайсом на момент подписания
        state.partners.push({
          id: def.id, monthsLeft: def.months, subs: 0, signed: month,
          price: decisions.priceNew,
        });
        state.partnerHistory.push({ id: def.id, month, action: 'signed' });
      }
    }
    state.partnerOffer = null;
  }

  let partnerInflowTotal = 0;
  let partnerFees = 0;
  let partnerLost = 0;
  const partnerExpired = [];
  for (const deal of state.partners) {
    const def = partnerById(deal.id);
    if (!def) continue;
    const roomLeft = Math.max(0, marketPotential - retailBeforePartners - rivalSubs(riv) - partnerBefore)
      / marketPotential;
    const gained = partnerInflow(deal, def, roomLeft * 1.6);
    // Внутри контракта уходят редко: подписка идёт пакетом и её не отменяют
    const lost = deal.subs * CONFIG.baseChurn * def.churnMult;
    deal.subs = Math.max(0, deal.subs + gained - lost);
    partnerInflowTotal += gained;
    partnerLost += lost;
    partnerFees += def.monthlyFee;
    if (deal.signed === month) partnerFees += def.setupFee;
    deal.monthsLeft -= 1;
  }
  // Контракт кончился — база уходит разом. Часть остаётся, если бренд запомнился.
  let partnerKept = 0;
  for (const deal of state.partners.filter((d) => d.monthsLeft <= 0)) {
    const def = partnerById(deal.id);
    const keepShare = CONFIG.partnerExitKeep * (1 - (def?.awarenessDrag ?? 0));
    const kept = deal.subs * keepShare;
    partnerExpired.push({ id: deal.id, lost: deal.subs - kept, kept });
    partnerLost += deal.subs - kept;
    partnerKept += kept;
    state.partnerHistory.push({ id: deal.id, month, action: 'expired' });
  }
  // Удержанные переходят в розницу по текущей цене, в самый массовый сегмент.
  // Их нужно провести и через perSegment, иначе они выпадут из итога месяца:
  // база просела бы на величину «удержанных», а в следующем месяце подскочила
  // обратно — ровно тот разрыв, из-за которого график базы врал.
  if (partnerKept > 0) {
    const massEntry = perSegment.find((p) => p.def.id === 'mass') ?? perSegment[0];
    if (massEntry) {
      // Пришедшие из опта платят текущий прайс — и тянут среднюю цену базы вверх
      const before = Math.max(0, massEntry.seg.premium + massEntry.seg.ads);
      massEntry.pricing.lockedPrice = (massEntry.pricing.lockedPrice * before
        + decisions.priceNew * partnerKept) / Math.max(1e-6, before + partnerKept);
      massEntry.seg.premium += partnerKept;
      massEntry.subs += partnerKept;
    }
  }
  state.partners = state.partners.filter((d) => d.monthsLeft > 0);
  const retailSubsNow = perSegment.reduce((s, p) => s + p.subs, 0);

  const partnerStats = partnerTotals(state.partners);
  const partnerSubs = partnerStats.subs;
  let partnerRev = 0;
  for (const deal of state.partners) {
    const def = partnerById(deal.id);
    if (!def) continue;
    partnerRev += partnerRevenue(deal, def);
  }

  // --- 11. Часы просмотра и трафик ---
  let hours = 0;
  let adHours = 0;
  for (const p of perSegment) {
    const segHours = p.subs * CONFIG.baseHoursPerSub * p.def.baseHours
      * season * Math.pow(Math.max(0.1, perceivedDepth), 0.35)
      * (1 + 0.22 * recoStrength * quality)
      * rival.hoursMult * (mods.hoursMult ?? 1) * (crisisMods.hoursMult ?? 1);
    p.hours = segHours;
    p.adHours = segHours * (p.seg.ads / Math.max(1, p.subs));
    hours += segHours;
    adHours += p.adHours;
  }

  const retailHours = hours;

  // Оптовые подписчики тоже смотрят — и их трафик тоже оплачиваете вы.
  // Раньше эти часы добавлялись после расчёта трафика, и опт выходил бесплатным.
  let partnerHours = 0;
  for (const deal of state.partners) {
    const def = partnerById(deal.id);
    if (!def) continue;
    partnerHours += deal.subs * CONFIG.baseHoursPerSub * def.hoursMult * season
      * (mods.hoursMult ?? 1) * (crisisMods.hoursMult ?? 1);
  }
  hours += partnerHours;

  // Трафик — крупнейшая переменная статья, и она растёт вместе с лояльностью
  const encodingSaving = 0.35 * compression * (0.4 + 0.6 * quality);
  const cdnPerHour = CONFIG.cdnCostPerHour * (decisions.bitrate / CONFIG.refBitrate)
    * (1 - 0.30 * techLevel(state)) * (1 - encodingSaving)
    * (mods.cdnMult ?? 1) * (crisisMods.cdnMult ?? 1);
  const cdnCost = hours * cdnPerHour;

  const retailSubs = retailSubsNow;
  const totalSubs = retailSubs + partnerSubs;
  const premiumSubs = perSegment.reduce((s, p) => s + p.seg.premium, 0);
  const adSubs = perSegment.reduce((s, p) => s + p.seg.ads, 0);
  const supportCost = totalSubs * CONFIG.supportCostPerSub;

  // --- 12. Выручка ---
  // Выручка считается по тому, что база реально платит, а не по прайсу.
  // Годовые деньги пришли в кассу разом при подписке и здесь не повторяются.
  let subscriptionRevenue = 0;
  for (const p of perSegment) {
    const annual = annualSubs(p.pricing);
    const monthlyPremium = Math.max(0, p.seg.premium - annual);
    subscriptionRevenue += monthlyPremium * p.pricing.lockedPrice + p.seg.ads * decisions.priceAds;
  }
  subscriptionRevenue += partnerRev;
  const listRevenue = premiumSubs * decisions.priceNew + adSubs * decisions.priceAds;
  // Адаптивная реклама даёт больше показов при том же среднем раздражении
  const adYield = 1 + 0.25 * adSpread * quality;
  const impressions = adHours * decisions.adLoad * 2 * adYield;   // ролик — 30 секунд
  const adRevenue = (impressions / 1000) * CONFIG.cpm;
  const revenue = subscriptionRevenue + adRevenue;

  const variableCost = cdnCost + supportCost + winbackCost;
  const contribution = revenue - variableCost;

  const contentSpend = contentBudget.licensing + productionSpend;
  const marketingSpend = decisions.brandMarketing + campaignSpend;
  const fixed = CONFIG.hqMonthly + contentSpend + slotCost
    + marketingSpend + decisions.tech + decisions.rnd;
  const oneOff = installCost + (mods.oneOffCost ?? 0) + (crisisMods.oneOffCost ?? 0)
    + crisisCost + partnerFees;
  const profit = contribution - fixed;

  // Годовая предоплата — это касса сегодня и выручка, растянутая на год.
  // В P&L она не попадает: иначе один и тот же рубль был бы учтён дважды.
  state.cash += profit - oneOff + annualCash;
  if (raiseApplied) state.lastRaiseMonth = month;
  state.techStock += decisions.tech;
  state.rndStock += decisions.rnd;
  state.dataStock += hours;

  // --- 13. Метрики ---
  const arpu = totalSubs > 0 ? revenue / totalSubs : 0;
  const cmPerSub = totalSubs > 0 ? contribution / totalSubs : 0;
  const hoursPerSub = totalSubs > 0 ? hours / totalSubs : 0;
  // Отток считается по собственной базе. Оптовые подписчики живут по условиям
  // контракта, и подмешивать их сюда — значит рисовать удержание лучше, чем оно
  // есть: чем больше партнёрская база, тем сильнее занижался бы отток розницы.
  const avgChurn = retailSubs > 0
    ? perSegment.reduce((s, p) => s + p.churnRate * p.subs, 0) / retailSubs
    : CONFIG.baseChurn;
  const cac = newSubs > 0 ? marketingSpend / newSubs : 0;
  const ltv = cmPerSub / Math.max(0.005, avgChurn);
  const marketShare = totalSubs / marketPotential;
  const rivalTotal = rivalSubs(riv);
  const duopolyShare = totalSubs + rivalTotal > 0 ? totalSubs / (totalSubs + rivalTotal) : 0;

  // Средние по сегментам взвешиваются по розничной базе: веса должны давать
  // единицу. С весами по общей базе (вместе с оптом) любое среднее ползло бы
  // к 1.0 просто оттого, что подписан крупный контракт.
  const wGeo = (key) => {
    if (!perSegment.length || retailSubs <= 0) return 1;
    let acc = 0;
    for (const p of perSegment) acc += Math.log(Math.max(1e-6, p[key])) * (p.subs / retailSubs);
    return Math.exp(acc);
  };

  // --- 14. Совет директоров ---
  if (profit > 0) state.board.profitableMonths += 1;
  const boardCtx = { subs: totalSubs, rivalSubs: rivalTotal, profitableMonths: state.board.profitableMonths };
  let goalOutcome = null;
  const progress = goalProgress(state.board.goal, boardCtx);

  if (state.board.goal && month % CONFIG.boardYearMonths === 0) {
    goalOutcome = applyGoalOutcome(state, state.board.goal, progress, month);
    state.board.history.push(goalOutcome);
    state.board.profitableMonths = 0;
    const nextYear = state.board.goal.year + 1;
    state.board.goal = month < CONFIG.monthsTotal
      ? makeGoal(nextYear, state, totalSubs, rivalTotal)
      : null;
  }

  // Провал первого года: совет вводит деньги сам, на своих условиях
  let forcedDilution = 0;
  let boardInjection = 0;
  if (state.pendingDilution) {
    forcedDilution = state.pendingDilution;
    boardInjection = 1_500_000_000;
    state.equity *= (1 - forcedDilution);
    state.cash += boardInjection;
    state.raisedTotal += boardInjection;
    state.pendingDilution = 0;
  }

  // --- 15. Кризисы ---
  if (state.crisis) state.crisis.months += 1;
  const newCrisis = rollCrisis(rng, month, {
    subs: totalSubs, active: Boolean(state.crisis), lastResolved: state.lastCrisisResolved ?? -99,
  });
  if (newCrisis) state.crisis = newCrisis;

  // --- 15a. Новое предложение о партнёрстве ---
  if (!state.partnerOffer) {
    state.partnerOffer = rollPartnerOffer(rng, month + 1, state.partners);
  }

  const report = {
    month,
    season: seasonOf(month),
    subs: totalSubs,
    premiumSubs,
    adSubs,
    newSubs,
    lostSubs,
    switchedIn,
    switchedOut,
    netSwitch: switchedIn - switchedOut,
    trials: trialsTotal,
    churnRate: avgChurn,

    hours,
    adHours,
    retailHours,
    partnerHours,
    hoursPerSub,
    // Часы на одного розничного подписчика: по ним считается юнит-экономика.
    // Общий hoursPerSub смешивает розницу с оптом, у которого своя норма просмотра.
    retailHoursPerSub: retailSubs > 0 ? retailHours / retailSubs : CONFIG.baseHoursPerSub,
    catalogHours,
    catalogLicensed: state.catalogLicensed,
    catalogOriginal: state.catalogOriginal,
    originalsByGenre: { ...state.originalsByGenre },
    licensedFrozen: freeze,
    freshHours: state.freshHours,
    depth,
    perceivedDepth,
    freshness,

    revenue,
    subscriptionRevenue,
    adRevenue,
    arpu,
    cdnCost,
    cdnPerHour,
    supportCost,
    winbackCost,
    variableCost,
    contribution,
    cmPerSub,
    fixed,
    contentSpend,
    contentCapped: capApplied ? cap : null,
    oneOff,
    installCost,
    crisisCost,
    installedNow,
    profit,
    cash: state.cash,

    // --- Конкурент ---
    rival: rivalType,
    rivalNext: rivalNextType,
    rivalAcquisition: rival.acquisitionMult,
    rivalChurnAdd: rival.churnAdd,
    rivalSubs: rivalTotal,
    rivalSubsDelta: rivalTotal - rivalBefore,
    rivalPrice: riv.price,
    rivalAdLoad: riv.adLoad,
    rivalStance: riv.stance,
    rivalFocus: riv.focus,
    rivalAlive: riv.alive,
    rivalCash: riv.cash,
    rivalRaised: riv.raises,
    rivalCatalog: riv.catalogLicensed + riv.catalogOriginal,
    rivalOriginals: riv.catalogOriginal,
    rivalJustRaised: Boolean(riv.justRaised),
    duopolyShare,
    seasonHours: season,

    // --- Дорожающие ресурсы ---
    licenseIndex,
    talentIndex,
    // Прайс-лист производства при текущей цене таланта: игрок должен видеть,
    // во сколько ему обойдётся каждый вариант, до того как нажмёт кнопку.
    projectPrices: Object.fromEntries(GENRES.map((g) => [g.id,
      Object.fromEntries(SCALES.map((sc) => [sc.id, projectPrice(g.id, sc.id, talentIndex)]))])),

    buzz,
    heldBuzz,
    hangover,
    originalShare,
    effectiveCatalog,
    premieres,
    started,
    slots,
    slotsUsed: producing.length,
    slotCost,
    productionSpend,
    campaignSpend,
    marketingSpend,
    rejected,
    finished: finished.map((p) => ({ id: p.id, genre: p.genre, scale: p.scale })),
    vault: vault.map((p) => ({
      id: p.id, genre: p.genre, scale: p.scale, segment: p.segment,
      quality: p.quality, held: p.monthsHeld, hours: p.hours,
    })),
    producing: producing.map((p) => ({
      id: p.id, genre: p.genre, scale: p.scale, segment: p.segment,
      monthsLeft: p.monthsLeft, monthsTotal: p.monthsTotal,
    })),

    // --- Цена ---
    listRevenue,
    // Разрыв между прайсом и тем, что реально платит база без рекламы.
    // Он копится незаметно с каждым повышением прайса и закрывается больно.
    lockedPrice: premiumSubs > 0
      ? perSegment.reduce((s, p) => s + p.pricing.lockedPrice * p.seg.premium, 0) / premiumSubs
      : decisions.priceNew,
    // Разрыв бывает и отрицательным: после снижения прайса база какое-то время
    // платит больше нового ценника. Обрезать его нулём — значит скрывать
    // ровно тот случай, когда деньги теряются на ровном месте.
    priceGap: premiumSubs > 0
      ? clamp(1 - (perSegment.reduce((s, p) => s + p.pricing.lockedPrice * p.seg.premium, 0)
        / premiumSubs) / Math.max(1, decisions.priceNew), -1, 1)
      : 0,
    raiseApplied,
    raiseLost,
    annualCash,
    annualNew,
    annualExpired,
    annualSubs: perSegment.reduce((s, p) => s + annualSubs(p.pricing), 0),

    // --- Партнёрства ---
    retailSubs,
    partnerSubs,
    partnerShare: totalSubs > 0 ? partnerSubs / totalSubs : 0,
    partnerRevenue: partnerRev,
    partnerInflow: partnerInflowTotal,
    partnerLost,
    partnerFees,
    partnerExpired,
    partnerDeals: state.partners.map((d) => ({
      id: d.id, monthsLeft: d.monthsLeft, subs: d.subs,
    })),
    partnerOffer: state.partnerOffer,
    // Средняя выручка с оптового подписчика против розничного: главное число
    // этой механики. Рост базы и рост выручки — не одно и то же.
    partnerArpu: partnerSubs > 0 ? partnerRev / partnerSubs : 0,
    retailArpu: retailSubs > 0 ? (revenue - partnerRev) / retailSubs : 0,

    cac,
    ltv,
    ltvCac: cac > 0 ? ltv / cac : null,
    marketShare,
    algoQuality: quality,
    dataLevel: dataLevel(state),
    rndLevel: rndLevel(state),
    techLevel: techLevel(state),
    algoActive: Object.fromEntries(ALGORITHMS.map((a) => [a.key, Boolean(decisions.algoOn?.[a.key] && state.installed[a.key])])),

    avgPriceFactor: wGeo('priceFactor'),
    avgAppeal: wGeo('appeal'),
    avgAdPenalty: wGeo('adPenalty'),
    avgPreference: wGeo('preference'),
    avgAwareness: wGeo('awareness'),

    // --- Совет и кризисы ---
    goal: state.board.goal ? { ...state.board.goal } : null,
    goalProgress: progress,
    goalOutcome,
    forcedDilution,
    boardInjection,
    restrictions: state.restrictions && month < state.restrictions.until
      ? { ...state.restrictions } : null,
    crisis: state.crisis ? { ...state.crisis } : null,
    crisisResolved,

    event: event ? { id: event.id, choice } : null,
    segments: perSegment.map((p) => ({
      id: p.def.id,
      subs: p.subs,
      premium: p.seg.premium,
      ads: p.seg.ads,
      adShare: p.adShare,
      penetration: p.subs / p.def.potential,
      awareness: p.seg.awareness,
      churnRate: p.churnRate,
      hours: p.hours,
      priceFactor: p.priceFactor,
      appeal: p.appeal,
      adPenalty: p.adPenalty,
      preference: p.preference,
      flow: p.flow,
      rivalSubs: p.rivalSubs,
      lockedPrice: p.pricing.lockedPrice,
      annual: annualSubs(p.pricing),
      arpu: p.subs > 0
        ? (p.seg.premium * p.pricing.lockedPrice + p.seg.ads * decisions.priceAds
           + (p.adHours * decisions.adLoad * 2 * adYield / 1000) * CONFIG.cpm) / p.subs
        : 0,
    })),
    decisions: structuredClone(decisions),
  };

  // --- 16. Завершение месяца ---
  state.month = month;
  state.lastSnapshot = snapshot;
  state.history.push(report);
  state.pendingChoice = null;
  state.pendingEvent = rollEvent(rng, month + 1, state.flags);
  state.rngState = rng.state();

  if (state.cash < 0) state.over = 'bankrupt';
  else if (month >= CONFIG.monthsTotal) state.over = 'finished';

  report.valuation = valuation(state);
  report.equityValue = report.valuation * state.equity;

  return { state, report };
}

// ----------------------------------------------------------------------------
// Экономика одного подписчика — считается мгновенно, до расчёта месяца
// ----------------------------------------------------------------------------
export function unitEconomics(state, decisions) {
  // Считается по рознице: у оптового подписчика своя цена, своя норма просмотра
  // и своя доля рекламы. Со счётом по общей базе крупный контракт «улучшал»
  // юнит-экономику розницы, ничего в ней не меняя.
  const last = state.history[state.history.length - 1];
  const hoursPerSub = last ? (last.retailHoursPerSub ?? last.hoursPerSub) : CONFIG.baseHoursPerSub;
  const retail = last ? (last.retailSubs ?? last.subs) : 0;
  const adShare = last && retail > 0 ? clamp(last.adSubs / retail, 0, 1) : 0.35;

  const subscription = decisions.priceNew * (1 - adShare) + decisions.priceAds * adShare;
  const impressions = hoursPerSub * adShare * decisions.adLoad * 2;
  const advertising = (impressions / 1000) * CONFIG.cpm;
  const revenue = subscription + advertising;

  const cdnPerHour = CONFIG.cdnCostPerHour * (decisions.bitrate / CONFIG.refBitrate)
    * (1 - 0.30 * techLevel(state));
  const cdn = hoursPerSub * cdnPerHour;
  const support = CONFIG.supportCostPerSub;
  const variable = cdn + support;

  return {
    subscription, advertising, revenue,
    cdn, cdnPerHour, bandwidth: cdn, support, variable,
    contribution: revenue - variable,
    adShare, hoursPerSub,
  };
}

// ----------------------------------------------------------------------------
// Контрфактический разбор: что дал каждый включённый алгоритм
// ----------------------------------------------------------------------------
export function algorithmImpact(state) {
  const snap = state.lastSnapshot;
  const actual = state.history[state.history.length - 1];
  if (!snap || !actual) return [];

  const out = [];
  for (const a of ALGORITHMS) {
    if (!actual.algoActive?.[a.key]) continue;
    const decisions = structuredClone(actual.decisions);
    decisions.algoOn = { ...decisions.algoOn, [a.key]: false };
    let alt;
    try {
      alt = step(snap, { decisions, eventChoice: actual.event?.choice ?? 0 }).report;
    } catch { continue; }
    if (!alt) continue;
    out.push({
      key: a.key,
      profit: actual.profit - alt.profit,
      subs: actual.subs - alt.subs,
      hours: actual.hours - alt.hours,
      churnRate: actual.churnRate - alt.churnRate,
    });
  }
  return out.sort((x, y) => y.profit - x.profit);
}

// ----------------------------------------------------------------------------
// Оценка компании и раунды
// ----------------------------------------------------------------------------
export function valuation(state) {
  const h = state.history;
  if (!h.length) return 300_000_000;
  const last = h[h.length - 1];
  const runRate = last.revenue * 12;

  const tail = h.slice(-3).reduce((s, r) => s + r.subs, 0);
  const prev = h.slice(-6, -3).reduce((s, r) => s + r.subs, 0);
  const growth = prev > 0 ? tail / prev : (tail > 0 ? 1.4 : 1);
  const growthScore = clamp(growth - 1, 0, 1);

  const margin = last.revenue > 0 ? last.profit / last.revenue : -0.5;
  const marginScore = clamp(margin, -0.4, 0.25) / 0.25;

  // Собственная библиотека — актив, лицензии — аренда. Рынок это видит.
  // Час реалити при этом стоит заметно меньше часа драмы: библиотека —
  // это то, что ещё будут смотреть через два года.
  const libraryValue = weightedOriginals(state.originalsByGenre ?? {})
    * CONFIG.originalCostPerHour * 0.28;

  // Позиция против конкурента. В дуополии рынок платит не за выручку саму
  // по себе, а за то, кто из двоих будет диктовать цену через три года.
  // Проигравший стоит дёшево даже с хорошей маржой — именно поэтому
  // «снимать сливки, не вкладываясь» здесь не работает.
  const positionBonus = clamp(0.70 + 0.60 * (last.duopolyShare ?? 0.5), 0.70, 1.30);

  const multiple = clamp(2.2 + 6 * growthScore + 2.5 * Math.max(0, marginScore) + 1.5 * Math.min(0, marginScore), 0.5, 12);
  const base = (runRate * multiple + libraryValue) * positionBonus;
  const bonus = 1 + clamp(state.flags.valuationBonus, -0.4, 0.6);
  return Math.max(300_000_000, base * bonus);
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
// Разбор месяца: раскладываем изменение числа подписчиков на факторы
// ----------------------------------------------------------------------------
// Разложение — это баланс запаса, а не набор «влияний». База меняется ровно
// на пять потоков, и они обязаны сложиться в ту же цифру, что стоит в заголовке.
// Раньше здесь сравнивались множители спроса: знаки не совпадали с движением
// базы, а суммы не совпадали ни с чем — растущий месяц выглядел красным.
export function explain(prev, cur) {
  if (!cur) return [];
  const base = prev ? prev.subs : 0;
  if (base <= 0) return [];
  const partnerNet = (cur.partnerInflow ?? 0) - (cur.partnerLost ?? 0);
  const parts = [
    ['flowNew', cur.newSubs],
    ['flowChurn', -cur.lostSubs],
    ['flowSwitch', cur.netSwitch],
    ['flowPartners', partnerNet],
    ['flowRaise', -(cur.raiseLost ?? 0)],
  ];
  return parts
    .map(([key, people]) => ({ key, people, effect: people / base }))
    .filter((p) => Math.abs(p.effect) > 0.0005)
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
}

// Почему приток и отток оказались такими: изменение условий месяц к месяцу.
// Здесь знак читается одинаково у всех строк — вверх значит «в вашу пользу».
export function explainFactors(prev, cur) {
  if (!prev || !cur) return [];
  const parts = [
    ['factorPrice', prev.avgPriceFactor, cur.avgPriceFactor],
    ['factorCatalog', prev.avgAppeal, cur.avgAppeal],
    ['factorAds', prev.avgAdPenalty, cur.avgAdPenalty],
    ['factorStanding', prev.avgPreference, cur.avgPreference],
    ['factorAwareness', prev.avgAwareness, cur.avgAwareness],
    ['factorRetention', 1 - prev.churnRate, 1 - cur.churnRate],
  ];
  return parts
    .map(([key, a, b]) => ({
      key,
      effect: a > 0 && b > 0 ? b / a - 1 : 0,
    }))
    .filter((p) => Math.abs(p.effect) > 0.005)
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
}

export function finalScore(state) {
  const v = valuation(state);
  const last = state.history[state.history.length - 1];
  return {
    valuation: v,
    equity: state.equity,
    equityValue: v * state.equity,
    raised: state.raisedTotal,
    cash: state.cash,
    months: state.month,
    bankrupt: state.over === 'bankrupt',
    duopolyShare: last?.duopolyShare ?? 0,
    rivalAlive: state.rivalState?.alive ?? true,
    goals: state.board?.history ?? [],
  };
}

export { STANCES, rivalSubs };
