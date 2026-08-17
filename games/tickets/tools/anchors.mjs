// Якорные стратегии БИЛЕТВИЛЯ.
//
// Главный выбор игры — с кого брать: с покупателя сервисным сбором или с
// организатора комиссией, и ставить ли виджет на его сайт. Отсюда три опоры:
// дешёвая для организатора (берём с покупателя), дешёвая для покупателя
// (берём с организатора) и платформенная (виджет всем и маховик охвата).
//
// Кризисы опоры решают: с частотой, перекалиброванной аудитом 2026-08
// (2–4 кризиса за партию), «не замечать кризисы» — не стратегия, а
// самоуничтожение (замер: игнор роняет медиану опор с ~4 до ~0.8 млрд).
// Решение — первое разрешающее, как сделал бы занятый игрок.
//
// Запуск: node games/tickets/tools/anchors.mjs [лёгкий|обычный|сложный]
import {
  createInitialState, step, finalScore, raise,
} from '../src/model/engine.js';
import { CONFIG, DEFAULT_DECISIONS, ORGANIZERS } from '../src/model/config.js';
import { crisisById } from '../src/model/crises.js';
import { SEEDS, runPolicy, line } from '../../../shared/tools/measure.js';

const platformFor = (ids) => Object.fromEntries(
  ORGANIZERS.map((o) => [o.id, ids.includes(o.id)]));

export const ANCHORS = {
  // С покупателя: высокий сервисный сбор, комиссия организатору низкая
  'сбор с покупателя': {
    buyerFee: 0.16, orgCommission: 0.03, marketing: 40e6, managers: 25,
    onboarding: 0, platform: [], product: 12e6, support: 8e6, capacityTech: 6e6,
  },
  // С организатора: покупателю дёшево, организатору дорого
  'сбор с организатора': {
    buyerFee: 0.05, orgCommission: 0.10, marketing: 30e6, managers: 35,
    onboarding: 0, platform: [], product: 12e6, support: 10e6, capacityTech: 6e6,
  },
  // Платформенная: виджет всем типам, абонплата за пакет, онбординг и
  // маркетинг выше критической массы маховика (~45–50 млн/мес — ниже
  // маховик «охват -> организаторы -> афиша -> зрители» не заводится).
  // Пересобрана аудитом 2026-08: прежняя (виджет только клубам и театрам,
  // маркетинг 35 млн) давала столько же, сколько простые опоры, и вершину
  // жанра не охраняла.
  платформенная: {
    buyerFee: 0.05, orgCommission: 0.10, marketing: 60e6, managers: 35,
    onboarding: 20e6, platform: ['club', 'theatre', 'sport', 'concert'],
    product: 30e6, support: 10e6, capacityTech: 10e6, platformDev: 20e6,
    platformRate: 0.035, platformFee: 60_000, finance: 3e6,
  },
};

export function play(P, seed, difficulty = 'normal') {
  let state = createInitialState(seed, difficulty);
  let raises = 0;
  for (let i = 0; i < CONFIG.monthsTotal && !state.over; i++) {
    if (state.cash < 300e6 && raises < CONFIG.fundingOptions.length) {
      state = raise(state, CONFIG.fundingOptions[raises]).state;
      raises += 1;
    }
    // Кризис решается сразу первым разрешающим способом
    const crisisChoice = state.crisis
      ? crisisById(state.crisis.id)?.resolutions.find((r) => r.resolves)?.id ?? null
      : null;
    state = step(state, {
      decisions: {
        ...DEFAULT_DECISIONS,
        buyerFee: P.buyerFee, orgCommission: P.orgCommission,
        marketing: P.marketing, managers: P.managers, onboarding: P.onboarding,
        platformDev: P.platformDev ?? 8e6, product: P.product,
        support: P.support, capacityTech: P.capacityTech,
        platformRate: P.platformRate ?? DEFAULT_DECISIONS.platformRate,
        platformFee: P.platformFee ?? DEFAULT_DECISIONS.platformFee,
        finance: P.finance ?? 0,
        platformFor: platformFor(P.platform),
      },
      eventChoice: 0,
      crisisChoice,
    }).state;
  }
  return finalScore(state);
}

export function measure(difficulty = 'normal', seeds = SEEDS) {
  return Object.fromEntries(Object.entries(ANCHORS).map(([name, P]) => [
    name, runPolicy((seed) => play(P, seed, difficulty), seeds),
  ]));
}

const LEVELS = { лёгкий: 'easy', обычный: 'normal', сложный: 'hard' };
if (import.meta.url === `file://${process.argv[1]}`) {
  const level = LEVELS[process.argv[2]] ?? 'normal';
  console.log(`=== БИЛЕТВИЛЬ · якорные стратегии · уровень ${level} · ${SEEDS.length} кодов ===`);
  for (const [name, r] of Object.entries(measure(level))) console.log(line(name, r));
}
