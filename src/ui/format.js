// Форматирование чисел для интерфейса

const nf = new Intl.NumberFormat('ru-RU');

export function num(x, digits = 0) {
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function money(x) {
  if (!Number.isFinite(x)) return '—';
  const abs = Math.abs(x);
  const sign = x < 0 ? '−' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} млрд ₽`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(abs >= 1e7 ? 1 : 2)} млн ₽`;
  if (abs >= 1e3) return `${sign}${nf.format(Math.round(abs))} ₽`;
  return `${sign}${abs.toFixed(0)} ₽`;
}

export function moneyExact(x) {
  if (!Number.isFinite(x)) return '—';
  return `${x < 0 ? '−' : ''}${nf.format(Math.round(Math.abs(x)))} ₽`;
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
  if (abs >= 1e6) return `${(x / 1e6).toFixed(1)} млн`;
  if (abs >= 1e3) return `${(x / 1e3).toFixed(1)} тыс`;
  return nf.format(Math.round(x));
}
