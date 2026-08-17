// ============================================================================
// Общие органы управления набора: полоса бюджета и политики.
//
// Оба появились в НОВОГРАДЕ и оказались нужны всем играм: инвентаризация
// показала, что у КИНОРЕКИ и БИЛЕТВИЛЯ расходных рычагов больше, а ни полосы
// «куда уходят деньги», ни решений с именами нет вовсе — двенадцать
// одинаковых ползунков подряд читаются как экран настроек, а не как решения.
//
// Разница между режимами политики:
//   'replace' — режимы ЗАМЕНЯЮТ ползунок (так в НОВОГРАДЕ: решение уровня
//               совета директоров не имеет промежуточных значений);
//   'preset'  — режимы стоят НАД ползунком и просто ставят значение. Так в
//               старых играх: их кривые отклика острые (у цены подписки
//               КИНОРЕКИ соседние 50 ₽ дают разницу в десятки процентов),
//               и дискретизация тихо срезала бы верх стратегии. Имена и
//               последствия появляются, достижимые значения — прежние.
//
// Модуль без состояния: строит разметку и синхронизирует её с числом.
// ============================================================================

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * Разметка политики: ряд названных режимов и строка последствий выбранного.
 * lever: { key, policy: [{ v, label, note }], scale? }
 * tx: разворачиватель двуязычных полей.
 */
export function policyHtml(lever, tx) {
  return `<div class="policy-seg" data-policy="${esc(lever.key)}">
      ${lever.policy.map((p) => `<button type="button" data-policy-value="${p.v}">${tx(p.label)}</button>`).join('')}
    </div>
    <div class="policy-note" id="note-${esc(lever.key)}"></div>`;
}

/**
 * Подсветить выбранный режим и показать его последствия. Работает и когда
 * точное значение выставлено ползунком мимо режимов: тогда не подсвечен
 * никто, а строка последствий берётся от ближайшего режима — иначе игрок
 * теряет объяснение, стоит чуть сдвинуть ползунок.
 */
export function syncPolicy(root, lever, value, tx, customLabel = '') {
  const box = root.querySelector(`[data-policy="${lever.key}"]`);
  if (!box) return null;
  const raw = value / (lever.scale ?? 1);
  let exact = null;
  let nearest = lever.policy[0];
  for (const p of lever.policy) {
    if (Math.abs(p.v - raw) < 1e-9) exact = p;
    if (Math.abs(p.v - raw) < Math.abs(nearest.v - raw)) nearest = p;
  }
  box.querySelectorAll('[data-policy-value]').forEach((b) => {
    b.classList.toggle('active', exact !== null && Math.abs(Number(b.dataset.policyValue) - raw) < 1e-9);
  });
  const note = root.querySelector(`#note-${lever.key}`);
  if (note) {
    note.innerHTML = exact
      ? tx(exact.note)
      : `${customLabel ? `<b>${esc(customLabel)}</b> · ` : ''}${tx(nearest.note)}`;
  }
  return exact ?? nearest;
}

/**
 * Полоса бюджета: куда уходят деньги этого хода.
 * items: [{ key, label, value, color }] — нулевые статьи не показываются.
 * note — готовая строка под полосой (вклад, остаток), необязательна.
 */
export function budgetBarHtml({ title, items, note = '' }) {
  const shown = items.filter((i) => i.value > 0);
  const total = shown.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return '';
  const seg = (i) => `<span style="width:${(100 * i.value / total).toFixed(1)}%;background:${i.color}"></span>`;
  const leg = (i, money) => `<span><i style="background:${i.color}"></i>${i.label} ${money(i.value)}</span>`;
  return { total, shown, seg, leg };
}

/**
 * Готовая разметка полосы. money — форматтер набора (shared/format.js).
 */
export function renderBudgetBar({ title, items, note = '', money }) {
  const parts = budgetBarHtml({ title, items });
  if (!parts) return '';
  const { shown, seg, leg } = parts;
  return `<div class="hint-box" style="margin-bottom:12px">
    <div>${title}</div>
    <div class="budget-bar">${shown.map(seg).join('')}</div>
    <div class="budget-legend">${shown.map((i) => leg(i, money)).join('')}</div>
    ${note ? `<div class="funding-note" style="margin-top:4px">${note}</div>` : ''}
  </div>`;
}
