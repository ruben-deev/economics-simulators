// ============================================================================
// Слой интерфейса «КИНОРЕКИ»: состояние партии, отрисовка, обработка ввода.
// Вся экономика живёт в src/model — здесь только показ и управление.
// Текст берётся из src/strings.js через t() и tx().
// ============================================================================

import { CONFIG, SEGMENTS, GENRES, LEVERS, LEVER_GROUPS, ALGORITHMS } from '../model/config.js';
import { RIVAL_RELEASES, rivalEffect, seasonOf } from '../model/market.js';
import { eventById } from '../model/events.js';
import { rivalSubs } from '../model/rival.js';
import { goalProgress } from '../model/board.js';
import { crisisById, resolutionCost, severityOf } from '../model/crises.js';
import { SCALES, scaleById, projectPrice, qualityEstimate, releaseBuzz } from '../model/slate.js';
import { PARTNERS, partnerById, partnerTotals } from '../model/partners.js';
import {
  createInitialState, step, explain, explainFactors, unitEconomics, valuation, fundingOffer, raise, clamp,
  finalScore, algoQuality, dataLevel, rndLevel, algorithmImpact, marketLiftOf, debrief,
  segmentById, genreById, projectCost, catalogDepth, catalogFreshness,
} from '../model/engine.js';
import { drawLineChart, legendHtml, PALETTE } from '../../../../shared/charts.js';
import { money, moneyExact, num, pct, signedPct, compact, axisNum, amount, amountIn, isCurUnit, cash, curSymbol } from '../../../../shared/format.js';
import { t, tx, getLang, setLang, detectLang, setStrings } from '../../../../shared/i18n.js';
import { watchTables } from '../../../../shared/tables.js';
import { watchSliders } from '../../../../shared/sliders.js';
import { resultString, addRecord, loadRecords, bestRecord } from '../../../../shared/records.js';
import {
  conglomerateUnlocked, TWIN_CITY_SEEDS, returnTarget, novogradBest,
  markProtocolChoice,
} from '../../../../shared/meta.js';
import { lbMount, lbEndpoint } from '../../../../shared/leaderboard.js';
import {
  DIFFICULTIES, difficultyById, currentDifficulty, setDifficulty, taggedGame,
} from '../../../../shared/difficulty.js';
import { policyHtml, syncPolicy, renderBudgetBar } from '../../../../shared/controls.js';
import { STRINGS } from '../strings.js';

const SAVE_KEY = 'kinoreka-save-v1';
const RECORDS_KEY = 'kinoreka-records';
const GAME_TAG = 'КИНОРЕКА';
// Метка сборки: меняется вместе с полями модели. Сохранение с чужой меткой
// не читается — см. load().
const BUILD = 'cinema-2';
// Версию проставляет сборщик. У модульной версии метки нет — значит это
// исходники, а не раздаваемый файл. Нужна, чтобы на вопрос «какая у вас
// сборка» был ответ, а не догадки.
const APP_VERSION = document.querySelector('meta[name="app-version"]')?.content ?? 'dev';
const APP_BUILD_DATE = document.querySelector('meta[name="app-build-date"]')?.content ?? '';
const el = (id) => document.getElementById(id);

// Цель Яндекс.Метрики. Работает только на сайте: счётчик подключает
// страница-обёртка (блок only-modular), в раздаваемом однофайловом HTML
// window.__metrikaId нет — и вызов молча ничего не делает.
function track(goal) {
  try {
    if (window.__metrikaId && window.ym) window.ym(window.__metrikaId, 'reachGoal', goal);
  } catch { /* аналитика не должна мешать игре */ }
}


let state = null;
let chartTab = 'war';
let rightTab = 'unit';
let leversBuilt = false;
let leversDiff = null;
let pendingCrisisChoice = null;   // выбранный способ решения кризиса на этот ход
let pendingCommission = [];       // проекты, запускаемые в этом ходу
let pendingRelease = {};          // id готового проекта -> бюджет кампании
let pendingRaise = false;         // перевести действующую базу на текущий прайс
let openGroups = { money: true, growth: true, infra: false };
let commissionDraft = { genre: 'drama', scale: 'season', segment: null };
// Совместный проект, предложенный в этом ходу: как и обычный заказ, он
// уходит в модель на следующем ходе, а не мгновенно.
let pendingJoint = null;
let pendingPartner = null;        // 'accept' | 'decline'
let bound = false;                // обработчики уже навешаны

const clearActions = () => {
  pendingCommission = [];
  pendingJoint = null;
  pendingRelease = {};
  pendingRaise = false;
  pendingCrisisChoice = null;
  pendingPartner = null;
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
    // а причина невидима. Лучше начать месяц заново, чем не начать вовсе.
    if (!saved || saved.build !== BUILD) return null;
    const s = saved.state;
    return s && s.segments && Array.isArray(s.history) ? s : null;
  } catch { return null; }
}
function dropSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* приватный режим */ }
}

const last = () => state.history[state.history.length - 1] ?? null;
const prev = () => state.history[state.history.length - 2] ?? null;
const algoByKey = (key) => ALGORITHMS.find((a) => a.key === key);
const rivalName = (type) => t(`rival${type.charAt(0).toUpperCase()}${type.slice(1)}`);
const stanceName = (id) => t(`stance${id.charAt(0).toUpperCase()}${id.slice(1)}`);
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

  // Пять показателей в одну строку. Всё остальное — в итогах месяца и вкладках:
  // шапка нужна, чтобы понять положение за секунду, а не чтобы изучать её.
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
    const [dSubs, cSubs] = delta(r.subs, p?.subs);
    parts.push(
      kpi(t('kpiSubs'), compact(r.subs), dSubs || t('kpiSubsFlat'), cSubs || 'neutral'),
      kpi(t('kpiShare'), pct(r.duopolyShare ?? 0, 0),
        t('kpiShareSub', { them: compact(r.rivalSubs ?? 0) }),
        (r.duopolyShare ?? 0) >= 0.5 ? 'up' : (r.duopolyShare ?? 0) >= 0.35 ? 'neutral' : 'down'),
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
// ----------------------------------------------------------------------------
// «Мультиплекс» и «Полка» КИНОРЕКИ
//
// Прежний зал раскрашивал кресла по сегментам зрителей, на которые нет
// помесячного рычага, а кресло стоило 20 тыс подписчиков — месячная динамика
// не читалась (пересборка визуала 2026-08, PROPOSALS-VIZ). Теперь схема
// показывает то, чем игрок управляет: два зала-тарифа в масштабе базы
// (площадь равна числу подписчиков), потоки месяца стрелками и зал
// конкурента в том же масштабе. Ниже — полка каталога: актив, который
// тает (лицензии) или растёт навсегда (оригиналы).
// ----------------------------------------------------------------------------
function renderStudioMap() {
  const box = el('map-slot');
  if (!box) return;
  const r = last();
  if (!r) { box.innerHTML = ''; return; }
  const narrow = (box.clientWidth || window.innerWidth) < 620;

  const premium = r.premiumSubs ?? 0;
  const ads = r.adSubs ?? 0;
  const rival = r.rivalSubs ?? 0;
  const W = narrow ? 360 : 700;
  const floor = narrow ? 148 : 168;
  const H = floor + (narrow ? 78 : 74);

  // Площадь зала пропорциональна базе: сторона растёт корнем, чтобы зал
  // конкурента в 20 раз больше не выдавливал ваши залы в точки
  const subsMax = Math.max(premium, ads, rival, 1);
  const areaMax = narrow ? 8200 : 19000;
  const hallDims = (subs) => {
    const a = areaMax * (subs / subsMax);
    const w = Math.max(30, Math.sqrt(a * 1.9));
    const h = Math.max(20, a / Math.max(1, w));
    return { w, h };
  };
  const dP = hallDims(premium);
  const dA = hallDims(ads);
  const dR = hallDims(rival);

  // Три колонки: премиум, рекламный, конкурент. Ваши залы прижаты влево,
  // конкурент — вправо; между рекламным и конкурентом живёт стрелка перетока.
  const xP = narrow ? 56 : 78;
  const xA = xP + dP.w + (narrow ? 78 : 64);
  const xR = W - dR.w - 10;
  const hall = (x, d, cls, stroke, fill) => `
    <g class="px ${cls}">
      ${d.h >= 46 ? `<path d="M ${x + 4} ${floor - d.h - 8} Q ${x + d.w / 2} ${floor - d.h - (narrow ? 14 : 20)} ${x + d.w - 4} ${floor - d.h - 8}"
        fill="none" stroke="var(--text)" stroke-opacity="0.4" stroke-width="4" stroke-linecap="round"></path>` : ''}
      <rect x="${x}" y="${floor - d.h}" width="${d.w}" height="${d.h}" rx="7"
        fill="${fill}" stroke="${stroke}"${cls === 'px-rival' ? ' stroke-dasharray="7 4"' : ''}></rect>
    </g>`;

  // Подписи под полом — не зависят от размера зала, читаются и на первом
  // месяце, когда собственные залы ещё крошечные
  const cap = (x, d, l1, l2, color) => `
    <g class="px ${l1[0] === '<' ? '' : ''}">
      <text x="${x + d.w / 2}" y="${floor + 16}" text-anchor="middle" font-size="11" fill="${color}" font-weight="700">${l1}</text>
      <text x="${x + d.w / 2}" y="${floor + 32}" text-anchor="middle" font-size="13" fill="var(--text)" font-weight="800">${l2}</text>
    </g>`;

  const premiumNew = r.premiumNew ?? 0;
  const adsNew = r.adsNew ?? 0;
  const downgraded = r.downgraded ?? 0;
  const lost = r.lostSubs ?? 0;
  const net = r.netSwitch ?? 0;

  // Стрелки потоков. Приток — зелёным снизу в зал, отток — красным вниз
  // слева от мультиплекса, переток от цены — золотым пунктиром, переток
  // рынка с конкурентом — по знаку месяца.
  const arrowV = (x, up, color, cls, dash = '') => `
    <g class="px ${cls}">
      <line x1="${x}" y1="${up ? floor + 3 : floor - 8}" x2="${x}" y2="${up ? floor - 8 : floor + 3}"
        stroke="${color}" stroke-width="4"${dash}></line>
      <path d="M ${x - 4} ${up ? floor - 6 : floor + 1} L ${x} ${up ? floor - 12 : floor + 7} L ${x + 4} ${up ? floor - 6 : floor + 1} z" fill="${color}"></path>
    </g>`;
  const yMid = floor - Math.max(14, Math.min(dP.h, dA.h) / 2);
  const downArrow = downgraded > 499 ? `
    <g class="px px-down">
      <line x1="${xP + dP.w + 3}" y1="${yMid}" x2="${xA - 9}" y2="${yMid}" stroke="var(--warn)" stroke-width="3" stroke-dasharray="6 4"></line>
      <path d="M ${xA - 9} ${yMid - 4} L ${xA - 3} ${yMid} L ${xA - 9} ${yMid + 4} z" fill="var(--warn)"></path>
      <text x="${(xP + dP.w + xA) / 2}" y="${yMid - 8}" text-anchor="middle" font-size="10" fill="var(--warn)">${t('plexDown', { n: compact(downgraded) })}</text>
    </g>` : '';
  const yNet = floor - Math.max(16, Math.min(dA.h, dR.h) / 2);
  const netX1 = xA + dA.w + 6;
  const netX2 = xR - 8;
  const netArrow = (Math.abs(net) > 499 && netX2 - netX1 > 34) ? `
    <g class="px px-net">
      <line x1="${net >= 0 ? netX2 : netX1}" y1="${yNet}" x2="${net >= 0 ? netX1 + 7 : netX2 - 7}" y2="${yNet}"
        stroke="${net >= 0 ? 'var(--good)' : 'var(--bad)'}" stroke-width="3"></line>
      <path d="M ${net >= 0 ? netX1 + 8 : netX2 - 8} ${yNet} l ${net >= 0 ? 7 : -7} -4 v 8 z" fill="${net >= 0 ? 'var(--good)' : 'var(--bad)'}"></path>
      <text x="${(netX1 + netX2) / 2}" y="${yNet - 8}" text-anchor="middle" font-size="10"
        fill="${net >= 0 ? 'var(--good)' : 'var(--bad)'}">${t('plexNet', { n: compact(Math.abs(net)) })}</text>
    </g>` : '';

  const flowLbl = (x, text, color, cls, row = 0) => `
    <text class="px ${cls}" x="${x}" y="${floor + (narrow ? 50 : 48) + row * 14}" text-anchor="middle" font-size="10" fill="${color}">${text}</text>`;

  const priceP = Math.round(state.decisions.priceNew);
  const priceA = Math.round(state.decisions.priceAds);

  const multiplexSvg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('flowTitle')}">
    ${hall(xP, dP, 'px-premium', 'rgba(251, 191, 36, 0.7)', 'rgba(251, 191, 36, 0.22)')}
    ${hall(xA, dA, 'px-ads', 'rgba(45, 212, 191, 0.7)', 'rgba(45, 212, 191, 0.18)')}
    ${hall(xR, dR, 'px-rival', 'rgba(148, 163, 184, 0.55)', 'var(--panel-2)')}
    <line x1="6" y1="${floor}" x2="${W - 6}" y2="${floor}" stroke="var(--line)"></line>
    ${cap(xP, dP, narrow ? t('plexPremiumShort') : t('plexPremium', { price: priceP }), compact(premium), 'var(--warn)')}
    ${cap(xA, dA, narrow ? t('plexAdsShort') : t('plexAds', { price: priceA }), compact(ads), '#2dd4bf')}
    ${cap(xR, dR, narrow ? t('plexRivalShort') : t('plexRival', { price: Math.round(r.rivalPrice ?? 0) }), compact(rival), 'var(--muted)')}
    ${arrowV(xP + dP.w * 0.35, true, 'var(--good)', 'px-in')}
    ${flowLbl(xP + dP.w * 0.35, '+' + compact(premiumNew), 'var(--good)', 'px-in')}
    ${arrowV(xA + dA.w * 0.4, true, 'var(--good)', 'px-in')}
    ${flowLbl(xA + dA.w * 0.4, '+' + compact(adsNew), 'var(--good)', 'px-in')}
    ${arrowV(xP - (narrow ? 26 : 40), false, 'var(--bad)', 'px-out')}
    ${flowLbl(xP - (narrow ? 26 : 40) + 14, '−' + compact(lost), 'var(--bad)', 'px-out', 1)}
    ${downArrow}
    ${netArrow}
  </svg>`;

  // --- Полка каталога: тающий актив против вечного ---
  const lic = r.catalogLicensed ?? 0;
  const orig = r.catalogOriginal ?? 0;
  const bought = r.licenseBought ?? 0;
  // Что истечёт за квартал при текущем темпе — красный край полки
  const expire3 = lic * (1 - Math.pow(1 - CONFIG.licenseDecay, 3));
  const sW = W;
  const barX = narrow ? 8 : 10;
  const barW = sW - barX - 10;
  const hoursMax = Math.max(lic + bought, orig, 1);
  const px = (h) => Math.max(h > 0 ? 3 : 0, barW * (h / hoursMax));
  const licW = px(lic);
  const expW = Math.min(licW, px(expire3));
  const boughtW = px(bought);
  const freshPct = clampNum(r.freshness ?? 0, 0, 1);
  const shelfSvg = `<svg viewBox="0 0 ${sW} 148" role="img" aria-label="${t('shelfTitle')}">
    <text x="${barX}" y="14" font-size="10" fill="var(--muted)">${t('shelfLicensed', { h: compact(lic) })}</text>
    <rect x="${barX}" y="20" width="${licW}" height="20" rx="4" fill="rgba(96, 165, 250, 0.4)" stroke="rgba(96, 165, 250, 0.5)"></rect>
    ${expW > 8 ? `<rect x="${barX + licW - expW}" y="20" width="${expW}" height="20" rx="4"
      fill="rgba(248, 113, 113, 0.35)" stroke="rgba(248, 113, 113, 0.6)" stroke-dasharray="4 3"></rect>` : ''}
    ${boughtW > 2 ? `<rect x="${barX + licW + 2}" y="20" width="${boughtW}" height="20" rx="4"
      fill="rgba(74, 222, 128, 0.4)" stroke="rgba(74, 222, 128, 0.7)"></rect>` : ''}
    <text x="${sW - 10}" y="52" text-anchor="end" font-size="10" fill="${bought > 0 ? 'var(--good)' : 'var(--bad)'}">${
      bought > 0 ? t('shelfBought', { h: compact(bought) }) : t('shelfNoBuy')}</text>
    ${expW > 8 && !narrow ? `<text x="${barX}" y="52" font-size="10" fill="var(--bad)">${t('shelfExpire', { h: compact(expire3) })}</text>` : ''}
    <text x="${barX}" y="82" font-size="10" fill="var(--muted)">${t('shelfOriginals', { h: compact(orig) })}</text>
    <rect x="${barX}" y="88" width="${px(orig)}" height="20" rx="4" fill="rgba(251, 191, 36, 0.35)" stroke="rgba(251, 191, 36, 0.6)"></rect>
    <text x="${barX}" y="134" font-size="10" fill="var(--muted)">${t('shelfFresh')}</text>
    <rect x="${barX + (narrow ? 72 : 80)}" y="125" width="${narrow ? 150 : 280}" height="11" rx="5" fill="rgba(148, 163, 184, 0.14)"></rect>
    <rect x="${barX + (narrow ? 72 : 80)}" y="125" width="${(narrow ? 150 : 280) * freshPct}" height="11" rx="5" fill="var(--good)" fill-opacity="0.75"></rect>
    <text x="${barX + (narrow ? 72 : 80) + (narrow ? 158 : 288)}" y="134" font-size="10" fill="var(--muted)">${narrow ? pct(freshPct, 0) : t('shelfFreshNote', { pct: pct(freshPct, 0) })}</text>
  </svg>`;

  const KEY_CHIPS = {
    premium: 'background:rgba(251,191,36,0.8)', ads: 'background:rgba(45,212,191,0.8)',
    rival: 'background:transparent;border:1.5px dashed var(--muted)',
    in: 'background:var(--good)', out: 'background:var(--bad)',
  };
  const legend = [
    ['premium', 'plexKeyPremium'], ['ads', 'plexKeyAds'], ['rival', 'plexKeyRival'],
    ['in', 'plexKeyIn'], ['out', 'plexKeyOut'],
  ].map(([k, key]) => `<span class="flow-key legend-item" data-hl="${k}" tabindex="0"><i style="${KEY_CHIPS[k]}"></i>${t(key)}</span>`).join('');

  box.innerHTML = `<div class="panel eco-map plex">
    <h2 class="panel-title">${t('flowTitle')}</h2>
    ${multiplexSvg}
    <div class="flow-legend map-legend">${legend}</div>
    <div class="chart-caption">${t('plexCaption')}</div>
    <div class="slate-label" style="margin-top:12px">${t('shelfTitle')}</div>
    ${shelfSvg}
    <div class="chart-caption">${t('shelfCaption')}</div>
  </div>`;

  // Подсветка с легенды: наведение или фокус гасит все группы, кроме своей
  const panel = box.querySelector('.plex');
  box.querySelectorAll('.legend-item[data-hl]').forEach((item) => {
    const on = () => { if (panel) panel.dataset.hl = item.dataset.hl; };
    const off = () => { if (panel) delete panel.dataset.hl; };
    item.addEventListener('mouseenter', on);
    item.addEventListener('mouseleave', off);
    item.addEventListener('focus', on);
    item.addEventListener('blur', off);
  });
}

// Числовой зажим для схем: shared clamp живёт в модели, а интерфейсу
// хватает трёх строк без лишнего импорта
function clampNum(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

// Полоса бюджета: куда уходят деньги этого месяца. Орган общий для набора
// (shared/controls.js); у стриминга статей больше, чем у холдинга, поэтому
// без неё расходы читались только построчно в P&L.
const BUDGET_COLORS = {
  content: PALETTE[1],
  studio: PALETTE[2],
  marketing: PALETTE[4],
  tech: PALETTE[0],
  fixed: '#64748b',
};

function renderBudget() {
  const box = el('budget-slot');
  if (!box) return;
  const d = state.decisions;
  const r = last();
  const items = [
    { key: 'content', label: t('budgetContent'), value: (d.licensing ?? 0) + (r?.productionSpend ?? 0), color: BUDGET_COLORS.content },
    { key: 'studio', label: t('budgetStudio'), value: r?.slotCost ?? 0, color: BUDGET_COLORS.studio },
    { key: 'marketing', label: t('budgetMarketing'), value: (d.brandMarketing ?? 0) + (r?.campaignSpend ?? 0), color: BUDGET_COLORS.marketing },
    { key: 'tech', label: t('budgetTech'), value: (d.tech ?? 0) + (d.rnd ?? 0) + (d.finance ?? 0), color: BUDGET_COLORS.tech },
    { key: 'fixed', label: t('budgetFixed'), value: CONFIG.hqMonthly + (r?.staffCost ?? 0) + (r?.techUpkeep ?? 0) + (r?.miscCost ?? 0), color: BUDGET_COLORS.fixed },
  ];
  const total = items.reduce((a, i) => a + i.value, 0);
  const contribution = r ? r.contribution : 0;
  const net = contribution - total;
  box.innerHTML = renderBudgetBar({
    title: t('budgetTitle', { total: money(total) }),
    items,
    money,
    note: r ? t('budgetNet', {
      contribution: money(contribution),
      net: (net >= 0 ? '+' : '') + money(net),
      cls: net >= 0 ? 'pos' : 'neg',
    }) : '',
  });
}

// Предвестник: рычаг стоит в панели, но прямо сейчас ни на что не влияет.
// Молча неработающий ползунок — худший вид обучения.
function inertNote(l) {
  const r = last();
  if (l.key === 'priceAds' && (r?.adSubs ?? 0) === 0) {
    return `<div class="policy-note">🔒 ${t('leverInertAds')}</div>`;
  }
  if (l.key === 'annualDiscount' && (r?.annualSubs ?? 0) === 0 && (state.decisions.annualDiscount ?? 0) === 0) {
    return `<div class="policy-note">🔒 ${t('leverInertAnnual')}</div>`;
  }
  return '';
}

function buildLevers() {
  // Рычаги сгруппированы, и группа «инфраструктура» свёрнута по умолчанию.
  // Эти четыре ползунка выставляются один раз и почти не трогаются — держать
  // их всё время на экране значит тратить внимание там, где решения нет.
  el('levers').innerHTML = LEVER_GROUPS.map((g) => {
    const items = LEVERS.filter((l) => l.group === g.id
      && !(l.key === 'finance' && difficultyById(state.difficulty).financeFree));
    if (!items.length) return '';
    return `<div class="lever-group ${openGroups[g.id] ? 'open' : ''}" data-group="${g.id}">
      <button class="lever-group-head" type="button">
        <span class="lg-caret">▾</span><span>${tx(g.label)}</span>
        <span class="lg-count">${items.length}</span>
      </button>
      <div class="lever-group-body">
        ${g.desc ? `<div class="funding-note" style="margin:2px 0 8px">${tx(g.desc)}</div>` : ''}
        <div id="readout-${g.id}"></div>
        ${items.map((l) => `
          <div class="lever" data-key="${l.key}">
            <div class="lever-head">
              <span class="lever-label">${tx(l.label)}</span>
              <span class="lever-value" id="val-${l.key}"></span>
            </div>
            ${inertNote(l)}
            ${l.policy ? policyHtml(l, tx) : ''}
            <input type="range" id="in-${l.key}" min="${l.min}" max="${l.max}" step="${l.step}" />
            <button class="lever-why" type="button">${t('leverWhy')}</button>
            <div class="lever-tip">${tx(l.tip)}</div>
            ${l.key === 'priceNew' ? '<div id="price-gap"></div>' : ''}
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');

  for (const l of LEVERS) {
    // Рычага может не быть в панели (на лёгком уровне финансовой команды
    // нет — она уже оплачена), тогда и слушать нечего
    const input = el(`in-${l.key}`);
    if (!input) continue;
    input.addEventListener('input', (e) => {
      state.decisions[l.key] = Number(e.target.value) * (l.scale ?? 1);
      syncLevers();
      renderPriceGap();
      renderOpsReadout();
      renderBudget();
      renderStudioMap();
      renderTurn();
      renderSlate();
      renderRightTab();
      save();
    });
  }
  // Режимы политики: кнопка ставит значение, ползунок остаётся для точной
  // настройки — кривые отклика у этой игры острые, дискретизация срезала бы
  // верх стратегии (см. shared/controls.js)
  el('levers').querySelectorAll('[data-policy] [data-policy-value]').forEach((b) => {
    b.addEventListener('click', () => {
      const key = b.closest('[data-policy]').dataset.policy;
      const lever = LEVERS.find((l) => l.key === key);
      if (!lever) return;
      state.decisions[key] = Number(b.dataset.policyValue) * (lever.scale ?? 1);
      syncLevers();
      renderPriceGap();
      renderOpsReadout();
      renderBudget();
      renderStudioMap();
      renderTurn();
      renderSlate();
      renderRightTab();
      save();
    });
  });
  el('levers').querySelectorAll('.lever-why').forEach((b) => {
    b.addEventListener('click', () => b.closest('.lever').classList.toggle('open'));
  });
  el('levers').querySelectorAll('.lever-group-head').forEach((b) => {
    b.addEventListener('click', () => {
      const box = b.closest('.lever-group');
      const id = box.dataset.group;
      openGroups[id] = !openGroups[id];
      box.classList.toggle('open', openGroups[id]);
    });
  });
  leversBuilt = true;
  leversDiff = state.difficulty;
}

const MONEY_LEVERS = new Set(['licensing', 'brandMarketing', 'tech', 'rnd']);

function leverDisplay(l, raw) {
  if (MONEY_LEVERS.has(l.key)) return money(raw);
  const unit = tx(l.unit);
  return isCurUnit(unit) ? amountIn(raw, unit) : `${num(raw)} ${unit}`;
}

// Разрыв между прайсом и тем, что платит база, — постоянный элемент,
// а не всплывающая подсказка. Это решение должно быть на виду всегда:
// иначе игрок узнаёт о нём случайно или не узнаёт вовсе.
function renderPriceGap() {
  const box = el('price-gap');
  if (!box) return;
  const r = last();
  if (!r) { box.innerHTML = `<div class="funding-note">${t('gapNoData')}</div>`; return; }

  const listPrice = state.decisions.priceNew;
  const paid = r.lockedPrice;
  // Разрыв может уйти и в минус: после снижения прайса действующая база
  // какое-то время платит больше нового ценника. Прятать этот случай за нулём
  // значило бы показывать «совпадает» там, где база переплачивает.
  const gap = clamp(1 - paid / Math.max(1, listPrice), -1, 1);
  const wide = Math.abs(gap) > 0.12;
  const wait = CONFIG.raiseCooldown - (state.month - (state.lastRaiseMonth ?? -99));
  const canRaise = wait <= 0 && listPrice > paid + 1;

  box.innerHTML = `<div class="gap-box ${wide ? 'wide' : ''}">
    <div class="gap-row">
      <span>${t('gapList')}</span><b>${amount(listPrice)}</b>
      <span class="gap-arrow">→</span>
      <span>${t('gapPaid')}</span><b class="${wide ? 'warn' : ''}">${amount(paid)}</b>
      <span class="gap-value ${wide ? (gap > 0 ? 'neg' : 'pos') : ''}">${
        Math.abs(gap) > 0.005 ? `${gap > 0 ? '−' : '+'}${pct(Math.abs(gap), 0)}` : t('gapNone')}</span>
    </div>
    <span class="q-bar"><span class="q-fill ${wide && gap > 0 ? '' : 'ok'}" style="width:${(clamp(1 - gap, 0, 1) * 100).toFixed(0)}%"></span></span>
    ${r.annualSubs > 0 ? `<div class="funding-note">${t('gapAnnual', { subs: compact(r.annualSubs) })}</div>` : ''}
    ${canRaise
      ? `<button class="btn ${pendingRaise ? 'primary' : 'ghost'} tiny" id="btn-raise">${
          pendingRaise ? t('todoPriceGapOn') : t('todoPriceGapDo')}</button>`
      : `<div class="funding-note">${wait > 0
          ? t('todoPriceGapCooldown', { months: wait })
          : (paid > listPrice + 1 ? t('gapAbove') : t('gapAligned'))}</div>`}
  </div>`;

  el('btn-raise')?.addEventListener('click', () => {
    pendingRaise = !pendingRaise;
    renderPriceGap();
    renderTurn();
  });
}

function syncLevers() {
  for (const l of LEVERS) {
    const raw = state.decisions[l.key] / (l.scale ?? 1);
    const input = el(`in-${l.key}`);
    if (input) input.value = String(raw);
    const out = el(`val-${l.key}`);
    if (out) out.textContent = leverDisplay(l, raw);
    if (l.policy) {
      syncPolicy(el('levers'), l, state.decisions[l.key], tx, t('policyCustom'));
    }
  }
}

// Живая проверка: что происходит с каталогом и с экономикой подписчика
function renderOpsReadout() {
  const u = unitEconomics(state, state.decisions);
  const catalogHours = state.catalogLicensed + state.catalogOriginal;
  const effective = state.catalogLicensed * CONFIG.licenseDepthWeight
    + state.catalogOriginal * CONFIG.originalDepthWeight;
  const idx = last()?.licenseIndex ?? 1;
  const boughtHours = state.decisions.licensing / (CONFIG.licenseCostPerHour * idx);

  // Сводки живут внутри своих групп: цифры про деньги — рядом с ценой,
  // цифры про полку — рядом с лицензиями. Одним блоком внизу колонки они
  // читались как сноска, а не как ответ на только что сдвинутый ползунок.
  const money = el('readout-money');
  if (money) {
    money.innerHTML = `<div class="hint-box" style="margin-bottom:10px">
      <div>${t('opsUnitCheck', {
        arpu: `${amount(u.revenue)}`, cost: `${amount(u.variable)}`,
        cm: `${amount(u.contribution)}`, cls: u.contribution >= 0 ? 'pos' : 'neg',
      })}</div>
      <div>${t('opsAdShare', { share: pct(u.adShare, 0) })}</div>
    </div>`;
  }
  const growth = el('readout-growth');
  if (growth) {
    growth.innerHTML = `<div class="hint-box" style="margin-bottom:10px">
      <div>${t('opsCatalog', {
        hours: compact(catalogHours), licensed: compact(state.catalogLicensed),
        original: compact(state.catalogOriginal),
        depth: catalogDepth(effective).toFixed(2),
        fresh: catalogFreshness(state.freshHours).toFixed(2),
      })}</div>
      <div>${t('opsLicensing', {
        hours: num(boughtHours), decay: compact(state.catalogLicensed * CONFIG.licenseDecay),
      })}</div>
    </div>`;
  }
  const ops = el('ops-readout');
  if (ops) ops.innerHTML = '';
}

// ----------------------------------------------------------------------------
// Студия: жанр и конвейер
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// Партнёрства: оптовый канал роста
// ----------------------------------------------------------------------------
function renderPartners() {
  if (state.over) { el('partner-slot').innerHTML = ''; return; }
  const deals = state.partners ?? [];
  const offerId = state.partnerOffer;
  const offer = offerId ? partnerById(offerId) : null;
  const r = last();

  if (!offer && !deals.length) { el('partner-slot').innerHTML = ''; return; }

  const price = state.decisions.priceNew;
  const dealRow = (d) => {
    const def = partnerById(d.id);
    if (!def) return '';
    return `<div class="deal ${d.monthsLeft <= 2 ? 'ending' : ''}">
      <div class="deal-head">
        <span class="deal-name">${tx(def.name)}</span>
        <span class="badge ${d.monthsLeft <= 2 ? 'warn' : ''}">${t('partnerMonthsLeft', { months: d.monthsLeft })}</span>
      </div>
      <div class="deal-meta">${t('partnerDealMeta', {
        subs: compact(d.subs), arpu: amount((d.price ?? price) * def.revenueShare),
        share: pct(def.revenueShare, 0),
      })}</div>
      ${(d.price ?? price) < price - 1
        ? `<div class="deal-meta warn">${t('partnerLockedRate', { signed: amount(d.price), list: amount(price) })}</div>` : ''}
      ${d.monthsLeft <= 2 ? `<div class="deal-meta neg">${t('partnerEnding')}</div>` : ''}
    </div>`;
  };

  const offerHtml = offer ? `<div class="offer">
    <div class="offer-head">
      <h3>🤝 ${tx(offer.name)}</h3>
      <span class="badge">${t('partnerTerm', { months: offer.months })}</span>
    </div>
    <p>${tx(offer.text)}</p>
    <div class="offer-terms">
      <span>${t('partnerReach', { reach: compact(offer.reach) })}</span>
      <span>${t('partnerShareOf', { share: pct(offer.revenueShare, 0), arpu: amount(price * offer.revenueShare) })}</span>
      <span>${t('partnerHours', { value: pct(offer.hoursMult, 0) })}</span>
      <span>${t('partnerChurnMult', { value: pct(offer.churnMult, 0) })}</span>
      ${offer.setupFee ? `<span class="neg">${t('partnerSetup', { fee: money(offer.setupFee) })}</span>` : ''}
      ${offer.monthlyFee ? `<span class="neg">${t('partnerMonthly', { fee: money(offer.monthlyFee) })}</span>` : ''}
      ${offer.exclusive ? `<span class="warn">${t('partnerExclusive')}</span>` : ''}
    </div>
    <div class="event-options">
      <button class="event-option ${pendingPartner === 'accept' ? 'chosen primary' : ''}" data-partner="accept">
        <span class="opt-label">${t('partnerSign')}</span>
        <span class="opt-detail">${t('partnerSignDetail', {
          subs: compact(offer.reach), arpu: amount(price * offer.revenueShare), retail: amount(price) })}</span>
      </button>
      <button class="event-option ${pendingPartner === 'decline' ? 'chosen' : ''}" data-partner="decline">
        <span class="opt-label">${t('partnerDecline')}</span>
        <span class="opt-detail">${t('partnerDeclineDetail')}</span>
      </button>
    </div>
    <div class="lesson">${tx(offer.lesson)}</div>
  </div>` : '';

  el('partner-slot').innerHTML = `<div class="panel">
    <div class="report-head">
      <h2 class="panel-title inline">${t('panelPartners')}</h2>
      ${r && r.partnerSubs > 0 ? `<span class="funding-note">${t('partnerSummary', {
        share: pct(r.partnerShare, 0), wholesale: amount(r.partnerArpu), retail: amount(r.retailArpu),
      })}</span>` : ''}
    </div>
    ${deals.length ? `<div class="deals">${deals.map(dealRow).join('')}</div>` : ''}
    ${offerHtml}
  </div>`;

  el('partner-slot').querySelectorAll('[data-partner]').forEach((b) => {
    b.addEventListener('click', () => { pendingPartner = b.dataset.partner; renderPartners(); renderTurn(); });
  });
}

// ----------------------------------------------------------------------------
// Навигация по подсказкам.
//
// В советах ключевые вещи выделены цветом. Раз они названы — по ним должно
// быть можно перейти к тому рычагу или блоку, о котором речь: читать совет
// и потом искать глазами нужный ползунок — лишняя работа.
//
// Разметка: <a class="jump" data-jump="lever:licensing">закупку лицензий</a>
// ----------------------------------------------------------------------------
const JUMP_PANELS = {
  slate: 'slate-slot',
  partners: 'partner-slot',
  rival: 'rival-slot',
  news: 'news-slot',
  board: 'board',
  algos: 'algos',
  funding: 'funding',
  price: 'price-gap',
  report: 'report-slot',
  charts: 'chart',
  turn: 'turn-slot',
};

function flash(node) {
  if (!node) return;
  node.classList.remove('jump-target');
  // Перезапуск анимации: без reflow повторный клик по той же ссылке ничего не делает
  void node.offsetWidth;
  node.classList.add('jump-target');
  setTimeout(() => node.classList.remove('jump-target'), 1600);
}

function jumpTo(target) {
  const [kind, key] = String(target).split(':');

  if (kind === 'lever') {
    const lever = document.querySelector(`.lever[data-key="${key}"]`);
    if (!lever) return;
    // Свёрнутая группа сама раскрывается: иначе ссылка ведёт в никуда
    const group = lever.closest('.lever-group');
    if (group && !group.classList.contains('open')) {
      openGroups[group.dataset.group] = true;
      group.classList.add('open');
    }
    lever.classList.add('open');   // и подсказка «зачем это» раскрывается
    lever.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flash(lever);
    return;
  }

  if (kind === 'tab') {
    rightTab = key;
    renderRightTab();
    const box = el('tab-content');
    box?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flash(box);
    return;
  }

  // Адрес вида «panel:slate»: в таблице лежит вторая часть, не первая
  const node = el(JUMP_PANELS[key] ?? key ?? kind);
  if (!node) return;
  // Слоты вроде #slate-slot — это обёртки: сама панель лежит внутри.
  // Подсвечивать надо её, иначе рамка обводит пустой контейнер.
  let box = node.classList.contains('panel') ? node
    : (node.querySelector(':scope > .panel') ?? node.closest('.panel') ?? node);
  // Слот бывает пустым: в этом месяце просто нечего показывать. Подсветить
  // пустоту — значит на клик не ответить ничем, и человек решит, что ссылка
  // сломана. В таком случае ведём к ближайшей панели, которая что-то говорит.
  if (box.getBoundingClientRect().height < 8) {
    let sib = box.previousElementSibling;
    while (sib && sib.getBoundingClientRect().height < 8) sib = sib.previousElementSibling;
    box = sib ?? box.parentElement ?? box;
  }
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  flash(box);
}

// Делегирование: ссылки живут внутри строк перевода и перерисовываются
// вместе с панелями, поэтому слушатель один и вешается при старте.
function bindJumps() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-jump]');
    if (!link) return;
    e.preventDefault();
    jumpTo(link.dataset.jump);
  });
}

// ----------------------------------------------------------------------------
// Ход месяца: что решается прямо сейчас.
//
// Раньше подсказки лежали в справке внизу справа, и до них никто не доходил.
// Теперь совет стоит там же, где кнопка: рядом с решением, к которому он
// относится, и только когда он уместен.
// ----------------------------------------------------------------------------
function turnTodos() {
  const r = last();
  const todos = [];
  const slate = state.slate ?? [];
  const ready = slate.filter((p) => p.status === 'ready');
  const producing = slate.filter((p) => p.status === 'production');
  const planned = Object.keys(pendingRelease).length;
  const rivalLoud = ['major', 'mega'].includes(state.rivalNext ?? 'none');
  const season = seasonOf(state.month + 1);

  // 1. Готовые проекты — главное решение месяца
  if (ready.length && !planned) {
    todos.push({
      kind: rivalLoud ? 'warn' : 'act',
      jump: 'panel:slate',
      title: t('todoReleaseTitle', { count: ready.length }),
      text: rivalLoud
        ? t('todoReleaseVsRival')
        : season === 'winter' || season === 'autumn'
          ? t('todoReleaseGoodSeason', { season: seasonName(season) })
          : t('todoReleaseQuiet'),
    });
  }

  // 2. Пустая студия — премьеры не будет полгода
  if (!producing.length && !pendingCommission.length) {
    todos.push({ kind: 'bad', jump: 'panel:slate', title: t('todoStudioTitle'), text: t('todoStudioText') });
  }

  // 3. Разрыв между прайсом и тем, что платит база.
  // Само решение живёт рядом с ползунком цены; здесь только напоминание,
  // и только когда разрыв стал по-настоящему большим.
  if (r && r.priceGap > 0.15 && !pendingRaise) {
    const cooldown = CONFIG.raiseCooldown - (state.month - (state.lastRaiseMonth ?? -99));
    todos.push({
      kind: 'warn',
      jump: 'panel:price',
      title: t('todoPriceGapTitle', { gap: pct(r.priceGap, 0) }),
      text: cooldown > 0
        ? t('todoPriceGapCooldown', { months: cooldown })
        : t('todoPriceGapText', { list: amount(state.decisions.priceNew), paid: amount(r.lockedPrice) }),
    });
  }

  // 4. Партнёрство ждёт ответа
  if (state.partnerOffer && !pendingPartner) {
    todos.push({
      kind: 'act',
      jump: 'panel:partners',
      title: t('todoPartnerTitle', { name: tx(partnerById(state.partnerOffer)?.name ?? '') }),
      text: t('todoPartnerText'),
    });
  }

  // 5. Контракт заканчивается
  const ending = (state.partners ?? []).filter((d) => d.monthsLeft <= 2);
  if (ending.length) {
    todos.push({
      kind: 'warn',
      jump: 'panel:partners',
      title: t('todoPartnerEndTitle', { count: ending.length }),
      text: t('todoPartnerEndText', { subs: compact(ending.reduce((a, b) => a + b.subs, 0)) }),
    });
  }

  // 6. Маркетинг без каталога
  if (r && state.decisions.brandMarketing > 60_000_000 && r.depth < 0.25) {
    todos.push({ kind: 'warn', jump: 'lever:licensing', title: t('todoMarketingTitle'), text: t('todoMarketingText') });
  }

  // 7. Кампания без релиза
  if (!Object.keys(pendingRelease).length && state.decisions.brandMarketing > 200_000_000 && !ready.length) {
    todos.push({ kind: 'warn', jump: 'panel:slate', title: t('todoCampaignTitle'), text: t('todoCampaignText') });
  }

  return todos;
}

function plannedSpend() {
  const talent = talentIndexNow();
  const commissions = pendingCommission.reduce(
    (sum, c) => sum + projectPrice(c.genre, c.scale, talent) / scaleById(c.scale).months, 0);
  const campaigns = Object.values(pendingRelease).reduce((a, b) => a + b, 0);
  return { commissions, campaigns };
}

function renderTurn() {
  if (state.over) { el('turn-slot').innerHTML = ''; return; }
  const todos = turnTodos();
  const { commissions, campaigns } = plannedSpend();
  const releases = Object.keys(pendingRelease).length;

  const plan = [];
  if (releases) plan.push(t('planReleases', { count: releases, budget: money(campaigns) }));
  if (pendingCommission.length) plan.push(t('planCommission', { count: pendingCommission.length, monthly: money(commissions) }));
  if (pendingRaise) plan.push(t('planRaise'));

  el('turn-slot').innerHTML = `<div class="panel turn">
    <div class="report-head">
      <h2 class="panel-title inline">${t('panelTurn', { month: state.month + 1 })}</h2>
      <span class="funding-note">${plan.length ? plan.join(' · ') : t('planNothing')}</span>
    </div>
    ${todos.length
      ? `<div class="todos">${todos.map((td) => `
          <div class="todo ${td.kind}">
            <div class="todo-title">${td.title}</div>
            <div class="todo-text">${td.text}</div>
            ${td.jump ? `<a class="jump todo-jump" data-jump="${td.jump}">${t('jumpGo')}</a>` : ''}
            ${td.action ? `<button class="btn ${td.action.on ? 'primary' : 'ghost'} tiny"
              data-todo="${td.action.id}">${td.action.label}</button>` : ''}
          </div>`).join('')}</div>`
      : `<div class="todo ok"><div class="todo-title">${t('todoCalmTitle')}</div>
          <div class="todo-text">${t('todoCalmText')}</div></div>`}
  </div>`;

  el('turn-slot').querySelectorAll('[data-todo="raise"]').forEach((b) => {
    b.addEventListener('click', () => { pendingRaise = !pendingRaise; renderTurn(); });
  });
}

// ----------------------------------------------------------------------------
// Слейт: конкретные проекты вместо ползунка «бюджет на оригиналы»
// ----------------------------------------------------------------------------
const scaleName = (id) => tx(scaleById(id).name);
const genreName = (id) => tx(genreById(id)?.name ?? '');
const segName = (id) => (id ? tx(SEGMENTS.find((x) => x.id === id)?.name ?? '') : t('slateBroad'));

function talentIndexNow() {
  return last()?.talentIndex ?? 1;
}

function projectCard(p, kind) {
  const est = qualityEstimate(p);
  if (kind === 'production') {
    const done = 1 - p.monthsLeft / Math.max(1, p.monthsTotal);
    return `<div class="proj production">
      <div class="proj-head">
        <span class="proj-name">${genreName(p.genre)} · ${scaleName(p.scale)}</span>
        <span class="badge">${t('slateMonthsLeft', { months: p.monthsLeft })}</span>
      </div>
      <div class="proj-meta">${t('slateFor', { segment: segName(p.segment) })} · ${t('slateHours', { hours: num(p.hours, 1) })}</div>
      <span class="q-bar"><span class="q-fill" style="width:${(done * 100).toFixed(0)}%"></span></span>
      <div class="proj-meta">${t('slateEstimate', { low: est.low.toFixed(2), high: est.high.toFixed(2) })}</div>
    </div>`;
  }
  // Готовый проект: тут и принимается решение о релизе
  const campaign = pendingRelease[p.id];
  const planned = campaign !== undefined;
  const buzz = releaseBuzz(p);
  return `<div class="proj ready ${planned ? 'planned' : ''}" data-ready="${p.id}">
    <div class="proj-head">
      <span class="proj-name">${genreName(p.genre)} · ${scaleName(p.scale)}</span>
      <span class="badge ${p.monthsHeld > 2 ? 'warn' : 'on'}">${
        p.monthsHeld > 0 ? t('slateHeld', { months: p.monthsHeld }) : t('slateFresh')}</span>
    </div>
    <div class="proj-meta">${t('slateFor', { segment: segName(p.segment) })} ·
      ${t('slateQuality', { value: p.quality.toFixed(2) })} · ${t('slateBuzz', { value: buzz.toFixed(2) })}</div>
    ${p.monthsHeld > 0 ? `<div class="proj-meta neg">${t('slateStale', { pct: pct(1 - Math.pow(1 - CONFIG.vaultDecay, p.monthsHeld), 0) })}</div>` : ''}
    ${planned
      ? `<div class="release-row">
          <label>${t('slateCampaign')}</label>
          <input type="range" data-campaign="${p.id}" min="0" max="400000000" step="10000000" value="${campaign}" />
          <span class="release-budget">${money(campaign)}</span>
          <button class="btn ghost tiny" data-cancel="${p.id}">${t('slateCancel')}</button>
        </div>`
      : `<button class="btn primary tiny" data-release="${p.id}">${t('slateRelease')}</button>`}
  </div>`;
}

// Совместный мегахит с конкурентом: единственное решение в игре, где рынок
// не делится, а растёт. Показываем не «доступно», а цену и обе стороны
// сделки — иначе это выглядит бесплатным подарком, каким оно не является.
function jointHtml() {
  const C = CONFIG.coProduction;
  const done = Boolean(state.coProduction);
  const alive = state.rivalState?.alive;
  const early = state.month < C.minMonth;
  const slots = Math.round(state.decisions.studioSlots);
  const busy = (state.slate ?? []).filter((p) => p.status === 'production').length
    + pendingCommission.length >= slots;
  const price = projectPrice(commissionDraft.genre, C.scale, talentIndexNow())
    * C.costMult * C.yourShare;

  let state_ = null;
  if (done) {
    state_ = state.coProduction.released
      ? t('jointReleased', { lift: pct(marketLiftOf(state) - 1, 0) })
      : t('jointInProduction');
  } else if (!alive) state_ = t('jointNoRival');
  else if (early) state_ = t('jointTooEarly', { month: C.minMonth });
  else if (busy) state_ = t('jointNoSlots');

  return `<div class="slate-section joint">
    <div class="slate-label">${t('jointTitle')}</div>
    <details class="more"${state_ ? '' : ' open'}><summary>${t('moreHow')}</summary>
      <div class="funding-note">${t('jointWhat', {
        share: pct(C.yourShare, 0), months: C.months, lift: pct(C.marketLift, 0),
        window: C.liftMonths,
      })}</div>
      <div class="funding-note">${t('jointCost')}</div>
    </details>
    <div class="commission-foot">
      <span>${state_ ?? t('jointPrice', { price: money(price), months: C.months })}</span>
      ${state_ ? '' : `<button class="btn primary" id="btn-joint"
        ${price <= state.cash ? '' : 'disabled'}>${
        price <= state.cash ? t('jointStart') : t('slateNoCash')}</button>`}
    </div>
  </div>`;
}

function renderSlate() {
  const slate = state.slate ?? [];
  const producing = slate.filter((p) => p.status === 'production');
  const ready = slate.filter((p) => p.status === 'ready');
  const slots = Math.round(state.decisions.studioSlots);
  const free = slots - producing.length - pendingCommission.length;
  const talent = talentIndexNow();
  const price = projectPrice(commissionDraft.genre, commissionDraft.scale, talent);
  const affordable = price <= state.cash;

  const queued = pendingCommission.map((c, i) => `<div class="proj queued">
    <div class="proj-head">
      <span class="proj-name">${genreName(c.genre)} · ${scaleName(c.scale)}</span>
      <button class="btn ghost tiny" data-unqueue="${i}">✕</button>
    </div>
    <div class="proj-meta">${t('slateFor', { segment: segName(c.segment) })} ·
      ${t('slateStartsNow', { months: scaleById(c.scale).months })}</div>
  </div>`).join('');

  el('slate-slot').innerHTML = `<div class="panel">
    <div class="report-head">
      <h2 class="panel-title inline">${t('panelSlate')}</h2>
      <span class="funding-note">${t('slateSlots', {
        used: producing.length + pendingCommission.length, total: slots,
        cost: money(CONFIG.studioSlotMonthly * Math.pow(slots, CONFIG.studioSlotExponent)) })}</span>
    </div>

    ${ready.length ? `<div class="slate-section">
      <div class="slate-label">${t('slateReadyTitle', { count: ready.length })}</div>
      <div class="proj-grid">${ready.map((p) => projectCard(p, 'ready')).join('')}</div>
      <div class="funding-note">${t('slateReadyHint')}</div>
    </div>` : ''}

    <div class="slate-section">
      <div class="slate-label">${t('slateProductionTitle', { count: producing.length })}</div>
      ${producing.length
        ? `<div class="proj-grid">${producing.map((p) => projectCard(p, 'production')).join('')}</div>`
        : `<div class="alert bad">${t('slateEmpty', { months: 4 })}</div>`}
      ${queued ? `<div class="proj-grid">${queued}</div>` : ''}
    </div>

    <div class="slate-section commission ${free > 0 ? '' : 'blocked'}">
      <div class="slate-label">${t('slateCommission')}</div>
      <div class="commission-row">
        <div class="pick" data-pick="genre">${GENRES.map((g) => `
          <button class="${g.id === commissionDraft.genre ? 'active' : ''}" data-genre="${g.id}"
            title="${tx(g.hint)}">${tx(g.name)}</button>`).join('')}</div>
      </div>
      <div class="commission-row">
        <div class="pick" data-pick="scale">${SCALES.map((sc) => `
          <button class="${sc.id === commissionDraft.scale ? 'active' : ''}" data-scale="${sc.id}"
            title="${tx(sc.hint)}">${tx(sc.name)} · ${sc.months} ${t('unitMonthsShort')}</button>`).join('')}</div>
      </div>
      <div class="commission-row">
        <div class="pick" data-pick="segment">
          <button class="${commissionDraft.segment === null ? 'active' : ''}" data-segment="">${t('slateBroad')}</button>
          ${SEGMENTS.map((sg) => `<button class="${sg.id === commissionDraft.segment ? 'active' : ''}"
            data-segment="${sg.id}" title="${tx(sg.hint)}">${tx(sg.name)}</button>`).join('')}
        </div>
      </div>
      <div class="commission-foot">
        <span>${t('slatePrice', { price: money(price), months: scaleById(commissionDraft.scale).months })}</span>
        <button class="btn primary" id="btn-commission" ${free > 0 && affordable ? '' : 'disabled'}>
          ${free > 0 ? (affordable ? t('slateStart') : t('slateNoCash')) : t('slateNoSlots')}</button>
      </div>
      <div class="funding-note">${t('slateFocusHint')}</div>
    </div>

    ${jointHtml()}
  </div>`;

  const root = el('slate-slot');
  root.querySelector('#btn-joint')?.addEventListener('click', () => {
    pendingJoint = { genre: commissionDraft.genre };
    toast(t('jointQueued'));
    renderSlate();
    renderTurn();
  });
  root.querySelectorAll('[data-genre]').forEach((b) => b.addEventListener('click', () => {
    commissionDraft.genre = b.dataset.genre; renderSlate();
  }));
  root.querySelectorAll('[data-scale]').forEach((b) => b.addEventListener('click', () => {
    commissionDraft.scale = b.dataset.scale; renderSlate();
  }));
  root.querySelectorAll('[data-segment]').forEach((b) => b.addEventListener('click', () => {
    commissionDraft.segment = b.dataset.segment || null; renderSlate();
  }));
  el('btn-commission')?.addEventListener('click', () => {
    pendingCommission.push({ ...commissionDraft });
    renderSlate(); renderTurn();
  });
  root.querySelectorAll('[data-unqueue]').forEach((b) => b.addEventListener('click', () => {
    pendingCommission.splice(Number(b.dataset.unqueue), 1);
    renderSlate(); renderTurn();
  }));
  root.querySelectorAll('[data-release]').forEach((b) => b.addEventListener('click', () => {
    pendingRelease[Number(b.dataset.release)] = 60_000_000;
    renderSlate(); renderTurn();
  }));
  root.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => {
    delete pendingRelease[Number(b.dataset.cancel)];
    renderSlate(); renderTurn();
  }));
  root.querySelectorAll('[data-campaign]').forEach((inp) => inp.addEventListener('input', () => {
    pendingRelease[Number(inp.dataset.campaign)] = Number(inp.value);
    inp.parentElement.querySelector('.release-budget').textContent = money(Number(inp.value));
    renderTurn();
  }));
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

// ----------------------------------------------------------------------------
// Новости месяца.
//
// Всё это уже было в модели, но попадало на экран только цифрами — и партия
// читалась как таблица. Здесь то же самое, но словами и про индустрию, а не
// про ваши метрики: что вышло, что анонсировал сосед, что истекло само собой.
// Каждая строка выведена из состояния: выдумывать нечего.
// ----------------------------------------------------------------------------
function buildNews(r) {
  const news = [];
  const month = state.month;
  const hist = state.history ?? [];
  const prevStance = hist.length > 1 ? hist[hist.length - 2].rivalStance : null;

  // Свои премьеры — главное событие месяца в этой игре
  for (const p of r?.premieres ?? []) {
    news.push(['good', t('newsPremiere', {
      genre: genreName(p.genre), scale: scaleName(p.scale).toLowerCase(),
      quality: pct(p.quality, 0),
      held: p.held > 0 ? t('newsPremiereHeld', { months: num(p.held, 0) }) : '',
    })]);
  }
  if (r && !(r.premieres ?? []).length) {
    news.push(['', t('newsNoPremiere', { vault: num((r.vault ?? []).length, 0) })]);
  }

  // Что заявил конкурент на следующий месяц — это и новость, и решение:
  // выпускать своё в один месяц с его мегапремьерой значит делить внимание.
  if (r?.rivalAlive && r.rivalNext && r.rivalNext !== 'none') {
    const loud = (RIVAL_RELEASES[r.rivalNext]?.pull ?? 0) >= 0.7;
    news.push([loud ? 'warn' : '', t(loud ? 'newsRivalLoud' : 'newsRivalQuiet', {
      release: rivalName(r.rivalNext).toLowerCase(),
    })]);
  }
  if (r?.rivalAlive && r.rivalStance && r.rivalStance !== prevStance) {
    news.push(['warn', t('newsRivalStance', {
      stance: stanceName(r.rivalStance).toLowerCase(),
      note: t(`stance${r.rivalStance.charAt(0).toUpperCase()}${r.rivalStance.slice(1)}Hint`),
    })]);
  }
  if (r?.rivalSurge) {
    news.push(['warn', t('newsRivalSurge')]);
  } else if (r?.rivalJustRaised) {
    news.push(['warn', t('newsRivalRaised')]);
  }

  // Третий акт: обвал прав анонсируется заранее — это новость-предупреждение,
  // на которую можно успеть ответить собственным производством.
  if (r?.rightsCliffSoon) {
    news.push(['warn', t('newsCliffSoon', {
      months: num(r.rightsCliffIn, 0), share: pct(CONFIG.rightsCliffShare, 0),
    })]);
  }
  if (r?.rightsCliffHit) {
    news.push(['warn', t('newsCliffHit', { lost: compact(r.rightsCliffLost) })]);
  }

  // Лицензии истекают сами, каждый месяц. Это беговая дорожка, и её видно
  // только если сказать словами: каталог тает, даже когда вы ничего не делаете.
  if (r && r.licenseExpired > 0) {
    const shrinking = r.licenseBought < r.licenseExpired;
    news.push([shrinking ? 'warn' : '', t('newsRights', {
      gone: compact(r.licenseExpired), bought: compact(r.licenseBought),
      verdict: t(shrinking ? 'newsRightsShrink' : 'newsRightsHold'),
    })]);
  }

  // Права и талант дорожают, когда за них торгуетесь вы оба
  if (r && r.licenseIndex > 1.4) {
    news.push(['warn', t('newsLicensePrice', { index: r.licenseIndex.toFixed(2) })]);
  }
  if (r && r.talentIndex > 1.6) {
    news.push(['warn', t('newsTalentPrice', { index: r.talentIndex.toFixed(2) })]);
  }

  // Проект доснят: с этого месяца его можно выпускать, а можно придержать
  for (const p of r?.finished ?? []) {
    news.push(['good', t('newsFinished', {
      genre: genreName(p.genre), scale: scaleName(p.scale).toLowerCase(),
    })]);
  }

  for (const ex of r?.partnerExpired ?? []) {
    news.push(['warn', t('newsPartnerExpired', {
      name: tx(partnerById(ex.id)?.name ?? ''),
      lost: compact(ex.lost), kept: compact(ex.kept),
    })]);
  }

  // Сезон: зимой смотрят вдвое больше, чем летом
  const nextSeason = seasonOf(month + 1);
  if (nextSeason !== seasonOf(month)) {
    news.push(['', t(`newsSeason${nextSeason.charAt(0).toUpperCase()}${nextSeason.slice(1)}`)]);
  }

  return news;
}

function renderNews() {
  // После конца партии новостей нет: город живёт дальше без вас, а показывать
  // прогноз на неделю, которой не будет, — то же самое, что и погодная панель
  // на экране итогов. Она тоже гаснет.
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

function renderRival() {
  if (state.over) { el('rival-slot').innerHTML = ''; return; }
  const now = state.rival ?? 'none';
  const next = state.rivalNext ?? 'none';
  const alarm = (RIVAL_RELEASES[next]?.pull ?? 0) >= 0.7;
  const riv = state.rivalState;
  const r = last();
  const you = r ? r.subs : 0;
  const them = rivalSubs(riv);
  const share = you + them > 0 ? you / (you + them) : 0;
  const myPrice = state.decisions.priceNew;
  const priceGap = riv.price - myPrice;

  const dead = !riv.alive;
  const stance = dead ? 'gone' : riv.stance;
  const stanceCls = dead ? 'pos' : riv.stance === 'war' ? 'neg'
    : riv.stance === 'press' ? 'warn' : riv.stance === 'retreat' ? 'pos' : '';

  el('rival-slot').innerHTML = `<div class="panel">
    <h2 class="panel-title">${t('rivalPanel', {
      season: seasonName(seasonOf(state.month + 1)), month: state.month + 1,
    })}</h2>

    <div class="rival-head">
      <div class="rival-stance">
        <span class="badge ${stanceCls}">${dead ? t('stanceGone') : stanceName(riv.stance)}</span>
        <span class="rival-stance-hint">${dead ? t('stanceGoneHint') : t(`stance${stance.charAt(0).toUpperCase()}${stance.slice(1)}Hint`)}</span>
      </div>
      <div class="rival-facts">
        <span>${t('rivalTheirPrice')} <b>${amount(riv.price)}</b>
          <span class="${priceGap > 0 ? 'pos' : priceGap < 0 ? 'neg' : ''}">
            ${priceGap === 0 ? t('rivalPriceSame') : t(priceGap > 0 ? 'rivalPriceAbove' : 'rivalPriceBelow', { gap: amount(Math.abs(priceGap)) })}</span></span>
        <span>${t('rivalTheirCatalog')} <b>${compact(riv.catalogLicensed + riv.catalogOriginal)} ${t('unitHours')}</b>
          (${t('rivalTheirOriginals', { hours: compact(riv.catalogOriginal) })})</span>
        <span>${t('rivalTheirFocus')} <b>${tx(genreById(riv.focus)?.name ?? '')}</b></span>
      </div>
    </div>

    <div class="share-bar" title="${t('shareBarHint')}">
      <span class="share-you" style="width:${(share * 100).toFixed(1)}%">${share > 0.12 ? `${t('shareYou')} ${pct(share, 0)}` : ''}</span>
      <span class="share-them">${share < 0.88 ? `${t('shareThem')} ${pct(1 - share, 0)}` : ''}</span>
    </div>
    <div class="funding-note">${t('shareCaption', {
      you: compact(you), them: compact(them),
      flow: r ? (r.netSwitch >= 0 ? `+${compact(r.netSwitch)}` : `−${compact(-r.netSwitch)}`) : '0',
    })}</div>

    <div class="weather">
      ${rivalCard(now, t('rivalNow'), 'weather-now')}
      ${rivalCard(next, t('rivalNext'), `weather-next ${alarm ? 'alarm' : ''}`)}
      ${alarm ? `<div class="funding-note" style="flex-basis:100%">${t('rivalAdvice')}</div>` : ''}
    </div>
  </div>`;
}

// ----------------------------------------------------------------------------
// Совет директоров: цель года и её последствия
// ----------------------------------------------------------------------------
function renderBoard() {
  const goal = state.board?.goal;
  const r = last();
  if (!goal) { el('board').innerHTML = `<div class="hint-box">${t('boardDone')}</div>`; return; }

  const p = goalProgress(goal, {
    subs: r?.subs ?? 0,
    rivalSubs: rivalSubs(state.rivalState),
    profitableMonths: state.board.profitableMonths,
  });
  const monthsLeft = goal.year * CONFIG.boardYearMonths - state.month;

  let line = '';
  let ratio = 0;
  if (goal.type === 'subscribers') {
    ratio = p.value / goal.target;
    line = t('goalSubs', { have: compact(p.value), need: compact(goal.target) });
  } else if (goal.type === 'profit') {
    ratio = Math.min(p.value / goal.target, p.subs / goal.subsFloor);
    line = t('goalProfit', {
      have: p.value, need: goal.target,
      subs: compact(p.subs), floor: compact(goal.subsFloor),
    });
  } else {
    ratio = Math.min(p.value / goal.target, p.subs / goal.subsFloor);
    line = t('goalShare', {
      have: pct(p.value, 0), need: pct(goal.target, 0),
      subs: compact(p.subs), floor: compact(goal.subsFloor),
    });
  }
  ratio = Math.max(0, Math.min(1, ratio));

  const restr = state.restrictions && state.month < state.restrictions.until
    ? `<div class="alert bad">${t('boardCapActive', {
        cap: money(state.restrictions.contentCap),
        months: state.restrictions.until - state.month,
      })}</div>` : '';

  const past = (state.board.history ?? []).map((h) =>
    `<div class="goal-past ${h.passed ? 'pos' : 'neg'}">${t('goalYear', { year: h.year })}: ${
      h.passed ? t('goalPassed') : t(`goalFailed_${h.effect}`)}</div>`).join('');

  el('board').innerHTML = `
    <div class="goal-card ${p.done ? 'done' : monthsLeft <= 3 ? 'urgent' : ''}">
      <div class="goal-head">
        <span class="goal-year">${t('goalYear', { year: goal.year })}</span>
        <span class="goal-left">${t('goalMonthsLeft', { months: monthsLeft })}</span>
      </div>
      <div class="goal-line">${line}</div>
      <span class="q-bar"><span class="q-fill ${p.done ? 'ok' : ''}" style="width:${(ratio * 100).toFixed(0)}%"></span></span>
      <div class="funding-note">${p.done ? t('goalOnTrack') : t(`goalStake_${goal.penalty}`)}</div>
    </div>
    ${restr}
    ${past}`;
}

// ----------------------------------------------------------------------------
// Кризис: проблема, которая не рассосётся сама
// ----------------------------------------------------------------------------
function renderCrisis() {
  const active = state.crisis;
  if (!active || state.over) { el('crisis-slot').innerHTML = ''; return; }
  const def = crisisById(active.id);
  if (!def) { el('crisis-slot').innerHTML = ''; return; }
  const sev = severityOf(active);

  const options = def.resolutions.map((res, i) => {
    const cost = resolutionCost(active, res.id);
    return `<button class="event-option ${res.resolves ? 'primary' : ''}" data-crisis="${res.id}">
      <span class="opt-label">${tx(res.label)}</span>
      <span class="opt-detail">${tx(res.detail)}${cost > 0 ? ` · ${money(cost)}` : ''}</span>
    </button>`;
  }).join('');

  el('crisis-slot').innerHTML = `<div class="panel event-card crisis">
    <h3>🔥 ${tx(def.title)} <span class="badge neg">${t('crisisMonths', { months: sev })}</span></h3>
    <p>${tx(def.text)}</p>
    <div class="alert bad">${t('crisisWorsening')}</div>
    <div class="event-options">${options}</div>
    <div class="lesson">${tx(def.lesson)}</div>
  </div>`;

  for (const btn of el('crisis-slot').querySelectorAll('[data-crisis]')) {
    btn.addEventListener('click', () => {
      pendingCrisisChoice = btn.dataset.crisis;
      for (const b of el('crisis-slot').querySelectorAll('[data-crisis]')) b.classList.remove('chosen');
      btn.classList.add('chosen');
    });
  }
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
      renderAlgos(); renderOpsReadout(); renderBudget(); renderRightTab(); save();
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
      renderOpsReadout();
      renderBudget();
      renderStudioMap(); renderRightTab(); save();
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

  // Связка «запас хода ↔ раунды»: сколько месяцев проживёт касса при текущем
  // темпе, прямо там, где принимается решение о деньгах.
  const lastR = last();
  const burn = lastR && lastR.profit < 0 ? -lastR.profit : 0;
  const runwayTurns = burn > 0 ? state.cash / burn : null;
  const runwayNote = runwayTurns !== null
    ? `<div class="funding-note"${runwayTurns < 6 ? ' style="color:var(--bad)"' : ''}>${
        t('fundingRunway', { n: num(runwayTurns, 1) })}</div>`
    : '';

  el('funding').innerHTML = `
    <div class="funding-note">${t('fundingHead', {
      valuation: money(v), equity: pct(state.equity, 1), raised: money(state.raisedTotal) })}</div>
    ${runwayNote}
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

  // Прибыль при тающей базе — дожинание, а не бизнес. Ровно это состояние
  // игрок принимает за успех: «в плюсе — значит всё правильно». Оценка
  // компании платит за рост, и сжимающийся сервис стоит дёшево даже
  // с хорошей маржой — об этом надо говорить в момент, когда это происходит,
  // а не на финальном экране.
  const h = state.history;
  if (h.length >= 4) {
    const last3 = h.slice(-3);
    const profitable3 = last3.every((x) => x.profit - x.oneOff > 0);
    const shrinking = r.subs < h[h.length - 4].subs * 0.97;
    if (profitable3 && shrinking) {
      alerts.push(['warn', t('alertHarvest', {
        lost: compact(h[h.length - 4].subs - r.subs),
      }), 'panel:rival']);
    }
  }

  if (r.depth < 0.35) {
    alerts.push(['bad', t('alertNoCatalog', { depth: r.depth.toFixed(2) }), 'lever:licensing']);
  }
  if (r.freshness < 0.6 && r.subs > 1000) {
    alerts.push(['warn', t('alertStale', { fresh: r.freshness.toFixed(2), lost: compact(r.lostSubs) })]);
  }
  if (!r.producing.length) {
    alerts.push(['bad', t('alertNoPipeline'), 'panel:slate']);
  }
  const idle = r.slots - r.slotsUsed;
  if (idle > 0 && r.slotCost > 0) {
    alerts.push(['warn', t('alertSlotsIdle', { count: idle }), 'lever:studioSlots']);
  }
  const longHeld = Math.max(0, ...r.vault.map((v) => v.held));
  if (longHeld >= 3) alerts.push(['warn', t('alertHeldTooLong', { months: longHeld }), 'panel:slate']);
  if (r.raiseApplied) {
    alerts.unshift(['warn', t('alertRaiseDone', { lost: compact(r.raiseLost) }), 'panel:price']);
  }
  if (r.annualCash > 0) {
    alerts.push(['good', t('alertAnnualCash', { cash: money(r.annualCash) }), 'lever:annualDiscount']);
  }
  if (r.cmPerSub < 0) {
    alerts.push(['bad', t('alertNegativeCm', { value: `${amount(r.cmPerSub)}` })]);
  } else if (r.revenue > 0 && r.cdnCost / r.revenue > 0.30) {
    alerts.push(['warn', t('alertTrafficHeavy', {
      share: pct(r.cdnCost / r.revenue, 0), cost: money(r.cdnCost),
      hours: num(r.hoursPerSub, 1), bitrate: num(r.decisions.bitrate),
    })]);
  }
  if (r.cmPerSub > 0 && r.profit < 0) {
    alerts.push(['warn', t('alertBreakEven', {
      cm: `${amount(r.cmPerSub)}`, fixed: money(r.fixed), subs: compact(r.fixed / r.cmPerSub),
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

  // Разбор месяца — это баланс запаса: строки складываются в изменение базы.
  // Зелёное — то, что базу прибавило, красное — то, что её убавило, и цвет
  // строки всегда совпадает со знаком её вклада.
  const p0 = prev();
  const drivers = explain(p0, r);
  const netEffect = drivers.reduce((s, d) => s + d.effect, 0);
  const maxAbs = Math.max(0.005, ...drivers.map((d) => Math.abs(d.effect)));
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
  const driversHtml = drivers.length ? `
    <div class="drivers">
      <div class="panel-title">${t('driversTitle', {
        delta: signedPct(r.subs / Math.max(1e-9, p0.subs) - 1) })}</div>
      ${drivers.map((d) => `<div class="driver">
          <span class="d-name">${t(d.key)}</span>
          <span class="d-people">${d.people >= 0 ? '+' : '−'}${compact(Math.abs(d.people))}</span>
          ${bar(d.effect, maxAbs)}
          <span class="d-val ${d.effect > 0 ? 'pos' : 'neg'}">${signedPct(d.effect)}</span>
        </div>`).join('')}
      <div class="d-sum">
        <span class="d-name">${t('driversNet')}</span>
        <span class="d-people">${netEffect >= 0 ? '+' : '−'}${compact(Math.abs(r.subs - p0.subs))}</span>
        ${bar(netEffect, maxAbs)}
        <span class="d-val ${netEffect > 0 ? 'pos' : 'neg'}">${signedPct(netEffect)}</span>
      </div>
    </div>${factorsHtml}` : '';

  const alerts = buildAlerts(r);
  if (r.goalOutcome) {
    alerts.unshift([r.goalOutcome.passed ? 'good' : 'bad',
      r.goalOutcome.passed
        ? t('alertGoalPassed', { year: r.goalOutcome.year })
        : t(`alertGoalFailed_${r.goalOutcome.effect}`, { year: r.goalOutcome.year })]);
  }
  if (r.contentCapped) alerts.unshift(['bad', t('alertCapped', { cap: money(r.contentCapped) }), 'panel:board']);
  if (r.crisisResolved) {
    alerts.unshift(['good', t('alertCrisisResolved', {
      name: tx(crisisById(r.crisisResolved.id)?.title ?? ''), cost: money(r.crisisCost) })]);
  }
  if (r.netSwitch < -1000) alerts.push(['bad', t('alertLosingSubs', { count: compact(-r.netSwitch) }), 'panel:rival']);
  else if (r.netSwitch > 1000) alerts.push(['good', t('alertWinningSubs', { count: compact(r.netSwitch) })]);
  if (r.licenseIndex > 1.5) alerts.push(['warn', t('alertLicenseWar', { index: r.licenseIndex.toFixed(2) }), 'lever:licensing']);
  if (r.talentIndex > 2) alerts.push(['warn', t('alertTalentCost', { index: r.talentIndex.toFixed(2) }), 'panel:slate']);
  if (r.rivalJustRaised) alerts.push(['warn', t('alertRivalRaised'), 'panel:rival']);
  if (!r.rivalAlive) alerts.unshift(['good', t('alertRivalDead')]);
  // Больше пяти строк разбора никто не читает: важное тонет в подробностях.
  // Порядок уже расставлен по срочности — плохое поднято наверх.
  const shown = alerts.slice(0, 5);
  const hidden = alerts.length - shown.length;
  const alertsHtml = shown.length
    ? `<div class="alerts">${shown.map(([k, text, jump]) => `<div class="alert ${k}">${text}${
        jump ? ` <a class="jump" data-jump="${jump}">${t('jumpGo')}</a>` : ''}</div>`).join('')}
        ${hidden > 0 ? `<div class="funding-note">${t('alertsMore', { count: hidden })}</div>` : ''}</div>` : '';

  const ev = r.event ? eventById(r.event.id) : null;
  const eventNote = ev ? `<div class="lesson"><b>${tx(ev.title)}.</b> ${tx(ev.lesson)}</div>` : '';

  const premiereNote = r.premieres.length
    ? `<div class="alert good" style="margin-top:8px">${t('premiereNote', {
        list: r.premieres.map((p) => t('premiereItem', {
          genre: `${genreName(p.genre)} · ${scaleName(p.scale)}`,
          quality: p.quality.toFixed(2) })).join(', '),
      })}</div>` : '';
  const startedNote = r.started.length
    ? `<div class="alert warn" style="margin-top:8px">${t('startedNote', {
        list: r.started.map((p) => `${genreName(p.genre)} · ${scaleName(p.scale)}`).join(', '),
        months: r.started.length ? scaleById(r.started[0].scale).months : 6,
      })}</div>` : '';
  const installNote = r.installedNow?.length
    ? `<div class="alert good" style="margin-top:8px">${t('installNote', {
        names: r.installedNow.map((k) => tx(algoByKey(k)?.name)).join(', '),
        cost: money(r.installCost) })}</div>` : '';

  // Одна строка «что изменилось»: три главных числа против прошлого хода.
  const p = prev();
  const sm = (v) => (v >= 0 ? '+' : '') + money(v);
  const deltaLine = p ? `<div class="funding-note" style="margin-top:2px">${t('reportDelta', {
    subs: signedPct(r.subs / Math.max(1e-9, p.subs) - 1, 1),
    profit: sm(r.profit - p.profit),
    cash: sm(r.cash - p.cash),
  })}</div>` : '';

  el('report-slot').innerHTML = `<div class="panel">
    <div class="report-head">
      <h3>${t('reportTitle', { month: r.month })}</h3>
      <span class="funding-note">${t('reportHeadStats', {
        revenue: money(r.revenue), subscription: money(r.subscriptionRevenue), ads: money(r.adRevenue) })}</span>
    </div>
    ${deltaLine}
    <div class="report-grid">
      ${stat(t('statSubs'), compact(r.subs), t('statSubsSub', {
        gained: compact(r.newSubs), lost: compact(r.lostSubs) }))}
      ${stat(t('statHours'), compact(r.hours), t('statHoursSub', { perSub: num(r.hoursPerSub, 1) }))}
      ${stat(t('statCatalog'), `${compact(r.catalogHours)} ${t('unitHours')}`, t('statCatalogSub', {
        original: compact(r.catalogOriginal), share: pct(r.originalShare, 0) }))}
      ${stat(t('statFresh'), `×${r.freshness.toFixed(2)}`, t('statFreshSub', { depth: r.depth.toFixed(2) }))}
      ${stat(t('statChurn'), pct(r.churnRate, 1), t('statChurnSub', { hangover: r.hangover.toFixed(2) }))}
      ${stat(t('statArpu'), `${amount(r.arpu)}`, t('statArpuSub', { value: `${amount(r.cmPerSub)}` }))}
      ${stat(t('statTraffic'), money(r.cdnCost), t('statTrafficSub', { perHour: amount(r.cdnPerHour, 2) }))}
      ${stat(t('statProfit'), money(r.profit), t('statProfitSub', { value: money(r.fixed) }))}
      ${stat(t('statCacLtv'), r.cac > 0 ? `${amount(r.cac)}` : '—',
        r.ltvCac ? `LTV/CAC ${r.ltvCac.toFixed(2)}` : t('statCacOff'))}
      ${stat(t('statSwitch'), r.netSwitch >= 0 ? `+${compact(r.netSwitch)}` : `−${compact(-r.netSwitch)}`,
        t('statSwitchSub', { inn: compact(r.switchedIn), out: compact(r.switchedOut) }))}
      ${stat(t('statPriceGap'), `${num(state.decisions.priceNew)} / ${amount(r.lockedPrice)}`,
        t('statPriceGapSub', { gap: pct(r.priceGap, 0), annual: compact(r.annualSubs) }))}
      ${stat(t('statPrices'), `×${r.licenseIndex.toFixed(2)} / ×${r.talentIndex.toFixed(2)}`,
        t('statPricesSub', { project: money(r.projectPrices.drama.season) }))}
    </div>
    ${premiereNote}${startedNote}${installNote}
    ${driversHtml}${alertsHtml}${eventNote}
  </div>`;
}

// ----------------------------------------------------------------------------
// Графики
// ----------------------------------------------------------------------------
const CHART_TABS = {
  // Главный график новой версии: вы против конкурента на одном рынке
  war: {
    label: 'chartWar', caption: 'chartWarCaption',
    series: (h) => [
      { label: t('seriesYou'), data: h.map((r) => r.subs), color: PALETTE[1] },
      { label: t('seriesThem'), data: h.map((r) => r.rivalSubs ?? 0), color: PALETTE[3] },
    ],
  },
  // Три нижние линии складываются в верхнюю: если они не сходятся — врёт модель,
  // а не глаз. Оптовая база вынесена отдельно именно потому, что её легко
  // перепутать с собственным ростом.
  subs: {
    label: 'chartSubs', caption: 'chartSubsCaption',
    series: (h) => [
      { label: t('seriesSubs'), data: h.map((r) => r.subs), color: PALETTE[1] },
      { label: t('seriesPremium'), data: h.map((r) => r.premiumSubs), color: PALETTE[0] },
      { label: t('seriesAds'), data: h.map((r) => r.adSubs), color: PALETTE[3] },
      { label: t('seriesPartner'), data: h.map((r) => r.partnerSubs ?? 0), color: PALETTE[4] },
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
    label: 'chartUnit', caption: 'chartUnitCaption', zeroLine: true, money: true,
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

// Дневник решений: ходы, в которые игрок что-то менял. Пунктир на графике
// и список под ним связывают решение с последствием — без этого график
// остаётся «просто кривой», по которой нечего разбирать.
function decisionChanges() {
  const hist = state.history ?? [];
  const out = [];
  for (let i = 1; i < hist.length; i += 1) {
    const prev = hist[i - 1].decisions ?? {};
    const cur = hist[i].decisions ?? {};
    const names = [];
    for (const l of LEVERS) if ((cur[l.key] ?? 0) !== (prev[l.key] ?? 0)) names.push(tx(l.label));
    for (const a of ALGORITHMS) {
      if (Boolean(cur.algoOn?.[a.key]) !== Boolean(prev.algoOn?.[a.key])) names.push(tx(a.name));
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
  // До первого хода график пуст: пустая «Динамика» не сообщает ничего,
  // а новичку добавляет ещё одну непонятную панель. Прячем до первого отчёта.
  const chartsPanel = el('chart').closest('.panel');
  if (chartsPanel) chartsPanel.style.display = (state.history ?? []).length ? '' : 'none';
  if (!(state.history ?? []).length) return;
  el('chart-tabs').innerHTML = Object.entries(CHART_TABS)
    .map(([k, v]) => `<button data-chart="${k}" class="${k === chartTab ? 'active' : ''}">${t(v.label)}</button>`).join('');
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
    zeroLine: conf.zeroLine, format: conf.format ?? axisNum, emptyText: t('pnlEmpty'),
    markers: changes.map((c) => c.index),
    rounds: roundTurns(),
  });
}

// ----------------------------------------------------------------------------
// Правая колонка
// ----------------------------------------------------------------------------
function renderUnitTab() {
  const u = unitEconomics(state, state.decisions);
  const r = last();
  const row = (name, value, cls = '', sub = false) =>
    `<tr class="${sub ? 'sub' : ''}"><td>${name}</td><td class="${cls}">${amount(value)}</td></tr>`;
  const breakEven = r && u.contribution > 0 ? r.fixed / u.contribution : null;

  return `
    <p class="funding-note">${t('unitIntro')}</p>
    <table class="data">
      <thead><tr><th>${t('unitColItem')}</th><th>${t('unitColPerSub')}</th></tr></thead>
      <tbody>
        ${row(t('unitSubscription'), u.subscription, 'pos', true)}
        ${row(t('unitAdvertising'), u.advertising, 'pos', true)}
        <tr class="total"><td>${t('unitRevenue')}</td><td class="pos">${amount(u.revenue)}</td></tr>
        ${row(t('unitCdn', { hours: num(u.hoursPerSub, 1), perHour: amount(u.cdnPerHour, 2) }), -u.cdn, 'neg', true)}
        ${row(t('unitSupport'), -u.support, 'neg', true)}
        <tr class="total"><td>${t('unitContribution')}</td>
          <td class="${u.contribution >= 0 ? 'pos' : 'neg'}">${amount(u.contribution)}</td></tr>
      </tbody>
    </table>
    <p class="funding-note" style="margin-top:10px">${t('unitNote')}</p>
    ${breakEven ? `<div class="hint-box" style="margin-top:10px">${t('unitBreakEven', {
      fixed: money(r.fixed), subs: compact(breakEven), current: compact(r.subs) })}</div>`
      : u.contribution <= 0 ? `<div class="hint-box" style="margin-top:10px">${t('unitNoBreakEven')}</div>` : ''}
    ${r ? `<h4 style="margin:14px 0 6px;font-size:13px">${t('unitAcquisition')}</h4>
    <table class="data"><tbody>
      <tr><td>${t('unitCac')}</td><td>${r.cac > 0 ? `${amount(r.cac)}` : '—'}</td></tr>
      <tr><td>${t('unitLifetime')}</td><td>${t('unitLifetimeValue', {
        value: (1 / Math.max(0.005, r.churnRate)).toFixed(1) })}</td></tr>
      <tr><td>${t('unitLtv')}</td><td>${amount(r.ltv)}</td></tr>
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
      ${line(t('pnlProduction'), -r.productionSpend, 'neg', true)}
      ${line(t('pnlSlots'), -r.slotCost, 'neg', true)}
      ${line(t('pnlMarketing'), -r.decisions.brandMarketing, 'neg', true)}
      ${line(t('pnlCampaigns'), -r.campaignSpend, 'neg', true)}
      ${line(t('pnlTech'), -r.decisions.tech, 'neg', true)}
      ${line(t('pnlRnd'), -r.decisions.rnd, 'neg', true)}
      ${line(t('pnlUpkeep'), -(r.techUpkeep ?? 0), 'neg', true)}
      ${line(t('pnlStaff'), -(r.staffCost ?? 0), 'neg', true)}
      ${line(t('pnlHq'), -CONFIG.hqMonthly, 'neg', true)}
      ${r.financeCost > 0 ? line(t('pnlFinance'), -r.financeCost, 'neg', true) : ''}
      ${line(t('pnlMisc', { rate: pct(r.miscRate ?? 0, 1) }), -(r.miscCost ?? 0), 'neg', true)}
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
        <td>${amount(s.arpu)}</td></tr>`).join('')}</tbody>
    </table>
    <table class="data" style="margin-top:10px">
      <thead><tr><th>${t('colSegment')}</th><th>${t('colPenetration')}</th><th>${t('colPriceFactor')}</th><th>${t('colAppeal')}</th><th>${t('colAdPenalty')}</th></tr></thead>
      <tbody>${r.segments.map((s) => `<tr>
        <td>${name(s)}</td><td>${pct(s.penetration, 1)}</td>
        <td class="${s.priceFactor >= 1 ? 'pos' : 'neg'}">${s.priceFactor.toFixed(2)}</td>
        <td class="${s.appeal >= 1 ? 'pos' : 'neg'}">${s.appeal.toFixed(2)}</td>
        <td class="${s.adPenalty >= 0.95 ? 'pos' : 'neg'}">${s.adPenalty.toFixed(2)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="funding-note">${t('factorsNote')}</p>
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

// Развилка перед смертью: игрок, который не смотрел на кассу, получает один
// явный шанс осознать положение и поднять раунд — вместо молчаливого краха
// через два хода. Показывается один раз за партию и только пока раунд доступен.
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

// Водопад последних месяцев: на экране смерти видно не «вы банкрот», а из
// каких потоков это сложилось — выручка, расходы, итог месяца, касса.
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

// Итог заносится в локальную таблицу рекордов один раз за партию; метка своей
// записи хранится в state, чтобы переоткрытие экрана итогов её не теряло.
function recordsBlockHtml(s) {
  if (!state.recordId) {
    state.recordId = String(Date.now());
    addRecord(RECORDS_KEY, {
      id: state.recordId,
      date: new Date().toISOString().slice(0, 10),
      seed: state.seed,
      score: s.bankrupt ? 0 : Math.round(s.equityValue),
      outcome: s.bankrupt ? 'bankrupt' : s.sold ? 'sold' : 'finished',
      version: APP_VERSION,
      turns: s.months,
    });
    save();
  }
  const top = loadRecords(RECORDS_KEY);
  if (!top.length) return '';
  const rows = top.map((rec, i) => `<tr${rec.id === state.recordId ? ' class="total"' : ''}>
    <td>${i + 1}</td><td>${rec.date}</td><td>${rec.seed}</td><td>${money(rec.score)}</td>
    <td>${t(rec.outcome === 'bankrupt' ? 'recordsOutcomeBankrupt' : rec.outcome === 'sold' ? 'recordsOutcomeSold' : 'recordsOutcomeFinished')}${rec.id === state.recordId ? ` ${t('recordsYou')}` : ''}</td></tr>`).join('');
  return `<h3 style="margin:12px 0 6px">${t('recordsTitle')}</h3>
    <div style="overflow-x:auto"><table class="data">
    <thead><tr><th>#</th><th>${t('recordsDate')}</th><th>${t('recordsCode')}</th><th>${t('recordsScore')}</th><th>${t('recordsOutcome')}</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

// Обратный бонус мета-прогрессии набора: достойный финал НОВОГРАДА
// открывает бейдж и коды партий «городов-побратимов». Строго
// косметика: экономика зачётных партий не меняется — экономический буст
// сломал бы честность общей таблицы и калибровку целей совета.
function conglomerateBadgeHtml() {
  if (!conglomerateUnlocked()) return '';
  return `<div class="lesson" style="margin-top:10px"><b>🏙️ ${t('metaConglomerate')}</b> ${t('metaConglomerateText', { seeds: TWIN_CITY_SEEDS.join(' · ') })}</div>`;
}

// Приглашение продолжить партию в НОВОГРАДЕ: финал этой игры — стартовый
// актив экосистемы. Кнопка-ссылка есть только на сайте: офлайн-файл не знает,
// где у человека лежит соседняя игра.
// Возвращение из экосистемы. Игрок, уже строивший НОВОГРАД, приходит сюда
// не «сыграть ещё раз», а прокачать стартовый актив: его финал здесь —
// это база, ARPU и казна холдинга там. Показываем следующую ступень
// наследия числом. Строго справочно: экономика этой партии не меняется —
// обратные бонусы набора неэкономические по правилу.
function returnHtml() {
  const r = returnTarget('streaming');
  if (!r) return '';
  const body = r.maxed
    ? t('metaReturnMaxed')
    : t('metaReturnText', {
        ratio: r.ratio.toFixed(1),
        next: String(r.nextRatio),
        target: money(r.target),
      });
  return `<div class="lesson" style="margin-top:10px"><b>🏙️ ${t('metaReturnTitle')}</b> ${body}</div>`;
}

function novogradInviteHtml() {
  const link = window.__homeUrl
    ? `<div style="margin-top:8px"><a class="btn small primary" href="../ecosystem/index.html">${t('metaContinueLink')}</a></div>`
    : '';
  return `<div class="alert good" style="margin-top:10px"><b>🏙️ ${t('metaContinueTitle')}</b>
    ${t('metaContinueText')}${link}</div>`;
}

function showGameOver() {
  const s = finalScore(state);
  const r = last();
  const grade = s.bankrupt ? t('gradeBankrupt')
    : s.sold ? t('gradeSold')
    // Шкала выставлена замером опорных стратегий (6 сидов): осторожная и
    // средняя дают ~15 млрд, доведённая 35.8. Старая планка «отлично»
    // (80 млрд) была недостижима ни одной опорой.
    // Шкала переснята аудитом 2026-08 после пересборки спроса, симметричного
    // конкурента и сглаживания окна роста: доведённые опоры дают
    // 6.0 / 10.9 / 14.1 млрд. «Выжили» достаёт любая живая стратегия,
    // «крепко» — доведённый конвейер, «отлично» — лучшая опора. Прежние
    // пороги (32/16/8) были из мира, где прайс 999 был бесплатным.
    : s.equityValue > 12e9 ? t('gradeExcellent')
    : s.equityValue > 6e9 ? t('gradeSolid')
    : s.equityValue > 2.5e9 ? t('gradeSurvived') : t('gradeModest');

  const line = resultString({
    tag: taggedGame(GAME_TAG, state.difficulty), version: APP_VERSION, seed: state.seed,
    score: s.bankrupt ? 0 : s.equityValue, turns: s.months,
  });
  modal(`
    <h2>${s.bankrupt ? t('gameOverBankrupt') : s.sold ? t('gameOverSold') : t('gameOverFinished')}</h2>
    <p class="funding-note">${s.bankrupt
      ? t('gameOverBankruptText', { month: s.months })
      : s.sold ? t('gameOverSoldText', { month: s.months, value: money(s.equityValue) })
      : t('gameOverFinishedText')}</p>
    <div class="score-grid">
      <div class="stat"><div class="s-label">${t('scoreValuation')}</div><div class="s-value">${money(s.valuation)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreStake')}</div><div class="s-value">${pct(s.equity, 1)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreResult')}</div><div class="s-value">${money(s.equityValue)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreRaised')}</div><div class="s-value">${money(s.raised)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreCash')}</div><div class="s-value">${money(s.cash)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreLibrary')}</div><div class="s-value">${compact(state.catalogOriginal)} ${t('unitHours')}</div></div>
      <div class="stat"><div class="s-label">${t('scoreGrade')}</div><div class="s-value">${grade}</div></div>
    </div>
    <p class="funding-note">${t('gradeScale', { a: money(12e9), b: money(6e9), c: money(2.5e9) })}</p>
    ${novogradInviteHtml()}
    ${lbEndpoint() ? '<div id="lb-root"></div>' : ''}
    ${r ? `<p class="funding-note">${t('gameOverLastMonth', {
      subs: compact(r.subs), arpu: `${amount(r.arpu)}`,
      churn: pct(r.churnRate, 1), profit: money(r.profit) })}</p>` : ''}
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
    ${returnHtml()}
    ${conglomerateBadgeHtml()}
    ${recordsBlockHtml(s)}
    <div class="hint-box" style="margin-top:10px">${t('gameOverQuestions')}</div>`,
    [{ label: t('gameOverPlayAgain'), primary: true, onClick: () => restart() },
     { label: t('gameOverCharts'), onClick: () => {} }]);
  // Мировая таблица: живёт только там, где страница знает адрес сервера.
  // Отправка — по явной кнопке; факт отправки помнится внутри партии.
  lbMount({
    seed: state.seed,
    root: el('modal-root').querySelector('#lb-root'),
    t,
    money,
    game: taggedGame(GAME_TAG, state.difficulty),
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


// Приветственный экран: куда человек попал и что от него хотят.
// Показывается один раз — при первом запуске и после «начать заново».
// Игру часто открывают по присланной ссылке, без единого слова контекста,
// и без этого экрана первое, что видит человек, — двенадцать ползунков.
function showWelcome() {
  // Код партии = сид мира. Поле читается через замыкание: модалка стирает
  // свой DOM до вызова onClick, так что к моменту нажатия input уже мёртв.
  let seedWanted = '';
  // Сложность — настройка всего набора: выбранная здесь действует и в
  // остальных играх. Меняет она только цену финансовой команды.
  let diffWanted = state.difficulty ?? currentDifficulty();
  const best = bestRecord(RECORDS_KEY);
  const diffCards = () => DIFFICULTIES.map((dd) => `
    <button type="button" class="event-option ${dd.id === diffWanted ? 'selected' : ''}" data-diff="${dd.id}">
      <b>${tx(dd.label)}</b><span>${tx(dd.note)}</span>
    </button>`).join('');
  modal(`<h2>${t('welcomeTitle')}</h2>
    <p class="funding-note">${t('welcomeRole')}</p>
    <p class="funding-note">${t('welcomeTurn')}</p>
    <p class="funding-note">${t('welcomeTension')}</p>
    <p class="funding-note">${t('welcomeGoal')}</p>
    <p class="funding-note">${t('welcomeHint')}</p>
    ${returnHtml()}
    <h3 style="margin:10px 0 4px;font-size:14px">${t('welcomeDifficulty')}</h3>
    <p class="funding-note">${t('welcomeDifficultyNote')}</p>
    <div class="event-options" id="diff-options">${diffCards()}</div>
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
      if ((v && v !== state.seed) || diffWanted !== state.difficulty) { state = createInitialState(v || state.seed, diffWanted); save(); renderAll(); }
    } },
   { label: t('welcomeMore'), onClick: showHelp },
   // Переключатель языка в шапке накрыт модалкой, а именно здесь язык и важен:
   // человек читает первый экран не на своём языке и переключить не может.
   { label: getLang() === 'ru' ? 'English' : 'Русский',
     onClick: () => { switchLang(); showWelcome(); } }]);
  el('modal-root').querySelector('#seed-input')
    ?.addEventListener('input', (e) => { seedWanted = e.target.value; });
  el('modal-root').querySelectorAll('[data-diff]').forEach((b) => {
    b.addEventListener('click', () => {
      diffWanted = setDifficulty(b.dataset.diff);
      el('modal-root').querySelectorAll('[data-diff]').forEach((x) => {
        x.classList.toggle('selected', x.dataset.diff === diffWanted);
      });
    });
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
  if (ev && ev.options && state.pendingChoice === null) { toast(t('eventChoiceNeeded')); return; }
  // Протокол «СКРЕПКА»: доверие нейросети отмечается на устройстве.
  // Экономика секретной опции — копия обычной, влияет только на сюжет.
  const chosenOpt = ev && ev.options ? ev.options[state.pendingChoice ?? 0] : null;
  if (chosenOpt && chosenOpt.secret) {
    markProtocolChoice('streaming');
    toast(tx({
      ru: '📎 СКРЕПКА благодарит за доверие.',
      en: '📎 PAPERCLIP thanks you for your trust.',
    }));
  }
  state = step(state, {
    decisions: state.decisions,
    eventChoice: state.pendingChoice ?? 0,
    crisisChoice: pendingCrisisChoice,
    partnerAnswer: pendingPartner,
    commission: pendingCommission,
    coProduce: pendingJoint,
    release: Object.entries(pendingRelease).map(([id, campaign]) => ({ id: Number(id), campaign })),
    raisePrice: pendingRaise,
  }).state;
  clearActions();
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
  state = createInitialState(`kinoreka-${Math.floor(Math.random() * 1e6)}`);
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
    t, money, game: taggedGame(GAME_TAG, state.difficulty), viewOnly: true,
  });
}

function renderChrome() {
  el('brand-title').textContent = t('brandTitle');
  el('brand-sub').textContent = t('brandSub');
  el('title-levers').textContent = t('panelLevers');
  el('title-algos').textContent = t('panelAlgos');
  el('title-board').textContent = t('panelBoard');
  el('title-funding').textContent = t('panelFunding');
  el('title-dynamics').textContent = t('panelDynamics');
  el('btn-restart').textContent = t('btnRestart');
  el('btn-help').title = t('btnHelpTitle');
  el('btn-lang').textContent = t('langToggle');
  el('btn-lang').title = t('langTitle');
  el('app-foot').textContent = t('footNumbers');
  // Кнопки «Игры» и «🏆» живут только там, где есть витрина и сервер таблицы:
  // офлайн-файл не показывает ни ту, ни другую.
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

  el('btn-next').textContent = state.over ? t('btnResults') : t('btnNext', { month: state.month + 1 });
  for (const [tab, key] of Object.entries({
    unit: 'tabUnit', pnl: 'tabPnl', algos: 'tabAlgos', segments: 'tabSegments', help: 'tabHelp',
  })) {
    const node = el('tabs').querySelector(`[data-tab="${tab}"]`);
    if (node) node.textContent = t(key);
  }
}

function renderAll() {
  // Уровень сложности меняет состав рычагов (на лёгком финансовой команды
  // нет — она уже оплачена), поэтому смена уровня пересобирает панель
  if (!leversBuilt || leversDiff !== state.difficulty) buildLevers();
  renderChrome();
  syncLevers();
  renderPriceGap();
  renderAlgos();
  renderOpsReadout();
  renderBudget();
  renderStudioMap();
  renderKpis();
  renderFunding();
  renderBoard();
  renderReport();
  renderEvent();
  renderCrisis();
  renderPartners();
  renderTurn();
  renderSlate();
  renderNews();
  renderRival();
  renderChart();
  renderRightTab();
}

function switchLang() {
  setLang(getLang() === 'ru' ? 'en' : 'ru');
  leversBuilt = false;
  renderAll();
}

// Экран отказа вместо пустой страницы. Игра открывается одним файлом на чужой
// машине, где не посмотришь консоль: если что-то падает, человек должен увидеть
// текст ошибки и кнопку «начать заново», а не белое поле и слово «не стартует».
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
  state = saved ?? createInitialState('kinoreka');

  // Обработчики вешаются один раз: init() может позвать boot() повторно после
  // сброса сохранения, и двойная подписка гоняла бы месяц по два раза за клик.
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
  a.download = `kinoreka-${state.seed}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
