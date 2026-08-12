// ============================================================================
// Сторона спроса: зрители.
//
// Зритель приходит не к вам, а на событие. Поэтому спрос считается не от
// бренда, а от афиши: чем она разнообразнее, тем больше сегментов находит
// в ней своё. Афиша из одного жанра собирает одну аудиторию — и упирается
// в её размер, сколько ни трать на маркетинг.
// ============================================================================

import { CONFIG, clamp } from './config.js';

/**
 * Прирост охвата за месяц. Маркетинг насыщается, а пустая афиша обесценивает
 * его целиком: приводить людей некуда.
 */
export function reachGain(marketingPerViewer, listingPower) {
  const raw = Math.pow(
    marketingPerViewer / (marketingPerViewer + CONFIG.refMarketingPerViewer),
    CONFIG.marketingSaturation,
  );
  return CONFIG.awarenessMaxGain * raw * clamp(0.25 + 0.75 * listingPower, 0.25, 1.25);
}

/**
 * Насколько текущая афиша интересна этому сегменту.
 * Считается по долям мест: тысяча клубных вечеринок и один стадион — это
 * не «два жанра поровну».
 */
export function segmentInterest(aud, seatShare) {
  let sum = 0;
  for (const [type, share] of Object.entries(seatShare)) {
    sum += share * (aud.affinity[type] ?? 0);
  }
  return clamp(sum, 0, 3.2);
}

/**
 * Множитель спроса от сервисного сбора. Сбор — это надбавка к цене, поэтому
 * работает обычная эластичность: сравниваем итоговую цену с эталонной.
 */
export function feeFactor(aud, visibleFee) {
  return clamp(
    Math.pow((1 + CONFIG.refBuyerFee) / (1 + Math.max(0, visibleFee)), aud.feeElasticity),
    0.2, 2.4,
  );
}

/**
 * Конверсия: доля тех, кто дошёл до оплаты и заплатил.
 * Продукт ускоряет оплату, доверие решает, вернётся ли человек вообще.
 */
export function conversion(aud, ctx) {
  const { visibleFee, productLevel, trust, discoveryBoost } = ctx;
  const productFactor = 0.62 + 0.55 * productLevel;
  const trustFactor = clamp(1 - aud.trustWeight * 0.42 * (1 - trust), 0.25, 1.05);
  const discovery = 1 + aud.discovery * discoveryBoost;
  return clamp(
    CONFIG.refConversion * feeFactor(aud, visibleFee) * productFactor * trustFactor * discovery,
    0.01, 0.95,
  );
}

/**
 * Сколько билетов хочет купить сегмент в этом месяце.
 */
export function segmentDemand(aud, ctx) {
  const { reach, interest, conv, season, hitPull } = ctx;
  return aud.potential * reach * interest * conv * CONFIG.baseBuyRate * season * hitPull;
}

/**
 * Сколько мест из выставленных удастся продать.
 *
 * Спрос и мест — два независимых числа, и продаётся не минимум, а сглаженный
 * минимум: даже при избыточном спросе часть мест остаётся неудобной, а часть
 * событий не совпадает с тем, чего хотят.
 */
export function soldTickets(demand, seats) {
  if (seats <= 0 || demand <= 0) return 0;
  return seats * (1 - Math.exp(-CONFIG.fillCurve * demand / seats));
}

/**
 * Зритель тоже выбирает оператора.
 *
 * Крупные события есть у обоих: промоутер редко отдаёт тур одному. Поэтому
 * покупатель сравнивает итоговую цену, доверие и удобство — и уходит туда,
 * где дешевле. Без этого сервисный сбор был бы бесплатным для вас: организатор
 * его почти не видит, а зритель, которому некуда идти, заплатит любой.
 *
 * Возвращает множитель спроса: 1.0 при полном паритете с конкурентом.
 */
export function buyerPreference(aud, mine, theirs) {
  // Сравнение идёт прежде всего по итоговой цене: доверие и удобство уже
  // учтены в конверсии, и складывать их сюда во весь рост значило бы
  // наказывать дважды за одно и то же.
  const score = (side) => feeFactor(aud, side.visibleFee)
    * (0.82 + 0.18 * side.trust)
    * (0.88 + 0.14 * side.productLevel);
  // Резкость: билет — товар одинаковый, и разница в итоговой цене видна
  // сразу. Поэтому небольшая разница в сборе двигает заметную долю покупателей.
  const k = 2.2;
  const a = Math.pow(score(mine), k);
  const b = theirs ? Math.pow(score(theirs), k) : 0;
  if (b <= 0) return 1.7;
  return clamp(2 * a / (a + b), 0.12, 1.88);
}
