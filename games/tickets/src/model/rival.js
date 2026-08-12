// ============================================================================
// Конкурент — второй билетный оператор на том же рынке.
//
// Рынок организаторов конечен, и почти каждый из них уже с кем-то работает.
// Поэтому расти можно двумя способами: подключать тех, кто ещё ни с кем,
// и переманивать чужих. Второй быстрее — и работает в обе стороны.
//
// Конкурент меняет линию поведения не каждый месяц: у решений есть инерция,
// иначе он превращается в шум, а не в противника.
// ============================================================================

import { CONFIG, ORGANIZERS, clamp } from './config.js';
import { organizerAppeal, preferenceAgainst } from './supply.js';

export const STANCE_MIN_MONTHS = 4;

export const STANCES = {
  steady: {
    id: 'steady',
    name: { ru: 'Ровный ход', en: 'Steady' },
    hint: {
      ru: 'Держит линию: средние ставки, умеренный маркетинг. Опасен тем, что не ошибается.',
      en: 'Holds the line: average rates, moderate marketing. Dangerous because he makes no mistakes.',
    },
    commission: 0.052, buyerFee: 0.105, marketing: 1.0, platform: 0.5,
  },
  dumping: {
    id: 'dumping',
    name: { ru: 'Демпинг комиссии', en: 'Commission dumping' },
    hint: {
      ru: 'Сбросил комиссию для организаторов и забирает тех, кто считает каждый процент. Своей маржой платит за чужие договоры.',
      en: 'Slashed the organiser commission and is taking everyone who counts percentages. He pays for those contracts out of his own margin.',
    },
    commission: 0.022, buyerFee: 0.125, marketing: 0.85, platform: 0.4,
  },
  exclusive: {
    id: 'exclusive',
    name: { ru: 'Скупка эксклюзивов', en: 'Buying exclusives' },
    hint: {
      ru: 'Платит промоутерам авансы за эксклюзив. Крупные туры уходят к нему целиком, и вернуть их до конца контракта нельзя.',
      en: 'Pays promoters advances for exclusivity. Big tours go to him entirely, and you cannot get them back before the contract ends.',
    },
    commission: 0.045, buyerFee: 0.135, marketing: 1.15, platform: 0.35,
  },
  platform: {
    id: 'platform',
    name: { ru: 'Ставка на платформу', en: 'Betting on the platform' },
    hint: {
      ru: 'Вкладывается в билетный виджет и забирает длинный хвост: тысячи мелких организаторов, которых никто не обслуживает руками.',
      en: 'Investing in the ticketing widget and taking the long tail: thousands of small organisers nobody serves by hand.',
    },
    commission: 0.058, buyerFee: 0.10, marketing: 0.8, platform: 1.0,
  },
  retreat: {
    id: 'retreat',
    name: { ru: 'Отступление', en: 'Retreat' },
    hint: {
      ru: 'Режет расходы и держится за то, что осталось. Сейчас его можно двигать — потом он либо соберётся, либо уйдёт с рынка.',
      en: 'Cutting costs and holding on to what is left. He can be pushed around now — later he either regroups or leaves the market.',
    },
    commission: 0.075, buyerFee: 0.145, marketing: 0.45, platform: 0.3,
  },
};

export const stanceById = (id) => STANCES[id] ?? STANCES.steady;

export function createRival() {
  return {
    alive: true,
    stance: 'steady',
    stanceMonths: 0,
    cash: 2_600_000_000,
    raises: 0,
    reach: 2_300_000,
    platformStock: 240_000_000,
    commission: STANCES.steady.commission,
    buyerFee: STANCES.steady.buyerFee,
    justCut: false,
    // Организаторы конкурента по типам — стартует крупнее вас
    orgs: { theatre: 165, concert: 48, club: 340, sport: 32 },
    // Эксклюзивные контракты: тип -> сколько месяцев ещё держит
    exclusives: {},
  };
}

export function rivalOrgTotal(rival) {
  return ORGANIZERS.reduce((s, def) => s + (rival.orgs[def.id] ?? 0), 0);
}

export function rivalPlatformLevel(rival) {
  return clamp(rival.platformStock / (rival.platformStock + CONFIG.platformSaturation), 0, 0.95);
}

/**
 * Привлекательность конкурента для организаторов этого типа. Считается той же
 * формулой, что и ваша: иначе сравнение было бы нечестным, а баланс —
 * подгонкой.
 */
export function rivalAppealFor(def, rival) {
  if (!rival.alive) return 0.001;
  const level = rivalPlatformLevel(rival);
  // Конкурент ставит виджет тем, кому он нужнее всего, — по мере роста платформы
  const connected = def.platformNeed * level > 0.42;
  return organizerAppeal(def, {
    orgCommission: rival.commission,
    buyerFee: rival.buyerFee,
    reach: rival.reach,
    platformLevel: level,
    connected,
    // Конкурент — не идеал, а такой же оператор со своими проблемами.
    // Идеальные константы здесь незаметно превращают его в непобедимого.
    service: 0.80,
    fill: CONFIG.refFill * 0.98,
    trust: 0.68,
  });
}

/**
 * Выбор линии поведения. Меняется редко и по понятной причине — иначе
 * конкурент превращается в генератор случайных чисел.
 */
export function chooseStance(rng, rival, ctx) {
  if (rival.stanceMonths < STANCE_MIN_MONTHS) return rival.stance;
  const { yourOrgs, theirOrgs, yourReach } = ctx;
  const share = theirOrgs / Math.max(1, yourOrgs + theirOrgs);

  if (rival.cash < 250_000_000) return 'retreat';
  if (share < 0.34) return rng() < 0.55 ? 'dumping' : 'exclusive';
  if (yourReach > rival.reach * 1.35) return rng() < 0.5 ? 'exclusive' : 'steady';
  if (share > 0.62) return rng() < 0.45 ? 'platform' : 'steady';
  return rng() < 0.30 ? 'platform' : 'steady';
}

/**
 * Ход конкурента: он тоже подключает организаторов, тратит на маркетинг,
 * растит платформу и считает деньги.
 */
export function stepRival(rival, ctx, rng) {
  if (!rival.alive) return { revenue: 0, gmv: 0 };

  const prevCommission = rival.commission;
  const next = chooseStance(rng, rival, ctx);
  rival.stanceMonths = next === rival.stance ? rival.stanceMonths + 1 : 0;
  rival.stance = next;
  const stance = stanceById(next);

  // Ставки подтягиваются к линии поведения не мгновенно
  rival.commission += (stance.commission - rival.commission) * 0.45;
  rival.buyerFee += (stance.buyerFee - rival.buyerFee) * 0.45;
  rival.justCut = rival.commission < prevCommission - 0.003;

  // Маркетинг и охват
  const marketing = 34_000_000 * stance.marketing * (0.8 + 0.4 * rng());
  const gain = 0.19 * Math.pow(marketing / (marketing + 30_000_000), 1.3);
  rival.reach = clamp(
    rival.reach + (12_000_000 - rival.reach) * gain - rival.reach * CONFIG.awarenessDecay,
    120_000, 11_000_000,
  );

  // Платформа
  const platformSpend = 16_000_000 * stance.platform;
  rival.platformStock += platformSpend;

  // Оборот и выручка конкурента
  let gmv = 0;
  for (const def of ORGANIZERS) {
    const count = rival.orgs[def.id] ?? 0;
    const seats = count * def.eventsPerMonth * def.seats;
    gmv += seats * 0.58 * def.avgPrice;
  }
  const revenue = gmv * (rival.commission + rival.buyerFee * 0.75);
  const costs = marketing + platformSpend + 42_000_000
    + rivalOrgTotal(rival) * 260_000 / CONFIG.orgPerManager;
  rival.cash += revenue - costs - gmv * CONFIG.acquiringRate;

  // Эксклюзивы тикают
  for (const key of Object.keys(rival.exclusives)) {
    rival.exclusives[key] -= 1;
    if (rival.exclusives[key] <= 0) delete rival.exclusives[key];
  }
  if (next === 'exclusive' && rng() < 0.35) {
    const target = rng() < 0.6 ? 'concert' : 'sport';
    rival.exclusives[target] = CONFIG.exclusiveHoldMonths;
    rival.cash -= 420_000_000;
  }

  // Раунд или уход с рынка
  if (rival.cash < 0) {
    if (rival.raises < 3) {
      rival.cash += 2_000_000_000;
      rival.raises += 1;
    } else {
      rival.alive = false;
    }
  }
  return { revenue, gmv };
}

/**
 * Переток организаторов между операторами за месяц.
 * Положительное число — к вам, отрицательное — от вас.
 */
export function switchFlow(def, preference, mine, theirs) {
  const pull = (preference - 0.5) * 2;
  const pool = pull >= 0 ? theirs : mine;
  return pool * CONFIG.switchIntensity * pull * (0.6 + 0.4 * def.loyalty);
}

export { preferenceAgainst };
