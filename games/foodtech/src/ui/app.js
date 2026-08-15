// ============================================================================
// Слой интерфейса: состояние партии, отрисовка, обработка ввода.
// Вся экономика живёт в src/model — здесь только показ и управление.
// Весь текст берётся из src/i18n.js: t() для строк интерфейса,
// tx() для двуязычных полей модели (районы, рычаги, события, алгоритмы).
// ============================================================================

import { CONFIG, DISTRICTS, CITIES, LEVERS, ALGORITHMS } from '../model/config.js';
import { WEATHER, weatherEffect, seasonOf } from '../model/weather.js';
import { eventById } from '../model/events.js';
import {
  createInitialState, step, explain, unitEconomics, valuation,
  fundingOffer, raise, finalScore, aovOf, ordersPerCourier, districtById,
  algoQuality, dataLevel, rndLevel, algorithmImpact,
} from '../model/engine.js';
import { goalProgress } from '../model/board.js';
import { drawLineChart, legendHtml, PALETTE } from '../../../../shared/charts.js';
import { money, moneyExact, num, pct, signedPct, compact, axisNum, amount, amountIn, isCurUnit, cash, curSymbol } from '../../../../shared/format.js';
import { t, tx, getLang, setLang, detectLang, setStrings } from '../../../../shared/i18n.js';
import { watchTables } from '../../../../shared/tables.js';
import { resultString, addRecord, loadRecords, bestRecord } from '../../../../shared/records.js';
import {
  conglomerateUnlocked, TWIN_CITY_SEEDS, returnTarget, novogradBest,
} from '../../../../shared/meta.js';
import { lbMount, lbEndpoint } from '../../../../shared/leaderboard.js';
import {
  DIFFICULTIES, difficultyById, currentDifficulty, setDifficulty, taggedGame,
} from '../../../../shared/difficulty.js';
import { STRINGS } from '../strings.js';

const SAVE_KEY = 'novoeda-save-v3';
const RECORDS_KEY = 'novoeda-records';
const GAME_TAG = 'НОВОЕДА';
// Метка сборки: меняется вместе с полями модели. Сохранение с чужой меткой
// не читается — см. load().
const BUILD = 'foodtech-2';
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
let chartTab = 'orders';
let rightTab = 'unit';
let leversBuilt = false;
let leversDiff = null;
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
    // Сохранение от другой сборки не читаем: поля модели меняются между
    // версиями, и старое состояние роняет отрисовку — на экране пусто,
    // а причина невидима. Лучше начать неделю заново, чем не начать вовсе.
    if (!saved || saved.build !== BUILD) return null;
    const s = saved.state;
    return s && s.districts && Array.isArray(s.history) ? s : null;
  } catch { return null; }
}
function dropSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* приватный режим */ }
}

const last = () => state.history[state.history.length - 1] ?? null;
const prev = () => state.history[state.history.length - 2] ?? null;

const algoByKey = (key) => ALGORITHMS.find((a) => a.key === key);
const weatherName = (type) => t(`wx${type.charAt(0).toUpperCase()}${type.slice(1)}`);
const seasonName = (season) => t(`season${season.charAt(0).toUpperCase()}${season.slice(1)}`);

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


// ----------------------------------------------------------------------------
// Переходы по подсказкам: синие слова в советах ведут к нужному блоку.
// Правило простое: синий — значит кликабельно. Всё, что просто выделено,
// выделяется жирным, но не синим, — иначе подсказка обещает ссылку, которой нет.
// ----------------------------------------------------------------------------
const JUMP_PANELS = {
  districts: 'districts', levers: 'levers', algos: 'algos',
  funding: 'funding', report: 'report-slot', ops: 'ops-readout',
  weather: 'weather-slot', charts: 'chart', news: 'news-slot', board: 'board',
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

function renderKpis() {
  const r = last();
  const p = prev();
  const burn = r ? r.opex + r.oneOff - r.contribution : 0;
  const runway = burn > 0 ? state.cash / burn : Infinity;

  const parts = [
    kpi(t('kpiWeek'), `${state.week} / ${CONFIG.weeksTotal}`,
      r?.event ? t('kpiWeekEvent') : t('kpiWeekCity')),
    kpi(t('kpiCash'), money(state.cash),
      state.cash < 0 ? t('kpiCashOut')
        : Number.isFinite(runway) ? t('kpiRunway', { weeks: runway.toFixed(0) })
        : t('kpiProfitable'),
      state.cash < 0 ? 'down' : runway < 8 ? 'down' : runway < 20 ? 'neutral' : 'up'),
  ];

  if (r) {
    const [dOrders, cOrders] = delta(r.orders, p?.orders);
    parts.push(
      kpi(t('kpiOrders'), compact(r.orders), dOrders, cOrders),
      kpi(t('kpiProfit'), money(r.profit), t('kpiProfitSub', { value: money(r.contribution) }),
        r.profit >= 0 ? 'up' : 'down'),
      kpi(t('kpiCm'), `${amount(r.cmPerOrder)}`,
        t('kpiTakeRate', { value: pct(r.netRevenue / Math.max(1, r.gmv)) }),
        r.cmPerOrder >= 0 ? 'up' : 'down'),
      kpi(t('kpiDelivery'), t('minutes', { value: num(r.avgDeliveryTime) }),
        t('kpiUtil', { value: pct(r.utilization, 0) }),
        r.avgDeliveryTime <= 35 ? 'up' : r.avgDeliveryTime <= 45 ? 'neutral' : 'down'),
      kpi(t('kpiShare'), pct(r.marketShare), t('kpiCustomers', { value: compact(r.customers) }), 'neutral'),
      kpi(t('kpiEquity'), money(r.equityValue ?? 0), t('kpiEquitySub', { value: pct(state.equity, 1) }), 'neutral'),
    );
  } else {
    parts.push(kpi(t('kpiStart'), money(CONFIG.startCash), t('kpiStartSub'), 'up'));
  }

  el('kpis').innerHTML = parts.join('');
}

// ----------------------------------------------------------------------------
// Рычаги
// ----------------------------------------------------------------------------
function buildLevers() {
  // На лёгком уровне финансовая команда уже собрана и не стоит ничего —
  // ползунок там не решение, а декорация
  el('levers').innerHTML = LEVERS
    .filter((l) => !(l.key === 'finance' && difficultyById(state.difficulty).financeFree))
    .map((l) => `
    <div class="lever" data-key="${l.key}">
      <div class="lever-head">
        <span class="lever-label">${tx(l.label)}</span>
        <span class="lever-value" id="val-${l.key}"></span>
      </div>
      <input type="range" id="in-${l.key}" min="${l.min}" max="${l.max}" step="${l.step}" />
      <button class="lever-why" type="button">${t('leverWhy')}</button>
      <div class="lever-tip">${tx(l.tip)}</div>
    </div>
  `).join('');

  for (const l of LEVERS) {
    // Рычага может не быть в панели (см. фильтр выше) — тогда и слушать нечего
    const input = el(`in-${l.key}`);
    if (!input) continue;
    input.addEventListener('input', () => {
      state.decisions[l.key] = Number(input.value) * (l.scale ?? 1);
      syncLevers();
      renderOpsReadout();
      if (l.key === 'weatherBonus') renderWeather();
      renderRightTab();
      save();
    });
  }
  el('levers').querySelectorAll('.lever-why').forEach((b) => {
    b.addEventListener('click', () => b.closest('.lever').classList.toggle('open'));
  });
  leversBuilt = true;
  leversDiff = state.difficulty;
}

function leverDisplay(l, raw) {
  const unit = tx(l.unit);
  if (l.key === 'marketing' || l.key === 'sales' || l.key === 'tech' || l.key === 'rnd') return money(raw);
  if (unit === '%') return `${raw}%`;
  if (l.key === 'targetCouriers') return num(raw);
  return isCurUnit(unit) ? amountIn(raw, unit) : `${num(raw)} ${unit}`;
}

function syncLevers() {
  for (const l of LEVERS) {
    const raw = state.decisions[l.key] / (l.scale ?? 1);
    const input = el(`in-${l.key}`);
    if (input) input.value = String(raw);
    el(`val-${l.key}`).textContent = leverDisplay(l, raw);
  }
}

// Оперативная сводка под ползунками: сколько курьер заработает и сколько
// заказов увезёт выбранный штат. Считается мгновенно, до перехода к неделе —
// именно здесь видно, что ставка ниже рынка означает «никто не выйдет на смену».
function renderOpsReadout() {
  const active = DISTRICTS.filter((d) => state.decisions.districts?.includes(d.id));
  if (!active.length) {
    el('ops-readout').innerHTML = `<div class="hint-box" style="margin-bottom:12px">${t('opsNoDistrict')}</div>`;
    return;
  }
  const wsum = active.reduce((s, d) => s + d.potential, 0);
  const avgDistance = active.reduce((s, d) => s + d.distanceKm * d.potential, 0) / wsum;

  // Батчинг меняет и производительность курьера, и его ставку за отдельный заказ
  const q = algoQuality(state);
  const batch = state.decisions.algoOn?.batching && state.installed?.batching
    ? (state.decisions.algoParam?.batching ?? 0) : 0;
  const forecastOn = Boolean(state.decisions.algoOn?.forecast && state.installed?.forecast);

  // Штат, набранный сейчас, выйдет на линию на следующей неделе — считаем по её погоде
  const nextType = state.weatherNext ?? 'clear';
  const wxNext = weatherEffect(nextType, state.decisions.weatherBonus ?? 0, state.bonusHabit ?? 0);
  const perCourier = ordersPerCourier(state, avgDistance, (1 + 0.60 * batch * q) * wxNext.capacityMult);
  const payEff = state.decisions.courierPay * (1 - 0.20 * batch * q) + wxNext.payPerOrder;
  const expected = perCourier * CONFIG.courierExpectedLoad * payEff;
  const ratio = expected / CONFIG.courierMarketWeeklyPay;
  const capacity = state.decisions.targetCouriers * perCourier;
  const r = last();
  const demand = r ? r.demand : 0;
  const util = capacity > 0 ? demand / capacity : null;

  const hiring = ratio >= CONFIG.courierHireThreshold + 0.35 ? t('opsHiringQueue')
    : ratio >= CONFIG.courierHireThreshold + 0.1 ? t('opsHiringSteady')
    : ratio >= CONFIG.courierHireThreshold ? t('opsHiringTrickle')
    : t('opsHiringNone');

  // Минимальная ставка, при которой вообще пойдут отклики на этом плече доставки
  const minPay = Math.ceil(
    (CONFIG.courierHireThreshold * CONFIG.courierMarketWeeklyPay)
    / (CONFIG.courierExpectedLoad * perCourier * (1 - 0.20 * batch * q)) / 10) * 10;

  const capacityLine = forecastOn
    ? `<div>${t('opsForecastStaff', {
        target: pct(state.decisions.algoParam?.forecast ?? 0.75, 0),
        couriers: num(r?.couriers ?? 0),
      })}</div>`
    : `<div>${t('opsCapacity', {
        couriers: num(state.decisions.targetCouriers),
        capacity: compact(capacity),
      })}${util !== null && demand > 0
        ? t('opsCapacityUtil', {
            demand: compact(demand),
            util: pct(util, 0),
            cls: util > 1 || util < 0.55 ? 'neg' : 'pos',
          })
        : ''}.</div>`;

  el('ops-readout').innerHTML = `<div class="hint-box" style="margin-bottom:12px">
    <div>${t('opsPerCourier', { orders: num(perCourier), km: avgDistance.toFixed(1) })}</div>
    <div>${t('opsEarnings', {
      pay: money(expected), market: money(CONFIG.courierMarketWeeklyPay),
      cls: ratio >= 1 ? 'pos' : 'neg', ratio: ratio.toFixed(2), hiring,
    })}</div>
    ${capacityLine}
    ${batch > 0 ? `<div>${t('opsBatching', { pay: amount(payEff) })}</div>` : ''}
    ${(WEATHER[nextType]?.severity ?? 0) > 0
      ? `<div>${t('opsWeatherAhead', {
          weather: weatherName(nextType).toLowerCase(),
          lift: signedPct(wxNext.demandMult - 1, 0),
        })}</div>`
      : ''}
    ${ratio < CONFIG.courierHireThreshold
      ? `<div class="neg">${t('opsMinPay', { pay: amount(minPay) })}</div>` : ''}
  </div>`;
}

// ----------------------------------------------------------------------------
// Погода
// ----------------------------------------------------------------------------
function weatherCard(type, when, cls = '') {
  const fx = weatherEffect(type, state.decisions.weatherBonus ?? 0, state.bonusHabit ?? 0);
  const effects = type === 'clear'
    ? t('weatherNoEffect')
    : t('weatherEffects', {
        demand: signedPct(fx.demandMult - 1, 0),
        capacity: signedPct(fx.capacityMult - 1, 0),
        churn: (fx.churnAdd * 100).toFixed(1),
      });
  return `<div class="${cls}">
    <span class="weather-icon">${WEATHER[type]?.icon ?? '☀️'}</span>
    <span class="weather-body">
      <span class="weather-when">${when}</span>
      <div class="weather-name">${weatherName(type)}</div>
      <div class="weather-fx">${effects}</div>
    </span>
  </div>`;
}

function renderWeather() {
  if (state.over) { el('weather-slot').innerHTML = ''; return; }
  const now = state.weather ?? 'clear';
  const next = state.weatherNext ?? 'clear';
  const nextSeverity = WEATHER[next]?.severity ?? 0;

  const bonus = state.decisions.weatherBonus ?? 0;
  const habit = state.bonusHabit ?? 0;
  const advice = nextSeverity >= 0.7 && bonus < 30
    ? `<div class="funding-note" style="flex-basis:100%">${t('weatherAdvice')}</div>` : '';
  // Привычка — то, из-за чего вечная надбавка перестаёт работать. Игрок должен
  // видеть, как она копится, иначе урок останется в исходниках.
  const habitNote = bonus > 0 && habit > 0.35
    ? `<div class="funding-note warn" style="flex-basis:100%">${t('weatherHabit', {
        loss: pct(0.8 * habit, 0) })}</div>` : '';

  el('weather-slot').innerHTML = `<div class="panel">
    <h2 class="panel-title">${t('weatherPanel', {
      season: seasonName(seasonOf(state.week + 1)), week: state.week + 1,
    })}</h2>
    <div class="weather">
      ${weatherCard(now, t('weatherNow'), 'weather-now')}
      ${weatherCard(next, t('weatherNext'), `weather-next ${nextSeverity >= 0.7 ? 'alarm' : ''}`)}
      ${advice}${habitNote}
    </div>
  </div>`;
}

// ----------------------------------------------------------------------------
// Совет директоров: цель квартала.
//
// Цель объявлена заранее и видна каждую неделю, а не только в тринадцатую.
// Смысл именно в этом: игрок должен пересобирать план, зная, к чему идёт.
// ----------------------------------------------------------------------------
function renderBoard() {
  const goal = state.board?.goal;
  const r = last();
  if (!goal) { el('board').innerHTML = `<div class="hint-box">${t('boardDone')}</div>`; return; }
  const p = goalProgress(goal, {
    orders: r?.orders ?? 0,
    cmPerOrder: r?.cmPerOrder ?? 0,
    profitableWeeks: state.board.profitableWeeks,
    customers: r?.customers ?? 0,
    marketShare: r?.marketShare ?? 0,
  });
  let text = '';
  let now = '';
  if (goal.type === 'orders') {
    text = t('goalOrders', { target: num(goal.target, 0) });
    now = num(p.value, 0);
  } else if (goal.type === 'unit') {
    text = t('goalUnit', { target: amount(goal.target), floor: num(goal.ordersFloor, 0) });
    now = `${amount(p.value)}`;
  } else if (goal.type === 'profit') {
    text = t('goalProfit', { target: goal.target, floor: num(goal.customersFloor, 0) });
    now = `${p.value} / ${goal.target}`;
  } else {
    text = t('goalShare', { target: pct(goal.target, 0), floor: num(goal.customersFloor, 0) });
    now = pct(p.value, 0);
  }
  const past = (state.board.history ?? []).map((h) =>
    `<div class="goal-past ${h.passed ? 'pos' : 'neg'}">${t('goalQuarter', { quarter: h.quarter })}: ${
      h.passed ? t('goalPassed') : t('goalFailed')}</div>`).join('');
  const capped = state.restrictions?.marketingCap
    ? `<div class="funding-note neg">${t('goalCapped', {
        cap: money(state.restrictions.marketingCap),
        until: state.restrictions.until })}</div>` : '';
  el('board').innerHTML = `
    <div class="hint-box"><b>${t('goalQuarter', { quarter: goal.quarter })}.</b> ${text}<br>
      <span class="${p.done ? 'pos' : 'neg'}">${t('goalNow', { value: now })}</span></div>
    ${capped}${past}`;
}

// ----------------------------------------------------------------------------
// Новости недели.
//
// Всё это уже было в модели, но попадало на экран только цифрами — и неделя
// читалась как таблица. Здесь то же самое, но словами и про город, а не про
// ваши метрики: что обещают синоптики, кто вышел на смену, где встали заказы.
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
  const week = state.week;

  // Главное в этой игре — что будет на следующей неделе: и надбавку курьерам,
  // и найм надо назначать заранее, задним числом смену не отработаешь.
  const next = state.weatherNext ?? 'clear';
  const nextFx = weatherEffect(next, state.decisions.weatherBonus ?? 0, state.bonusHabit ?? 0);
  const severity = WEATHER[next]?.severity ?? 0;
  if (severity >= 0.6) {
    news.push(['warn', t('newsWeatherHard', {
      weather: weatherName(next).toLowerCase(),
      demand: signedPct(nextFx.demandMult - 1, 0),
      capacity: signedPct(nextFx.capacityMult - 1, 0),
    })]);
  } else if (severity > 0) {
    news.push(['', t('newsWeatherMild', {
      weather: weatherName(next).toLowerCase(),
      demand: signedPct(nextFx.demandMult - 1, 0),
    })]);
  } else {
    news.push(['', t('newsWeatherClear')]);
  }

  // Смена сезона: спрос и погодная таблица меняются целиком
  const nextSeason = seasonOf(week + 1);
  if (nextSeason !== seasonOf(week)) {
    news.push(['', t(`newsSeason${nextSeason.charAt(0).toUpperCase()}${nextSeason.slice(1)}`)]);
  }

  // Курьеры: рынок труда виден по очереди заявок, а не по числу нанятых
  if (r && (r.hires > 0 || r.courierLeft > 0)) {
    const [kind, verdict] = balance(r.hires, r.courierLeft,
      'newsCouriersGood', 'newsCouriersEven', 'newsCouriersBad');
    news.push([kind, t('newsCouriers', {
      hires: num(r.hires, 0), left: num(r.courierLeft, 0), verdict,
    })]);
  }
  if (r && r.applicants < 1 && r.courierLeft > 0) {
    news.push(['bad', t('newsNoApplicants')]);
  }

  // Заказы, которые никто не повёз: спрос был, а машины не нашлось.
  // Спрос проверяем отдельно: в мёртвом городе заказов нет вовсе, и говорить
  // «не повезли сто процентов» там значит врать красивой цифрой.
  if (r && r.orders > 0 && r.fillRate < 0.92) {
    news.push([r.fillRate < 0.8 ? 'bad' : 'warn', t('newsUnserved', {
      share: pct(1 - r.fillRate, 0), time: r.avgDeliveryTime.toFixed(0),
    })]);
  }

  // Районы открываются и закрываются — это видно на карте, но не словами
  for (const id of r?.launched ?? []) {
    news.push(['good', t('newsDistrictOpen', { name: tx(districtById(id)?.name ?? '') })]);
  }
  for (const id of r?.closed ?? []) {
    news.push(['warn', t('newsDistrictClosed', { name: tx(districtById(id)?.name ?? '') })]);
  }

  if (r && (r.newCustomers > 0 || r.lostCustomers > 0)) {
    const [kind, verdict] = balance(r.newCustomers, r.lostCustomers,
      'newsCustomersGood', 'newsCustomersEven', 'newsCustomersBad');
    news.push([kind, t('newsCustomers', {
      came: num(r.newCustomers, 0), left: num(r.lostCustomers, 0), verdict,
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

// ----------------------------------------------------------------------------
// Алгоритмы: качество, карточки, настройки
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
      renderAlgos();
      renderOpsReadout();
      renderRightTab();
      save();
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
      renderRightTab();
      save();
    });
  });
}

// ----------------------------------------------------------------------------
// Районы
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// Карта города
//
// Первая версия была диаграммой: плитки в ряд и ось расстояний под ними.
// Читалась она правильно, но выглядела таблицей, а не городом. Теперь это
// карта: склад в центре, кварталы вокруг него, дороги и река. Расстояние
// перестало быть подписью и стало геометрией — район, до которого дальше
// ехать, и на карте дальше от центра.
//
// Главный смысловой элемент — пунктирный круг: граница, за которой доставка
// перестаёт укладываться в эталонные 35 минут. Она не нарисована на глаз, а
// посчитана по вашим же районам (линейная зависимость времени от плеча), и
// потому двигается вместе с игрой: наняли курьеров — круг раздался, зажали
// ставку и открыли дальний район — сжался.
// ----------------------------------------------------------------------------
function renderCityMap() {
  const box = el('map-slot');
  if (!box) return;
  const r = last();
  const narrow = (box.clientWidth || window.innerWidth) < 620;
  const entered = state.cityEntered ?? { novograd: true };
  const city = CITIES.find((c) => DISTRICTS.some((d) => d.city === c.id && state.districts[d.id]?.active))
    ?? CITIES.find((c) => entered[c.id]) ?? CITIES[0];
  const defs = DISTRICTS.filter((d) => d.city === city.id);
  const byId = Object.fromEntries((r?.districts ?? []).map((d) => [d.id, d]));

  const rows = defs.map((d) => {
    const ds = state.districts[d.id] ?? {};
    const rep = byId[d.id];
    return {
      d,
      live: Boolean(ds.active),
      time: rep?.deliveryTime ?? ds.deliveryTime ?? d.baseTime,
      cm: rep?.cmPerOrder ?? 0,
      orders: rep?.orders ?? 0,
    };
  });

  // Стороны света у кварталов свои: «Северный» обязан быть севернее, а
  // «Заречье» — за рекой. Незнакомый район раскладывается по кругу.
  const DIR = {
    center: -90, sever: -90, univer: 190, zarechie: 15, promzona: 65, zagorod: 130,
    'st-center': -90, 'st-vostok': 20, 'st-port': 110, 'st-sloboda': 205,
  };
  const W = 700;
  const H = 400;
  const cx = 300;
  const cy = 205;
  const maxKm = Math.max(...defs.map((d) => d.distanceKm));
  const maxPot = Math.max(...defs.map((d) => d.potential));
  // Радиус на карте пропорционален корню расстояния: иначе загородный район
  // на девяти километрах уносит все остальные в кучу у центра.
  const rad = (km) => 34 + 150 * Math.sqrt(km / maxKm);
  const size = (pot) => 26 + 26 * Math.sqrt(pot / maxPot);

  const placed = rows.map((row, i) => {
    const ang = ((DIR[row.d.id] ?? (-90 + (360 / rows.length) * i)) * Math.PI) / 180;
    const R = row.d.id === 'center' || row.d.id === 'st-center' ? 0 : rad(row.d.distanceKm);
    return { ...row, x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) * 0.78, rr: size(row.d.potential) };
  });

  // Река рисуется не «где-нибудь справа», а между складом и Заречьем: иначе
  // название района ничем не объясняется. В Старогорске воду держит порт.
  const across = placed.find((p) => p.d.id.endsWith('zarechie'));
  const port = placed.find((p) => p.d.id.endsWith('port'));
  const riverX = across ? (cx + across.x) / 2 : (port ? port.x + port.rr * 1.15 : null);
  if (riverX !== null) {
    // Вода не должна накрывать кварталы: заречный уезжает за берег, остальные
    // сдвигаются на ближний. Расстояния при этом не меняются — они в числах.
    for (const p of placed) {
      if (p === port) continue;
      const clear = p.rr + 34;
      if (p === across) p.x = Math.max(p.x, riverX + clear);
      else if (Math.abs(p.x - riverX) < clear) p.x = riverX - clear;
    }
  }
  const riverPath = (x) => `M ${x - 20} 0 C ${x - 38} 90, ${x + 6} 150, ${x - 22} 205
    C ${x - 48} 258, ${x + 10} 320, ${x - 12} 400 L ${x + 30} 400
    C ${x + 50} 318, ${x - 4} 258, ${x + 22} 205 C ${x + 48} 150, ${x + 6} 92, ${x + 22} 0 Z`;


  // Где кончается норма: время линейно растёт с плечом (по вашим же районам),
  // и мы решаем уравнение «время = эталон» относительно километров
  const live = placed.filter((p) => p.live);
  const pts = (live.length >= 2 ? live : placed).map((p) => [p.d.distanceKm, p.time]);
  const n = pts.length;
  const sx = pts.reduce((a, [x]) => a + x, 0) / n;
  const sy = pts.reduce((a, [, y]) => a + y, 0) / n;
  const denom = pts.reduce((a, [x]) => a + (x - sx) ** 2, 0);
  const slope = denom > 0 ? pts.reduce((a, [x, y]) => a + (x - sx) * (y - sy), 0) / denom : 0;
  const intercept = sy - slope * sx;
  const kmAtRef = slope > 0.01 ? (CONFIG.refDeliveryTime - intercept) / slope : null;
  const refR = kmAtRef !== null && kmAtRef > 0 && kmAtRef <= maxKm * 1.35 ? rad(kmAtRef) : null;

  // Домики внутри квартала: их столько, сколько ресторанов на районе, но не
  // больше девяти — застройка, а не гистограмма
  // Домиков внутри квартала ровно столько, сколько в районе ресторанов, по
  // одному на три десятка. Считать их долей от пула было бы враньём: район
  // с двумя сотнями ресторанов из восьмисот выглядел бы реже, чем район с
  // тремя десятками из шестидесяти.
  // Двенадцати домиков хватает на самый большой пул района (340), поэтому
  // счёт нигде не упирается в потолок и подпись под картой не врёт.
  const PER_HOUSE = 30;
  const blocks = (p) => {
    const cnt = Math.min(12, Math.round((state.districts[p.d.id]?.restaurants ?? 0) / PER_HOUSE));
    const k = p.rr;
    // Домики стоят по краю квартала: середину занимает подпись
    const spots = [[-0.55, 0.45], [0.45, 0.5], [-0.7, -0.32], [0.6, -0.38], [0, 0.62],
      [-0.28, -0.6], [0.28, -0.62], [0.72, 0.08], [-0.82, 0.06],
      [-0.12, -0.86], [0.62, 0.72], [-0.62, 0.74]];
    return spots.slice(0, cnt).map(([ax, ay], i) => `<rect x="${(p.x + ax * k - 5).toFixed(1)}"
      y="${(p.y + ay * k - 4).toFixed(1)}" width="${i % 3 === 0 ? 12 : 9}" height="8"
      rx="1.5" class="m-block"></rect>`).join('');
  };

  const chosen = new Set(state.decisions.districts ?? []);
  const quarter = (p, i) => {
    const planned = !p.live && chosen.has(p.d.id);
    const cls = p.live ? (p.cm >= 0 ? 'm-good' : 'm-bad') : (planned ? 'm-plan' : 'm-off');
    const bad = p.time > CONFIG.refDeliveryTime;
    // Квартал — не круг, а скруглённый многоугольник: так он читается
    // застройкой, а не точкой на графике
    const k = p.rr;
    const shape = `${p.x - k},${p.y - k * 0.62} ${p.x - k * 0.35},${p.y - k * 0.92} `
      + `${p.x + k * 0.72},${p.y - k * 0.78} ${p.x + k},${p.y - k * 0.1} `
      + `${p.x + k * 0.62},${p.y + k * 0.86} ${p.x - k * 0.55},${p.y + k * 0.92} `
      + `${p.x - k * 0.98},${p.y + k * 0.3}`;
    // На телефоне карта ужимается втрое, и мелкие подписи превращаются в шум:
    // в кварталах остаются только имена, числа уходят в список под картой.
    const ly = p.d.id.endsWith('center') ? p.y + 26 : p.y + 12;
    const label = narrow ? '' : `<text x="${p.x}" y="${ly}" text-anchor="middle"
        class="${p.live ? (bad ? 'm-small neg' : 'm-small') : 'm-muted'}">${p.live
        ? `${num(p.time)}${t('mapMin')} · ${amount(p.cm)}`
        : (planned ? t('mapPlanned') : t('mapOpenFor', { cost: money(p.d.launchCost) }))}</text>`;
    return `<g class="m-hit" data-id="${p.d.id}">
      <polygon points="${shape}" class="m-quarter ${cls}"${p.live ? '' : ' stroke-dasharray="5 4"'}></polygon>
      ${p.live ? blocks(p) : ''}
      <text x="${p.x}" y="${p.d.id.endsWith('center') ? p.y - k * 0.45 : p.y + (narrow ? 6 : -4)}"
        text-anchor="middle" class="m-name">${narrow ? i + 1 : tx(p.d.name)}</text>
      ${label}
    </g>`;
  };

  const couriers = r?.couriers ?? state.couriers ?? 0;
  const util = r?.utilization ?? 0;
  const undelivered = r && r.demand > 0 ? 1 - r.orders / r.demand : 0;

  // Список под картой нужен узкому экрану: на телефоне подписи внутри
  // кварталов мельчают, а числа терять нельзя
  const list = placed.map((p, i) => `<li data-id="${p.d.id}"><b>${i + 1}. ${tx(p.d.name)}</b> · ${
    p.d.distanceKm} ${t('mapKmShort')} · ${
    p.live ? `${num(p.time)}${t('mapMin')} · ${amount(p.cm)} ${t('mapPerOrderShort')}`
      : (chosen.has(p.d.id) ? t('mapPlanned')
        : t('mapOpenFor', { cost: money(p.d.launchCost) }))}</li>`).join('');

  box.innerHTML = `<div class="panel eco-map city-map${narrow ? ' narrow' : ''}">
    <h2 class="panel-title">${t('mapTitle', { city: tx(city.name) })}</h2>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('mapTitle', { city: tx(city.name) })}">
      ${riverX !== null ? `<path d="${riverPath(riverX)}" class="m-water"></path>` : ''}
      ${refR ? `<circle cx="${cx}" cy="${cy}" r="${refR}" class="m-ref"></circle>` : ''}
      ${placed.map((p, i) => quarter(p, i)).join('')}
      <circle cx="${cx}" cy="${cy}" r="9" class="m-core"></circle>
      <circle cx="${cx}" cy="${cy}" r="3.5" class="m-core-dot"></circle>
    </svg>
    <div class="map-foot">
      <span class="${util > 1 ? 'neg' : ''}">${t('mapCouriers', {
        couriers: num(couriers), util: pct(util, 0) })}</span>
      <span class="${undelivered > 0.06 ? 'neg' : ''}">${t('mapUndelivered', {
        share: pct(Math.max(0, undelivered), 0) })}</span>
    </div>
    ${refR ? `<div class="funding-note">${t('mapRefRing', {
      min: num(CONFIG.refDeliveryTime), km: num(kmAtRef, 1) })}</div>` : ''}
    ${narrow ? `<ul class="map-list">${list}</ul>` : ''}
    <div class="funding-note">${t('mapLegend')}</div>
  </div>`;

  // Карта — не картинка, а панель управления: район открывается нажатием
  // прямо на квартал, как и на карточку в левой колонке.
  box.querySelectorAll('[data-id]').forEach((node) => {
    node.addEventListener('click', () => toggleDistrict(node.dataset.id));
  });
}

function renderDistricts() {
  const chosen = new Set(state.decisions.districts ?? []);
  const entered = state.cityEntered ?? { novograd: true };
  const card = (d) => {
    const ds = state.districts[d.id] ?? { active: false, deliveryTime: d.baseTime };
    const on = chosen.has(d.id);
    const live = ds.active;
    const stats = live
      ? t('districtStatsLive', {
          customers: compact(ds.customers), restaurants: num(ds.restaurants),
          time: num(ds.deliveryTime), reach: pct(ds.customers / d.potential, 1),
        })
      : t('districtStatsIdle', {
          potential: compact(d.potential), aov: amount(aovOf(d)), km: d.distanceKm,
        });
    return `<div class="district ${on ? 'active' : ''}" data-id="${d.id}">
      <div class="district-head">
        <span class="district-name">${tx(d.name)}</span>
        <span class="badge ${live ? 'on' : ''}">${live
          ? t('districtLive') : t('districtLaunch', { cost: money(d.launchCost) })}</span>
      </div>
      <div class="district-meta">${stats}</div>
      <div class="district-meta">${tx(d.hint)}</div>
    </div>`;
  };
  // Ворота экспансии считаются как в модели: следующая неделя и число
  // выбранных районов дома — они откроются тем же ходом, что и заявка.
  const homeChosen = DISTRICTS
    .filter((d) => d.city === 'novograd' && chosen.has(d.id)).length;
  const gateOpen = state.week + 1 >= CONFIG.expansion.minWeek
    && homeChosen >= CONFIG.expansion.minHomeDistricts;

  // Районы группируются по городам. Домашний город идёт без шапки, чужой —
  // с ценой входа: разовый платёж уходит вместе с запуском первого района.
  el('districts').innerHTML = CITIES.map((c) => {
    const defs = DISTRICTS.filter((d) => d.city === c.id);
    if (!defs.length) return '';
    const badge = entered[c.id]
      ? `<span class="badge on">${t('cityEntered')}</span>`
      : gateOpen
        ? `<span class="badge">${t('cityEntry', { cost: money(c.entryCost) })}</span>`
        : `<span class="badge">${t('cityLocked', {
            week: CONFIG.expansion.minWeek, n: CONFIG.expansion.minHomeDistricts,
          })}</span>`;
    const head = c.home ? '' : `<div class="district-city">
      <div class="district-head">
        <span class="district-name">${tx(c.name)}</span>
        ${badge}
      </div>
      <div class="district-meta">${tx(c.hint)} ${t('cityFixedNote', {
        entry: money(c.entryCost), weekly: money(c.weeklyFixed),
      })}</div>
    </div>`;
    return head + defs.map(card).join('');
  }).join('');

  el('districts').querySelectorAll('.district').forEach((node) => {
    node.addEventListener('click', () => {
      toggleDistrict(node.dataset.id);
    });
  });
}

// Выбор района. Живёт отдельно от отрисовки, потому что нажать район можно
// в двух местах: на карточке в панели и прямо на карте.
function toggleDistrict(id) {
  const def = districtById(id);
  if (!def) return;
  const entered = state.cityEntered ?? { novograd: true };
  const chosen = new Set(state.decisions.districts ?? []);
  const homeChosen = DISTRICTS
    .filter((d) => d.city === 'novograd' && chosen.has(d.id)).length;
  const gateOpen = state.week + 1 >= CONFIG.expansion.minWeek
    && homeChosen >= CONFIG.expansion.minHomeDistricts;
  // В закрытый город заявку не принимаем: молча ждущая галочка, которая
  // сама срабатывает через несколько недель, хуже честного отказа.
  if (!chosen.has(id) && !entered[def.city] && !gateOpen) {
    toast(t('cityLockedToast', {
      week: CONFIG.expansion.minWeek, n: CONFIG.expansion.minHomeDistricts,
    }));
    return;
  }
  if (chosen.has(id)) chosen.delete(id); else chosen.add(id);
  state.decisions.districts = [...chosen];
  renderDistricts();
  renderCityMap();
  renderOpsReadout();
  renderRightTab();
  save();
}

// ----------------------------------------------------------------------------
// Инвестиции
// ----------------------------------------------------------------------------
function renderFunding() {
  const canRaise = state.week >= CONFIG.minWeekForFunding && !state.over;
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

  // Связка «запас хода ↔ раунды»: сколько недель проживёт касса при текущем
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
      valuation: money(v), equity: pct(state.equity, 1), raised: money(state.raisedTotal),
    })}</div>
    ${runwayNote}
    ${rows}
    <div class="funding-note">
      ${t('fundingNote')}
      ${state.week < CONFIG.minWeekForFunding ? t('fundingLocked', { week: CONFIG.minWeekForFunding }) : ''}
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
// Событие недели
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
// Отчёт недели + разбор факторов + предупреждения
// ----------------------------------------------------------------------------
function stat(label, value, sub) {
  return `<div class="stat"><div class="s-label">${label}</div>
    <div class="s-value">${value}</div><div class="s-sub">${sub ?? ''}</div></div>`;
}

function buildAlerts(r) {
  const alerts = [];
  const burn = r.opex + r.oneOff - r.contribution;
  const runway = burn > 0 ? state.cash / burn : Infinity;

  // Пока не открыт ни один район, неделя проходит вхолостую: заказов нет,
  // а расходы идут. Без этой строки человек жмёт «сыграть неделю» ещё и ещё
  // и не понимает, почему во всех графиках ноль.
  if (!(state.decisions.districts ?? []).length) {
    alerts.push(['bad', t('alertNoDistricts'), 'panel:districts']);
  }

  // Промо-война хозяина второго города: цифры Старгорода будут хуже ожиданий,
  // и человек должен видеть почему — и что это закончится.
  if (r.cityWarWeeks > 0) {
    alerts.push(['warn', t('alertCityWar', { weeks: r.cityWarWeeks }), 'panel:districts']);
  }

  if (r.utilization > 1.02) {
    alerts.push(['bad', t('alertShortage', {
      fill: pct(r.fillRate, 0), lost: compact(r.lostOrders), time: num(r.avgDeliveryTime),
    }), 'lever:targetCouriers']);
  } else if (r.utilization < 0.55 && r.couriers > 20) {
    alerts.push(['warn', t('alertIdle', {
      util: pct(r.utilization, 0), cost: amount(CONFIG.hqPerCourier),
    }), 'lever:targetCouriers']);
  }
  if (r.applicants < 1 && r.couriers < r.decisions.targetCouriers) {
    const minPay = Math.ceil((CONFIG.courierHireThreshold * CONFIG.courierMarketWeeklyPay)
      / (CONFIG.courierExpectedLoad * Math.max(1, r.perCourier)) / 10) * 10;
    alerts.push(['bad', t('alertNoApplicants', {
      pay: amount(r.decisions.courierPay), orders: num(r.perCourier),
      market: money(CONFIG.courierMarketWeeklyPay), minPay: amount(minPay),
    }), 'lever:courierPay']);
  } else if (r.courierAttractiveness < 1) {
    alerts.push(['warn', t('alertLowPay', {
      earnings: money(r.courierEarnings), market: money(CONFIG.courierMarketWeeklyPay),
      churn: pct(r.courierLeft / Math.max(1, r.couriers + r.courierLeft), 0),
    }), 'lever:courierPay']);
  }
  if (r.cmPerOrder < 0) {
    alerts.push(['bad', t('alertNegativeCm', { value: amount(r.cmPerOrder) }), 'tab:unit']);
  } else if (r.cmPerOrder > 0 && r.profit < 0) {
    alerts.push(['warn', t('alertBreakEven', {
      cm: amount(r.cmPerOrder), opex: money(r.opex), orders: compact(r.opex / r.cmPerOrder),
    }), 'tab:unit']);
  }
  if (runway < 8 && state.cash >= 0) {
    alerts.push(['bad', t('alertRunway', { weeks: runway.toFixed(0), burn: money(burn) }), 'panel:funding']);
  }
  if (r.restaurants < 5 && r.decisions.sales === 0) {
    alerts.push(['bad', t('alertNoRestaurants'), 'lever:sales']);
  }
  if (r.decisions.marketing === 0 && r.restaurants > 40) {
    alerts.push(['warn', t('alertNoMarketing', {
      decay: pct(CONFIG.awarenessDecay, 0),
      gained: compact(r.newCustomers), lost: compact(r.lostCustomers),
    }), 'lever:marketing']);
  }
  if (r.restaurants < 40 && r.customers > 0) {
    alerts.push(['warn', t('alertFewRestaurants', {
      count: num(r.restaurants), factor: r.avgSelectionFactor.toFixed(2),
    }), 'lever:sales']);
  }
  if (Number.isFinite(r.ltvCac) && r.ltvCac !== null && r.cac > 0) {
    if (r.ltvCac < 1) alerts.push(['bad', t('alertLtvCacBad', { value: r.ltvCac.toFixed(2) })]);
    else if (r.ltvCac > 3) alerts.push(['good', t('alertLtvCacGood', { value: r.ltvCac.toFixed(2) })]);
  }
  if ((WEATHER[r.weather]?.severity ?? 0) >= 0.7 && r.utilization > 1) {
    alerts.push(['bad', t('alertWeatherCrunch', {
      weather: weatherName(r.weather),
      demand: signedPct(r.weatherDemandMult - 1, 0),
      capacity: signedPct(r.weatherCapacityMult - 1, 0),
    }), 'lever:weatherBonus']);
  }
  if (r.weatherBonusCost > 0) {
    alerts.push(['good', t('alertWeatherBonus', {
      cost: money(r.weatherBonusCost), perOrder: amount(r.weatherBonusPerOrder),
    })]);
  }
  const anyAlgoOn = Object.values(r.algoActive ?? {}).some(Boolean);
  if ((r.decisions.rnd ?? 0) > 0 && !anyAlgoOn) {
    alerts.push(['warn', t('alertRndIdle', {
      cost: money(r.decisions.rnd), quality: pct(r.algoQuality, 0),
    }), 'panel:algos']);
  }
  const ready = ALGORITHMS.filter((a) => !state.installed?.[a.key] && r.algoQuality >= a.unlock);
  if (ready.length) {
    alerts.push(['good', t('alertAlgosReady', {
      names: ready.map((a) => tx(a.name)).join(', '), quality: pct(r.algoQuality, 0),
    }), 'panel:algos']);
  }
  if (r.profit > 0) alerts.push(['good', t('alertProfit', { value: money(r.profit) })]);
  return alerts;
}

function renderStartHint() {
  return `<div class="panel">
    <h3 style="margin:0 0 8px">${t('reportWeek0')}</h3>
    <div class="hint-box">
      <b>${t('reportStartTitle')}</b> ${t('reportStartIntro', { cash: money(CONFIG.startCash) })}
      <ol style="margin:6px 0 0 16px;padding:0">
        <li>${t('reportStart1')}</li>
        <li>${t('reportStart2')}</li>
        <li>${t('reportStart3', { market: money(CONFIG.courierMarketWeeklyPay) })}</li>
        <li>${t('reportStart4')}</li>
      </ol>
      ${t('reportStartUnit')}
      <br><br>${t('reportStartAlgos')}
    </div>
  </div>`;
}

function renderReport() {
  const r = last();
  if (!r) { el('report-slot').innerHTML = renderStartHint(); return; }

  // Разбор — точное разложение: строки перемножаются в цифру заголовка.
  // Строка «Итого» показывает произведение, чтобы это было видно, а не
  // принималось на веру.
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
        delta: signedPct(r.orders / Math.max(1e-9, prev().orders) - 1),
      })}</div>
      ${drivers.slice(0, 8).map((d) => {
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
    </div>` : '';

  const alerts = buildAlerts(r);
  const alertsHtml = alerts.length
    ? `<div class="alerts">${alerts.map(([k, text, jump]) => `<div class="alert ${k}">${text}${
        jump ? ` <a class="jump" data-jump="${jump}">${t('jumpGo')}</a>` : ''}</div>`).join('')}</div>`
    : '';

  const ev = r.event ? eventById(r.event.id) : null;
  const eventNote = ev ? `<div class="lesson"><b>${tx(ev.title)}.</b> ${tx(ev.lesson)}</div>` : '';

  const installNote = r.installedNow?.length
    ? `<div class="alert good" style="margin-top:8px">${t('installNote', {
        names: r.installedNow.map((k) => tx(algoByKey(k)?.name)).join(', '),
        cost: money(r.installCost),
      })}</div>` : '';
  const launchNote = r.launched.length
    ? `<div class="alert warn" style="margin-top:8px">${t('launchNote', {
        names: r.launched.map((id) => tx(districtById(id)?.name)).join(', '),
        cost: money(r.launchCost),
      })}</div>` : '';
  const cityNote = r.enteredCities?.length
    ? `<div class="alert warn" style="margin-top:8px">${t('cityEnterNote', {
        names: r.enteredCities.map((id) => tx(CITIES.find((c) => c.id === id)?.name)).join(', '),
        cost: money(r.cityEntryCost ?? 0),
      })}</div>` : '';

  // Одна строка «что изменилось»: три главных числа против прошлого хода.
  // Подробный разбор ниже, но начинать чтение отчёта удобно с дельты.
  const p = prev();
  const sm = (v) => (v >= 0 ? '+' : '') + money(v);
  const deltaLine = p ? `<div class="funding-note" style="margin-top:2px">${t('reportDelta', {
    orders: signedPct(r.orders / Math.max(1e-9, p.orders) - 1, 0),
    profit: sm(r.profit - p.profit),
    cash: sm(r.cash - p.cash),
  })}</div>` : '';

  el('report-slot').innerHTML = `<div class="panel">
    <div class="report-head">
      <h3>${t('reportTitle', { week: r.week })}</h3>
      <span class="funding-note">${t('reportHeadStats', {
        gmv: money(r.gmv), revenue: money(r.netRevenue),
        take: pct(r.netRevenue / Math.max(1, r.gmv)),
      })}</span>
    </div>
    ${deltaLine}
    <div class="report-grid">
      ${stat(t('statOrders'), compact(r.orders),
        t('statOrdersSub', { demand: compact(r.demand), lost: compact(r.lostOrders) }))}
      ${stat(t('statCustomers'), compact(r.customers),
        `+${compact(r.newCustomers)} / −${compact(r.lostCustomers)}`)}
      ${stat(t('statCouriers'), num(r.couriers),
        t('statCouriersSub', { hires: num(r.hires), left: num(r.courierLeft), perCourier: num(r.perCourier) }))}
      ${stat(t('statRestaurants'), num(r.restaurants),
        t('statRestaurantsSub', { value: r.avgSelectionFactor.toFixed(2) }))}
      ${stat(t('statDeliveryTime'), t('minutes', { value: num(r.avgDeliveryTime) }),
        t('kpiUtil', { value: pct(r.utilization, 0) }))}
      ${stat(t('statWeather'), `${WEATHER[r.weather]?.icon ?? ''} ${weatherName(r.weather)}`,
        r.weather === 'clear' ? t('statWeatherNone')
          : t('statWeatherSub', {
              demand: signedPct(r.weatherDemandMult - 1, 0),
              capacity: signedPct(r.weatherCapacityMult - 1, 0),
            }))}
      ${stat(t('statCm'), `${amount(r.cmPerOrder)}`,
        t('statCmSub', { value: pct(r.cmPerOrder / Math.max(1, r.gmv / Math.max(1, r.orders))) }))}
      ${stat(t('statProfit'), money(r.profit), t('statProfitSub', { value: money(r.opex) }))}
      ${stat(t('statCacLtv'), r.cac > 0 ? `${amount(r.cac)}` : '—',
        r.ltvCac ? `LTV/CAC ${r.ltvCac.toFixed(2)}` : t('statCacOff'))}
    </div>
    ${installNote}
    ${cityNote}
    ${launchNote}
    ${driversHtml}
    ${alertsHtml}
    ${eventNote}
  </div>`;
}

// ----------------------------------------------------------------------------
// Графики
// ----------------------------------------------------------------------------
const CHART_TABS = {
  orders: {
    label: 'chartOrders', caption: 'chartOrdersCaption',
    series: (h) => [
      { label: t('chartDemandSeries'), data: h.map((r) => r.demand), color: PALETTE[1] },
      { label: t('chartServedSeries'), data: h.map((r) => r.orders), color: PALETTE[0] },
    ],
  },
  money: {
    label: 'chartMoney', caption: 'chartMoneyCaption', zeroLine: true, money: true,
    series: (h) => [
      { label: t('seriesRevenue'), data: h.map((r) => r.netRevenue), color: PALETTE[1] },
      { label: t('seriesContribution'), data: h.map((r) => r.contribution), color: PALETTE[0] },
      { label: t('seriesProfit'), data: h.map((r) => r.profit), color: PALETTE[3] },
    ],
  },
  cash: {
    label: 'chartCash', caption: 'chartCashCaption', zeroLine: true, money: true,
    series: (h) => [{ label: t('chartCash'), data: h.map((r) => r.cash), color: PALETTE[2] }],
  },
  unit: {
    label: 'chartUnit', caption: 'chartUnitCaption', zeroLine: true, money: true,
    series: (h) => [{ label: t('seriesCmPerOrder'), data: h.map((r) => r.cmPerOrder), color: PALETTE[0] }],
  },
  ops: {
    label: 'chartOps', caption: 'chartOpsCaption',
    format: (v) => `${Math.round(v)}`,
    series: (h) => [
      { label: t('seriesDeliveryTime'), data: h.map((r) => r.avgDeliveryTime), color: PALETTE[3] },
      { label: t('seriesUtilisation'), data: h.map((r) => r.utilization * 100), color: PALETTE[2] },
    ],
  },
  supply: {
    label: 'chartSupply', caption: 'chartSupplyCaption',
    format: (v) => `${Math.round(v)}`,
    series: (h) => [
      { label: t('seriesCouriers'), data: h.map((r) => r.couriers), color: PALETTE[4] },
      { label: t('seriesRestaurants'), data: h.map((r) => r.restaurants), color: PALETTE[5] },
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
  customers: {
    label: 'chartCustomers', caption: 'chartCustomersCaption',
    series: (h) => [
      { label: t('seriesCustomers'), data: h.map((r) => r.customers), color: PALETTE[1] },
      { label: t('seriesNewCustomers'), data: h.map((r) => r.newCustomers), color: PALETTE[0] },
      { label: t('seriesLostCustomers'), data: h.map((r) => r.lostCustomers), color: PALETTE[2] },
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
    if ((cur.districts ?? []).length !== (prev.districts ?? []).length) names.push(t('chartChangeDistricts'));
    for (const a of ALGORITHMS) {
      if (Boolean(cur.algoOn?.[a.key]) !== Boolean(prev.algoOn?.[a.key])) names.push(tx(a.name));
    }
    if (names.length) out.push({ index: i, turn: hist[i].week, names });
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
  });
}

// ----------------------------------------------------------------------------
// Правая колонка
// ----------------------------------------------------------------------------
function renderUnitTab() {
  const u = unitEconomics(state, state.decisions);
  const r = last();
  const row = (name, value, cls = '', sub = false) =>
    `<tr class="${sub ? 'sub' : ''}"><td>${name}</td><td class="${cls}">${amount(value)}</td><td class="${cls}">${pct(value / u.aov, 1)}</td></tr>`;

  const breakEven = r && u.contribution > 0 ? r.opex / u.contribution : null;

  return `
    <p class="funding-note">${t('unitIntro')}</p>
    <table class="data">
      <thead><tr><th>${t('unitColItem')}</th><th>${t('unitColPerOrder')}</th><th>${t('unitColShare')}</th></tr></thead>
      <tbody>
        <tr><td><b>${t('unitAov')}</b></td><td><b>${amount(u.aov)}</b></td><td>100%</td></tr>
        ${row(t('unitCommission', { rate: pct(u.commission, 0) }), u.commissionRevenue, 'pos', true)}
        ${row(t('unitFee'), u.feeRevenue, 'pos', true)}
        <tr class="total"><td>${t('unitRevenue')}</td><td class="pos">${amount(u.revenue)}</td><td class="pos">${pct(u.takeRate, 1)}</td></tr>
        ${row(t('unitCourier'), -u.courier, 'neg', true)}
        ${row(t('unitPromo'), -u.promo, 'neg', true)}
        ${row(t('unitPayment'), -u.payment, 'neg', true)}
        ${row(t('unitSupport'), -u.support, 'neg', true)}
        <tr class="total"><td>${t('unitContribution')}</td>
          <td class="${u.contribution >= 0 ? 'pos' : 'neg'}">${amount(u.contribution)}</td>
          <td class="${u.contribution >= 0 ? 'pos' : 'neg'}">${pct(u.marginOfGmv, 1)}</td></tr>
      </tbody>
    </table>
    <p class="funding-note" style="margin-top:10px">${t('unitTakeRateNote', { value: pct(u.takeRate, 1) })}</p>
    ${breakEven ? `<div class="hint-box" style="margin-top:10px">${t('unitBreakEven', {
      opex: money(r.opex), orders: compact(breakEven), current: compact(r.orders),
    })}</div>` : u.contribution <= 0
      ? `<div class="hint-box" style="margin-top:10px">${t('unitNoBreakEven')}</div>` : ''}
    ${r ? `<h4 style="margin:14px 0 6px;font-size:13px">${t('unitAcquisition')}</h4>
    <table class="data"><tbody>
      <tr><td>${t('unitCac')}</td><td>${r.cac > 0 ? `${amount(r.cac)}` : '—'}</td></tr>
      <tr><td>${t('unitFrequency')}</td><td>${t('unitFrequencyValue', {
        value: (r.customers > 0 ? r.orders / r.customers : 0).toFixed(2),
      })}</td></tr>
      <tr><td>${t('unitLtv')}</td><td>${amount(r.ltv)}</td></tr>
      <tr class="total"><td>LTV / CAC</td><td class="${(r.ltvCac ?? 0) >= 3 ? 'pos' : (r.ltvCac ?? 0) < 1 ? 'neg' : ''}">${r.ltvCac ? r.ltvCac.toFixed(2) : '—'}</td></tr>
    </tbody></table>
    <p class="funding-note">${t('unitLtvCacNote')}</p>` : ''}
  `;
}

function renderPnlTab() {
  const r = last();
  if (!r) return `<p class="funding-note">${t('pnlEmpty')}</p>`;
  const line = (name, v, cls = '', sub = false) =>
    `<tr class="${sub ? 'sub' : ''}"><td>${name}</td><td class="${cls}">${moneyExact(v)}</td></tr>`;
  return `
    <table class="data">
      <tbody>
        <tr><td><b>${t('pnlGmv')}</b></td><td>${moneyExact(r.gmv)}</td></tr>
        ${line(t('pnlCommission'), r.commissionRevenue, 'pos', true)}
        ${line(t('unitFee'), r.feeRevenue, 'pos', true)}
        <tr class="total"><td>${t('pnlRevenue')}</td><td class="pos">${moneyExact(r.netRevenue)}</td></tr>
        ${line(t('pnlCourier'), -r.courierCost, 'neg', true)}
        ${r.weatherBonusCost > 0 ? line(t('pnlWeatherBonus'), -r.weatherBonusCost, 'neg', true) : ''}
        ${line(t('pnlPromo'), -r.promoCost, 'neg', true)}
        ${line(t('unitPayment'), -r.paymentCost, 'neg', true)}
        ${line(t('pnlSupport'), -r.supportCost, 'neg', true)}
        <tr class="total"><td>${t('pnlContribution')}</td><td class="${r.contribution >= 0 ? 'pos' : 'neg'}">${moneyExact(r.contribution)}</td></tr>
        ${line(t('pnlDistricts'), -r.districtFixed, 'neg', true)}
        ${line(t('pnlHq'), -(r.hqCost - (r.techUpkeep ?? 0) - (r.serverCost ?? 0)), 'neg', true)}
        ${line(t('pnlUpkeep'), -(r.techUpkeep ?? 0), 'neg', true)}
        ${line(t('pnlServers'), -(r.serverCost ?? 0), 'neg', true)}
        ${line(t('pnlMarketing'), -r.decisions.marketing, 'neg', true)}
        ${line(t('pnlSales'), -r.decisions.sales, 'neg', true)}
        ${line(t('pnlTech'), -r.decisions.tech, 'neg', true)}
        ${line(t('pnlRnd'), -(r.decisions.rnd ?? 0), 'neg', true)}
        ${r.financeCost > 0 ? line(t('pnlFinance'), -r.financeCost, 'neg', true) : ''}
        ${line(t('pnlMisc', { rate: pct(r.miscRate ?? 0, 1) }), -(r.miscCost ?? 0), 'neg', true)}
        <tr class="total"><td>${t('pnlOperatingProfit')}</td><td class="${r.profit >= 0 ? 'pos' : 'neg'}">${moneyExact(r.profit)}</td></tr>
        ${r.oneOff > 0 ? line(t('pnlOneOff'), -r.oneOff, 'neg', true) : ''}
        <tr class="total"><td>${t('pnlCashChange')}</td><td class="${(r.profit - r.oneOff) >= 0 ? 'pos' : 'neg'}">${moneyExact(r.profit - r.oneOff)}</td></tr>
      </tbody>
    </table>
    <p class="funding-note" style="margin-top:10px">${t('pnlNote')}</p>`;
}

function renderDistrictsTab() {
  const r = last();
  if (!r || !r.districts.length) return `<p class="funding-note">${t('districtsEmpty')}</p>`;
  const name = (d) => tx(districtById(d.id)?.name);
  return `
    <table class="data">
      <thead><tr><th>${t('colDistrict')}</th><th>${t('colOrders')}</th><th>${t('colMinutes')}</th><th>${t('colReach')}</th><th>${t('colContribution')}</th></tr></thead>
      <tbody>
        ${r.districts.map((d) => `<tr>
          <td>${name(d)}</td>
          <td>${compact(d.orders)}</td>
          <td>${num(d.deliveryTime)}</td>
          <td>${pct(d.penetration, 1)}</td>
          <td class="${d.contribution >= 0 ? 'pos' : 'neg'}">${money(d.contribution)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <p class="funding-note" style="margin-top:8px">${t('districtsNote')}</p>
    <table class="data" style="margin-top:10px">
      <thead><tr><th>${t('colDistrict')}</th><th>${t('colPriceFactor')}</th><th>${t('colSpeedFactor')}</th><th>${t('colSelectionFactor')}</th><th>${t('colAwareness')}</th></tr></thead>
      <tbody>
        ${r.districts.map((d) => `<tr>
          <td>${name(d)}</td>
          <td class="${d.priceFactor >= 1 ? 'pos' : 'neg'}">${d.priceFactor.toFixed(2)}</td>
          <td class="${d.speedFactor >= 1 ? 'pos' : 'neg'}">${d.speedFactor.toFixed(2)}</td>
          <td class="${d.selectionFactor >= 1 ? 'pos' : 'neg'}">${d.selectionFactor.toFixed(2)}</td>
          <td>${pct(d.awareness, 0)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <p class="funding-note" style="margin-top:8px">${t('factorsNote')}</p>
    <p class="funding-note">${t('districtsFactorsNote')}</p>`;
}

function renderAlgosTab() {
  const r = last();
  const q = algoQuality(state);
  const impact = r ? algorithmImpact(state) : [];
  const totalGain = impact.reduce((sum, i) => sum + i.profit, 0);
  const rndSpend = state.decisions.rnd ?? 0;

  const table = impact.length ? `
    <table class="data">
      <thead><tr><th>${t('algosColName')}</th><th>${t('algosColProfit')}</th><th>${t('colOrders')}</th><th>${t('colMinutes')}</th></tr></thead>
      <tbody>
        ${impact.map((i) => `<tr>
          <td>${tx(algoByKey(i.key)?.name)}</td>
          <td class="${i.profit >= 0 ? 'pos' : 'neg'}">${i.profit >= 0 ? '+' : ''}${compact(i.profit)}</td>
          <td class="${i.orders >= 0 ? 'pos' : 'neg'}">${i.orders >= 0 ? '+' : ''}${compact(i.orders)}</td>
          <td class="${i.deliveryTime <= 0 ? 'pos' : 'neg'}">${i.deliveryTime >= 0 ? '+' : ''}${i.deliveryTime.toFixed(1)}</td>
        </tr>`).join('')}
        <tr class="total"><td>${t('algosTotal')}</td>
          <td class="${totalGain >= 0 ? 'pos' : 'neg'}">${totalGain >= 0 ? '+' : ''}${compact(totalGain)}</td>
          <td colspan="2"></td></tr>
        <tr class="total"><td>${t('algosTeamCost')}</td>
          <td class="neg">−${compact(rndSpend)}</td><td colspan="2"></td></tr>
        <tr class="total"><td>${t('algosNet')}</td>
          <td class="${totalGain - rndSpend >= 0 ? 'pos' : 'neg'}">${totalGain - rndSpend >= 0 ? '+' : ''}${compact(totalGain - rndSpend)}</td>
          <td colspan="2"></td></tr>
      </tbody>
    </table>
    <p class="funding-note" style="margin-top:8px">${t('algosCounterfactual')}</p>`
    : `<p class="funding-note">${t('algosNone')}</p>`;

  const zero = impact.filter((i) => Math.abs(i.profit) < 1000);
  const zeroNote = zero.length
    ? `<div class="hint-box" style="margin-top:10px">${t('algosZeroNote', {
        names: zero.map((i) => tx(algoByKey(i.key)?.name)).join(', '),
      })}</div>` : '';

  return `
    <p class="funding-note">${t('algosTabQuality', {
      quality: pct(q, 0), data: pct(dataLevel(state), 0), team: pct(rndLevel(state), 0),
    })}</p>
    ${table}
    ${zeroNote}
    <h4 style="margin:14px 0 6px;font-size:13px">${t('algosVsSlider')}</h4>
    <p class="funding-note">${t('algosVsSliderText')}</p>
    ${ALGORITHMS.map((a) => `<div style="margin-top:10px">
      <b style="font-size:12px">${tx(a.name)}</b>
      <div class="funding-note">${tx(a.lesson)}</div>
    </div>`).join('')}
  `;
}

function renderHelpTab() {
  return `<div class="help">
    <h4>${t('helpWhatTitle')}</h4>
    <p>${t('helpWhatText')}</p>

    <h4>${t('helpDemandTitle')}</h4>
    <div class="formula">${t('helpDemandFormula')}</div>
    <p>${t('helpDemandText')}</p>

    <h4>${t('helpSupplyTitle')}</h4>
    <div class="formula">${t('helpSupplyFormula')}</div>
    <p>${t('helpSupplyText')}</p>

    <h4>${t('helpWeatherTitle')}</h4>
    <p>${t('helpWeatherText')}</p>

    <h4>${t('helpCityTitle')}</h4>
    <p>${t('helpCityText')}</p>

    <h4>${t('helpSpiralsTitle')}</h4>
    <ul>
      <li>${t('helpSpiralSpeed')}</li>
      <li>${t('helpSpiralPromo')}</li>
      <li>${t('helpSpiralCommission')}</li>
      <li>${t('helpSpiralPay')}</li>
    </ul>

    <h4>${t('helpWatchTitle')}</h4>
    <ul>
      <li>${t('helpWatchCm')}</li>
      <li>${t('helpWatchUtil')}</li>
      <li>${t('helpWatchLtv')}</li>
      <li>${t('helpWatchRunway')}</li>
    </ul>

    <h4>${t('helpAlgosTitle')}</h4>
    <p>${t('helpAlgosText')}</p>
    <div class="formula">${t('helpAlgosFormula')}</div>
    <p>${t('helpAlgosOrder')}</p>
    <ul>
      ${ALGORITHMS.map((a) => `<li><b>${tx(a.name)}.</b> ${tx(a.tradeoff)}</li>`).join('')}
    </ul>
    <p>${t('helpAlgosCheck')}</p>

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
  const content = {
    unit: renderUnitTab,
    pnl: renderPnlTab,
    algos: renderAlgosTab,
    districts: renderDistrictsTab,
    help: renderHelpTab,
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

// Развилка перед смертью: игрок, который не смотрел на кассу, получает один
// явный шанс осознать положение и поднять раунд — вместо молчаливого краха
// через два хода. Показывается один раз за партию и только пока раунд доступен.
function maybeDeathFork() {
  if (state.over || state.deathWarned) return;
  const r = last();
  if (!r || r.profit >= 0) return;
  const burn = -r.profit;
  if (state.cash >= burn * 2) return;
  if (state.week < CONFIG.minWeekForFunding) return;
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

// Водопад последних недель: на экране смерти видно не «вы банкрот», а из
// каких потоков это сложилось — выручка, расходы, итог недели, касса.
function waterfallHtml(rows) {
  if (!rows.length) return '';
  const cell = (v) => `<td>${money(v)}</td>`;
  const line = (label, fn) => `<tr><td>${label}</td>${rows.map((r) => cell(fn(r))).join('')}</tr>`;
  return `<h3 style="margin:12px 0 6px">${t('deathWaterfall')}</h3>
    <div style="overflow-x:auto"><table class="data">
    <thead><tr><th></th>${rows.map((r) => `<th>${t('wfTurn', { n: r.week })}</th>`).join('')}</tr></thead>
    <tbody>
      ${line(t('wfRevenue'), (r) => r.netRevenue)}
      ${line(t('wfCosts'), (r) => r.netRevenue - r.profit + r.oneOff)}
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
      outcome: s.bankrupt ? 'bankrupt' : 'finished',
      version: APP_VERSION,
      turns: s.weeks,
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
  const r = returnTarget('delivery');
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
  const s = finalScore(state);
  const r = last();
  const grade = s.bankrupt ? t('gradeBankrupt')
    // Шкала выставлена замером опорных стратегий (6 сидов): осторожная даёт
    // 3.9 млрд, средняя 5.6, размашистая 9.9, доведённая 8.3. Старая шкала
    // (3/1/0.3 млрд) ставила «отлично» даже осторожной игре.
    : s.equityValue > 10e9 ? t('gradeExcellent')
    : s.equityValue > 5.5e9 ? t('gradeSolid')
    : s.equityValue > 2e9 ? t('gradeSurvived') : t('gradeModest');

  const line = resultString({
    tag: taggedGame(GAME_TAG, state.difficulty), version: APP_VERSION, seed: state.seed,
    score: s.bankrupt ? 0 : s.equityValue, turns: s.weeks,
  });
  modal(`
    <h2>${s.bankrupt ? t('gameOverBankrupt') : t('gameOverFinished')}</h2>
    <p class="funding-note">${s.bankrupt
      ? t('gameOverBankruptText', { week: s.weeks }) : t('gameOverFinishedText')}</p>
    <div class="score-grid">
      <div class="stat"><div class="s-label">${t('scoreValuation')}</div><div class="s-value">${money(s.valuation)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreStake')}</div><div class="s-value">${pct(s.equity, 1)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreResult')}</div><div class="s-value">${money(s.equityValue)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreRaised')}</div><div class="s-value">${money(s.raised)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreCash')}</div><div class="s-value">${money(s.cash)}</div></div>
      <div class="stat"><div class="s-label">${t('scoreGrade')}</div><div class="s-value">${grade}</div></div>
    </div>
    <p class="funding-note">${t('gradeScale', { a: money(10e9), b: money(5.5e9), c: money(2e9) })}</p>
    ${lbEndpoint() ? '<div id="lb-root"></div>' : ''}
    ${r ? `<p class="funding-note">${t('gameOverLastWeek', {
      orders: compact(r.orders), cm: amount(r.cmPerOrder), profit: money(r.profit),
      share: pct(r.marketShare), time: num(r.avgDeliveryTime),
    })}</p>` : ''}
    ${s.bankrupt ? waterfallHtml(state.history.slice(-4)) : ''}
    <h3 style="margin:12px 0 6px">${t('resultTitle')}</h3>
    <p class="funding-note">${t('resultNote')}</p>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <code style="user-select:all;overflow-wrap:anywhere">${line}</code>
      <button class="btn small" id="copy-result" type="button">${t('resultCopy')}</button>
    </div>
    ${novogradInviteHtml()}
    ${returnHtml()}
    ${conglomerateBadgeHtml()}
    ${recordsBlockHtml(s)}
    <div class="hint-box" style="margin-top:10px">${t('gameOverQuestions')}</div>
  `, [
    { label: t('gameOverPlayAgain'), primary: true, onClick: () => restart() },
    { label: t('gameOverCharts'), onClick: () => {} },
  ]);
  // Мировая таблица: живёт только там, где страница знает адрес сервера.
  // Отправка — по явной кнопке; факт отправки помнится внутри партии.
  lbMount({
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
      if ((v && v !== state.seed) || diffWanted !== state.difficulty) {
        state = createInitialState(v || state.seed, diffWanted);
        save();
        renderAll();
      }
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
function nextWeek() {
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

// Статические подписи разметки
function showWorldTop() {
  modal(`<h2>${t('lbTitle')}</h2><div id="lb-root"></div>`,
    [{ label: t('helpModalOk'), primary: true }]);
  lbMount({
    root: el('modal-root').querySelector('#lb-root'),
    t, money, game: taggedGame(GAME_TAG, state.difficulty), viewOnly: true,
  });
}

function renderChrome() {
  el('brand-title').textContent = t('brandTitle');
  el('brand-sub').textContent = t('brandSub');
  el('title-levers').textContent = t('panelLevers');
  el('title-algos').textContent = t('panelAlgos');
  el('title-coverage').textContent = t('panelCoverage');
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

  el('btn-next').textContent = state.over
    ? t('btnResults') : t('btnNext', { week: state.week + 1 });
  for (const [tab, key] of Object.entries({
    unit: 'tabUnit', pnl: 'tabPnl', algos: 'tabAlgos', districts: 'tabDistricts', help: 'tabHelp',
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
  renderAlgos();
  renderOpsReadout();
  renderKpis();
  renderDistricts();
  renderCityMap();
  renderBoard();
  renderFunding();
  renderWeather();
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
  state = saved ?? createInitialState('novograd');

  // Обработчики вешаются один раз: init() может позвать boot() повторно после
  // сброса сохранения, и двойная подписка гоняла бы неделю по два раза за клик.
  if (!bound) {
    bound = true;
    bindJumps();
    // На телефоне таблицы показываются карточками; подписи ячейкам берутся
    // из шапки и обновляются сами при любой перерисовке.
    watchTables();
    el('btn-next').addEventListener('click', nextWeek);
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
      if (e.key === 'Enter' && !e.repeat && document.activeElement?.tagName !== 'BUTTON') nextWeek();
    });
  }

  renderAll();
  // Первый запуск: сохранения нет — человек здесь впервые
  if (!saved) showWelcome();
}
