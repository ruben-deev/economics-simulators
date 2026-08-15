// Форматирование чисел для интерфейса.
// Разделители разрядов и суффиксы («млн» / «M») зависят от языка.
//
// Валюта тоже зависит от языка. Модель считает в рублях — все константы
// баланса, все замеры и все счёты в таблице рекордов рублёвые, и это не
// меняется. Меняется только показ: английская версия показывает доллары по
// зафиксированному курсу 100 ₽ = $1. Курс round-number намеренно: игрок
// должен уметь пересчитать в уме, а не гадать, по какому дню он взят.
// Единственное место, где число остаётся рублёвым, — строка результата и
// лидерборд: иначе одна таблица содержала бы две шкалы.

import { getLang, currency, curSymbol } from './i18n.js';

const LOCALE = { ru: 'ru-RU', en: 'en-US' };
const SUFFIX = {
  ru: { thousand: 'тыс', million: 'млн', billion: 'млрд', k: 'к', m: 'м' },
  en: { thousand: 'K', million: 'M', billion: 'B', k: 'K', m: 'M' },
};
const locale = () => LOCALE[getLang()] ?? 'ru-RU';
const suffix = () => SUFFIX[getLang()] ?? SUFFIX.ru;
const group = (x) => Math.round(x).toLocaleString(locale());

/** Рублёвая величина модели в валюте показа. */
export const cash = (x) => (Number.isFinite(x) ? x / currency().rate : x);
export { currency, curSymbol };

// Приписывает знак валюты с той стороны, с какой его пишут в этом языке.
const withCur = (text, sign = '') => {
  const c = currency();
  return c.prefix ? `${sign}${c.symbol}${text}` : `${sign}${text} ${c.symbol}`;
};

/**
 * Сумма-ставка — небольшая величина, которую показывают рядом с числом
 * («149 ₽ за доставку»). После пересчёта в доллары такие суммы становятся
 * дробными, поэтому знаков после запятой столько, сколько нужно, чтобы
 * ставка не схлопнулась в ноль.
 */
export function amount(x, digits = null) {
  if (!Number.isFinite(x)) return '—';
  const abs = Math.abs(cash(x));
  // В рублях модель оперирует целыми: копейки в интерфейсе — шум. В долларах
  // ставка вроде 22 ₽ превращается в 0.22, и без знаков после запятой она бы
  // схлопнулась в ноль.
  const d = digits ?? (currency().rate === 1 || abs === 0 || abs >= 10 ? 0 : 2);
  return withCur(num(abs, d), x < 0 ? '−' : '');
}

export function num(x, digits = 0) {
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Валютная ли это единица рычага: «₽», «₽/мес», «$/wk». */
export const isCurUnit = (unit) => /^[₽$]/.test(String(unit ?? ''));

/**
 * Сумма с единицей рычага: «149 ₽/нед» и «$1.49/wk». Знак валюты живёт в
 * price(), а из единицы берётся только хвост — иначе в английской версии
 * рядом оказались бы два знака.
 */
export function amountIn(x, unit) {
  const tail = String(unit ?? '').replace(/^[₽$]/, '').trimStart();
  return `${amount(x)}${tail}`;
}

export function money(x) {
  if (!Number.isFinite(x)) return '—';
  const abs = Math.abs(cash(x));
  const sign = x < 0 ? '−' : '';
  const s = suffix();
  const c = currency();
  const scaled = (v, unit) => (c.prefix ? `${v}${unit}` : `${v} ${unit}`);
  if (abs >= 1e9) return withCur(scaled((abs / 1e9).toFixed(2), s.billion), sign);
  if (abs >= 1e6) return withCur(scaled((abs / 1e6).toFixed(abs >= 1e7 ? 1 : 2), s.million), sign);
  if (abs >= 1e3) return withCur(group(abs), sign);
  return withCur(abs.toFixed(c.rate > 1 && abs > 0 && abs < 10 ? 2 : 0), sign);
}

export function moneyExact(x) {
  if (!Number.isFinite(x)) return '—';
  return withCur(group(Math.abs(cash(x))), x < 0 ? '−' : '');
}

// Короткие подписи на осях графиков
export function axisNum(v) {
  const s = suffix();
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}${s.m}`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}${s.k}`;
  return String(Math.round(v));
}

export function pct(x, digits = 1) {
  if (!Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(digits)}%`;
}

// Минус — типографский, как и во всех остальных числах интерфейса:
// дефис рядом с «+» читается как другой по величине знак.
export function signedPct(x, digits = 1) {
  if (!Number.isFinite(x)) return '—';
  const v = (Math.abs(x) * 100).toFixed(digits);
  if (Number(v) === 0) return `0${'%'}`;
  return `${x > 0 ? '+' : '−'}${v}%`;
}

export function compact(x) {
  if (!Number.isFinite(x)) return '—';
  const abs = Math.abs(x);
  const s = suffix();
  if (abs >= 1e6) return `${(x / 1e6).toFixed(1)} ${s.million}`;
  if (abs >= 1e3) return `${(x / 1e3).toFixed(1)} ${s.thousand}`;
  return group(x);
}
