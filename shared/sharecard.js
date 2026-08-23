// ============================================================================
// Карточка результата «поделиться»: картинка 1200×630 на канвасе.
//
// Одна картинка рассказывает партию целиком: заголовок-приглашение, кривая
// оценки по ходам с подписанными переломами, полоска ходов (зелёный — ход в
// плюс, тёмный — в ноль, красный — в минус, синее кольцо — самое дорогое
// решение) и кнопка-вызов. Всё собирается из state.history — выдумывать и
// подписывать вручную нечего. Кода партии на карточке нет сознательно:
// строка результата с кодом остаётся в финальном окне для тех, кто хочет
// сравниться, а картинка зовёт играть, не пугая служебным.
//
// Модуль ничего не знает об играх: строки и числа приходят готовыми.
// Канвас, а не SVG: картинку надо отдать файлом в системное «поделиться»,
// и toBlob() — короткий путь без прослоек. Рисуем в двукратном масштабе,
// иначе текст мылится на телефонных экранах.
// Safari 14.1: без roundRect(), ctx.filter, letterSpacing и OffscreenCanvas —
// свечение линии имитируется широкими полупрозрачными обводками.
// ============================================================================

const W = 1200;
const H = 630;
const SCALE = 2;
const FONT = '-apple-system, "Segoe UI", Roboto, sans-serif';

const COL = {
  bg: '#0b1120', text: '#e2e8f0', muted: '#94a3b8',
  good: '#4ade80', bad: '#f87171', flat: '#243352', pick: '#60a5fa',
  chipBg: '#0e1730', chipLine: 'rgba(148,163,184,0.25)', btnText: '#06240f',
};

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ----------------------------------------------------------------------------
// data = {
//   emoji, name, sub,                — шапка
//   verdict,                         — плашка справа (null — не рисовать)
//   hook1, hook2,                    — заголовок: белая строка и зелёный вопрос
//   series: [числа],                 — оценка по ходам (кривая)
//   profits: [числа],                — прибыль по ходам (полоска)
//   marks: [{ turn, text, color }],  — подписи переломов (без финала)
//   pickTurn,                        — ход самого дорогого решения (или null)
//   endLabel,                        — итог у конца кривой («8.08 млрд ₽»)
//   legend: [4 строки],              — плюс / ноль / минус / решение
//   button, urlBold, urlNote,        — кнопка-вызов, адрес, «без регистрации…»
// }
// ----------------------------------------------------------------------------
export function drawShareCard(data) {
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  // Фон: тёмное поле, синее свечение сверху слева, зелёный отсвет снизу справа
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0, 0, W, H);
  let g = ctx.createRadialGradient(120, -190, 80, 120, -190, 1000);
  g.addColorStop(0, '#22375f');
  g.addColorStop(1, 'rgba(34,55,95,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(W + 60, H + 90, 40, W + 60, H + 90, 640);
  g.addColorStop(0, 'rgba(74,222,128,0.10)');
  g.addColorStop(1, 'rgba(74,222,128,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // --- Шапка ---
  ctx.font = `38px ${FONT}`;
  ctx.fillText(data.emoji, 54, 68);
  ctx.font = `800 21px ${FONT}`;
  ctx.fillStyle = COL.text;
  ctx.fillText(data.name, 112, 56);
  ctx.font = `14px ${FONT}`;
  ctx.fillStyle = COL.muted;
  ctx.fillText(data.sub, 112, 77);

  if (data.verdict) {
    ctx.font = `700 17px ${FONT}`;
    const w = ctx.measureText(data.verdict).width + 38;
    rr(ctx, W - 54 - w, 34, w, 38, 19);
    ctx.fillStyle = 'rgba(74,222,128,0.13)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(74,222,128,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = COL.good;
    ctx.fillText(data.verdict, W - 54 - w + 19, 59);
  }

  // --- Заголовок ---
  ctx.font = `800 40px ${FONT}`;
  ctx.fillStyle = COL.text;
  ctx.fillText(data.hook1, 54, 140);
  ctx.fillStyle = COL.good;
  ctx.fillText(data.hook2, 54, 188);

  // --- Кривая ---
  const cx = 54;
  const cw = W - 108;
  const top = 210;
  const ch = 216;
  const n = data.series.length;
  const maxV = Math.max(...data.series, 1);
  // Логарифм: на линейной шкале первые две трети партии лежат в одну
  // строчку у пола, и весь путь выглядит как «ничего-ничего-взлёт»
  const floor = maxV / 400;
  const lg = data.series.map((v) => Math.log10(Math.max(v, floor)));
  const lgMin = Math.min(...lg);
  const lgMax = Math.max(...lg, lgMin + 1e-9);
  const px = (i) => cx + (n > 1 ? (i / (n - 1)) * cw : 0);
  const py = (i) => top + ch - 22 - ((lg[i] - lgMin) / (lgMax - lgMin)) * (ch - 78);

  // Сетка: четыре тонких горизонтали, чтобы поле не висело в пустоте
  ctx.strokeStyle = 'rgba(148,163,184,0.07)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 4; k++) {
    const y = top + 20 + (k * (ch - 40)) / 3;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx + cw, y);
    ctx.stroke();
  }

  const tracePath = () => {
    ctx.beginPath();
    ctx.moveTo(px(0), py(0));
    for (let i = 1; i < n; i++) ctx.lineTo(px(i), py(i));
  };

  tracePath();
  ctx.lineTo(px(n - 1), top + ch);
  ctx.lineTo(px(0), top + ch);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, top, 0, top + ch);
  fill.addColorStop(0, 'rgba(74,222,128,0.30)');
  fill.addColorStop(1, 'rgba(74,222,128,0)');
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  tracePath();
  ctx.strokeStyle = 'rgba(74,222,128,0.14)';
  ctx.lineWidth = 11;
  ctx.stroke();
  tracePath();
  ctx.strokeStyle = 'rgba(74,222,128,0.25)';
  ctx.lineWidth = 6.5;
  ctx.stroke();
  tracePath();
  ctx.strokeStyle = COL.good;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Метки-капсулы: точка на кривой, рядом тёмная капсула с цветной точкой.
  // Сторона чередуется, чтобы подписи не наезжали друг на друга.
  const marks = [...(data.marks ?? [])].sort((a, b) => a.turn - b.turn);
  ctx.font = `600 15px ${FONT}`;
  marks.forEach((m, k) => {
    const i = Math.min(Math.max(m.turn, 0), n - 1);
    const above = k % 2 === 1;
    ctx.beginPath();
    ctx.arc(px(i), py(i), 6.5, 0, Math.PI * 2);
    ctx.fillStyle = m.color;
    ctx.fill();
    ctx.strokeStyle = COL.bg;
    ctx.lineWidth = 3;
    ctx.stroke();

    const tw = ctx.measureText(m.text).width + 40;
    const bx = Math.min(Math.max(px(i) - tw / 2, cx), cx + cw - tw);
    const by = above ? py(i) - 46 : py(i) + 14;
    rr(ctx, bx, by, tw, 28, 14);
    ctx.fillStyle = COL.chipBg;
    ctx.fill();
    ctx.strokeStyle = COL.chipLine;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bx + 16, by + 14, 4, 0, Math.PI * 2);
    ctx.fillStyle = m.color;
    ctx.fill();
    ctx.fillStyle = COL.text;
    ctx.fillText(m.text, bx + 27, by + 19);
  });

  // Конец кривой: точка и крупный зелёный итог
  ctx.beginPath();
  ctx.arc(px(n - 1), py(n - 1), 7, 0, Math.PI * 2);
  ctx.fillStyle = COL.text;
  ctx.fill();
  ctx.strokeStyle = COL.bg;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.font = `800 26px ${FONT}`;
  ctx.fillStyle = COL.good;
  const endW = ctx.measureText(data.endLabel).width;
  ctx.fillText(data.endLabel, cx + cw - endW, py(n - 1) - 20);

  // --- Полоска ходов: та же ось времени, что у кривой ---
  const sy = top + ch + 12;
  const gap = 4;
  // Ширина клетки ограничена: у оборванной партии (банкротство на 12-м ходу)
  // клетки иначе растягиваются в брёвна на всю карточку
  const cellW = Math.min((cw - gap * (n - 1)) / n, 24);
  const cellH = Math.min(Math.max(cellW, 8), 17);
  for (let i = 0; i < n; i++) {
    const p = data.profits[i] ?? 0;
    rr(ctx, cx + i * (cellW + gap), sy, cellW, cellH, Math.min(4.5, cellW / 3));
    ctx.fillStyle = p > 0 ? COL.good : p < 0 ? COL.bad : COL.flat;
    ctx.fill();
    if (i === data.pickTurn) {
      rr(ctx, cx + i * (cellW + gap) - 3.5, sy - 3.5, cellW + 7, cellH + 7, 7);
      ctx.strokeStyle = COL.pick;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  // --- Легенда ---
  ctx.font = `14px ${FONT}`;
  let lx = 54;
  const ly = sy + cellH + 27;
  const dot = (color, ring) => {
    rr(ctx, lx, ly - 11, 11, 11, 3.5);
    if (ring) {
      ctx.strokeStyle = COL.pick;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
    lx += 17;
  };
  const label = (text) => {
    ctx.fillStyle = COL.muted;
    ctx.fillText(text, lx, ly);
    lx += ctx.measureText(text).width + 18;
  };
  dot(COL.good); label(data.legend[0]);
  dot(COL.flat); label(data.legend[1]);
  dot(COL.bad); label(data.legend[2]);
  if (data.pickTurn !== null && data.pickTurn !== undefined) {
    dot(null, true); label(data.legend[3]);
  }

  // --- Низ: кнопка-вызов и адрес ---
  const by = H - 96;
  ctx.font = `800 24px ${FONT}`;
  const btnW = ctx.measureText(data.button).width + 56;
  ctx.save();
  ctx.shadowColor = 'rgba(74,222,128,0.35)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  rr(ctx, 54, by, btnW, 58, 14);
  const bg = ctx.createLinearGradient(0, by, 0, by + 58);
  bg.addColorStop(0, '#5ce992');
  bg.addColorStop(1, '#3ecb70');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = COL.btnText;
  ctx.fillText(data.button, 82, by + 38);

  ctx.font = `700 16px ${FONT}`;
  ctx.fillStyle = COL.text;
  ctx.fillText(data.urlBold, 54 + btnW + 26, by + 22);
  ctx.font = `15px ${FONT}`;
  ctx.fillStyle = COL.muted;
  ctx.fillText(data.urlNote, 54 + btnW + 26, by + 47);

  return canvas;
}

// ----------------------------------------------------------------------------
// Метки переломов и самое дорогое решение — из истории партии.
// history: [{ value, eventId, hadChoice }]; titleOf(id) → подпись причины.
// Берём два самых крупных движения оценки, у которых есть событие: у события
// есть готовое название. pickTurn — событие с выбором, рядом с которым
// оценка шевельнулась сильнее всего.
// ----------------------------------------------------------------------------
export function buildCardMarks(history, titleOf) {
  const moves = [];
  let pickTurn = null;
  let pickMove = -1;
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1].value ?? 0;
    const dv = Math.abs((history[i].value ?? 0) - prev);
    if (history[i].eventId) {
      moves.push({ turn: i, dv, id: history[i].eventId, up: (history[i].value ?? 0) >= prev });
      if (history[i].hadChoice && dv > pickMove) { pickMove = dv; pickTurn = i; }
    }
  }
  moves.sort((a, b) => b.dv - a.dv);
  const marks = [];
  const used = new Set();
  for (const m of moves) {
    if (marks.length >= 2) break;
    // Одно событие — одна подпись: повторившийся «федеральный игрок» дважды
    // на одной кривой читается как заедание
    if (used.has(m.id)) continue;
    // Правый край занят итогом партии — туда подписи не ставим
    if (m.turn > history.length * 0.85) continue;
    // Не теснимся: капсулы широкие, и метки ближе четверти партии друг к
    // другу перекрываются — вторая просто не влезает между точкой и итогом
    if (marks.some((x) => Math.abs(x.turn - m.turn) < history.length / 4)) continue;
    const text = titleOf(m.id);
    if (!text) continue;
    used.add(m.id);
    marks.push({ turn: m.turn, text, color: m.up ? '#4ade80' : '#f87171' });
  }
  return { marks, pickTurn };
}

// ----------------------------------------------------------------------------
// Отдать картинку: на телефоне — в системное «поделиться», иначе — файлом.
// Возвращает 'shared' | 'saved' | 'cancel'.
// ----------------------------------------------------------------------------
export async function shareCardImage(canvas, filename, shareText) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return 'cancel';
  try {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      // Ссылка кладётся текстом рядом с картинкой: в мессенджерах она станет
      // кликабельной. Часть браузеров не принимает text вместе с files —
      // тогда вторая попытка отдаёт одну картинку: адрес напечатан и на ней.
      try {
        await navigator.share(shareText ? { files: [file], text: shareText } : { files: [file] });
        return 'shared';
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancel';
        try {
          await navigator.share({ files: [file] });
          return 'shared';
        } catch (e2) {
          // Человек закрыл системное окно — не повод скачивать файл силой
          if (e2 && e2.name === 'AbortError') return 'cancel';
        }
      }
    }
  } catch { /* File не поддержан — падаем в скачивание */ }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return 'saved';
}
