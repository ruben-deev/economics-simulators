// ============================================================================
// Слейт: конкретные проекты вместо «бюджета на оригиналы».
//
// Раньше производство было ползунком: вы задавали сумму, и движок сам решал,
// сколько проектов запустить и когда их выпустить. Управлять там было нечем,
// и понять происходящее — тоже.
//
// Теперь проект — это объект. У него есть жанр, масштаб, сегмент, под который
// он снят, срок производства и качество. Он проходит три состояния:
//
//   в производстве ──► готов (лежит в запасе) ──► вышел
//
// Второй переход делает игрок. Готовый проект можно придержать: выпустить
// в тихий месяц, ответить им на чужую премьеру или дождаться высокого сезона.
// Держать не бесплатно — актуальность выветривается, и у реалити быстрее всех.
//
// Параллельно идёт столько проектов, сколько у студии слотов. Слот стоит денег
// каждый месяц независимо от того, занят он или пуст: это и есть настоящая
// себестоимость производственной мощности.
// ============================================================================

import { CONFIG, GENRES, SEGMENTS, clamp, genreById } from './config.js';

// Масштаб проекта. Пилот — дешёвая проба, флагман — долгая дорогая ставка.
export const SCALES = [
  {
    id: 'pilot',
    name: { ru: 'Пилот', en: 'Pilot' },
    months: 4,
    cost: 0.40,      // множитель к стоимости проекта
    hours: 0.5,      // множитель к часам
    buzz: 0.45,      // множитель к шуму премьеры
    hint: {
      ru: 'Быстро и дёшево. Мало часов и слабый всплеск, зато выходит через четыре месяца и почти ничем не рискует.',
      en: 'Fast and cheap. Few hours and a weak spike, but it lands in four months and risks almost nothing.',
    },
  },
  {
    id: 'season',
    name: { ru: 'Сезон', en: 'Season' },
    months: 6,
    cost: 1,
    hours: 1,
    buzz: 1,
    hint: {
      ru: 'Обычный сезон: полгода производства, предсказуемый результат. Рабочая лошадь конвейера.',
      en: 'A normal season: six months of production and a predictable result. The workhorse of the pipeline.',
    },
  },
  {
    id: 'flagship',
    name: { ru: 'Флагман', en: 'Flagship' },
    months: 9,
    cost: 2.6,
    hours: 1.8,
    buzz: 2.3,
    hint: {
      ru: 'Девять месяцев и в два с половиной раза дороже сезона. Шум огромный — но и провал будет виден всем, а деньги уже потрачены.',
      en: 'Nine months and two and a half times the cost of a season. The noise is enormous — but so is a flop, and the money is already spent.',
    },
  },
];

export const scaleById = (id) => SCALES.find((s) => s.id === id) ?? SCALES[1];

/** Полная стоимость проекта при текущей цене таланта. */
export function projectPrice(genreId, scaleId, talentIndex = 1) {
  const g = genreById(genreId) ?? GENRES[0];
  const sc = scaleById(scaleId);
  return Math.round(g.hours * CONFIG.originalCostPerHour * g.costPerHour * sc.cost * talentIndex);
}

/** Сколько месяцев проект едет до готовности. */
export const projectMonths = (scaleId) => scaleById(scaleId).months;

let nextId = 1;
export function resetProjectIds(value = 1) { nextId = value; }

/**
 * Запуск проекта в производство. Деньги списываются равными долями по месяцам —
 * так студия и работает: не одним платежом, а зарплатой съёмочной группы.
 */
export function commission(genreId, scaleId, segmentId, talentIndex, rng, techLevel = 0) {
  const sc = scaleById(scaleId);
  const g = genreById(genreId) ?? GENRES[0];
  const total = projectPrice(genreId, scaleId, talentIndex);
  // Качество определяется в момент запуска, но игроку до премьеры показывается
  // только оценка: продюсер знает бюджет и команду, а не результат.
  const luck = rng();
  const quality = clamp(0.55 + 0.5 * luck + 0.25 * techLevel, 0.25, 1.45);
  return {
    id: nextId++,
    genre: genreId,
    scale: scaleId,
    segment: segmentId ?? null,     // под какой сегмент снят
    monthsLeft: sc.months,
    monthsTotal: sc.months,
    monthsHeld: 0,
    hours: g.hours * sc.hours,
    quality,
    totalCost: total,
    monthlyCost: Math.round(total / sc.months),
    paid: 0,
    status: 'production',
  };
}

/**
 * Оценка качества, которую видит игрок до премьеры. Точное значение известно
 * только после выхода: до этого есть бюджет, команда и надежда.
 */
export function qualityEstimate(project) {
  if (project.status !== 'production') return { low: project.quality, high: project.quality, exact: true };
  // Чем ближе к премьере, тем уже вилка: материал уже виден
  const progress = 1 - project.monthsLeft / Math.max(1, project.monthsTotal);
  const spread = 0.45 * (1 - progress);
  return {
    low: clamp(project.quality - spread, 0.2, 1.5),
    high: clamp(project.quality + spread, 0.2, 1.5),
    exact: false,
  };
}

/**
 * Совместный с конкурентом мегапроект. Вы платите половину бюджета и
 * получаете весь контент — как и он: часы достаются обоим, поэтому
 * предпочтение зрителя не сдвигается. Растёт другое — сама категория.
 */
export function coProduce(genreId, talentIndex, conf) {
  const g = genreById(genreId) ?? GENRES[0];
  const total = projectPrice(genreId, conf.scale, talentIndex) * conf.costMult;
  return {
    id: nextId++,
    genre: genreId,
    scale: conf.scale,
    segment: null,                  // мегахит снимают не под сегмент
    joint: true,                    // метка совместного проекта
    monthsLeft: conf.months,
    monthsTotal: conf.months,
    monthsHeld: 0,
    hours: g.hours * scaleById(conf.scale).hours * conf.hoursMult,
    // Две команды и два бюджета: такие проекты не проваливаются — но и
    // сюрпризом не становятся, вся ставка здесь на размер, а не на удачу.
    quality: conf.qualityFloor,
    totalCost: total * conf.yourShare,
    monthlyCost: Math.round((total * conf.yourShare) / conf.months),
    paid: 0,
    status: 'production',
  };
}

/** Шум премьеры с учётом масштаба, качества и того, сколько проект пролежал. */
export function releaseBuzz(project) {
  const g = genreById(project.genre) ?? GENRES[0];
  const sc = scaleById(project.scale);
  const staleness = Math.pow(1 - CONFIG.vaultDecay, project.monthsHeld);
  return g.buzz * sc.buzz * project.quality * staleness;
}

/** Насколько проект бьёт в конкретный сегмент. */
export function projectAppeal(project, segmentId) {
  const g = genreById(project.genre) ?? GENRES[0];
  const base = g.appeal[segmentId] ?? 1;
  // Прицельно снятый под сегмент проект попадает в него точнее,
  // но остальным он интересен меньше: фокус — это всегда и отказ.
  if (!project.segment) return base;
  return project.segment === segmentId
    ? base * CONFIG.targetedAppealBonus
    : base * CONFIG.targetedAppealPenalty;
}

export const inProduction = (slate) => slate.filter((p) => p.status === 'production');
export const readyToRelease = (slate) => slate.filter((p) => p.status === 'ready');

/**
 * Месячный ход производства. Возвращает списанные деньги и проекты,
 * которые доехали до готовности.
 */
export function advanceProduction(slate, { stallMonths = 0, qualityMult = 1 } = {}) {
  let spent = 0;
  const finished = [];
  for (const p of slate) {
    if (p.status === 'production') {
      spent += p.monthlyCost;
      p.paid += p.monthlyCost;
      if (qualityMult !== 1) p.quality = clamp(p.quality * qualityMult, 0.2, 1.5);
      if (stallMonths <= 0) p.monthsLeft -= 1;
      if (p.monthsLeft <= 0) {
        p.status = 'ready';
        p.monthsLeft = 0;
        finished.push(p);
      }
    } else if (p.status === 'ready') {
      p.monthsHeld += 1;
    }
  }
  return { spent, finished };
}

/** Сколько слотов занято прямо сейчас. */
export const slotsUsed = (slate) => inProduction(slate).length;

export const segmentName = (id) => SEGMENTS.find((s) => s.id === id)?.name ?? null;
