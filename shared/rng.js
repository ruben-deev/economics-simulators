// Детерминированный генератор псевдослучайных чисел (mulberry32).
// Нужен, чтобы одна и та же игра с одним и тем же seed воспроизводилась точно:
// это важно и для тестов, и для учебных сценариев («у всей группы одинаковый город»).

export function hashSeed(str) {
  const s = String(str);
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function createRng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  const rng = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.state = () => a >>> 0;
  rng.restore = (s) => { a = s >>> 0; };
  return rng;
}

// Случайное число из диапазона
export function between(rng, min, max) {
  return min + rng() * (max - min);
}

// Выбор элемента с весами: items = [{weight, ...}]
export function weightedPick(rng, items) {
  const total = items.reduce((s, i) => s + (i.weight ?? 1), 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight ?? 1;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}
