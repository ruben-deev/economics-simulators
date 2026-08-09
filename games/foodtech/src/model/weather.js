// ============================================================================
// Погода — постоянно действующий фактор, а не редкое событие.
//
// Каждая неделя имеет свой тип погоды, разыгрываемый по сезонной таблице.
// Погода бьёт с двух сторон одновременно: поднимает спрос (никто не хочет
// выходить из дома) и режет пропускную способность (курьеры едут медленнее).
// Именно это сочетание ломает сроки доставки в реальных сервисах.
//
// Прогноз на следующую неделю публичен — метеосводка доступна всем. Ценность
// не в информации, а в реакции: успеть нанять курьеров и поднять надбавку.
// ============================================================================

import { weightedPick } from '../../../../shared/rng.js';

// severity — насколько погода «плохая» (0 = ясно, 1 = максимум).
// От неё зависит и размер надбавки курьеру, и то, как сильно она помогает.
export const WEATHER = {
  clear:  { id: 'clear',  icon: '☀️', demand: 1.00, capacity: 1.00, churn: 0,    severity: 0 },
  rain:   { id: 'rain',   icon: '🌧️', demand: 1.16, capacity: 0.92, churn: 0.04, severity: 0.45 },
  storm:  { id: 'storm',  icon: '⛈️', demand: 1.30, capacity: 0.80, churn: 0.12, severity: 1.00 },
  heat:   { id: 'heat',   icon: '🔥', demand: 1.04, capacity: 0.86, churn: 0.10, severity: 0.70 },
  snow:   { id: 'snow',   icon: '🌨️', demand: 1.22, capacity: 0.82, churn: 0.09, severity: 0.80 },
  ice:    { id: 'ice',    icon: '🧊', demand: 1.10, capacity: 0.74, churn: 0.16, severity: 1.00 },
  frost:  { id: 'frost',  icon: '❄️', demand: 1.14, capacity: 0.88, churn: 0.07, severity: 0.60 },
};

// Неделя 1 — начало января, дальше по календарю
export function seasonOf(week) {
  const w = ((Math.max(1, week) - 1) % 52) + 1;
  if (w <= 8 || w >= 49) return 'winter';
  if (w <= 21) return 'spring';
  if (w <= 34) return 'summer';
  return 'autumn';
}

// Сезонные вероятности. Гололёд бывает только зимой, жара — только летом.
const SEASON_WEIGHTS = {
  winter: { clear: 30, snow: 28, frost: 24, ice: 12, storm: 6 },
  spring: { clear: 45, rain: 35, storm: 10, frost: 10 },
  summer: { clear: 45, rain: 25, storm: 12, heat: 18 },
  autumn: { clear: 35, rain: 38, storm: 15, frost: 12 },
};

export function rollWeather(rng, week) {
  const table = SEASON_WEIGHTS[seasonOf(week)];
  const picked = weightedPick(rng, Object.entries(table).map(([id, weight]) => ({ id, weight })));
  return picked ? picked.id : 'clear';
}

/**
 * Итоговые множители недели с учётом надбавки курьерам за плохую погоду.
 *
 * Надбавка — условный расход: в ясную погоду она не стоит ничего, потому что
 * severity = 0. В шторм она возвращает часть сорванных смен и удерживает людей.
 */
export function weatherEffect(type, weatherBonus = 0) {
  const w = WEATHER[type] ?? WEATHER.clear;
  // Полное покрытие — 80 ₽ надбавки в самую скверную погоду
  const coverage = Math.min(1, Math.max(0, weatherBonus) / 80);

  return {
    ...w,
    // Надбавка платится пропорционально тяжести погоды и лишь за ту часть недели,
    // когда она реально держится: даже сильный шторм редко стоит все семь дней.
    payPerOrder: weatherBonus * w.severity * 0.4,
    // Деньги возвращают до 70% потерянной пропускной способности:
    // курьеры выходят на смену, но физику дороги надбавкой не отменишь
    capacityMult: w.capacity + (1 - w.capacity) * 0.70 * coverage,
    churnAdd: w.churn * (1 - 0.85 * coverage),
    demandMult: w.demand,
  };
}
