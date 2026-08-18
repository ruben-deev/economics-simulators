// ============================================================================
// Партнёрства и бандлы: второй канал роста.
//
// Подписчиков можно приводить двумя принципиально разными способами.
// Розница — маркетинг и премьеры: человек сам выбрал вас, платит полную цену
// и уходит, когда становится скучно. Опт — дистрибуция через чужую подписку:
// оператора связи, банк, производителя телевизоров. Такие подписчики приходят
// дёшево и сразу тысячами, но:
//
//   • вы получаете не всю цену, а долю от неё;
//   • они не выбирали вас и смотрят меньше;
//   • когда контракт кончается, они уходят разом, а не по одному.
//
// Отсюда учебная мысль, которой в игре до сих пор не было: рост базы и рост
// выручки — не одно и то же, и «сколько у нас подписчиков» без вопроса
// «откуда они» ничего не значит.
// ============================================================================

import { CONFIG, clamp } from './config.js';

export const PARTNERS = [
  {
    id: 'telecom',
    weight: 8,
    minMonth: 5,
    name: { ru: 'Мобильный оператор', en: 'Mobile operator' },
    text: {
      ru: 'Крупнейший оператор страны кладёт вашу подписку в свои тарифы. Абонентов миллионы, но платить вам будут по оптовой цене.',
      en: 'The country’s largest operator is putting your subscription into its plans. Millions of subscribers — but they will pay you a wholesale rate.',
    },
    lesson: {
      ru: 'Оптовый подписчик дешевле розничного и стоит меньше. Считать их вместе — самый быстрый способ обмануть себя графиком роста.',
      en: 'A wholesale subscriber is cheaper to get and worth less. Counting them together with retail is the fastest way to fool yourself with a growth chart.',
    },
    months: 18,
    reach: 230_000,        // приводит в месяц
    revenueShare: 0.35,    // какую долю цены вы получаете
    churnMult: 0.35,       // внутри контракта почти не уходят
    hoursMult: 0.55,       // но и смотрят вдвое меньше: они вас не выбирали
    setupFee: 120_000_000,
    monthlyFee: 0,
    exclusive: 'telecom',
  },
  {
    id: 'bank',
    weight: 7,
    minMonth: 8,
    name: { ru: 'Банковская подписка', en: 'Bank subscription bundle' },
    text: {
      ru: 'Банк добавляет вас в свою программу привилегий. Аудитория меньше, зато платёжеспособная и доля выручки заметно выше.',
      en: 'A bank is adding you to its perks programme. A smaller audience, but an affluent one — and the revenue share is noticeably better.',
    },
    lesson: {
      ru: 'Условия дистрибуции — это переговоры о доле, а не о числе людей. Меньшая аудитория с лучшей долей часто приносит больше денег.',
      en: 'Distribution terms are a negotiation about share, not about headcount. A smaller audience on better terms often brings more money.',
    },
    months: 12,
    reach: 95_000,
    revenueShare: 0.62,
    churnMult: 0.5,
    hoursMult: 0.8,
    setupFee: 40_000_000,
    monthlyFee: 0,
  },
  {
    id: 'tv',
    weight: 6,
    minMonth: 10,
    name: { ru: 'Предустановка на телевизорах', en: 'Smart-TV preinstall' },
    text: {
      ru: 'Производитель ставит ваше приложение кнопкой на пульт. Приходят немногие, но это люди, которые действительно садятся смотреть.',
      en: 'A manufacturer puts your app on the remote. Few people arrive, but they are people who actually sit down to watch.',
    },
    lesson: {
      ru: 'Дистрибуция бывает не только оптовой. Хорошее место в интерфейсе стоит дорого и приводит именно тех, кто будет смотреть.',
      en: 'Not all distribution is wholesale. A good slot in someone’s interface is expensive and brings exactly the people who will watch.',
    },
    months: 24,
    reach: 55_000,
    revenueShare: 0.85,
    churnMult: 0.7,
    hoursMult: 1.25,
    setupFee: 0,
    monthlyFee: 30_000_000,
  },
  {
    id: 'aggregator',
    weight: 6,
    minMonth: 12,
    name: { ru: 'Подписка-агрегатор', en: 'Subscription aggregator' },
    text: {
      ru: 'Агрегатор продаёт вас в пакете с музыкой и доставкой. Объём приличный, но зритель считает подписку не вашей, а их.',
      en: 'An aggregator sells you in a package with music and delivery. Decent volume, but the viewer thinks the subscription is theirs, not yours.',
    },
    lesson: {
      ru: 'В чужом пакете вы становитесь строчкой, а не брендом. Узнаваемость такие подписчики не строят, и после контракта уходят к тому, чей бренд помнят.',
      en: 'Inside someone else’s bundle you are a line item, not a brand. These subscribers build no awareness, and when the contract ends they go to the brand they remember.',
    },
    months: 12,
    reach: 160_000,
    revenueShare: 0.45,
    churnMult: 0.4,
    hoursMult: 0.6,
    setupFee: 60_000_000,
    monthlyFee: 0,
    awarenessDrag: 0.35,   // не строит ваш бренд
    exclusive: 'telecom',
  },
];

export const partnerById = (id) => PARTNERS.find((p) => p.id === id) ?? null;

/** Предложение приходит редко и не повторяет уже действующие. */
export function rollPartnerOffer(rng, month, active) {
  if (month < 5) return null;
  if (rng() > CONFIG.partnerOfferChance) return null;
  const busy = new Set(active.map((a) => a.id));
  const lockedGroups = new Set(active.map((a) => partnerById(a.id)?.exclusive).filter(Boolean));
  const pool = PARTNERS.filter((p) => month >= p.minMonth
    && !busy.has(p.id)
    && !(p.exclusive && lockedGroups.has(p.exclusive)));
  if (!pool.length) return null;

  const total = pool.reduce((s, p) => s + p.weight, 0);
  let roll = rng() * total;
  for (const p of pool) {
    roll -= p.weight;
    if (roll <= 0) return p.id;
  }
  return pool[pool.length - 1].id;
}

/**
 * Сколько подписчиков приводит партнёрство в этом месяце.
 * Охват насыщается: свободных абонентов у партнёра тоже конечное число,
 * и после первых месяцев поток заметно слабеет.
 */
export function partnerInflow(deal, def, marketRoom = 1) {
  const filled = clamp(deal.subs / (def.reach * def.months * 0.45), 0, 1);
  return def.reach * (1 - filled) * clamp(marketRoom, 0, 1);
}

/**
 * Месячная выручка от оптового подписчика.
 *
 * Ставка зафиксирована в момент подписания и за прайсом не следует: в этом
 * и смысл контракта. Поднять цену рознице можно хоть завтра — оптовый партнёр
 * будет платить ровно столько, о чём договорились, до конца срока.
 */
export function partnerRevenue(deal, def) {
  return deal.subs * deal.price * def.revenueShare;
}

/** Итог всех действующих контрактов — для отчёта и для интерфейса. */
export function partnerTotals(deals) {
  let subs = 0;
  let monthlyFee = 0;
  for (const d of deals) {
    subs += d.subs;
    monthlyFee += partnerById(d.id)?.monthlyFee ?? 0;
  }
  return { subs, monthlyFee, count: deals.length };
}
