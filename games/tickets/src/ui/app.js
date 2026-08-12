// ============================================================================
// Интерфейс билетного сервиса.
//
// Порядок на экране повторяет порядок мысли: сначала итоги месяца — что
// вышло, потом срочные решения, потом каналы и стороны рынка, и только
// затем графики. Рычаги живут слева и трогаются редко; на телефоне они
// уезжают под итоги (см. shared/styles.css).
//
// Ключевые панели этой игры — «Каналы продаж» и «Организаторы»: именно там
// принимаются решения, из-за которых партия выигрывается или проигрывается.
// ============================================================================

import {
  CONFIG, ORGANIZERS, AUDIENCES, LEVERS, LEVER_GROUPS, ALGORITHMS,
  organizerById, audienceById, algorithmByKey, clamp,
} from '../model/config.js';
import {
  createInitialState, step, unitEconomics, valuation, fundingOffer, raise,
  explain, explainFactors, finalScore, algoQuality, dataLevel, rndLevel,
  orgTotal, totalReach, platformLevel, productLevel,
} from '../model/engine.js';
import { seasonOf, hitById } from '../model/market.js';
import { channelSplit } from '../model/channel.js';
import { rivalOrgTotal, rivalPlatformLevel, STANCES } from '../model/rival.js';
import { goalProgress } from '../model/board.js';
import { crisisById, resolutionCost } from '../model/crises.js';
import { eventById } from '../model/events.js';
import { t, tx, getLang, setLang, detectLang, setStrings } from '../../../../shared/i18n.js';
import { money, moneyExact, num, pct, signedPct, compact, axisNum } from '../../../../shared/format.js';
import { drawLineChart, legendHtml, PALETTE } from '../../../../shared/charts.js';
import { STRINGS } from '../strings.js';

const SAVE_KEY = 'bileton-save-v1';
// Метка сборки: меняется вместе с полями модели. Сохранение с чужой меткой
// не читается — см. load().
const BUILD = 'tickets-1';
// Версию проставляет сборщик. У модульной версии метки нет — значит это
// исходники, а не раздаваемый файл.
const APP_VERSION = document.querySelector('meta[name="app-version"]')?.content ?? 'dev';

const el = (id) => document.getElementById(id);

let state = null;
let chartTab = 'market';
let rightTab = 'unit';
let leversBuilt = false;
let bound = false;
let openGroups = { take: true, growth: true, infra: false };
let pendingExclusive = null;   // 'accept' | 'decline'
let pendingCrisisChoice = null;

const clearActions = () => {
  pendingExclusive = null;
  pendingCrisisChoice = null;
};

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
    // Сохранение от другой сборки не читаем: поля модели меняются между
    // версиями, и старое состояние роняет отрисовку — на экране пусто,
    // а причина невидима.
    if (!saved || saved.build !== BUILD) return null;
    const s = saved.state;
    return s && s.orgs && Array.isArray(s.history) ? s : null;
  } catch { return null; }
}
function dropSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* приватный режим */ }
}

const last = () => state.history[state.history.length - 1] ?? null;
const prev = () => state.history[state.history.length - 2] ?? null;
const orgName = (id) => tx(organizerById(id)?.name ?? '');
const orgShort = (id) => tx(organizerById(id)?.short ?? '');
const audName = (id) => tx(audienceById(id)?.name ?? '');
const seasonName = (season) => t(`season${season.charAt(0).toUpperCase()}${season.slice(1)}`);
const stanceName = (id) => tx(STANCES[id]?.name ?? '');
const stanceHint = (id) => tx(STANCES[id]?.hint ?? '');

// ----------------------------------------------------------------------------
// Мелкие помощники разметки
// ----------------------------------------------------------------------------
function kpi(label, value, sub, cls = 'neutral') {
  return `<div class="kpi"><div class="k-label">${label}</div>
    <div class="k-value">${value}</div><div class="k-delta ${cls}">${sub ?? ''}</div></div>`;
}
function stat(label, value, sub) {
  return `<div class="stat"><div class="s-label">${label}</div>
    <div class="s-value">${value}</div><div class="s-sub">${sub ?? ''}</div></div>`;
}
function delta(cur, before) {
  if (!Number.isFinite(cur) || !Number.isFinite(before) || before === 0) return ['', 'neutral'];
  const d = cur / before - 1;
  return [signedPct(d), d > 0.001 ? 'up' : d < -0.001 ? 'down' : 'neutral'];
}
function flash(node) {
  if (!node) return;
  node.classList.remove('jump-target');
  void node.offsetWidth;
  node.classList.add('jump-target');
  setTimeout(() => node.classList.remove('jump-target'), 1600);
}
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
  node.style.cssText = 'position:fixed;right:18px;bottom:80px;z-index:60;max-width:340px;background:#0f2018';
  node.textContent = text;
  root.appendChild(node);
  setTimeout(() => node.remove(), 3500);
}

// ----------------------------------------------------------------------------
// Переходы по подсказкам: синие слова в советах ведут к нужному блоку
// ----------------------------------------------------------------------------
const JUMP_PANELS = {
  channel: 'channel-slot', supply: 'supply-slot', rival: 'rival-slot',
  board: 'board', funding: 'funding', report: 'report-slot',
  turn: 'turn-slot', charts: 'chart', exclusive: 'exclusive-slot',
};
function jumpTo(target) {
  const [kind, key] = String(target).split(':');
  if (kind === 'lever') {
    const lever = LEVERS.find((l) => l.key === key);
    if (lever && !openGroups[lever.group]) {
      openGroups[lever.group] = true;
      leversBuilt = false;
      buildLevers();
      syncLevers();
    }
    const node = document.querySelector(`.lever[data-key="${key}"]`);
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
  const box = node.classList.contains('panel') ? node
    : (node.querySelector(':scope > .panel') ?? node.closest('.panel') ?? node);
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
// Шапка
// ----------------------------------------------------------------------------
function renderKpis() {
  const r = last();
  const p = prev();
  const burn = r ? r.fixed + r.oneOff - r.contribution : 0;
  const runway = burn > 0 ? state.cash / burn : Infinity;

  const parts = [
    kpi(t('kpiMonth'), `${state.month} / ${CONFIG.monthsTotal}`,
      seasonName(seasonOf(state.month + 1))),
    kpi(t('kpiCash'), money(state.cash),
      state.cash < 0 ? t('kpiCashOut')
        : Number.isFinite(runway) ? t('kpiRunway', { months: runway.toFixed(0) })
        : t('kpiProfitable'),
      state.cash < 0 ? 'down' : runway < 5 ? 'down' : runway < 12 ? 'neutral' : 'up'),
  ];

  if (r) {
    const [dOrgs, cOrgs] = delta(r.orgs, p?.orgs);
    parts.push(
      kpi(t('kpiOrgs'), compact(Math.round(r.orgs)),
        dOrgs || t('kpiFlat'), cOrgs || 'neutral'),
      kpi(t('kpiShare'), pct(r.orgShare, 0), t('kpiOrgsSub', { them: compact(Math.round(r.rivalOrgs)) }),
        r.orgShare >= 0.45 ? 'up' : r.orgShare >= 0.28 ? 'neutral' : 'down'),
      kpi(t('kpiGmv'), money(r.gmv), t('kpiGmvSub', { revenue: money(r.revenue) }), 'neutral'),
      kpi(t('kpiProfit'), money(r.profit), t('kpiProfitSub', { value: money(r.contribution) }),
        r.profit >= 0 ? 'up' : 'down'),
      kpi(t('kpiEquity'), money(r.equityValue ?? 0),
        t('kpiEquitySub', { value: pct(state.equity, 1) }), 'neutral'),
    );
  } else {
    parts.push(kpi(t('kpiStart'), money(CONFIG.startCash), t('kpiStartSub')));
  }
  el('kpis').innerHTML = parts.join('');
}

// ----------------------------------------------------------------------------
// Рычаги
// ----------------------------------------------------------------------------
function buildLevers() {
  if (leversBuilt) return;
  el('levers').innerHTML = LEVER_GROUPS.map((g) => {
    const items = LEVERS.filter((l) => l.group === g.id);
    if (!items.length) return '';
    return `<div class="lever-group ${openGroups[g.id] ? 'open' : ''}" data-group="${g.id}">
      <button class="lever-group-head" type="button">
        <span class="lg-caret">▾</span><span>${tx(g.label)}</span>
        <span class="lg-count">${items.length}</span>
      </button>
      <div class="lever-group-body">
        ${items.map((l) => `
          <div class="lever" data-key="${l.key}">
            <div class="lever-head">
              <span class="lever-label">${tx(l.label)}</span>
              <span class="lever-value" id="val-${l.key}"></span>
            </div>
            <input type="range" id="in-${l.key}" min="${l.min}" max="${l.max}" step="${l.step}" />
            <button class="lever-why" type="button" data-why="${l.key}">${t('leverWhy')}</button>
            <div class="lever-tip">${tx(l.tip)}</div>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');

  el('levers').querySelectorAll('.lever-group-head').forEach((head) => {
    head.addEventListener('click', () => {
      const group = head.closest('.lever-group');
      const id = group.dataset.group;
      openGroups[id] = !openGroups[id];
      group.classList.toggle('open', openGroups[id]);
    });
  });
  for (const l of LEVERS) {
    const input = el(`in-${l.key}`);
    input.addEventListener('input', () => {
      const raw = Number(input.value);
      state.decisions[l.key] = raw * (l.scale ?? 1);
      syncLevers();
      renderTurn();
      renderChannels();
      renderRightTab();
    });
    el('levers').querySelector(`[data-why="${l.key}"]`).addEventListener('click', (e) => {
      e.target.closest('.lever').classList.toggle('open');
    });
  }
  leversBuilt = true;
}

function leverText(l, value) {
  if (l.scale === 0.01) return `${num(value * 100, value * 100 % 1 ? 1 : 0)} ${tx(l.unit)}`;
  if (l.key === 'managers') return `${num(value)} ${tx(l.unit)}`;
  if (value >= 1_000_000) return money(value);
  return `${num(value)} ${tx(l.unit)}`;
}

function syncLevers() {
  for (const l of LEVERS) {
    const value = state.decisions[l.key] ?? l.def * (l.scale ?? 1);
    const raw = value / (l.scale ?? 1);
    const input = el(`in-${l.key}`);
    if (input && Number(input.value) !== raw) input.value = String(raw);
    const label = el(`val-${l.key}`);
    if (label) label.textContent = leverText(l, value);
  }
}

// ----------------------------------------------------------------------------
// Итоги месяца
// ----------------------------------------------------------------------------
function renderStartHint() {
  return `<div class="panel">
    <h3 style="margin:0 0 8px">${t('reportMonth0')}</h3>
    <div class="hint-box">
      <b>${t('reportStartTitle')}</b> ${t('reportStartIntro', { cash: money(CONFIG.startCash) })}
      <ol style="margin:6px 0 0 16px;padding:0">
        <li>${t('reportStart1')}</li><li>${t('reportStart2')}</li>
        <li>${t('reportStart3')}</li><li>${t('reportStart4')}</li>
      </ol>
      <br>${t('reportStartAlgos')}
    </div>
  </div>`;
}

function buildAlerts(r) {
  const alerts = [];
  const d = r.decisions;
  if (r.seats < 60_000) {
    alerts.push(['bad', t('alertNoListings', { seats: compact(r.seats) }), 'panel:supply']);
  }
  if (r.fill < 0.42) {
    alerts.push(['bad', t('alertLowFill', { fill: pct(r.fill, 0) }), 'panel:supply']);
  }
  if (r.service < 0.7) {
    alerts.push(['warn', t('alertOverloaded', {
      service: pct(r.service, 0),
      perManager: num(d.managers > 0 ? r.orgs / d.managers : 999, 0),
    }), 'lever:managers']);
  }
  if (r.buyerPreference < 0.9 && r.rivalAlive) {
    alerts.push(['warn', t('alertFeeHigh', {
      fee: pct(d.buyerFee, 1), rival: pct(r.rivalBuyerFee, 1), pref: pct(r.buyerPreference, 0),
    }), 'lever:buyerFee']);
  }
  if (d.orgCommission > 0.075) {
    alerts.push(['warn', t('alertCommissionHigh', { value: pct(d.orgCommission, 1) }), 'lever:orgCommission']);
  }
  if (r.trust < 0.5) {
    alerts.push(['bad', t('alertTrustLow', { value: pct(r.trust, 0) }), 'tab:help']);
  }
  if (r.botShare > 0.12) {
    alerts.push(['warn', t('alertBots', { share: pct(r.botShare, 0) }), 'tab:algos']);
  }
  if (r.outageLoss > 0.04) {
    alerts.push(['bad', t('alertOutage', { share: pct(r.outageLoss, 0) }), 'lever:capacityTech']);
  }
  if (!r.connectedTypes.includes('club')) {
    alerts.push(['warn', t('alertNoPlatform'), 'panel:channel']);
  }
  if (r.marketplaceShareOfGmv < 0.55 && r.connectedCount > 0) {
    alerts.push(['warn', t('alertPlatformThin', { share: pct(r.marketplaceShareOfGmv, 0) }), 'panel:channel']);
  }
  if (r.takeRate > 0 && r.takeRate < 0.05) {
    alerts.push(['bad', t('alertTakeThin', {
      take: pct(r.takeRate, 1), acq: pct(CONFIG.acquiringRate, 1),
    }), 'lever:buyerFee']);
  }
  if (r.rivalJustCut) {
    alerts.push(['warn', t('alertRivalCut', { value: pct(r.rivalCommission, 1) }), 'panel:rival']);
  }
  if (!r.rivalAlive) alerts.unshift(['good', t('alertRivalDead')]);
  if (r.orgNetSwitch < -3) {
    alerts.push(['bad', t('alertLosingOrgs', { count: num(-r.orgNetSwitch, 0) }), 'panel:rival']);
  } else if (r.orgNetSwitch > 3) {
    alerts.push(['good', t('alertWinningOrgs', { count: num(r.orgNetSwitch, 0) })]);
  }
  const ready = ALGORITHMS.filter((a) => !state.installed?.[a.key] && r.algoQuality >= a.unlock);
  if (ready.length) {
    alerts.push(['good', t('alertAlgosReady', {
      names: ready.map((a) => tx(a.short)).join(', '), quality: pct(r.algoQuality, 0),
    }), 'tab:algos']);
  }
  const anyAlgoOn = Object.values(r.algoActive ?? {}).some(Boolean);
  if ((d.rnd ?? 0) > 0 && !anyAlgoOn) {
    alerts.push(['warn', t('alertRndIdle', { cost: money(d.rnd), quality: pct(r.algoQuality, 0) }), 'tab:algos']);
  }
  if (r.profit > 0) alerts.push(['good', t('alertProfit', { value: money(r.profit) })]);
  return alerts;
}

function renderReport() {
  const r = last();
  if (!r) { el('report-slot').innerHTML = renderStartHint(); return; }

  // Разбор месяца — баланс потоков: строки складываются в изменение числа
  // организаторов. Цвет строки всегда совпадает со знаком её вклада.
  const p0 = prev();
  const drivers = explain(p0, r);
  const netEffect = drivers.reduce((s, x) => s + x.effect, 0);
  const maxAbs = Math.max(0.005, ...drivers.map((x) => Math.abs(x.effect)));
  const bar = (effect, scale) => {
    const w = (Math.abs(effect) / scale) * 50;
    const pos = effect > 0;
    return `<span class="d-bar"><span class="d-fill" style="${
      pos ? `left:50%;width:${w}%` : `right:50%;width:${w}%`};background:${
      pos ? 'var(--good)' : 'var(--bad)'}"></span></span>`;
  };
  const factors = explainFactors(p0, r);
  const factorsHtml = factors.length ? `<div class="funding-note" style="margin-top:6px">${
    t('factorsIntro')} ${factors.slice(0, 4).map((f) =>
      `${t(f.key)} <b class="${f.effect > 0 ? 'pos' : 'neg'}">${signedPct(f.effect)}</b>`).join(', ')}.</div>` : '';
  const driversHtml = drivers.length && p0 ? `
    <div class="drivers">
      <div class="panel-title">${t('driversTitle', {
        delta: signedPct(r.orgs / Math.max(1e-9, p0.orgs) - 1) })}</div>
      ${drivers.map((x) => `<div class="driver">
          <span class="d-name">${t(x.key)}</span>
          <span class="d-people">${x.people >= 0 ? '+' : '−'}${num(Math.abs(x.people), 0)}</span>
          ${bar(x.effect, maxAbs)}
          <span class="d-val ${x.effect > 0 ? 'pos' : 'neg'}">${signedPct(x.effect)}</span>
        </div>`).join('')}
      <div class="d-sum">
        <span class="d-name">${t('driversNet')}</span>
        <span class="d-people">${r.orgs >= p0.orgs ? '+' : '−'}${num(Math.abs(r.orgs - p0.orgs), 0)}</span>
        ${bar(netEffect, maxAbs)}
        <span class="d-val ${netEffect > 0 ? 'pos' : 'neg'}">${signedPct(netEffect)}</span>
      </div>
    </div>${factorsHtml}` : '';

  const alerts = buildAlerts(r);
  if (r.goalOutcome) {
    alerts.unshift([r.goalOutcome.passed ? 'good' : 'bad',
      r.goalOutcome.passed
        ? t('alertGoalPassed', { year: r.goalOutcome.year })
        : t(`alertGoalFailed_${r.goalOutcome.effect}`, { year: r.goalOutcome.year }), 'panel:board']);
  }
  if (r.marketingCapped) {
    alerts.unshift(['bad', t('alertCapped', { cap: money(r.marketingCapped) }), 'panel:board']);
  }
  if (r.crisisResolved) {
    alerts.unshift(['good', t('alertCrisisResolved', {
      name: tx(crisisById(r.crisisResolved.id)?.title ?? ''), cost: money(r.crisisCost) })]);
  }
  // Больше пяти строк разбора никто не читает: важное тонет в подробностях.
  const shown = alerts.slice(0, 5);
  const hidden = alerts.length - shown.length;
  const alertsHtml = shown.length
    ? `<div class="alerts">${shown.map(([k, text, jump]) => `<div class="alert ${k}">${text}${
        jump ? ` <a class="jump" data-jump="${jump}">${t('jumpGo')}</a>` : ''}</div>`).join('')}
        ${hidden > 0 ? `<div class="funding-note">${t('alertsMore', { count: hidden })}</div>` : ''}</div>` : '';

  const ev = r.event ? eventById(r.event.id) : null;
  const eventNote = ev ? `<div class="lesson"><b>${tx(ev.title)}.</b> ${tx(ev.lesson)}</div>` : '';
  const hitNote = r.hit ? `<div class="alert good" style="margin-top:8px">${
    t('hitTitle', { name: tx(hitById(r.hit.id)?.name ?? '') })} — ${tx(hitById(r.hit.id)?.note ?? '')}</div>` : '';
  const installNote = r.installedNow?.length
    ? `<div class="alert good" style="margin-top:8px">${t('installNote', {
        names: r.installedNow.map((k) => tx(algorithmByKey(k)?.name)).join(', '),
        cost: money(r.installCost) })}</div>` : '';
  const exclusiveNote = r.exclusiveSigned
    ? `<div class="alert good" style="margin-top:8px">${t('exclusiveSigned', {
        type: orgName(r.exclusiveSigned.org), months: r.exclusiveSigned.months,
        advance: money(r.exclusiveSigned.advance) })}</div>` : '';

  el('report-slot').innerHTML = `<div class="panel">
    <div class="report-head">
      <h3>${t('reportTitle', { month: r.month })}</h3>
      <span class="funding-note">${t('reportHeadStats', {
        gmv: money(r.gmv), revenue: money(r.revenue),
        perTicket: `${num(r.revenuePerTicket)} ₽` })}</span>
    </div>
    <div class="report-grid">
      ${stat(t('statOrgs'), num(r.orgs, 0), t('statOrgsSub', {
        gained: num(r.orgJoined, 0), lost: num(r.orgLeft, 0) }))}
      ${stat(t('statTickets'), compact(r.tickets), t('statTicketsSub', { market: compact(r.marketTickets) }))}
      ${stat(t('statGmv'), money(r.gmv), t('statGmvSub', { share: pct(r.marketplaceShareOfGmv, 0) }))}
      ${stat(t('statTake'), pct(r.takeRate, 1), t('statTakeSub', { acq: pct(CONFIG.acquiringRate, 1) }))}
      ${stat(t('statFill'), pct(r.fill, 0), t('statFillSub', { seats: compact(r.seats) }))}
      ${stat(t('statReach'), compact(r.reach), t('statReachSub', {
        share: pct(r.reachShare, 0), conv: pct(r.conversion, 0) }))}
      ${stat(t('statTrust'), pct(r.trust, 0), t('statTrustSub', { bots: pct(r.botShare, 0) }))}
      ${stat(t('statService'), pct(r.service, 0), t('statServiceSub', {
        perManager: num(r.decisions.managers > 0 ? r.orgs / r.decisions.managers : 0, 0) }))}
      ${stat(t('statBuyerPref'), pct(r.buyerPreference, 0), t('statBuyerPrefSub', {
        fee: pct(r.decisions.buyerFee, 1), rival: pct(r.rivalBuyerFee, 1) }))}
      ${stat(t('statPlatform'), pct(r.platformLevel, 0), t('statPlatformSub', {
        count: num(r.connectedCount, 0) }))}
      ${stat(t('statBreadth'), pct(r.breadth, 0), t('statBreadthSub', { events: compact(r.events) }))}
      ${stat(t('statProfit'), money(r.profit), t('statProfitSub', { value: money(r.fixed) }))}
    </div>
    ${hitNote}${installNote}${exclusiveNote}
    ${driversHtml}${alertsHtml}${eventNote}
  </div>`;
}

// ----------------------------------------------------------------------------
// Событие
// ----------------------------------------------------------------------------
function renderEvent() {
  const ev = state.pendingEvent;
  if (!ev) { el('event-slot').innerHTML = ''; return; }
  const options = ev.options ?? [];
  el('event-slot').innerHTML = `<div class="panel event">
    <h3>${tx(ev.title)}</h3>
    <p>${tx(ev.text)}</p>
    ${options.length ? `<div class="event-options">${options.map((o, i) => `
      <button class="event-option ${state.pendingChoice === i ? 'selected' : ''}" data-opt="${i}">
        <span class="opt-label">${tx(o.label)}</span>
        <span class="opt-detail">${tx(o.detail)}</span>
      </button>`).join('')}</div>` : ''}
  </div>`;
  el('event-slot').querySelectorAll('[data-opt]').forEach((b) => {
    b.addEventListener('click', () => {
      state.pendingChoice = Number(b.dataset.opt);
      renderEvent();
      renderTurn();
    });
  });
}

// ----------------------------------------------------------------------------
// Кризис
// ----------------------------------------------------------------------------
function renderCrisis() {
  const active = state.crisis;
  if (!active) { el('crisis-slot').innerHTML = ''; return; }
  const def = crisisById(active.id);
  if (!def) { el('crisis-slot').innerHTML = ''; return; }
  el('crisis-slot').innerHTML = `<div class="panel event" style="border-left-color:var(--bad)">
    <div class="panel-title">${t('crisisPanel', { months: active.months + 1 })}</div>
    <h3>${tx(def.title)}</h3>
    <p>${tx(def.text)}</p>
    <div class="funding-note" style="margin-bottom:8px">${t('crisisEscalates')}</div>
    <div class="event-options crisis-options">${def.resolutions.map((res) => {
      const cost = resolutionCost(active, res.id);
      return `<button class="event-option ${pendingCrisisChoice === res.id ? 'selected' : ''}" data-res="${res.id}">
        <span class="opt-label">${tx(res.label)}</span>
        <span class="opt-detail">${tx(res.detail)} · ${cost > 0 ? t('crisisCost', { cost: money(cost) }) : t('crisisFree')}</span>
      </button>`;
    }).join('')}</div>
    <div class="lesson"><b>${tx(def.title)}.</b> ${tx(def.lesson)}</div>
  </div>`;
  el('crisis-slot').querySelectorAll('[data-res]').forEach((b) => {
    b.addEventListener('click', () => {
      pendingCrisisChoice = pendingCrisisChoice === b.dataset.res ? null : b.dataset.res;
      renderCrisis();
      renderTurn();
    });
  });
}

// ----------------------------------------------------------------------------
// Эксклюзив
// ----------------------------------------------------------------------------
function renderExclusive() {
  const offer = state.exclusiveOffer;
  if (!offer) { el('exclusive-slot').innerHTML = ''; return; }
  el('exclusive-slot').innerHTML = `<div class="panel event">
    <div class="panel-title">${t('exclusiveTitle')}</div>
    <p>${t('exclusiveText', {
      type: orgName(offer.org), months: offer.months, advance: money(offer.advance) })}</p>
    <div class="event-options">
      <button class="event-option ${pendingExclusive === 'accept' ? 'selected' : ''}" data-ex="accept">
        <span class="opt-label">${t('exclusiveAccept')}</span>
        <span class="opt-detail">${money(offer.advance)}</span>
      </button>
      <button class="event-option ${pendingExclusive === 'decline' ? 'selected' : ''}" data-ex="decline">
        <span class="opt-label">${t('exclusiveDecline')}</span>
        <span class="opt-detail">—</span>
      </button>
    </div>
  </div>`;
  el('exclusive-slot').querySelectorAll('[data-ex]').forEach((b) => {
    b.addEventListener('click', () => {
      pendingExclusive = pendingExclusive === b.dataset.ex ? null : b.dataset.ex;
      renderExclusive();
      renderTurn();
    });
  });
}

// ----------------------------------------------------------------------------
// Ход: что осталось решить
// ----------------------------------------------------------------------------
function renderTurn() {
  const d = state.decisions;
  const r = last();
  const todos = [];
  if (!Object.values(d.platformFor ?? {}).some(Boolean)) {
    todos.push(['warn', t('todoPlatformTitle'), t('todoPlatformText'), 'panel:channel']);
  }
  const orgs = r ? r.orgs : orgTotal(state);
  const perManager = d.managers > 0 ? orgs / d.managers : Infinity;
  if (perManager > CONFIG.orgPerManager * 1.15) {
    todos.push(['bad', t('todoManagersTitle'), t('todoManagersText', {
      perManager: num(Math.min(perManager, 9999), 0), norm: CONFIG.orgPerManager }), 'lever:managers']);
  }
  if (d.capacityTech < 4_000_000) {
    todos.push(['warn', t('todoCapacityTitle'), t('todoCapacityText'), 'lever:capacityTech']);
  }
  if (r && r.rivalAlive && d.buyerFee > r.rivalBuyerFee + 0.005) {
    todos.push(['warn', t('todoFeeTitle'), t('todoFeeText'), 'lever:buyerFee']);
  }

  const planned = [];
  if (pendingExclusive) planned.push(pendingExclusive === 'accept' ? t('exclusiveAccept') : t('exclusiveDecline'));
  if (pendingCrisisChoice) planned.push(tx(crisisById(state.crisis?.id)?.resolutions
    .find((x) => x.id === pendingCrisisChoice)?.label ?? ''));

  el('turn-slot').innerHTML = `<div class="panel">
    <div class="report-head">
      <h2 class="panel-title inline">${t('turnTitle', { month: state.month + 1 })}</h2>
      <span class="funding-note">${planned.length
        ? t('turnPlanned', { list: planned.join(', ') }) : t('turnNothing')}</span>
    </div>
    ${todos.length ? todos.map(([k, title, text, jump]) => `
      <div class="alert ${k}" style="margin-top:8px">
        <b>${title}</b><br>${text}
        <a class="jump" data-jump="${jump}">${t('jumpGo')}</a>
      </div>`).join('') : ''}
  </div>`;
}

// ----------------------------------------------------------------------------
// Каналы продаж — главная развилка этой игры
// ----------------------------------------------------------------------------
function renderChannels() {
  const d = state.decisions;
  const level = platformLevel(state);
  const rows = ORGANIZERS.map((def) => {
    const connected = Boolean(d.platformFor?.[def.id]);
    const split = channelSplit(def, connected && level > 0.02, level);
    const perMarket = def.avgPrice * (d.buyerFee + d.orgCommission);
    const perPlatform = def.avgPrice * d.platformRate;
    const perSeat = split.market * perMarket + split.platform * perPlatform;
    const need = def.platformNeed >= 1.3 ? 'bad' : def.platformNeed >= 0.5 ? 'warn' : '';
    return `<tr>
      <td><b>${tx(def.name)}</b><div class="funding-note">${compact(state.orgs[def.id] ?? 0)} ${t('unitOrgs')}</div></td>
      <td class="${need}">${pct(clamp(def.platformNeed / 2, 0, 1), 0)}</td>
      <td class="mono">${pct(split.market, 0)} / ${pct(split.platform, 0)} / <span class="neg">${pct(split.lost, 0)}</span></td>
      <td class="mono">${num(perSeat)} ₽</td>
      <td><button class="btn small ${connected ? 'primary' : 'ghost'}" data-platform="${def.id}">${
        connected ? t('channelOn') : t('channelOff')}</button></td>
    </tr>`;
  }).join('');

  el('channel-slot').innerHTML = `<div class="panel">
    <h2 class="panel-title">${t('channelPanel')}</h2>
    <div class="funding-note" style="margin-bottom:8px">${t('channelCaption')}</div>
    ${level <= 0.02 ? `<div class="alert warn">${t('channelNoPlatform')}
      <a class="jump" data-jump="lever:platformDev">${t('jumpGo')}</a></div>` : ''}
    <table class="data">
      <thead><tr>
        <th>${t('channelColType')}</th><th>${t('channelColNeed')}</th>
        <th>${t('channelColSplit')}</th><th>${t('channelColMoney')}</th><th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="funding-note" style="margin-top:8px">${t('channelLevel', { level: pct(level, 0) })}</div>
  </div>`;

  el('channel-slot').querySelectorAll('[data-platform]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset.platform;
      const was = Boolean(state.decisions.platformFor?.[id]);
      state.decisions.platformFor = { ...state.decisions.platformFor, [id]: !was };
      if (was) toast(t('channelDisconnectWarn'));
      renderChannels();
      renderTurn();
      renderRightTab();
    });
  });
}

// ----------------------------------------------------------------------------
// Организаторы
// ----------------------------------------------------------------------------
function renderSupply() {
  const r = last();
  if (!r) { el('supply-slot').innerHTML = ''; return; }
  const rows = r.organizers.map((o) => {
    const def = organizerById(o.id);
    const gmv = (o.marketSold + o.platformSold) * def.avgPrice;
    return `<tr>
      <td><b>${tx(def.name)}</b><div class="funding-note">${tx(def.short)}</div></td>
      <td class="mono">${num(o.count, 0)}</td>
      <td class="mono ${o.fill >= CONFIG.refFill ? 'pos' : 'neg'}">${pct(o.fill, 0)}</td>
      <td class="mono ${o.preference >= 0.5 ? 'pos' : 'neg'}">${o.appeal.toFixed(2)} / ${o.rivalAppeal.toFixed(2)}</td>
      <td class="mono">${money(gmv)}</td>
    </tr>`;
  }).join('');
  el('supply-slot').innerHTML = `<div class="panel">
    <h2 class="panel-title">${t('supplyPanel')}</h2>
    <div class="funding-note" style="margin-bottom:8px">${t('supplyCaption')}</div>
    <table class="data">
      <thead><tr>
        <th>${t('channelColType')}</th><th>${t('supplyColCount')}</th>
        <th>${t('supplyColFill')}</th><th>${t('supplyColAppeal')}</th><th>${t('supplyColGmv')}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ----------------------------------------------------------------------------
// Конкурент
// ----------------------------------------------------------------------------
function renderRival() {
  const riv = state.rivalState;
  const r = last();
  const you = r ? r.orgs : orgTotal(state);
  const them = rivalOrgTotal(riv);
  const share = you + them > 0 ? you / (you + them) : 0;
  const dead = !riv.alive;
  const gap = riv.commission - state.decisions.orgCommission;
  const feeGap = riv.buyerFee - state.decisions.buyerFee;
  const stanceCls = dead ? 'pos' : riv.stance === 'dumping' ? 'neg'
    : riv.stance === 'exclusive' ? 'warn' : riv.stance === 'retreat' ? 'pos' : '';
  const exclusives = Object.keys(riv.exclusives ?? {});

  el('rival-slot').innerHTML = `<div class="panel">
    <h2 class="panel-title">${t('rivalPanel', {
      season: seasonName(seasonOf(state.month + 1)), month: state.month + 1 })}</h2>
    <div class="rival-head">
      <div class="rival-stance">
        <span class="badge ${stanceCls}">${dead ? t('stanceGone') : stanceName(riv.stance)}</span>
        <span class="rival-stance-hint">${dead ? t('stanceGoneHint') : stanceHint(riv.stance)}</span>
      </div>
      <div class="rival-facts">
        <span>${t('rivalTheirCommission')} <b>${pct(riv.commission, 1)}</b>
          <span class="${gap > 0 ? 'pos' : gap < 0 ? 'neg' : ''}">${
            Math.abs(gap) < 0.0005 ? t('rivalSame')
              : t(gap > 0 ? 'rivalDearer' : 'rivalCheaper', { gap: pct(Math.abs(gap), 1) })}</span></span>
        <span>${t('rivalTheirFee')} <b>${pct(riv.buyerFee, 1)}</b>
          <span class="${feeGap > 0 ? 'pos' : feeGap < 0 ? 'neg' : ''}">${
            Math.abs(feeGap) < 0.0005 ? t('rivalSame')
              : t(feeGap > 0 ? 'rivalDearer' : 'rivalCheaper', { gap: pct(Math.abs(feeGap), 1) })}</span></span>
        <span>${t('rivalTheirReach')} <b>${compact(riv.reach)}</b></span>
      </div>
    </div>
    <div class="share-bar" title="${t('shareBarHint')}">
      <span class="share-you" style="width:${(share * 100).toFixed(1)}%">${share > 0.12 ? `${t('shareYou')} ${pct(share, 0)}` : ''}</span>
      <span class="share-them">${share < 0.88 ? `${t('shareThem')} ${pct(1 - share, 0)}` : ''}</span>
    </div>
    <div class="funding-note">${t('shareCaption', {
      you: num(you, 0), them: num(them, 0),
      flow: r ? (r.orgNetSwitch >= 0 ? `+${num(r.orgNetSwitch, 0)}` : `−${num(-r.orgNetSwitch, 0)}`) : '0',
    })}</div>
    ${exclusives.length ? `<div class="alert warn" style="margin-top:8px">${
      t('rivalExclusive', { types: exclusives.map(orgName).join(', ') })}</div>` : ''}
    ${Object.keys(state.exclusives ?? {}).length ? `<div class="alert good" style="margin-top:8px">${
      t('exclusiveMine', { types: Object.keys(state.exclusives).map(orgName).join(', ') })}</div>` : ''}
  </div>`;
}

// ----------------------------------------------------------------------------
// Совет акционеров
// ----------------------------------------------------------------------------
function renderBoard() {
  const goal = state.board?.goal;
  const r = last();
  if (!goal) { el('board').innerHTML = `<div class="hint-box">${t('boardDone')}</div>`; return; }
  const p = goalProgress(goal, {
    gmv: r?.gmv ?? 0,
    profitableMonths: state.board.profitableMonths,
    orgs: r?.orgs ?? orgTotal(state),
    rivalOrgs: rivalOrgTotal(state.rivalState),
  });
  let text = '';
  let now = '';
  if (goal.type === 'gmv') {
    text = t('goalGmv', { target: money(goal.target), year: goal.year });
    now = money(p.value);
  } else if (goal.type === 'revenue') {
    text = t('goalRevenue', { target: goal.target, floor: money(goal.gmvFloor) });
    now = `${p.value} / ${goal.target}`;
  } else {
    text = t('goalShare', { target: pct(goal.target, 0), floor: num(goal.orgFloor, 0) });
    now = pct(p.value, 0);
  }
  const past = (state.board.history ?? []).map((h) =>
    `<div class="goal-past ${h.passed ? 'pos' : 'neg'}">${t('goalYear', { year: h.year })}: ${
      h.passed ? t('goalPassed') : t('goalFailed')}</div>`).join('');
  el('board').innerHTML = `
    <div class="hint-box"><b>${t('goalYear', { year: goal.year })}.</b> ${text}<br>
      <span class="${p.done ? 'pos' : 'neg'}">${t('goalNow', { value: now })}</span></div>
    ${past}`;
}

// ----------------------------------------------------------------------------
// Инвестиции
// ----------------------------------------------------------------------------
function renderFunding() {
  if (state.month < CONFIG.minMonthForFunding) {
    el('funding').innerHTML = `<div class="funding-note">${
      t('fundingLocked', { month: CONFIG.minMonthForFunding })}</div>`;
    return;
  }
  el('funding').innerHTML = `
    <div class="funding-note">${t('fundingNote')}</div>
    ${CONFIG.fundingOptions.map((amount) => {
      const offer = fundingOffer(state, amount);
      return `<div class="funding-row">
        <span>${t('fundingRaise', { amount: money(amount) })}<br>
          <span class="funding-note">${t('fundingDilution', { value: pct(offer.dilution, 1) })}</span></span>
        <button class="btn small" data-raise="${amount}">→</button>
      </div>`;
    }).join('')}
    <div class="funding-note">${t('fundingStake', { value: pct(state.equity, 1) })}</div>`;
  el('funding').querySelectorAll('[data-raise]').forEach((b) => {
    b.addEventListener('click', () => {
      const res = raise(state, Number(b.dataset.raise));
      state = res.state;
      save();
      renderAll();
    });
  });
}

// ----------------------------------------------------------------------------
// Графики
// ----------------------------------------------------------------------------
const CHART_TABS = {
  market: {
    label: 'chartMarket', caption: 'chartMarketCaption',
    format: (v) => `${Math.round(v)}`,
    series: (h) => [
      { label: t('seriesYouOrgs'), data: h.map((r) => r.orgs), color: PALETTE[1] },
      { label: t('seriesThemOrgs'), data: h.map((r) => r.rivalOrgs), color: PALETTE[3] },
    ],
  },
  // Две нижние линии складываются в верхнюю: если они не сходятся, врёт модель
  channels: {
    label: 'chartChannels', caption: 'chartChannelsCaption',
    series: (h) => [
      { label: t('seriesGmv'), data: h.map((r) => r.gmv), color: PALETTE[1] },
      { label: t('seriesGmvMarket'), data: h.map((r) => r.gmvMarket), color: PALETTE[0] },
      { label: t('seriesGmvPlatform'), data: h.map((r) => r.gmvPlatform), color: PALETTE[4] },
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
  fill: {
    label: 'chartFill', caption: 'chartFillCaption',
    series: (h) => [
      { label: t('seriesSeats'), data: h.map((r) => r.seats), color: PALETTE[4] },
      { label: t('seriesDemand'), data: h.map((r) => r.demand), color: PALETTE[1] },
      { label: t('seriesSold'), data: h.map((r) => r.tickets), color: PALETTE[0] },
    ],
  },
  take: {
    label: 'chartTake', caption: 'chartTakeCaption',
    format: (v) => `${v.toFixed(1)}`,
    series: (h) => [
      { label: t('seriesTake'), data: h.map((r) => r.takeRate * 100), color: PALETTE[1] },
      { label: t('seriesAcq'), data: h.map(() => CONFIG.acquiringRate * 100), color: PALETTE[3] },
    ],
  },
  trust: {
    label: 'chartTrust', caption: 'chartTrustCaption',
    format: (v) => `${Math.round(v)}`,
    series: (h) => [
      { label: t('seriesTrust'), data: h.map((r) => r.trust * 100), color: PALETTE[2] },
      { label: t('seriesConv'), data: h.map((r) => r.conversion * 100), color: PALETTE[1] },
    ],
  },
  algos: {
    label: 'chartAlgos', caption: 'chartAlgosCaption',
    format: (v) => `${Math.round(v)}`,
    series: (h) => [
      { label: t('seriesQuality'), data: h.map((r) => (r.algoQuality ?? 0) * 100), color: PALETTE[4] },
      { label: t('seriesData'), data: h.map((r) => (r.dataLevel ?? 0) * 100), color: PALETTE[1] },
      { label: t('seriesTeam'), data: h.map((r) => (r.rndLevel ?? 0) * 100), color: PALETTE[3] },
    ],
  },
};

function renderChart() {
  el('chart-tabs').innerHTML = Object.entries(CHART_TABS)
    .map(([k, v]) => `<button data-chart="${k}" class="${k === chartTab ? 'active' : ''}">${t(v.label)}</button>`).join('');
  el('chart-tabs').querySelectorAll('[data-chart]').forEach((b) => {
    b.addEventListener('click', () => { chartTab = b.dataset.chart; renderChart(); });
  });
  const conf = CHART_TABS[chartTab];
  const series = conf.series(state.history);
  el('chart-legend').innerHTML = legendHtml(series);
  el('chart-caption').textContent = t(conf.caption);
  drawLineChart(el('chart'), series, {
    zeroLine: conf.zeroLine, format: conf.format ?? axisNum, emptyText: t('pnlEmpty'),
  });
}

// ----------------------------------------------------------------------------
// Правая колонка
// ----------------------------------------------------------------------------
function renderUnitTab() {
  const u = unitEconomics(state, state.decisions);
  const r = last();
  const row = (name, value, cls = '', sub = false) =>
    `<tr class="${sub ? 'sub' : ''}"><td>${name}</td><td class="${cls}">${num(value)} ₽</td></tr>`;
  const breakEven = r && u.contribution > 0 ? r.fixed / u.contribution : null;
  return `
    <p class="funding-note">${t('unitIntro')}</p>
    <table class="data">
      <thead><tr><th>${t('unitColItem')}</th><th>${t('unitColPerTicket')}</th></tr></thead>
      <tbody>
        <tr><td>${t('unitPrice')}</td><td class="mono">${num(u.avgPrice)} ₽</td></tr>
        ${row(t('unitMarket'), u.marketRevenue, 'pos', true)}
        ${row(t('unitPlatform'), u.platformRevenue, 'pos', true)}
        <tr class="total"><td>${t('unitBlended')}</td><td class="pos">${num(u.blended)} ₽</td></tr>
        ${row(t('unitAcquiring'), -u.acquiring, 'neg', true)}
        ${row(t('unitSupport'), -u.support, 'neg', true)}
        <tr class="total"><td>${t('unitContribution')}</td>
          <td class="${u.contribution >= 0 ? 'pos' : 'neg'}">${num(u.contribution)} ₽</td></tr>
      </tbody>
    </table>
    ${breakEven ? `<p class="funding-note">${t('unitBreakEven', { value: compact(breakEven) })}</p>` : ''}`;
}

function renderPnlTab() {
  const r = last();
  if (!r) return `<p class="funding-note">${t('pnlEmpty')}</p>`;
  const line = (name, value, cls = '', sub = false) =>
    `<tr class="${sub ? 'sub' : ''}"><td>${name}</td><td class="${cls}">${moneyExact(value)}</td></tr>`;
  const d = r.decisions;
  return `
    <p class="funding-note">${t('pnlGmvNote', { gmv: money(r.gmv), take: pct(r.takeRate, 1) })}</p>
    <table class="data">
      <tbody>
        ${line(t('pnlMarketplace'), r.marketplaceRevenue, 'pos', true)}
        ${line(t('pnlPlatform'), r.platformRevenue, 'pos', true)}
        ${line(t('pnlSubscription'), r.subscriptionRevenue, 'pos', true)}
        <tr class="total"><td>${t('pnlRevenue')}</td><td class="pos">${moneyExact(r.revenue)}</td></tr>
        ${line(t('pnlAcquiring'), -r.acquiring, 'neg', true)}
        ${line(t('pnlSupport'), -r.supportCost, 'neg', true)}
        <tr class="total"><td>${t('pnlContribution')}</td>
          <td class="${r.contribution >= 0 ? 'pos' : 'neg'}">${moneyExact(r.contribution)}</td></tr>
        ${line(t('pnlMarketing'), -d.marketing, 'neg', true)}
        ${line(t('pnlManagers'), -r.managerCost, 'neg', true)}
        ${line(t('pnlPlatformDev'), -d.platformDev, 'neg', true)}
        ${line(t('pnlPlatformSeats'), -r.platformSeats, 'neg', true)}
        ${line(t('pnlProduct'), -d.product, 'neg', true)}
        ${line(t('pnlSupport'), -d.support, 'neg', true)}
        ${line(t('pnlCapacity'), -d.capacityTech, 'neg', true)}
        ${line(t('pnlRnd'), -d.rnd, 'neg', true)}
        ${line(t('pnlUpkeep'), -(r.techUpkeep ?? 0), 'neg', true)}
        ${line(t('pnlServers'), -(r.serverCost ?? 0), 'neg', true)}
        ${line(t('pnlHq'), -CONFIG.hqMonthly, 'neg', true)}
        <tr class="total"><td>${t('pnlProfit')}</td>
          <td class="${r.profit >= 0 ? 'pos' : 'neg'}">${moneyExact(r.profit)}</td></tr>
        ${r.oneOff !== 0 ? line(t('pnlOneOff'), -r.oneOff, 'neg', true) : ''}
        <tr class="total"><td>${t('pnlNet')}</td>
          <td class="${(r.profit - r.oneOff) >= 0 ? 'pos' : 'neg'}">${moneyExact(r.profit - r.oneOff)}</td></tr>
      </tbody>
    </table>`;
}

function renderSidesTab() {
  const r = last();
  if (!r) return `<p class="funding-note">${t('pnlEmpty')}</p>`;
  const supply = r.organizers.map((o) => {
    const def = organizerById(o.id);
    return `<tr><td>${tx(def.short)}</td>
      <td class="mono">${num(o.count, 0)}</td>
      <td class="mono ${o.fill >= CONFIG.refFill ? 'pos' : 'neg'}">${pct(o.fill, 0)}</td>
      <td class="mono">${compact(o.seats)}</td></tr>`;
  }).join('');
  const demand = r.segments.map((s) => `<tr>
      <td>${audName(s.id)}</td>
      <td class="mono">${pct(s.reach, 0)}</td>
      <td class="mono ${s.interest >= 1 ? 'pos' : 'neg'}">${s.interest.toFixed(2)}</td>
      <td class="mono">${pct(s.conversion, 0)}</td>
      <td class="mono">${compact(s.demand)}</td></tr>`).join('');
  return `
    <div class="panel-title">${t('sidesSupply')}</div>
    <p class="funding-note">${t('supplyCaption')}</p>
    <table class="data">
      <thead><tr><th>${t('channelColType')}</th><th>${t('supplyColCount')}</th>
        <th>${t('supplyColFill')}</th><th>${t('unitSeats')}</th></tr></thead>
      <tbody>${supply}</tbody>
    </table>
    <div class="panel-title" style="margin-top:14px">${t('sidesDemand')}</div>
    <p class="funding-note">${t('audienceCaption')}</p>
    <table class="data">
      <thead><tr><th>${t('audiencePanel')}</th><th>${t('audienceColReach')}</th>
        <th>${t('audienceColInterest')}</th><th>${t('audienceColConv')}</th>
        <th>${t('audienceColDemand')}</th></tr></thead>
      <tbody>${demand}</tbody>
    </table>`;
}

function renderAlgosTab() {
  const quality = algoQuality(state);
  const rows = ALGORITHMS.map((a) => {
    const installed = state.installed[a.key];
    const on = Boolean(state.decisions.algoOn?.[a.key]);
    const param = state.decisions.algoParam?.[a.key] ?? 0;
    const locked = !installed && quality < a.unlock;
    return `<div class="algo ${installed && on ? 'on' : ''}">
      <div class="algo-head">
        <b>${tx(a.name)}</b>
        ${installed
          ? `<button class="btn small ${on ? 'primary' : 'ghost'}" data-algo="${a.key}">${on ? t('algosOn') : t('algosOff')}</button>`
          : locked
            ? `<span class="badge">${t('algosLocked', { unlock: pct(a.unlock, 0) })}</span>`
            : `<button class="btn small" data-install="${a.key}">${t('algosInstall', { cost: money(a.install) })}</button>`}
      </div>
      <div class="funding-note">${tx(a.what)}</div>
      ${installed && on ? `
        <div class="lever" style="margin:6px 0 0">
          <div class="lever-head">
            <span class="lever-label">${tx(a.param.label)}</span>
            <span class="lever-value">${num(param / (a.param.scale ?? 1))} ${tx(a.param.unit)}</span>
          </div>
          <input type="range" data-param="${a.key}" min="${a.param.min}" max="${a.param.max}"
            step="${a.param.step}" value="${param / (a.param.scale ?? 1)}" />
        </div>` : ''}
      <div class="lesson"><b>${tx(a.tradeoff)}</b><br>${tx(a.lesson)}</div>
    </div>`;
  }).join('');
  return `
    <p class="funding-note">${t('algosIntro')}</p>
    <p class="funding-note">${t('algosQuality', {
      quality: pct(quality, 0), data: pct(dataLevel(state), 0), team: pct(rndLevel(state), 0) })}</p>
    ${rows}`;
}

function renderHelpTab() {
  return `
    <div class="panel-title">${t('helpTitle')}</div>
    <p class="funding-note">${t('helpIntro')}</p>
    <p class="funding-note">${t('helpTake')}</p>
    <p class="funding-note">${t('helpChannel')}</p>
    <p class="funding-note">${t('helpGmv')}</p>
    <p class="funding-note">${t('helpTrust')}</p>
    <p class="funding-note">${t('helpSeeds')}</p>`;
}

function renderRightTab() {
  el('tabs').querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === rightTab);
    tab.textContent = t({
      unit: 'tabUnit', pnl: 'tabPnl', sides: 'tabSides', algos: 'tabAlgos', help: 'tabHelp',
    }[tab.dataset.tab]);
  });
  const content = {
    unit: renderUnitTab, pnl: renderPnlTab, sides: renderSidesTab,
    algos: renderAlgosTab, help: renderHelpTab,
  }[rightTab] ?? renderUnitTab;
  el('tab-content').innerHTML = content();

  el('tab-content').querySelectorAll('[data-algo]').forEach((b) => {
    b.addEventListener('click', () => {
      const key = b.dataset.algo;
      state.decisions.algoOn = { ...state.decisions.algoOn, [key]: !state.decisions.algoOn?.[key] };
      renderRightTab();
    });
  });
  el('tab-content').querySelectorAll('[data-install]').forEach((b) => {
    b.addEventListener('click', () => {
      const key = b.dataset.install;
      state.pendingInstall = [...(state.pendingInstall ?? []), key];
      state.decisions.algoOn = { ...state.decisions.algoOn, [key]: true };
      renderRightTab();
      renderTurn();
    });
  });
  el('tab-content').querySelectorAll('[data-param]').forEach((input) => {
    input.addEventListener('input', () => {
      const algo = algorithmByKey(input.dataset.param);
      state.decisions.algoParam = {
        ...state.decisions.algoParam,
        [algo.key]: Number(input.value) * (algo.param.scale ?? 1),
      };
      renderRightTab();
    });
  });
}

// ----------------------------------------------------------------------------
// Ход игры
// ----------------------------------------------------------------------------
function nextMonth() {
  if (state.over) { showGameOver(); return; }
  const ev = state.pendingEvent;
  if (ev && ev.options && state.pendingChoice === null) { toast(t('eventChoiceNeeded')); return; }
  const res = step(state, {
    decisions: state.decisions,
    eventChoice: state.pendingChoice ?? 0,
    crisisChoice: pendingCrisisChoice,
    exclusiveAnswer: pendingExclusive,
    install: state.pendingInstall ?? [],
  });
  state = res.state;
  state.pendingInstall = [];
  clearActions();
  save();
  renderAll();
  if (state.over) showGameOver();
}

function gradeOf(score) {
  if (score.bankrupt) return t('gradeBankrupt');
  if (score.orgShare >= 0.45 && score.takeRate >= 0.09) return t('gradeExcellent');
  if (score.equityValue >= 4_000_000_000) return t('gradeSolid');
  if (score.orgShare < 0.25) return t('gradeModest');
  return t('gradeSurvived');
}

function showGameOver() {
  const score = finalScore(state);
  const goals = (state.board?.history ?? [])
    .map((h) => `${t('goalYear', { year: h.year })} ${h.passed ? '✓' : '✗'}`).join(' · ');
  modal(`<h2>${t('overTitle')}</h2>
    <p>${state.over === 'bankrupt'
      ? t('overBankrupt', { month: state.month }) : t('overFinished')}</p>
    <p class="funding-note">${t('overStats', {
      valuation: money(score.valuation), equity: pct(score.equity, 1),
      value: money(score.equityValue), orgs: num(state.history.at(-1)?.orgs ?? 0, 0),
      share: pct(score.orgShare, 0), gmv: money(score.gmv), trust: pct(score.trust, 0),
    })}</p>
    ${goals ? `<p class="funding-note">${t('overGoals', { list: goals })}</p>` : ''}
    <p><b>${gradeOf(score)}</b></p>`,
  [{ label: t('overAgain'), primary: true, onClick: restart }, { label: t('helpModalOk') }]);
}

function restart() {
  dropSave();
  state = createInitialState(`bileton-${Date.now() % 100000}`);
  clearActions();
  leversBuilt = false;
  renderAll();
  showWelcome();
}


// Приветственный экран: куда человек попал и что от него хотят.
// Показывается один раз — при первом запуске и после «начать заново».
// Игру часто открывают по присланной ссылке, без единого слова контекста,
// и без этого экрана первое, что видит человек, — двенадцать ползунков.
function showWelcome() {
  modal(`<h2>${t('welcomeTitle')}</h2>
    <p>${t('welcomeRole')}</p>
    <p class="funding-note">${t('welcomeTurn')}</p>
    <p class="funding-note">${t('welcomeGoal')}</p>
    <p class="funding-note">${t('welcomeTension')}</p>
    <p class="funding-note">${t('welcomeHint')}</p>`,
  [{ label: t('welcomeStart'), primary: true },
   { label: t('welcomeMore'), onClick: showHelp },
   // Переключатель языка в шапке накрыт модалкой, а именно здесь язык и важен:
   // человек читает первый экран не на своём языке и переключить не может.
   { label: getLang() === 'ru' ? 'English' : 'Русский',
     onClick: () => { switchLang(); showWelcome(); } }]);
}

function showHelp() {
  modal(`<h2>${t('helpModalTitle')}</h2>${renderHelpTab()}`
    + `<p class="funding-note">${t('helpAuthor')} ${APP_VERSION === 'dev'
        ? t('helpVersionDev') : t('helpVersion', { version: APP_VERSION })}</p>`,
  [{ label: t('helpModalOk'), primary: true }]);
}

// ----------------------------------------------------------------------------
// Отрисовка целиком
// ----------------------------------------------------------------------------
function renderAll() {
  el('brand-title').textContent = t('brand');
  el('brand-sub').textContent = t('brandSub');
  el('title-levers').textContent = t('titleLevers');
  el('title-board').textContent = t('boardPanel');
  el('title-funding').textContent = t('fundingTitle');
  el('title-dynamics').textContent = t('chartMarket');
  el('btn-lang').textContent = getLang() === 'ru' ? 'RU' : 'EN';
  el('btn-restart').textContent = t('restartYes');
  el('btn-next').textContent = state.over
    ? t('btnResults') : t('btnNext', { month: state.month + 1 });

  buildLevers();
  syncLevers();
  renderKpis();
  renderBoard();
  renderFunding();
  renderReport();
  renderEvent();
  renderCrisis();
  renderExclusive();
  renderTurn();
  renderChannels();
  renderSupply();
  renderRival();
  renderChart();
  renderRightTab();
}

function switchLang() {
  setLang(getLang() === 'ru' ? 'en' : 'ru');
  leversBuilt = false;
  renderAll();
}

// Экран отказа вместо пустой страницы. Игру открывают одним файлом на чужой
// машине, где не посмотришь консоль: если что-то падает, человек должен увидеть
// текст ошибки и кнопку «начать заново», а не белое поле.
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
    // Испорченное сохранение — самая частая причина. Пробуем ещё раз с нуля,
    // и только если и это не помогло, показываем экран отказа.
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
  state = saved ?? createInitialState('bileton');
  state.pendingInstall = state.pendingInstall ?? [];

  // Обработчики вешаются один раз: init() может позвать boot() повторно после
  // сброса сохранения, и двойная подписка гоняла бы месяц по два раза за клик.
  if (!bound) {
    bound = true;
    bindJumps();
    el('btn-next').addEventListener('click', nextMonth);
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
