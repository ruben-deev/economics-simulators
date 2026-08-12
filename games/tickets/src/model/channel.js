// ============================================================================
// Конфликт каналов.
//
// У организатора два способа продать билет: через вашу афишу и через билетный
// виджет на собственном сайте — вашу продажу билетов под его брендом и на его
// домене. Через афишу вы берёте и сбор с покупателя, и комиссию с организатора.
// Через виджет — только платформенную ставку, то есть в разы меньше.
//
// Соблазн очевиден: не ставить виджет вообще. Но без него организатор уводит
// свою публику мимо вас целиком — а спортивный клуб или театр с абонементами
// половину зала продаёт своим людям, и эти люди на вашу афишу не заходят.
// Поставив виджет, вы возвращаете этот оборот, но уже по низкой ставке,
// и вдобавок сами помогаете организатору растить собственный канал.
// ============================================================================

import { CONFIG, clamp } from './config.js';

/**
 * Уровень платформы от накопленных вложений. Насыщается: первая версия
 * виджета даёт больше, чем десятая.
 */
export function platformLevelOf(stock) {
  return clamp(stock / (stock + CONFIG.platformSaturation), 0, 0.95);
}

/**
 * Как делится оборот организатора между каналами.
 *
 * Возвращает доли от всех мест, которые он выставляет:
 *   market   — продано через вашу афишу (сбор + комиссия)
 *   platform — продано виджетом на его сайте (ставка платформы)
 *   lost     — продано мимо вас: свой сайт без виджета, касса у входа в зал,
 *              другой оператор
 */
export function channelSplit(def, share, platformLevel) {
  // share — доля организаторов типа, у которых ваш виджет уже стоит.
  // Раньше здесь был да/нет, и это была неправда: тип из тридцати трёх клубов
  // не переезжает на новую билетную систему в один месяц и весь сразу.
  const withWidget = clamp(Number(share) || 0, 0, 1);

  // Виджет не просто забирает то, что и так уходило: организатор начинает его
  // продвигать. Чем сильнее платформа, тем активнее он гонит покупателя
  // к себе — и тем меньше остаётся вашей афише.
  const platformIn = clamp(def.selfTraffic * (0.80 + 0.50 * platformLevel), 0, 0.92);
  const lostOut = clamp(def.selfTraffic * CONFIG.leakWithoutPlatform, 0, 0.9);

  return {
    market: withWidget * (1 - platformIn) + (1 - withWidget) * (1 - lostOut),
    platform: withWidget * platformIn,
    lost: (1 - withWidget) * lostOut,
  };
}

/**
 * Сколько организаторов типа переезжает на ваш виджет за месяц.
 *
 * Никто не сидит без билетной системы: у каждого уже что-то стоит — своё
 * самописное или конкурента. Переезд стоит денег и времени: интеграция,
 * перенос схем залов и абонементов, обучение кассиров, а с крупными ещё
 * и аванс под мероприятия. Поэтому виджет не включается кнопкой, а покупается
 * бюджетом на подключения — месяц за месяцем.
 *
 * @param def         тип организатора
 * @param share       какая доля типа уже переехала
 * @param spendPerOrg бюджет подключений, приходящийся на одного организатора
 * @param platformLevel зрелость платформы: сырой продукт не переносит
 * @param rivalHold   какую долю типа конкурент держит намертво
 */
export function widgetAdoption(def, share, spendPerOrg, platformLevel, rivalHold = 0) {
  const ceiling = clamp(1 - rivalHold, 0, 1);
  const room = ceiling - clamp(share, 0, 1);
  if (room <= 0 || platformLevel <= 0.02) return 0;
  // Чем нужнее виджет самому организатору, тем дешевле он соглашается.
  // Клуб без кассы переедет почти даром, стадиону со своей системой
  // придётся платить за интеграцию и уговаривать.
  const need = clamp(def.platformNeed / 1.5, 0.15, 1.2);
  const paid = Math.pow(clamp(spendPerOrg / (CONFIG.integrationCost / need), 0, 4), 0.6);
  const ready = clamp(platformLevel / (platformLevel + 0.18), 0, 1);
  return room * clamp(CONFIG.adoptionPace * paid * ready, 0, 0.45);
}

/**
 * Сколько типа держит конкурент. Тот, кто уже переехал на его платформу,
 * второй раз за год переезжать не станет.
 */
export function rivalHoldOf(def, rivalPlatformLevel, rivalOrgs, yourOrgs) {
  const total = rivalOrgs + yourOrgs;
  if (total <= 0) return 0;
  const theirs = rivalOrgs / total;
  return clamp(theirs * rivalPlatformLevel * CONFIG.rivalLockStrength, 0, 0.75);
}

/**
 * Выручка с одного проданного билета по каналам.
 * Сбор берётся сверх цены, комиссия — из цены: это разные деньги и разные
 * стороны, но для вас обе строки одинаково выручка.
 */
export function revenuePerTicket(price, decisions, channel) {
  if (channel === 'platform') return price * decisions.platformRate;
  return price * (decisions.buyerFee + decisions.orgCommission);
}

/**
 * Во сколько обходится содержание одного подключённого организатора.
 */
export function platformCost(connectedCount) {
  return connectedCount * CONFIG.platformSeatCost;
}

/**
 * Абонплата платформы — деньги вне оборота. Для стадиона это мелочь,
 * для клуба на сто пятьдесят мест — повод не подключаться вовсе.
 */
export function subscriptionDrag(def, platformFee) {
  const monthlyGross = def.eventsPerMonth * def.seats * def.avgPrice;
  return clamp(1 - (platformFee * 6) / Math.max(1, monthlyGross), 0.25, 1);
}
