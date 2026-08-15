// Якорные стратегии НОВОГРАДА.
//
// Выбор игры — сколько вертикалей поднимать и когда. Отсюда три опоры: доить
// стартовый актив и не рисковать, поднять одно такси, собрать полную
// экосистему с подпиской и партнёрствами. Стартовый актив по умолчанию
// доставка; другой берётся вторым аргументом.
//
// Запуск: node games/ecosystem/tools/anchors.mjs [лёгкий|обычный|сложный] [delivery|streaming|tickets]
import {
  createInitialState, step, finalScore, raise,
} from '../src/model/engine.js';
import { CONFIG, DEFAULT_DECISIONS } from '../src/model/config.js';
import { SEEDS, runPolicy, line } from '../../../shared/tools/measure.js';

export const ANCHORS = {
  // Дойная корова: вертикалей нет, вся игра — цена и удержание хаба
  'только хаб': (s) => ({
    ...DEFAULT_DECISIONS,
    verticals: [],
    foodTake: 1.06, foodOps: 5e6, foodMarketing: 3e6, finance: 3e6,
  }),
  // Вторая нога: такси с первого месяца, е-кома нет
  'хаб и такси': (s) => ({
    ...DEFAULT_DECISIONS,
    verticals: ['taxi'],
    foodTake: 1, foodOps: 4e6, foodMarketing: 2e6,
    crossSell: s.taxi.on ? 5e6 : 0, mgmt: s.taxi.on ? 8e6 : 0,
    taxiSupply: 9e6, taxiMarketing: 12e6, finance: 3e6,
  }),
  // Полная экосистема: такси, е-ком, Plus и партнёрства
  экосистема: (s) => ({
    ...DEFAULT_DECISIONS,
    verticals: ['taxi', ...(s.month + 1 >= 12 ? ['ecom'] : []),
      ...(s.taxi.on && s.month + 1 >= 8 ? ['plus'] : [])],
    partners: s.plus.on ? ['cinema', 'tickets'] : [],
    foodTake: 1, foodOps: 4e6, foodMarketing: 2e6,
    crossSell: s.ecom.on ? 6e6 : 3e6, mgmt: s.ecom.on ? 11e6 : 8e6,
    taxiSupply: 9e6, taxiMarketing: 14e6,
    ecomOps: 2e6, ecomMarketing: 6e6, ecomLogistics: 3e6,
    plusPrice: 299, finance: 3e6,
  }),
};

/** Одна партия. Раунд берётся, когда касса опускается ниже подушки. */
export function play(policy, seed, { difficulty = 'normal', assetId = 'delivery', legacy = {} } = {}) {
  let s = createInitialState(seed, assetId, legacy, difficulty);
  for (let i = 0; i < CONFIG.monthsTotal && !s.over; i++) {
    // Подушка 200 млн, а не 120: на 120 полная экосистема разоряется на
    // девяти кодах из двадцати четырёх — замер мерил бы не стратегию, а
    // выдержку кассы между раундами
    if (s.month >= CONFIG.minMonthForFunding && s.cash < 200e6) {
      s = raise(s, CONFIG.fundingOptions[1]).state;
    }
    // Перемирие с хозяином рынка принимается: замер политики, а не удачи
    const choice = s.pendingEvent?.id === 'truce_offer' ? 1 : 0;
    s = step(s, { decisions: policy(s), eventChoice: choice }).state;
  }
  return finalScore(s);
}

export function measure(difficulty = 'normal', assetId = 'delivery', seeds = SEEDS) {
  return Object.fromEntries(Object.entries(ANCHORS).map(([name, policy]) => [
    name, runPolicy((seed) => play(policy, seed, { difficulty, assetId }), seeds),
  ]));
}

const LEVELS = { лёгкий: 'easy', обычный: 'normal', сложный: 'hard' };
if (import.meta.url === `file://${process.argv[1]}`) {
  const level = LEVELS[process.argv[2]] ?? 'normal';
  const asset = process.argv[3] ?? 'delivery';
  console.log(`=== НОВОГРАД · якорные стратегии · уровень ${level} · актив ${asset} · ${SEEDS.length} кодов ===`);
  for (const [name, r] of Object.entries(measure(level, asset))) console.log(line(name, r));
}
