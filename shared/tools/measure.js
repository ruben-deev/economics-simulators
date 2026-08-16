// Измерительный каркас набора.
//
// Методология простая и одна на все четыре игры (см. HANDOFF.md):
//
//   * партия играется политикой — функцией «состояние → решения», а не
//     руками; иначе замер меряет настроение измеряющего;
//   * настоящее банкротство (долг съел и цену продажи) считается нулём, а
//     не отрицательным числом: иначе одна разорившаяся партия перевешивает
//     десять удачных. Продажа за долги (см. valuation.distressedSale) —
//     не ноль: партия получает ликвидационную стоимость, и рядом с медианой
//     печатается «продаж за долги N/24»;
//   * сравниваются МЕДИАНЫ, а не средние: средние переворачиваются от одного
//     банкротства, медиана — нет;
//   * кодов партии берётся не меньше двадцати четырёх. На восьми кодах шум
//     выборки однажды уже показал три несуществующих вывода, которые пришлось
//     отменять (см. docs/roadmap-cinema-tickets.md);
//   * рядом с медианой всегда пишется «в плюсе N/24» — доля партий, где
//     политика вообще заработала: медиана без неё не отличает ровный
//     результат от лотереи.
//
// Здесь только общие примитивы. Политики и якорные стратегии живут в
// games/<игра>/tools/anchors.mjs — они у каждой игры свои.

/** Двадцать четыре кода партии: фиксированные, чтобы замеры сравнивались. */
export const SEEDS = Array.from({ length: 24 }, (_, i) => `замер-${i + 1}`);

export const quantile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.floor((sorted.length - 1) * p)];
};

export const median = (values) => quantile(values, 0.5);

export const mean = (values) => (values.length
  ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/**
 * Прогон одной политики по всем кодам.
 * @param {(seed: string) => {equityValue: number, bankrupt: boolean}} play
 * @param {string[]} seeds
 */
export function runPolicy(play, seeds = SEEDS) {
  const scores = [];
  let bankrupts = 0;
  let sold = 0;
  for (const seed of seeds) {
    const f = play(seed);
    // Продажа за долги (f.sold) — не ноль: партия получает ликвидационную
    // стоимость. Нулём остаётся только настоящее банкротство, где долг
    // съел и цену продажи.
    if (f.bankrupt) { bankrupts += 1; scores.push(0); } else {
      if (f.sold) sold += 1;
      scores.push(f.equityValue);
    }
  }
  return {
    scores,
    median: median(scores),
    p25: quantile(scores, 0.25),
    p75: quantile(scores, 0.75),
    bankrupts,
    sold,
    // «В плюсе»: партия, где итог выше вложенного капитала, — то есть
    // политика не просто выжила, а заработала
    inPlus: (base) => scores.filter((v) => v > base).length,
  };
}

const money = (v) => (Math.abs(v) >= 1e9
  ? `${(v / 1e9).toFixed(2)} млрд`
  : `${(v / 1e6).toFixed(0)} млн`);

/** Строка отчёта в том виде, в каком её читают в замерах. */
export function line(name, res, base = 0) {
  const plus = res.inPlus(base);
  return `${name.padEnd(14)} медиана ${money(res.median).padStart(10)}`
    + ` · квартили ${money(res.p25)} / ${money(res.p75)}`
    + ` · в плюсе ${plus}/${res.scores.length}`
    + ` · банкротств ${res.bankrupts}/${res.scores.length}`
    + (res.sold ? ` · продаж за долги ${res.sold}/${res.scores.length}` : '');
}

export { money };
