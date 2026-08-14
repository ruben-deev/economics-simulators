// ============================================================================
// Слой интерфейса: состояние партии, отрисовка, обработка ввода.
// Вся экономика живёт в src/model — здесь только показ и управление.
// Весь текст берётся из i18n: t() для строк интерфейса,
// tx() для двуязычных полей модели (активы, вертикали, рычаги, события).
// ============================================================================

import {
  CONFIG, FUTURE_VERTICALS, LEVERS, LEVER_GROUPS, assetById, verticalById,
} from '../model/config.js';
import { eventById } from '../model/events.js';
import {
  createInitialState, step, explain, valuation, sumOfParts,
  fundingOffer, raise, finalScore, expansionOpen, uniqueUsers, focusPenalty,
} from '../model/engine.js';
import { goalProgress } from '../model/board.js';
import { drawLineChart, legendHtml, PALETTE } from '../../../../shared/charts.js';
import { money, moneyExact, num, pct, signedPct, compact, axisNum } from '../../../../shared/format.js';
import { t, tx, getLang, setLang, detectLang, setStrings } from '../../../../shared/i18n.js';
import { watchTables } from '../../../../shared/tables.js';
import { resultString, addRecord, loadRecords, bestRecord } from '../../../../shared/records.js';
import { lbMount, lbEndpoint } from '../../../../shared/leaderboard.js';
import { STRINGS } from '../strings.js';

const SAVE_KEY = 'novograd-save-v1';
const RECORDS_KEY = 'novograd-records';
const GAME_TAG = 'НОВОГРАД';
// Метка сборки: меняется вместе с полями модели. Сохранение с чужой меткой
// не читается — см. load().
const BUILD = 'ecosystem-1';
// Версию проставляет сборщик. У модульной версии метки нет — значит это
// исходники, а не раздаваемый файл.
const APP_VERSION = document.querySelector('meta[name="app-version"]')?.content ?? 'dev';
const APP_BUILD_DATE = document.querySelector('meta[name="app-build-date"]')?.content ?? '';
const el = (id) => document.getElementById(id);

// Цель Яндекс.Метрики. Работает только на сайте: счётчик подключает
// страница-обёртка (блок only-modular), в раздаваемом файле его нет.
function track(goal) {
  try {
    if (window.__metrikaId && window.ym) window.ym(window.__metrikaId, 'reachGoal', goal);
  } catch { /* аналитика не должна мешать игре */ }
}

let state = null;
let chartTab = 'clients';
let rightTab = 'sop';
let leversBuilt = false;
let leversBuiltTaxiOn = false;    // рычаги такси перестраиваются при запуске
let bound = false;                // обработчики уже навешаны

// ----------------------------------------------------------------------------
// Сохранение
// ----------------------------------------------------------------------------
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ build: BUILD, state }));
  } catch { /* приватный режим */ }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || saved.build !== BUILD) return null;
    const s = saved.state;
    return s && s.food && Array.isArray(s.history) ? s : null;
  } catch { return null; }
}
function dropSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* приватный режим */ }
}

const last = () => state.history[state.history.length - 1] ?? null;
const prev = () => state.history[state.history.length - 2] ?? null;

// ----------------------------------------------------------------------------
// Переходы по подсказкам: синие слова ведут к нужному блоку.
// Правило простое: синий — значит кликабельно.
// ----------------------------------------------------------------------------
const JUMP_PANELS = {
  levers: 'levers', verticals: 'verticals', funding: 'funding',
  report: 'report-slot', charts: 'chart', news: 'news-slot', board: 'board',
};
function flash(node) {
  if (!node) return;
  node.classList.remove('jump-target');
  void node.offsetWidth;
  node.classList.add('jump-target');
  setTimeout(() => node.classList.remove('jump-target'), 1600);
}
function jumpTo(target) {
  const [kind, key] = String(target).split(':');
  if (kind === 'lever') {
    const node = document.querySelector(`.lever[data-key="${key}"]`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flash(node);
    return;
  }
  if (kind === 'group') {
    const node = document.querySelector(`.lever-group[data-group="${key}"]`);
    if (node && !node.classList.contains('open')) {
      openGroups[key] = true;
      node.classList.add('open');
    }
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flash(node);
    return;
  }
  if (kind === 'tab') {
    rightTab = key;
    renderRightTab();
    const node = el('tab-content');
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flash(node?.closest('.panel') ?? node);
    return;
  }
  const node = el(JUMP_PANELS[key] ?? key ?? kind);
  if (!node) return;
  let box = node.classList.contains('panel') ? node
    : (node.querySelector(':scope > .panel') ?? node.closest('.panel') ?? node);
  if (box.getBoundingClientRect().height < 8) {
    let sib = box.previousElementSibling;
    while (sib && sib.getBoundingClientRect().height < 8) sib = sib.previousElementSibling;
    box = sib ?? box.parentElement ?? box;
  }
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  flash(box);
}
function bindJumps() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-jump]');
    if (!link) return;
    e.preventDefault();
    jumpTo(link.dataset.jump);
  });
}

// ----------------------------------------------------------------------------
// KPI в шапке
// ----------------------------------------------------------------------------
function kpi(label, value, sub, cls = 'neutral') {
  return `<div class="kpi">
    <div class="k-label">${label}</div>
    <div class="k-value">${value}</div>
    <div class="k-delta ${cls}">${sub ?? ''}</div>
  </div>`;
}

function delta(cur, before) {
  if (!Number.isFinite(cur) || !Number.isFinite(before) || before === 0) return ['', 'neutral'];
  const d = cur / before - 1;
  return [signedPct(d), d > 0.001 ? 'up' : d < -0.001 ? 'down' : 'neutral'];
}

function renderKpis() {
  const r = last();
  const p = prev();
  const burn = r ? -(r.profit - r.oneOff) : 0;
  const runway = burn > 0 ? state.cash / burn : Infinity;

  const parts = [
    kpi(t('kpiMonth'), `${state.month} / ${CONFIG.monthsTotal}`,
      r?.event ? t('kpiMonthEvent') : t('kpiMonthCity')),
    kpi(t('kpiCash'), money(state.cash),
      state.cash < 0 ? t('kpiCashOut')
        : Number.isFinite(runway) ? t('kpiRunway', { months: runway.toFixed(0) })
        : t('kpiProfitable'),
      state.cash < 0 ? 'down' : runway < 4 ? 'down' : runway < 8 ? 'neutral' : 'up'),
  ];

  if (r) {
    const [dU, cU] = delta(r.uniqueUsers, p?.uniqueUsers);
    const [dA, cA] = delta(r.arpuHolding, p?.arpuHolding);
    parts.push(
      kpi(t('kpiUnique'), compact(r.uniqueUsers), dU || t('kpiUniqueSub'), cU),
      kpi(t('kpiArpu'), `${num(r.arpuHolding)} ₽`, dA || t('kpiArpuSub'), cA),
      kpi(t('kpiProfit'), money(r.profit), t('kpiProfitSub', { value: money(r.contribution) }),
        r.profit >= 0 ? 'up' : 'down'),
      kpi(t('kpiMulti'), pct(r.multiShare, 1), t('kpiMultiSub', { value: compact(r.bothUsers) }),
        'neutral'),
      kpi(t('kpiEquity'), money(r.equityValue ?? 0), t('kpiEquitySub', { value: pct(state.equity, 1) }), 'neutral'),
    );
  } else {
    parts.push(kpi(t('kpiStart'), money(CONFIG.startCash), t('kpiStartSub'), 'up'));
  }

  el('kpis').innerHTML = parts.join('');
}

// ----------------------------------------------------------------------------
// Рычаги: три складных блока (как в БИЛЕТВИЛЕ) с описанием группы и живой
// сводкой — по ней видно, что механика группы делает прямо сейчас.
// ----------------------------------------------------------------------------
const openGroups = { food: true, taxi: true, holding: true };

function leverHtml(l) {
  // Политика — решение с именем, а не процент: сегментные режимы вместо
  // ползунка. Бюджеты остаются ползунками — там непрерывность уместна.
  const control = l.policy
    ? `<div class="policy-seg" data-policy="${l.key}">
        ${l.policy.map((p) => `<button type="button" data-policy-value="${p.v}">${tx(p.label)}</button>`).join('')}
      </div>
      <div class="policy-note" id="note-${l.key}"></div>`
    : `<input type="range" id="in-${l.key}" min="${l.min}" max="${l.max}" step="${l.step}" />`;
  return `
    <div class="lever" data-key="${l.key}">
      <div class="lever-head">
        <span class="lever-label">${tx(l.label)}</span>
        <span class="lever-value" id="val-${l.key}"></span>
      </div>
      ${control}
      <button class="lever-why" type="button">${t('leverWhy')}</button>
      <div class="lever-tip">${tx(l.tip)}</div>
    </div>`;
}

function buildLevers() {
  const taxiOn = state.taxi.on;
  el('levers').innerHTML = LEVER_GROUPS.map((g) => {
    const levers = LEVERS.filter((l) => l.group === g.id);
    const locked = g.id === 'taxi' && !taxiOn;
    const body = locked
      ? `<div class="hint-box" style="margin:6px 0 12px">${t('leverGroupLockedTaxi')}
          <a class="jump" data-jump="panel:verticals">${t('jumpGo')}</a></div>`
      : `<div class="funding-note" style="margin:2px 0 8px">${tx(g.desc)}</div>
        <div id="readout-${g.id}"></div>
        ${levers.map(leverHtml).join('')}`;
    return `<div class="lever-group ${openGroups[g.id] ? 'open' : ''}" data-group="${g.id}">
      <button class="lever-group-head" type="button">
        <span class="lg-caret">▾</span><span>${g.icon} ${tx(g.label)}</span>
        <span class="lg-count">${locked ? '🔒' : levers.length}</span>
      </button>
      <div class="lever-group-body">${body}</div>
    </div>`;
  }).join('');

  for (const l of LEVERS) {
    if (l.policy) {
      el('levers').querySelectorAll(`[data-policy="${l.key}"] [data-policy-value]`)
        .forEach((b) => b.addEventListener('click', () => {
          state.decisions[l.key] = Number(b.dataset.policyValue) * (l.scale ?? 1);
          syncLevers();
          renderLeverReadouts();
          renderBudgetBar();
          renderRightTab();
          save();
        }));
      continue;
    }
    const input = el(`in-${l.key}`);
    if (!input) continue;
    input.addEventListener('input', () => {
      state.decisions[l.key] = Number(input.value) * (l.scale ?? 1);
      syncLevers();
      renderLeverReadouts();
      renderBudgetBar();
      renderRightTab();
      save();
    });
  }
  el('levers').querySelectorAll('.lever-group-head').forEach((head) => {
    head.addEventListener('click', () => {
      const box = head.closest('.lever-group');
      const id = box.dataset.group;
      openGroups[id] = !openGroups[id];
      box.classList.toggle('open', openGroups[id]);
    });
  });
  el('levers').querySelectorAll('.lever-why').forEach((b) => {
    b.addEventListener('click', () => b.closest('.lever').classList.toggle('open'));
  });
  leversBuilt = true;
  leversBuiltTaxiOn = taxiOn;
}

// Живые сводки групп: что механика делает при текущих ползунках.
// Считаются от последнего отчёта — тех же чисел, что видит игрок в центре.
function renderLeverReadouts() {
  const r = last();
  const asset = assetById(state.assetId);
  const d = state.decisions;

  const foodBox = el('readout-food');
  if (foodBox) {
    const lost = r ? r.lostFood : asset.users * asset.baseChurn;
    const gained = r ? r.wonBack + r.organicFood + r.crossBackConv : 0;
    const pool = r ? r.returnPool : asset.returnPool;
    const balanceCls = gained >= lost ? 'pos' : 'neg';
    const takeWarn = (d.foodTake ?? 1) > CONFIG.foodTakeThreshold
      ? `<div class="neg">${t('readoutFoodExodus')}</div>` : '';
    foodBox.innerHTML = `<div class="hint-box" style="margin-bottom:10px">
      <div>${t('readoutFood', {
        lost: compact(lost), gained: compact(gained), cls: balanceCls,
      })}</div>
      <div>${t('readoutFoodPool', { pool: compact(pool) })}</div>
      ${takeWarn}
    </div>`;
  }

  const taxiBox = el('readout-taxi');
  if (taxiBox && state.taxi.on) {
    const capacity = state.taxi.drivers * CONFIG.taxiTripsPerDriver;
    const demand = r ? r.demandTrips : 0;
    const hires = (d.taxiSupply ?? 0) / CONFIG.taxiDriverOnboardCost;
    const war = r && r.warMonthsLeft > 0
      ? `<div class="neg">${t('readoutTaxiWar', { months: r.warMonthsLeft })}</div>` : '';
    taxiBox.innerHTML = `<div class="hint-box" style="margin-bottom:10px">
      <div>${t('readoutTaxi', {
        drivers: num(state.taxi.drivers), capacity: compact(capacity),
        hires: num(hires, 0),
      })}</div>
      ${demand > 0 ? `<div>${t('readoutTaxiDemand', {
        demand: compact(demand),
        util: pct(capacity > 0 ? Math.min(demand / capacity, 3) : 0, 0),
        cls: demand > capacity ? 'neg' : (demand < capacity * 0.55 ? 'neg' : 'pos'),
      })}</div>` : ''}
      ${war}
    </div>`;
  }

  const holdBox = el('readout-holding');
  if (holdBox) {
    const penalty = focusPenalty(state, d);
    const focusLine = state.taxi.on
      ? t('readoutFocus', {
          penalty: pct(penalty, 0),
          cls: penalty > 0.05 ? 'neg' : 'pos',
        })
      : t('readoutFocusSingle');
    const crossLine = r && state.taxi.on && (d.crossSell ?? 0) > 0
      ? `<div>${t('readoutCross', {
          conv: compact(r.crossConv + r.crossBackConv),
          wasted: r.crossWasted > 0 ? t('readoutCrossWasted', { wasted: money(r.crossWasted) }) : '',
        })}</div>`
      : '';
    holdBox.innerHTML = `<div class="hint-box" style="margin-bottom:10px">
      <div>${focusLine}</div>
      ${crossLine}
    </div>`;
  }
}

function leverDisplay(l, raw) {
  const unit = tx(l.unit);
  if (unit === '%') return `${raw}%`;
  return money(raw);
}

function syncLevers() {
  for (const l of LEVERS) {
    const raw = state.decisions[l.key] / (l.scale ?? 1);
    if (l.policy) {
      const seg = el('levers').querySelector(`[data-policy="${l.key}"]`);
      if (!seg) continue;
      // Ближайший режим: сохранения и политики замеров могут держать
      // значение вне сетки — подсвечиваем то, что ближе всего
      let current = l.policy[0];
      for (const p of l.policy) {
        if (Math.abs(p.v - raw) < Math.abs(current.v - raw)) current = p;
      }
      seg.querySelectorAll('[data-policy-value]').forEach((b) => {
        b.classList.toggle('active', Number(b.dataset.policyValue) === current.v);
      });
      const val = el(`val-${l.key}`);
      if (val) val.textContent = `${tx(current.label)} · ${raw}%`;
      const note = el(`note-${l.key}`);
      if (note) note.textContent = tx(current.note);
      continue;
    }
    const input = el(`in-${l.key}`);
    if (!input) continue;
    input.value = String(raw);
    el(`val-${l.key}`).textContent = leverDisplay(l, raw);
  }
}

// ----------------------------------------------------------------------------
// Бюджетная полоса: из чего складываются расходы месяца при текущих
// ползунках — и что от них останется при вчерашнем вкладе.
// ----------------------------------------------------------------------------
const BUDGET_COLORS = {
  fixed: '#64748b',
  food: PALETTE[1],
  taxi: PALETTE[2],
  eco: PALETTE[0],
};

function renderBudgetBar() {
  const box = el('budget-slot');
  if (!box) return;
  const d = state.decisions;
  const r = last();
  const taxiOn = state.taxi.on;
  const asset = assetById(state.assetId);
  const fixed = (r ? r.fixedFood + r.fixedTaxi + r.hqCost
    : asset.fixedMonthly + CONFIG.hqMonthly);
  const food = (d.foodOps ?? 0) + (d.foodMarketing ?? 0);
  const taxi = taxiOn ? (d.taxiSupply ?? 0) + (d.taxiMarketing ?? 0) : 0;
  const eco = taxiOn ? (d.crossSell ?? 0) + (d.mgmt ?? 0) : (d.mgmt ?? 0);
  const total = fixed + food + taxi + eco;
  const contribution = r ? r.contribution : asset.users * asset.arpu * asset.margin;
  const net = contribution - total;

  const seg = (key, v) => (v > 0
    ? `<span style="width:${(100 * v / total).toFixed(1)}%;background:${BUDGET_COLORS[key]}"></span>` : '');
  const leg = (key, label, v) => (v > 0
    ? `<span><i style="background:${BUDGET_COLORS[key]}"></i>${label} ${money(v)}</span>` : '');
  box.innerHTML = `<div class="hint-box" style="margin-bottom:12px">
    <div>${t('budgetTitle', { total: money(total) })}</div>
    <div class="budget-bar">
      ${seg('fixed', fixed)}${seg('food', food)}${seg('taxi', taxi)}${seg('eco', eco)}
    </div>
    <div class="budget-legend">
      ${leg('fixed', t('budgetFixed'), fixed)}
      ${leg('food', t('budgetFood'), food)}
      ${leg('taxi', t('budgetTaxi'), taxi)}
      ${leg('eco', t('budgetEco'), eco)}
    </div>
    <div class="funding-note" style="margin-top:4px">${t('budgetNet', {
      contribution: money(contribution),
      net: (net >= 0 ? '+' : '') + money(net),
      cls: net >= 0 ? 'pos' : 'neg',
    })}</div>
  </div>`;
}

// ----------------------------------------------------------------------------
// Карта экосистемы: круги баз с пересечением и потоки месяца.
// Это главный «прибор» игры: склейка видна геометрией, а не строкой в таблице.
// ----------------------------------------------------------------------------
function renderEcoMap() {
  const box = el('map-slot');
  if (!box) return;
  const r = last();
  const asset = assetById(state.assetId);
  const taxi = verticalById('taxi');
  const foodU = r ? r.foodUsers : asset.users;
  const taxiU = r ? r.taxiUsers : 0;
  const bothU = r ? r.bothUsers : 0;
  const unique = r ? r.uniqueUsers : asset.users;
  const taxiOn = state.taxi.on;

  // Радиусы от численности. Пересечение — отдельный узел между кругами:
  // его размер и есть склейка экосистемы
  const rFood = 30 + 38 * Math.sqrt(foodU / 260_000);
  const rTaxi = taxiOn ? 12 + 40 * Math.sqrt(taxiU / 300_000) : 16;
  const rBoth = taxiOn && bothU > 500 ? 8 + 26 * Math.sqrt(bothU / 150_000) : 0;
  const cx1 = 235;
  const cx2 = 465;
  const cxB = (cx1 + cx2) / 2;
  const cy = 103;

  const foodIn = r ? r.wonBack + r.organicFood : 0;
  // Наконечник — цветная точка на конце пути: SVG-маркеры не наследуют
  // цвет в старых Safari, а точка работает везде
  const arrow = (path, ex, ey, color, label, x, y, anchor = 'middle') => `
    <path class="flow" d="${path}" stroke="${color}"/>
    <circle cx="${ex}" cy="${ey}" r="3" fill="${color}"/>
    <text x="${x}" y="${y}" text-anchor="${anchor}" class="m-muted">${label}</text>`;

  const flows = [];
  if (r && taxiOn) {
    if (r.crossConv > 0.5) {
      flows.push(arrow(
        `M ${cx1 + 20} ${cy - rFood + 6} C ${cx1 + 60} ${cy - rFood - 34}, ${cx2 - 50} ${cy - rTaxi - 34}, ${cx2 - 10} ${cy - rTaxi + 2}`,
        cx2 - 10, cy - rTaxi + 2,
        PALETTE[0], `${t('mapCross')} +${compact(r.crossConv)}`, (cx1 + cx2) / 2 + 10, cy - rFood - 26));
    }
    if (r.crossBackConv > 0.5) {
      flows.push(arrow(
        `M ${cx2 - 14} ${cy + rTaxi - 2} C ${cx2 - 50} ${cy + rTaxi + 30}, ${cx1 + 60} ${cy + rFood + 30}, ${cx1 + 24} ${cy + rFood - 4}`,
        cx1 + 24, cy + rFood - 4,
        PALETTE[0], `${t('mapCrossBack')} +${compact(r.crossBackConv)}`, (cx1 + cx2) / 2 + 10, cy + rFood + 34));
    }
    if (r.coldAcq > 0.5) {
      flows.push(arrow(
        `M 640 ${cy - 30} C 600 ${cy - 26}, ${cx2 + rTaxi + 40} ${cy - 14}, ${cx2 + rTaxi + 4} ${cy - 6}`,
        cx2 + rTaxi + 4, cy - 6,
        PALETTE[2], `${t('mapCold')} +${compact(r.coldAcq)}`, 640, cy - 40, 'end'));
    }
    if (r.lostTaxi > 0.5) {
      flows.push(arrow(
        `M ${cx2 + 8} ${cy + rTaxi + 2} L ${cx2 + 22} ${cy + rTaxi + 26}`,
        cx2 + 22, cy + rTaxi + 26,
        'var(--bad)', `−${compact(r.lostTaxi)}`, cx2 + 30, cy + rTaxi + 38));
    }
  }
  if (r && foodIn > 0.5) {
    flows.push(arrow(
      `M 55 ${cy - 26} C 95 ${cy - 24}, ${cx1 - rFood - 36} ${cy - 12}, ${cx1 - rFood - 4} ${cy - 4}`,
      cx1 - rFood - 4, cy - 4,
      PALETTE[1], `${t('mapWinback')} +${compact(foodIn)}`, 57, cy - 36, 'start'));
  }
  if (r && r.lostFood > 0.5) {
    flows.push(arrow(
      `M ${cx1 - 10} ${cy + rFood + 2} L ${cx1 - 24} ${cy + rFood + 26}`,
      cx1 - 24, cy + rFood + 26,
      'var(--bad)', `−${compact(r.lostFood)}`, cx1 - 32, cy + rFood + 38));
  }

  // Значки состояния рынка
  const badges = [];
  if (r && r.warMonthsLeft > 0) {
    badges.push(`<text x="${cx2 + rTaxi + 12}" y="${cy + 4}" class="m-muted">⚔️ ${tx(taxi.incumbentName)} · ${r.warMonthsLeft}</text>`);
  }
  if (r && r.fedMonthsLeft > 0) {
    badges.push(`<text x="640" y="26" text-anchor="end" class="m-muted">🏴 ${t('mapFed', { months: r.fedMonthsLeft })}</text>`);
  }

  const taxiNode = taxiOn
    ? `<g class="node" data-jump="group:taxi">
        <circle cx="${cx2}" cy="${cy}" r="${rTaxi}" fill="rgba(244,114,182,0.14)" stroke="${PALETTE[2]}" stroke-width="1.5"/>
        <text x="${cx2}" y="${cy - 2}" text-anchor="middle">${taxi.icon} ${t('mapTaxi')}</text>
        <text x="${cx2}" y="${cy + 14}" text-anchor="middle" class="m-num">${compact(taxiU)}</text>
      </g>`
    : `<g class="node" data-jump="panel:verticals">
        <circle cx="${cx2}" cy="${cy}" r="16" fill="none" stroke="var(--line)" stroke-dasharray="4 3"/>
        <text x="${cx2}" y="${cy - 26}" text-anchor="middle" class="m-muted">${taxi.icon} ${t('mapTaxiOff')}</text>
      </g>`;

  // Узел склейки: люди в двух сервисах — цветом серии «Оба сервиса» с графика
  const bothLabel = rBoth > 0
    ? `<g class="node" data-jump="lever:crossSell">
        <line x1="${cx1 + rFood - 4}" y1="${cy}" x2="${cxB - rBoth}" y2="${cy}" stroke="${PALETTE[3]}" stroke-dasharray="3 3" opacity="0.6"/>
        <line x1="${cxB + rBoth}" y1="${cy}" x2="${cx2 - rTaxi + 4}" y2="${cy}" stroke="${PALETTE[3]}" stroke-dasharray="3 3" opacity="0.6"/>
        <circle cx="${cxB}" cy="${cy}" r="${rBoth}" fill="rgba(250,204,21,0.13)" stroke="${PALETTE[3]}" stroke-width="1.5"/>
        <text x="${cxB}" y="${cy - rBoth - 8}" text-anchor="middle" class="m-muted">${t('mapBoth')}</text>
        <text x="${cxB}" y="${cy + 4}" text-anchor="middle" class="m-num" style="font-size:11px">${compact(bothU)}</text>
      </g>`
    : '';

  box.innerHTML = `<div class="panel eco-map">
    <h2 class="panel-title">${t('mapTitle')}</h2>
    <svg viewBox="0 0 700 248" role="img" aria-label="${t('mapTitle')}">
      <text x="14" y="22" class="m-muted">${t('mapCity', { adults: compact(CONFIG.cityAdults) })}</text>
      <g class="node" data-jump="group:food">
        <circle cx="${cx1}" cy="${cy}" r="${rFood}" fill="rgba(96,165,250,0.14)" stroke="${PALETTE[1]}" stroke-width="1.5"/>
        <text x="${cx1 - 14}" y="${cy - 2}" text-anchor="middle">${asset.icon} ${t('mapFood')}</text>
        <text x="${cx1 - 14}" y="${cy + 14}" text-anchor="middle" class="m-num">${compact(foodU)}</text>
      </g>
      ${taxiNode}
      ${bothLabel}
      ${flows.join('')}
      ${badges.join('')}
      <text x="350" y="240" text-anchor="middle" class="m-muted">${t('mapUnique', {
        unique: compact(unique), share: pct(unique / CONFIG.cityAdults, 0),
      })}</text>
    </svg>
    <div class="chart-caption">${t('mapCaption')}</div>
  </div>`;
}

// ----------------------------------------------------------------------------
// Вертикали: стартовый актив, такси, будущие фазы
// ----------------------------------------------------------------------------
function renderVerticals() {
  const asset = assetById(state.assetId);
  const r = last();
  const chosen = new Set(state.decisions.verticals ?? []);
  const taxi = verticalById('taxi');
  const gateOpen = expansionOpen(state, taxi);

  // Карточка стартового актива: информация, не переключатель
  const assetCard = `<div class="district active" data-role="asset">
    <div class="district-head">
      <span class="district-name">${asset.icon} ${tx(asset.name)}</span>
      <span class="badge on">${t('vertAsset')}</span>
    </div>
    <div class="district-meta">${t('vertAssetFrom', { game: tx(asset.fromGame) })} ·
      ${t('vertAssetStats', {
        users: compact(r ? r.foodUsers : asset.users),
        arpu: num(r ? r.arpuFood : asset.arpu),
        margin: pct(asset.margin, 0),
      })}</div>
    <div class="district-meta">${tx(asset.hint)}</div>
    <div class="district-meta">${tx(asset.synergyNote)}</div>
  </div>`;

  // Карточка такси: запуск/статус/война
  const on = state.taxi.on;
  const planned = chosen.has('taxi') && !on;
  const badge = on
    ? `<span class="badge on">${t('vertLive')}</span>`
    : planned
      ? `<span class="badge">${t('vertPlanned')}</span>`
      : gateOpen
        ? `<span class="badge">${t('vertLaunch', { cost: money(taxi.launchCost) })}</span>`
        : `<span class="badge">${t('vertLocked', {
            month: taxi.gate.minMonth, n: taxi.gate.assetContributionMonths,
          })}</span>`;
  const stats = on
    ? `<div class="district-meta">${t('vertLiveStats', {
        users: compact(state.taxi.users), drivers: num(state.taxi.drivers),
        fill: r ? pct(r.fill, 0) : '—',
      })}</div>${r && r.warMonthsLeft > 0
        ? `<div class="district-meta neg">${t('vertWar', {
            name: tx(taxi.incumbentName), months: r.warMonthsLeft,
          })}</div>` : ''}`
    : `<div class="district-meta">${t('vertFixedNote', {
        cost: money(taxi.launchCost), monthly: money(taxi.fixedMonthly),
        incumbent: tx(taxi.incumbentName), war: taxi.warMonths,
      })}</div>`;
  const taxiCard = `<div class="district ${on || planned ? 'active' : ''}" data-vertical="taxi"
      ${on ? `title="${t('vertCloseHint')}"` : ''}>
    <div class="district-head">
      <span class="district-name">${taxi.icon} ${tx(taxi.name)}</span>
      ${badge}
    </div>
    <div class="district-meta">${tx(taxi.hint)}</div>
    ${stats}
  </div>`;

  // Будущие фазы: видны, но заперты — дисциплина скоупа наглядно
  const future = FUTURE_VERTICALS.map((v) => `<div class="district" style="opacity:.55">
    <div class="district-head">
      <span class="district-name">${v.icon} ${tx(v.name)}</span>
      <span class="badge">🔒 ${t('vertFuture')}</span>
    </div>
    <div class="district-meta">${tx(v.hint)}</div>
  </div>`).join('');

  el('verticals').innerHTML = assetCard + taxiCard + future;

  el('verticals').querySelectorAll('[data-vertical]').forEach((node) => {
    node.addEventListener('click', () => {
      const id = node.dataset.vertical;
      const set = new Set(state.decisions.verticals ?? []);
      if (!set.has(id) && !state.taxi.on && !gateOpen) {
        toast(t('vertLockedToast', {
          month: taxi.gate.minMonth, n: taxi.gate.assetContributionMonths,
        }));
      }
      if (set.has(id)) set.delete(id); else set.add(id);
      state.decisions.verticals = [...set];
      renderVerticals();
      renderRightTab();
      save();
    });
  });
}

// ----------------------------------------------------------------------------
// Совет директоров: цель года
// ----------------------------------------------------------------------------
function goalText(goal) {
  if (goal.type === 'secondLeg') return t('goalSecondLeg', { target: num(goal.target, 0) });
  if (goal.type === 'glue') {
    return t('goalGlue', { target: pct(goal.target, 0), floor: num(goal.uniqueFloor, 0) });
  }
  return t('goalProfit', { target: goal.target, floor: num(goal.uniqueFloor, 0) });
}

function renderBoard() {
  const goal = state.board?.goal;
  const r = last();
  if (!goal) { el('board').innerHTML = `<div class="hint-box">${t('goalDone')}</div>`; return; }
  const p = goalProgress(goal, {
    taxiUsers: r?.taxiUsers ?? 0,
    multiShare: r?.multiShare ?? 0,
    profitableMonths: state.board.profitableMonths,
    uniqueUsers: r?.uniqueUsers ?? uniqueUsers(state),
  });
  const now = goal.type === 'secondLeg' ? num(p.value, 0)
    : goal.type === 'glue' ? pct(p.value, 1)
    : `${p.value} / ${goal.target}`;
  const past = (state.board.history ?? []).map((h) =>
    `<div class="goal-past ${h.passed ? 'pos' : 'neg'}">${t('goalYear', { year: h.year })}: ${
      h.passed ? t('goalPassed') : t('goalFailed')}</div>`).join('');
  const capped = state.restrictions?.marketingCap
    ? `<div class="funding-note neg">${t('goalCapped', {
        cap: money(state.restrictions.marketingCap),
        until: state.restrictions.until })}</div>` : '';
  el('board').innerHTML = `
    <div class="hint-box"><b>${t('goalYear', { year: goal.year })}.</b> ${goalText(goal)}<br>
      <span class="${p.done ? 'pos' : 'neg'}">${t('goalNow', { value: now })}</span></div>
    ${capped}${past}`;
}

// ----------------------------------------------------------------------------
// Инвестиции
// ----------------------------------------------------------------------------
function renderFunding() {
  const canRaise = state.month >= CONFIG.minMonthForFunding && !state.over;
  const v = valuation(state);
  const rows = CONFIG.fundingOptions.map((amount) => {
    const o = fundingOffer(state, amount);
    return `<div class="funding-row">
      <div>
        <div><b>${money(amount)}</b></div>
        <div class="funding-note">${t('fundingDilution', {
          dilution: pct(o.dilution, 1), equity: pct(o.newEquity, 1),
        })}</div>
      </div>
      <button class="btn small" data-raise="${amount}" ${canRaise ? '' : 'disabled'}>${t('fundingTake')}</button>
    </div>`;
  }).join('');

  const lastR = last();
  const burn = lastR && lastR.profit < 0 ? -lastR.profit : 0;
  const runwayTurns = burn > 0 ? state.cash / burn : null;
  const runwayNote = runwayTurns !== null
    ? `<div class="funding-note"${runwayTurns < 5 ? ' style="color:var(--bad)"' : ''}>${
        t('fundingRunway', { n: num(runwayTurns, 1) })}</div>`
    : '';

  el('funding').innerHTML = `
    <div class="funding-note">${t('fundingHead', {
      valuation: money(v), equity: pct(state.equity, 1), raised: money(state.raisedTotal),
    })}</div>
    ${runwayNote}
    ${rows}
    <div class="funding-note">
      ${t('fundingNote')}
      ${state.month < CONFIG.minMonthForFunding ? t('fundingLocked', { month: CONFIG.minMonthForFunding }) : ''}
    </div>`;

  el('funding').querySelectorAll('[data-raise]').forEach((b) => {
    b.addEventListener('click', () => {
      const amount = Number(b.dataset.raise);
      const { state: next, offer } = raise(state, amount);
      state = next;
      save();
      renderAll();
      toast(t('fundingDone', { amount: money(amount), dilution: pct(offer.dilution, 1) }));
    });
  });
}

// ----------------------------------------------------------------------------
// Событие месяца
// ----------------------------------------------------------------------------
function renderEvent() {
  const ev = state.pendingEvent;
  if (!ev || state.over) { el('event-slot').innerHTML = ''; return; }

  const options = ev.options
    ? `<div class="event-options">${ev.options.map((o, i) => `
        <button class="event-option ${state.pendingChoice === i ? 'selected' : ''}" data-choice="${i}">
          <b>${tx(o.label)}</b><span>${tx(o.detail)}</span>
        </button>`).join('')}</div>`
    : `<div class="funding-note">${t('eventAuto')}</div>`;

  el('event-slot').innerHTML = `<div class="panel event">
    <h3>⚡ ${tx(ev.title)}</h3>
    <p>${tx(ev.text)}</p>
    ${options}
    ${ev.lesson ? `<div class="lesson"><b>${t('eventLesson')}</b> ${tx(ev.lesson)}</div>` : ''}
  </div>`;

  el('event-slot').querySelectorAll('[data-choice]').forEach((b) => {
    b.addEventListener('click', () => {
      state.pendingChoice = Number(b.dataset.choice);
      renderEvent();
      save();
    });
  });
}

// ----------------------------------------------------------------------------
// Отчёт месяца + разбор факторов + предупреждения
// ----------------------------------------------------------------------------
function stat(label, value, sub) {
  return `<div class="stat"><div class="s-label">${label}</div>
    <div class="s-value">${value}</div><div class="s-sub">${sub ?? ''}</div></div>`;
}

function buildAlerts(r) {
  const alerts = [];
  const burn = -(r.profit - r.oneOff);
  const runway = burn > 0 ? state.cash / burn : Infinity;
  const goal = state.board?.goal;

  if (!state.taxi.on && goal?.type === 'secondLeg') {
    alerts.push(['warn', t('alertNoTaxi', { target: num(goal.target, 0) }), 'panel:verticals']);
  }
  if (r.atWar && r.warMonthsLeft > 0) {
    alerts.push(['warn', t('alertWar', { months: r.warMonthsLeft }), 'panel:verticals']);
  }
  if (r.fedMonthsLeft > 0) {
    alerts.push(['warn', t('alertFed', { months: r.fedMonthsLeft })]);
  }
  if (r.crisisMonthsLeft > 0) {
    alerts.push(['warn', t(r.crisisCut ? 'alertCrisisCut' : 'alertCrisis', {
      months: r.crisisMonthsLeft })]);
  }
  if (state.taxi.on && r.fill < 0.9 && r.demandTrips > 0) {
    alerts.push(['bad', t('alertNoDrivers', { fill: pct(r.fill, 0) }), 'lever:taxiSupply']);
  } else if (state.taxi.on && r.utilDrivers > 0 && r.utilDrivers < 0.45 && r.drivers > 300) {
    alerts.push(['warn', t('alertIdleDrivers', { util: pct(r.utilDrivers, 0) }), 'lever:taxiSupply']);
  }
  if (r.crossWasted > 0.2 * (r.decisions.crossSell ?? 0) && (r.decisions.crossSell ?? 0) > 0) {
    alerts.push(['warn', t('alertCrossWasted', { wasted: money(r.crossWasted) }), 'lever:crossSell']);
  }
  if ((r.decisions.foodTake ?? 1) > CONFIG.foodTakeThreshold) {
    alerts.push(['bad', t('alertTakeExodus', {
      take: pct(r.decisions.foodTake, 0) }), 'lever:foodTake']);
  }
  const gainedFood = r.wonBack + r.organicFood + r.crossBackConv;
  if (r.lostFood > gainedFood * 1.3 && r.lostFood > 2000) {
    alerts.push(['warn', t('alertFoodShrinking', {
      lost: compact(r.lostFood), gained: compact(gainedFood) }), 'lever:foodOps']);
  }
  if (r.winbackWasted > 0.3 * (r.decisions.foodMarketing ?? 0) && (r.decisions.foodMarketing ?? 0) > 500_000) {
    alerts.push(['warn', t('alertWinbackDry', { wasted: money(r.winbackWasted) }), 'lever:foodMarketing']);
  }
  if (r.focusPenalty > 0.06) {
    alerts.push(['warn', t('alertFocus', { penalty: pct(r.focusPenalty, 0) }), 'lever:mgmt']);
  }
  if (r.trustMonthsLeft > 0) {
    alerts.push(['bad', t('alertTrust', { months: r.trustMonthsLeft })]);
  }
  if (runway < 5 && state.cash >= 0 && burn > 0) {
    alerts.push(['bad', t('alertRunway', {
      months: runway.toFixed(0), burn: money(burn) }), 'panel:funding']);
  }
  if (r.profit > 0) alerts.push(['good', t('alertProfit', { value: money(r.profit) })]);
  return alerts;
}

// Экран месяца 0: первый настоящий ход — «куда идти дальше».
// Три развилки с ценой каждой, а не список настроек.
function renderStartHint() {
  const taxi = verticalById('taxi');
  const fork = (title, body, jump) => `<div class="hint-box" style="margin-top:8px">
    <b>${title}</b> ${body} <a class="jump" data-jump="${jump}">${t('jumpGo')}</a>
  </div>`;
  return `<div class="panel">
    <h3 style="margin:0 0 8px">${t('reportMonth0')}</h3>
    <div class="funding-note">
      <b>${t('reportStartTitle')}</b> ${t('reportStartIntro', { cash: money(CONFIG.startCash) })}
    </div>
    ${fork(t('forkLaunchTitle'), t('forkLaunchBody', {
      cost: money(taxi.launchCost), war: taxi.warMonths,
    }), 'panel:verticals')}
    ${fork(t('forkSaveTitle'), t('forkSaveBody'), 'panel:funding')}
    ${fork(t('forkMilkTitle'), t('forkMilkBody'), 'lever:foodTake')}
    <div class="funding-note" style="margin-top:8px">${t('forkFooter')}
      <a class="jump" data-jump="tab:base">${t('jumpGo')}</a></div>
  </div>`;
}

function renderReport() {
  const r = last();
  if (!r) { el('report-slot').innerHTML = renderStartHint(); return; }

  const drivers = explain(prev(), r);
  const netEffect = drivers.reduce((acc, d) => acc * (1 + d.effect), 1) - 1;
  const maxAbs = Math.max(0.02, ...drivers.map((d) => Math.abs(d.effect)));
  const bar = (effect, scale) => {
    const w = (Math.abs(effect) / scale) * 50;
    const pos = effect > 0;
    return `<span class="d-bar"><span class="d-fill" style="${
      pos ? `left:50%;width:${w}%` : `right:50%;width:${w}%`};background:${
      pos ? 'var(--good)' : 'var(--bad)'}"></span></span>`;
  };
  const driversHtml = drivers.length ? `
    <div class="drivers">
      <div class="panel-title">${t('driversTitle', {
        delta: signedPct(r.revenue / Math.max(1e-9, prev().revenue) - 1),
      })}</div>
      ${drivers.map((d) => {
        const w = (Math.abs(d.effect) / maxAbs) * 50;
        const pos = d.effect > 0;
        return `<div class="driver">
          <span class="d-name">${t(d.key)}</span>
          <span class="d-bar">
            <span class="d-fill" style="${pos ? `left:50%;width:${w}%` : `right:50%;width:${w}%`};background:${pos ? 'var(--good)' : 'var(--bad)'}"></span>
          </span>
          <span class="d-val ${pos ? 'pos' : 'neg'}">${signedPct(d.effect)}</span>
        </div>`;
      }).join('')}
      <div class="d-sum">
        <span class="d-name">${t('driversNet')}</span>
        ${bar(netEffect, maxAbs)}
        <span class="d-val ${netEffect > 0 ? 'pos' : 'neg'}">${signedPct(netEffect)}</span>
      </div>
      <div class="funding-note" style="margin-top:4px">${t('driversFormula')}</div>
    </div>` : '';

  const alerts = buildAlerts(r);
  const alertsHtml = alerts.length
    ? `<div class="alerts">${alerts.map(([k, text, jump]) => `<div class="alert ${k}">${text}${
        jump ? ` <a class="jump" data-jump="${jump}">${t('jumpGo')}</a>` : ''}</div>`).join('')}</div>`
    : '';

  const ev = r.event ? eventById(r.event.id) : null;
  const eventNote = ev ? `<div class="lesson"><b>${tx(ev.title)}.</b> ${tx(ev.lesson)}</div>` : '';

  const launchNote = r.taxiLaunched
    ? `<div class="alert warn" style="margin-top:8px">${t('launchNote', {
        cost: money(verticalById('taxi').launchCost), months: verticalById('taxi').warMonths,
      })}</div>` : '';
  const closeNote = r.taxiClosed
    ? `<div class="alert warn" style="margin-top:8px">${t('closeNote')}</div>` : '';

  const p = prev();
  const sm = (v) => (v >= 0 ? '+' : '') + money(v);
  const deltaLine = p ? `<div class="funding-note" style="margin-top:2px">${t('reportDelta', {
    revenue: signedPct(r.revenue / Math.max(1e-9, p.revenue) - 1, 0),
    profit: sm(r.profit - p.profit),
    cash: sm(r.cash - p.cash),
  })}</div>` : '';

  el('report-slot').innerHTML = `<div class="panel">
    <div class="report-head">
      <h3>${t('reportTitle', { month: r.month })}</h3>
      <span class="funding-note">${t('reportHeadStats', {
        revenue: money(r.revenue), food: money(r.revenueFood), taxi: money(r.revenueTaxi),
      })}</span>
    </div>
    ${deltaLine}
    <div class="report-grid">
      ${stat(t('statRevenue'), money(r.revenue),
        t('statRevenueSub', { food: money(r.revenueFood), taxi: money(r.revenueTaxi) }))}
      ${stat(t('statProfit'), money(r.profit),
        t('statProfitSub', { contribution: money(r.contribution), opex: money(r.opex) }))}
      ${stat(t('statUnique'), compact(r.uniqueUsers),
        t('statUniqueSub', {
          food: compact(r.foodUsers), taxi: compact(r.taxiUsers), both: compact(r.bothUsers),
        }))}
      ${stat(t('statArpu'), `${num(r.arpuHolding)} ₽`, t('statArpuSub'))}
      ${stat(t('statTaxi'), r.taxiOn ? compact(r.taxiUsers) : '—',
        r.taxiOn ? t('statTaxiSub', { drivers: num(r.drivers), fill: pct(r.fill, 0) }) : t('statTaxiOff'))}
      ${stat(t('statCross'), r.crossConv + r.crossBackConv > 0
          ? `+${compact(r.crossConv + r.crossBackConv)}` : '—',
        r.crossConv + r.crossBackConv > 0
          ? t('statCrossSub', {
              cac: `${num(r.crossCac)} ₽`,
              cold: r.cacCold > 0 ? `${num(r.cacCold)} ₽` : '—',
            })
          : t('statCrossOff'))}
      ${stat(t('statMulti'), pct(r.multiShare, 1),
        t('statMultiSub', { premium: pct(Math.min(CONFIG.crossPremiumCap, CONFIG.crossPremiumPerShare * r.multiShare), 0) }))}
      ${stat(t('statFocus'), r.focusPenalty > 0.005 ? `−${pct(r.focusPenalty, 0)}` : '✓',
        r.focusPenalty > 0.005
          ? t('statFocusSub', { penalty: pct(r.focusPenalty, 0) }) : t('statFocusOk'))}
    </div>
    ${launchNote}
    ${closeNote}
    ${driversHtml}
    ${alertsHtml}
    ${eventNote}
  </div>`;
}

// ----------------------------------------------------------------------------
// Новости месяца
// ----------------------------------------------------------------------------
function balance(inflow, outflow, goodKey, evenKey, badKey) {
  const a = Math.round(inflow);
  const b = Math.round(outflow);
  if (a > b) return ['good', t(goodKey)];
  if (a < b) return ['warn', t(badKey)];
  return ['', t(evenKey)];
}

function buildNews(r) {
  const news = [];
  const taxi = verticalById('taxi');

  if (!state.taxi.on && expansionOpen(state, taxi) && !(state.decisions.verticals ?? []).includes('taxi')) {
    news.push(['good', t('newsGateOpen')]);
  }
  if (r?.taxiLaunched) news.push(['warn', t('newsWarStarted')]);
  else if (r && r.warMonthsLeft > 0) news.push(['warn', t('newsWarLeft', { months: r.warMonthsLeft })]);
  else if (r && r.taxiOn && prev()?.warMonthsLeft > 0 && r.warMonthsLeft === 0) {
    news.push(['good', t('newsWarOver')]);
  }
  if (r && r.fedMonthsLeft > 0) news.push(['warn', t('newsFed', { months: r.fedMonthsLeft })]);
  if (r && prev()?.fedMonthsLeft > 0 && r.fedMonthsLeft === 0) news.push(['good', t('newsFedOver')]);
  if (r && r.crisisMonthsLeft > 0) news.push(['warn', t('newsCrisis', { months: r.crisisMonthsLeft })]);
  if (r && prev()?.crisisMonthsLeft > 0 && r.crisisMonthsLeft === 0) news.push(['good', t('newsCrisisOver')]);
  if (r && r.tripsAdd > 0 && prev() && !(prev().tripsAdd > 0)) news.push(['good', t('newsAirport')]);

  if (r) {
    const came = r.wonBack + r.organicFood + r.coldAcq + r.crossConv + r.crossBackConv;
    const left = r.lostFood + r.lostTaxi;
    if (came > 0 || left > 0) {
      const [kind, verdict] = balance(came, left,
        'newsCustomersGood', 'newsCustomersEven', 'newsCustomersBad');
      news.push([kind, t('newsCustomers', {
        came: num(came, 0), left: num(left, 0), verdict,
      })]);
    }
    if (r.crossConv + r.crossBackConv > 0) {
      news.push(['', t('newsCross', {
        conv: num(r.crossConv + r.crossBackConv, 0),
        toTaxi: num(r.crossConv, 0), toFood: num(r.crossBackConv, 0),
      })]);
    }
  }

  const goal = state.board?.goal;
  if (goal && r) {
    const monthsLeft = CONFIG.boardYearMonths - ((state.month - 1) % CONFIG.boardYearMonths) - 1;
    const p = goalProgress(goal, {
      taxiUsers: r.taxiUsers, multiShare: r.multiShare,
      profitableMonths: state.board.profitableMonths, uniqueUsers: r.uniqueUsers,
    });
    if (monthsLeft > 0 && monthsLeft <= 3 && !p.done) {
      news.push(['warn', t('newsGoalTight', { months: monthsLeft })]);
    }
  }
  return news;
}

function renderNews() {
  if (state.over) { el('news-slot').innerHTML = ''; return; }
  const r = last();
  const news = buildNews(r);
  el('news-slot').innerHTML = `<div class="panel">
    <h2 class="panel-title">${t('newsPanel')}</h2>
    ${news.length
      ? news.map(([kind, text]) => `<div class="alert ${kind}">${text}</div>`).join('')
      : `<div class="alert">${t('newsEmpty')}</div>`}
  </div>`;
}

// ----------------------------------------------------------------------------
// Графики
// ----------------------------------------------------------------------------
const CHART_TABS = {
  clients: {
    label: 'chartClients', caption: 'chartClientsCaption',
    series: (h) => [
      { label: t('seriesUnique'), data: h.map((r) => r.uniqueUsers), color: PALETTE[0] },
      { label: t('seriesFood'), data: h.map((r) => r.foodUsers), color: PALETTE[1] },
      { label: t('seriesTaxi'), data: h.map((r) => r.taxiUsers), color: PALETTE[2] },
      { label: t('seriesBoth'), data: h.map((r) => r.bothUsers), color: PALETTE[3] },
    ],
  },
  money: {
    label: 'chartMoney', caption: 'chartMoneyCaption', zeroLine: true,
    series: (h) => [
      { label: t('seriesRevenue'), data: h.map((r) => r.revenue), color: PALETTE[1] },
      { label: t('seriesContribution'), data: h.map((r) => r.contribution), color: PALETTE[0] },
      { label: t('seriesProfit'), data: h.map((r) => r.profit), color: PALETTE[3] },
    ],
  },
  cash: {
    label: 'chartCash', caption: 'chartCashCaption', zeroLine: true,
    series: (h) => [{ label: t('chartCash'), data: h.map((r) => r.cash), color: PALETTE[2] }],
  },
  arpu: {
    label: 'chartArpu', caption: 'chartArpuCaption',
    format: (v) => `${Math.round(v)}`,
    series: (h) => [{ label: t('seriesArpu'), data: h.map((r) => r.arpuHolding), color: PALETTE[0] }],
  },
  value: {
    label: 'chartValue', caption: 'chartValueCaption', zeroLine: true,
    series: (h) => [
      { label: t('seriesValueTotal'), data: h.map((r) => r.valuation ?? 0), color: PALETTE[0] },
      { label: t('seriesValueFood'), data: h.map((r) => r.sopFoodValue ?? 0), color: PALETTE[1] },
      { label: t('seriesValueTaxi'), data: h.map((r) => r.sopTaxiValue ?? 0), color: PALETTE[2] },
    ],
  },
  acq: {
    label: 'chartAcq', caption: 'chartAcqCaption',
    format: (v) => `${Math.round(v)}`,
    series: (h) => [
      { label: t('seriesCrossAcq'), data: h.map((r) => r.crossConv + r.crossBackConv), color: PALETTE[0] },
      { label: t('seriesColdAcq'), data: h.map((r) => r.coldAcq), color: PALETTE[2] },
    ],
  },
};

// Дневник решений: ходы, в которые игрок что-то менял
function decisionChanges() {
  const hist = state.history ?? [];
  const out = [];
  for (let i = 1; i < hist.length; i += 1) {
    const before = hist[i - 1].decisions ?? {};
    const cur = hist[i].decisions ?? {};
    const names = [];
    for (const l of LEVERS) if ((cur[l.key] ?? 0) !== (before[l.key] ?? 0)) names.push(tx(l.label));
    if ((cur.verticals ?? []).length !== (before.verticals ?? []).length) {
      names.push(t('chartChangeVerticals'));
    }
    if (names.length) out.push({ index: i, turn: hist[i].month, names });
  }
  return out;
}

function changesHtml(changes) {
  if (!changes.length) return '';
  const items = changes.slice(-4).map((c) => t('chartChangeItem', {
    turn: c.turn,
    what: c.names.slice(0, 3).join(', ') + (c.names.length > 3 ? '…' : ''),
  })).join(' · ');
  return `<div style="margin-top:4px">${t('chartChangesTitle')} ${items}</div>`;
}

function renderChart() {
  const chartsPanel = el('chart').closest('.panel');
  if (chartsPanel) chartsPanel.style.display = (state.history ?? []).length ? '' : 'none';
  if (!(state.history ?? []).length) return;
  el('chart-tabs').innerHTML = Object.entries(CHART_TABS)
    .map(([k, v]) => `<button data-chart="${k}" class="${k === chartTab ? 'active' : ''}">${t(v.label)}</button>`)
    .join('');
  el('chart-tabs').querySelectorAll('[data-chart]').forEach((b) => {
    b.addEventListener('click', () => { chartTab = b.dataset.chart; renderChart(); });
  });

  const conf = CHART_TABS[chartTab];
  const series = conf.series(state.history);
  const changes = decisionChanges();
  el('chart-legend').innerHTML = legendHtml(series);
  el('chart-caption').innerHTML = t(conf.caption) + changesHtml(changes);
  drawLineChart(el('chart'), series, {
    zeroLine: conf.zeroLine,
    format: conf.format ?? axisNum,
    emptyText: t('pnlEmpty'),
    markers: changes.map((c) => c.index),
  });
}

// ----------------------------------------------------------------------------
// Правая колонка
// ----------------------------------------------------------------------------
function renderSopTab() {
  const sop = sumOfParts(state);
  const partName = (id) => (id === 'food' ? t('sopPartFood') : t('sopPartTaxi'));
  const rows = sop.parts.map((p) => `<tr>
    <td>${partName(p.id)}${p.zoo ? `<div class="funding-note neg">${t('sopZoo')}</div>` : ''}</td>
    <td>${money(p.runRate)}</td>
    <td class="${p.growth >= 0 ? 'pos' : 'neg'}">${signedPct(p.growth, 0)}</td>
    <td class="${p.margin >= 0 ? 'pos' : 'neg'}">${pct(p.margin, 0)}</td>
    <td class="${p.value >= 0 ? 'pos' : 'neg'}">${money(p.value)}</td>
  </tr>`).join('');

  return `
    <p class="funding-note">${t('sopIntro')}</p>
    <table class="data">
      <thead><tr><th>${t('sopColPart')}</th><th>${t('sopColRunRate')}</th><th>${t('sopColGrowth')}</th><th>${t('sopColMargin')}</th><th>${t('sopColValue')}</th></tr></thead>
      <tbody>
        ${rows}
        <tr class="sub"><td colspan="4">${t('sopPremium', { share: pct(sop.multiShare, 1) })}</td>
          <td class="pos">+${pct(sop.crossPremium, 0)}</td></tr>
        <tr class="sub"><td colspan="4">${t('sopBonus')}</td>
          <td class="${sop.bonus >= 1 ? 'pos' : 'neg'}">×${sop.bonus.toFixed(2)}</td></tr>
        <tr class="total"><td colspan="4">${t('sopTotal')}</td><td>${money(sop.total)}</td></tr>
      </tbody>
    </table>
    <p class="funding-note" style="margin-top:10px">${t('sopNote')}</p>`;
}

function renderPnlTab() {
  const r = last();
  if (!r) return `<p class="funding-note">${t('pnlEmpty')}</p>`;
  const line = (name, v, cls = '', sub = false) =>
    `<tr class="${sub ? 'sub' : ''}"><td>${name}</td><td class="${cls}">${moneyExact(v)}</td></tr>`;
  const d = r.decisions;
  return `
    <table class="data">
      <tbody>
        ${line(t('pnlRevenueFood'), r.revenueFood, 'pos', true)}
        ${line(t('pnlRevenueTaxi'), r.revenueTaxi, 'pos', true)}
        <tr class="total"><td>${t('pnlRevenue')}</td><td class="pos">${moneyExact(r.revenue)}</td></tr>
        ${line(t('pnlContribFood'), r.contribFood, 'pos', true)}
        ${line(t('pnlContribTaxi'), r.contribTaxi, r.contribTaxi >= 0 ? 'pos' : 'neg', true)}
        <tr class="total"><td>${t('pnlContribution')}</td><td class="${r.contribution >= 0 ? 'pos' : 'neg'}">${moneyExact(r.contribution)}</td></tr>
        ${line(t('pnlFixedFood'), -r.fixedFood, 'neg', true)}
        ${r.taxiOn ? line(t('pnlFixedTaxi'), -r.fixedTaxi, 'neg', true) : ''}
        ${line(t('pnlHq'), -r.hqCost, 'neg', true)}
        ${line(t('pnlMgmt'), -(d.mgmt ?? 0), 'neg', true)}
        ${r.taxiOn ? line(t('pnlCrossSell'), -(d.crossSell ?? 0), 'neg', true) : ''}
        ${line(t('pnlFoodOps'), -(d.foodOps ?? 0), 'neg', true)}
        ${line(t('pnlFoodMarketing'), -(d.foodMarketing ?? 0), 'neg', true)}
        ${r.taxiOn ? line(t('pnlTaxiSupply'), -(d.taxiSupply ?? 0), 'neg', true) : ''}
        ${r.taxiOn ? line(t('pnlTaxiMarketing'), -(d.taxiMarketing ?? 0), 'neg', true) : ''}
        <tr class="total"><td>${t('pnlOperatingProfit')}</td><td class="${r.profit >= 0 ? 'pos' : 'neg'}">${moneyExact(r.profit)}</td></tr>
        ${r.oneOff > 0 ? line(t('pnlOneOff'), -r.oneOff, 'neg', true) : ''}
        <tr class="total"><td>${t('pnlCashChange')}</td><td class="${(r.profit - r.oneOff) >= 0 ? 'pos' : 'neg'}">${moneyExact(r.profit - r.oneOff)}</td></tr>
      </tbody>
    </table>
    <p class="funding-note" style="margin-top:10px">${t('pnlNote')}</p>`;
}

function renderBaseTab() {
  const r = last();
  const asset = assetById(state.assetId);
  const foodU = r ? r.foodUsers : asset.users;
  const taxiU = r ? r.taxiUsers : 0;
  const bothU = r ? r.bothUsers : 0;
  const unique = r ? r.uniqueUsers : asset.users;
  const pool = r ? r.returnPool : asset.returnPool;

  const segments = `
    <table class="data">
      <thead><tr><th>${t('baseColWho')}</th><th>${t('baseColCount')}</th></tr></thead>
      <tbody>
        <tr><td>${t('baseFood')}</td><td>${compact(foodU)}</td></tr>
        <tr><td>${t('baseTaxi')}</td><td>${compact(taxiU)}</td></tr>
        <tr><td>${t('baseBoth')}</td><td>${compact(bothU)}</td></tr>
        <tr class="total"><td>${t('baseUnique')}</td><td>${compact(unique)}</td></tr>
        <tr class="sub"><td>${t('baseMultiShare')}</td><td>${pct(unique > 0 ? bothU / unique : 0, 1)}</td></tr>
        <tr class="sub"><td>${t('baseReturnPool')}</td><td>${compact(pool)}</td></tr>
      </tbody>
    </table>`;

  let channels = '';
  if (r && state.taxi.on) {
    const cacOf = (spentPer, conv) => (conv > 0 ? `${num(spentPer / conv)} ₽` : '—');
    const budgetF = (r.decisions.crossSell ?? 0) * (1 - CONFIG.crossBackShare);
    const budgetB = (r.decisions.crossSell ?? 0) * CONFIG.crossBackShare;
    channels = `
      <h4 style="margin:14px 0 6px;font-size:13px">${t('baseAcqTitle')}</h4>
      <table class="data">
        <thead><tr><th>${t('baseColChannel')}</th><th>${t('baseColPeople')}</th><th>${t('baseColCac')}</th></tr></thead>
        <tbody>
          <tr><td>${t('baseChCross')}</td><td>${num(r.crossConv, 0)}</td><td>${cacOf(budgetF, r.crossConv)}</td></tr>
          <tr><td>${t('baseChCrossBack')}</td><td>${num(r.crossBackConv, 0)}</td><td>${cacOf(budgetB, r.crossBackConv)}</td></tr>
          <tr><td>${t('baseChCold')}</td><td>${num(r.coldAcq, 0)}</td><td>${r.cacCold > 0 ? `${num(r.cacCold)} ₽` : '—'}</td></tr>
          <tr><td>${t('baseChWinback')}</td><td>${num(r.wonBack, 0)}</td><td>${cacOf(r.decisions.foodMarketing ?? 0, r.wonBack)}</td></tr>
          <tr><td>${t('baseChOrganic')}</td><td>${num(r.organicFood, 0)}</td><td>—</td></tr>
        </tbody>
      </table>
      <p class="funding-note" style="margin-top:8px">${t('baseAcqNote')}</p>`;
  } else {
    channels = `<div class="hint-box" style="margin-top:10px">${t('baseNoTaxi')}</div>`;
  }

  return `<p class="funding-note">${t('baseIntro')}</p>${segments}${channels}`;
}

function renderHelpTab() {
  return `<div class="help">
    <h4>${t('helpWhatTitle')}</h4>
    <p>${t('helpWhatText')}</p>

    <h4>${t('helpAssetTitle')}</h4>
    <p>${t('helpAssetText')}</p>

    <h4>${t('helpCrossTitle')}</h4>
    <div class="formula">${t('helpCrossFormula')}</div>
    <p>${t('helpCrossText')}</p>

    <h4>${t('helpWarTitle')}</h4>
    <p>${t('helpWarText')}</p>

    <h4>${t('helpFocusTitle')}</h4>
    <p>${t('helpFocusText')}</p>

    <h4>${t('helpSpiralsTitle')}</h4>
    <ul>
      <li>${t('helpSpiralMilk')}</li>
      <li>${t('helpSpiralDrivers')}</li>
      <li>${t('helpSpiralZoo')}</li>
    </ul>

    <h4>${t('helpScoreTitle')}</h4>
    <div class="formula">${t('helpScoreFormula')}</div>
    <p>${t('helpScoreText')}</p>

    <h4>${t('helpLimitsTitle')}</h4>
    <p>${t('helpLimitsText')}</p>
  </div>`;
}

function renderRightTab() {
  el('tabs').querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === rightTab);
  });
  // Ключи в кавычках: по ним же проверяются переходы data-jump="tab:…"
  const content = {
    'sop': renderSopTab,
    'pnl': renderPnlTab,
    'base': renderBaseTab,
    'help': renderHelpTab,
  }[rightTab];
  el('tab-content').innerHTML = content();
}

// ----------------------------------------------------------------------------
// Модальные окна
// ----------------------------------------------------------------------------
function modal(html, actions = []) {
  const root = el('modal-root');
  root.innerHTML = `<div class="modal-bg"><div class="modal">${html}
    <div class="modal-actions">${actions.map((a, i) => `<button class="btn ${a.primary ? 'primary' : 'ghost'}" data-act="${i}">${a.label}</button>`).join('')}</div>
  </div></div>`;
  root.querySelectorAll('[data-act]').forEach((b) => {
    b.addEventListener('click', () => {
      const a = actions[Number(b.dataset.act)];
      root.innerHTML = '';
      a.onClick?.();
    });
  });
}

function toast(text) {
  const root = el('modal-root');
  const node = document.createElement('div');
  node.className = 'alert good';
  node.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:60;max-width:340px;background:#0f2018';
  node.textContent = text;
  root.appendChild(node);
  setTimeout(() => node.remove(), 3500);
}

// Развилка перед смертью: один явный шанс поднять раунд вместо тихого краха
function maybeDeathFork() {
  if (state.over || state.deathWarned) return;
  const r = last();
  if (!r || r.profit >= 0) return;
  const burn = -r.profit;
  if (state.cash >= burn * 2) return;
  if (state.month < CONFIG.minMonthForFunding) return;
  state.deathWarned = true;
  save();
  const runway = Math.max(0, state.cash / burn);
  const raiseActions = CONFIG.fundingOptions.slice(-2).map((amount) => {
    const offer = fundingOffer(state, amount);
    return {
      label: t('deathRaise', { amount: money(amount), dilution: pct(offer.dilution, 0) }),
      onClick: () => {
        state = raise(state, amount).state;
        save();
        renderAll();
        toast(t('deathRaised', { amount: money(amount), equity: pct(state.equity, 1) }));
      },
    };
  });
  modal(`<h2>${t('deathTitle')}</h2>
    <p class="funding-note">${t('deathText', {
      cash: money(state.cash), burn: money(burn),
      runway: t('deathRunway', { n: num(runway, 1) }),
    })}</p>`,
  [...raiseActions, { label: t('deathIgnore') }]);
}

// Водопад последних месяцев на экране банкротства
function waterfallHtml(rows) {
  if (!rows.length) return '';
  const cell = (v) => `<td>${money(v)}</td>`;
  const line = (label, fn) => `<tr><td>${label}</td>${rows.map((r) => cell(fn(r))).join('')}</tr>`;
  return `<h3 style="margin:12px 0 6px">${t('deathWaterfall')}</h3>
    <div style="overflow-x:auto"><table class="data">
    <thead><tr><th></th>${rows.map((r) => `<th>${t('wfTurn', { n: r.month })}</th>`).join('')}</tr></thead>
    <tbody>
      ${line(t('wfRevenue'), (r) => r.revenue)}
      ${line(t('wfCosts'), (r) => r.revenue - r.profit + r.oneOff)}
      ${line(t('wfProfit'), (r) => r.profit - r.oneOff)}
      ${line(t('wfCash'), (r) => r.cash)}
    </tbody></table></div>`;
}

// Итог заносится в локальную таблицу рекордов один раз за партию
function recordsBlockHtml(s) {
  if (!state.recordId) {
    state.recordId = String(Date.now());
    addRecord(RECORDS_KEY, {
      id: state.recordId,
      date: new Date().toISOString().slice(0, 10),
      seed: state.seed,
      score: s.bankrupt ? 0 : Math.round(s.equityValue),
      outcome: s.bankrupt ? 'bankrupt' : 'finished',
      version: APP_VERSION,
      turns: s.months,
    });
    save();
  }
  const top = loadRecords(RECORDS_KEY);
  if (!top.length) return '';
  const rows = top.map((rec, i) => `<tr${rec.id === state.recordId ? ' class="total"' : ''}>
    <td>${i + 1}</td><td>${rec.date}</td><td>${rec.seed}</td><td>${money(rec.score)}</td>
    <td>${t(rec.outcome === 'bankrupt' ? 'recordsOutcomeBankrupt' : 'recordsOutcomeFinished')}${rec.id === state.recordId ? ` ${t('recordsYou')}` : ''}</td></tr>`).join('');
  return `<h3 style="margin:12px 0 6px">${t('recordsTitle')}</h3>
    <div style="overflow-x:auto"><table class="data">
    <thead><tr><th>#</th><th>${t('recordsDate')}</th><th>${t('recordsCode')}</th><th>${t('recordsScore')}</th><th>${t('recordsOutcome')}</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function showGameOver() {
  // Зачётный счёт зафиксирован движком в момент финиша: пост-эндгейм
  // (следующие фазы) сможет продолжать партию, не трогая результат
  const s = state.scored ?? finalScore(state);
  const r = last();
  const grade = s.bankrupt ? t('gradeBankrupt')
    : s.equityValue > 5e9 ? t('gradeExcellent')
    : s.equityValue > 2e9 ? t('gradeSolid')
    : s.equityValue > 8e8 ? t('gradeSurvived') : t('gradeModest');

  const line = resultString({
    tag: GAME_TAG, version: APP_VERSION, seed: state.seed,
    score: s.bankrupt ? 0 : s.equityValue, turns: s.months,
  });
  modal(`
    <h2>${s.bankrupt ? t('gameOverBankrupt') : t('gameOverFinished')}</h2>
    <p class="funding-note">${s.bankrupt
      ? t('gameOverBankruptText', { month: s.months }) : t('gameOverFinishedText')}</p>
    <div class="score-grid">
      <div class="stat"><div class="s-label">${t('scoreValuation')}</div><div class="s-value">${money(s.valuation)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreStake')}</div><div class="s-value">${pct(s.equity, 1)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreResult')}</div><div class="s-value">${money(s.equityValue)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreRaised')}</div><div class="s-value">${money(s.raised)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreCash')}</div><div class="s-value">${money(s.cash)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreGrade')}</div><div class="s-value">${grade}</div></div>
    </div>
    <p class="funding-note">${t('gradeScale', { a: money(5e9), b: money(2e9), c: money(8e8) })}</p>
    ${lbEndpoint() ? '<div id="lb-root"></div>' : ''}
    ${r ? `<p class="funding-note">${t('gameOverLastMonth', {
      revenue: money(r.revenue), arpu: num(r.arpuHolding),
      unique: compact(r.uniqueUsers), multi: compact(r.bothUsers),
    })}</p>` : ''}
    ${s.bankrupt ? waterfallHtml(state.history.slice(-4)) : ''}
    <h3 style="margin:12px 0 6px">${t('resultTitle')}</h3>
    <p class="funding-note">${t('resultNote')}</p>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <code style="user-select:all;overflow-wrap:anywhere">${line}</code>
      <button class="btn small" id="copy-result" type="button">${t('resultCopy')}</button>
    </div>
    ${recordsBlockHtml(s)}
    <div class="hint-box" style="margin-top:10px">${t('gameOverQuestions')}</div>
  `, [
    { label: t('gameOverPlayAgain'), primary: true, onClick: () => restart() },
    { label: t('gameOverCharts'), onClick: () => {} },
  ]);
  // Мировая таблица: живёт только там, где страница знает адрес сервера.
  lbMount({
    root: el('modal-root').querySelector('#lb-root'),
    t,
    money,
    game: GAME_TAG,
    line,
    myScore: s.bankrupt ? 0 : s.equityValue,
    submitted: Boolean(state.lbSent),
    onSubmitted: () => { state.lbSent = true; save(); },
  });
  el('modal-root').querySelector('#copy-result')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(line).then(() => toast(t('resultCopied'))).catch(() => {});
  });
}

// Приветственный экран: куда человек попал и что от него хотят.
function showWelcome() {
  let seedWanted = '';
  const best = bestRecord(RECORDS_KEY);
  const asset = assetById(state.assetId);
  modal(`<h2>${t('welcomeTitle')}</h2>
    <p class="funding-note">${t('welcomeRole')}</p>
    <p class="funding-note">${t('welcomeTurn')}</p>
    <p class="funding-note">${t('welcomeTension')}</p>
    <p class="funding-note">${t('welcomeGoal')}</p>
    <p class="funding-note">${t('welcomeHint')}</p>
    <div class="hint-box" style="margin-top:8px"><b>${t('welcomeAsset')}:</b>
      ${asset.icon} ${tx(asset.name)} · ${t('vertAssetStats', {
        users: compact(asset.users), arpu: num(asset.arpu), margin: pct(asset.margin, 0),
      })}<br>${t('welcomeAssetNote')}</div>
    <label class="funding-note" style="display:block;margin-top:8px">${t('seedLabel')}
      <input id="seed-input" type="text" placeholder="${t('seedPlaceholder')}"
        style="display:block;width:100%;margin-top:4px;padding:7px 9px;background:transparent;border:1px solid var(--line);border-radius:6px;color:inherit;font:inherit">
    </label>
    <p class="funding-note">${t('seedNote')}</p>
    ${best ? `<p class="funding-note">${t('welcomeBest', { score: money(best.score) })}</p>` : ''}
    <p class="funding-note numbers-note">${t('welcomeNumbers')}</p>`,
  [{ label: t('welcomeStart'), primary: true, onClick: () => {
      track('game_start');
      const v = seedWanted.trim();
      if (v && v !== state.seed) { state = createInitialState(v); save(); renderAll(); }
    } },
   { label: t('welcomeMore'), onClick: showHelp },
   // Переключатель языка в шапке накрыт модалкой, а именно здесь язык и важен
   { label: getLang() === 'ru' ? 'English' : 'Русский',
     onClick: () => { switchLang(); showWelcome(); } }]);
  el('modal-root').querySelector('#seed-input')
    ?.addEventListener('input', (e) => { seedWanted = e.target.value; });
}

function showHelp() {
  modal(`<h2>${t('helpModalTitle')}</h2>${renderHelpTab()}`
    + `<p class="funding-note">${t('helpSeed', { seed: state.seed })}</p>`
    + `<p class="funding-note">${t('helpAuthor')} ${APP_VERSION === 'dev'
        ? t('helpVersionDev') : t('helpVersion', { version: APP_VERSION, date: APP_BUILD_DATE })}</p>`,
    [{ label: t('helpModalOk'), primary: true }]);
}

// ----------------------------------------------------------------------------
// Ход игры
// ----------------------------------------------------------------------------
function nextMonth() {
  if (state.over) { showGameOver(); return; }
  const ev = state.pendingEvent;
  if (ev && ev.options && state.pendingChoice === null) {
    toast(t('eventChoiceNeeded'));
    return;
  }
  const { state: next } = step(state, { decisions: state.decisions, eventChoice: state.pendingChoice ?? 0 });
  state = next;
  save();
  renderAll();
  if (state.over) {
    track(state.over === 'bankrupt' ? 'game_bankrupt' : 'game_finished');
    showGameOver();
  } else {
    maybeDeathFork();
  }
}

function restart() {
  const seed = `novograd-${Math.floor(Math.random() * 1e6)}`;
  state = createInitialState(seed);
  save();
  renderAll();
  showWelcome();
}

function showWorldTop() {
  modal(`<h2>${t('lbTitle')}</h2><div id="lb-root"></div>`,
    [{ label: t('helpModalOk'), primary: true }]);
  lbMount({
    root: el('modal-root').querySelector('#lb-root'),
    t, money, game: GAME_TAG, viewOnly: true,
  });
}

function renderChrome() {
  el('brand-title').textContent = t('brandTitle');
  el('brand-sub').textContent = t('brandSub');
  el('title-levers').textContent = t('panelLevers');
  el('title-verticals').textContent = t('panelVerticals');
  el('title-board').textContent = t('panelBoard');
  el('title-funding').textContent = t('panelFunding');
  el('title-dynamics').textContent = t('panelDynamics');
  el('btn-restart').textContent = t('btnRestart');
  el('btn-help').title = t('btnHelpTitle');
  el('btn-lang').textContent = t('langToggle');
  el('btn-lang').title = t('langTitle');
  el('app-foot').textContent = t('footNumbers');
  // Кнопки «Игры» и «🏆» живут только там, где есть витрина и сервер таблицы
  const homeBtn = el('btn-home');
  if (homeBtn) {
    homeBtn.hidden = !window.__homeUrl;
    if (window.__homeUrl) {
      homeBtn.href = window.__homeUrl;
      homeBtn.textContent = t('btnHome');
      homeBtn.title = t('btnHomeTitle');
    }
  }
  const topBtn = el('btn-top');
  if (topBtn) { topBtn.hidden = !lbEndpoint(); topBtn.title = t('lbTitle'); }

  el('btn-next').textContent = state.over
    ? t('btnResults') : t('btnNext', { month: state.month + 1 });
  for (const [tab, key] of Object.entries({
    sop: 'tabSop', pnl: 'tabPnl', base: 'tabBase', help: 'tabHelp',
  })) {
    const node = el('tabs').querySelector(`[data-tab="${tab}"]`);
    if (node) node.textContent = t(key);
  }
}

function renderAll() {
  if (!leversBuilt || leversBuiltTaxiOn !== state.taxi.on) buildLevers();
  renderChrome();
  syncLevers();
  renderLeverReadouts();
  renderBudgetBar();
  renderEcoMap();
  renderKpis();
  renderVerticals();
  renderBoard();
  renderFunding();
  renderEvent();
  renderReport();
  renderNews();
  renderChart();
  renderRightTab();
}

function switchLang() {
  setLang(getLang() === 'ru' ? 'en' : 'ru');
  leversBuilt = false;   // подписи рычагов меняются вместе с языком
  renderAll();
}

// Экран отказа вместо пустой страницы
function renderCrash(error) {
  const message = error && error.message ? error.message : String(error);
  const box = document.createElement('div');
  box.className = 'crash crash-panel';
  box.innerHTML = `<div class="panel">
    <h2 class="panel-title">${t('crashTitle')}</h2>
    <p class="funding-note">${t('crashText')}</p>
    <pre class="crash-message"></pre>
    <button class="btn primary" id="btn-crash-reset">${t('crashReset')}</button>
    <p class="funding-note">${t('crashBrowser')}</p>
  </div>`;
  box.querySelector('.crash-message').textContent = `v${APP_VERSION}\n${message}\n${navigator.userAgent}`;
  document.body.prepend(box);
  box.querySelector('#btn-crash-reset').addEventListener('click', () => {
    dropSave();
    location.reload();
  });
}

export function init() {
  try {
    boot();
  } catch (error) {
    // Испорченное сохранение — самая частая причина. Пробуем ещё раз с нуля.
    dropSave();
    try {
      document.querySelector('.crash-panel')?.remove();
      boot();
    } catch (again) {
      renderCrash(again);
      throw again;
    }
  }
}

function boot() {
  setStrings(STRINGS);
  setLang(detectLang());
  const saved = load();
  state = saved ?? createInitialState('novograd');

  if (!bound) {
    bound = true;
    bindJumps();
    // На телефоне таблицы показываются карточками; подписи ячейкам берутся
    // из шапки и обновляются сами при любой перерисовке.
    watchTables();
    el('btn-next').addEventListener('click', nextMonth);
    el('btn-top')?.addEventListener('click', showWorldTop);
    el('btn-help').addEventListener('click', showHelp);
    el('btn-lang').addEventListener('click', switchLang);
    el('btn-restart').addEventListener('click', () => {
      modal(`<h2>${t('restartTitle')}</h2><p class="funding-note">${t('restartText')}</p>`,
        [{ label: t('restartYes'), primary: true, onClick: restart }, { label: t('restartNo') }]);
    });
    el('tabs').querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => { rightTab = tab.dataset.tab; renderRightTab(); });
    });
    window.addEventListener('resize', () => renderChart());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.repeat && document.activeElement?.tagName !== 'BUTTON') nextMonth();
    });
  }

  renderAll();
  // Первый запуск: сохранения нет — человек здесь впервые
  if (!saved) showWelcome();
}
