// Минималистичные графики на canvas — без внешних библиотек,
// чтобы игра открывалась одним файлом и работала офлайн.

const PALETTE = ['#4ade80', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa', '#22d3ee'];

function niceTicks(min, max, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [min || 0, (min || 0) + 1];
  }
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(raw) || 1)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(v);
  return ticks;
}

/**
 * series: [{ label, color?, data: number[] }]
 * opts: { format?: (v)=>string, zeroLine?: boolean, title?: string,
 *         markers?: number[] } — индексы ходов (0-базные), где игрок менял
 * решения. Рисуются пунктирными вертикалями: график перестаёт быть «просто
 * кривой» и становится дневником — видно, где решение, а где последствия.
 */
export function drawLineChart(canvas, series, opts = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 320;
  const cssH = canvas.clientHeight || 180;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const fmt = opts.format ?? ((v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}к` : String(Math.round(v))));
  const padL = 52, padR = 10, padT = 16, padB = 22;
  const w = cssW - padL - padR;
  const h = cssH - padT - padB;

  const visible = series.filter((s) => s.data && s.data.length);
  if (!visible.length || visible.every((s) => s.data.length < 1)) {
    ctx.fillStyle = 'rgba(226,232,240,0.35)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.emptyText ?? '', cssW / 2, cssH / 2);
    return;
  }

  const n = Math.max(...visible.map((s) => s.data.length));
  let min = Infinity, max = -Infinity;
  for (const s of visible) for (const v of s.data) {
    if (!Number.isFinite(v)) continue;
    min = Math.min(min, v); max = Math.max(max, v);
  }
  if (!Number.isFinite(min)) { min = 0; max = 1; }
  if (opts.zeroLine) { min = Math.min(min, 0); max = Math.max(max, 0); }
  if (min === max) { max = min + Math.abs(min || 1) * 0.2 + 1; }
  const pad = (max - min) * 0.08;
  min -= pad; max += pad;

  const x = (i) => padL + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v) => padT + h - ((v - min) / (max - min)) * h;

  // сетка
  const ticks = niceTicks(min, max, 4);
  ctx.font = '10px ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const t of ticks) {
    if (t < min || t > max) continue;
    const py = y(t);
    ctx.strokeStyle = Math.abs(t) < 1e-9 ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, py + 0.5);
    ctx.lineTo(padL + w, py + 0.5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.fillText(fmt(t), padL - 6, py);
  }

  // ось X — номера недель
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const labelEvery = Math.max(1, Math.ceil(n / 8));
  for (let i = 0; i < n; i += labelEvery) {
    ctx.fillStyle = 'rgba(148,163,184,0.6)';
    ctx.fillText(String(i + 1), x(i), padT + h + 6);
  }

  // маркеры решений — под линиями, чтобы не перекрывать данные
  for (const mi of (opts.markers ?? [])) {
    if (mi < 0 || mi >= n) continue;
    const px = x(mi);
    ctx.strokeStyle = 'rgba(251,191,36,0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(px + 0.5, padT);
    ctx.lineTo(px + 0.5, padT + h);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // линии
  visible.forEach((s, si) => {
    ctx.strokeStyle = s.color ?? PALETTE[si % PALETTE.length];
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false;
    s.data.forEach((v, i) => {
      if (!Number.isFinite(v)) return;
      const px = x(i), py = y(v);
      if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // последняя точка
    const lastIdx = s.data.length - 1;
    if (lastIdx >= 0 && Number.isFinite(s.data[lastIdx])) {
      ctx.fillStyle = s.color ?? PALETTE[si % PALETTE.length];
      ctx.beginPath();
      ctx.arc(x(lastIdx), y(s.data[lastIdx]), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function legendHtml(series) {
  return series.map((s, i) => `<span class="legend-item"><i style="background:${s.color ?? PALETTE[i % PALETTE.length]}"></i>${s.label}</span>`).join('');
}

export { PALETTE };
