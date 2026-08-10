// ============================================================================
// Цена: новые платят одно, старая база — другое.
//
// В первой версии цена была одним числом: подняли — и вся база мгновенно
// платит больше. В подписочном бизнесе так не бывает. Действующий подписчик
// платит ту цену, на которой подписался, и перевести его на новую — отдельное
// решение с отдельной ценой: часть базы уходит именно в этот момент.
//
// Отсюда главный показатель, которого раньше в игре не было: разрыв между
// прайсом и фактическим ARPU. Он копится незаметно и закрывается больно.
//
// Годовая подписка — второй слой. Деньги приходят сразу за двенадцать месяцев,
// подписчик не может уйти и не попадает под повышение. Это заём у собственной
// будущей выручки: касса сегодня, зафиксированная цена завтра.
// ============================================================================

import { CONFIG, clamp } from './config.js';

/** Стартовое состояние цен для одного сегмента. */
export function createPricing(startPrice) {
  return {
    lockedPrice: startPrice,   // средняя цена, которую платит действующая база
    annual: [],                // [{ subs, monthsLeft, price }]
  };
}

/**
 * Какая доля новых берёт годовую подписку. Чем больше скидка, тем охотнее —
 * но и тем дешевле обходится вам каждый из них.
 */
export function annualShare(discount, segDef) {
  if (discount <= 0) return 0;
  // Лояльные сегменты охотнее платят вперёд: они и так собирались остаться
  const willingness = clamp(1.35 - segDef.loyalty, 0.2, 1.1);
  return clamp(0.10 + 1.5 * discount * willingness, 0, 0.75);
}

/** Сколько всего подписчиков на годовом тарифе в сегменте. */
export const annualSubs = (pricing) => pricing.annual.reduce((s, c) => s + c.subs, 0);

/**
 * Повышение цены действующей базе. Возвращает долю, которая уйдёт именно
 * из-за повышения, — сверх обычного оттока.
 *
 * Реакция нелинейна: +10% почти незаметны, +40% выносят заметный кусок базы.
 * Годовые подписчики не задеты — их цена зафиксирована до конца срока.
 */
export function raiseShock(oldPrice, newPrice, segDef) {
  if (newPrice <= oldPrice || oldPrice <= 0) return 0;
  const jump = (newPrice - oldPrice) / oldPrice;
  return clamp(
    CONFIG.raiseShockBase * Math.pow(jump / 0.1, CONFIG.raiseShockCurve) * segDef.elasticity,
    0, 0.35);
}

/**
 * Месячный ход по годовым когортам: у всех тикает срок, истёкшие
 * возвращаются в обычную базу по текущей цене.
 */
export function tickAnnual(pricing) {
  let expired = 0;
  for (const cohort of pricing.annual) cohort.monthsLeft -= 1;
  for (const cohort of pricing.annual) if (cohort.monthsLeft <= 0) expired += cohort.subs;
  pricing.annual = pricing.annual.filter((c) => c.monthsLeft > 0);
  return expired;
}

/**
 * Годовая когорта: деньги приходят сразу за двенадцать месяцев.
 * `price` — уже со скидкой; именно её подписчик и зафиксировал на год.
 */
export function addAnnualCohort(pricing, subs, price) {
  if (subs <= 0) return 0;
  pricing.annual.push({ subs, monthsLeft: 12, price });
  return subs * price * 12;
}

