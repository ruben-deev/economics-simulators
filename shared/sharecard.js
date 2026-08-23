// ============================================================================
// Карточка результата «поделиться»: картинка 1200×630 на канвасе.
//
// Одна картинка рассказывает партию целиком: заголовок-крючок, кривая оценки
// по ходам с подписанными переломами, полоска ходов (зелёный — ход в плюс,
// тёмный — в ноль, красный — в минус, синее кольцо — самое дорогое решение),
// кнопка-приглашение и код партии. Собирается из state.history — ничего
// выдумывать и вручную подписывать не нужно.
//
// Модуль намеренно ничего не знает об играх: все строки и числа приходят
// готовыми. Канвас, а не SVG: картинку надо отдавать как файл в системное
// «поделиться», и toBlob() здесь — короткий путь без прослоек. Рисование
// в двукратном масштабе — иначе текст на телефонных экранах мылится.
// Safari 14.1: без roundRect(), letterSpacing и OffscreenCanvas.
// ============================================================================

const W = 1200;
const H = 630;
const SCALE = 2;
const FONT = '-apple-system, "Segoe UI", Roboto, sans-serif';

const COL = {
  bg: '#0b1120', glow: '#1d3055', text: '#e2e8f0', muted: '#94a3b8',
  line: 'rgba(148,163,184,0.16)', good: '#4ade80', bad: '#f87171',
  flat: '#243352', pick: '#60a5fa', btnText: '#06240f',
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
//   emoji, name, sub,                    — шапка
//   verdict,                             — плашка справа (null — не рисовать)
//   hook1, hook2,                        — заголовок: белая и зелёная строки
//   series: [числа],                     — оценка по ходам (кривая)
//   profits: [числа],                    — прибыль по ходам (полоска)
//   marks: [{ turn, text, color }],      — подписи переломов (кроме финала)
//   pickTurn,                            — ход самого дорогого решения (или null)
//   endLabel,                            — подпись конца кривой («8.08 млрд ₽»)
//   legend: [4 строки],                  — плюс / ноль / минус / решение
//   button, urlLine, outcomeLabel, outcomeValue,
// }
// ----------------------------------------------------------------------------
export function drawShareCard(data) {
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'alphabetic';

  // Фон: тёмное поле и синеватое свечение из левого верхнего угла
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(150, -160, 60, 150, -160, 950);
  glow.addColorStop(0, COL.glow);
  glow.addColorStop(1, 'rgba(29,48,85,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // --- Шапка ---
  ctx.font = `34px ${FONT}`;
  ctx.fillStyle = COL.text;
  ctx.fillText(data.emoji, 56, 66);
  ctx.font = `800 21px ${FONT}`;
  ctx.fillText(data.name, 108, 56);
  ctx.font = `14px ${FONT}`;
  ctx.fillStyle = COL.muted;
  ctx.fillText(data.sub, 108, 76);

  if (data.verdict) {
    ctx.font = `700 17px ${FONT}`;
    const w = ctx.measureText(data.verdict).width + 36;
    rr(ctx, W - 56 - w, 36, w, 36, 18);
    ctx.fillStyle = 'rgba(74,222,128,0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(74,222,128,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = COL.good;
    ctx.fillText(data.verdict, W - 56 - w + 18, 60);
  }

  // --- Заголовок ---
  ctx.font = `800 38px ${FONT}`;
  ctx.fillStyle = COL.text;
  ctx.fillText(data.hook1, 56, 136);
  ctx.fillStyle = COL.good;
  ctx.fillText(data.hook2, 56, 182);

  // --- Кривая ---
  const cx = 56;
  const cw = W - 112;
  const top = 214;
  const ch = 210;
  const n = data.series.length;
  const maxV = Math.max(...data.series, 1);
  // Логарифм: на линейной шкале первые две трети партии лежат в одну
  // строчку у пола, и год выглядит как «ничего-ничего-взлёт»
  const floor = maxV / 400;
  const lg = data.series.map((v) => Math.log10(Math.max(v, floor)));
  const lgMin = Math.min(...lg);
  const lgMax = Math.max(...lg, lgMin + 1e-9);
  const px = (i) => cx + (n > 1 ? (i / (n - 1)) * cw : 0);
  const py = (i) => top + ch - 24 - ((lg[i] - lgMin) / (lgMax - lgMin)) * (ch - 64);

  ctx.beginPath();
  ctx.moveTo(px(0), py(0));
  for (let i = 1; i < n; i++) ctx.lineTo(px(i), py(i));
  ctx.lineTo(px(n - 1), top + ch);
  ctx.lineTo(px(0), top + ch);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, top, 0, top + ch);
  fill.addColorStop(0, 'rgba(74,222,128,0.26)');
  fill.addColorStop(1, 'rgba(74,222,128,0)');
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(px(0), py(0));
  for (let i = 1; i < n; i++) ctx.lineTo(px(i), py(i));
  ctx.strokeStyle = COL.good;
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Метки переломов: точка на кривой и подпись над или под ней.
  // Сторона чередуется, чтобы подписи не наезжали друг на друга.
  ctx.font = `600 17px ${FONT}`;
  const marks = [...(data.marks ?? [])].sort((a, b) => a.turn - b.turn);
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
    ctx.fillStyle = m.color;
    const tw = ctx.measureText(m.text).width;
    const tx = Math.min(Math.max(px(i) - tw / 2, cx), cx + cw - tw);
    ctx.fillText(m.text, tx, py(i) + (above ? -16 : 30));
  });

  // Конец кривой: точка и итог
  ctx.beginPath();
  ctx.arc(px(n - 1), py(n - 1), 6.5, 0, Math.PI * 2);
  ctx.fillStyle = COL.text;
  ctx.fill();
  ctx.strokeStyle = COL.bg;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.font = `700 20px ${FONT}`;
  ctx.fillStyle = COL.text;
  const endW = ctx.measureText(data.endLabel).width;
  ctx.fillText(data.endLabel, cx + cw - endW, py(n - 1) - 18);

  // --- Полоска ходов: та же ось времени, что у кривой ---
  const sy = top + ch + 14;
  const gap = 4;
  const cellW = (cw - gap * (n - 1)) / n;
  const cellH = Math.min(cellW, 18);
  for (let i = 0; i < n; i++) {
    const p = data.profits[i] ?? 0;
    rr(ctx, cx + i * (cellW + gap), sy, cellW, cellH, 4);
    ctx.fillStyle = p > 0 ? COL.good : p < 0 ? COL.bad : COL.flat;
    ctx.fill();
    if (i === data.pickTurn) {
      rr(ctx, cx + i * (cellW + gap) - 3, sy - 3, cellW + 6, cellH + 6, 6);
      ctx.strokeStyle = COL.pick;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  // --- Легенда ---
  ctx.font = `15px ${FONT}`;
  let lx = 56;
  const ly = sy + cellH + 30;
  const legendDot = (color, ring) => {
    if (ring) {
      rr(ctx, lx, ly - 12, 13, 13, 4);
      ctx.strokeStyle = COL.pick;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else {
      rr(ctx, lx, ly - 12, 13, 13, 4);
      ctx.fillStyle = color;
      ctx.fill();
    }
    lx += 20;
  };
  const legendText = (text) => {
    ctx.fillStyle = COL.muted;
    ctx.fillText(text, lx, ly);
    lx += ctx.measureText(text).width + 22;
  };
  legendDot(COL.good); legendText(data.legend[0]);
  legendDot(COL.flat); legendText(data.legend[1]);
  legendDot(COL.bad); legendText(data.legend[2]);
  if (data.pickTurn !== null && data.pickTurn !== undefined) {
    legendDot(null, true); legendText(data.legend[3]);
  }

  // --- Низ: кнопка, адрес, итог ---
  const by = H - 108;
  ctx.font = `800 24px ${FONT}`;
  const btnW = ctx.measureText(data.button).width + 56;
  rr(ctx, 56, by, btnW, 58, 14);
  ctx.fillStyle = COL.good;
  ctx.fill();
  ctx.fillStyle = COL.btnText;
  ctx.fillText(data.button, 84, by + 38);
  ctx.font = `15px ${FONT}`;
  ctx.fillStyle = COL.muted;
  ctx.fillText(data.urlLine, 56, by + 84);

  ctx.font = `15px ${FONT}`;
  const olW = ctx.measureText(data.outcomeLabel).width;
  ctx.fillText(data.outcomeLabel, W - 56 - olW, by + 26);
  ctx.font = `800 24px ${FONT}`;
  ctx.fillStyle = COL.text;
  const ovW = ctx.measureText(data.outcomeValue).width;
  ctx.fillText(data.outcomeValue, W - 56 - ovW, by + 56);

  return canvas;
}

// ----------------------------------------------------------------------------
// Метки переломов и самое дорогое решение — из истории партии.
// history: [{ value, profit, eventId, hadChoice }]; titleOf(id) → подпись.
// Берём два самых крупных движения оценки, у которых есть событие: событие
// и есть готовая подпись причины. pickTurn — событие с выбором, рядом с
// которым оценка шевельнулась сильнее всего.
// ----------------------------------------------------------------------------
export function buildCardMarks(history, titleOf) {
  const moves = [];
  let pickTurn = null;
  let pickMove = -1;
  for (let i = 1; i < history.length; i++) {
    const dv = Math.abs((history[i].value ?? 0) - (history[i - 1].value ?? 0));
    if (history[i].eventId) {
      moves.push({ turn: i, dv, id: history[i].eventId, up: (history[i].value ?? 0) >= (history[i - 1].value ?? 0) });
      if (history[i].hadChoice && dv > pickMove) { pickMove = dv; pickTurn = i; }
    }
  }
  moves.sort((a, b) => b.dv - a.dv);
  const marks = [];
  for (const m of moves) {
    if (marks.length >= 2) break;
    // Не теснимся: метки ближе восьмой части партии друг к другу сливаются
    if (marks.some((x) => Math.abs(x.turn - m.turn) < history.length / 8)) continue;
    const text = titleOf(m.id);
    if (!text) continue;
    marks.push({ turn: m.turn, text, color: m.up ? '#4ade80' : '#f87171' });
  }
  return { marks, pickTurn };
}

// ----------------------------------------------------------------------------
// Отдать картинку: на телефоне — в системное «поделиться», иначе — файлом.
// Возвращает 'shared' | 'saved' | 'cancel'.
// ----------------------------------------------------------------------------
export async function shareCardImage(canvas, filename) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return 'cancel';
  try {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return 'shared';
      } catch (e) {
        // Человек закрыл системное окно — это не повод скачивать файл силой
        if (e && e.name === 'AbortError') return 'cancel';
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
