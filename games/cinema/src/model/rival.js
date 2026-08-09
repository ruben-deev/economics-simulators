// ============================================================================
// Живой конкурент.
//
// Раньше афиша конкурента разыгрывалась случайно, и он был константой
// в формуле. Из-за этого у игры существовала фиксированная оптимальная
// политика: среда не менялась, значит и решение не должно было меняться.
//
// Теперь у конкурента есть собственное состояние — касса, каталог, база
// подписчиков — и политика, которая читает ваши решения и отвечает на них.
// Рынок один на двоих: сумма ваших и его подписчиков ограничена ёмкостью
// сегментов, а часть базы каждый месяц перетекает от слабого к сильному.
//
// Следствие: оптимальной постоянной стратегии больше не существует. Ответ
// на вопрос «поднимать ли цену» зависит от того, что конкурент делает
// сейчас и что он может себе позволить дальше.
// ============================================================================

import { CONFIG, SEGMENTS, GENRES, clamp, genreById } from './config.js';

const genreOr = (id) => genreById(id) ?? GENRES[0];

// Позиции конкурента. Игрок видит их как понятные слова, а не как числа:
// смысл в том, чтобы можно было предсказать следующий ход.
export const STANCES = {
  //         цена к вашей   бюджет   агрессия маркетинга
  build:   { priceRatio: 0.95, budget: 1.00, marketing: 1.00 }, // ровный рост
  war:     { priceRatio: 0.72, budget: 1.45, marketing: 1.60 }, // демпинг и трата кассы
  press:   { priceRatio: 1.06, budget: 1.15, marketing: 1.15 }, // давит, пока выигрывает
  harvest: { priceRatio: 1.18, budget: 0.55, marketing: 0.40 }, // снимает сливки, экономит
  retreat: { priceRatio: 1.10, budget: 0.30, marketing: 0.15 }, // выживает на остатках
};

export function createRival(rng) {
  return {
    alive: true,
    cash: 5_200_000_000,
    raises: 0,
    maxRaises: 2,
    price: 449,
    adLoad: 5,
    stance: 'build',
    stanceMonths: 0,
    focus: 'blockbuster',
    catalogLicensed: 2_200,
    catalogOriginal: 0,
    freshHours: 220,
    pipeline: [],
    studioFund: 0,
    lastBuzz: 0,
    awareness: 0.30,
    spend: { licensing: 90_000_000, originals: 90_000_000, marketing: 70_000_000 },
    // Конкурент стартует с уже набранной базой: вы выходите на занятый рынок
    segments: Object.fromEntries(SEGMENTS.map((s) => [s.id, s.potential * 0.07])),
    // Что он анонсировал на следующий месяц (игроку это видно заранее)
    announced: null,
    exitMonthsLeft: 0,   // после банкротства база расходится не мгновенно
  };
}

export function rivalSubs(rival) {
  return Object.values(rival.segments).reduce((s, v) => s + v, 0);
}

// ----------------------------------------------------------------------------
// Выбор позиции. Читается как логика живого менеджмента, а не как рулетка.
// ----------------------------------------------------------------------------
export const STANCE_MIN_MONTHS = 4;

export function chooseStance(rival, yourSubs, month) {
  const mine = rivalSubs(rival);
  const total = mine + yourSubs;
  const myShare = total > 0 ? mine / total : 0.5;
  const runwayMonths = rival.cash / Math.max(1, monthlyBurn(rival));

  if (!rival.alive) return 'retreat';
  // Деньги кончаются — не до войны, и это сильнее любого гистерезиса
  if (runwayMonths < 6 && rival.raises >= rival.maxRaises) return 'retreat';
  if (runwayMonths < 10) return 'harvest';

  // Позиция держится минимум несколько месяцев. Конкурент, меняющий стратегию
  // каждый месяц, — это шум; конкурент, который держит курс, — это противник,
  // к которому можно готовиться. Второе и интереснее, и правдоподобнее.
  if (rival.stanceMonths < STANCE_MIN_MONTHS && STANCES[rival.stance]) return rival.stance;

  if (myShare < 0.34 && month >= 6) return 'war';
  if (myShare < 0.46) return 'build';
  if (myShare > 0.66) return 'press';
  return 'build';
}

function monthlyBurn(rival) {
  return rival.spend.licensing + rival.spend.originals + rival.spend.marketing + 20_000_000;
}

// В какой жанр он идёт: туда, где вы сильнее всего. Контр-вход — самый
// частый ответ на чужой эксклюзив: если у вас работает драма, он снимает драму.
export function chooseFocus(rival, yourOriginalsByGenre) {
  const entries = Object.entries(yourOriginalsByGenre ?? {});
  if (!entries.length) return rival.focus;
  const [best] = entries.sort((a, b) => b[1] - a[1]);
  // Пока у вас ничего нет, он делает то, что дешевле в пересчёте на шум
  if (!best || best[1] <= 0) return 'blockbuster';
  return best[0];
}

// ----------------------------------------------------------------------------
// Ход конкурента. Вызывается до расчёта рынка: игрок видит последствия
// решений конкурента в том же месяце, что и своих.
// ----------------------------------------------------------------------------
export function stepRival(rival, ctx, rng) {
  const { yourPrice, yourSubs, yourOriginalsByGenre, month, licenseIndex, seasonMult } = ctx;

  if (!rival.alive) {
    // База обанкротившегося конкурента расходится по рынку несколько месяцев
    rival.exitMonthsLeft = Math.max(0, rival.exitMonthsLeft - 1);
    const drain = rival.exitMonthsLeft > 0 ? 0.34 : 1;
    for (const s of SEGMENTS) rival.segments[s.id] *= (1 - drain);
    rival.premieres = [];
    rival.buzz = 0;
    return rival;
  }

  const stance = chooseStance(rival, yourSubs, month);
  rival.stanceMonths = stance === rival.stance ? rival.stanceMonths + 1 : 0;
  rival.stance = stance;
  rival.stanceChangedIn = rival.stanceMonths === 0;
  const S = STANCES[stance];

  // --- Цена: движется к цели медленно, чтобы игрок успевал реагировать ---
  const targetPrice = clamp(yourPrice * S.priceRatio, 149, 899);
  rival.price = Math.round(clamp(
    rival.price + clamp(targetPrice - rival.price, -45, 45), 149, 899));
  rival.adLoad = clamp(stance === 'harvest' ? 9 : stance === 'war' ? 2 : 5, 0, 16);

  // --- Бюджеты: доля выручки плюс база, масштабированная позицией ---
  // Бюджет крупного игрока менее эластичен к выручке: согласования, легаси,
  // обязательства. Это и есть шанс маленького — он быстрее переставляет ноги.
  const revenue = rival.lastRevenue ?? 0;
  const base = 110_000_000 + revenue * 0.42;
  rival.spend = {
    licensing: Math.round(base * 0.5 * S.budget),
    originals: Math.round(base * 0.5 * S.budget),
    marketing: Math.round((55_000_000 + revenue * 0.26) * S.marketing),
  };

  // --- Раунд, если касса на исходе ---
  if (rival.cash < monthlyBurn(rival) * 4 && rival.raises < rival.maxRaises) {
    rival.cash += 3_000_000_000;
    rival.raises += 1;
    rival.justRaised = true;
  } else {
    rival.justRaised = false;
  }

  // --- Каталог ---
  // Тот же рубль даёт ему меньше часов: корпоративные накладные — реальная вещь
  const bought = rival.spend.licensing / (CONFIG.licenseCostPerHour * licenseIndex * 1.08);
  rival.catalogLicensed = rival.catalogLicensed * (1 - CONFIG.licenseDecay) + bought;

  rival.focus = chooseFocus(rival, yourOriginalsByGenre);
  const genre = genreOr(rival.focus);
  const projectCost = genre.hours * CONFIG.originalCostPerHour * genre.costPerHour;
  rival.studioFund += rival.spend.originals;
  const started = [];
  while (rival.studioFund >= projectCost && started.length < 3) {
    rival.studioFund -= projectCost;
    started.push({
      genre: genre.id,
      monthsLeft: CONFIG.originalLeadMonths,
      hours: genre.hours,
      quality: clamp(0.6 + 0.5 * rng(), 0.3, 1.3),
    });
  }
  rival.pipeline.push(...started);

  for (const p of rival.pipeline) p.monthsLeft -= 1;
  const premieres = rival.pipeline.filter((p) => p.monthsLeft <= 0);
  rival.pipeline = rival.pipeline.filter((p) => p.monthsLeft > 0);

  let fresh = 0;
  for (const p of premieres) {
    rival.catalogOriginal += p.hours;
    fresh += p.hours;
  }
  rival.freshHours = rival.freshHours * (1 - CONFIG.freshDecay)
    + fresh + bought * CONFIG.licenseFreshShare;

  rival.premieres = premieres.map((p) => ({
    genre: p.genre, hours: p.hours, quality: p.quality,
    buzz: genreOr(p.genre).buzz * p.quality,
  }));
  rival.buzz = rival.premieres.reduce((s, p) => s + p.buzz, 0);

  // --- Что он анонсирует на следующий месяц ---
  // Анонс честный: он выпустит именно то, что доедет до премьеры.
  const next = rival.pipeline.filter((p) => p.monthsLeft <= 1);
  rival.announced = next.length
    ? { buzz: next.reduce((s, p) => s + genreOr(p.genre).buzz * p.quality, 0), genre: next[0].genre }
    : null;

  // --- Узнаваемость и деньги ---
  rival.awareness = clamp(
    rival.awareness
    + (1 - rival.awareness) * clamp(rival.spend.marketing / 1_400_000_000, 0, 0.14)
    - rival.awareness * CONFIG.awarenessDecay
    + rival.buzz * 0.015,
    0.02, 0.9);

  const subs = rivalSubs(rival);
  const rivalRevenue = subs * (rival.price * 0.55 + rival.price * 0.37 * 0.45)
    + subs * 22 * seasonMult * rival.adLoad * 2 / 1000 * CONFIG.cpm * 0.45;
  const rivalCosts = monthlyBurn(rival) + subs * 22 * seasonMult * CONFIG.cdnCostPerHour * 0.9;
  rival.lastRevenue = rivalRevenue;
  rival.cash += rivalRevenue - rivalCosts;

  if (rival.cash < 0 && rival.raises >= rival.maxRaises) {
    rival.alive = false;
    rival.exitMonthsLeft = 3;
    rival.stance = 'retreat';
  }
  return rival;
}

// ----------------------------------------------------------------------------
// Сравнение двух сервисов глазами одного сегмента.
// Возвращает долю «голосов» за вас: 0.5 — паритет.
// ----------------------------------------------------------------------------
export function segmentPreference(seg, you, rivalSide) {
  const pull = (side) => Math.max(1e-6,
    Math.pow(side.priceFactor, 0.9)
    * Math.pow(Math.max(0.05, side.appeal), 1.0)
    * side.adPenalty
    * Math.pow(Math.max(0.05, side.awareness), 0.35)
    // Эксклюзив — единственное, что конкурент не может купить теми же деньгами.
    // Лицензия лежит на обеих полках; своё — только на вашей.
    * (1 + CONFIG.exclusivePull * (side.exclusive ?? 0))
    * (1 + side.buzz * CONFIG.switchPremiereBoost));

  const a = Math.pow(pull(you), CONFIG.competeSharpness);
  const b = Math.pow(pull(rivalSide), CONFIG.competeSharpness);
  return a / (a + b);
}

/**
 * Переток базы между сервисами за месяц.
 * Возвращает «сколько человек этого сегмента перешло к вам» (может быть < 0).
 *
 * Лояльные сегменты переходят неохотно даже при явном перевесе — привычка
 * сильнее арифметики.
 */
export function switchFlow(segDef, preference, yourSegSubs, rivalSegSubs) {
  const advantage = (preference - 0.5) * 2;               // ∈ [−1, 1]
  // loyalty здесь — множитель оттока: чем он выше, тем легче человек снимается
  // с места. Семьи почти не переходят, молодёжь уходит за первым же хайпом.
  const mobility = CONFIG.switchIntensity * segDef.loyalty;
  if (advantage >= 0) return rivalSegSubs * mobility * advantage;
  return -yourSegSubs * mobility * (-advantage);
}
