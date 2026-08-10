// ============================================================================
// Кризисы: проблемы, которые длятся, пока их не решить.
//
// Разовое событие с множителем ±10% — это неудачный бросок кубика: игрок
// его пережидает, потому что реагировать не на что. Кризис устроен иначе.
// Он висит на компании, каждый месяц становится хуже и требует явного
// решения, у которого есть цена. Тянуть можно — но дороже.
//
// Кризисы приходят тем чаще, чем лучше у вас дела: успешный сервис судят,
// у него переманивают команду и о нём пишут. Это не наказание за успех,
// а его настоящая себестоимость.
// ============================================================================

import { clamp } from './config.js';

export const CRISES = [
  {
    id: 'scandal',
    weight: 6,
    minMonth: 7,
    title: { ru: 'Скандал вокруг сервиса', en: 'A scandal around the service' },
    text: {
      ru: 'Разбор вашего шоу разошёлся по соцсетям, и разговор пошёл не про кино. Каждую неделю тема растёт.',
      en: 'A takedown of your show has spread across social media, and the conversation is no longer about the show. It grows every week.',
    },
    lesson: {
      ru: 'Репутационные издержки не попадают в P&L, пока не превратятся в отток. К этому моменту чинить их уже дорого.',
      en: 'Reputational costs never show up in the P&L until they turn into churn. By then they are expensive to fix.',
    },
    // Эффект растёт с каждым непрожитым месяцем
    escalate: (m) => ({ churnAdd: 0.012 * m, awarenessMult: 1 - 0.06 * m, demandMult: 1 - 0.05 * m }),
    resolutions: [
      {
        id: 'pr',
        label: { ru: 'Кампания и публичный ответ', en: 'A campaign and a public answer' },
        detail: { ru: 'Стоит тем дороже, чем дольше вы молчали.', en: 'Costs more the longer you stayed silent.' },
        cost: (m) => 70_000_000 * m,
        resolves: true,
      },
      {
        id: 'wait',
        label: { ru: 'Переждать', en: 'Wait it out' },
        detail: { ru: 'Денег не стоит. В следующем месяце будет хуже.', en: 'Costs nothing. Next month it will be worse.' },
        cost: () => 0,
        resolves: false,
      },
    ],
  },
  {
    id: 'lawsuit',
    weight: 5,
    minMonth: 10,
    title: { ru: 'Иск правообладателя', en: 'A rights holder sues' },
    text: {
      ru: 'Студия утверждает, что часть вашей библиотеки лицензирована с нарушением. До решения суда спорные часы заморожены.',
      en: 'A studio claims part of your library was licensed improperly. The disputed hours are frozen until the court rules.',
    },
    lesson: {
      ru: 'Арендованный каталог — это ещё и юридический риск: чужие права можно потерять по чужому решению.',
      en: 'A rented catalogue is also a legal risk: rights you do not own can be taken away by someone else’s decision.',
    },
    escalate: (m) => ({ licensedFreeze: clamp(0.16 + 0.07 * m, 0, 0.55), oneOffCost: 22_000_000 }),
    resolutions: [
      {
        id: 'settle',
        label: { ru: 'Урегулировать', en: 'Settle' },
        detail: { ru: 'Дорого и сразу. Каталог размораживается.', en: 'Expensive and immediate. The catalogue is unfrozen.' },
        cost: (m) => 180_000_000 + 40_000_000 * m,
        resolves: true,
      },
      {
        id: 'fight',
        label: { ru: 'Судиться', en: 'Fight it' },
        detail: { ru: 'Дешевле в месяц, но заморозка растёт.', en: 'Cheaper per month, but the freeze keeps growing.' },
        cost: () => 30_000_000,
        resolves: false,
      },
    ],
  },
  {
    id: 'showrunner',
    weight: 5,
    minMonth: 9,
    title: { ru: 'Шоураннер уходит к конкуренту', en: 'Your showrunner leaves for the rival' },
    text: {
      ru: 'Человек, на котором держалась вся производственная линейка, забирает с собой команду. Проекты встают.',
      en: 'The person the whole production slate rested on is taking the team with them. Projects are stalling.',
    },
    lesson: {
      ru: 'Производственный конвейер — это люди, а не бюджет. Деньги в студии не заменяют тех, кто умеет их потратить.',
      en: 'A production pipeline is people, not budget. Money in the studio does not replace the people who know how to spend it.',
    },
    escalate: (m) => ({ pipelineStall: m >= 2 ? 2 : 1, qualityMult: 1 - 0.12 * m }),
    resolutions: [
      {
        id: 'counter',
        label: { ru: 'Перебить предложение', en: 'Beat the offer' },
        detail: { ru: 'Команда остаётся, себестоимость производства растёт навсегда.', en: 'The team stays; your production costs rise for good.' },
        cost: () => 150_000_000,
        resolves: true,
        talentPenalty: 0.12,
      },
      {
        id: 'rebuild',
        label: { ru: 'Собрать новую команду', en: 'Build a new team' },
        detail: { ru: 'Дешевле, но текущие проекты теряют месяц и качество.', en: 'Cheaper, but current projects lose a month and some quality.' },
        cost: () => 45_000_000,
        resolves: true,
        pipelineDelay: 1,
        qualityHit: 0.15,
      },
    ],
  },
  {
    id: 'degradation',
    weight: 5,
    minMonth: 8,
    title: { ru: 'Платформа не выдерживает нагрузки', en: 'The platform is buckling' },
    text: {
      ru: 'Плеер падает на пиках, качество прыгает, поддержка завалена. Каждый месяц без вложений — хуже.',
      en: 'The player fails at peak, quality fluctuates, support is swamped. Every month without investment makes it worse.',
    },
    lesson: {
      ru: 'Технический долг ведёт себя как заём: пока не отдан, проценты капают оттоком.',
      en: 'Technical debt behaves like a loan: until it is repaid, the interest is charged in churn.',
    },
    escalate: (m) => ({ churnAdd: 0.008 * m, hoursMult: 1 - 0.05 * m, cdnMult: 1 + 0.06 * m }),
    resolutions: [
      {
        id: 'invest',
        label: { ru: 'Экстренно вложиться в платформу', en: 'Emergency platform investment' },
        detail: { ru: 'Разовые расходы, зато часть уходит в технологический запас.', en: 'A one-off cost, but part of it lands in your technology stock.' },
        cost: (m) => 90_000_000 + 30_000_000 * m,
        resolves: true,
        techGain: 0.6,
      },
      {
        id: 'patch',
        label: { ru: 'Заклеить и жить дальше', en: 'Patch it and move on' },
        detail: { ru: 'Дёшево. Проблема остаётся и растёт.', en: 'Cheap. The problem stays and grows.' },
        cost: () => 12_000_000,
        resolves: false,
      },
    ],
  },
];

export function crisisById(id) {
  return CRISES.find((c) => c.id === id) ?? null;
}

/**
 * Кризис приходит тем охотнее, чем крупнее и заметнее сервис.
 * Одновременно висит не больше одного: игра про управление, а не про пожар.
 */
export function rollCrisis(rng, month, { subs, active, lastResolved = -99 }) {
  if (active) return null;
  // Передышка после решённого кризиса. Компания, которая только что потушила
  // пожар и тут же получила второй, учит игрока не управлению, а невезению.
  if (month - lastResolved < CRISIS_COOLDOWN) return null;
  const pool = CRISES.filter((c) => month >= c.minMonth);
  if (!pool.length) return null;

  // 2% при пустом сервисе, до ~14% при миллионах подписчиков
  const scale = clamp(subs / 3_000_000, 0, 1);
  const chance = 0.02 + 0.12 * scale;
  if (rng() > chance) return null;

  const total = pool.reduce((s, c) => s + c.weight, 0);
  let roll = rng() * total;
  for (const c of pool) {
    roll -= c.weight;
    if (roll <= 0) return { id: c.id, months: 0 };
  }
  return { id: pool[pool.length - 1].id, months: 0 };
}

// Кризис ухудшается не бесконечно: через MAX_ESCALATION месяцев он выходит
// на полку. Это не милосердие, а честность — дальше он просто дорого стоит
// каждый месяц, и решение всё равно остаётся за игроком.
export const MAX_ESCALATION = 5;
export const CRISIS_COOLDOWN = 3;

export const severityOf = (active) => clamp(Math.max(1, (active?.months ?? 0) + 1), 1, MAX_ESCALATION);

/** Эффекты активного кризиса на текущий месяц. */
export function crisisEffects(active) {
  if (!active) return {};
  const def = crisisById(active.id);
  if (!def) return {};
  return def.escalate(severityOf(active));
}

/** Стоимость выбранного решения — зависит от того, сколько вы тянули. */
export function resolutionCost(active, resolutionId) {
  const def = crisisById(active?.id);
  const res = def?.resolutions.find((r) => r.id === resolutionId);
  if (!res) return 0;
  return res.cost(severityOf(active));
}

export function resolutionById(crisisId, resolutionId) {
  return crisisById(crisisId)?.resolutions.find((r) => r.id === resolutionId) ?? null;
}
