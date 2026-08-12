// ============================================================================
// Сторона предложения: организаторы.
//
// Организатор выбирает билетного оператора по трём вещам, и только одна из
// них — деньги. Вторая: сколько зрителей вы приводите. Третья: можно ли с
// вами работать вообще — а для тысячи маленьких клубов это значит «есть ли
// у вас самостоятельная касса».
// ============================================================================

import { CONFIG, clamp } from './config.js';
import { eventSeason } from './market.js';

/**
 * Качество обслуживания при текущей нагрузке на менеджеров.
 * Нагрузка считается во «взвешенных» организаторах: промоутер тура требует
 * внимания в несколько раз больше, чем клуб на сто пятьдесят мест.
 */
export function serviceQuality(managers, weightedOrgs) {
  const capacity = Math.max(1e-6, managers * CONFIG.orgPerManager);
  const load = weightedOrgs / capacity;
  if (load <= 1) return clamp(1 - 0.12 * load, 0.85, 1);
  // За пределами мощности качество падает нелинейно: перегруженный менеджер
  // не отвечает вовсе, и организатор узнаёт об этом в худший момент.
  return clamp(1 / Math.pow(load, CONFIG.serviceCongestion), 0.05, 0.88);
}

/**
 * Насколько ваша касса закрывает потребность организатора в самостоятельности.
 * Без подключения потребность остаётся неудовлетворённой — и чем она выше,
 * тем сильнее организатор смотрит на сторону.
 */
export function platformFit(def, platformLevel, connected) {
  if (connected) return clamp(1 + def.platformNeed * platformLevel * 0.95, 1, 3.2);
  return clamp(1 - def.platformNeed * 0.24, 0.3, 1);
}

/**
 * Привлекательность вас как оператора для организаторов этого типа.
 * Возвращает множитель около 1.0 при «средних» условиях рынка.
 */
export function organizerAppeal(def, ctx) {
  const {
    orgCommission, buyerFee, reach, platformLevel, connected,
    service, fill, trust,
  } = ctx;

  // Сдвиг в знаменателе держит формулу конечной при нулевой комиссии — и
  // заодно не даёт нулю быть бесконечно привлекательным: разница между 1% и
  // 0% для организатора куда меньше, чем между 6% и 5%.
  const commissionFactor = clamp(Math.pow(
    (CONFIG.refOrgCommission + 0.035) / (Math.max(0, orgCommission) + 0.035),
    def.commissionSensitivity * 0.45,
  ), 0.22, 3.2);

  // Организатор замечает и ваш сбор с покупателя: он видит, что билет
  // с надбавкой продаётся хуже, и считает это вашей проблемой, ставшей его.
  const feeDrag = Math.pow(
    (CONFIG.refBuyerFee + 0.07) / (Math.max(0, buyerFee) + 0.07),
    0.55 * def.feeAwareness,
  );

  // Ядро двустороннего рынка: аргумент «у нас аудитория» работает ровно
  // настолько, насколько эта аудитория есть.
  const audiencePull = Math.pow(Math.max(0.02, reach / CONFIG.refReach), 0.55);

  const fitFactor = platformFit(def, platformLevel, connected);
  const serviceFactor = 0.35 + 0.65 * service;
  // Заполняемость — то, что организатор видит своими глазами
  const fillFactor = Math.pow(clamp(fill / CONFIG.refFill, 0.15, 1.6), CONFIG.fillAngerPower * 0.5);
  const trustFactor = 0.7 + 0.3 * trust;

  return clamp(
    commissionFactor * feeDrag * audiencePull * fitFactor
    * serviceFactor * fillFactor * trustFactor,
    0.02, 24,
  );
}

/**
 * Доля рынка этого типа, которая при прочих равных достаётся вам, а не
 * конкуренту. Мягкая, а не «победитель забирает всё»: организаторы разные,
 * и часть из них останется у соседа при любых условиях.
 */
export function preferenceAgainst(mine, theirs) {
  const a = Math.pow(Math.max(1e-6, mine), CONFIG.competeSharpness);
  const b = Math.pow(Math.max(1e-6, theirs), CONFIG.competeSharpness);
  return clamp(a / (a + b), 0.04, 0.96);
}

/**
 * Отток организаторов за месяц. Уходят не от хорошей жизни: пустые залы,
 * дорогая комиссия, неотвечающий менеджер и отсутствие своей кассы.
 */
export function organizerChurn(def, appeal) {
  const base = CONFIG.baseOrgChurn * def.loyalty;
  return clamp(base / Math.pow(Math.max(0.05, appeal), 0.75), 0.004, 0.42);
}

/**
 * Афиша: сколько событий и мест выставляет этот тип организаторов.
 */
export function listing(def, count, month) {
  const season = eventSeason(def.id, month);
  const events = count * def.eventsPerMonth * season;
  return { events, seats: events * def.seats, season };
}

/**
 * Разнообразие афиши по типам: 1.0 — все четыре типа представлены поровну,
 * 0 — весь оборот в одном типе. Считается по местам, а не по числу событий:
 * тысяча клубных вечеринок и один стадион — это не «два жанра поровну».
 */
export function breadth(seatsByType) {
  const values = Object.values(seatsByType).filter((v) => v > 0);
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0 || values.length <= 1) return 0;
  let h = 0;
  for (const v of values) {
    const p = v / total;
    h -= p * Math.log(p);
  }
  return clamp(h / Math.log(4), 0, 1);
}
