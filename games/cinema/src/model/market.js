// ============================================================================
// Внешний фон месяца: сезон просмотра и афиша конкурента.
//
// Афиша больше не разыгрывается кубиком. Конкурент — живой (см. rival.js),
// у него есть свой производственный пайплайн, и на экране вы видите то, что
// у него действительно выходит. Анонс на следующий месяц честный: это проект,
// которому остался месяц до премьеры.
//
// Здесь остаётся только перевод «шума премьеры» в понятные игроку категории
// и общий сезонный фон, одинаковый для обеих сторон.
// ============================================================================

// pull — сила оттягивания внимания, 0 = ничего не происходит.
// Это не переток базы (он считается в rival.js), а борьба за внимание:
// в месяц чужой громкой премьеры хуже конвертируются новые и меньше смотрят все.
export const RIVAL_RELEASES = {
  none:    { id: 'none',    icon: '·',  pull: 0,    acquisition: 1.00, churnAdd: 0,     hours: 1.00 },
  small:   { id: 'small',   icon: '▫',  pull: 0.25, acquisition: 0.94, churnAdd: 0.003, hours: 0.98 },
  notable: { id: 'notable', icon: '◆',  pull: 0.55, acquisition: 0.87, churnAdd: 0.009, hours: 0.96 },
  major:   { id: 'major',   icon: '★',  pull: 0.80, acquisition: 0.78, churnAdd: 0.017, hours: 0.93 },
  mega:    { id: 'mega',    icon: '★★', pull: 1.00, acquisition: 0.68, churnAdd: 0.028, hours: 0.89 },
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
  winter: { hours: 1.18 },
  spring: { hours: 1.00 },
  summer: { hours: 0.84 },
  autumn: { hours: 1.06 },
};

export function seasonHours(month) {
  return SEASON[seasonOf(month)].hours;
}

/** Во что превращается шум чужой премьеры на экране игрока. */
export function classifyRelease(buzz) {
  if (!buzz || buzz <= 0.01) return 'none';
  if (buzz < 0.6) return 'small';
  if (buzz < 1.1) return 'notable';
  if (buzz < 1.9) return 'major';
  return 'mega';
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
