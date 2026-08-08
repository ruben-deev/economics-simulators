// ============================================================================
// Слой интерфейса: состояние партии, отрисовка, обработка ввода.
// Вся экономика живёт в src/model — здесь только показ и управление.
// ============================================================================

import { CONFIG, DISTRICTS, LEVERS, ALGORITHMS } from '../model/config.js';
import { WEATHER, weatherEffect, seasonOf } from '../model/weather.js';
import {
  createInitialState, step, explain, unitEconomics, valuation,
  fundingOffer, raise, finalScore, aovOf, techLevel, ordersPerCourier,
  algoQuality, dataLevel, rndLevel, algorithmImpact,
} from '../model/engine.js';
import { drawLineChart, legendHtml, PALETTE } from './charts.js';
import { money, moneyExact, num, pct, signedPct, compact } from './format.js';

const SAVE_KEY = 'novoeda-save-v2';
const el = (id) => document.getElementById(id);

let state = null;
let chartTab = 'orders';
let rightTab = 'unit';
let leversBuilt = false;

// ----------------------------------------------------------------------------
// Сохранение
// ----------------------------------------------------------------------------
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* приватный режим */ }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.districts && Array.isArray(s.history) ? s : null;
  } catch { return null; }
}

const last = () => state.history[state.history.length - 1] ?? null;
const prev = () => state.history[state.history.length - 2] ?? null;

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
  const burn = r ? r.opex + r.oneOff - r.contribution : 0;
  const runway = burn > 0 ? state.cash / burn : Infinity;

  const parts = [
    kpi('Неделя', `${state.week} / ${CONFIG.weeksTotal}`, r?.event ? '⚡ событие' : 'город Новоград'),
    kpi('Касса', money(state.cash),
      state.cash < 0 ? 'деньги кончились'
        : Number.isFinite(runway) ? `хватит на ${runway.toFixed(0)} нед.` : 'операционно прибыльны',
      state.cash < 0 ? 'down' : runway < 8 ? 'down' : runway < 20 ? 'neutral' : 'up'),
  ];

  if (r) {
    const [dOrders, cOrders] = delta(r.orders, p?.orders);
    const [dProfit] = delta(r.profit, p?.profit);
    parts.push(
      kpi('Заказы / нед', compact(r.orders), dOrders, cOrders),
      kpi('Прибыль / нед', money(r.profit), `вклад ${money(r.contribution)}`, r.profit >= 0 ? 'up' : 'down'),
      kpi('Вклад с заказа', `${num(r.cmPerOrder)} ₽`, `take rate ${pct(r.netRevenue / Math.max(1, r.gmv))}`,
        r.cmPerOrder >= 0 ? 'up' : 'down'),
      kpi('Доставка', `${num(r.avgDeliveryTime)} мин`, `загрузка ${pct(r.utilization, 0)}`,
        r.avgDeliveryTime <= 35 ? 'up' : r.avgDeliveryTime <= 45 ? 'neutral' : 'down'),
      kpi('Доля рынка', pct(r.marketShare), `${compact(r.customers)} клиентов`, 'neutral'),
      kpi('Оценка × доля', money(r.equityValue ?? 0), `ваша доля ${pct(state.equity, 1)}`, 'neutral'),
    );
  } else {
    parts.push(kpi('Старт', money(CONFIG.startCash), 'посевной раунд, 100% ваши', 'up'));
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
        <span class="lever-label">${l.label}</span>
        <span class="lever-value" id="val-${l.key}"></span>
      </div>
      <input type="range" id="in-${l.key}" min="${l.min}" max="${l.max}" step="${l.step}" />
      <button class="lever-why" type="button">зачем это?</button>
      <div class="lever-tip">${l.tip}</div>
    </div>
  `).join('');

  for (const l of LEVERS) {
    const input = el(`in-${l.key}`);
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
}

function leverDisplay(l, raw) {
  if (l.unit === '₽/нед') return money(raw);
  if (l.unit === '%') return `${raw}%`;
  if (l.unit === 'чел') return num(raw);
  return `${num(raw)} ${l.unit}`;
}

function syncLevers() {
  for (const l of LEVERS) {
    const raw = state.decisions[l.key] / (l.scale ?? 1);
    const input = el(`in-${l.key}`);
    if (input && document.activeElement !== input) input.value = String(raw);
    else if (input) input.value = String(raw);
    el(`val-${l.key}`).textContent = leverDisplay(l, raw);
  }
}

// Оперативная сводка под ползунками: сколько курьер заработает и сколько
// заказов увезёт выбранный штат. Считается мгновенно, до перехода к неделе —
// именно здесь видно, что ставка ниже рынка означает «никто не выйдет на смену».
function renderOpsReadout() {
  const active = DISTRICTS.filter((d) => state.decisions.districts?.includes(d.id));
  if (!active.length) {
    el('ops-readout').innerHTML = `<div class="hint-box" style="margin-bottom:12px">
      Ни один район не выбран: заказов не будет. Начните с одного района —
      запуск списывается разово, а содержание идёт каждую неделю.</div>`;
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
  const wxNext = weatherEffect(state.weatherNext ?? 'clear', state.decisions.weatherBonus ?? 0);
  const perCourier = ordersPerCourier(state, avgDistance, (1 + 0.60 * batch * q) * wxNext.capacityMult);
  const payEff = state.decisions.courierPay * (1 - 0.20 * batch * q) + wxNext.payPerOrder;
  const expected = perCourier * CONFIG.courierExpectedLoad * payEff;
  const ratio = expected / CONFIG.courierMarketWeeklyPay;
  const capacity = state.decisions.targetCouriers * perCourier;
  const r = last();
  const demand = r ? r.demand : 0;
  const util = capacity > 0 ? demand / capacity : null;

  const hiring = ratio >= CONFIG.courierHireThreshold + 0.35 ? ['good', 'очередь из кандидатов']
    : ratio >= CONFIG.courierHireThreshold + 0.1 ? ['good', 'наём идёт ровно']
    : ratio >= CONFIG.courierHireThreshold ? ['warn', 'кандидаты идут тонкой струйкой']
    : ['bad', 'откликов не будет — ставка ниже рынка'];

  // Минимальная ставка, при которой вообще пойдут отклики на этом плече доставки
  const minPay = Math.ceil(
    (CONFIG.courierHireThreshold * CONFIG.courierMarketWeeklyPay)
    / (CONFIG.courierExpectedLoad * perCourier * (1 - 0.20 * batch * q)) / 10) * 10;

  el('ops-readout').innerHTML = `<div class="hint-box" style="margin-bottom:12px">
    <div>Курьер увезёт <b>${num(perCourier)}</b> заказов/нед (плечо ${avgDistance.toFixed(1)} км).</div>
    <div>Его заработок при 75% загрузки: <b>${money(expected)}</b> против ${money(CONFIG.courierMarketWeeklyPay)} на рынке
      (<span class="${ratio >= 1 ? 'pos' : 'neg'}">×${ratio.toFixed(2)}</span>) — ${hiring[1]}.</div>
    ${forecastOn
      ? `<div>Штат подбирает <b>алгоритм прогноза</b> под целевую загрузку
          ${pct(state.decisions.algoParam?.forecast ?? 0.75, 0)} — ползунок штата не используется.
          На прошлой неделе он вывел ${num(r?.couriers ?? 0)} чел.</div>`
      : `<div>Штат ${num(state.decisions.targetCouriers)} чел. увезёт <b>${compact(capacity)}</b> заказов/нед${
        util !== null && demand > 0 ? `, спрос прошлой недели ${compact(demand)} → загрузка <b class="${util > 1 ? 'neg' : util < 0.55 ? 'neg' : 'pos'}">${pct(util, 0)}</b>` : ''}.</div>`}
    ${batch > 0 ? `<div>Батчинг: ставка за отдельный заказ снижена до <b>${num(payEff)} ₽</b>,
      но заказ едет дольше.</div>` : ''}
    ${(WEATHER[state.weatherNext]?.severity ?? 0) > 0 ? `<div>Расчёт уже учитывает прогноз
      (${(WEATHER_NAME[state.weatherNext] ?? '').toLowerCase()}): спрос вырастет примерно на
      <b>${signedPct(wxNext.demandMult - 1, 0)}</b>.</div>` : ''}
    ${ratio < CONFIG.courierHireThreshold
      ? `<div class="neg">Наём начнётся от <b>${num(minPay)} ₽</b> за заказ: чем длиннее плечо, тем меньше заказов успевает курьер и тем выше должна быть ставка.</div>`
      : ''}
  </div>`;
}

// ----------------------------------------------------------------------------
// Погода
// ----------------------------------------------------------------------------
const WEATHER_NAME = {
  clear: 'Ясно', rain: 'Дождь', storm: 'Шторм', heat: 'Жара',
  snow: 'Снегопад', ice: 'Гололёд', frost: 'Мороз',
};
const SEASON_NAME = { winter: 'зима', spring: 'весна', summer: 'лето', autumn: 'осень' };

function weatherCard(type, when, cls = '') {
  const fx = weatherEffect(type, state.decisions.weatherBonus ?? 0);
  const effects = type === 'clear'
    ? 'без влияния на спрос и сроки'
    : `спрос <b class="up">${signedPct(fx.demandMult - 1, 0)}</b>,
       мощность курьеров <b class="down">${signedPct(fx.capacityMult - 1, 0)}</b>,
       отток курьеров <b class="down">+${(fx.churnAdd * 100).toFixed(1)} п.п.</b>`;
  return `<div class="${cls}">
    <span class="weather-icon">${WEATHER[type]?.icon ?? '☀️'}</span>
    <span class="weather-body">
      <span class="weather-when">${when}</span>
      <div class="weather-name">${WEATHER_NAME[type] ?? type}</div>
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
  const advice = nextSeverity >= 0.7 && bonus < 30
    ? `<div class="funding-note" style="flex-basis:100%">
        На следующей неделе спрос подскочит, а курьеров на линии станет меньше. Нанимать надо
        <b>сейчас</b> — те, кого вы наймёте, выйдут именно на эту неделю. Надбавка за плохую погоду
        удержит смены и в ясные дни не стоит ничего.</div>`
    : '';

  el('weather-slot').innerHTML = `<div class="panel">
    <h2 class="panel-title">Погода · ${SEASON_NAME[seasonOf(state.week + 1)]}, неделя ${state.week + 1}</h2>
    <div class="weather">
      ${weatherCard(now, 'эта неделя', 'weather-now')}
      ${weatherCard(next, 'прогноз на следующую', `weather-next ${nextSeverity >= 0.7 ? 'alarm' : ''}`)}
      ${advice}
    </div>
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
    ${qualityBar('Данные', dataLevel(state), 'Накоплено заказов — это обучающая выборка')}
    ${qualityBar('Команда', rndLevel(state), 'Накопленные вложения в data science')}
    ${qualityBar('Качество', q, 'Среднее геометрическое: нужно и то и другое')}
    <div class="funding-note">Качество алгоритмов = √(данные × команда). Модель без данных не обучишь,
      а данные без команды никто не превратит в решения. Данные копятся только от выполненных заказов.</div>
  </div>`;

  const cards = ALGORITHMS.map((a) => {
    const installed = Boolean(state.installed?.[a.key]);
    const unlocked = installed || q >= a.unlock;
    const on = Boolean(state.decisions.algoOn?.[a.key]);
    const raw = (state.decisions.algoParam?.[a.key] ?? a.param.def * (a.param.scale ?? 1)) / (a.param.scale ?? 1);

    const badge = installed
      ? '<span class="badge on">внедрён</span>'
      : unlocked
        ? `<span class="badge">внедрение ${money(a.install)}</span>`
        : `<span class="badge">нужно качество ${pct(a.unlock, 0)}</span>`;

    const slider = installed && on ? `<div class="algo-param">
        <div class="algo-param-head"><span>${a.param.label}</span><b>${raw}${a.param.unit ?? ''}</b></div>
        <input type="range" data-algo-param="${a.key}"
          min="${a.param.min}" max="${a.param.max}" step="${a.param.step}" value="${raw}" />
      </div>` : '';

    const pending = on && !installed && unlocked
      ? `<div class="algo-tradeoff">Будет внедрён при переходе к следующей неделе: разовые ${money(a.install)}.</div>`
      : '';

    return `<div class="algo ${!unlocked ? 'locked' : ''} ${on && installed ? 'on' : ''}">
      <div class="algo-head">
        <label class="algo-title">
          <input type="checkbox" data-algo="${a.key}" ${on ? 'checked' : ''} ${unlocked ? '' : 'disabled'} />
          ${a.name}
        </label>
        ${badge}
      </div>
      <div class="algo-what">${a.what}</div>
      ${slider}
      ${installed && on ? `<div class="algo-tradeoff">${a.tradeoff}</div>` : pending}
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
      const a = ALGORITHMS.find((x) => x.key === input.dataset.algoParam);
      state.decisions.algoParam = {
        ...state.decisions.algoParam,
        [a.key]: Number(input.value) * (a.param.scale ?? 1),
      };
      const head = input.parentElement.querySelector('b');
      if (head) head.textContent = `${input.value}${a.param.unit ?? ''}`;
      renderOpsReadout();
      renderRightTab();
      save();
    });
  });
}

// ----------------------------------------------------------------------------
// Районы
// ----------------------------------------------------------------------------
function renderDistricts() {
  const chosen = new Set(state.decisions.districts ?? []);
  el('districts').innerHTML = DISTRICTS.map((d) => {
    const ds = state.districts[d.id];
    const on = chosen.has(d.id);
    const live = ds.active;
    const stats = live
      ? `${compact(ds.customers)} клиентов · ${num(ds.restaurants)} ресторанов · ${num(ds.deliveryTime)} мин · охват ${pct(ds.customers / d.potential, 1)}`
      : `${compact(d.potential)} потенц. клиентов · чек ${num(aovOf(d))} ₽ · плечо ${d.distanceKm} км`;
    return `<div class="district ${on ? 'active' : ''}" data-id="${d.id}">
      <div class="district-head">
        <span class="district-name">${d.name}</span>
        <span class="badge ${live ? 'on' : ''}">${live ? 'работает' : `запуск ${money(d.launchCost)}`}</span>
      </div>
      <div class="district-meta">${stats}</div>
      <div class="district-meta">${d.hint}</div>
    </div>`;
  }).join('');

  el('districts').querySelectorAll('.district').forEach((node) => {
    node.addEventListener('click', () => {
      const id = node.dataset.id;
      const set = new Set(state.decisions.districts ?? []);
      if (set.has(id)) set.delete(id); else set.add(id);
      state.decisions.districts = [...set];
      renderDistricts();
      renderOpsReadout();
      renderRightTab();
      save();
    });
  });
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
        <div class="funding-note">размытие ${pct(o.dilution, 1)} → ваша доля ${pct(o.newEquity, 1)}</div>
      </div>
      <button class="btn small" data-raise="${amount}" ${canRaise ? '' : 'disabled'}>Взять</button>
    </div>`;
  }).join('');

  el('funding').innerHTML = `
    <div class="funding-note">
      Оценка компании: <b>${money(v)}</b> (pre-money). Ваша доля: <b>${pct(state.equity, 1)}</b>,
      привлечено: ${money(state.raisedTotal)}.
    </div>
    ${rows}
    <div class="funding-note">
      Оценка растёт от <i>годовой выручки × мультипликатор</i>. Мультипликатор зависит от темпа роста
      и рентабельности. Поэтому деньги дешевле брать, когда бизнес уже растёт — но именно тогда они и не нужны.
      ${state.week < CONFIG.minWeekForFunding ? `<br><b>Раунд доступен с ${CONFIG.minWeekForFunding}-й недели.</b>` : ''}
    </div>`;

  el('funding').querySelectorAll('[data-raise]').forEach((b) => {
    b.addEventListener('click', () => {
      const amount = Number(b.dataset.raise);
      const { state: next, offer } = raise(state, amount);
      state = next;
      save();
      renderAll();
      toast(`Раунд закрыт: ${money(amount)} за ${pct(offer.dilution, 1)} компании.`);
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
          <b>${o.label}</b><span>${o.detail}</span>
        </button>`).join('')}</div>`
    : '<div class="funding-note">Событие сработает автоматически при переходе к следующей неделе.</div>';

  el('event-slot').innerHTML = `<div class="panel event">
    <h3>⚡ ${ev.title}</h3>
    <p>${ev.text}</p>
    ${options}
    ${ev.lesson ? `<div class="lesson"><b>Экономический смысл:</b> ${ev.lesson}</div>` : ''}
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

  if (r.utilization > 1.02) {
    alerts.push(['bad', `Курьеров не хватает: спрос покрыт на ${pct(r.fillRate, 0)}. Потеряно ${compact(r.lostOrders)} заказов, время доставки выросло до ${num(r.avgDeliveryTime)} мин. Потерянный заказ бьёт дважды — сегодня по выручке, завтра по удержанию.`]);
  } else if (r.utilization < 0.55 && r.couriers > 20) {
    alerts.push(['warn', `Курьеры простаивают (загрузка ${pct(r.utilization, 0)}). Каждый лишний курьер стоит ${num(CONFIG.hqPerCourier)} ₽/нед диспетчеризации, а заработок на человека падает — начнётся отток.`]);
  }
  if (r.applicants < 1 && r.couriers < r.decisions.targetCouriers) {
    const minPay = Math.ceil((CONFIG.courierHireThreshold * CONFIG.courierMarketWeeklyPay)
      / (CONFIG.courierExpectedLoad * Math.max(1, r.perCourier)) / 10) * 10;
    alerts.push(['bad', `Никто не откликнулся на вакансию курьера: при ставке ${num(r.decisions.courierPay)} ₽ и ${num(r.perCourier)} заказах за смену заработок не дотягивает до рыночных ${money(CONFIG.courierMarketWeeklyPay)}. Отклики пойдут примерно от ${num(minPay)} ₽ за заказ.`]);
  } else if (r.courierAttractiveness < 1) {
    alerts.push(['warn', `Курьер зарабатывает ${money(r.courierEarnings)}/нед против ${money(CONFIG.courierMarketWeeklyPay)} на рынке. Отток ${pct(r.courierLeft / Math.max(1, r.couriers + r.courierLeft), 0)}, откликов почти нет.`]);
  }
  if (r.cmPerOrder < 0) {
    alerts.push(['bad', `Вклад с заказа отрицательный (${num(r.cmPerOrder)} ₽). Рост объёма здесь ускоряет банкротство: масштабируется убыток, а не прибыль.`]);
  } else if (r.cmPerOrder > 0 && r.profit < 0) {
    alerts.push(['warn', `Каждый заказ приносит ${num(r.cmPerOrder)} ₽ вклада, но постоянных расходов на ${money(r.opex)}. Точка безубыточности: ${compact(r.opex / r.cmPerOrder)} заказов в неделю.`]);
  }
  if (runway < 8 && state.cash >= 0) {
    alerts.push(['bad', `Денег на ${runway.toFixed(0)} недель при текущем сжигании ${money(burn)}/нед. Пора резать расходы или привлекать раунд.`]);
  }
  if (r.restaurants < 5 && r.decisions.sales === 0) {
    alerts.push(['bad', 'Ресторанов нет и бюджет на подключение равен нулю. В маркетплейсе предложение первично: пока заказывать нечего, ни один рубль маркетинга не сработает.']);
  }
  if (r.decisions.marketing === 0 && r.restaurants > 40) {
    alerts.push(['warn', `Маркетинг выключен: узнаваемость тает на ${pct(CONFIG.awarenessDecay, 0)} в неделю, приток новых клиентов почти иссяк (+${compact(r.newCustomers)} против −${compact(r.lostCustomers)} ушедших). Ассортимент уже есть — самое время покупать спрос.`]);
  }
  if (r.restaurants < 40 && r.customers > 0) {
    alerts.push(['warn', `Всего ${num(r.restaurants)} ресторанов — ассортимент режет спрос множителем ${r.avgSelectionFactor.toFixed(2)}. Без выбора маркетинг работает вхолостую.`]);
  }
  if (r.ltvCac !== null && r.ltvCac !== undefined && Number.isFinite(r.ltvCac) && r.cac > 0) {
    if (r.ltvCac < 1) alerts.push(['bad', `LTV/CAC = ${r.ltvCac.toFixed(2)}: вы платите за клиента больше, чем он принесёт за всю жизнь.`]);
    else if (r.ltvCac > 3) alerts.push(['good', `LTV/CAC = ${r.ltvCac.toFixed(2)} — привлечение окупается с запасом, есть смысл давить на маркетинг.`]);
  }
  if ((WEATHER[r.weather]?.severity ?? 0) >= 0.7 && r.utilization > 1) {
    alerts.push(['bad', `${WEATHER_NAME[r.weather]} совпал с нехваткой курьеров: спрос ${signedPct(r.weatherDemandMult - 1, 0)}, мощность ${signedPct(r.weatherCapacityMult - 1, 0)}. Это худшее сочетание в доставке — плохая погода поднимает спрос ровно тогда, когда везти его некому.`]);
  }
  if (r.weatherBonusCost > 0) {
    alerts.push(['good', `Надбавка за погоду обошлась в ${money(r.weatherBonusCost)} (${num(r.weatherBonusPerOrder)} ₽ на заказ) и удержала курьеров на линии. В ясную неделю она не стоила бы ничего.`]);
  }
  const anyAlgoOn = Object.values(r.algoActive ?? {}).some(Boolean);
  if ((r.decisions.rnd ?? 0) > 0 && !anyAlgoOn) {
    alerts.push(['warn', `Data Science стоит ${money(r.decisions.rnd)}/нед, но ни один алгоритм не включён. Команда копит качество (${pct(r.algoQuality, 0)}), однако сама по себе она не приносит ни рубля — деньги делают внедрённые правила.`]);
  }
  const ready = ALGORITHMS.filter((a) => !state.installed?.[a.key] && r.algoQuality >= a.unlock);
  if (ready.length) {
    alerts.push(['good', `Доступно к внедрению: ${ready.map((a) => a.name).join(', ')}. Качество алгоритмов ${pct(r.algoQuality, 0)}.`]);
  }
  if (r.profit > 0) alerts.push(['good', `Неделя закрыта в плюс: ${money(r.profit)}.`]);
  return alerts;
}

function renderReport() {
  const r = last();
  if (!r) {
    el('report-slot').innerHTML = `<div class="panel">
      <h3 style="margin:0 0 8px">Неделя 0. Город ждёт.</h3>
      <div class="hint-box">
        <b>С чего начать.</b> У вас ${money(CONFIG.startCash)} и пустой город.
        Порядок запуска почти всегда такой:
        <ol style="margin:6px 0 0 16px;padding:0">
          <li>Откройте <b>один</b> район (дешевле всего — Промзона, выгоднее всего — Центр).</li>
          <li>Дайте бюджет на <b>подключение ресторанов</b>: без ассортимента спрос равен нулю.</li>
          <li>Наймите курьеров под ожидаемый спрос — и проверьте, что заработок курьера выше ${money(CONFIG.courierMarketWeeklyPay)}/нед.</li>
          <li>Только потом включайте <b>маркетинг</b>: платить за клиента, которому нечего заказать и некому привезти, — самый дорогой способ купить отток.</li>
        </ol>
        Следите за панелью «Юнит-экономика» справа: она пересчитывается прямо во время движения ползунков.
        <br><br><b>Алгоритмы</b> (динамическое ценообразование, персональные скидки, батчинг) откроются позже:
        им нужны данные, а данные копятся только от выполненных заказов. Не спешите включать Data Science
        в первую неделю — платить будете сразу, а получать нечего.
      </div>
    </div>`;
    return;
  }

  const drivers = explain(prev(), r);
  const maxAbs = Math.max(0.02, ...drivers.map((d) => Math.abs(d.effect)));
  const driversHtml = drivers.length ? `
    <div class="drivers">
      <div class="panel-title">Почему заказы изменились (${signedPct(r.orders / Math.max(1e-9, prev().orders) - 1)})</div>
      ${drivers.slice(0, 6).map((d) => {
        const w = (Math.abs(d.effect) / maxAbs) * 50;
        const pos = d.effect > 0;
        return `<div class="driver">
          <span class="d-name">${d.label}</span>
          <span class="d-bar">
            <span class="d-fill" style="${pos ? `left:50%;width:${w}%` : `right:50%;width:${w}%`};background:${pos ? 'var(--good)' : 'var(--bad)'}"></span>
          </span>
          <span class="d-val ${pos ? 'pos' : 'neg'}">${signedPct(d.effect)}</span>
        </div>`;
      }).join('')}
    </div>` : '';

  const alerts = buildAlerts(r);
  const alertsHtml = alerts.length
    ? `<div class="alerts">${alerts.map(([k, t]) => `<div class="alert ${k}">${t}</div>`).join('')}</div>`
    : '';

  const eventNote = r.event
    ? `<div class="lesson"><b>${r.event.title}.</b> ${r.event.lesson ?? ''}</div>` : '';
  const installNote = r.installedNow?.length
    ? `<div class="alert good" style="margin-top:8px">Внедрено: ${r.installedNow.join(', ')} — разовые ${money(r.installCost)}. Алгоритм начинает работать с этой недели, а окупаться — заметно позже.</div>` : '';
  const launchNote = r.launched.length
    ? `<div class="alert warn" style="margin-top:8px">Запущены районы: ${r.launched.join(', ')} — разовые затраты ${money(r.launchCost)}. Первые недели район убыточен: клиентов ещё нет, а постоянные расходы уже идут.</div>` : '';

  el('report-slot').innerHTML = `<div class="panel">
    <div class="report-head">
      <h3>Итоги недели ${r.week}</h3>
      <span class="funding-note">GMV ${money(r.gmv)} · выручка ${money(r.netRevenue)} · take rate ${pct(r.netRevenue / Math.max(1, r.gmv))}</span>
    </div>
    <div class="report-grid">
      ${stat('Заказы', compact(r.orders), `спрос ${compact(r.demand)}, потеряно ${compact(r.lostOrders)}`)}
      ${stat('Клиенты', compact(r.customers), `+${compact(r.newCustomers)} / −${compact(r.lostCustomers)}`)}
      ${stat('Курьеры', num(r.couriers), `+${num(r.hires)} / −${num(r.courierLeft)}, ${num(r.perCourier)} зак/нед`)}
      ${stat('Рестораны', num(r.restaurants), `выбор ×${r.avgSelectionFactor.toFixed(2)}`)}
      ${stat('Время доставки', `${num(r.avgDeliveryTime)} мин`, `загрузка ${pct(r.utilization, 0)}`)}
      ${stat('Погода', `${WEATHER[r.weather]?.icon ?? ''} ${WEATHER_NAME[r.weather] ?? r.weather}`,
        r.weather === 'clear' ? 'без влияния'
          : `спрос ${signedPct(r.weatherDemandMult - 1, 0)}, мощность ${signedPct(r.weatherCapacityMult - 1, 0)}`)}
      ${stat('Вклад с заказа', `${num(r.cmPerOrder)} ₽`, `${pct(r.cmPerOrder / Math.max(1, r.gmv / Math.max(1, r.orders)))} от чека`)}
      ${stat('Прибыль', money(r.profit), `постоянные ${money(r.opex)}`)}
      ${stat('CAC / LTV', r.cac > 0 ? `${num(r.cac)} ₽` : '—', r.ltvCac ? `LTV/CAC ${r.ltvCac.toFixed(2)}` : 'маркетинг выключен')}
    </div>
    ${installNote}
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
    label: 'Спрос',
    caption: 'Разрыв между спросом и заказами — это заказы, которые вы не смогли развезти. Он не просто теряет выручку: он портит удержание.',
    series: (h) => [
      { label: 'Спрос', data: h.map((r) => r.demand), color: PALETTE[1] },
      { label: 'Выполнено', data: h.map((r) => r.orders), color: PALETTE[0] },
    ],
  },
  money: {
    label: 'Деньги',
    caption: 'Вклад (contribution) = выручка − переменные расходы. Прибыль = вклад − постоянные. Бизнес живёт, когда вклад покрывает постоянные, а не когда растёт GMV.',
    series: (h) => [
      { label: 'Выручка', data: h.map((r) => r.netRevenue), color: PALETTE[1] },
      { label: 'Вклад', data: h.map((r) => r.contribution), color: PALETTE[0] },
      { label: 'Прибыль', data: h.map((r) => r.profit), color: PALETTE[3] },
    ],
    zeroLine: true,
  },
  cash: {
    label: 'Касса',
    caption: 'Компания умирает не от убытка, а от нуля на счету. Следите за наклоном кривой, а не за её высотой.',
    series: (h) => [{ label: 'Касса', data: h.map((r) => r.cash), color: PALETTE[2] }],
    zeroLine: true,
  },
  unit: {
    label: 'Юнит',
    caption: 'Вклад с одного заказа — главный индикатор здоровья. Если он отрицателен, каждый новый заказ увеличивает убыток.',
    series: (h) => [{ label: 'Вклад с заказа, ₽', data: h.map((r) => r.cmPerOrder), color: PALETTE[0] }],
    zeroLine: true,
    format: (v) => `${Math.round(v)}`,
  },
  ops: {
    label: 'Операции',
    caption: 'Время доставки — производная от загрузки курьеров. Оно растёт нелинейно: при загрузке выше 90% минуты добавляются лавиной.',
    series: (h) => [
      { label: 'Время доставки, мин', data: h.map((r) => r.avgDeliveryTime), color: PALETTE[3] },
      { label: 'Загрузка, %', data: h.map((r) => r.utilization * 100), color: PALETTE[2] },
    ],
    format: (v) => `${Math.round(v)}`,
  },
  supply: {
    label: 'Предложение',
    caption: 'Курьеры и рестораны — две стороны маркетплейса. Перекос в любую сторону мгновенно бьёт по спросу.',
    series: (h) => [
      { label: 'Курьеры', data: h.map((r) => r.couriers), color: PALETTE[4] },
      { label: 'Рестораны', data: h.map((r) => r.restaurants), color: PALETTE[5] },
    ],
    format: (v) => `${Math.round(v)}`,
  },
  algos: {
    label: 'Алгоритмы',
    caption: 'Качество алгоритмов = √(данные × команда). Оно растёт медленно и с запозданием: деньги в data science превращаются в прибыль через несколько месяцев, а не на следующей неделе.',
    series: (h) => [
      { label: 'Качество, %', data: h.map((r) => (r.algoQuality ?? 0) * 100), color: PALETTE[4] },
      { label: 'Данные, %', data: h.map((r) => (r.dataLevel ?? 0) * 100), color: PALETTE[1] },
      { label: 'Команда, %', data: h.map((r) => (r.rndLevel ?? 0) * 100), color: PALETTE[3] },
    ],
    format: (v) => `${Math.round(v)}`,
  },
  customers: {
    label: 'Клиенты',
    caption: 'База клиентов — это запас, а не поток. Маркетинг наполняет её, недовольство опустошает.',
    series: (h) => [
      { label: 'Клиенты', data: h.map((r) => r.customers), color: PALETTE[1] },
      { label: 'Новые за неделю', data: h.map((r) => r.newCustomers), color: PALETTE[0] },
      { label: 'Ушли за неделю', data: h.map((r) => r.lostCustomers), color: PALETTE[2] },
    ],
  },
};

function renderChart() {
  el('chart-tabs').innerHTML = Object.entries(CHART_TABS)
    .map(([k, v]) => `<button data-chart="${k}" class="${k === chartTab ? 'active' : ''}">${v.label}</button>`).join('');
  el('chart-tabs').querySelectorAll('[data-chart]').forEach((b) => {
    b.addEventListener('click', () => { chartTab = b.dataset.chart; renderChart(); });
  });

  const conf = CHART_TABS[chartTab];
  const series = conf.series(state.history);
  el('chart-legend').innerHTML = legendHtml(series);
  el('chart-caption').textContent = conf.caption;
  drawLineChart(el('chart'), series, {
    zeroLine: conf.zeroLine,
    format: conf.format ?? ((v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}м` : Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}к` : String(Math.round(v)))),
  });
}

// ----------------------------------------------------------------------------
// Правая колонка
// ----------------------------------------------------------------------------
function renderUnitTab() {
  const u = unitEconomics(state, state.decisions);
  const r = last();
  const row = (name, value, cls = '', sub = false) =>
    `<tr class="${sub ? 'sub' : ''}"><td>${name}</td><td class="${cls}">${num(value)} ₽</td><td class="${cls}">${pct(value / u.aov, 1)}</td></tr>`;

  const breakEven = r && u.contribution > 0 ? r.opex / u.contribution : null;

  return `
    <p class="funding-note">Экономика одного среднего заказа при текущих настройках ползунков — пересчитывается мгновенно, до перехода к следующей неделе.</p>
    <table class="data">
      <thead><tr><th>Статья</th><th>₽ / заказ</th><th>% от чека</th></tr></thead>
      <tbody>
        <tr><td><b>Средний чек (GMV)</b></td><td><b>${num(u.aov)} ₽</b></td><td>100%</td></tr>
        ${row(`Комиссия с ресторана (${pct(u.commission, 0)})`, u.commissionRevenue, 'pos', true)}
        ${row('Плата за доставку', u.feeRevenue, 'pos', true)}
        <tr class="total"><td>Выручка сервиса</td><td class="pos">${num(u.revenue)} ₽</td><td class="pos">${pct(u.takeRate, 1)}</td></tr>
        ${row('Оплата курьеру', -u.courier, 'neg', true)}
        ${row('Промо-скидка', -u.promo, 'neg', true)}
        ${row('Эквайринг', -u.payment, 'neg', true)}
        ${row('Поддержка и возвраты', -u.support, 'neg', true)}
        <tr class="total"><td>Вклад с заказа</td>
          <td class="${u.contribution >= 0 ? 'pos' : 'neg'}">${num(u.contribution)} ₽</td>
          <td class="${u.contribution >= 0 ? 'pos' : 'neg'}">${pct(u.marginOfGmv, 1)}</td></tr>
      </tbody>
    </table>
    <p class="funding-note" style="margin-top:10px">
      <b>Take rate</b> — доля чека, которая остаётся сервису (${pct(u.takeRate, 1)}). В реальных фудтех-сервисах она
      обычно 20–30%, а вклад с заказа — единицы процентов от GMV. Именно поэтому отрасль так долго идёт к прибыли.
    </p>
    ${breakEven ? `<div class="hint-box" style="margin-top:10px">
      При постоянных расходах ${money(r.opex)}/нед точка безубыточности —
      <b>${compact(breakEven)} заказов в неделю</b> (сейчас ${compact(r.orders)}).
    </div>` : u.contribution <= 0 ? `<div class="hint-box" style="margin-top:10px">
      Вклад с заказа ≤ 0: точки безубыточности <b>не существует</b> ни при каком объёме.
      Сначала чините экономику заказа, потом растите.</div>` : ''}
    ${r ? `<h4 style="margin:14px 0 6px;font-size:13px">Привлечение клиента</h4>
    <table class="data"><tbody>
      <tr><td>CAC (маркетинг / новые клиенты)</td><td>${r.cac > 0 ? `${num(r.cac)} ₽` : '—'}</td></tr>
      <tr><td>Частота заказов клиента</td><td>${(r.customers > 0 ? r.orders / r.customers : 0).toFixed(2)} / нед</td></tr>
      <tr><td>LTV (вклад за всё время жизни)</td><td>${num(r.ltv)} ₽</td></tr>
      <tr class="total"><td>LTV / CAC</td><td class="${(r.ltvCac ?? 0) >= 3 ? 'pos' : (r.ltvCac ?? 0) < 1 ? 'neg' : ''}">${r.ltvCac ? r.ltvCac.toFixed(2) : '—'}</td></tr>
    </tbody></table>
    <p class="funding-note">Ориентир венчурной индустрии: LTV/CAC ≥ 3. Ниже 1 — вы покупаете убыток.</p>` : ''}
  `;
}

function renderPnlTab() {
  const r = last();
  if (!r) return '<p class="funding-note">Отчёт появится после первой прожитой недели.</p>';
  const line = (name, v, cls = '', sub = false) =>
    `<tr class="${sub ? 'sub' : ''}"><td>${name}</td><td class="${cls}">${moneyExact(v)}</td></tr>`;
  return `
    <table class="data">
      <tbody>
        <tr><td><b>GMV (оборот)</b></td><td>${moneyExact(r.gmv)}</td></tr>
        ${line('Комиссия с ресторанов', r.commissionRevenue, 'pos', true)}
        ${line('Плата за доставку', r.feeRevenue, 'pos', true)}
        <tr class="total"><td>Выручка</td><td class="pos">${moneyExact(r.netRevenue)}</td></tr>
        ${line('Оплата курьерам', -r.courierCost, 'neg', true)}
        ${r.weatherBonusCost > 0 ? line('в т. ч. надбавка за погоду', -r.weatherBonusCost, 'neg', true) : ''}
        ${line('Промо и скидки', -r.promoCost, 'neg', true)}
        ${line('Эквайринг', -r.paymentCost, 'neg', true)}
        ${line('Поддержка', -r.supportCost, 'neg', true)}
        <tr class="total"><td>Вклад (contribution)</td><td class="${r.contribution >= 0 ? 'pos' : 'neg'}">${moneyExact(r.contribution)}</td></tr>
        ${line('Содержание районов', -r.districtFixed, 'neg', true)}
        ${line('Офис, разработка, диспетчеризация', -r.hqCost, 'neg', true)}
        ${line('Маркетинг', -r.decisions.marketing, 'neg', true)}
        ${line('Подключение ресторанов', -r.decisions.sales, 'neg', true)}
        ${line('Технологии', -r.decisions.tech, 'neg', true)}
        ${line('Data Science', -(r.decisions.rnd ?? 0), 'neg', true)}
        <tr class="total"><td>Операционная прибыль</td><td class="${r.profit >= 0 ? 'pos' : 'neg'}">${moneyExact(r.profit)}</td></tr>
        ${r.oneOff > 0 ? line('Разовые расходы (запуск, найм, внедрение, события)', -r.oneOff, 'neg', true) : ''}
        <tr class="total"><td>Изменение кассы</td><td class="${(r.profit - r.oneOff) >= 0 ? 'pos' : 'neg'}">${moneyExact(r.profit - r.oneOff)}</td></tr>
      </tbody>
    </table>
    <p class="funding-note" style="margin-top:10px">
      Разделение на <b>переменные</b> и <b>постоянные</b> расходы — не бухгалтерская формальность.
      Переменные определяют, стоит ли вообще принимать заказ; постоянные — какой масштаб нужен, чтобы выжить.
    </p>`;
}

function renderDistrictsTab() {
  const r = last();
  if (!r || !r.districts.length) return '<p class="funding-note">Запустите хотя бы один район.</p>';
  return `
    <table class="data">
      <thead><tr><th>Район</th><th>Заказы</th><th>Мин</th><th>Охват</th><th>Вклад</th></tr></thead>
      <tbody>
        ${r.districts.map((d) => `<tr>
          <td>${d.name}</td>
          <td>${compact(d.orders)}</td>
          <td>${num(d.deliveryTime)}</td>
          <td>${pct(d.penetration, 1)}</td>
          <td class="${d.contribution >= 0 ? 'pos' : 'neg'}">${money(d.contribution)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <p class="funding-note" style="margin-top:8px">Вклад района указан <i>до</i> вычета постоянных расходов на его содержание.</p>
    <table class="data" style="margin-top:10px">
      <thead><tr><th>Район</th><th>Цена ×</th><th>Скорость ×</th><th>Выбор ×</th><th>Узнав.</th></tr></thead>
      <tbody>
        ${r.districts.map((d) => `<tr>
          <td>${d.name}</td>
          <td class="${d.priceFactor >= 1 ? 'pos' : 'neg'}">${d.priceFactor.toFixed(2)}</td>
          <td class="${d.speedFactor >= 1 ? 'pos' : 'neg'}">${d.speedFactor.toFixed(2)}</td>
          <td class="${d.selectionFactor >= 1 ? 'pos' : 'neg'}">${d.selectionFactor.toFixed(2)}</td>
          <td>${pct(d.awareness, 0)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <p class="funding-note">Множители показывают, во сколько раз фактор меняет частоту заказов относительно эталона (1.00). Их произведение и есть ваш спрос.</p>`;
}

function renderAlgosTab() {
  const r = last();
  const q = algoQuality(state);
  const impact = r ? algorithmImpact(state) : [];
  const totalGain = impact.reduce((sum, i) => sum + i.profit, 0);
  const rndSpend = state.decisions.rnd ?? 0;

  const table = impact.length ? `
    <table class="data">
      <thead><tr><th>Алгоритм</th><th>₽ / нед</th><th>Заказы</th><th>Мин</th></tr></thead>
      <tbody>
        ${impact.map((i) => `<tr>
          <td>${i.name}</td>
          <td class="${i.profit >= 0 ? 'pos' : 'neg'}">${i.profit >= 0 ? '+' : ''}${compact(i.profit)}</td>
          <td class="${i.orders >= 0 ? 'pos' : 'neg'}">${i.orders >= 0 ? '+' : ''}${compact(i.orders)}</td>
          <td class="${i.deliveryTime <= 0 ? 'pos' : 'neg'}">${i.deliveryTime >= 0 ? '+' : ''}${i.deliveryTime.toFixed(1)}</td>
        </tr>`).join('')}
        <tr class="total">
          <td>Итого от алгоритмов</td>
          <td class="${totalGain >= 0 ? 'pos' : 'neg'}">${totalGain >= 0 ? '+' : ''}${compact(totalGain)}</td>
          <td colspan="2"></td>
        </tr>
        <tr class="total">
          <td>Стоимость команды</td>
          <td class="neg">−${compact(rndSpend)}</td>
          <td colspan="2"></td>
        </tr>
        <tr class="total">
          <td>Чистый эффект</td>
          <td class="${totalGain - rndSpend >= 0 ? 'pos' : 'neg'}">${totalGain - rndSpend >= 0 ? '+' : ''}${compact(totalGain - rndSpend)}</td>
          <td colspan="2"></td>
        </tr>
      </tbody>
    </table>
    <p class="funding-note" style="margin-top:8px">
      Каждая строка — честный контрфактический расчёт: прошлая неделя пересчитана заново
      с выключенным алгоритмом, и разница показана здесь. В реальной компании такой ответ
      стоит нескольких недель A/B-теста.
    </p>` : `<p class="funding-note">Ни один алгоритм не включён — сравнивать нечего.
      Начните с бюджета на Data Science: качество алгоритмов растёт как √(данные × команда),
      а данные копятся только от выполненных заказов.</p>`;

  const zero = impact.filter((i) => Math.abs(i.profit) < 1000);
  const zeroNote = zero.length ? `<div class="hint-box" style="margin-top:10px">
    ${zero.map((i) => i.name).join(', ')} сейчас ничего не меняет. Это не поломка:
    surge включается только при загрузке выше 70%, аллокация — только когда мощности не хватает,
    а прогноз бесполезен, если вы и так угадываете штат. Алгоритм стоит денег ровно столько же,
    работает он или нет.</div>` : '';

  return `
    <p class="funding-note">Качество алгоритмов: <b>${pct(q, 0)}</b>
      (данные ${pct(dataLevel(state), 0)} × команда ${pct(rndLevel(state), 0)}).
      Оно определяет и точность каждого алгоритма, и то, какие из них вообще доступны.</p>
    ${table}
    ${zeroNote}
    <h4 style="margin:14px 0 6px;font-size:13px">Чем алгоритм отличается от ползунка</h4>
    <p class="funding-note">Обычный рычаг задаёт <b>число</b>: цена доставки 149 ₽ для всех и всегда.
      Алгоритм задаёт <b>правило</b>: цена = f(загрузка), скидка = f(клиент), курьеры = f(прогноз).
      Правило умеет то, чего не умеет число, — быть разным в разных обстоятельствах.
      Именно поэтому оптимизация второго порядка способна улучшить сразу оба конца компромисса,
      который для одного числа неразрешим.</p>
    ${ALGORITHMS.map((a) => `<div style="margin-top:10px">
      <b style="font-size:12px">${a.name}</b>
      <div class="funding-note">${a.lesson}</div>
    </div>`).join('')}
  `;
}

function renderHelpTab() {
  return `<div class="help">
    <h4>Что это такое</h4>
    <p>Вы — операционный директор сервиса доставки еды в городе на 1,4 млн человек. Один ход = одна неделя.
    Цель за год (52 недели) — построить бизнес, который стоит дорого <i>и</i> в котором вам всё ещё принадлежит большая доля.</p>

    <h4>Как считается спрос</h4>
    <div class="formula">заказы = клиенты × частота
частота = базовая × Цена × √Скорость × √Выбор × сезонность
Цена   = (эталонная цена / ваша цена) ^ эластичность района
Скорость = (35 мин / ваше время) ^ 0.6
Выбор  = насыщение по числу подключённых ресторанов</div>
    <p>Клиенты — это <b>запас</b>: он пополняется пробными заказами (их даёт узнаваемость от маркетинга)
    и убывает от оттока (его определяет удовлетворённость).</p>

    <h4>Как считается предложение</h4>
    <div class="formula">пропускная способность = курьеры × заказов на курьера
заказов на курьера ≈ 95 × (1 + 0.35 × уровень технологий) × (3.5 км / плечо) ^ 0.45
загрузка = спрос / пропускная способность
время доставки = базовое × (1 + 0.85 × загрузка³)</div>
    <p>Куб в формуле — это очередь: при загрузке 100% время доставки почти удваивается.
    Это главная нелинейность игры и главная причина, по которой доставка ломается внезапно, а не постепенно.</p>

    <h4>Обратные связи, которые вас погубят</h4>
    <ul>
      <li><b>Спираль скорости.</b> Мало курьеров → долгая доставка → недовольство → отток клиентов → падение выручки → нечем платить курьерам.</li>
      <li><b>Спираль промо.</b> Скидка → рост заказов → отрицательный вклад → сжигание кассы → отмена скидки → обвал спроса.</li>
      <li><b>Спираль комиссии.</b> Подняли комиссию → рестораны уходят → падает выбор → падает спрос → падает выручка с ресторана → уходят ещё.</li>
      <li><b>Спираль зарплаты.</b> Срезали ставку курьеру → отток курьеров → рост загрузки оставшихся → выгорание → ещё больший отток.</li>
    </ul>

    <h4>На что смотреть каждую неделю</h4>
    <ul>
      <li><b>Вклад с заказа</b> — положителен ли он вообще.</li>
      <li><b>Загрузка курьеров</b> — держите 70–90%: ниже платите за простой, выше ломаете сроки.</li>
      <li><b>LTV/CAC</b> — есть ли смысл покупать ещё клиентов.</li>
      <li><b>Запас кассы</b> в неделях — сколько у вас осталось времени на ошибки.</li>
    </ul>

    <h4>Оптимизации второго порядка</h4>
    <p>Ползунки задают <b>числа</b>. Алгоритмы задают <b>правила</b>: цена = f(загрузка),
    скидка = f(клиент), штат = f(прогноз). Правило умеет быть разным в разных обстоятельствах —
    поэтому способно улучшить сразу оба конца компромисса, неразрешимого для одного числа.</p>
    <div class="formula">качество алгоритмов = √(данные × команда)
данные  = накопленные заказы / (заказы + 400 000)
команда = вложения в Data Science / (вложения + 25 млн ₽)</div>
    <p>Ни данные, ни команда по отдельности не работают. Отсюда естественный порядок:
    сначала объём, потом алгоритмы. Data Science, купленный до того, как появились заказы, —
    просто строка расходов.</p>
    <ul>
      <li><b>Батчинг</b> повышает число заказов на курьера и снижает ставку за отдельный заказ
      в связке — но каждый заказ едет дольше.</li>
      <li><b>Прогноз спроса</b> сам подбирает штат под целевую загрузку; вы выбираете,
      что важнее — скорость или экономия на курьерах.</li>
      <li><b>Персональные скидки</b> дают тот же прирост спроса за меньшие деньги.
      Чем уже охват, тем дешевле — и тем больнее промахи модели.</li>
      <li><b>Surge</b> зарабатывает не столько надбавкой, сколько сглаживанием пика.
      Но непредсказуемая цена сама по себе раздражает клиента.</li>
      <li><b>Аллокация курьеров</b> помогает только при дефиците мощности: при избытке
      перекос лишь ухудшает сервис в обделённых районах.</li>
      <li><b>Гибкая комиссия</b> позволяет держать высокую ставку, не теряя партнёров.</li>
    </ul>
    <p>Проверяйте их вкладку «Алгоритмы»: там каждая неделя пересчитана заново с выключенным
    алгоритмом, и видно, сколько он принёс на самом деле. Часто ответ — ноль.</p>

    <h4>Как считается финальный счёт</h4>
    <div class="formula">оценка = годовая выручка × мультипликатор
мультипликатор растёт от темпа роста и рентабельности
счёт = оценка × ваша доля</div>
    <p>Поэтому привлечь много денег — не победа: каждый раунд размывает вашу долю.
    Выиграет тот, кто дошёл до прибыльности с наименьшим разводнением.</p>

    <h4>Ограничения модели</h4>
    <p>Это учебная модель, а не прогноз. Конкурент здесь не адаптируется к вашим действиям,
    рестораны не торгуются индивидуально, а клиенты однородны внутри района.
    Модель предназначена показать <i>структуру</i> зависимостей, а не предсказать конкретный рынок.</p>
  </div>`;
}

function renderRightTab() {
  el('tabs').querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === rightTab);
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

function showGameOver() {
  const s = finalScore(state);
  const r = last();
  const grade = s.bankrupt ? 'Банкротство'
    : s.equityValue > 3e9 ? 'Отличный результат'
    : s.equityValue > 1e9 ? 'Крепкий бизнес'
    : s.equityValue > 3e8 ? 'Выжили' : 'Скромно';

  modal(`
    <h2>${s.bankrupt ? '💀 Деньги кончились' : '🏁 Год пройден'}</h2>
    <p class="funding-note">${s.bankrupt
      ? `Касса ушла в минус на неделе ${s.weeks}. В фудтехе это происходит быстро: постоянные расходы идут каждый день, а вклад с заказа появляется не сразу.`
      : `52 недели позади. Итоговая оценка компании и ваша доля в ней:`}</p>
    <div class="score-grid">
      <div class="stat"><div class="s-label">Оценка компании</div><div class="s-value">${money(s.valuation)}</div></div>
      <div class="stat"><div class="s-label">Ваша доля</div><div class="s-value">${pct(s.equity, 1)}</div></div>
      <div class="stat"><div class="s-label">Ваш результат</div><div class="s-value">${money(s.equityValue)}</div></div>
      <div class="stat"><div class="s-label">Привлечено</div><div class="s-value">${money(s.raised)}</div></div>
      <div class="stat"><div class="s-label">Касса</div><div class="s-value">${money(s.cash)}</div></div>
      <div class="stat"><div class="s-label">Оценка результата</div><div class="s-value">${grade}</div></div>
    </div>
    ${r ? `<p class="funding-note">Последняя неделя: ${compact(r.orders)} заказов, вклад с заказа ${num(r.cmPerOrder)} ₽,
      прибыль ${money(r.profit)}, доля рынка ${pct(r.marketShare)}, время доставки ${num(r.avgDeliveryTime)} мин.</p>` : ''}
    <div class="hint-box" style="margin-top:10px">
      <b>Вопросы для разбора:</b> в какой момент рост перестал улучшать прибыль? Что было узким местом —
      курьеры, рестораны или спрос? Дешевле ли обошёлся бы тот же результат без привлечённых раундов?
    </div>
  `, [
    { label: 'Сыграть ещё раз', primary: true, onClick: () => restart() },
    { label: 'Посмотреть графики', onClick: () => {} },
  ]);
}

function showHelp() {
  modal(`<h2>Как играть</h2>${renderHelpTab()}`, [{ label: 'Понятно', primary: true }]);
}

// ----------------------------------------------------------------------------
// Ход игры
// ----------------------------------------------------------------------------
function nextWeek() {
  if (state.over) { showGameOver(); return; }
  const ev = state.pendingEvent;
  if (ev && ev.options && state.pendingChoice === null) {
    toast('Сначала выберите решение по событию недели.');
    return;
  }
  const { state: next } = step(state, { decisions: state.decisions, eventChoice: state.pendingChoice ?? 0 });
  state = next;
  save();
  renderAll();
  if (state.over) showGameOver();
}

function restart() {
  const seed = `novograd-${Math.floor(Math.random() * 1e6)}`;
  state = createInitialState(seed);
  save();
  renderAll();
}

function renderAll() {
  if (!leversBuilt) buildLevers();
  syncLevers();
  renderAlgos();
  renderOpsReadout();
  renderKpis();
  renderDistricts();
  renderFunding();
  renderWeather();
  renderEvent();
  renderReport();
  renderChart();
  renderRightTab();
  el('btn-next').textContent = state.over ? 'Итоги партии' : `Прожить неделю ${state.week + 1} →`;
}

export function init() {
  state = load() ?? createInitialState('novograd');

  el('btn-next').addEventListener('click', nextWeek);
  el('btn-help').addEventListener('click', showHelp);
  el('btn-restart').addEventListener('click', () => {
    modal('<h2>Начать заново?</h2><p class="funding-note">Текущая партия будет потеряна, город сгенерируется с новым случайным набором событий.</p>',
      [{ label: 'Да, заново', primary: true, onClick: restart }, { label: 'Отмена' }]);
  });
  el('tabs').querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => { rightTab = t.dataset.tab; renderRightTab(); });
  });
  window.addEventListener('resize', () => renderChart());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.repeat && document.activeElement?.tagName !== 'BUTTON') nextWeek();
  });

  renderAll();
  if (state.week === 0) rightTab = 'unit';
}
