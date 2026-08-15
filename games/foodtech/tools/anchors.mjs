// Якорные стратегии НОВОЕДЫ.
//
// Три опоры, между которыми и лежит игра: осторожная (беречь кассу),
// сбалансированная (расти на марже) и агрессивная (покупать рост). Опоры
// нужны не сами по себе — по ним меряется любая правка модели: если правка
// двигает все три в одну сторону, она меняет сложность, а если разводит их,
// то меняет стратегию. Второе интереснее, но и опаснее.
//
// Запуск: node games/foodtech/tools/anchors.mjs [лёгкий|обычный|сложный]
import {
  createInitialState, step, finalScore, raise,
} from '../src/model/engine.js';
import { CONFIG, DEFAULT_DECISIONS, DISTRICTS } from '../src/model/config.js';
import { SEEDS, runPolicy, line } from '../../../shared/tools/measure.js';

const home = DISTRICTS.filter((d) => d.city === 'novograd').map((d) => d.id);

export const ANCHORS = {
  // Осторожная: два района, курьеров под спрос, маркетинг щадящий
  осторожная: (s) => ({
    ...DEFAULT_DECISIONS,
    districts: home.slice(0, 2),
    deliveryFee: 169, commissionRate: 0.22, courierPay: 170,
    targetCouriers: 220, marketing: 400_000, tech: 300_000,
  }),
  // Сбалансированная: домашний город целиком, курьеров с запасом
  сбалансированная: (s) => ({
    ...DEFAULT_DECISIONS,
    districts: home.slice(0, 4),
    deliveryFee: 149, commissionRate: 0.20, courierPay: 190,
    targetCouriers: s.week >= 10 ? 620 : 380,
    marketing: 900_000, tech: 700_000, rnd: 300_000,
  }),
  // Агрессивная: весь город, дешёвая доставка, много курьеров и рекламы
  агрессивная: (s) => ({
    ...DEFAULT_DECISIONS,
    districts: home,
    deliveryFee: 99, commissionRate: 0.17, courierPay: 210,
    targetCouriers: s.week >= 8 ? 1100 : 600,
    marketing: 2_200_000, promo: 900_000, tech: 1_200_000, rnd: 600_000,
  }),
};

/** Одна партия: раунды берутся, когда касса проседает ниже подушки. */
export function play(policy, seed, difficulty = 'normal') {
  let s = createInitialState(seed, difficulty);
  for (let i = 0; i < CONFIG.weeksTotal && !s.over; i++) {
    if (s.week >= CONFIG.minWeekForFunding && s.cash < 60_000_000) {
      s = raise(s, CONFIG.fundingOptions[1]).state;
    }
    s = step(s, { decisions: policy(s), eventChoice: 0 }).state;
  }
  return finalScore(s);
}

export function measure(difficulty = 'normal', seeds = SEEDS) {
  return Object.fromEntries(Object.entries(ANCHORS).map(([name, policy]) => [
    name, runPolicy((seed) => play(policy, seed, difficulty), seeds),
  ]));
}

const LEVELS = { лёгкий: 'easy', обычный: 'normal', сложный: 'hard' };
if (import.meta.url === `file://${process.argv[1]}`) {
  const level = LEVELS[process.argv[2]] ?? 'normal';
  console.log(`=== НОВОЕДА · якорные стратегии · уровень ${level} · ${SEEDS.length} кодов ===`);
  const res = measure(level);
  for (const [name, r] of Object.entries(res)) console.log(line(name, r, CONFIG.startCash ?? 0));
}
