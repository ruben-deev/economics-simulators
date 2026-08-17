// ============================================================================
// Слой интерфейса: состояние партии, отрисовка, обработка ввода.
// Вся экономика живёт в src/model — здесь только показ и управление.
// Весь текст берётся из i18n: t() для строк интерфейса,
// tx() для двуязычных полей модели (активы, вертикали, рычаги, события).
// ============================================================================

import { CONFIG, START_ASSETS, FUTURE_VERTICALS, LEVERS, LEVER_GROUPS, assetById, verticalById, gradesFor } from '../model/config.js';
import {
  DIFFICULTIES, difficultyById, currentDifficulty, setDifficulty, taggedGame,
} from '../../../../shared/difficulty.js';
import { eventById } from '../model/events.js';
import {
  createInitialState, step, explain, valuation, sumOfParts,
  fundingOffer, raise, finalScore, expansionOpen, uniqueUsers, focusPenalty, debrief,
  plusAvailable, plusLaunchCost, cinemaLicenseFee, ticketsPartnerFee, hasPerk,
  startingCash, startingUsers, legacyValuationFloor, legacyReputationMult,
  enterEndless, endlessScore, endlessGrowth,
  financeLevel, financeSaturation, miscRate,
} from '../model/engine.js';
import {
  legacyUnlocks, legacyFor, legacyScores, addResultLine, rememberNovogradResult,
  seriesScorecard, resetEcosystemProgress,
  tripleCrown, NOVOGRAD_WORTHY, LEGACY_GAMES,
  markProtocolChoice, secretEndingUnlocked,
} from '../../../../shared/meta.js';
import { goalProgress } from '../model/board.js';
import { drawLineChart, legendHtml, PALETTE } from '../../../../shared/charts.js';
import { money, moneyExact, num, pct, signedPct, compact, axisNum, amount, amountIn, isCurUnit, cash, curSymbol } from '../../../../shared/format.js';
import { t, tx, getLang, setLang, detectLang, setStrings } from '../../../../shared/i18n.js';
import { watchTables } from '../../../../shared/tables.js';
import { watchSliders } from '../../../../shared/sliders.js';
import { resultString, addRecord, loadRecords, bestRecord } from '../../../../shared/records.js';
import { lbMount, lbEndpoint } from '../../../../shared/leaderboard.js';
import { STRINGS } from '../strings.js';

// Куда ведут ссылки обратного пути: имена папок игр набора
const LEGACY_DIRS = { delivery: 'foodtech', streaming: 'cinema', tickets: 'tickets' };

const SAVE_KEY = 'novograd-save-v1';
const RECORDS_KEY = 'novograd-records';
const GAME_TAG = 'НОВОГРАД';
// Тег партии в строке результата и в мировой таблице. Уровень сложности —
// часть тега: обычный и сложный ранжируются раздельно, потому что это разные
// игры по цене денег. Лёгкий не ранжируется вовсе — бесплатная финансовая
// команда несравнима с купленной, и таблицу это сломало бы.
function gameTag(base = GAME_TAG) {
  return taggedGame(base, state.difficulty);
}
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
let leversSignature = '';         // группы перестраиваются при запусках
let bound = false;                // обработчики уже навешаны

// В подпись входит и уровень сложности: на лёгком финансовой команды в
// панели нет — она уже оплачена, и ползунок там был бы декорацией
const versSignature = () => `${state.taxi.on}|${state.ecom.on}|${state.plus.on}|${state.difficulty}`;

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
      kpi(t('kpiArpu'), `${amount(r.arpuHolding)}`, dA || t('kpiArpuSub'), cA),
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
const openGroups = { food: true, taxi: true, ecom: true, holding: true };

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
  el('levers').innerHTML = LEVER_GROUPS.map((g) => {
    // Цена Plus появляется вместе с подпиской
    const levers = LEVERS.filter((l) => l.group === g.id
      && !(l.key === 'plusPrice' && !state.plus.on)
      && !(l.key === 'finance' && difficultyById(state.difficulty).financeFree));
    const locked = (g.id === 'taxi' && !state.taxi.on)
      || (g.id === 'ecom' && !state.ecom.on);
    const body = locked
      ? `<div class="hint-box" style="margin:6px 0 12px">${t(g.id === 'taxi'
          ? 'leverGroupLockedTaxi' : 'leverGroupLockedEcom')}
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
  leversSignature = versSignature();
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

  const ecomBox = el('readout-ecom');
  if (ecomBox && state.ecom.on && r) {
    ecomBox.innerHTML = `<div class="hint-box" style="margin-bottom:10px">
      <div>${t('readoutEcom', {
        users: compact(state.ecom.users),
        lost: compact(r.lostEcom), gained: compact(r.ecomColdAcq + r.crossEcomConv),
        cls: (r.ecomColdAcq + r.crossEcomConv) >= r.lostEcom ? 'pos' : 'neg',
      })}</div>
      <div>${t('readoutEcomModel', {
        model: t(r.ecomOwnShare >= 0.99 ? 'readoutEcomModelOwn'
          : (r.ecomOwnShare <= 0.01 ? 'readoutEcomModelPlatform' : 'readoutEcomModelMixed')),
        wc: money(r.ecomWorkingCapital ?? 0),
      })}</div>
      <div>${t('readoutEcomCapacity', {
        level: pct(r.ecomCapacity ?? 0, 0),
        cls: (r.ecomCapacity ?? 0) > 0.2 ? 'pos' : 'neg',
      })}</div>
      ${(() => {
        // Почему «маржа не сходится»: вклад с клиентов минус фикс — это
        // устойчивая экономика ноги, а маркетинг и логистика роста платятся
        // сверху. Разделяем явно, иначе растущая нога выглядит убыточной.
        const steady = (r.contribEcom ?? 0) - (r.fixedEcom ?? 0) - (d.ecomOps ?? 0);
        const growth = (d.ecomMarketing ?? 0) + (d.ecomLogistics ?? 0);
        return `<div>${t('readoutEcomUnit', {
          steady: (steady >= 0 ? '+' : '') + money(steady),
          growth: money(growth),
          cls: steady >= 0 ? 'pos' : 'neg',
        })}</div>`;
      })()}
      ${r.logistics ? `<div class="pos">${t('readoutEcomLogistics')}</div>` : ''}
    </div>`;
  }

  const holdBox = el('readout-holding');
  if (holdBox) {
    const penalty = focusPenalty(state, d);
    const anySpoke = state.taxi.on || state.ecom.on;
    const focusLine = anySpoke
      ? t('readoutFocus', {
          penalty: pct(penalty, 0),
          cls: penalty > 0.05 ? 'neg' : 'pos',
        })
      : t('readoutFocusSingle');
    const crossLine = r && anySpoke && (d.crossSell ?? 0) > 0
      ? `<div>${t('readoutCross', {
          conv: compact(r.crossConv + r.crossEcomConv + r.crossBackConv),
          wasted: r.crossWasted > 0 ? t('readoutCrossWasted', { wasted: money(r.crossWasted) }) : '',
        })}</div>`
      : '';
    const plusLine = state.plus.on && r
      ? `<div>${t('readoutPlus', {
          subs: compact(state.plus.subs), multi: compact(r.multiUsers),
        })}</div>` : '';
    // Финансовая команда: сила, цена «прочих расходов» и условия раунда.
    // Показывается всегда — на лёгком уровне как факт, на остальных как
    // отдача от денег, которые вы в неё кладёте.
    const diff = difficultyById(state.difficulty);
    const fin = financeLevel(state, d);
    const half = financeSaturation(state);
    const financeLine = `<div>${t('readoutFinance', {
      level: pct(fin, 0),
      misc: pct(miscRate(state, d), 1),
      round: pct(CONFIG.finance.roundGain * fin, 0),
      cls: fin >= CONFIG.finance.transparencyAt ? 'pos' : 'neg',
    })}</div>${diff.financeFree
      ? `<div class="funding-note">${t('readoutFinanceFree')}</div>`
      : `<div class="funding-note">${t('readoutFinanceHalf', { half: money(half) })}</div>`}`;
    holdBox.innerHTML = `<div class="hint-box" style="margin-bottom:10px">
      <div>${focusLine}</div>
      ${crossLine}
      ${plusLine}
      ${financeLine}
    </div>`;
  }
}

function leverDisplay(l, raw) {
  const unit = tx(l.unit);
  if (unit === '%') return `${raw}%`;
  return isCurUnit(unit) ? money(raw) : `${num(raw)} ${unit}`;
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
  ecom: PALETTE[4],
  eco: PALETTE[0],
};

/**
 * Разбор месяца от финансовой команды. Не подсказки «как выиграть», а то,
 * что видно в цифрах и чего игрок обычно не замечает: канал, который не
 * окупается, бюджет, который сгорает, касса, которая кончится. Появляется
 * только у сильной команды — это и есть смысл в неё вкладываться.
 *
 * Каждое наблюдение считается из последнего отчёта, поэтому советовать
 * несуществующее команда не может.
 */
function financeAdvice() {
  const r = last();
  if (!r) return [];
  const d = state.decisions;
  const asset = assetById(state.assetId);
  const out = [];

  // Холодный клиент дороже, чем приносит за год
  const yearValue = asset.arpu * asset.margin * 12;
  if (r.cacCold > 0 && r.cacCold > yearValue) {
    out.push({ sev: 3, text: t('adviceCac', { cac: money(r.cacCold), value: money(yearValue) }) });
  }
  // Бюджет кросс-селла сгорает: ёмкость канала меньше денег
  if (r.crossWasted > 0 && r.crossWasted > (d.crossSell ?? 0) * 0.15) {
    out.push({ sev: 3, text: t('adviceCrossWaste', { wasted: money(r.crossWasted) }) });
  }
  // Касса: сколько месяцев осталось при текущем сжигании
  const burn = r.oneOff > 0 ? r.profit : r.profit;
  if (burn < 0) {
    const months = Math.floor(state.cash / -burn);
    if (months <= 6) out.push({ sev: 4, text: t('adviceRunway', { months, burn: money(-burn) }) });
  }
  // Размытый фокус: управляющая компания не выкупает штраф
  const penalty = focusPenalty(state, d);
  if (penalty > 0.06) {
    out.push({ sev: 2, text: t('adviceFocus', { penalty: pct(penalty, 0) }) });
  }
  // Дожим за порогом терпения
  if ((d.foodTake ?? 1) > CONFIG.foodTakeThreshold) {
    out.push({ sev: 2, text: t('adviceTake') });
  }
  // Нога, которая покупает рост дороже, чем этот рост стоит
  if (r.ecomOn && (r.ecomFullContribution ?? 0) < 0 && (r.ecomCapacity ?? 0) < 0.2) {
    out.push({ sev: 2, text: t('adviceEcomThin') });
  }
  // Подписка стоит дороже, чем приносит, и не растёт
  if (r.plusOn && (r.plusFullContribution ?? 0) < 0 && r.plusSubs < r.multiUsers * 0.25) {
    out.push({ sev: 1, text: t('advicePlusThin') });
  }
  return out.sort((a, b) => b.sev - a.sev).slice(0, 3);
}

function adviceHtml() {
  const fin = financeLevel(state, state.decisions);
  if (fin < CONFIG.finance.adviceAt) return '';
  const items = financeAdvice();
  if (!items.length) return '';
  return `<div class="hint-box" style="margin-bottom:12px">
    <div><b>${t('adviceTitle')}</b></div>
    ${items.map((i) => `<div>• ${i.text}</div>`).join('')}
  </div>`;
}

function renderBudgetBar() {
  const box = el('budget-slot');
  if (!box) return;
  const d = state.decisions;
  const r = last();
  const taxiOn = state.taxi.on;
  const ecomOn = state.ecom.on;
  const anySpoke = taxiOn || ecomOn;
  const asset = assetById(state.assetId);
  const fixed = (r ? r.fixedFood + r.fixedTaxi + (r.fixedEcom ?? 0) + r.hqCost
    : asset.fixedMonthly + CONFIG.hqMonthly);
  const food = (d.foodOps ?? 0) + (d.foodMarketing ?? 0);
  const taxi = taxiOn ? (d.taxiSupply ?? 0) + (d.taxiMarketing ?? 0) : 0;
  const ecom = ecomOn
    ? (d.ecomOps ?? 0) + (d.ecomMarketing ?? 0) + (d.ecomLogistics ?? 0) : 0;
  const eco = (anySpoke ? (d.crossSell ?? 0) : 0) + (d.mgmt ?? 0)
    + (r ? (r.licenseFee ?? 0) + (r.ticketsFee ?? 0) + (r.plusPerkCost ?? 0) : 0);
  const total = fixed + food + taxi + ecom + eco;
  const contribution = r ? r.contribution : asset.users * asset.arpu * asset.margin;
  const net = contribution - total;

  const seg = (key, v) => (v > 0
    ? `<span style="width:${(100 * v / total).toFixed(1)}%;background:${BUDGET_COLORS[key]}"></span>` : '');
  const leg = (key, label, v) => (v > 0
    ? `<span><i style="background:${BUDGET_COLORS[key]}"></i>${label} ${money(v)}</span>` : '');
  box.innerHTML = `<div class="hint-box" style="margin-bottom:12px">
    <div>${t('budgetTitle', { total: money(total) })}</div>
    <div class="budget-bar">
      ${seg('fixed', fixed)}${seg('food', food)}${seg('taxi', taxi)}${seg('ecom', ecom)}${seg('eco', eco)}
    </div>
    <div class="budget-legend">
      ${leg('fixed', t('budgetFixed'), fixed)}
      ${leg('food', t('budgetFood'), food)}
      ${leg('taxi', t('budgetTaxi'), taxi)}
      ${leg('ecom', t('budgetEcom'), ecom)}
      ${leg('eco', t('budgetEco'), eco)}
    </div>
    <div class="funding-note" style="margin-top:4px">${t('budgetNet', {
      contribution: money(contribution),
      net: (net >= 0 ? '+' : '') + money(net),
      cls: net >= 0 ? 'pos' : 'neg',
    })}</div>
  </div>${adviceHtml()}`;
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
  const ecomDef = verticalById('ecom');
  const foodU = r ? r.foodUsers : asset.users;
  const taxiU = r ? r.taxiUsers : 0;
  const ecomU = r ? r.ecomUsers : 0;
  const bothU = r ? r.bothUsers : 0;
  const bothEcomU = r ? r.bothEcomUsers : 0;
  const unique = r ? r.uniqueUsers : asset.users;
  const taxiOn = state.taxi.on;
  const ecomOn = state.ecom.on;
  const plusOn = state.plus.on;

  // Два расклада одной карты. Широкий: хаб слева, спицы справа. Узкий
  // (телефон): хаб сверху, спицы снизу — карта перестраивается, а не
  // ужимается и не прокручивается: на телефоне она должна читаться целиком.
  const narrow = (box.clientWidth || window.innerWidth) < 600;
  const rFood = 28 + 36 * Math.sqrt(foodU / 260_000);
  const cx1 = narrow ? 180 : 210;
  const cy = narrow ? 158 : 130;
  // Пока спицы не запущены, их пунктирные кружки маленькие — подтягиваем их
  // ближе к хабу, чтобы карта на телефоне не держала пустоту.
  const spokeY = (taxiOn || ecomOn) ? 352 : 296;
  const tx2 = narrow ? 92 : 500; const ty2 = narrow ? spokeY : 78;
  const ex2 = narrow ? 268 : 500; const ey2 = narrow ? spokeY : 192;
  const viewBox = narrow ? `0 0 360 ${(taxiOn || ecomOn) ? 448 : 330}` : '0 0 700 268';
  const rTaxi = taxiOn ? 10 + 36 * Math.sqrt(taxiU / 300_000) : 14;
  const rEcom = ecomOn ? 10 + 34 * Math.sqrt(ecomU / 300_000) : 14;
  const rBoth = taxiOn && bothU > 500 ? 6 + 20 * Math.sqrt(bothU / 150_000) : 0;
  const rBothE = ecomOn && bothEcomU > 500 ? 6 + 20 * Math.sqrt(bothEcomU / 150_000) : 0;
  // Середина ДУГИ, а не отрезка: круг пересечения обязан лежать на связи,
  // иначе он висит рядом с ней и читается третьим сервисом
  const arcMid = (x1, y1, r1, x2, y2, r2) => {
    const dx = x2 - x1; const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ax = x1 + (dx / len) * (r1 + 2); const ay = y1 + (dy / len) * (r1 + 2);
    const bx = x2 - (dx / len) * (r2 + 2); const by = y2 - (dy / len) * (r2 + 2);
    const mx = (ax + bx) / 2 - (dy / len) * (len / 8);
    const my = (ay + by) / 2 + (dx / len) * (len / 8);
    return { x: (ax + 2 * mx + bx) / 4, y: (ay + 2 * my + by) / 4 };
  };
  const midT = arcMid(cx1, cy, rFood, tx2, ty2, taxiOn ? rTaxi : 14);
  const midE = arcMid(cx1, cy, rFood, ex2, ey2, ecomOn ? rEcom : 14);

  // Связь между краями кругов (не между центрами): точки на окружностях.
  // Дуга, а не прямая: прямая между кругами читается стрелкой сборочного
  // чертежа, дуга — связью.
  const link = (x1, y1, r1, x2, y2, r2, on) => {
    const dx = x2 - x1; const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ax = x1 + (dx / len) * (r1 + 2); const ay = y1 + (dy / len) * (r1 + 2);
    const bx = x2 - (dx / len) * (r2 + 2); const by = y2 - (dy / len) * (r2 + 2);
    // Прогиб перпендикулярно связи — шестая часть длины
    const mx = (ax + bx) / 2 - (dy / len) * (len / 8);
    const my = (ay + by) / 2 + (dx / len) * (len / 8);
    return `<path d="M ${ax} ${ay} Q ${mx} ${my} ${bx} ${by}" class="e-link${on ? ' on' : ''}"
      stroke="${on ? PALETTE[3] : 'var(--line)'}"/>`;
  };

  // Пока сервис маленький, подписи в круг не помещаются — выносим их наружу:
  // имя над кругом, число под ним. С ростом круга подписи переезжают внутрь.
  const spoke = (on, cx, cyS, rr, icon, name, users, jump, offLabel) => (on
    ? (rr >= 26
      ? `<g class="node" data-jump="${jump}">
          <circle cx="${cx}" cy="${cyS}" r="${rr}" fill="url(#g-spoke)" stroke="${PALETTE[2]}" stroke-width="1.5"/>
          <text x="${cx}" y="${cyS - 2}" text-anchor="middle">${icon} ${name}</text>
          <text x="${cx}" y="${cyS + 13}" text-anchor="middle" class="m-num">${compact(users)}</text>
        </g>`
      : `<g class="node" data-jump="${jump}">
          <circle cx="${cx}" cy="${cyS}" r="${rr}" fill="url(#g-spoke)" stroke="${PALETTE[2]}" stroke-width="1.5"/>
          <text x="${cx}" y="${cyS - rr - 8}" text-anchor="middle">${icon} ${name}</text>
          <text x="${cx}" y="${cyS + rr + 14}" text-anchor="middle" class="m-num">${compact(users)}</text>
        </g>`)
    : `<g class="node" data-jump="panel:verticals">
        <circle cx="${cx}" cy="${cyS}" r="14" fill="none" stroke="var(--line)" stroke-dasharray="4 3"/>
        <text x="${cx}" y="${cyS - 22}" text-anchor="middle" class="m-muted">${icon} ${offLabel}</text>
      </g>`);
  // Отток пишется под числом сервиса; для маленьких кругов число стоит ниже —
  // сдвигаем и отток, чтобы подписи не легли друг на друга.
  const churnY = (rr) => (rr >= 26 ? rr + 14 : rr + 28);

  const bothNode = (rr, mid, users, label) => (rr > 0
    ? `<g class="node" data-jump="lever:crossSell">
        <circle cx="${mid.x}" cy="${mid.y}" r="${rr}" fill="var(--panel)"/>
        <circle cx="${mid.x}" cy="${mid.y}" r="${rr}" fill="url(#g-both)" stroke="${PALETTE[3]}" stroke-width="1.4"/>
        <text x="${mid.x}" y="${mid.y + 3}" text-anchor="middle" class="m-num" style="font-size:10px">${compact(users)}</text>
        ${label ? `<text x="${mid.x}" y="${mid.y - rr - 6}" text-anchor="middle"
          class="m-muted">${label}</text>` : ''}
      </g>` : '');

  // Потоки месяца: подписи на связях, отток — красным под кругами
  const flowLabel = (x, y, text, color, anchor = 'middle') => (text
    ? `<text x="${x}" y="${y}" text-anchor="${anchor}" class="m-muted" style="fill:${color}">${text}</text>` : '');

  // Холодное привлечение: на широкой карте — справа от круга, на узкой —
  // в столбик под оттоком, чтобы ничего не вылезало за край экрана.
  const coldLabel = (x, y, rr, text) => (narrow
    ? flowLabel(x, y + churnY(rr) + 14, text, PALETTE[5])
    : flowLabel(x + rr + 8, y + 4, text, PALETTE[5], 'start'));

  const plusRing = plusOn
    ? `<circle cx="${cx1}" cy="${cy}" r="${rFood + 10}" fill="none" stroke="${PALETTE[0]}"
        stroke-width="1.6" stroke-dasharray="6 4" opacity="0.8"/>
      <text x="${cx1}" y="${cy - rFood - 16}" text-anchor="middle" class="m-muted" style="fill:${PALETTE[0]}">➕ ${t('mapPlus', { subs: compact(state.plus.subs) })}</text>`
    : '';

  const badges = [];
  if (state.flags?.cofounder) {
    badges.push(`<text x="${narrow ? 12 : 14}" y="${narrow ? 36 : 38}" class="m-muted">🤝 ${t('mapCofounder')}</text>`);
  }
  if (r && r.warMonthsLeft > 0) {
    // У маленького круга имя сервиса стоит над ним — бейдж войны поднимается выше
    badges.push(`<text x="${tx2}" y="${ty2 - rTaxi - (rTaxi >= 26 ? 10 : 24)}" text-anchor="middle" class="m-muted">⚔️ ${tx(taxi.incumbentName)} · ${r.warMonthsLeft}</text>`);
  }
  if (r && r.fedMonthsLeft > 0) {
    badges.push(narrow
      ? `<text x="12" y="38" class="m-muted">🏴 ${t('mapFed', { months: r.fedMonthsLeft })}</text>`
      : `<text x="686" y="24" text-anchor="end" class="m-muted">🏴 ${t('mapFed', { months: r.fedMonthsLeft })}</text>`);
  }
  if (r && r.crisisMonthsLeft > 0) {
    badges.push(narrow
      ? `<text x="12" y="54" class="m-muted">📉 ${t('mapCrisis', { months: r.crisisMonthsLeft })}</text>`
      : `<text x="686" y="40" text-anchor="end" class="m-muted">📉 ${t('mapCrisis', { months: r.crisisMonthsLeft })}</text>`);
  }

  // Волны охвата вокруг хаба: чистое украшение, никакого смысла в них нет,
  // поэтому они и нарисованы едва заметными — фон, а не данные.
  const waves = [22, 46, 72].map((d) => `<circle cx="${cx1}" cy="${cy}" r="${rFood + d}"
    class="e-wave"/>`).join('');

  box.innerHTML = `<div class="panel eco-map holding">
    <h2 class="panel-title">${t('mapTitle')}</h2>
    <svg viewBox="${viewBox}" class="${narrow ? 'map-v' : ''}" role="img" aria-label="${t('mapTitle')}">
      <defs>
        <radialGradient id="g-hub" cx="50%" cy="34%" r="72%">
          <stop offset="0%" stop-color="${PALETTE[1]}" stop-opacity="0.34"/>
          <stop offset="100%" stop-color="${PALETTE[1]}" stop-opacity="0.07"/>
        </radialGradient>
        <radialGradient id="g-spoke" cx="50%" cy="34%" r="72%">
          <stop offset="0%" stop-color="${PALETTE[2]}" stop-opacity="0.30"/>
          <stop offset="100%" stop-color="${PALETTE[2]}" stop-opacity="0.06"/>
        </radialGradient>
        <radialGradient id="g-both" cx="50%" cy="34%" r="72%">
          <stop offset="0%" stop-color="${PALETTE[3]}" stop-opacity="0.34"/>
          <stop offset="100%" stop-color="${PALETTE[3]}" stop-opacity="0.08"/>
        </radialGradient>
      </defs>
      ${waves}
      <text x="${narrow ? 12 : 14}" y="${narrow ? 20 : 22}" class="m-muted">${t('mapCity', { adults: compact(CONFIG.cityAdults) })}</text>
      ${link(cx1, cy, rFood, tx2, ty2, taxiOn ? rTaxi : 14, bothU > 500)}
      ${ecomOn || !taxiOn ? link(cx1, cy, rFood, ex2, ey2, ecomOn ? rEcom : 14, bothEcomU > 500) : ''}
      ${plusRing}
      <g class="node" data-jump="group:food">
        <circle cx="${cx1}" cy="${cy}" r="${rFood}" fill="url(#g-hub)" stroke="${PALETTE[1]}" stroke-width="1.5"/>
        <text x="${cx1}" y="${cy - 2}" text-anchor="middle">${asset.icon} ${t('mapHub')}</text>
        <text x="${cx1}" y="${cy + 14}" text-anchor="middle" class="m-num">${compact(foodU)}</text>
      </g>
      ${spoke(taxiOn, tx2, ty2, rTaxi, taxi.icon, t('mapTaxi'), taxiU, 'group:taxi', t('mapTaxiOff'))}
      ${spoke(ecomOn, ex2, ey2, rEcom, ecomDef.icon, t('mapEcom'), ecomU, 'group:ecom', t('mapEcomOff'))}
      ${bothNode(rBoth, midT, bothU, t('mapBoth'))}
      ${bothNode(rBothE, midE, bothEcomU, '')}
      ${flowLabel(midT.x, midT.y + (rBoth || 8) + 14,
        r && r.crossConv > 0.5 ? `${t('mapCross')} +${compact(r.crossConv)}` : '', PALETTE[0])}
      ${flowLabel(midE.x, midE.y + (rBothE || 8) + 14,
        r && r.crossEcomConv > 0.5 ? `${t('mapCross')} +${compact(r.crossEcomConv)}` : '', PALETTE[0])}
      ${coldLabel(tx2, ty2, rTaxi, r && taxiOn && r.coldAcq > 0.5 ? `+${compact(r.coldAcq)}` : '')}
      ${coldLabel(ex2, ey2, rEcom, r && ecomOn && r.ecomColdAcq > 0.5 ? `+${compact(r.ecomColdAcq)}` : '')}
      ${flowLabel(tx2, ty2 + churnY(rTaxi),
        r && taxiOn && r.lostTaxi > 0.5 ? `−${compact(r.lostTaxi)}` : '', 'var(--bad)')}
      ${flowLabel(ex2, ey2 + churnY(rEcom),
        r && ecomOn && r.lostEcom > 0.5 ? `−${compact(r.lostEcom)}` : '', 'var(--bad)')}
      ${flowLabel(cx1, cy + rFood + (plusOn ? 24 : 14),
        r && r.lostFood > 0.5 ? `−${compact(r.lostFood)}` : '', 'var(--bad)')}
      ${flowLabel(cx1 - rFood - (plusOn ? 22 : 10), cy - 4,
        r && (r.wonBack + r.organicFood) > 0.5 ? `+${compact(r.wonBack + r.organicFood)}` : '', PALETTE[1], 'end')}
      ${badges.join('')}
    </svg>
    <div class="chart-caption">${t('mapUnique', {
      unique: compact(unique), share: pct(unique / CONFIG.cityAdults, 0),
    })}</div>
    <div class="chart-caption">${t('mapCaption')}</div>
  </div>`;
}

// Поворот телефона или изменение окна меняет расклад карты — перерисуем её.
let mapResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(mapResizeTimer);
  mapResizeTimer = setTimeout(() => { if (state && !state.over) renderEcoMap(); }, 150);
});

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
        arpu: amount(r ? r.arpuFood : asset.arpu),
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
        : `<span class="badge wrap">${t('vertLocked', {
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

  // Е-ком: третья нога за воротами по метрикам
  const ecomDef = verticalById('ecom');
  const ecomOn = state.ecom.on;
  const ecomPlanned = chosen.has('ecom') && !ecomOn;
  const ecomGateOpen = expansionOpen(state, ecomDef);
  const ecomCost = ecomDef.launchCost * (asset.launchCostMult?.ecom ?? 1);
  const ecomBadge = ecomOn
    ? `<span class="badge on">${t('vertLive')}</span>`
    : ecomPlanned
      ? `<span class="badge">${t('vertPlanned')}</span>`
      : ecomGateOpen
        ? `<span class="badge">${t('vertLaunch', { cost: money(ecomCost) })}</span>`
        : `<span class="badge wrap">${t('vertLocked', {
            month: ecomDef.gate.minMonth, n: ecomDef.gate.assetContributionMonths,
          })}</span>`;
  const logisticsNote = hasPerk(asset, 'courier-logistics')
    ? `<div class="district-meta pos">${t('vertLogistics', {
        discount: pct(1 - (asset.launchCostMult?.ecom ?? 1), 0) })}</div>` : '';
  const ecomCard = `<div class="district ${ecomOn || ecomPlanned ? 'active' : ''}" data-vertical="ecom">
    <div class="district-head">
      <span class="district-name">${ecomDef.icon} ${tx(ecomDef.name)}</span>
      ${ecomBadge}
    </div>
    <div class="district-meta">${tx(ecomDef.hint)}</div>
    ${ecomOn ? `<div class="district-meta">${t('vertEcomStats', {
      users: compact(state.ecom.users), margin: pct(r?.marginEcom ?? ecomDef.margin, 0),
    })}</div>` : ''}
    ${logisticsNote}
  </div>`;

  // Подписка Plus: склейка, а не вертикаль
  const plusOn = state.plus.on;
  const plusPlanned = chosen.has('plus') && !plusOn;
  const plusOk = plusAvailable(state);
  const plusBadge = plusOn
    ? `<span class="badge on">${t('vertLive')}</span>`
    : plusOk
      ? `<span class="badge">${t('vertLaunch', { cost: money(plusLaunchCost(state)) })}</span>`
      : `<span class="badge wrap">${t('plusNeedsVerticals')}</span>`;
  const plusCard = `<div class="district ${plusOn || plusPlanned ? 'active' : ''}" data-vertical="plus">
    <div class="district-head">
      <span class="district-name">➕ ${t('plusName')}</span>
      ${plusBadge}
    </div>
    <div class="district-meta">${t('plusHint')}</div>
    ${plusOn ? `<div class="district-meta">${t('plusStats', {
      subs: compact(state.plus.subs), price: amount(state.decisions.plusPrice ?? 299),
    })}</div>` : ''}
  </div>`;

  // Партнёрства: кино и билеты входят лицензиями, а не играми
  const partnersChosen = new Set(state.decisions.partners ?? []);
  const ownContent = hasPerk(asset, 'own-content');
  const ownTickets = hasPerk(asset, 'own-tickets');
  const licenseFee = cinemaLicenseFee(state);
  const ticketsFee = ticketsPartnerFee(state);
  const partnerCard = (id, icon, name, hint, own, fee, feeNote, active) => `
    <div class="district ${active ? 'active' : ''}" ${own ? '' : `data-partner="${id}"`}>
      <div class="district-head">
        <span class="district-name">${icon} ${name}</span>
        <span class="badge ${active ? 'on' : ''}">${own ? t('partnerOwn')
          : active ? feeNote : t('partnerJoin', { fee: feeNote })}</span>
      </div>
      <div class="district-meta">${hint}</div>
    </div>`;
  const cinemaActive = plusOn && (partnersChosen.has('cinema') || ownContent);
  const ticketsActive = partnersChosen.has('tickets') || ownTickets;
  const cinemaCard = partnerCard('cinema', '🎬', t('partnerCinema'),
    plusOn ? t('partnerCinemaHint') : t('partnerCinemaNeedsPlus'),
    ownContent, licenseFee,
    licenseFee > 0 ? t('perMonth', { value: money(licenseFee) }) : t('partnerFree'),
    cinemaActive);
  const ticketsCard = partnerCard('tickets', '🎟️', t('partnerTickets'),
    t('partnerTicketsHint'), ownTickets, ticketsFee,
    ticketsFee > 0 ? t('perMonth', { value: money(ticketsFee) }) : t('partnerFree'),
    ticketsActive);

  // Будущие фазы: видны, но заперты — дисциплина скоупа наглядно
  const future = FUTURE_VERTICALS.map((v) => `<div class="district" style="opacity:.55">
    <div class="district-head">
      <span class="district-name">${v.icon} ${tx(v.name)}</span>
      <span class="badge">🔒 ${t('vertFuture')}</span>
    </div>
    <div class="district-meta">${tx(v.hint)}</div>
  </div>`).join('');

  el('verticals').innerHTML = assetCard + taxiCard + ecomCard + plusCard
    + cinemaCard + ticketsCard + future;

  el('verticals').querySelectorAll('[data-vertical]').forEach((node) => {
    node.addEventListener('click', () => {
      const id = node.dataset.vertical;
      const set = new Set(state.decisions.verticals ?? []);
      if (!set.has(id)) {
        if (id === 'ecom' && !state.ecom.on && !ecomGateOpen) {
          toast(t('vertLockedToast', {
            month: ecomDef.gate.minMonth, n: ecomDef.gate.assetContributionMonths,
          }));
        }
        if (id === 'plus' && !state.plus.on && !plusOk) {
          toast(t('plusNeedsVerticalsToast'));
          return;
        }
      }
      if (set.has(id)) set.delete(id); else set.add(id);
      state.decisions.verticals = [...set];
      renderVerticals();
      renderRightTab();
      save();
    });
  });
  el('verticals').querySelectorAll('[data-partner]').forEach((node) => {
    node.addEventListener('click', () => {
      const id = node.dataset.partner;
      if (id === 'cinema' && !state.plus.on) { toast(t('partnerCinemaNeedsPlus')); return; }
      const set = new Set(state.decisions.partners ?? []);
      if (set.has(id)) set.delete(id); else set.add(id);
      state.decisions.partners = [...set];
      renderVerticals();
      renderBudgetBar();
      save();
    });
  });
}

// ----------------------------------------------------------------------------
// Совет директоров: цель года
// ----------------------------------------------------------------------------
function goalText(goal) {
  if (goal.type === 'conglomerate') {
    return t('goalConglomerate', {
      glue: pct(goal.target, 0), growth: pct(goal.growthTarget, 0),
    });
  }
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
    growth: endlessGrowth(state),
  });
  const now = goal.type === 'conglomerate'
    ? t('goalConglomerateNow', { glue: pct(p.value, 1), growth: signedPct(p.growth, 1) })
    : goal.type === 'secondLeg' ? num(p.value, 0)
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
  // В «году конгломерата» раундов нет: акт про то, чтобы держаться сам
  if (state.endless) {
    el('funding').innerHTML = `<div class="hint-box">${t('fundingClosedEndless')}</div>`;
    return;
  }
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
  if (!ev || state.over) {
    // Тихий ход: изредка вместо пустоты — ироничная строка. Каждый раз
    // было бы шумом, поэтому только на ходах с остатком 2 от пяти.
    const turn = state.month;
    el('event-slot').innerHTML = (!state.over && turn > 3 && turn % 5 === 2)
      ? `<div class="funding-note">${t(`quietQuip${(turn % 3) + 1}`)}</div>` : '';
    return;
  }

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
  if (r.legalMonthsLeft > 0) {
    alerts.push(['warn', t('alertLegal', {
      months: r.legalMonthsLeft, cost: money(r.legalCost),
    })]);
  }
  if (r.logisticsSplit && state.ecom.on) alerts.push(['warn', t('alertSplit')]);
  if (r.supervision && r.legalMonthsLeft === 0) alerts.push(['warn', t('alertSupervision')]);
  if (state.taxi.on && r.fill < 0.9 && r.demandTrips > 0) {
    alerts.push(['bad', t('alertNoDrivers', { fill: pct(r.fill, 0) }), 'lever:taxiSupply']);
  } else if (state.taxi.on && r.utilDrivers > 0 && r.utilDrivers < 0.45 && r.drivers > 300) {
    alerts.push(['warn', t('alertIdleDrivers', { util: pct(r.utilDrivers, 0) }), 'lever:taxiSupply']);
  }
  if (r.crossWasted > 0.2 * (r.decisions.crossSell ?? 0) && (r.decisions.crossSell ?? 0) > 0) {
    alerts.push(['warn', t('alertCrossWasted', { wasted: money(r.crossWasted) }), 'lever:crossSell']);
  }
  if (!state.ecom.on && state.month >= 8 && expansionOpen(state, verticalById('ecom'))
      && !(state.decisions.verticals ?? []).includes('ecom')) {
    alerts.push(['good', t('alertEcomGateOpen'), 'panel:verticals']);
  }
  if (!state.plus.on && plusAvailable(state) && r.multiUsers > 30_000
      && !(state.decisions.verticals ?? []).includes('plus')) {
    alerts.push(['good', t('alertPlusReady', { multi: compact(r.multiUsers) }), 'panel:verticals']);
  }
  if (r.plusOn && r.plusSubs < r.multiUsers * 0.1 && r.plusSubs > 0
      && (r.decisions.plusPrice ?? 299) > 299) {
    alerts.push(['warn', t('alertPlusPricey'), 'lever:plusPrice']);
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
      <b>${t('reportStartTitle')}</b> ${t('reportStartIntro', {
        cash: money(CONFIG.startCash), asset: tx(assetById(state.assetId).name),
      })}
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
          food: compact(r.foodUsers), taxi: compact(r.taxiUsers), both: compact(r.multiUsers),
        }))}
      ${stat(t('statArpu'), `${amount(r.arpuHolding)}`, t('statArpuSub'))}
      ${stat(t('statTaxi'), r.taxiOn ? compact(r.taxiUsers) : '—',
        r.taxiOn ? t('statTaxiSub', { drivers: num(r.drivers), fill: pct(r.fill, 0) }) : t('statTaxiOff'))}
      ${stat(t('statEcom'), r.ecomOn ? compact(r.ecomUsers) : '—',
        r.ecomOn ? t('statEcomSub', { margin: pct(r.marginEcom, 0) }) : t('statTaxiOff'))}
      ${stat(t('statPlus'), r.plusOn ? compact(r.plusSubs) : '—',
        r.plusOn ? t('statPlusSub', {
          conv: num(r.plusConv, 0), churned: num(r.plusChurned, 0) }) : t('statTaxiOff'))}
      ${stat(t('statCross'), r.crossConv + r.crossEcomConv + r.crossBackConv > 0
          ? `+${compact(r.crossConv + r.crossEcomConv + r.crossBackConv)}` : '—',
        r.crossConv + r.crossEcomConv + r.crossBackConv > 0
          ? t('statCrossSub', {
              cac: `${amount(r.crossCac)}`,
              cold: r.cacCold > 0 ? `${amount(r.cacCold)}` : '—',
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
  if (r && !(r.tripsAdd > 0) && prev() && prev().tripsAdd > 0) news.push(['warn', t('newsAirportEnd')]);

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
      { label: t('seriesEcom'), data: h.map((r) => r.ecomUsers ?? 0), color: PALETTE[4] },
      { label: t('seriesBoth'), data: h.map((r) => r.multiUsers ?? r.bothUsers), color: PALETTE[3] },
      { label: t('seriesPlus'), data: h.map((r) => r.plusSubs ?? 0), color: PALETTE[5] },
    ],
  },
  money: {
    label: 'chartMoney', caption: 'chartMoneyCaption', zeroLine: true, money: true,
    series: (h) => [
      { label: t('seriesRevenue'), data: h.map((r) => r.revenue), color: PALETTE[1] },
      { label: t('seriesContribution'), data: h.map((r) => r.contribution), color: PALETTE[0] },
      { label: t('seriesProfit'), data: h.map((r) => r.profit), color: PALETTE[3] },
    ],
  },
  cash: {
    label: 'chartCash', caption: 'chartCashCaption', zeroLine: true, money: true,
    series: (h) => [{ label: t('chartCash'), data: h.map((r) => r.cash), color: PALETTE[2] }],
  },
  arpu: {
    label: 'chartArpu', caption: 'chartArpuCaption', money: true,
    series: (h) => [{ label: t('seriesArpu'), data: h.map((r) => r.arpuHolding), color: PALETTE[0] }],
  },
  value: {
    label: 'chartValue', caption: 'chartValueCaption', zeroLine: true, money: true,
    series: (h) => [
      { label: t('seriesValueTotal'), data: h.map((r) => r.valuation ?? 0), color: PALETTE[0] },
      { label: t('seriesValueFood'), data: h.map((r) => r.sopFoodValue ?? 0), color: PALETTE[1] },
      { label: t('seriesValueTaxi'), data: h.map((r) => r.sopTaxiValue ?? 0), color: PALETTE[2] },
      { label: t('seriesValueEcom'), data: h.map((r) => r.sopEcomValue ?? 0), color: PALETTE[4] },
      { label: t('seriesValuePlus'), data: h.map((r) => r.sopPlusValue ?? 0), color: PALETTE[5] },
    ],
  },
  acq: {
    label: 'chartAcq', caption: 'chartAcqCaption',
    format: (v) => `${Math.round(v)}`,
    series: (h) => [
      { label: t('seriesCrossAcq'), data: h.map((r) => r.crossConv + (r.crossEcomConv ?? 0) + r.crossBackConv), color: PALETTE[0] },
      { label: t('seriesColdAcq'), data: h.map((r) => r.coldAcq + (r.ecomColdAcq ?? 0)), color: PALETTE[2] },
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
    if ((cur.partners ?? []).length !== (before.partners ?? []).length) {
      names.push(t('chartChangePartners'));
    }
    // Событие с выбором — такое же решение, как сдвинутый рычаг
    const ev = hist[i].event;
    if (ev) {
      const def = eventById(ev.id);
      if (def && def.options) names.push('⚡ ' + tx(def.title));
    }
    if (names.length) out.push({ index: i, turn: hist[i].month, names });
  }
  return out;
}

// Ходы, в которые в кассу приходили деньги инвесторов (раунд или вливание
// совета): на графике — ромбы по верхней кромке.
function roundTurns() {
  const hist = state.history ?? [];
  const out = [];
  for (let i = 0; i < hist.length; i += 1) {
    const prev = i > 0 ? (hist[i - 1].raisedTotal ?? 0) : 0;
    if ((hist[i].raisedTotal ?? 0) > prev) out.push(i);
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
  // Денежные ряды рисуются в валюте показа: ось и подписи должны совпадать
  // с числами в отчёте, иначе график живёт в другой валюте, чем интерфейс.
  const series = conf.money
    ? conf.series(state.history).map((s) => ({ ...s, data: s.data.map(cash) }))
    : conf.series(state.history);
  const changes = decisionChanges();
  el('chart-legend').innerHTML = legendHtml(series);
  el('chart-caption').innerHTML = t(conf.caption) + changesHtml(changes);
  drawLineChart(el('chart'), series, {
    zeroLine: conf.zeroLine,
    format: conf.format ?? axisNum,
    emptyText: t('pnlEmpty'),
    markers: changes.map((c) => c.index),
    rounds: roundTurns(),
  });
}

// ----------------------------------------------------------------------------
// Правая колонка
// ----------------------------------------------------------------------------
function renderSopTab() {
  const sop = sumOfParts(state);
  // Прозрачность оценки — работа финансовой команды. Без неё видно, СКОЛЬКО
  // стоит каждая часть; с ней — ПОЧЕМУ столько: какой множитель к выручке
  // дал рынок за этот темп роста и эту маржу.
  const fin = financeLevel(state, state.decisions);
  const openMultiple = fin >= CONFIG.finance.transparencyAt;
  const partName = (id) => t({
    food: 'sopPartFood', taxi: 'sopPartTaxi', ecom: 'sopPartEcom', plus: 'sopPartPlus',
  }[id] ?? 'sopPartFood');
  const rows = sop.parts.map((p) => `<tr>
    <td>${partName(p.id)}${p.zoo ? `<div class="funding-note neg">${t('sopZoo')}</div>` : ''}</td>
    <td>${money(p.runRate)}</td>
    <td class="${p.growth >= 0 ? 'pos' : 'neg'}">${signedPct(p.growth, 0)}</td>
    <td class="${p.margin >= 0 ? 'pos' : 'neg'}">${pct(p.margin, 0)}</td>
    ${openMultiple ? `<td>${p.zoo ? '—' : `×${(p.runRate > 0 ? p.value / p.runRate : 0).toFixed(1)}`}</td>` : ''}
    <td class="${p.value >= 0 ? 'pos' : 'neg'}">${money(p.value)}</td>
  </tr>`).join('');

  return `
    <p class="funding-note">${t('sopIntro')}</p>
    <table class="data">
      <thead><tr><th>${t('sopColPart')}</th><th>${t('sopColRunRate')}</th><th>${t('sopColGrowth')}</th><th>${t('sopColMargin')}</th>${openMultiple ? `<th>${t('sopColMultiple')}</th>` : ''}<th>${t('sopColValue')}</th></tr></thead>
      <tbody>
        ${rows}
        <tr class="sub"><td colspan="${openMultiple ? 5 : 4}">${t('sopPremium', { share: pct(sop.multiShare, 1) })}</td>
          <td class="pos">+${pct(sop.crossPremium, 0)}</td></tr>
        <tr class="sub"><td colspan="${openMultiple ? 5 : 4}">${t('sopBonus')}</td>
          <td class="${sop.bonus >= 1 ? 'pos' : 'neg'}">×${sop.bonus.toFixed(2)}</td></tr>
        <tr class="total"><td colspan="${openMultiple ? 5 : 4}">${t('sopTotal')}</td><td>${money(sop.total)}</td></tr>
      </tbody>
    </table>
    ${openMultiple
      ? `<p class="funding-note">${t('sopMultipleNote')}</p>`
      : `<div class="hint-box" style="margin-top:8px">${t('sopMultipleLocked')}</div>`}
    ${sop.thirdAct ? `<div class="alert warn" style="margin-top:8px">${t('sopThirdAct')}</div>` : ''}
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
        ${r.taxiOn ? line(t('pnlRevenueTaxi'), r.revenueTaxi, 'pos', true) : ''}
        ${r.ecomOn ? line(t('pnlRevenueEcom'), r.revenueEcom, 'pos', true) : ''}
        ${r.plusOn ? line(t('pnlRevenuePlus'), r.revenuePlus, 'pos', true) : ''}
        ${r.revenueTickets > 0 ? line(t('pnlRevenueTickets'), r.revenueTickets, 'pos', true) : ''}
        <tr class="total"><td>${t('pnlRevenue')}</td><td class="pos">${moneyExact(r.revenue)}</td></tr>
        ${line(t('pnlContribFood'), r.contribFood, 'pos', true)}
        ${r.taxiOn ? line(t('pnlContribTaxi'), r.contribTaxi, r.contribTaxi >= 0 ? 'pos' : 'neg', true) : ''}
        ${r.ecomOn ? line(t('pnlContribEcom'), r.contribEcom, r.contribEcom >= 0 ? 'pos' : 'neg', true) : ''}
        ${r.plusOn ? line(t('pnlPlusNet'), r.revenuePlus - r.plusPerkCost,
          (r.revenuePlus - r.plusPerkCost) >= 0 ? 'pos' : 'neg', true) : ''}
        <tr class="total"><td>${t('pnlContribution')}</td><td class="${r.contribution >= 0 ? 'pos' : 'neg'}">${moneyExact(r.contribution)}</td></tr>
        ${line(t('pnlFixedFood'), -r.fixedFood, 'neg', true)}
        ${r.taxiOn ? line(t('pnlFixedTaxi'), -r.fixedTaxi, 'neg', true) : ''}
        ${r.ecomOn ? line(t('pnlFixedEcom'), -r.fixedEcom, 'neg', true) : ''}
        ${line(t('pnlHq'), -r.hqCost, 'neg', true)}
        ${r.legalCost ? line(t('pnlLegal'), -r.legalCost, 'neg', true) : ''}
        ${line(t('pnlMgmt'), -(d.mgmt ?? 0), 'neg', true)}
        ${(r.taxiOn || r.ecomOn) ? line(t('pnlCrossSell'), -(d.crossSell ?? 0), 'neg', true) : ''}
        ${line(t('pnlFoodOps'), -(d.foodOps ?? 0), 'neg', true)}
        ${line(t('pnlFoodMarketing'), -(d.foodMarketing ?? 0), 'neg', true)}
        ${r.taxiOn ? line(t('pnlTaxiSupply'), -(d.taxiSupply ?? 0), 'neg', true) : ''}
        ${r.taxiOn ? line(t('pnlTaxiMarketing'), -(d.taxiMarketing ?? 0), 'neg', true) : ''}
        ${r.ecomOn ? line(t('pnlEcomOps'), -(d.ecomOps ?? 0), 'neg', true) : ''}
        ${r.ecomOn ? line(t('pnlEcomLogistics'), -(d.ecomLogistics ?? 0), 'neg', true) : ''}
        ${r.ecomOn ? line(t('pnlEcomMarketing'), -(d.ecomMarketing ?? 0), 'neg', true) : ''}
        ${r.licenseFee > 0 ? line(t('pnlLicense'), -r.licenseFee, 'neg', true) : ''}
        ${r.ticketsFee > 0 ? line(t('pnlTicketsFee'), -r.ticketsFee, 'neg', true) : ''}
        ${r.financeCost > 0 ? line(t('pnlFinance'), -r.financeCost, 'neg', true) : ''}
        ${line(t('pnlMisc', { rate: pct(r.miscRate ?? 0, 1) }), -(r.miscCost ?? 0), 'neg', true)}
        <tr class="total"><td>${t('pnlOperatingProfit')}</td><td class="${r.profit >= 0 ? 'pos' : 'neg'}">${moneyExact(r.profit)}</td></tr>
        ${r.ecomWorkingCapital > 0 ? line(t('pnlWorkingCapital'), -r.ecomWorkingCapital, 'neg', true) : ''}
        ${r.oneOff - (r.ecomWorkingCapital ?? 0) > 0
          ? line(t('pnlOneOff'), -(r.oneOff - (r.ecomWorkingCapital ?? 0)), 'neg', true) : ''}
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
  const ecomU = r ? r.ecomUsers : 0;
  const multiU = r ? r.multiUsers : 0;
  const subs = r ? r.plusSubs : 0;
  const unique = r ? r.uniqueUsers : asset.users;
  const pool = r ? r.returnPool : asset.returnPool;

  const segments = `
    <table class="data">
      <thead><tr><th>${t('baseColWho')}</th><th>${t('baseColCount')}</th></tr></thead>
      <tbody>
        <tr><td>${t('baseFood')}</td><td>${compact(foodU)}</td></tr>
        <tr><td>${t('baseTaxi')}</td><td>${compact(taxiU)}</td></tr>
        <tr><td>${t('baseEcom')}</td><td>${state.ecom.on ? compact(ecomU) : '—'}</td></tr>
        <tr><td>${t('baseBoth')}</td><td>${compact(multiU)}</td></tr>
        <tr><td>${t('basePlus')}</td><td>${state.plus.on ? compact(subs) : '—'}</td></tr>
        <tr class="total"><td>${t('baseUnique')}</td><td>${compact(unique)}</td></tr>
        <tr class="sub"><td>${t('baseMultiShare')}</td><td>${pct(unique > 0 ? multiU / unique : 0, 1)}</td></tr>
        <tr class="sub"><td>${t('baseReturnPool')}</td><td>${compact(pool)}</td></tr>
      </tbody>
    </table>`;

  let channels = '';
  if (r && (state.taxi.on || state.ecom.on)) {
    channels = `
      <h4 style="margin:14px 0 6px;font-size:13px">${t('baseAcqTitle')}</h4>
      <table class="data">
        <thead><tr><th>${t('baseColChannel')}</th><th>${t('baseColPeople')}</th><th>${t('baseColCac')}</th></tr></thead>
        <tbody>
          <tr><td>${t('baseChCross')}</td><td>${num(r.crossConv, 0)}</td><td rowspan="3">${r.crossCac > 0 ? `${amount(r.crossCac)}` : '—'}</td></tr>
          <tr><td>${t('baseChCrossEcom')}</td><td>${num(r.crossEcomConv, 0)}</td></tr>
          <tr><td>${t('baseChCrossBack')}</td><td>${num(r.crossBackConv, 0)}</td></tr>
          <tr><td>${t('baseChCold')}</td><td>${num(r.coldAcq, 0)}</td><td>${r.cacCold > 0 ? `${amount(r.cacCold)}` : '—'}</td></tr>
          <tr><td>${t('baseChColdEcom')}</td><td>${num(r.ecomColdAcq, 0)}</td><td>${r.cacColdEcom > 0 ? `${amount(r.cacColdEcom)}` : '—'}</td></tr>
          <tr><td>${t('baseChWinback')}</td><td>${num(r.wonBack, 0)}</td><td>${r.wonBack > 0 ? `${amount((r.decisions.foodMarketing ?? 0) / r.wonBack)}` : '—'}</td></tr>
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

    <h4>${t('helpPlusTitle')}</h4>
    <p>${t('helpPlusText')}</p>

    <h4>${t('helpMetaTitle')}</h4>
    <p>${t('helpMetaText')}</p>

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
      // Титул «Конгломерат Новограда» остаётся в локальных рекордах
      outcome: s.bankrupt ? 'bankrupt'
        : s.sold ? 'sold'
        : (s.equityValue >= gradesFor(state.assetId, state.difficulty).worthy && tripleCrown()
          ? 'conglomerate' : 'finished'),
      version: APP_VERSION,
      turns: s.months,
    });
    save();
  }
  const top = loadRecords(RECORDS_KEY);
  if (!top.length) return '';
  const rows = top.map((rec, i) => `<tr${rec.id === state.recordId ? ' class="total"' : ''}>
    <td>${i + 1}</td><td>${rec.date}</td><td>${rec.seed}</td><td>${money(rec.score)}</td>
    <td>${t(rec.outcome === 'bankrupt' ? 'recordsOutcomeBankrupt'
      : rec.outcome === 'sold' ? 'recordsOutcomeSold'
      : rec.outcome === 'conglomerate' ? 'recordsOutcomeConglomerate'
      : 'recordsOutcomeFinished')}${rec.id === state.recordId ? ` ${t('recordsYou')}` : ''}</td></tr>`).join('');
  return `<h3 style="margin:12px 0 6px">${t('recordsTitle')}</h3>
    <div style="overflow-x:auto"><table class="data">
    <thead><tr><th>#</th><th>${t('recordsDate')}</th><th>${t('recordsCode')}</th><th>${t('recordsScore')}</th><th>${t('recordsOutcome')}</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

// Финал «года конгломерата»: зачётный счёт не переписывается, показываем
// итог самого акта — выросли ли вы без чужих денег и удержали ли склейку.
function showEndlessOver() {
  const e = endlessScore(state);
  const line = resultString({
    tag: gameTag(`${GAME_TAG}+`), version: APP_VERSION, seed: state.seed,
    score: Math.round(e.equityValue), turns: e.months,
  });
  modal(`<h2>🏙️ ${t('endlessOverTitle')}</h2>
    <p class="funding-note">${t(e.goalDone ? 'endlessWon' : 'endlessLost')}</p>
    <div class="score-grid">
      <div class="stat"><div class="s-label">${t('endlessRanked')}</div><div class="s-value">${money(e.rankedValue)}</div></div>
      <div class="stat"><div class="s-label">${t('endlessNow')}</div><div class="s-value">${money(e.equityValue)}</div></div>
      <div class="stat"><div class="s-label">${t('endlessGrowth')}</div><div class="s-value">${signedPct(e.growth, 1)}</div></div>
      <div class="stat"><div class="s-label">${t('endlessGlue')}</div><div class="s-value">${pct(e.multiShare, 1)}</div></div>
    </div>
    <p class="funding-note">${t('endlessScaleNote', {
      glue: pct(CONFIG.endless.multiShareTarget, 0),
      growth: pct(CONFIG.endless.growthTarget, 0),
    })}</p>
    <h3 style="margin:12px 0 6px">${t('resultTitle')}</h3>
    <p class="funding-note">${t('endlessResultNote')}</p>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <code style="user-select:all;overflow-wrap:anywhere">${line}</code>
      <button class="btn small" id="copy-result" type="button">${t('resultCopy')}</button>
      <button class="btn small" id="csv-export" type="button">${t('csvButton')}</button>
    </div>`,
  [{ label: t('gameOverPlayAgain'), primary: true, onClick: () => restart() },
   { label: t('gameOverCharts'), onClick: () => {} }]);
  el('modal-root').querySelector('#copy-result')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(line).then(() => toast(t('resultCopied'))).catch(() => {});
  });
  el('modal-root').querySelector('#csv-export')?.addEventListener('click', exportCsv);
}

function showGameOver() {
  if (state.over === 'endless-done') { showEndlessOver(); return; }
  // Зачётный счёт зафиксирован движком в момент финиша: пост-эндгейм
  // (следующие фазы) сможет продолжать партию, не трогая результат
  const s = state.scored ?? finalScore(state);
  const r = last();
  // Шкала вердиктов своя у каждого стартового актива: замеренные оптимумы
  // расходятся втрое, и общая шкала объявляла бы отличную партию за билеты
  // «скромным итогом». Пороги лежат в дескрипторе актива.
  const gr = gradesFor(state.assetId, state.difficulty);
  // Ярус вердикта отдельно от текста: по нему же выбирается ироничная
  // подпись gradeQuip*
  const gradeTier = s.bankrupt ? 'Bankrupt'
    : s.sold ? 'Sold'
    : s.equityValue > gr.excellent ? 'Excellent'
    : s.equityValue > gr.solid ? 'Solid'
    : s.equityValue > gr.survived ? 'Survived' : 'Modest';
  const grade = t(`grade${gradeTier}`);

  // Мета-прогрессия: лучший финал НОВОГРАДА открывает неэкономические
  // бонусы в старых играх (бейдж и коды партий на их финальных экранах)
  if (!s.bankrupt) rememberNovogradResult(s.equityValue, gr.worthy);
  // Секретная концовка: финалы всех трёх игр + достойный НОВОГРАД.
  // Строго косметика — никакого множителя к счёту.
  const crown = !s.bankrupt && s.equityValue >= gr.worthy && tripleCrown();
  const crownHtml = crown ? `
    <div class="lesson" style="margin-top:10px"><b>👑 ${t('crownTitle')}</b><br>
    ${t('crownText')}</div>` : '';

  // Протокол «СКРЕПКА»: все четыре игры выиграны и во всех четырёх хоть раз
  // доверились нейросети. Чистая косметика — эпилог, а не множитель.
  const secretHtml = !s.bankrupt && secretEndingUnlocked() ? `
    <div class="lesson" style="margin-top:10px"><b>📎 ${t('secretTitle')}</b><br>
    ${t('secretText')}<br>
    <span style="display:block;margin-top:8px;font-size:11px;letter-spacing:.04em;opacity:.75">${t('secretDisclaimer')}</span></div>` : '';

  // Обратный путь: если до короны не хватает игр, называем их и даём ссылку.
  // Раньше приглашение работало только в одну сторону — из старых игр сюда.
  let backHtml = '';
  if (!crown && !s.bankrupt) {
    const sc = seriesScorecard();
    const missing = sc.missing.filter((tag) => tag !== 'НОВОГРАД');
    if (missing.length) {
      const links = LEGACY_GAMES
        .filter((g) => missing.includes(g.tag))
        .map((g) => (window.__homeUrl
          ? `<a class="jump" href="../${LEGACY_DIRS[g.assetId]}/index.html">${g.tag}</a>`
          : g.tag))
        .join(' · ');
      backHtml = `<div class="hint-box" style="margin-top:10px">
        <b>${t('backTitle')}</b> ${t('backText', { games: links })}</div>`;
    }
  }

  const line = resultString({
    tag: gameTag(), version: APP_VERSION, seed: state.seed,
    score: s.bankrupt ? 0 : s.equityValue, turns: s.months,
  });
  const diffNow = difficultyById(state.difficulty);
  modal(`
    <h2>${s.bankrupt ? t('gameOverBankrupt') : s.sold ? t('gameOverSold') : t('gameOverFinished')}</h2>
    <p class="funding-note">${s.bankrupt
      ? t('gameOverBankruptText', { month: s.months })
      : s.sold ? t('gameOverSoldText', { month: s.months, value: money(s.equityValue) })
      : t('gameOverFinishedText')}</p>
    <p class="funding-note">${t('gameOverDifficulty', {
      level: tx(diffNow.label),
      note: t('gameOverOwnTable'),
    })}</p>
    <div class="score-grid">
      <div class="stat"><div class="s-label">${t('scoreValuation')}</div><div class="s-value">${money(s.valuation)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreStake')}</div><div class="s-value">${pct(s.equity, 1)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreResult')}</div><div class="s-value">${money(s.equityValue)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreRaised')}</div><div class="s-value">${money(s.raised)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreCash')}</div><div class="s-value">${money(s.cash)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreGrade')}</div><div class="s-value">${grade}</div></div>
    </div>
    <p class="funding-note">${t('gradeScale', {
      a: money(gr.excellent), b: money(gr.solid), c: money(gr.survived),
      asset: tx(assetById(state.assetId).short),
    })}</p>
    <p class="funding-note quip">${t(`gradeQuip${gradeTier}`)}</p>
    ${secretHtml}
    ${crownHtml}
    ${backHtml}
    ${lbEndpoint() ? '<div id="lb-root"></div>' : ''}
    ${r ? `<p class="funding-note">${t('gameOverLastMonth', {
      revenue: money(r.revenue), arpu: amount(r.arpuHolding),
      unique: compact(r.uniqueUsers), multi: compact(r.bothUsers),
    })}</p>` : ''}
    ${(s.bankrupt || s.sold) ? waterfallHtml(state.history.slice(-4)) : ''}
    ${gameTotalsHtml(s)}
    ${debriefHtml()}
    <h3 style="margin:12px 0 6px">${t('resultTitle')}</h3>
    <p class="funding-note">${t('resultNote')}</p>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <code style="user-select:all;overflow-wrap:anywhere">${line}</code>
      <button class="btn small" id="copy-result" type="button">${t('resultCopy')}</button>
      <button class="btn small" id="csv-export" type="button">${t('csvButton')}</button>
    </div>
    ${recordsBlockHtml(s)}
    <div class="hint-box" style="margin-top:10px">${t('gameOverQuestions')}</div>
  `, [
    // Пост-эндгейм: партия зачтена, счёт заморожен — дальше играют за
    // зрелость холдинга. Предлагаем только выжившим: продолжать банкротство
    // нечем.
    ...(s.bankrupt ? [] : [{ label: t('endlessStart'), onClick: () => {
      state = enterEndless(state);
      save();
      renderAll();
      modal(`<h2>🏙️ ${t('endlessTitle')}</h2>
        <p class="funding-note">${t('endlessIntro', {
          months: CONFIG.endless.months,
          glue: pct(CONFIG.endless.multiShareTarget, 0),
          growth: pct(CONFIG.endless.growthTarget, 0),
        })}</p>
        <p class="funding-note">${t('endlessRule')}</p>`,
        [{ label: t('helpModalOk'), primary: true, onClick: () => {} }]);
    } }]),
    { label: t('gameOverPlayAgain'), primary: true, onClick: () => restart() },
    { label: t('gameOverCharts'), onClick: () => {} },
  ]);
  // Мировая таблица: живёт только там, где страница знает адрес сервера.
  lbMount({
    seed: state.seed,
    root: el('modal-root').querySelector('#lb-root'),
    t,
    money,
    game: gameTag(),
    line,
    myScore: s.bankrupt ? 0 : s.equityValue,
    submitted: Boolean(state.lbSent),
    onSubmitted: () => { state.lbSent = true; save(); },
  });
  el('modal-root').querySelector('#copy-result')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(line).then(() => toast(t('resultCopied'))).catch(() => {});
  });
  el('modal-root').querySelector('#csv-export')?.addEventListener('click', exportCsv);
}

// Приветственный экран: куда человек попал, выбор стартового актива
// («класс персонажа») и наследие из трёх игр набора.
function showWelcome() {
  let seedWanted = '';
  let assetWanted = state.assetId;
  let diffWanted = state.difficulty ?? currentDifficulty();
  const best = bestRecord(RECORDS_KEY);
  const unlocks = legacyUnlocks();

  const assetCards = START_ASSETS.map((a) => `
    <button type="button" class="event-option ${a.id === assetWanted ? 'selected' : ''}" data-asset="${a.id}">
      <b>${a.icon} ${tx(a.name)}${unlocks[a.id] ? ' ★' : ''}</b>
      <span>${t('vertAssetStats', {
        users: compact(a.users), arpu: amount(a.arpu), margin: pct(a.margin, 0),
      })} · ${tx(a.synergyNote)}</span>
    </button>`).join('');

  const diffCards = () => DIFFICULTIES.map((dd) => `
    <button type="button" class="event-option ${dd.id === diffWanted ? 'selected' : ''}" data-diff="${dd.id}">
      <b>${tx(dd.label)}</b>
      <span>${tx(dd.note)}</span>
    </button>`).join('');

  const legacyLine = LEGACY_GAMES.map((g) => {
    const a = assetById(g.assetId);
    return `${unlocks[g.assetId] ? '★' : '☆'} ${tx(a.fromGame)}`;
  }).join(' · ');

  // Что переносится числами: клиенты, касса и репутация у инвесторов.
  // Показываем до старта, чтобы перенос был виден, а не угадывался по
  // цифре в шапке.
  const carry = legacyFor(assetWanted, unlocks, legacyScores());
  const carryAsset = assetById(assetWanted);
  const carryCash = startingCash(carryAsset, carry);
  const baseCash = carryAsset.startCash ?? CONFIG.startCash;
  const carryUsers = startingUsers(carryAsset, carry);
  const carryHtml = carry.assetScore > 0
    ? `<div class="hint-box" style="margin-top:6px"><b>${t('welcomeCarryTitle')}</b>
        ${t('welcomeCarry', {
          game: tx(carryAsset.fromGame),
          score: money(carry.assetScore),
          ratio: `${carry.assetRatio.toFixed(2)}×`,
          users: compact(carryUsers.users),
          usersBonus: carryUsers.users > carryAsset.users
            ? `+${compact(carryUsers.users - carryAsset.users)}` : t('welcomeCarryNone'),
          cash: money(carryCash),
          bonus: carryCash > baseCash ? `+${money(carryCash - baseCash)}` : t('welcomeCarryNone'),
          floor: money(legacyValuationFloor(carry)),
          round: pct(legacyReputationMult(carry) - 1, 0),
        })}
        <div class="funding-note" style="margin-top:4px">${t('welcomeCarryUnit')}</div></div>`
    : `<div class="hint-box" style="margin-top:6px">${t('welcomeCarryEmpty')}</div>`;

  modal(`<h2>${t('welcomeTitle')}</h2>
    <p class="funding-note">${t('welcomeRole')}</p>
    <p class="funding-note">${t('welcomeTurn')}</p>
    <p class="funding-note">${t('welcomeTension')}</p>
    <p class="funding-note">${t('welcomeGoal')}</p>
    <p class="funding-note">${t('welcomeHint')}</p>
    <h3 style="margin:10px 0 4px;font-size:14px">${t('welcomeAsset')}</h3>
    <p class="funding-note">${t('welcomeAssetChoice')}</p>
    <div class="event-options">${assetCards}</div>
    <h3 style="margin:10px 0 4px;font-size:14px">${t('welcomeDifficulty')}</h3>
    <p class="funding-note">${t('welcomeDifficultyNote')}</p>
    <div class="event-options" id="diff-options">${diffCards()}</div>
    <div class="hint-box" style="margin-top:8px">
      <b>${t('welcomeLegacy')}:</b> ${legacyLine}<br>
      ${t('welcomeLegacyNote')}
      <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
        <input id="legacy-line" type="text" placeholder="${t('welcomeLegacyPlaceholder')}"
          style="flex:1;min-width:200px;padding:6px 8px;background:transparent;border:1px solid var(--line);border-radius:6px;color:inherit;font:inherit">
        <button class="btn small" id="legacy-add" type="button">${t('welcomeLegacyAdd')}</button>
        <button class="btn small" id="legacy-reset" type="button">${t('welcomeLegacyReset')}</button>
      </div>
    </div>
    ${carryHtml}
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
      const seed = v || `novograd-${Math.floor(Math.random() * 1e6)}`;
      // Партия пересоздаётся, если поменяли сид или актив — или если это
      // свежая партия (ход ещё не сделан): наследие должно примениться
      if (v !== state.seed || assetWanted !== state.assetId
        || diffWanted !== state.difficulty || state.month === 0) {
        state = createInitialState(v ? seed : (state.month === 0 && assetWanted === state.assetId ? state.seed : seed),
          assetWanted, legacyFor(assetWanted, legacyUnlocks(), legacyScores()), diffWanted);
        save();
        renderAll();
      }
    } },
   { label: t('welcomeMore'), onClick: showHelp },
   // Переключатель языка в шапке накрыт модалкой, а именно здесь язык и важен
   { label: getLang() === 'ru' ? 'English' : 'Русский',
     onClick: () => { switchLang(); showWelcome(); } }]);
  el('modal-root').querySelector('#seed-input')
    ?.addEventListener('input', (e) => { seedWanted = e.target.value; });
  el('modal-root').querySelectorAll('[data-asset]').forEach((b) => {
    b.addEventListener('click', () => {
      assetWanted = b.dataset.asset;
      el('modal-root').querySelectorAll('[data-asset]').forEach((x) => {
        x.classList.toggle('selected', x.dataset.asset === assetWanted);
      });
    });
  });
  el('modal-root').querySelectorAll('[data-diff]').forEach((b) => {
    b.addEventListener('click', () => {
      // Сложность — настройка набора: выбор здесь меняет её во всех играх
      diffWanted = setDifficulty(b.dataset.diff);
      el('modal-root').querySelectorAll('[data-diff]').forEach((x) => {
        x.classList.toggle('selected', x.dataset.diff === diffWanted);
      });
    });
  });
  el('modal-root').querySelector('#legacy-add')?.addEventListener('click', () => {
    const input = el('modal-root').querySelector('#legacy-line');
    const res = addResultLine(input?.value ?? '');
    if (res.ok) {
      toast(t('welcomeLegacyAdded', { tag: res.parsed.tag }));
      showWelcome();
    } else {
      toast(t('welcomeLegacyBad'));
    }
  });
  // Сброс пути набора: забываются строки наследия, лучший финал и эта партия.
  // Таблицы рекордов игр не трогаются — они заработаны и остаются.
  el('modal-root').querySelector('#legacy-reset')?.addEventListener('click', () => {
    if (!window.confirm(t('welcomeLegacyResetAsk'))) return;
    resetEcosystemProgress();
    state = createInitialState(state.seed, assetWanted, legacyFor(assetWanted, legacyUnlocks(), legacyScores()), diffWanted);
    save();
    renderAll();
    showWelcome();
    toast(t('welcomeLegacyResetDone'));
  });
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
  // Протокол «СКРЕПКА»: доверие нейросети отмечается на устройстве.
  // Экономика секретной опции — копия обычной, влияет только на сюжет.
  const chosenOpt = ev && ev.options ? ev.options[state.pendingChoice ?? 0] : null;
  if (chosenOpt && chosenOpt.secret) {
    markProtocolChoice('ecosystem');
    toast(tx({
      ru: '📎 СКРЕПКА благодарит за доверие.',
      en: '📎 PAPERCLIP thanks you for your trust.',
    }));
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
    seed: state.seed,
    root: el('modal-root').querySelector('#lb-root'),
    t, money, game: gameTag(), viewOnly: true,
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
  el('btn-restart').title = t('btnRestartTitle');
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
  if (!leversBuilt || leversSignature !== versSignature()) buildLevers();
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
    watchSliders();
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


// Персональный разбор: правила из модели (engine.debrief) с замеренной
// ценой каждого промаха. Пустой список — тоже результат: сильная партия.
function debriefHtml() {
  const found = debrief(state);
  const key = (id) => 'debrief' + id[0].toUpperCase() + id.slice(1);
  const items = found.length
    ? `<ul style="margin:6px 0 0 18px;padding:0">${found
      .map((f) => `<li style="margin-bottom:6px">${t(key(f.id), fmtDebrief(f))}</li>`).join('')}</ul>`
    : `<p class="funding-note" style="margin-top:4px">${t('debriefClean')}</p>`;
  return `<h3 style="margin:12px 0 6px">${t('debriefTitle')}</h3>
    <p class="funding-note">${t('debriefNote')}</p>${items}`;
}

function fmtDebrief(f) { return f; }

// Вся партия одной строкой цифр: выручка, расходы, операционный итог,
// привлечённые деньги, касса — разбор нужен не только банкроту.
function gameTotalsHtml(s) {
  const hist = state.history ?? [];
  if (!hist.length) return '';
  const sum = (fn) => hist.reduce((acc, r) => acc + (fn(r) ?? 0), 0);
  const revenue = sum((r) => r.revenue);
  const costs = sum((r) => r.revenue - r.profit + (r.oneOff ?? 0));
  const profit = sum((r) => r.profit - (r.oneOff ?? 0));
  const rows = [
    [t('wfRevenue'), revenue], [t('wfCosts'), costs], [t('wfProfit'), profit],
    [t('scoreRaised'), s.raised], [t('scoreCash'), s.cash],
  ];
  return `<h3 style="margin:12px 0 6px">${t('totalsTitle')}</h3>
    <div style="overflow-x:auto"><table class="data"><tbody>
    ${rows.map(([k, v]) => `<tr><td>${k}</td><td>${money(v)}</td></tr>`).join('')}
    </tbody></table></div>`;
}

// Экспорт истории партии: те же ряды, что на графиках, — по колонке на серию.
function exportCsv() {
  const hist = state.history ?? [];
  if (!hist.length) return;
  const cols = [];
  const seen = new Set();
  for (const conf of Object.values(CHART_TABS)) {
    for (const sr of conf.series(hist)) {
      if (!sr.data || seen.has(sr.label)) continue;
      seen.add(sr.label);
      cols.push(sr);
    }
  }
  const esc = (x) => `"${String(x).replace(/"/g, '""')}"`;
  const head = [t('csvTurn'), ...cols.map((c) => c.label)].map(esc).join(';');
  const rows = hist.map((r, i) => [r.month,
    ...cols.map((c) => (Number.isFinite(c.data[i]) ? Math.round(c.data[i] * 100) / 100 : ''))]
    .map(esc).join(';'));
  const blob = new Blob(['\ufeff' + [head, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `novograd-${state.seed}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
