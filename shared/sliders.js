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

// Тап по значению ползунка открывает числовое поле: на телефоне пальцем
// точное значение не поймать (замечание из плейтеста). Поле живёт на месте
// значения, Enter/blur применяют число через обычное событие input —
// для игры это неотличимо от перетаскивания ручки.
function editSliderValue(valueEl) {
  const box = valueEl.closest('.lever') ?? valueEl.parentElement?.parentElement;
  const range = box ? box.querySelector('input[type="range"]') : null;
  if (!range || valueEl.querySelector('input')) return;
  const prevHtml = valueEl.innerHTML;
  const field = document.createElement('input');
  field.type = 'number';
  field.min = range.min; field.max = range.max; field.step = range.step || '1';
  field.value = range.value;
  field.style.cssText = 'width:82px;padding:2px 6px;background:transparent;'
    + 'border:1px solid var(--line);border-radius:5px;color:inherit;'
    + 'font:inherit;font-variant-numeric:tabular-nums;text-align:right';
  valueEl.textContent = '';
  valueEl.appendChild(field);
  field.focus();
  field.select();
  let done = false;
  const finish = (apply) => {
    if (done) return;
    done = true;
    if (apply && field.value !== '') {
      const min = Number(range.min || 0);
      const max = Number(range.max || 100);
      range.value = String(Math.max(min, Math.min(max, Number(field.value))));
      range.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (field.parentElement === valueEl) {
      // Отмена: игра ничего не перерисует, вернём значение сами
      valueEl.innerHTML = prevHtml;
    }
  };
  field.addEventListener('blur', () => finish(true));
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); field.blur(); }
    if (e.key === 'Escape') { finish(false); }
  });
}

export function watchSliders(root = document) {
  root.addEventListener('input', (e) => {
    const el = e.target;
    if (el && el.tagName === 'INPUT' && el.type === 'range') setFill(el);
  }, true);

  root.addEventListener('click', (e) => {
    const valueEl = e.target && e.target.closest ? e.target.closest('.lever-value') : null;
    if (valueEl) editSliderValue(valueEl);
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
