// ============================================================================
// Календарь рынка: сезон и хиты.
//
// Партия начинается в сентябре — с открытия сезона. Это не украшение:
// у театра и стадиона год устроен противоположно, и решение «набрать
// театров» летом выглядит иначе, чем осенью.
// ============================================================================

import { clamp } from './config.js';

export const SEASONS = ['autumn', 'winter', 'spring', 'summer'];

// Месяц 1 — сентябрь, дальше по кругу
export function seasonOf(month) {
  const idx = ((month - 1) % 12 + 12) % 12;
  return SEASONS[Math.floor(idx / 3)];
}

export function monthOfYear(month) {
  return ((month - 1) % 12 + 12) % 12;   // 0 — сентябрь
}

// Сколько событий выставляет организатор этого типа в этом сезоне.
// Театр летом закрыт, стадионный тур летом как раз и едет.
const EVENT_SEASON = {
  theatre: { autumn: 1.15, winter: 1.25, spring: 1.05, summer: 0.32 },
  concert: { autumn: 1.10, winter: 1.00, spring: 1.15, summer: 1.40 },
  club: { autumn: 1.12, winter: 1.05, spring: 1.05, summer: 0.82 },
  sport: { autumn: 1.20, winter: 1.10, spring: 1.15, summer: 0.52 },
};

export function eventSeason(orgId, month) {
  return EVENT_SEASON[orgId]?.[seasonOf(month)] ?? 1;
}

// Спрос тоже сезонный, но по-своему: под Новый год покупают всё подряд,
// включая то, на что в марте не посмотрели бы.
const DEMAND_SEASON = { autumn: 1.05, winter: 1.20, spring: 1.00, summer: 0.85 };

export function demandSeason(month) {
  // Декабрь (месяц 4 от сентября) — отдельный всплеск подарочных покупок
  const extra = monthOfYear(month) === 3 ? 0.22 : 0;
  return DEMAND_SEASON[seasonOf(month)] + extra;
}

// ============================================================================
// Хиты: события, вокруг которых начинается ажиотаж.
//
// Хит — это одновременно лучший и худший месяц года. Оборот подскакивает,
// но именно на старте продаж хита ложится сайт и просыпаются перекупщики.
// Поэтому запас мощности и антибот стоят денег весь год, а окупаются в один
// день — если этот день вообще случится.
// ============================================================================

export const HITS = [
  {
    id: 'stadiumTour', org: 'concert',
    name: { ru: 'Стадионный тур', en: 'Stadium tour' },
    pull: 2.6, botPressure: 1.6, loadSpike: 2.2,
    note: {
      ru: 'Один артист собирает столько же, сколько месяц обычной афиши.',
      en: 'One artist sells as much as a month of ordinary listings.',
    },
  },
  {
    id: 'derby', org: 'sport',
    name: { ru: 'Дерби', en: 'Derby' },
    pull: 1.9, botPressure: 1.3, loadSpike: 1.8,
    note: {
      ru: 'Болельщики знают дату заранее и приходят на сайт все сразу.',
      en: 'Fans know the date in advance and hit the site all at once.',
    },
  },
  {
    id: 'premiere', org: 'theatre',
    name: { ru: 'Громкая премьера', en: 'Headline premiere' },
    pull: 1.5, botPressure: 1.1, loadSpike: 1.3,
    note: {
      ru: 'Зал маленький, желающих много — идеальная добыча для перекупщика.',
      en: 'A small hall and a long queue — perfect prey for a reseller.',
    },
  },
  {
    id: 'festival', org: 'club',
    name: { ru: 'Фестиваль', en: 'Festival' },
    pull: 1.7, botPressure: 1.2, loadSpike: 1.5,
    note: {
      ru: 'Абонементы на три дня продаются одним днём.',
      en: 'Three-day passes sell out in a single day.',
    },
  },
];

export const hitById = (id) => HITS.find((h) => h.id === id);

/**
 * Выпадет ли хит в этом месяце и какой. Хит возможен только там, где у вас
 * есть организаторы соответствующего типа: чужой тур вашей кассе не поможет.
 */
export function rollHit(rng, month, orgCounts) {
  const season = seasonOf(month);
  const chance = season === 'summer' ? 0.34 : season === 'winter' ? 0.30 : 0.26;
  if (rng() > chance) return null;

  const available = HITS.filter((h) => (orgCounts[h.org] ?? 0) >= 2);
  if (!available.length) return null;
  const weights = available.map((h) => {
    const seasonBoost = eventSeason(h.org, month);
    return Math.max(0.05, seasonBoost) * Math.sqrt(orgCounts[h.org]);
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < available.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return { id: available[i].id, size: clamp(0.7 + rng() * 0.8, 0.7, 1.5) };
  }
  return { id: available[available.length - 1].id, size: 1 };
}

export const seasonLabel = (season) => ({
  autumn: { ru: 'осень', en: 'autumn' },
  winter: { ru: 'зима', en: 'winter' },
  spring: { ru: 'весна', en: 'spring' },
  summer: { ru: 'лето', en: 'summer' },
}[season]);
