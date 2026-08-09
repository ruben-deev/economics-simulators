// ============================================================================
// Слой интерфейса «КИНОПОТОКА»: состояние партии, отрисовка, обработка ввода.
// Вся экономика живёт в src/model — здесь только показ и управление.
// Текст берётся из src/strings.js через t() и tx().
// ============================================================================

import { CONFIG, SEGMENTS, GENRES, LEVERS, ALGORITHMS } from '../model/config.js';
import { RIVAL_RELEASES, rivalEffect, seasonOf } from '../model/market.js';
import { eventById } from '../model/events.js';
import {
  createInitialState, step, explain, unitEconomics, valuation, fundingOffer, raise,
  finalScore, algoQuality, dataLevel, rndLevel, algorithmImpact,
  segmentById, genreById, projectCost, catalogDepth, catalogFreshness,
} from '../model/engine.js';
import { drawLineChart, legendHtml, PALETTE } from '../../../../shared/charts.js';
import { money, moneyExact, num, pct, signedPct, compact, axisNum } from '../../../../shared/format.js';
import { t, tx, getLang, setLang, detectLang, setStrings } from '../../../../shared/i18n.js';
import { STRINGS } from '../strings.js';

const SAVE_KEY = 'kinopotok-save-v1';
const el = (id) => document.getElementById(id);

let state = null;
let chartTab = 'subs';
let rightTab = 'unit';
let leversBuilt = false;

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* приватный режим */ }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.segments && Array.isArray(s.history) ? s : null;
  } catch { return null; }
}

const last = () => state.history[state.history.length - 1] ?? null;
const prev = () => state.history[state.history.length - 2] ?? null;
const algoByKey = (key) => ALGORITHMS.find((a) => a.key === key);
const rivalName = (type) => t(`rival${type.charAt(0).toUpperCase()}${type.slice(1)}`);
const seasonName = (season) => t(`season${season.charAt(0).toUpperCase()}${season.slice(1)}`);

// ----------------------------------------------------------------------------
// KPI
// ----------------------------------------------------------------------------
function kpi(label, value, sub, cls = 'neutral') {
  return `<div class="kpi"><div class="k-label">${label}</div>
    <div class="k-value">${value}</div><div class="k-delta ${cls}">${sub ?? ''}</div></div>`;
}

function delta(cur, before) {
  if (!Number.isFinite(cur) || !Number.isFinite(before) || before === 0) return ['', 'neutral'];
  const d = cur / before - 1;
  return [signedPct(d), d > 0.001 ? 'up' : d < -0.001 ? 'down' : 'neutral'];
}

function renderKpis() {
  const r = last();
  const p = prev();
  const burn = r ? r.fixed + r.oneOff - r.contribution : 0;
  const runway = burn > 0 ? state.cash / burn : Infinity;

  const parts = [
    kpi(t('kpiMonth'), `${state.month} / ${CONFIG.monthsTotal}`,
      state.pendingEvent ? t('kpiMonthEvent') : t('kpiMonthCalm')),
    kpi(t('kpiCash'), money(state.cash),
      state.cash < 0 ? t('kpiCashOut')
        : Number.isFinite(runway) ? t('kpiRunway', { months: runway.toFixed(0) })
        : t('kpiProfitable'),
      state.cash < 0 ? 'down' : runway < 5 ? 'down' : runway < 12 ? 'neutral' : 'up'),
  ];

  if (r) {
    const [dSubs, cSubs] = delta(r.subs, p?.subs);
    parts.push(
      kpi(t('kpiSubs'), compact(r.subs),
        t('kpiSubsSub', { premium: compact(r.premiumSubs), ads: compact(r.adSubs) }), cSubs || 'neutral'),
      kpi(t('kpiRevenue'), money(r.revenue), t('kpiRevenueSub', { value: `${num(r.arpu)} ₽` }), 'neutral'),
      kpi(t('kpiProfit'), money(r.profit), t('kpiProfitSub', { value: money(r.contribution) }),
        r.profit >= 0 ? 'up' : 'down'),
      kpi(t('kpiChurn'), pct(r.churnRate, 1),
        t('kpiChurnSub', { months: (1 / Math.max(0.005, r.churnRate)).toFixed(0) }),
        r.churnRate <= 0.05 ? 'up' : r.churnRate <= 0.09 ? 'neutral' : 'down'),
      kpi(t('kpiHours'), num(r.hoursPerSub, 1),
        t('kpiHoursSub', { value: money(r.cdnCost) }),
        'neutral'),
      kpi(t('kpiEquity'), money(r.equityValue ?? 0),
        t('kpiEquitySub', { value: pct(state.equity, 1) }), 'neutral'),
      kpi('', dSubs, '', cSubs),
    );
    parts.pop();
  } else {
    parts.push(kpi(t('kpiStart'), money(CONFIG.startCash), t('kpiStartSub'), 'up'));
  }
  el('kpis').innerHTML = parts.join('');
}

// ----------------------------------------------------------------------------
// Рычаги
// ----------------------------------------------------------------------------
function buildLevers() {
  el('levers').innerHTML = LEVERS.map((l) => `
    <div class="lever" data-key="${l.key}">
      <div class="lever-head">
        <span class="lever-label">${tx(l.label)}</span>
        <span class="lever-value" id="val-${l.key}"></span>
      </div>
      <input type="range" id="in-${l.key}" min="${l.min}" max="${l.max}" step="${l.step}" />
      <button class="lever-why" type="button">${t('leverWhy')}</button>
      <div class="lever-tip">${tx(l.tip)}</div>
    </div>`).join('');

  for (const l of LEVERS) {
    el(`in-${l.key}`).addEventListener('input', (e) => {
      state.decisions[l.key] = Number(e.target.value) * (l.scale ?? 1);
      syncLevers();
      renderOpsReadout();
      renderRightTab();
      save();
    });
  }
  el('levers').querySelectorAll('.lever-why').forEach((b) => {
    b.addEventListener('click', () => b.closest('.lever').classList.toggle('open'));
  });
  leversBuilt = true;
}

function leverDisplay(l, raw) {
  const unit = tx(l.unit);
  if (l.key === 'licensing' || l.key === 'originals' || l.key === 'marketing'
      || l.key === 'tech' || l.key === 'rnd') return money(raw);
  return `${num(raw)} ${unit}`;
}

function syncLevers() {
  for (const l of LEVERS) {
    const raw = state.decisions[l.key] / (l.scale ?? 1);
    const input = el(`in-${l.key}`);
    if (input) input.value = String(raw);
    el(`val-${l.key}`).textContent = leverDisplay(l, raw);
  }
}

// Живая проверка: что происходит с каталогом и с экономикой подписчика
function renderOpsReadout() {
  const u = unitEconomics(state, state.decisions);
  const catalogHours = state.catalogLicensed + state.catalogOriginal;
  const effective = state.catalogLicensed * CONFIG.licenseDepthWeight
    + state.catalogOriginal * CONFIG.originalDepthWeight;
  const boughtHours = state.decisions.licensing / CONFIG.licenseCostPerHour;

  el('ops-readout').innerHTML = `<div class="hint-box" style="margin-bottom:12px">
    <div>${t('opsCatalog', {
      hours: compact(catalogHours), licensed: compact(state.catalogLicensed),
      original: compact(state.catalogOriginal),
      depth: catalogDepth(effective).toFixed(2),
      fresh: catalogFreshness(state.freshHours).toFixed(2),
    })}</div>
    <div>${t('opsLicensing', {
      hours: num(boughtHours), decay: compact(state.catalogLicensed * CONFIG.licenseDecay),
    })}</div>
    <div>${t('opsUnitCheck', {
      arpu: `${num(u.revenue)} ₽`, cost: `${num(u.variable)} ₽`,
      cm: `${num(u.contribution)} ₽`, cls: u.contribution >= 0 ? 'pos' : 'neg',
    })}</div>
    <div>${t('opsAdShare', { share: pct(u.adShare, 0) })}</div>
  </div>`;
}

// ----------------------------------------------------------------------------
// Студия: жанр и конвейер
// ----------------------------------------------------------------------------
function renderStudio() {
  const current = state.decisions.genre;
  const cards = GENRES.map((g) => {
    const on = g.id === current;
    return `<div class="district ${on ? 'active' : ''}" data-genre="${g.id}">
      <div class="district-head">
        <span class="district-name">${tx(g.name)}</span>
        <span class="badge ${on ? 'on' : ''}">${money(projectCost(g))}</span>
      </div>
      <div class="district-meta">${t('genreHours', { hours: g.hours })} · ${tx(g.hint)}</div>
    </div>`;
  }).join('');

  const genre = genreById(current) ?? GENRES[0];
  const pipeline = state.pipeline ?? [];
  const pipelineText = pipeline.length
    ? t('studioPipeline', {
        list: pipeline
          .sort((a, b) => a.monthsLeft - b.monthsLeft)
          .map((p) => t('studioPipelineItem', {
            genre: tx(genreById(p.genre)?.name), months: p.monthsLeft,
          })).join(', '),
      })
    : `<span class="neg">${t('studioPipelineEmpty')}</span>`;

  el('studio').innerHTML = `
    <div class="hint-box" style="margin-bottom:10px">
      <div>${t('studioFund', { fund: money(state.studioFund ?? 0), cost: money(projectCost(genre)) })}</div>
      <div>${pipelineText}</div>
      <div class="funding-note" style="margin-top:6px">${t('studioLag')}</div>
    </div>
    <div class="districts">${cards}</div>`;

  el('studio').querySelectorAll('[data-genre]').forEach((node) => {
    node.addEventListener('click', () => {
      state.decisions.genre = node.dataset.genre;
      renderStudio();
      renderOpsReadout();
      save();
    });
  });
}

// ----------------------------------------------------------------------------
// Афиша конкурента
// ----------------------------------------------------------------------------
function rivalCard(type, when, cls = '') {
  const fx = rivalEffect(type, 0);
  const effects = type === 'none'
    ? t('rivalNoEffect')
    : t('rivalEffects', {
        acq: signedPct(fx.acquisitionMult - 1, 0),
        churn: (fx.churnAdd * 100).toFixed(1),
        hours: signedPct(fx.hoursMult - 1, 0),
      });
  return `<div class="${cls}">
    <span class="weather-icon">${RIVAL_RELEASES[type]?.icon ?? '·'}</span>
    <span class="weather-body">
      <span class="weather-when">${when}</span>
      <div class="weather-name">${rivalName(type)}</div>
      <div class="weather-fx">${effects}</div>
    </span>
  </div>`;
}

function renderRival() {
  if (state.over) { el('rival-slot').innerHTML = ''; return; }
  const now = state.rival ?? 'none';
  const next = state.rivalNext ?? 'none';
  const alarm = (RIVAL_RELEASES[next]?.pull ?? 0) >= 0.7;

  el('rival-slot').innerHTML = `<div class="panel">
    <h2 class="panel-title">${t('rivalPanel', {
      season: seasonName(seasonOf(state.month + 1)), month: state.month + 1,
    })}</h2>
    <div class="weather">
      ${rivalCard(now, t('rivalNow'), 'weather-now')}
      ${rivalCard(next, t('rivalNext'), `weather-next ${alarm ? 'alarm' : ''}`)}
      ${alarm ? `<div class="funding-note" style="flex-basis:100%">${t('rivalAdvice')}</div>` : ''}
    </div>
  </div>`;
}

// ----------------------------------------------------------------------------
// Алгоритмы
// ----------------------------------------------------------------------------
function qualityBar(name, value, hint) {
  return `<div class="quality-row">
    <span class="q-name" title="${hint}">${name}</span>
    <span class="q-bar"><span class="q-fill" style="width:${Math.min(100, value * 100).toFixed(0)}%"></span></span>
    <span class="q-val">${pct(value, 0)}</span>
  </div>`;
}

function renderAlgos() {
  const q = algoQuality(state);
  const head = `<div class="quality-box">
    ${qualityBar(t('algoData'), dataLevel(state), t('algoDataHint'))}
    ${qualityBar(t('algoTeam'), rndLevel(state), t('algoTeamHint'))}
    ${qualityBar(t('algoQuality'), q, t('algoQualityHint'))}
    <div class="funding-note">${t('algoIntro')}</div>
  </div>`;

  const cards = ALGORITHMS.map((a) => {
    const installed = Boolean(state.installed?.[a.key]);
    const unlocked = installed || q >= a.unlock;
    const on = Boolean(state.decisions.algoOn?.[a.key]);
    const raw = (state.decisions.algoParam?.[a.key] ?? a.param.def * (a.param.scale ?? 1)) / (a.param.scale ?? 1);

    const badge = installed
      ? `<span class="badge on">${t('algoInstalled')}</span>`
      : unlocked
        ? `<span class="badge">${t('algoInstallCost', { cost: money(a.install) })}</span>`
        : `<span class="badge">${t('algoNeedQuality', { value: pct(a.unlock, 0) })}</span>`;

    const slider = installed && on ? `<div class="algo-param">
        <div class="algo-param-head"><span>${tx(a.param.label)}</span><b>${raw}${tx(a.param.unit)}</b></div>
        <input type="range" data-algo-param="${a.key}"
          min="${a.param.min}" max="${a.param.max}" step="${a.param.step}" value="${raw}" />
      </div>` : '';

    const pending = on && !installed && unlocked
      ? `<div class="algo-tradeoff">${t('algoPending', { cost: money(a.install) })}</div>` : '';

    return `<div class="algo ${!unlocked ? 'locked' : ''} ${on && installed ? 'on' : ''}">
      <div class="algo-head">
        <label class="algo-title">
          <input type="checkbox" data-algo="${a.key}" ${on ? 'checked' : ''} ${unlocked ? '' : 'disabled'} />
          ${tx(a.name)}
        </label>
        ${badge}
      </div>
      <div class="algo-what">${tx(a.what)}</div>
      ${slider}
      ${installed && on ? `<div class="algo-tradeoff">${tx(a.tradeoff)}</div>` : pending}
    </div>`;
  }).join('');

  el('algos').innerHTML = head + cards;

  el('algos').querySelectorAll('[data-algo]').forEach((box) => {
    box.addEventListener('change', () => {
      state.decisions.algoOn = { ...state.decisions.algoOn, [box.dataset.algo]: box.checked };
      renderAlgos(); renderOpsReadout(); renderRightTab(); save();
    });
  });
  el('algos').querySelectorAll('[data-algo-param]').forEach((input) => {
    input.addEventListener('input', () => {
      const a = algoByKey(input.dataset.algoParam);
      state.decisions.algoParam = {
        ...state.decisions.algoParam,
        [a.key]: Number(input.value) * (a.param.scale ?? 1),
      };
      const head = input.parentElement.querySelector('b');
      if (head) head.textContent = `${input.value}${tx(a.param.unit)}`;
      renderOpsReadout(); renderRightTab(); save();
    });
  });
}

// ----------------------------------------------------------------------------
// Финансирование
// ----------------------------------------------------------------------------
function renderFunding() {
  const canRaise = state.month >= CONFIG.minMonthForFunding && !state.over;
  const v = valuation(state);
  const rows = CONFIG.fundingOptions.map((amount) => {
    const o = fundingOffer(state, amount);
    return `<div class="funding-row">
      <div><div><b>${money(amount)}</b></div>
        <div class="funding-note">${t('fundingDilution', {
          dilution: pct(o.dilution, 1), equity: pct(o.newEquity, 1) })}</div></div>
      <button class="btn small" data-raise="${amount}" ${canRaise ? '' : 'disabled'}>${t('fundingTake')}</button>
    </div>`;
  }).join('');

  el('funding').innerHTML = `
    <div class="funding-note">${t('fundingHead', {
      valuation: money(v), equity: pct(state.equity, 1), raised: money(state.raisedTotal) })}</div>
    ${rows}
    <div class="funding-note">${t('fundingNote')}
      ${state.month < CONFIG.minMonthForFunding
        ? t('fundingLocked', { month: CONFIG.minMonthForFunding }) : ''}</div>`;

  el('funding').querySelectorAll('[data-raise]').forEach((b) => {
    b.addEventListener('click', () => {
      const amount = Number(b.dataset.raise);
      const { state: next, offer } = raise(state, amount);
      state = next; save(); renderAll();
      toast(t('fundingDone', { amount: money(amount), dilution: pct(offer.dilution, 1) }));
    });
  });
}

// ----------------------------------------------------------------------------
// Событие
// ----------------------------------------------------------------------------
function renderEvent() {
  const ev = state.pendingEvent;
  if (!ev || state.over) { el('event-slot').innerHTML = ''; return; }

  const options = ev.options
    ? `<div class="event-options">${ev.options.map((o, i) => `
        <button class="event-option ${state.pendingChoice === i ? 'selected' : ''}" data-choice="${i}">
          <b>${tx(o.label)}</b><span>${tx(o.detail)}</span></button>`).join('')}</div>`
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
      renderEvent(); save();
    });
  });
}

// ----------------------------------------------------------------------------
// Отчёт месяца
// ----------------------------------------------------------------------------
function stat(label, value, sub) {
  return `<div class="stat"><div class="s-label">${label}</div>
    <div class="s-value">${value}</div><div class="s-sub">${sub ?? ''}</div></div>`;
}

function buildAlerts(r) {
  const alerts = [];
  const burn = r.fixed + r.oneOff - r.contribution;
  const runway = burn > 0 ? state.cash / burn : Infinity;

  if (r.depth < 0.35) {
    alerts.push(['bad', t('alertNoCatalog', { depth: r.depth.toFixed(2) })]);
  }
  if (r.freshness < 0.6 && r.subs > 1000) {
    alerts.push(['warn', t('alertStale', { fresh: r.freshness.toFixed(2), lost: compact(r.lostSubs) })]);
  }
  if (!r.pipeline.length) {
    alerts.push(['bad', t('alertNoPipeline')]);
  }
  if (r.cmPerSub < 0) {
    alerts.push(['bad', t('alertNegativeCm', { value: `${num(r.cmPerSub)} ₽` })]);
  } else if (r.revenue > 0 && r.cdnCost / r.revenue > 0.30) {
    alerts.push(['warn', t('alertTrafficHeavy', {
      share: pct(r.cdnCost / r.revenue, 0), cost: money(r.cdnCost),
      hours: num(r.hoursPerSub, 1), bitrate: num(r.decisions.bitrate),
    })]);
  }
  if (r.cmPerSub > 0 && r.profit < 0) {
    alerts.push(['warn', t('alertBreakEven', {
      cm: `${num(r.cmPerSub)} ₽`, fixed: money(r.fixed), subs: compact(r.fixed / r.cmPerSub),
    })]);
  }
  if (runway < 5 && state.cash >= 0) {
    alerts.push(['bad', t('alertRunway', { months: runway.toFixed(0), burn: money(burn) })]);
  }
  if (r.hangover > 0.4) {
    alerts.push(['warn', t('alertHangover', { churn: pct(r.churnRate, 1) })]);
  }
  if ((RIVAL_RELEASES[r.rivalNext]?.pull ?? 0) >= 0.7) {
    alerts.push(['warn', t('alertRivalAhead', {
      release: rivalName(r.rivalNext).toLowerCase(),
      acq: pct(rivalEffect(r.rivalNext, 0).acquisitionMult, 0),
    })]);
  }
  if (r.decisions.adLoad >= 8) {
    alerts.push(['warn', t('alertAdHeavy', {
      load: num(r.decisions.adLoad), revenue: money(r.adRevenue),
    })]);
  }
  if (Number.isFinite(r.ltvCac) && r.ltvCac !== null && r.cac > 0) {
    if (r.ltvCac < 1) alerts.push(['bad', t('alertLtvCacBad', { value: r.ltvCac.toFixed(2) })]);
    else if (r.ltvCac > 3) alerts.push(['good', t('alertLtvCacGood', { value: r.ltvCac.toFixed(2) })]);
  }
  const anyAlgoOn = Object.values(r.algoActive ?? {}).some(Boolean);
  if ((r.decisions.rnd ?? 0) > 0 && !anyAlgoOn) {
    alerts.push(['warn', t('alertRndIdle', {
      cost: money(r.decisions.rnd), quality: pct(r.algoQuality, 0) })]);
  }
  const ready = ALGORITHMS.filter((a) => !state.installed?.[a.key] && r.algoQuality >= a.unlock);
  if (ready.length) {
    alerts.push(['good', t('alertAlgosReady', {
      names: ready.map((a) => tx(a.name)).join(', '), quality: pct(r.algoQuality, 0) })]);
  }
  if (r.profit > 0) alerts.push(['good', t('alertProfit', { value: money(r.profit) })]);
  return alerts;
}

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

function renderReport() {
  const r = last();
  if (!r) { el('report-slot').innerHTML = renderStartHint(); return; }

  const drivers = explain(prev(), r);
  const maxAbs = Math.max(0.02, ...drivers.map((d) => Math.abs(d.effect)));
  const driversHtml = drivers.length ? `
    <div class="drivers">
      <div class="panel-title">${t('driversTitle', {
        delta: signedPct(r.subs / Math.max(1e-9, prev().subs) - 1) })}</div>
      ${drivers.slice(0, 6).map((d) => {
        const w = (Math.abs(d.effect) / maxAbs) * 50;
        const pos = d.effect > 0;
        return `<div class="driver">
          <span class="d-name">${t(d.key)}</span>
          <span class="d-bar"><span class="d-fill" style="${pos ? `left:50%;width:${w}%` : `right:50%;width:${w}%`};background:${pos ? 'var(--good)' : 'var(--bad)'}"></span></span>
          <span class="d-val ${pos ? 'pos' : 'neg'}">${signedPct(d.effect)}</span>
        </div>`;
      }).join('')}
    </div>` : '';

  const alerts = buildAlerts(r);
  const alertsHtml = alerts.length
    ? `<div class="alerts">${alerts.map(([k, text]) => `<div class="alert ${k}">${text}</div>`).join('')}</div>` : '';

  const ev = r.event ? eventById(r.event.id) : null;
  const eventNote = ev ? `<div class="lesson"><b>${tx(ev.title)}.</b> ${tx(ev.lesson)}</div>` : '';

  const premiereNote = r.premieres.length
    ? `<div class="alert good" style="margin-top:8px">${t('premiereNote', {
        list: r.premieres.map((p) => t('premiereItem', {
          genre: tx(genreById(p.genre)?.name), quality: p.quality.toFixed(2) })).join(', '),
      })}</div>` : '';
  const startedNote = r.started.length
    ? `<div class="alert warn" style="margin-top:8px">${t('startedNote', {
        list: r.started.map((p) => tx(genreById(p.genre)?.name)).join(', '),
        months: CONFIG.originalLeadMonths,
      })}</div>` : '';
  const installNote = r.installedNow?.length
    ? `<div class="alert good" style="margin-top:8px">${t('installNote', {
        names: r.installedNow.map((k) => tx(algoByKey(k)?.name)).join(', '),
        cost: money(r.installCost) })}</div>` : '';

  el('report-slot').innerHTML = `<div class="panel">
    <div class="report-head">
      <h3>${t('reportTitle', { month: r.month })}</h3>
      <span class="funding-note">${t('reportHeadStats', {
        revenue: money(r.revenue), subscription: money(r.subscriptionRevenue), ads: money(r.adRevenue) })}</span>
    </div>
    <div class="report-grid">
      ${stat(t('statSubs'), compact(r.subs), t('statSubsSub', {
        gained: compact(r.newSubs), lost: compact(r.lostSubs) }))}
      ${stat(t('statHours'), compact(r.hours), t('statHoursSub', { perSub: num(r.hoursPerSub, 1) }))}
      ${stat(t('statCatalog'), `${compact(r.catalogHours)} ${t('unitHours')}`, t('statCatalogSub', {
        original: compact(r.catalogOriginal), share: pct(r.originalShare, 0) }))}
      ${stat(t('statFresh'), `×${r.freshness.toFixed(2)}`, t('statFreshSub', { depth: r.depth.toFixed(2) }))}
      ${stat(t('statChurn'), pct(r.churnRate, 1), t('statChurnSub', { hangover: r.hangover.toFixed(2) }))}
      ${stat(t('statArpu'), `${num(r.arpu)} ₽`, t('statArpuSub', { value: `${num(r.cmPerSub)} ₽` }))}
      ${stat(t('statTraffic'), money(r.cdnCost), t('statTrafficSub', { perHour: num(r.cdnPerHour, 2) }))}
      ${stat(t('statProfit'), money(r.profit), t('statProfitSub', { value: money(r.fixed) }))}
      ${stat(t('statCacLtv'), r.cac > 0 ? `${num(r.cac)} ₽` : '—',
        r.ltvCac ? `LTV/CAC ${r.ltvCac.toFixed(2)}` : t('statCacOff'))}
    </div>
    ${premiereNote}${startedNote}${installNote}
    ${driversHtml}${alertsHtml}${eventNote}
  </div>`;
}

// ----------------------------------------------------------------------------
// Графики
// ----------------------------------------------------------------------------
const CHART_TABS = {
  subs: {
    label: 'chartSubs', caption: 'chartSubsCaption',
    series: (h) => [
      { label: t('seriesSubs'), data: h.map((r) => r.subs), color: PALETTE[1] },
      { label: t('seriesPremium'), data: h.map((r) => r.premiumSubs), color: PALETTE[0] },
      { label: t('seriesAds'), data: h.map((r) => r.adSubs), color: PALETTE[3] },
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
  catalog: {
    label: 'chartCatalog', caption: 'chartCatalogCaption',
    format: (v) => `${Math.round(v)}`,
    series: (h) => [
      { label: t('seriesLicensed'), data: h.map((r) => r.catalogLicensed), color: PALETTE[1] },
      { label: t('seriesOriginal'), data: h.map((r) => r.catalogOriginal), color: PALETTE[0] },
    ],
  },
  engagement: {
    label: 'chartEngagement', caption: 'chartEngagementCaption',
    format: (v) => `${Math.round(v)}`,
    series: (h) => [
      { label: t('seriesHoursPerSub'), data: h.map((r) => r.hoursPerSub), color: PALETTE[4] },
      { label: t('seriesChurn'), data: h.map((r) => r.churnRate * 100), color: PALETTE[2] },
    ],
  },
  unit: {
    label: 'chartUnit', caption: 'chartUnitCaption', zeroLine: true,
    format: (v) => `${Math.round(v)}`,
    series: (h) => [
      { label: t('seriesArpu'), data: h.map((r) => r.arpu), color: PALETTE[1] },
      { label: t('seriesCmPerSub'), data: h.map((r) => r.cmPerSub), color: PALETTE[0] },
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
      <thead><tr><th>${t('unitColItem')}</th><th>${t('unitColPerSub')}</th></tr></thead>
      <tbody>
        ${row(t('unitSubscription'), u.subscription, 'pos', true)}
        ${row(t('unitAdvertising'), u.advertising, 'pos', true)}
        <tr class="total"><td>${t('unitRevenue')}</td><td class="pos">${num(u.revenue)} ₽</td></tr>
        ${row(t('unitCdn', { hours: num(u.hoursPerSub, 1), perHour: num(u.cdnPerHour, 2) }), -u.cdn, 'neg', true)}
        ${row(t('unitSupport'), -u.support, 'neg', true)}
        <tr class="total"><td>${t('unitContribution')}</td>
          <td class="${u.contribution >= 0 ? 'pos' : 'neg'}">${num(u.contribution)} ₽</td></tr>
      </tbody>
    </table>
    <p class="funding-note" style="margin-top:10px">${t('unitNote')}</p>
    ${breakEven ? `<div class="hint-box" style="margin-top:10px">${t('unitBreakEven', {
      fixed: money(r.fixed), subs: compact(breakEven), current: compact(r.subs) })}</div>`
      : u.contribution <= 0 ? `<div class="hint-box" style="margin-top:10px">${t('unitNoBreakEven')}</div>` : ''}
    ${r ? `<h4 style="margin:14px 0 6px;font-size:13px">${t('unitAcquisition')}</h4>
    <table class="data"><tbody>
      <tr><td>${t('unitCac')}</td><td>${r.cac > 0 ? `${num(r.cac)} ₽` : '—'}</td></tr>
      <tr><td>${t('unitLifetime')}</td><td>${t('unitLifetimeValue', {
        value: (1 / Math.max(0.005, r.churnRate)).toFixed(1) })}</td></tr>
      <tr><td>${t('unitLtv')}</td><td>${num(r.ltv)} ₽</td></tr>
      <tr class="total"><td>LTV / CAC</td><td class="${(r.ltvCac ?? 0) >= 3 ? 'pos' : (r.ltvCac ?? 0) < 1 ? 'neg' : ''}">${r.ltvCac ? r.ltvCac.toFixed(2) : '—'}</td></tr>
    </tbody></table>
    <p class="funding-note">${t('unitLtvCacNote')}</p>` : ''}`;
}

function renderPnlTab() {
  const r = last();
  if (!r) return `<p class="funding-note">${t('pnlEmpty')}</p>`;
  const line = (name, v, cls = '', sub = false) =>
    `<tr class="${sub ? 'sub' : ''}"><td>${name}</td><td class="${cls}">${moneyExact(v)}</td></tr>`;
  return `
    <table class="data"><tbody>
      ${line(t('pnlSubscription'), r.subscriptionRevenue, 'pos', true)}
      ${line(t('pnlAds'), r.adRevenue, 'pos', true)}
      <tr class="total"><td>${t('pnlRevenue')}</td><td class="pos">${moneyExact(r.revenue)}</td></tr>
      ${line(t('pnlCdn'), -r.cdnCost, 'neg', true)}
      ${line(t('pnlSupport'), -r.supportCost, 'neg', true)}
      ${r.winbackCost > 0 ? line(t('pnlWinback'), -r.winbackCost, 'neg', true) : ''}
      <tr class="total"><td>${t('pnlContribution')}</td>
        <td class="${r.contribution >= 0 ? 'pos' : 'neg'}">${moneyExact(r.contribution)}</td></tr>
      ${line(t('pnlLicensing'), -r.decisions.licensing, 'neg', true)}
      ${line(t('pnlOriginals'), -r.decisions.originals, 'neg', true)}
      ${line(t('pnlMarketing'), -r.decisions.marketing, 'neg', true)}
      ${line(t('pnlTech'), -r.decisions.tech, 'neg', true)}
      ${line(t('pnlRnd'), -r.decisions.rnd, 'neg', true)}
      ${line(t('pnlHq'), -CONFIG.hqMonthly, 'neg', true)}
      <tr class="total"><td>${t('pnlOperatingProfit')}</td>
        <td class="${r.profit >= 0 ? 'pos' : 'neg'}">${moneyExact(r.profit)}</td></tr>
      ${r.oneOff > 0 ? line(t('pnlOneOff'), -r.oneOff, 'neg', true) : ''}
      <tr class="total"><td>${t('pnlCashChange')}</td>
        <td class="${(r.profit - r.oneOff) >= 0 ? 'pos' : 'neg'}">${moneyExact(r.profit - r.oneOff)}</td></tr>
    </tbody></table>
    <p class="funding-note" style="margin-top:10px">${t('pnlNote')}</p>`;
}

function renderSegmentsTab() {
  const r = last();
  if (!r || !r.segments.length) return `<p class="funding-note">${t('segmentsEmpty')}</p>`;
  const name = (s) => tx(segmentById(s.id)?.name);
  return `
    <table class="data">
      <thead><tr><th>${t('colSegment')}</th><th>${t('colSubs')}</th><th>${t('colAdShare')}</th><th>${t('colChurn')}</th><th>${t('colArpu')}</th></tr></thead>
      <tbody>${r.segments.map((s) => `<tr>
        <td>${name(s)}</td><td>${compact(s.subs)}</td><td>${pct(s.ads / Math.max(1, s.subs), 0)}</td>
        <td class="${s.churnRate <= 0.06 ? 'pos' : 'neg'}">${pct(s.churnRate, 1)}</td>
        <td>${num(s.arpu)} ₽</td></tr>`).join('')}</tbody>
    </table>
    <table class="data" style="margin-top:10px">
      <thead><tr><th>${t('colSegment')}</th><th>${t('colPenetration')}</th><th>${t('colPriceFactor')}</th><th>${t('colAppeal')}</th><th>${t('colAdPenalty')}</th></tr></thead>
      <tbody>${r.segments.map((s) => `<tr>
        <td>${name(s)}</td><td>${pct(s.penetration, 1)}</td>
        <td class="${s.priceFactor >= 1 ? 'pos' : 'neg'}">${s.priceFactor.toFixed(2)}</td>
        <td class="${s.appeal >= 1 ? 'pos' : 'neg'}">${s.appeal.toFixed(2)}</td>
        <td class="${s.adPenalty >= 0.95 ? 'pos' : 'neg'}">${s.adPenalty.toFixed(2)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="funding-note">${t('segmentsNote')}</p>`;
}

function renderAlgosTab() {
  const r = last();
  const q = algoQuality(state);
  const impact = r ? algorithmImpact(state) : [];
  const totalGain = impact.reduce((sum, i) => sum + i.profit, 0);
  const rndSpend = state.decisions.rnd ?? 0;

  const table = impact.length ? `
    <table class="data">
      <thead><tr><th>${t('algosColName')}</th><th>${t('algosColProfit')}</th><th>${t('algosColSubs')}</th><th>${t('algosColHours')}</th></tr></thead>
      <tbody>
        ${impact.map((i) => `<tr>
          <td>${tx(algoByKey(i.key)?.name)}</td>
          <td class="${i.profit >= 0 ? 'pos' : 'neg'}">${i.profit >= 0 ? '+' : ''}${compact(i.profit)}</td>
          <td class="${i.subs >= 0 ? 'pos' : 'neg'}">${i.subs >= 0 ? '+' : ''}${compact(i.subs)}</td>
          <td class="${i.hours >= 0 ? 'pos' : 'neg'}">${i.hours >= 0 ? '+' : ''}${compact(i.hours)}</td>
        </tr>`).join('')}
        <tr class="total"><td>${t('algosTotal')}</td>
          <td class="${totalGain >= 0 ? 'pos' : 'neg'}">${totalGain >= 0 ? '+' : ''}${compact(totalGain)}</td><td colspan="2"></td></tr>
        <tr class="total"><td>${t('algosTeamCost')}</td><td class="neg">−${compact(rndSpend)}</td><td colspan="2"></td></tr>
        <tr class="total"><td>${t('algosNet')}</td>
          <td class="${totalGain - rndSpend >= 0 ? 'pos' : 'neg'}">${totalGain - rndSpend >= 0 ? '+' : ''}${compact(totalGain - rndSpend)}</td><td colspan="2"></td></tr>
      </tbody>
    </table>
    <p class="funding-note" style="margin-top:8px">${t('algosCounterfactual')}</p>`
    : `<p class="funding-note">${t('algosNone')}</p>`;

  const zero = impact.filter((i) => Math.abs(i.profit) < 1_000_000);
  const zeroNote = zero.length
    ? `<div class="hint-box" style="margin-top:10px">${t('algosZeroNote', {
        names: zero.map((i) => tx(algoByKey(i.key)?.name)).join(', ') })}</div>` : '';

  return `
    <p class="funding-note">${t('algosTabQuality', {
      quality: pct(q, 0), data: pct(dataLevel(state), 0), team: pct(rndLevel(state), 0) })}</p>
    ${table}${zeroNote}
    <h4 style="margin:14px 0 6px;font-size:13px">${t('algosVsSlider')}</h4>
    <p class="funding-note">${t('algosVsSliderText')}</p>
    ${ALGORITHMS.map((a) => `<div style="margin-top:10px">
      <b style="font-size:12px">${tx(a.name)}</b>
      <div class="funding-note">${tx(a.lesson)}</div></div>`).join('')}`;
}

function renderHelpTab() {
  return `<div class="help">
    <h4>${t('helpWhatTitle')}</h4><p>${t('helpWhatText')}</p>
    <h4>${t('helpCatalogTitle')}</h4>
    <div class="formula">${t('helpCatalogFormula')}</div>
    <p>${t('helpCatalogText')}</p>
    <h4>${t('helpMoneyTitle')}</h4><p>${t('helpMoneyText')}</p>
    <h4>${t('helpChurnTitle')}</h4>
    <ul>
      <li>${t('helpSpiralStale')}</li><li>${t('helpSpiralHangover')}</li>
      <li>${t('helpSpiralAds')}</li><li>${t('helpSpiralTraffic')}</li>
    </ul>
    <h4>${t('helpRivalTitle')}</h4><p>${t('helpRivalText')}</p>
    <h4>${t('helpAlgosTitle')}</h4><p>${t('helpAlgosText')}</p>
    <ul>${ALGORITHMS.map((a) => `<li><b>${tx(a.name)}.</b> ${tx(a.tradeoff)}</li>`).join('')}</ul>
    <h4>${t('helpScoreTitle')}</h4>
    <div class="formula">${t('helpScoreFormula')}</div>
    <p>${t('helpScoreText')}</p>
    <h4>${t('helpLimitsTitle')}</h4><p>${t('helpLimitsText')}</p>
  </div>`;
}

function renderRightTab() {
  el('tabs').querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === rightTab);
  });
  el('tab-content').innerHTML = {
    unit: renderUnitTab, pnl: renderPnlTab, algos: renderAlgosTab,
    segments: renderSegmentsTab, help: renderHelpTab,
  }[rightTab]();
}

// ----------------------------------------------------------------------------
// Модалки
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

function showGameOver() {
  const s = finalScore(state);
  const r = last();
  const grade = s.bankrupt ? t('gradeBankrupt')
    : s.equityValue > 8e10 ? t('gradeExcellent')
    : s.equityValue > 3e10 ? t('gradeSolid')
    : s.equityValue > 1e10 ? t('gradeSurvived') : t('gradeModest');

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
      <div class="stat"><div class="s-label">${t('scoreLibrary')}</div><div class="s-value">${compact(state.catalogOriginal)} ${t('unitHours')}</div></div>
      <div class="stat"><div class="s-label">${t('scoreGrade')}</div><div class="s-value">${grade}</div></div>
    </div>
    ${r ? `<p class="funding-note">${t('gameOverLastMonth', {
      subs: compact(r.subs), arpu: `${num(r.arpu)} ₽`,
      churn: pct(r.churnRate, 1), profit: money(r.profit) })}</p>` : ''}
    <div class="hint-box" style="margin-top:10px">${t('gameOverQuestions')}</div>`,
    [{ label: t('gameOverPlayAgain'), primary: true, onClick: () => restart() },
     { label: t('gameOverCharts'), onClick: () => {} }]);
}

function showHelp() {
  modal(`<h2>${t('helpModalTitle')}</h2>${renderHelpTab()}`, [{ label: t('helpModalOk'), primary: true }]);
}

// ----------------------------------------------------------------------------
// Ход игры
// ----------------------------------------------------------------------------
function nextMonth() {
  if (state.over) { showGameOver(); return; }
  const ev = state.pendingEvent;
  if (ev && ev.options && state.pendingChoice === null) { toast(t('eventChoiceNeeded')); return; }
  state = step(state, { decisions: state.decisions, eventChoice: state.pendingChoice ?? 0 }).state;
  save();
  renderAll();
  if (state.over) showGameOver();
}

function restart() {
  state = createInitialState(`kinopotok-${Math.floor(Math.random() * 1e6)}`);
  save();
  renderAll();
}

function renderChrome() {
  el('brand-title').textContent = t('brandTitle');
  el('brand-sub').textContent = t('brandSub');
  el('title-levers').textContent = t('panelLevers');
  el('title-studio').textContent = t('panelStudio');
  el('title-algos').textContent = t('panelAlgos');
  el('title-funding').textContent = t('panelFunding');
  el('title-dynamics').textContent = t('panelDynamics');
  el('btn-restart').textContent = t('btnRestart');
  el('btn-help').title = t('btnHelpTitle');
  el('btn-lang').textContent = t('langToggle');
  el('btn-lang').title = t('langTitle');
  el('btn-next').textContent = state.over ? t('btnResults') : t('btnNext', { month: state.month + 1 });
  for (const [tab, key] of Object.entries({
    unit: 'tabUnit', pnl: 'tabPnl', algos: 'tabAlgos', segments: 'tabSegments', help: 'tabHelp',
  })) {
    const node = el('tabs').querySelector(`[data-tab="${tab}"]`);
    if (node) node.textContent = t(key);
  }
}

function renderAll() {
  if (!leversBuilt) buildLevers();
  renderChrome();
  syncLevers();
  renderStudio();
  renderAlgos();
  renderOpsReadout();
  renderKpis();
  renderFunding();
  renderRival();
  renderEvent();
  renderReport();
  renderChart();
  renderRightTab();
}

function switchLang() {
  setLang(getLang() === 'ru' ? 'en' : 'ru');
  leversBuilt = false;
  renderAll();
}

export function init() {
  setStrings(STRINGS);
  setLang(detectLang());
  state = load() ?? createInitialState('kinopotok');

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

  renderAll();
}
