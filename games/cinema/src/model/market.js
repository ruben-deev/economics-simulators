// ============================================================================
// Внешний фон месяца: сезон просмотра и афиша конкурента.
//
// В стриминге роль погоды играет чужой релиз. Он бьёт с двух сторон сразу:
// забирает часть новых подписок и вытягивает часть ваших зрителей — ровно
// тогда, когда вы могли бы расти. Афиша известна на месяц вперёд: даты чужих
// премьер публикуются задолго до выхода. Ценность не в информации, а в
// реакции — успеть выпустить своё, поднять маркетинг или переждать.
// ============================================================================

import { weightedPick } from '../../../../shared/rng.js';

// pull — сила оттягивания аудитории, 0 = ничего не происходит
export const RIVAL_RELEASES = {
  none:    { id: 'none',    icon: '·',  pull: 0,    acquisition: 1.00, churnAdd: 0,     hours: 1.00 },
  small:   { id: 'small',   icon: '▫',  pull: 0.25, acquisition: 0.93, churnAdd: 0.004, hours: 0.98 },
  notable: { id: 'notable', icon: '◆',  pull: 0.55, acquisition: 0.84, churnAdd: 0.012, hours: 0.95 },
  major:   { id: 'major',   icon: '★',  pull: 0.80, acquisition: 0.72, churnAdd: 0.024, hours: 0.91 },
  mega:    { id: 'mega',    icon: '★★', pull: 1.00, acquisition: 0.58, churnAdd: 0.040, hours: 0.86 },
};

// Месяц 1 — январь
export function seasonOf(month) {
  const m = ((Math.max(1, month) - 1) % 12) + 1;
  if (m <= 2 || m === 12) return 'winter';
  if (m <= 5) return 'spring';
  if (m <= 8) return 'summer';
  return 'autumn';
}

// Зимой смотрят заметно больше, летом — заметно меньше. Это касается и вас,
// и конкурента: в высокий сезон и премьер больше, и борьба за внимание острее.
const SEASON = {
  winter: { hours: 1.18, weights: { none: 28, small: 24, notable: 24, major: 16, mega: 8 } },
  spring: { hours: 1.00, weights: { none: 42, small: 26, notable: 20, major: 10, mega: 2 } },
  summer: { hours: 0.84, weights: { none: 52, small: 26, notable: 16, major: 6 } },
  autumn: { hours: 1.06, weights: { none: 34, small: 26, notable: 22, major: 14, mega: 4 } },
};

export function seasonHours(month) {
  return SEASON[seasonOf(month)].hours;
}

export function rollRivalRelease(rng, month) {
  const table = SEASON[seasonOf(month)].weights;
  const picked = weightedPick(rng, Object.entries(table).map(([id, weight]) => ({ id, weight })));
  return picked ? picked.id : 'none';
}

/**
 * Итоговые множители месяца с учётом контрпрограммирования — вашего решения
 * ответить на чужую премьеру своей или, наоборот, не мешать ей.
 *
 * Собственная громкая премьера в тот же месяц частично гасит чужую: зритель
 * выбирает, а не уходит совсем.
 */
export function rivalEffect(type, ownBuzz = 0) {
  const r = RIVAL_RELEASES[type] ?? RIVAL_RELEASES.none;
  // Свой релиз перебивает чужой тем сильнее, чем он громче
  const counter = Math.min(0.65, ownBuzz * 0.45);

  return {
    ...r,
    acquisitionMult: r.acquisition + (1 - r.acquisition) * counter,
    churnAdd: r.churnAdd * (1 - counter),
    hoursMult: r.hours + (1 - r.hours) * counter,
  };
}
