// ============================================================================
// Заливка ползунков до ручки. В WebKit дорожку красит переменная --fill
// (процент положения ручки), которую CSS подставляет в градиент; Firefox
// рисует заливку сам через ::-moz-range-progress и в скрипте не нуждается,
// но лишняя переменная ему не мешает.
//
// Один вызов на игру: слушатель ввода на документе плюс пересчёт всех
// ползунков после любых перестроек DOM (панели пересобираются каждый ход,
// а значения ползункам ставит скрипт — событий ввода при этом нет).
// ============================================================================

function setFill(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const v = Number(input.value);
  const p = max > min ? ((v - min) / (max - min)) * 100 : 0;
  input.style.setProperty('--fill', `${Math.max(0, Math.min(100, p)).toFixed(1)}%`);
}

export function watchSliders(root = document) {
  root.addEventListener('input', (e) => {
    const el = e.target;
    if (el && el.tagName === 'INPUT' && el.type === 'range') setFill(el);
  }, true);

  let queued = false;
  const sweep = () => {
    queued = false;
    root.querySelectorAll('input[type="range"]').forEach(setFill);
  };
  // Пересчёт откладывается до кадра: перестройка панелей — это сотни
  // мутаций подряд, а пройтись по трём десяткам ползунков хватит одного раза
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(sweep);
  });
  observer.observe(root.body ?? root, { childList: true, subtree: true, attributes: true, attributeFilter: ['value'] });
  sweep();
}
