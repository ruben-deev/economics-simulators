// ============================================================================
// Маяки воронки: «партия начата», «дошёл до 5-го хода», «дошёл до финала».
//
// Зачем: единственный вопрос, на который сайт до сих пор не мог ответить, —
// где новички отваливаются в первые три минуты. Три маяка отвечают на него
// целиком: start/turn5 говорит о пороге входа, turn5/finale — о длине партии.
//
// Что это НЕ делает: не следит за игроком. Уходит только имя игры и веха —
// ни имени, ни счёта, ни кода партии, ни чего-либо про устройство. Уходит
// только там, где страница знает адрес сервера рекордов (онлайн-версия);
// в офлайн-файлах адреса нет, и модуль молчит. Любая ошибка проглатывается:
// маяк никогда не важнее игры.
//
// Дедупликация на устройстве: одна веха на игру и партию (сид), чтобы
// перезагрузка страницы не считалась новым игроком.
// ============================================================================

function endpoint() {
  return (typeof window !== 'undefined' && window.__lbEndpoint) || null;
}

function sentKey(game, milestone, seed) {
  return `metric-${game}-${milestone}-${seed || ''}`;
}

/** Отправить веху: mark('НОВОЕДА', 'turn5', state.seed). Тихо и один раз. */
export function markMilestone(game, milestone, seed) {
  const base = endpoint();
  if (!base) return;
  const key = sentKey(game, milestone, seed);
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
  } catch { /* приватный режим: маяк уйдёт, дедуп не сработает — не страшно */ }
  const body = JSON.stringify({ metric: { game, m: milestone } });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(base, body);
    } else {
      fetch(base, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body })
        .catch(() => {});
    }
  } catch { /* не критично */ }
}
