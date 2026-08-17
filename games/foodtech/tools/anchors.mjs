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
  // Осторожная: два района, курьеров под спрос, но подключение ресторанов
  // оплачено — без него маркетплейс пуст, и любая опора вырождается
  осторожная: (s) => ({
    ...DEFAULT_DECISIONS,
    districts: home.slice(0, 2),
    deliveryFee: 169, commissionRate: 0.22, courierPay: 175,
    targetCouriers: s.week >= 8 ? 320 : 200,
    marketing: 500_000, sales: 250_000, tech: 300_000,
  }),
  // Сбалансированная: домашний город наполовину, курьеров с запасом
  сбалансированная: (s) => ({
    ...DEFAULT_DECISIONS,
    districts: home.slice(0, 4),
    deliveryFee: 129, commissionRate: 0.20, courierPay: 195,
    targetCouriers: s.week >= 8 ? 800 : 450,
    marketing: 1_400_000, sales: 450_000, tech: 800_000,
  }),
  // Агрессивная: весь город, дешёвая доставка, много курьеров и рекламы.
  // Это настоящая стратегия, а не самоубийство: банкротства редки, но есть —
  // на том и стоит риск.
  агрессивная: (s) => ({
    ...DEFAULT_DECISIONS,
    districts: home,
    deliveryFee: 119, commissionRate: 0.19, courierPay: 200,
    targetCouriers: s.week >= 8 ? 900 : 500,
    marketing: 1_600_000, sales: 500_000, tech: 900_000,
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
