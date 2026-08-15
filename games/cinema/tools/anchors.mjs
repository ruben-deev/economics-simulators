// Якорные стратегии КИНОРЕКИ.
//
// Политика здесь не только числа: стриминг ещё запускает проекты и выпускает
// готовое, и без этих действий любая опора вырождается в пустой каталог.
// Отсюда три опоры по контентной ставке: лицензии и мало своего (дёшево, но
// каталог тает), ровный конвейер, и дорогая ставка на собственные хиты.
//
// Запуск: node games/cinema/tools/anchors.mjs [лёгкий|обычный|сложный]
import {
  createInitialState, step, finalScore, raise,
} from '../src/model/engine.js';
import { CONFIG, DEFAULT_DECISIONS } from '../src/model/config.js';
import { seasonOf } from '../src/model/market.js';
import { SEEDS, runPolicy, line } from '../../../shared/tools/measure.js';

export const ANCHORS = {
  // Лицензионная: чужой каталог, свои проекты редко, цена низкая
  лицензионная: {
    base: 300e6, price: 349, ad: 9, slots: 2, annual: 0.15,
    campaign: 100e6, brand: 120e6, genre: 'family', segment: 'mass',
  },
  // Ровная: конвейер из трёх слотов, цена посередине
  ровная: {
    base: 440e6, price: 449, ad: 6, slots: 3, annual: 0.1,
    campaign: 250e6, brand: 220e6, genre: 'family', segment: 'mass',
  },
  // Своя студия: дорогое производство, громкие премьеры, ставка на киномана.
  // Дороже этой планки опора перестаёт быть стратегией: на четырёх слотах и
  // кампаниях по 400 млн партия разоряется на всех кодах.
  студийная: {
    base: 520e6, price: 499, ad: 4, slots: 3, annual: 0.05,
    campaign: 300e6, brand: 250e6, genre: 'drama', segment: 'cinephile',
  },
};

/**
 * Одна партия. Раунды берутся по очереди, когда касса проседает; готовое
 * придерживается до высокого сезона — так делает и живой игрок.
 */
export function play(P, seed, difficulty = 'normal') {
  let state = createInitialState(seed, difficulty);
  let raises = 0;
  let n = 0;
  for (let i = 0; i < CONFIG.monthsTotal && !state.over; i++) {
    if (state.cash < 800_000_000 && raises < CONFIG.fundingOptions.length) {
      state = raise(state, CONFIG.fundingOptions[raises]).state;
      raises += 1;
    }
    const slate = state.slate ?? [];
    const producing = slate.filter((p) => p.status === 'production').length;
    const ready = slate.filter((p) => p.status === 'ready');
    const commission = producing < P.slots
      ? [{ genre: P.genre, scale: n++ % 2 ? 'pilot' : 'season', segment: P.segment }] : [];
    const season = seasonOf(state.month + 1);
    const good = season === 'winter' || season === 'autumn';
    const release = ready
      .filter((p) => good || p.monthsHeld >= 4)
      .map((p) => ({ id: p.id, campaign: P.campaign }));
    state = step(state, {
      decisions: {
        ...DEFAULT_DECISIONS,
        priceNew: P.price, priceAds: Math.round(P.price * 0.37), adLoad: P.ad,
        annualDiscount: P.annual, licensing: P.base, brandMarketing: P.brand,
        tech: 20e6, rnd: 20e6, studioSlots: P.slots,
      },
      commission, release, eventChoice: 0,
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
  console.log(`=== КИНОРЕКА · якорные стратегии · уровень ${level} · ${SEEDS.length} кодов ===`);
  for (const [name, r] of Object.entries(measure(level))) console.log(line(name, r));
}
