// ============================================================================
// Кризисы: проблемы, которые длятся, пока их не решить.
//
// Разовое событие с множителем ±10% — неудачный бросок кубика: реагировать
// не на что, его пережидают. Кризис висит на компании, каждый месяц
// становится хуже и требует явного решения с ценой. Тянуть можно — но дороже.
//
// В билетном бизнесе почти все кризисы бьют по одному и тому же счёту —
// по доверию. Оборот при этом какое-то время держится, и в этом ловушка:
// цифры выглядят нормально ровно до месяца, когда становится поздно.
// ============================================================================

import { clamp } from './config.js';

export const MAX_ESCALATION = 5;
export const CRISIS_COOLDOWN = 3;

export const CRISES = [
  {
    id: 'resellers',
    weight: 7,
    minMonth: 6,
    title: { ru: 'Волна перекупщиков', en: 'A wave of resellers' },
    text: {
      ru: 'Билеты на хиты исчезают за секунды и через час всплывают втридорога. В соцсетях уверены, что вы с перекупщиками заодно.',
      en: 'Tickets to the hits vanish in seconds and reappear at triple price an hour later. Social media is certain you are in on it.',
    },
    lesson: {
      ru: 'Оборот и доверие — разные счета. Перекупщик наполняет первый и опустошает второй, и по отчёту о продажах этого не видно.',
      en: 'Turnover and trust are different accounts. A reseller fills the first and empties the second, and the sales report shows none of it.',
    },
    escalate: (m) => ({ trustHit: 0.055 * m, orgAngerAdd: 0.012 * m, gmvMult: 1 + 0.02 * m }),
    resolutions: [
      {
        id: 'nominal',
        label: { ru: 'Именные билеты и верификация', en: 'Named tickets and verification' },
        detail: { ru: 'Долго, дорого и часть живых людей отвалится. Зато перекупщик остаётся ни с чем.', en: 'Slow, expensive, and some real buyers drop off. But the reseller is left with nothing.' },
        cost: (m) => 45_000_000 * m,
        resolves: true,
      },
      {
        id: 'buyback',
        label: { ru: 'Выкупить и перепродать по номиналу', en: 'Buy back and resell at face value' },
        detail: { ru: 'Быстро гасит скандал, но стоит живых денег и работает только один раз.', en: 'Puts out the fire fast, costs real money and works exactly once.' },
        cost: (m) => 110_000_000 * m,
        resolves: true,
      },
      {
        id: 'wait',
        label: { ru: 'Ничего не делать', en: 'Do nothing' },
        detail: { ru: 'Оборот даже подрастёт. Доверие — нет.', en: 'Turnover will even grow. Trust will not.' },
        cost: () => 0,
        resolves: false,
      },
    ],
  },
  {
    id: 'outage',
    weight: 6,
    minMonth: 5,
    title: { ru: 'Сайт лёг на старте продаж', en: 'The site went down at on-sale' },
    text: {
      ru: 'Сто тысяч человек нажали «купить» в одну секунду. Половина увидела ошибку, часть заплатила дважды.',
      en: 'A hundred thousand people pressed “buy” in the same second. Half saw an error, some paid twice.',
    },
    lesson: {
      ru: 'Мощность покупается заранее и выглядит выброшенными деньгами ровно до того дня, когда она нужна.',
      en: 'Capacity is bought in advance and looks like wasted money right up to the day you need it.',
    },
    escalate: (m) => ({ trustHit: 0.045 * m, orgAngerAdd: 0.02 * m, conversionMult: 1 - 0.06 * m }),
    resolutions: [
      {
        id: 'rebuild',
        label: { ru: 'Перестроить очередь и мощности', en: 'Rebuild the queue and capacity' },
        detail: { ru: 'Разовые вложения, которые надо было сделать раньше.', en: 'A one-off investment that should have been made earlier.' },
        cost: (m) => 70_000_000 * m,
        resolves: true,
      },
      {
        id: 'compensate',
        label: { ru: 'Компенсировать всем пострадавшим', en: 'Compensate everyone affected' },
        detail: { ru: 'Возвращает доверие быстрее денег, но не чинит причину.', en: 'Restores trust faster than money does, but does not fix the cause.' },
        cost: (m) => 40_000_000 * m,
        resolves: true,
      },
      {
        id: 'wait',
        label: { ru: 'Списать на ажиотаж', en: 'Blame it on the rush' },
        detail: { ru: 'Бесплатно. Следующий старт продаж будет хуже.', en: 'Free. The next on-sale will be worse.' },
        cost: () => 0,
        resolves: false,
      },
    ],
  },
  {
    id: 'feeCap',
    weight: 5,
    minMonth: 11,
    title: { ru: 'Регулятор взялся за сервисный сбор', en: 'The regulator takes on the service fee' },
    text: {
      ru: 'Готовится ограничение надбавки к цене билета. Пока идёт разбирательство, сбор приходится держать ниже.',
      en: 'A cap on the mark-up over the ticket price is being drafted. While it is under review, the fee has to stay lower.',
    },
    lesson: {
      ru: 'Доход, который целиком держится на одной непрозрачной строке, — это разрешение, а не бизнес-модель.',
      en: 'Income that rests entirely on one opaque line is a permission, not a business model.',
    },
    escalate: (m) => ({ feeCap: Math.max(0.04, 0.10 - 0.012 * m), trustHit: 0.012 * m }),
    resolutions: [
      {
        id: 'transparent',
        label: { ru: 'Показать сбор в афише честно', en: 'Show the fee openly in the listings' },
        detail: { ru: 'Конверсия просядет сразу, зато вопрос закрыт, а доверие вырастет.', en: 'Conversion drops at once, but the question is closed and trust grows.' },
        cost: (m) => 30_000_000 * m,
        resolves: true,
      },
      {
        id: 'lobby',
        label: { ru: 'Работать с регулятором', en: 'Work with the regulator' },
        detail: { ru: 'Дорого и не навсегда, но модель остаётся прежней.', en: 'Expensive and not forever, but the model stays as it is.' },
        cost: (m) => 90_000_000 * m,
        resolves: true,
      },
      {
        id: 'wait',
        label: { ru: 'Ждать решения', en: 'Wait for the ruling' },
        detail: { ru: 'Каждый месяц потолок сбора опускается ниже.', en: 'Every month the fee cap drops lower.' },
        cost: () => 0,
        resolves: false,
      },
    ],
  },
  {
    id: 'cancelled',
    weight: 5,
    minMonth: 8,
    title: { ru: 'Крупный тур отменён', en: 'A major tour is cancelled' },
    text: {
      ru: 'Артист отменил гастроли. Деньги за билеты собраны, вернуть их должны вы — и вернуть быстро.',
      en: 'The artist cancelled the tour. The money for the tickets has been collected, and you are the one who has to return it — fast.',
    },
    lesson: {
      ru: 'Деньги на счету билетного оператора — это чужие деньги. Пока событие не состоялось, вы их держите, а не зарабатываете.',
      en: 'Money in a ticket operator’s account is other people’s money. Until the event happens you are holding it, not earning it.',
    },
    escalate: (m) => ({ refundHit: 130_000_000 * m, trustHit: 0.04 * m, orgAngerAdd: 0.008 * m }),
    resolutions: [
      {
        id: 'refundFast',
        label: { ru: 'Вернуть всем немедленно', en: 'Refund everyone immediately' },
        detail: { ru: 'Больно по кассе и правильно по сути.', en: 'Painful for cash and right on the merits.' },
        cost: (m) => 150_000_000 * m,
        resolves: true,
      },
      {
        id: 'voucher',
        label: { ru: 'Предложить ваучеры на другие события', en: 'Offer vouchers for other events' },
        detail: { ru: 'Дешевле вдвое, но часть зрителей запомнит это надолго.', en: 'Half the cost, but some buyers will remember it for a long time.' },
        cost: (m) => 70_000_000 * m,
        resolves: true,
      },
      {
        id: 'wait',
        label: { ru: 'Тянуть с возвратами', en: 'Delay the refunds' },
        detail: { ru: 'Каждый месяц ожидания дороже предыдущего.', en: 'Every month of waiting costs more than the last.' },
        cost: () => 0,
        resolves: false,
      },
    ],
  },
  {
    id: 'leak',
    weight: 4,
    minMonth: 12,
    title: { ru: 'Утечка данных покупателей', en: 'A buyer data leak' },
    text: {
      ru: 'База с телефонами и историей покупок оказалась в открытом доступе. Организаторы спрашивают, что с их данными.',
      en: 'A database of phone numbers and purchase histories has surfaced publicly. Organisers are asking what happened to their data.',
    },
    lesson: {
      ru: 'Данные, на которых учатся ваши алгоритмы, — это одновременно и обязательство. Оно всплывает разом.',
      en: 'The data your algorithms learn from is also a liability. It comes due all at once.',
    },
    escalate: (m) => ({ trustHit: 0.05 * m, orgAngerAdd: 0.018 * m, dataPenalty: 0.1 * m }),
    resolutions: [
      {
        id: 'audit',
        label: { ru: 'Аудит, уведомления и защита', en: 'Audit, notifications and protection' },
        detail: { ru: 'Дорого и публично, зато закрывает тему.', en: 'Expensive and public, but it closes the subject.' },
        cost: (m) => 80_000_000 * m,
        resolves: true,
      },
      {
        id: 'wait',
        label: { ru: 'Не комментировать', en: 'No comment' },
        detail: { ru: 'Организаторы делают выводы сами.', en: 'Organisers draw their own conclusions.' },
        cost: () => 0,
        resolves: false,
      },
    ],
  },
];

export const crisisById = (id) => CRISES.find((c) => c.id === id);

export function severityOf(active) {
  return clamp((active?.months ?? 0) + 1, 1, MAX_ESCALATION);
}

export function crisisEffects(active) {
  if (!active) return {};
  const def = crisisById(active.id);
  if (!def) return {};
  return def.escalate(severityOf(active));
}

export function resolutionCost(active, resolutionId) {
  const def = crisisById(active?.id);
  const res = def?.resolutions.find((r) => r.id === resolutionId);
  if (!res) return 0;
  return res.cost(severityOf(active));
}

/**
 * Кризисы приходят тем чаще, чем крупнее оборот: успешный сервис судят,
 * о нём пишут и на него охотятся. Это не наказание за успех, а его цена.
 *
 * Шкала масштаба перекалибрована аудитом 2026-08: прежний порог «полной»
 * частоты (GMV 6 млрд/мес) партии не достигали никогда, и медианное число
 * кризисов за партию равнялось нулю — девятнадцать написанных кризисов
 * лежали мёртвым грузом. Теперь пол 5% в месяц и полная частота от
 * GMV 2 млрд/мес: у решающего кризисы игрока их 2–4 за партию (замер).
 */
export function rollCrisis(rng, month, { gmv, active, lastResolved = -99 }) {
  if (active) return null;
  if (month - lastResolved < CRISIS_COOLDOWN) return null;
  const pool = CRISES.filter((c) => month >= c.minMonth);
  if (!pool.length) return null;

  const scale = clamp(gmv / 2_000_000_000, 0, 1);
  const chance = 0.05 + 0.10 * scale;
  if (rng() > chance) return null;

  const total = pool.reduce((s, c) => s + c.weight, 0);
  let roll = rng() * total;
  for (const c of pool) {
    roll -= c.weight;
    if (roll <= 0) return { id: c.id, months: 0 };
  }
  return { id: pool[pool.length - 1].id, months: 0 };
}
