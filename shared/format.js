// Форматирование чисел для интерфейса.
// Разделители разрядов и суффиксы («млн» / «M») зависят от языка.

import { getLang } from './i18n.js';

const LOCALE = { ru: 'ru-RU', en: 'en-US' };
const SUFFIX = {
  ru: { thousand: 'тыс', million: 'млн', billion: 'млрд', k: 'к', m: 'м' },
  en: { thousand: 'K', million: 'M', billion: 'B', k: 'K', m: 'M' },
};

const locale = () => LOCALE[getLang()] ?? 'ru-RU';
const suffix = () => SUFFIX[getLang()] ?? SUFFIX.ru;
const group = (x) => Math.round(x).toLocaleString(locale());

export function num(x, digits = 0) {
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function money(x) {
  if (!Number.isFinite(x)) return '—';
  const abs = Math.abs(x);
  const sign = x < 0 ? '−' : '';
  const s = suffix();
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} ${s.billion} ₽`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(abs >= 1e7 ? 1 : 2)} ${s.million} ₽`;
  if (abs >= 1e3) return `${sign}${group(abs)} ₽`;
  return `${sign}${abs.toFixed(0)} ₽`;
}

export function moneyExact(x) {
  if (!Number.isFinite(x)) return '—';
  return `${x < 0 ? '−' : ''}${group(Math.abs(x))} ₽`;
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

export function signedPct(x, digits = 1) {
  if (!Number.isFinite(x)) return '—';
  return `${x > 0 ? '+' : ''}${(x * 100).toFixed(digits)}%`;
}

export function compact(x) {
  if (!Number.isFinite(x)) return '—';
  const abs = Math.abs(x);
  const s = suffix();
  if (abs >= 1e6) return `${(x / 1e6).toFixed(1)} ${s.million}`;
  if (abs >= 1e3) return `${(x / 1e3).toFixed(1)} ${s.thousand}`;
  return group(x);
}
