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
import { watchTables } from '../../../../shared/tables.js';
import { money, moneyExact, num, pct, signedPct, compact, axisNum } from '../../../../shared/format.js';
import { drawLineChart, legendHtml, PALETTE } from '../../../../shared/charts.js';
import { resultString, addRecord, loadRecords, bestRecord } from '../../../../shared/records.js';
import {
  conglomerateUnlocked, TWIN_CITY_SEEDS, returnTarget, novogradBest,
} from '../../../../shared/meta.js';
import { lbMount, lbEndpoint } from '../../../../shared/leaderboard.js';
import {
  DIFFICULTIES, difficultyById, currentDifficulty, setDifficulty, taggedGame,
} from '../../../../shared/difficulty.js';
import { policyHtml, syncPolicy, renderBudgetBar } from '../../../../shared/controls.js';
import { STRINGS } from '../strings.js';

const SAVE_KEY = 'biletville-save-v1';
const RECORDS_KEY = 'biletville-records';
const GAME_TAG = 'БИЛЕТВИЛЬ';
// Метка сборки: меняется вместе с полями модели. Сохранение с чужой меткой
// не читается — см. load().
const BUILD = 'tickets-1';
// Версию проставляет сборщик. У модульной версии метки нет — значит это
// исходники, а не раздаваемый файл.
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
let chartTab = 'market';
let rightTab = 'unit';
let leversBuilt = false;
let leversDiff = null;
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
// Полоса бюджета: куда уходят деньги этого месяца. Орган общий для набора
// (shared/controls.js). У маркетплейса статей больше всех в наборе, и до
// сих пор они читались только построчно в P&L.
const BUDGET_COLORS = {
  demand: PALETTE[1],
  supply: PALETTE[2],
  product: PALETTE[4],
  tech: PALETTE[0],
  fixed: '#64748b',
};

// ----------------------------------------------------------------------------
// Схема двустороннего рынка — главный орган БИЛЕТВИЛЯ.
//
// Игра объясняет двусторонний рынок, а показывала его таблицей. Здесь он
// нарисован: организаторы слева, зрители справа, между ними два ваших
// канала — афиша и виджет — и третий, мимо вас: организатор продал сам.
// Толщина полосы — билеты, подпись — оборот. Сверху и снизу то, что этот
// рынок ломает: перекупщики и потерянная заполняемость.
// ----------------------------------------------------------------------------
function renderMarketMap() {
  const box = el('map-slot');
  if (!box) return;
  const r = last();
  const narrow = (box.clientWidth || window.innerWidth) < 600;

  const orgs = Math.round(orgTotal(state));
  const reach = totalReach(state);
  const market = r?.marketTickets ?? 0;
  const platform = r?.platformTickets ?? 0;
  const past = r?.lostTickets ?? 0;
  const maxLane = Math.max(1, market, platform, past);
  const laneW = (v) => Math.max(1.5, 14 * (v / maxLane));

  const lx = narrow ? 180 : 96;
  const ly = narrow ? 56 : 126;
  const rx = narrow ? 180 : 604;
  const ry = narrow ? 316 : 126;
  const rOrg = 26 + 16 * Math.sqrt(Math.min(1, orgs / 400));
  const rAud = 26 + 16 * Math.sqrt(Math.min(1, reach / 3_000_000));

  // Полосы каналов: на широком экране горизонтальные, на узком вертикальные
  const lanes = [
    { key: 'market', label: t('mapLaneMarket'), tickets: market, gmv: r?.gmvMarket ?? 0, color: PALETTE[1], off: -44 },
    { key: 'platform', label: t('mapLanePlatform'), tickets: platform, gmv: r?.gmvPlatform ?? 0, color: PALETTE[2], off: 0 },
    { key: 'past', label: t('mapLanePast'), tickets: past, gmv: 0, color: '#64748b', off: 44, dashed: true },
  ];

  // Подписи на узком экране ложатся прямо на полосу — обводка цветом панели
  // отделяет текст от заливки, иначе светлое на светлом не читается
  const halo = 'paint-order:stroke;stroke:var(--panel);stroke-width:3px;stroke-linejoin:round;';
  const lane = (l) => {
    if (narrow) {
      const x = 180 + l.off * 2.4;
      return `<line x1="${x}" y1="${ly + rOrg + 6}" x2="${x}" y2="${ry - rAud - 6}"
          stroke="${l.color}" stroke-width="${laneW(l.tickets)}" opacity="0.75"
          stroke-dasharray="${l.dashed ? '6 5' : '0'}"/>
        <text x="${x}" y="${(ly + ry) / 2 - 6}" text-anchor="middle" class="m-muted" style="${halo}fill:${l.color}">${l.label}</text>
        <text x="${x}" y="${(ly + ry) / 2 + 10}" text-anchor="middle" class="m-num" style="${halo}">${compact(l.tickets)}</text>`;
    }
    const y = ly + l.off;
    return `<line x1="${lx + rOrg + 6}" y1="${y}" x2="${rx - rAud - 6}" y2="${y}"
        stroke="${l.color}" stroke-width="${laneW(l.tickets)}" opacity="0.75"
        stroke-dasharray="${l.dashed ? '6 5' : '0'}"/>
      <text x="${(lx + rx) / 2}" y="${y - 14}" text-anchor="middle" class="m-muted" style="fill:${l.color}">${l.label}</text>
      <text x="${(lx + rx) / 2}" y="${y + 18}" text-anchor="middle" class="m-muted">${
        t('mapLaneNumbers', { tickets: compact(l.tickets), gmv: l.gmv > 0 ? money(l.gmv) : '—' })}</text>`;
  };

  const node = (x, y, rr, icon, title, value, sub, color) => `
    <g>
      <circle cx="${x}" cy="${y}" r="${rr}" fill="rgba(96,165,250,0.12)" stroke="${color}" stroke-width="1.5"/>
      <text x="${x}" y="${y - 2}" text-anchor="middle">${icon}</text>
      <text x="${x}" y="${y + 14}" text-anchor="middle" class="m-num">${value}</text>
      <text x="${x}" y="${y + rr + 16}" text-anchor="middle" class="m-muted">${title}</text>
      ${sub ? `<text x="${x}" y="${y + rr + 30}" text-anchor="middle" class="m-muted">${sub}</text>` : ''}
    </g>`;

  // Потоки организаторов разведены: ушедшие совсем и перебежавшие к
  // конкуренту — это разные истории, и лечатся они разным.
  const switched = Math.round((r?.orgSwitchedOut ?? 0) - (r?.orgSwitchedIn ?? 0));
  const flows = r ? `
    <text x="${lx}" y="${ly - rOrg - 10}" text-anchor="middle" class="m-muted" style="fill:${PALETTE[1]}">+${num(Math.round(r.orgJoined ?? 0))}</text>
    <text x="${lx}" y="${ly + rOrg + (narrow ? 46 : 44)}" text-anchor="middle" class="m-muted" style="fill:var(--bad)">−${num(Math.round(r.orgLeft ?? 0))}</text>
    ${switched !== 0 ? `<text x="${lx}" y="${ly + rOrg + (narrow ? 60 : 58)}" text-anchor="middle" class="m-muted"
      style="fill:${switched > 0 ? 'var(--bad)' : 'var(--good)'}">${switched > 0 ? '⇄ −' : '⇄ +'}${num(Math.abs(switched))} ${t('mapSwitched')}</text>` : ''}
    ${(r.outageLoss ?? 0) > 0.005 ? `<text x="${narrow ? 348 : 694}" y="${narrow ? 38 : ry - rAud - 12}"
      text-anchor="end" class="m-muted" style="fill:var(--bad)">${
      t('mapOutage', { share: pct(r.outageLoss, 0) })}</text>` : ''}` : '';

  const badges = r ? `
    <text x="${narrow ? 12 : 14}" y="20" class="m-muted"
      style="fill:${(r.fill ?? 0) >= 0.7 ? 'var(--good)' : 'var(--bad)'}">${
      t('mapFillBadge', { fill: pct(r.fill ?? 0, 0) })}</text>
    ${(r.botShare ?? 0) > 0.001 ? `<text x="${narrow ? 12 : 14}" y="38" class="m-muted" style="fill:var(--bad)">🎫 ${
      t('mapBotsBadge', { share: pct(r.botShare, 0) })}</text>` : ''}` : '';

  const viewBox = narrow ? '0 0 360 400' : '0 0 700 250';
  box.innerHTML = `<div class="panel eco-map">
    <h2 class="panel-title">${t('marketMapTitle')}</h2>
    <svg viewBox="${viewBox}" class="${narrow ? 'map-v' : ''}" role="img" aria-label="${t('marketMapTitle')}">
      ${badges}
      ${lanes.map(lane).join('')}
      ${node(lx, ly, rOrg, '🎪', t('mapOrgs'), num(orgs),
        t('mapOrgsSub', { connected: num(r?.connectedCount ?? 0) }), PALETTE[2])}
      ${node(rx, ry, rAud, '👥', t('mapBuyers'), compact(reach),
        t('mapBuyersSub', { share: pct(r?.orgShare ?? 0, 0) }), PALETTE[1])}
      ${flows}
    </svg>
    <div class="chart-caption">${t('marketMapCaption')}</div>
  </div>`;
}

// Живые сводки групп: что механика группы делает прямо сейчас. Считаются от
// последнего отчёта — тех же чисел, что игрок видит в центре экрана.
function renderGroupReadouts() {
  const r = last();
  const take = el('readout-take');
  if (take) {
    take.innerHTML = r ? `<div class="hint-box" style="margin-bottom:10px">
      <div>${t('readoutTake', {
        rate: pct(r.takeRate ?? 0, 1),
        perTicket: money(r.revenuePerTicket ?? 0),
        acquiring: pct((r.gmv ?? 0) > 0 ? (r.acquiring ?? 0) / r.gmv : 0, 1),
      })}</div>
      <div>${t('readoutTakeSplit', {
        market: money(r.marketplaceRevenue ?? 0),
        widget: money((r.platformRevenue ?? 0) + (r.subscriptionRevenue ?? 0)),
      })}</div>
    </div>` : '';
  }
  const growth = el('readout-growth');
  if (growth) {
    growth.innerHTML = r ? `<div class="hint-box" style="margin-bottom:10px">
      <div>${t('readoutSides', {
        orgs: num(Math.round(orgTotal(state))),
        connected: num(r.connectedCount ?? 0),
        share: pct(r.orgShare ?? 0, 0),
      })}</div>
      <div>${t('readoutFill', {
        fill: pct(r.fill ?? 0, 0),
        cls: (r.fill ?? 0) >= 0.7 ? 'pos' : 'neg',
        bots: pct(r.botShare ?? 0, 0),
      })}</div>
    </div>` : '';
  }
  const infra = el('readout-infra');
  if (infra) {
    infra.innerHTML = r ? `<div class="hint-box" style="margin-bottom:10px">
      <div>${t('readoutTrust', {
        trust: pct(state.trust ?? 0, 0),
        cls: (state.trust ?? 0) >= 0.6 ? 'pos' : 'neg',
        service: pct(r.service ?? 0, 0),
      })}</div>
    </div>` : '';
  }
}

function renderBudget() {
  const box = el('budget-slot');
  if (!box) return;
  const d = state.decisions;
  const r = last();
  const items = [
    { key: 'demand', label: t('budgetDemand'), value: d.marketing ?? 0, color: BUDGET_COLORS.demand },
    { key: 'supply', label: t('budgetSupply'), value: (r?.managerCost ?? 0) + (r?.onboardingSpend ?? 0), color: BUDGET_COLORS.supply },
    { key: 'product', label: t('budgetProduct'), value: (d.product ?? 0) + (d.support ?? 0), color: BUDGET_COLORS.product },
    { key: 'tech', label: t('budgetTech'), value: (d.platformDev ?? 0) + (d.capacityTech ?? 0) + (d.rnd ?? 0) + (d.finance ?? 0), color: BUDGET_COLORS.tech },
    { key: 'fixed', label: t('budgetFixed'), value: CONFIG.hqMonthly + (r?.staffCost ?? 0) + (r?.techUpkeep ?? 0) + (r?.serverCost ?? 0) + (r?.miscCost ?? 0), color: BUDGET_COLORS.fixed },
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
// Молча неработающий ползунок — худший вид обучения: игрок двигает его и
// не понимает, почему ничего не происходит.
function inertNote(l) {
  const connected = last()?.connectedCount ?? 0;
  if ((l.key === 'platformRate' || l.key === 'platformFee') && connected === 0) {
    return `<div class="policy-note">🔒 ${t('leverInertPlatform')}</div>`;
  }
  return '';
}

function buildLevers() {
  // Смена уровня сложности меняет состав рычагов: на лёгком финансовой
  // команды нет — она уже оплачена
  if (leversBuilt && leversDiff === state.difficulty) return;
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
  // Режимы политики: кнопка ставит значение, ползунок остаётся для точной
  // настройки (см. shared/controls.js)
  el('levers').querySelectorAll('[data-policy] [data-policy-value]').forEach((b) => {
    b.addEventListener('click', () => {
      const key = b.closest('[data-policy]').dataset.policy;
      const lever = LEVERS.find((l) => l.key === key);
      if (!lever) return;
      state.decisions[key] = Number(b.dataset.policyValue) * (lever.scale ?? 1);
      syncLevers();
      renderTurn();
      renderChannels();
      renderBudget();
      renderGroupReadouts();
      renderMarketMap();
      renderRightTab();
      save();
    });
  });
  for (const l of LEVERS) {
    // Рычага может не быть в панели (на лёгком уровне финансовой команды
    // нет — она уже оплачена), тогда и слушать нечего
    const input = el(`in-${l.key}`);
    if (!input) continue;
    input.addEventListener('input', () => {
      const raw = Number(input.value);
      state.decisions[l.key] = raw * (l.scale ?? 1);
      syncLevers();
      renderTurn();
      renderChannels();
      renderBudget();
      renderGroupReadouts();
      renderMarketMap();
      renderRightTab();
    });
    el('levers').querySelector(`[data-why="${l.key}"]`).addEventListener('click', (e) => {
      e.target.closest('.lever').classList.toggle('open');
    });
  }
  leversBuilt = true;
  leversDiff = state.difficulty;
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
    if (l.policy) syncPolicy(el('levers'), l, value, tx, t('policyCustom'));
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
  // Отдельно: тип выбран, но переезд не оплачен — деньги не идут, и виджет
  // стоит на месте. Это самая частая ловушка новой механики.
  if (r.targetedTypes.length && r.migratedNow < 0.2 && r.onboardingSpend < 1e6
    && r.targetedTypes.some((id) => (r.platformShare[id] ?? 0) < 0.9)) {
    alerts.push(['bad', t('alertNoOnboarding'), 'lever:onboarding']);
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

  // Одна строка «что изменилось»: три главных числа против прошлого хода.
  const p = prev();
  const sm = (v) => (v >= 0 ? '+' : '') + money(v);
  const deltaLine = p ? `<div class="funding-note" style="margin-top:2px">${t('reportDelta', {
    gmv: signedPct(r.gmv / Math.max(1e-9, p.gmv) - 1, 0),
    profit: sm(r.profit - p.profit),
    cash: sm(r.cash - p.cash),
  })}</div>` : '';

  el('report-slot').innerHTML = `<div class="panel">
    <div class="report-head">
      <h3>${t('reportTitle', { month: r.month })}</h3>
      <span class="funding-note">${t('reportHeadStats', {
        gmv: money(r.gmv), revenue: money(r.revenue),
        perTicket: `${num(r.revenuePerTicket)} ₽` })}</span>
    </div>
    ${deltaLine}
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
// ----------------------------------------------------------------------------
// Новости месяца.
//
// В игре про билеты человек ждёт, что в городе что-то происходит: приезжает
// тур, открывается сезон, конкурент меняет тактику. Раньше всё это было
// в модели, но на экран попадало только цифрами — и партия читалась как
// таблица. Здесь то же самое, но словами и про мир, а не про ваши метрики.
// Каждая строка выведена из состояния: выдумывать нечего.
// ----------------------------------------------------------------------------
/**
 * Приток против оттока. Сравниваются округлённые числа — те самые, которые
 * стоят в строке рядом: «пришли 22, ушли 22» с приговором «уходит больше»
 * читается как враньё, даже когда до округления так и было.
 */
function balance(inflow, outflow, goodKey, evenKey, badKey) {
  const a = Math.round(inflow);
  const b = Math.round(outflow);
  if (a > b) return ['good', t(goodKey)];
  if (a < b) return ['warn', t(badKey)];
  return ['', t(evenKey)];
}

function buildNews(r) {
  const news = [];
  const month = state.month;
  // Тактику конкурента сравниваем с прошлым месяцем: новость — это смена,
  // а не сама тактика, которая и так висит в его панели.
  const hist = state.history ?? [];
  const prevStance = hist.length > 1 ? hist[hist.length - 2].rivalStance : null;

  // Главное: что заявлено на следующий месяц. Это и новость, и решение —
  // запас мощности покупается заранее.
  if (r?.hitNext) {
    const def = hitById(r.hitNext.id);
    news.push(['good', t('newsHitNext', { name: tx(def?.name ?? ''), note: tx(def?.note ?? '') })]);
  } else if (r) {
    news.push(['', t('newsHitQuiet')]);
  }

  if (r?.hit) {
    const def = hitById(r.hit.id);
    news.push(['', t('newsHitNow', { name: tx(def?.name ?? ''), note: tx(def?.note ?? '') })]);
  }

  // Сезон: год начинается в сентябре, и театр со стадионом живут наоборот
  const nextSeason = seasonOf(month + 1);
  const nextInYear = (month % 12) + 1;
  if (nextInYear === 1) news.push(['', t('newsSeasonAutumn')]);
  else if (nextSeason === 'summer' && seasonOf(month) !== 'summer') news.push(['', t('newsSeasonSummer')]);
  else if (nextSeason === 'winter' && seasonOf(month) !== 'winter') news.push(['', t('newsSeasonWinter')]);

  // Конкурент сменил тактику — это видно и без нас, но лучше сказать словами
  if (r && r.rivalAlive && r.rivalStance && r.rivalStance !== prevStance) {
    // STANCES здесь — объект по ключу, а не массив: .find на нём падает,
    // и падает только в тот месяц, когда конкурент меняет тактику.
    const st = STANCES[r.rivalStance];
    if (st) news.push(['warn', t('newsRivalStance', { stance: tx(st.name), note: tx(st.hint) })]);
  }

  if (r && r.botShare > 0.08) {
    news.push(['warn', t('newsResellers', { share: pct(r.botShare, 0) })]);
  }
  if (r && r.outageLoss > 0.02) {
    news.push(['bad', t('newsOutage', { share: pct(r.outageLoss, 0) })]);
  }

  if (r && r.advanceWrittenOff > 0) {
    news.push(['bad', t('newsAdvanceLost', { lost: money(r.advanceWrittenOff) })]);
  }
  if (r && r.advanceRecouped > 0) {
    news.push(['', t('newsAdvance', {
      back: money(r.advanceRecouped), left: money(r.advanceOutstanding) })]);
  }

  if (r && (r.orgJoined > 0 || r.orgLeft > 0)) {
    const [kind, verdict] = balance(r.orgJoined, r.orgLeft,
      'newsGrowthGood', 'newsGrowthEven', 'newsGrowthBad');
    news.push([kind, t('newsGrowth', {
      joined: num(r.orgJoined, 0), left: num(r.orgLeft, 0), verdict,
    })]);
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
  // Про мощность напоминаем всегда, но если тур уже объявлен — это не совет,
  // а срочное дело: запас покупается заранее, в день старта продаж поздно.
  if (d.capacityTech < 4_000_000) {
    const soon = r?.hitNext ? hitById(r.hitNext.id) : null;
    todos.push(soon
      ? ['bad', t('todoCapacityUrgentTitle', { name: tx(soon.name) }),
        t('todoCapacityUrgentText'), 'lever:capacityTech']
      : ['warn', t('todoCapacityTitle'), t('todoCapacityText'), 'lever:capacityTech']);
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
    const targeted = Boolean(d.platformFor?.[def.id]);
    const share = clamp(state.platformShare?.[def.id] ?? 0, 0, 1);
    const split = channelSplit(def, share, level);
    // Показываем то, что доходит до вас, а не то, что списывается с покупателя:
    // эквайринг банк берёт с полной суммы билета одинаково в обоих каналах,
    // и на ставке платформы он съедает почти всё. Без этого вычета колонка
    // говорила «40 ₽» там, где на самом деле остаётся пять.
    const acquiring = def.avgPrice * CONFIG.acquiringRate;
    const perMarket = def.avgPrice * (d.buyerFee + d.orgCommission) - acquiring;
    const perPlatform = def.avgPrice * d.platformRate - acquiring;
    // «Нужен виджет 28%» — процент непонятно чего. Человеку нужна не шкала
    // модели, а вывод: без виджета этот тип до вас не дойдёт или дойдёт.
    const need = def.platformNeed >= 1.3 ? 'bad' : def.platformNeed >= 0.5 ? 'warn' : '';
    const needWord = def.platformNeed >= 1.3 ? t('needHigh')
      : def.platformNeed >= 0.5 ? t('needMid') : t('needLow');
    return `<tr>
      <td><b>${tx(def.name)}</b><div class="funding-note">${compact(state.orgs[def.id] ?? 0)} ${t('unitOrgs')}
        · <span class="${need}">${needWord}</span></div></td>
      <td class="mono wide">${t('channelSplitValue', {
        market: pct(split.market, 0), widget: pct(split.platform, 0),
      })} · <span class="neg">${t('channelSplitLost', { lost: pct(split.lost, 0) })}</span></td>
      <td class="mono wide">${t('channelMoneyValue', { market: num(perMarket) })} · <span
        class="${perPlatform < perMarket / 4 ? 'neg' : ''}">${t('channelMoneyWidget', { widget: num(perPlatform) })}</span></td>
      <td class="mono">${share > 0.005
        ? `${pct(share, 0)}<div class="funding-note">${t('channelMoved', {
            moved: compact(Math.round((state.orgs[def.id] ?? 0) * share)),
            total: compact(state.orgs[def.id] ?? 0) })}</div>`
        : (targeted ? t('channelQueued') : t('channelOff'))}</td>
      <td class="wide"><button class="btn small ghost" data-platform="${def.id}">${
        t(targeted ? 'channelDisconnect' : 'channelConnect')}</button></td>
    </tr>`;
  }).join('');

  el('channel-slot').innerHTML = `<div class="panel">
    <h2 class="panel-title">${t('channelPanel')}</h2>
    <div class="funding-note" style="margin-bottom:8px">${t('channelCaption')}</div>
    ${level <= 0.02 ? `<div class="alert warn">${t('channelNoPlatform')}
      <a class="jump" data-jump="lever:platformDev">${t('jumpGo')}</a></div>` : ''}
    <table class="data">
      <thead><tr>
        <th>${t('channelColType')}</th>
        <th>${t('channelColSplit')}</th><th>${t('channelColMoney')}</th>
        <th>${t('channelColState')}</th><th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="funding-note" style="margin-top:8px">${t('channelColMoneyNote')}</div>
    <div class="funding-note">${t('channelLevel', { level: pct(level, 0) })}</div>
  </div>`;

  el('channel-slot').querySelectorAll('[data-platform]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset.platform;
      const was = Boolean(state.decisions.platformFor?.[id]);
      state.decisions.platformFor = { ...state.decisions.platformFor, [id]: !was };
      if (was) toast(t('channelDisconnectWarn'));
      renderChannels();
      renderBudget();
      renderGroupReadouts();
      renderMarketMap();
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
      <td class="mono ${o.preference >= 0.5 ? 'pos' : 'neg'}">${t('supplyPickYou', {
        share: pct(o.preference, 0) })}</td>
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
    <div class="funding-note">${t('fundingNote')}</div>
    ${runwayNote}
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
    const platformDiff = ['theatre', 'concert', 'club', 'sport']
      .some((k) => Boolean(cur.platformFor?.[k]) !== Boolean(prev.platformFor?.[k]));
    if (platformDiff) names.push(t('chartChangePlatform'));
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
  const series = conf.series(state.history);
  const changes = decisionChanges();
  el('chart-legend').innerHTML = legendHtml(series);
  el('chart-caption').innerHTML = t(conf.caption) + changesHtml(changes);
  drawLineChart(el('chart'), series, {
    zeroLine: conf.zeroLine, format: conf.format ?? axisNum, emptyText: t('pnlEmpty'),
    markers: changes.map((c) => c.index),
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
        ${line(t('pnlStaff'), -(r.staffCost ?? 0), 'neg', true)}
        ${line(t('pnlPlatformDev'), -d.platformDev, 'neg', true)}
        ${line(t('pnlPlatformSeats'), -r.platformSeats, 'neg', true)}
        ${line(t('pnlProduct'), -d.product, 'neg', true)}
        ${line(t('pnlSupport'), -d.support, 'neg', true)}
        ${line(t('pnlCapacity'), -d.capacityTech, 'neg', true)}
        ${line(t('pnlRnd'), -d.rnd, 'neg', true)}
        ${line(t('pnlUpkeep'), -(r.techUpkeep ?? 0), 'neg', true)}
        ${line(t('pnlServers'), -(r.serverCost ?? 0), 'neg', true)}
        ${line(t('pnlHq'), -CONFIG.hqMonthly, 'neg', true)}
        ${r.financeCost > 0 ? line(t('pnlFinance'), -r.financeCost, 'neg', true) : ''}
        ${line(t('pnlMisc', { rate: pct(r.miscRate ?? 0, 1) }), -(r.miscCost ?? 0), 'neg', true)}
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
  // Купленный, но ещё не внедрённый алгоритм обязан выглядеть купленным:
  // внедрение происходит при расчёте месяца, и без явного «будет внедрён»
  // кнопка после нажатия перерисовывалась в исходном виде — непонятно,
  // купил ты или нет (и можно было щёлкать ещё).
  const pendingSet = new Set(state.pendingInstall ?? []);
  const rows = ALGORITHMS.map((a) => {
    const installed = state.installed[a.key];
    const pending = !installed && pendingSet.has(a.key);
    const on = Boolean(state.decisions.algoOn?.[a.key]);
    const param = state.decisions.algoParam?.[a.key] ?? 0;
    const locked = !installed && !pending && quality < a.unlock;
    return `<div class="algo ${(installed && on) || pending ? 'on' : ''}">
      <div class="algo-head">
        <b>${tx(a.name)}</b>
        ${installed
          ? `<button class="btn small ${on ? 'primary' : 'ghost'}" data-algo="${a.key}">${on ? t('algosOn') : t('algosOff')}</button>`
          : pending
            ? `<button class="btn small primary" data-cancel-install="${a.key}" title="${t('algosPendingHint')}">${t('algosPending')}</button>`
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
      save();
      renderRightTab();
    });
  });
  el('tab-content').querySelectorAll('[data-install]').forEach((b) => {
    b.addEventListener('click', () => {
      const key = b.dataset.install;
      if (!(state.pendingInstall ?? []).includes(key)) {
        state.pendingInstall = [...(state.pendingInstall ?? []), key];
      }
      state.decisions.algoOn = { ...state.decisions.algoOn, [key]: true };
      save();
      renderRightTab();
      renderTurn();
      toast(t('algosPendingToast', { name: tx(algorithmByKey(key).name) }));
    });
  });
  // Пока месяц не сыгран, покупку можно передумать: деньги ещё не списаны
  el('tab-content').querySelectorAll('[data-cancel-install]').forEach((b) => {
    b.addEventListener('click', () => {
      const key = b.dataset.cancelInstall;
      state.pendingInstall = (state.pendingInstall ?? []).filter((k) => k !== key);
      state.decisions.algoOn = { ...state.decisions.algoOn, [key]: false };
      save();
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
  if (state.over) {
    track(state.over === 'bankrupt' ? 'game_bankrupt' : 'game_finished');
    showGameOver();
  } else {
    maybeDeathFork();
  }
}

// Развилка перед смертью: игрок, который не смотрел на кассу, получает один
// явный шанс осознать положение и поднять раунд — вместо молчаливого краха
// через два хода. Показывается один раз за партию и только пока раунд доступен.
function maybeDeathFork() {
  if (state.over || state.deathWarned) return;
  const r = state.history.at(-1);
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

function gradeOf(score) {
  if (score.bankrupt) return t('gradeBankrupt');
  if (score.orgShare >= 0.45 && score.takeRate >= 0.09) return t('gradeExcellent');
  // Замер опор (6 сидов): осторожная 0.84 млрд, средняя 2.13,
  // размашистая 5.01, доведённая 5.58. Планка «крепко» — средняя опора.
  if (score.equityValue >= 2_500_000_000) return t('gradeSolid');
  if (score.orgShare < 0.25) return t('gradeModest');
  return t('gradeSurvived');
}

// Итог заносится в локальную таблицу рекордов один раз за партию; метка своей
// записи хранится в state, чтобы переоткрытие экрана итогов её не теряло.
function recordsBlockHtml(score) {
  if (!state.recordId) {
    state.recordId = String(Date.now());
    addRecord(RECORDS_KEY, {
      id: state.recordId,
      date: new Date().toISOString().slice(0, 10),
      seed: state.seed,
      score: score.bankrupt ? 0 : Math.round(score.equityValue),
      outcome: score.bankrupt ? 'bankrupt' : 'finished',
      version: APP_VERSION,
      turns: score.months,
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
  const r = returnTarget('tickets');
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
    ? ` <a class="btn small" href="../ecosystem/index.html" style="margin-top:6px;display:inline-block">${t('metaContinueLink')}</a>`
    : '';
  return `<div class="lesson" style="margin-top:10px"><b>🏙️ ${t('metaContinueTitle')}</b> ${t('metaContinueText')}${link}</div>`;
}

function showGameOver() {
  const score = finalScore(state);
  const goals = (state.board?.history ?? [])
    .map((h) => `${t('goalYear', { year: h.year })} ${h.passed ? '✓' : '✗'}`).join(' · ');
  const line = resultString({
    tag: taggedGame(GAME_TAG, state.difficulty), version: APP_VERSION, seed: state.seed,
    score: score.bankrupt ? 0 : score.equityValue, turns: score.months,
  });
  modal(`<h2>${t('overTitle')}</h2>
    <p>${state.over === 'bankrupt'
      ? t('overBankrupt', { month: state.month }) : t('overFinished')}</p>
    <p class="funding-note">${t('overStats', {
      valuation: money(score.valuation), equity: pct(score.equity, 1),
      value: money(score.equityValue), orgs: num(state.history.at(-1)?.orgs ?? 0, 0),
      share: pct(score.orgShare, 0), gmv: money(score.gmv), trust: pct(score.trust, 0),
    })}</p>
    ${goals ? `<p class="funding-note">${t('overGoals', { list: goals })}</p>` : ''}
    <p><b>${gradeOf(score)}</b></p>
    <p class="funding-note">${t('gradeScale', { a: money(2.5e9) })}</p>
    ${lbEndpoint() ? '<div id="lb-root"></div>' : ''}
    ${state.over === 'bankrupt' ? waterfallHtml(state.history.slice(-4)) : ''}
    <h3 style="margin:12px 0 6px">${t('resultTitle')}</h3>
    <p class="funding-note">${t('resultNote')}</p>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <code style="user-select:all;overflow-wrap:anywhere">${line}</code>
      <button class="btn small" id="copy-result" type="button">${t('resultCopy')}</button>
    </div>
    ${novogradInviteHtml()}
    ${returnHtml()}
    ${conglomerateBadgeHtml()}
    ${recordsBlockHtml(score)}
    <div class="hint-box" style="margin-top:10px">${t('overQuestions')}</div>`,
  [{ label: t('overAgain'), primary: true, onClick: restart },
   { label: t('gameOverCharts') }]);
  // Мировая таблица: живёт только там, где страница знает адрес сервера.
  // Отправка — по явной кнопке; факт отправки помнится внутри партии.
  lbMount({
    root: el('modal-root').querySelector('#lb-root'),
    t,
    money,
    game: taggedGame(GAME_TAG, state.difficulty),
    line,
    myScore: score.bankrupt ? 0 : score.equityValue,
    submitted: Boolean(state.lbSent),
    onSubmitted: () => { state.lbSent = true; save(); },
  });
  el('modal-root').querySelector('#copy-result')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(line).then(() => toast(t('resultCopied'))).catch(() => {});
  });
}

function restart() {
  dropSave();
  state = createInitialState(`biletville-${Date.now() % 100000}`);
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
      if ((v && v !== state.seed) || diffWanted !== state.difficulty) { state = createInitialState(v || state.seed, diffWanted); clearActions(); save(); renderAll(); }
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
    + `<p class="funding-note">${t('helpSeedCode', { seed: state.seed })}</p>`
    + `<p class="funding-note">${t('helpAuthor')} ${APP_VERSION === 'dev'
        ? t('helpVersionDev') : t('helpVersion', { version: APP_VERSION, date: APP_BUILD_DATE })}</p>`,
  [{ label: t('helpModalOk'), primary: true }]);
}

// ----------------------------------------------------------------------------
// Отрисовка целиком
// ----------------------------------------------------------------------------
function showWorldTop() {
  modal(`<h2>${t('lbTitle')}</h2><div id="lb-root"></div>`,
    [{ label: t('helpModalOk'), primary: true }]);
  lbMount({
    root: el('modal-root').querySelector('#lb-root'),
    t, money, game: taggedGame(GAME_TAG, state.difficulty), viewOnly: true,
  });
}

function renderAll() {
  el('brand-title').textContent = t('brand');
  el('brand-sub').textContent = t('brandSub');
  el('title-levers').textContent = t('titleLevers');
  el('title-board').textContent = t('boardPanel');
  el('title-funding').textContent = t('fundingTitle');
  el('title-dynamics').textContent = t('chartMarket');
  // Кнопка показывает язык, НА КОТОРЫЙ переключишься, — как в двух других
  // играх и на витрине. Раньше показывала текущий и читалась наоборот.
  el('btn-lang').textContent = t('langToggle');
  el('btn-lang').title = t('langTitle');
  el('btn-restart').textContent = t('btnRestart');
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
  renderNews();
  renderChannels();
  renderBudget();
  renderGroupReadouts();
  renderMarketMap();
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
  state = saved ?? createInitialState('biletville');
  state.pendingInstall = state.pendingInstall ?? [];

  // Обработчики вешаются один раз: init() может позвать boot() повторно после
  // сброса сохранения, и двойная подписка гоняла бы месяц по два раза за клик.
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
