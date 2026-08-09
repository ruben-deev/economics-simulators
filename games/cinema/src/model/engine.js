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
//                                         │                   │
//                    цена, реклама, каталог -> отток           ▼
//                                                        часы просмотра
//                                                             │
//                                        выручка (подписка + реклама)
//                                        минус трафик (растёт с часами!)
//                                                             │
//                                                        P&L -> касса
//
// Главная особенность жанра: чем больше зритель смотрит, тем он лояльнее —
// и тем дороже обходится. Трафик здесь единственная крупная переменная
// статья, и она растёт вместе с любовью аудитории к сервису.
// ============================================================================

import { CONFIG, SEGMENTS, GENRES, ALGORITHMS, DEFAULT_DECISIONS } from './config.js';
import { createRng } from '../../../../shared/rng.js';
import { neutralModifiers, applyEvent, rollEvent } from './events.js';
import { rollRivalRelease, rivalEffect, seasonHours, seasonOf } from './market.js';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function segmentById(id) {
  return SEGMENTS.find((s) => s.id === id);
}

export function genreById(id) {
  return GENRES.find((g) => g.id === id);
}

// Во сколько обходится один проект выбранного жанра
export function projectCost(genre) {
  return genre.hours * CONFIG.originalCostPerHour * genre.costPerHour;
}

// ----------------------------------------------------------------------------
// Начальное состояние
// ----------------------------------------------------------------------------
export function createInitialState(seed = 'kinopotok') {
  const rng = createRng(seed);
  const rival = rollRivalRelease(rng, 1);
  const rivalNext = rollRivalRelease(rng, 2);
  return {
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
    freshHours: 0,         // «новинки»: стареют каждый месяц
    studioFund: 0,         // деньги, накопленные на текущий проект
    pipeline: [],          // проекты в производстве
    lastBuzz: 0,           // остаточный шум прошлой премьеры (для календаря релизов)
    hangover: 0,           // сколько зрителей досмотрели премьеру и готовы уйти
    segments: Object.fromEntries(SEGMENTS.map((s) => [s.id, {
      id: s.id,
      awareness: 0.03,
      premium: 0,
      ads: 0,
    }])),
    rival,
    rivalNext,
    decisions: structuredClone(DEFAULT_DECISIONS),
    flags: { valuationBonus: 0 },
    pendingEvent: null,
    pendingChoice: null,
    history: [],
    lastSnapshot: null,
    over: null,
  };
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

  // --- 1. Событие месяца ---
  const mods = neutralModifiers();
  const event = state.pendingEvent;
  const choice = input.eventChoice ?? state.pendingChoice ?? 0;
  applyEvent(mods, event, choice);
  if (mods.valuationBonus) state.flags.valuationBonus += mods.valuationBonus;

  // --- 2. Алгоритмы: доступность, внедрение, настройки ---
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

  // --- 3. Производство: копилка, старт проектов, премьеры ---
  const genre = genreById(decisions.genre) ?? GENRES[0];
  state.studioFund += decisions.originals;
  const started = [];
  // Копилка может дать сразу несколько проектов, если бюджет большой
  while (state.studioFund >= projectCost(genre)) {
    state.studioFund -= projectCost(genre);
    // Качество зависит от команды, технологий и удачи: кино — рискованный бизнес
    const luck = rng();
    const projectQuality = clamp(0.55 + 0.5 * luck + 0.25 * techLevel(state), 0.25, 1.45);
    state.pipeline.push({
      genre: genre.id,
      monthsLeft: CONFIG.originalLeadMonths,
      hours: genre.hours,
      quality: projectQuality,
    });
    started.push({ genre: genre.id, quality: projectQuality });
  }

  const premieres = [];
  for (const project of state.pipeline) project.monthsLeft -= 1;
  for (const project of state.pipeline.filter((p) => p.monthsLeft <= 0)) {
    const g = genreById(project.genre);
    state.catalogOriginal += project.hours;
    state.freshHours += project.hours;
    premieres.push({ genre: project.genre, quality: project.quality, hours: project.hours, buzz: g.buzz * project.quality });
  }
  state.pipeline = state.pipeline.filter((p) => p.monthsLeft > 0);

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

  // --- 4. Каталог ---
  // Прогноз спроса делает тот же бюджет эффективнее, но тянет закупку
  // к уже известному: глубина растёт медленнее, чем просмотры.
  const licensingEfficiency = 1 + 0.45 * forecastTrust * quality;
  const boughtHours = (decisions.licensing / CONFIG.licenseCostPerHour) * licensingEfficiency;
  state.catalogLicensed = state.catalogLicensed * (1 - CONFIG.licenseDecay) + boughtHours;
  // Лицензии почти не считаются новинками: это чужое и часто не первой свежести.
  // Ощущение «тут появилось что-то новое» создают премьеры собственных проектов.
  state.freshHours = state.freshHours * (1 - CONFIG.freshDecay) + boughtHours * CONFIG.licenseFreshShare;

  const catalogHours = state.catalogLicensed + state.catalogOriginal;
  // Чужой каталог хуже удерживает: он есть и у конкурентов
  const weightedLicensed = state.catalogLicensed * CONFIG.licenseDepthWeight;
  const weightedOriginal = state.catalogOriginal * CONFIG.originalDepthWeight;
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

  // --- 5. Внешний фон ---
  const rivalType = state.rival ?? 'none';
  const rival = rivalEffect(rivalType, buzz);
  const season = seasonHours(month);

  // --- 6. Подписчики по сегментам ---
  const refPrice = 399;
  let newSubs = 0;
  let lostSubs = 0;
  let trialsTotal = 0;
  let winbackCost = 0;
  const perSegment = [];

  for (const def of SEGMENTS) {
    const seg = state.segments[def.id];

    // Выбор тарифа: чем больше экономия и чем терпимее сегмент к рекламе,
    // тем охотнее он идёт на дешёвый тариф с рекламой.
    const saving = decisions.pricePremium > 0
      ? clamp((decisions.pricePremium - decisions.priceAds) / decisions.pricePremium, 0, 1) : 0;
    const adLoadPain = clamp((decisions.adLoad / CONFIG.refAdLoad) / Math.max(0.2, def.adTolerance), 0, 3);
    const adShare = clamp(0.12 + 0.85 * saving * def.adTolerance - 0.12 * adLoadPain, 0.02, 0.94);

    // Цена, которую сегмент фактически платит в среднем
    const blendedPrice = decisions.pricePremium * (1 - adShare) + decisions.priceAds * adShare;
    const priceFactor = clamp(Math.pow(refPrice / Math.max(30, blendedPrice), def.elasticity), 0.15, 2.6);

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

    // Премьера тянет к себе именно свой сегмент
    const premiereAppeal = premieres.reduce(
      (s, p) => s + p.buzz * (genreById(p.genre)?.appeal[def.id] ?? 1), 0);

    // Узнаваемость — накопительный запас
    const shareOfMarket = def.potential / SEGMENTS.reduce((s, x) => s + x.potential, 0);
    const spendPerViewer = (decisions.marketing * shareOfMarket) / def.potential;
    const gain = clamp(
      0.28 * Math.pow(spendPerViewer / CONFIG.refMarketingPerViewer, 0.55),
      0, CONFIG.awarenessMaxGain);
    seg.awareness = clamp(
      seg.awareness + (1 - seg.awareness) * gain - seg.awareness * CONFIG.awarenessDecay
      + (mods.awarenessAdd ?? 0) + premiereAppeal * 0.02,
      0, 1);

    // Пробные подписки → платящие
    const subs = seg.premium + seg.ads;
    const untapped = Math.max(0, def.potential - subs);
    const trialFactor = clamp(0.55 + 0.45 * (decisions.trialDays / CONFIG.refTrialDays), 0.5, 1.45);
    const trials = untapped * seg.awareness * 0.055 * priceFactor * appeal * adPenalty
      * rival.acquisitionMult * mods.demandMult * (1 + premiereAppeal * 0.6);
    const converted = trials * CONFIG.trialConversion * trialFactor;

    // Отток: скучный каталог, дорогая подписка, назойливая реклама, чужая премьера
    const boredom = Math.max(0, 1 - freshness) * def.freshnessWeight * 0.055;
    const priceAnger = Math.max(0, 1 - priceFactor) * 0.045;
    const adAnger = (1 - adPenalty) * 0.25;
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
      + rival.churnAdd + (mods.churnAdd ?? 0)
      + hangover * 0.018 * def.freshnessWeight
      - buzz * 0.030,
      0.005, 0.5);
    const savedShare = winbackPower * 0.45;
    churnRate = churnRate * (1 - savedShare);

    const leaving = subs * churnRate;
    // Скидку получают удержанные и часть тех, кто и так остался бы (промахи модели)
    const discounted = subs * churnRate * savedShare / Math.max(0.05, 1 - savedShare)
      + subs * (1 - quality) * winbackDiscount * 0.03;
    winbackCost += discounted * decisions.pricePremium * winbackDiscount;

    // Обновляем запасы по тарифам
    const survivors = subs - leaving;
    const survivorAdShare = subs > 0 ? seg.ads / subs : adShare;
    seg.ads = Math.max(0, survivors * survivorAdShare + converted * adShare);
    seg.premium = Math.max(0, survivors * (1 - survivorAdShare) + converted * (1 - adShare));

    newSubs += converted;
    lostSubs += leaving;
    trialsTotal += trials;

    perSegment.push({
      def, seg, adShare, blendedPrice, priceFactor, appeal, adPenalty,
      churnRate, converted, leaving, subs: seg.premium + seg.ads,
    });
  }

  // --- 7. Часы просмотра и трафик ---
  let hours = 0;
  let adHours = 0;
  for (const p of perSegment) {
    const segHours = p.subs * CONFIG.baseHoursPerSub * p.def.baseHours
      * season * Math.pow(Math.max(0.1, perceivedDepth), 0.35)
      * (1 + 0.22 * recoStrength * quality)
      * rival.hoursMult * (mods.hoursMult ?? 1);
    p.hours = segHours;
    p.adHours = segHours * (p.seg.ads / Math.max(1, p.subs));
    hours += segHours;
    adHours += p.adHours;
  }

  // Трафик — крупнейшая переменная статья, и она растёт вместе с лояльностью
  const encodingSaving = 0.35 * compression * (0.4 + 0.6 * quality);
  const cdnPerHour = CONFIG.cdnCostPerHour * (decisions.bitrate / CONFIG.refBitrate)
    * (1 - 0.30 * techLevel(state)) * (1 - encodingSaving) * (mods.cdnMult ?? 1);
  const cdnCost = hours * cdnPerHour;

  const totalSubs = perSegment.reduce((s, p) => s + p.subs, 0);
  const premiumSubs = perSegment.reduce((s, p) => s + p.seg.premium, 0);
  const adSubs = perSegment.reduce((s, p) => s + p.seg.ads, 0);
  const supportCost = totalSubs * CONFIG.supportCostPerSub;

  // --- 8. Выручка ---
  const subscriptionRevenue = premiumSubs * decisions.pricePremium + adSubs * decisions.priceAds;
  // Адаптивная реклама даёт больше показов при том же среднем раздражении
  const adYield = 1 + 0.25 * adSpread * quality;
  const impressions = adHours * decisions.adLoad * 2 * adYield;   // ролик — 30 секунд
  const adRevenue = (impressions / 1000) * CONFIG.cpm;
  const revenue = subscriptionRevenue + adRevenue;

  const variableCost = cdnCost + supportCost + winbackCost;
  const contribution = revenue - variableCost;

  const contentSpend = decisions.licensing + decisions.originals;
  const fixed = CONFIG.hqMonthly + decisions.licensing + decisions.originals
    + decisions.marketing + decisions.tech + decisions.rnd;
  const oneOff = installCost + (mods.oneOffCost ?? 0);
  const profit = contribution - fixed;

  state.cash += profit - oneOff;
  state.techStock += decisions.tech;
  state.rndStock += decisions.rnd;
  state.dataStock += hours;

  // --- 9. Метрики ---
  const arpu = totalSubs > 0 ? revenue / totalSubs : 0;
  const cmPerSub = totalSubs > 0 ? contribution / totalSubs : 0;
  const hoursPerSub = totalSubs > 0 ? hours / totalSubs : 0;
  const avgChurn = totalSubs > 0
    ? perSegment.reduce((s, p) => s + p.churnRate * p.subs, 0) / totalSubs
    : CONFIG.baseChurn;
  const cac = newSubs > 0 ? decisions.marketing / newSubs : 0;
  const ltv = cmPerSub / Math.max(0.005, avgChurn);
  const marketShare = totalSubs / SEGMENTS.reduce((s, x) => s + x.potential, 0);

  const wGeo = (key) => {
    if (!perSegment.length || totalSubs <= 0) return 1;
    let acc = 0;
    for (const p of perSegment) acc += Math.log(Math.max(1e-6, p[key])) * (p.subs / totalSubs);
    return Math.exp(acc);
  };

  const report = {
    month,
    season: seasonOf(month),
    subs: totalSubs,
    premiumSubs,
    adSubs,
    newSubs,
    lostSubs,
    trials: trialsTotal,
    churnRate: avgChurn,

    hours,
    adHours,
    hoursPerSub,
    catalogHours,
    catalogLicensed: state.catalogLicensed,
    catalogOriginal: state.catalogOriginal,
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
    oneOff,
    installCost,
    installedNow,
    profit,
    cash: state.cash,

    rival: rivalType,
    rivalNext: state.rivalNext ?? 'none',
    rivalAcquisition: rival.acquisitionMult,
    rivalChurnAdd: rival.churnAdd,
    seasonHours: season,

    buzz,
    heldBuzz,
    hangover,
    originalShare,
    effectiveCatalog,
    premieres,
    started,
    pipeline: state.pipeline.map((p) => ({ genre: p.genre, monthsLeft: p.monthsLeft, quality: p.quality })),
    studioFund: state.studioFund,
    projectCost: projectCost(genre),

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
      arpu: p.subs > 0
        ? (p.seg.premium * decisions.pricePremium + p.seg.ads * decisions.priceAds
           + (p.adHours * decisions.adLoad * 2 * adYield / 1000) * CONFIG.cpm) / p.subs
        : 0,
    })),
    decisions: structuredClone(decisions),
  };

  // --- 10. Завершение месяца ---
  state.month = month;
  state.lastSnapshot = snapshot;
  state.history.push(report);
  state.pendingChoice = null;
  state.pendingEvent = rollEvent(rng, month + 1, state.flags);
  state.rival = state.rivalNext ?? 'none';
  state.rivalNext = rollRivalRelease(rng, month + 2);
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
  const last = state.history[state.history.length - 1];
  const hoursPerSub = last ? last.hoursPerSub : CONFIG.baseHoursPerSub;
  const adShare = last && last.subs > 0 ? last.adSubs / last.subs : 0.35;

  const subscription = decisions.pricePremium * (1 - adShare) + decisions.priceAds * adShare;
  const impressions = hoursPerSub * adShare * decisions.adLoad * 2;
  const advertising = (impressions / 1000) * CONFIG.cpm;
  const revenue = subscription + advertising;

  const compression = decisions.algoOn?.encoding && state.installed?.encoding
    ? clamp(decisions.algoParam?.encoding ?? 0, 0, 1) : 0;
  const encodingSaving = 0.35 * compression * (0.4 + 0.6 * algoQuality(state));
  const cdnPerHour = CONFIG.cdnCostPerHour * (decisions.bitrate / CONFIG.refBitrate)
    * (1 - 0.30 * techLevel(state)) * (1 - encodingSaving);
  const cdn = hoursPerSub * cdnPerHour;
  const support = CONFIG.supportCostPerSub;

  return {
    hoursPerSub, adShare,
    subscription, advertising, revenue,
    cdn, support, cdnPerHour,
    variable: cdn + support,
    contribution: revenue - cdn - support,
  };
}

// ----------------------------------------------------------------------------
// Контрфактический разбор: сколько на самом деле принёс каждый алгоритм
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
  const libraryValue = state.catalogOriginal * CONFIG.originalCostPerHour * 0.35;

  const multiple = clamp(2.2 + 5 * growthScore + 4 * Math.max(0, marginScore) + 1.5 * Math.min(0, marginScore), 0.5, 12);
  const base = runRate * multiple + libraryValue;
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
export function explain(prev, cur) {
  if (!prev || !cur) return [];
  const parts = [
    ['driverPrice', prev.avgPriceFactor, cur.avgPriceFactor],
    ['driverCatalog', prev.avgAppeal, cur.avgAppeal],
    ['driverAds', prev.avgAdPenalty, cur.avgAdPenalty],
    ['driverRival', prev.rivalAcquisition, cur.rivalAcquisition],
    ['driverRetention', 1 - prev.churnRate, 1 - cur.churnRate],
    ['driverAwareness',
      Math.max(1e-6, prev.trials / Math.max(1, prev.subs)),
      Math.max(1e-6, cur.trials / Math.max(1, cur.subs))],
  ];
  return parts
    .map(([key, a, b]) => ({
      key,
      effect: a > 0 && b > 0 ? Math.exp(Math.log(b) - Math.log(a)) - 1 : 0,
    }))
    .filter((p) => Math.abs(p.effect) > 0.002)
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
}

export function finalScore(state) {
  const v = valuation(state);
  return {
    valuation: v,
    equity: state.equity,
    equityValue: v * state.equity,
    raised: state.raisedTotal,
    cash: state.cash,
    months: state.month,
    bankrupt: state.over === 'bankrupt',
  };
}
