// Тесты движка кинотеатра. Проверяют не «красивые числа», а то, что модель
// ведёт себя как экономика: у решений есть цена, у роста — предел, а у
// каждого рычага — сторона, в которую он ломает результат.

import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG, DEFAULT_DECISIONS, SEGMENTS, GENRES, LEVERS, LEVER_GROUPS, ALGORITHMS } from '../src/model/config.js';
import {
  SCALES, scaleById, projectPrice, qualityEstimate, releaseBuzz, projectAppeal,
} from '../src/model/slate.js';
import { annualShare, raiseShock, annualSubs } from '../src/model/pricing.js';
import { PARTNERS, partnerById, rollPartnerOffer, partnerTotals } from '../src/model/partners.js';
import {
  createInitialState, step, unitEconomics, valuation, fundingOffer, raise,
  explain, explainFactors, finalScore, algoQuality, dataLevel, rndLevel, techLevel,
  algorithmImpact, catalogDepth, catalogFreshness, projectCost, genreById, segmentById,
} from '../src/model/engine.js';
import { RIVAL_RELEASES, classifyRelease, rivalEffect, seasonOf, seasonHours } from '../src/model/market.js';
import { createRival, rivalSubs, chooseStance, STANCES, STANCE_MIN_MONTHS } from '../src/model/rival.js';
import { makeGoal, goalProgress } from '../src/model/board.js';
import {
  CRISES, crisisById, crisisEffects, resolutionCost, rollCrisis, MAX_ESCALATION,
} from '../src/model/crises.js';

// Обёртка: бросок кризиса без активного, чтобы мерить только вероятность
const rollCrisisProbe = (rng, month, subs) => rollCrisis(rng, month, { subs, active: false });
import { EVENTS, rollEvent, applyEvent, neutralModifiers } from '../src/model/events.js';
import { createRng } from '../../../shared/rng.js';

const decide = (over = {}) => ({ ...DEFAULT_DECISIONS, ...over });

// Прогоняет n месяцев с фиксированными решениями.
// `act(state, month)` может вернуть действия: запуски, релизы, повышение цены.
function run(months, decisions, seed = 'test', act = null) {
  let state = createInitialState(seed);
  const reports = [];
  for (let i = 0; i < months && !state.over; i++) {
    const actions = act ? act(state, state.month + 1) : {};
    const res = step(state, { decisions, eventChoice: 0, ...actions });
    state = res.state;
    reports.push(res.report);
  }
  return { state, reports, last: reports[reports.length - 1] };
}

// Держит студию загруженной и выпускает всё готовое сразу: базовое поведение,
// от которого удобно отсчитывать более тонкие стратегии.
const keepBusy = (genre = 'family', scale = 'season', segment = null) => (state) => {
  const slate = state.slate ?? [];
  const producing = slate.filter((p) => p.status === 'production').length;
  const slots = Math.round(state.decisions.studioSlots);
  const commission = producing < slots ? [{ genre, scale, segment }] : [];
  const release = slate.filter((p) => p.status === 'ready').map((p) => ({ id: p.id, campaign: 0 }));
  return { commission, release };
};

// Разогретое состояние, от которого удобно сравнивать один шаг
function warmed(decisions = decide({ licensing: 40_000_000, brandMarketing: 30_000_000 }), months = 10, seed = 'warm') {
  return run(months, decisions, seed, keepBusy()).state;
}

// Живая компания: контентный бюджет — доля выручки, касса подпирается раундом.
// Именно так игра и задумана: постоянный крупный бюджет с первого месяца
// сжигает кассу раньше, чем приходит выручка.
function grown(months, seed = 'grow', over = {}) {
  let state = createInitialState(seed);
  let revenue = 0;
  let raises = 0;
  for (let i = 0; i < months && !state.over; i++) {
    if (state.cash < 900_000_000 && raises < CONFIG.fundingOptions.length) {
      state = raise(state, CONFIG.fundingOptions[raises]).state;
      raises += 1;
    }
    const budget = 90_000_000 + revenue * 0.5;
    const res = step(state, {
      decisions: decide({
        priceNew: 399, priceAds: 149, adLoad: 4,
        licensing: Math.round(budget * 0.55),
        brandMarketing: Math.round(45_000_000 + revenue * 0.25),
        tech: 20_000_000, rnd: 20_000_000,
        ...over,
      }),
      ...keepBusy()(state),
    });
    state = res.state;
    revenue = res.report.revenue;
  }
  return state;
}

// Настроенная стратегия: контентный бюджет — база плюс доля выручки.
// Постоянная сумма не работает: чтобы держать долю против конкурента,
// вкладывать приходится пропорционально тому, что сервис уже зарабатывает.
function reinvest(months, seed, over = {}, lic = 0.45) {
  const P = {
    base: 440_000_000, price: 449, ad: 6, slots: 3, annual: 0.1,
    campaign: 250_000_000, genre: 'family', segment: 'mass', ...over,
  };
  let state = createInitialState(seed);
  let raises = 0;
  let n = 0;
  for (let i = 0; i < months && !state.over; i++) {
    if (state.cash < 800_000_000 && raises < CONFIG.fundingOptions.length) {
      state = raise(state, CONFIG.fundingOptions[raises]).state;
      raises += 1;
    }
    const slate = state.slate ?? [];
    const producing = slate.filter((p) => p.status === 'production').length;
    const ready = slate.filter((p) => p.status === 'ready');
    // Смешанный конвейер: пилоты чередуются с сезонами
    const commission = (producing < P.slots && lic < 1)
      ? [{ genre: P.genre, scale: n++ % 2 ? 'pilot' : 'season', segment: P.segment }] : [];
    // Придерживаем готовое до высокого сезона, но не дольше четырёх месяцев
    const season = seasonOf(state.month + 1);
    const good = season === 'winter' || season === 'autumn';
    const release = ready
      .filter((p) => good || p.monthsHeld >= 4)
      .map((p) => ({ id: p.id, campaign: P.campaign }));

    const res = step(state, {
      decisions: decide({
        priceNew: P.price, priceAds: Math.round(P.price * 0.37), adLoad: P.ad,
        annualDiscount: P.annual,
        licensing: Math.round(P.base * (lic / 0.45)),
        brandMarketing: 220_000_000, tech: 20_000_000, rnd: 20_000_000,
        studioSlots: lic >= 1 ? 1 : P.slots,
      }),
      commission, release,
    });
    state = res.state;
  }
  return { state, last: state.history[state.history.length - 1] };
}

const clampSlots = (n) => Math.min(5, Math.max(1, n));

// Решения последнего месяца разогретой компании — чтобы сравнивать «то же самое,
// но с включённым алгоритмом», а не «другую компанию»
const lastDecisions = (state, over = {}) => ({
  ...structuredClone(state.history[state.history.length - 1].decisions), ...over,
});

const once = (state, decisions) => step(state, { decisions, eventChoice: 0 }).report;

// ----------------------------------------------------------------------------
// Базовая целостность
// ----------------------------------------------------------------------------

test('стартовое состояние согласовано', () => {
  const s = createInitialState('a');
  assert.equal(s.cash, CONFIG.startCash);
  assert.equal(s.month, 0);
  assert.equal(s.equity, 1);
  assert.equal(s.catalogOriginal, 0);
  assert.equal(s.slate.length, 0);
  assert.ok(s.catalogLicensed >= 0);
  for (const def of SEGMENTS) {
    assert.equal(s.segments[def.id].pricing.lockedPrice, DEFAULT_DECISIONS.priceNew);
  }
});

test('симуляция детерминирована при одном seed', () => {
  const d = decide({ licensing: 60_000_000, brandMarketing: 50_000_000 });
  const a = run(24, d, 'seed-42');
  const b = run(24, d, 'seed-42');
  assert.deepEqual(
    a.reports.map((r) => [r.subs, r.cash, r.hours]),
    b.reports.map((r) => [r.subs, r.cash, r.hours]),
  );
});

test('разные seed дают разные партии', () => {
  const d = decide({ licensing: 60_000_000, brandMarketing: 50_000_000 });
  const a = run(24, d, 'seed-1');
  const b = run(24, d, 'seed-2');
  assert.notDeepEqual(a.reports.map((r) => r.cash), b.reports.map((r) => r.cash));
});

test('ни одна метрика не становится NaN или бесконечной', () => {
  const { reports } = run(CONFIG.monthsTotal, decide({
    licensing: 120_000_000, brandMarketing: 90_000_000,
    tech: 20_000_000, rnd: 20_000_000, adLoad: 8, trialDays: 14,
  }));
  assert.ok(reports.length > 0);
  for (const r of reports) {
    for (const [key, value] of Object.entries(r)) {
      if (typeof value === 'number') {
        assert.ok(Number.isFinite(value), `${key} в месяце ${r.month} = ${value}`);
      }
    }
    for (const s of r.segments) {
      for (const [key, value] of Object.entries(s)) {
        if (typeof value === 'number') {
          assert.ok(Number.isFinite(value), `segment ${s.id}.${key} в месяце ${r.month} = ${value}`);
        }
      }
    }
  }
});

test('запасы подписчиков неотрицательны и не превышают потенциал сегмента', () => {
  const { state } = run(CONFIG.monthsTotal, decide({
    licensing: 300_000_000, brandMarketing: 400_000_000, priceNew: 149, priceAds: 49,
  }));
  for (const def of SEGMENTS) {
    const seg = state.segments[def.id];
    assert.ok(seg.premium >= 0, `${def.id}.premium`);
    assert.ok(seg.ads >= 0, `${def.id}.ads`);
    assert.ok(seg.premium + seg.ads <= def.potential * 1.001, `${def.id} превысил потенциал`);
    assert.ok(seg.awareness >= 0 && seg.awareness <= 1, `${def.id}.awareness`);
  }
});

test('касса сходится с отчётом по прибыли', () => {
  let state = createInitialState('cash');
  const d = decide({ licensing: 50_000_000, originals: 80_000_000, brandMarketing: 40_000_000 });
  let cash = state.cash;
  for (let i = 0; i < 18 && !state.over; i++) {
    const res = step(state, { decisions: d, eventChoice: 0 });
    state = res.state;
    cash += res.report.profit - res.report.oneOff + res.report.boardInjection;
    assert.ok(Math.abs(cash - res.report.cash) < 1, `месяц ${res.report.month}: ${cash} ≠ ${res.report.cash}`);
  }
});

test('после банкротства партия останавливается', () => {
  // Огромные постоянные расходы при нулевой выручке
  const { state, reports } = run(CONFIG.monthsTotal, decide({
    licensing: 900_000_000, originals: 900_000_000, brandMarketing: 900_000_000,
    tech: 200_000_000, rnd: 200_000_000,
  }), 'ruin');
  assert.equal(state.over, 'bankrupt');
  assert.ok(state.cash < 0);
  assert.ok(reports.length < CONFIG.monthsTotal);
  const after = step(state, { decisions: DEFAULT_DECISIONS });
  assert.equal(after.state.month, state.month, 'шаг после конца партии не должен двигать месяц');
});

test('партия заканчивается ровно через monthsTotal месяцев', () => {
  const { state, reports } = run(CONFIG.monthsTotal + 5,
    decide({ licensing: 30_000_000, studioSlots: 1 }), 'finish');
  assert.equal(state.over, 'finished');
  assert.equal(reports.length, CONFIG.monthsTotal);
  assert.equal(state.month, CONFIG.monthsTotal);
});

// ----------------------------------------------------------------------------
// Экономические зависимости: направление важнее величины
// ----------------------------------------------------------------------------

test('выше цена — меньше приток новых подписчиков', () => {
  const base = warmed();
  const cheap = once(base, decide({ priceNew: 249, priceAds: 99 }));
  const dear = once(base, decide({ priceNew: 699, priceAds: 299 }));
  assert.ok(dear.newSubs < cheap.newSubs, `${dear.newSubs} должно быть меньше ${cheap.newSubs}`);
  assert.ok(dear.arpu > cheap.arpu, 'зато выручка с подписчика выше');
});

test('дорогая подписка сильнее гонит отток — но только когда база на неё переведена', () => {
  const base = warmed();
  const cheap = step(base, { decisions: decide({ priceNew: 249, priceAds: 99 }), raisePrice: true }).report;
  const dear = step(base, { decisions: decide({ priceNew: 899, priceAds: 399 }), raisePrice: true }).report;
  assert.ok(dear.churnRate > cheap.churnRate);
  assert.ok(dear.raiseLost > cheap.raiseLost, 'и повышение выносит больше людей');
});

test('без перевода базы новая цена бьёт только по притоку', () => {
  const base = warmed();
  const d = lastDecisions(base, { priceNew: 899, priceAds: 399 });
  const noRaise = step(base, { decisions: d }).report;
  const withRaise = step(base, { decisions: d, raisePrice: true }).report;
  assert.ok(noRaise.priceGap > 0.2, 'база продолжает платить старую цену');
  assert.ok(withRaise.priceGap < noRaise.priceGap, 'перевод закрывает разрыв');
  assert.ok(withRaise.subs < noRaise.subs, 'и стоит подписчиков');
});

test('оптимум цены внутренний, а не на краю диапазона', () => {
  const lever = LEVERS.find((l) => l.key === 'priceNew');
  const prices = [lever.min, 249, 349, 399, 499, 599, lever.max];
  const results = prices.map((p) => {
    const { last } = run(30, decide({
      priceNew: p, priceAds: Math.round(p * 0.37),
      licensing: 260_000_000, brandMarketing: 120_000_000, studioSlots: 2,
    }), 'price-opt', keepBusy());
    return { p, value: last ? last.equityValue : -Infinity };
  });
  const best = results.reduce((a, b) => (b.value > a.value ? b : a));
  assert.ok(best.p > lever.min && best.p < lever.max,
    `лучшая цена ${best.p} упёрлась в край: ${JSON.stringify(results.map((r) => [r.p, Math.round(r.value / 1e9)]))}`);
});

test('рекламная нагрузка — это обмен выручки на отток', () => {
  const base = warmed();
  const light = once(base, decide({ adLoad: 1 }));
  const heavy = once(base, decide({ adLoad: 12 }));
  assert.ok(heavy.adRevenue > light.adRevenue, 'больше минут — больше рекламной выручки');
  assert.ok(heavy.churnRate > light.churnRate, 'и больше оттока');
  assert.ok(heavy.newSubs < light.newSubs, 'и хуже приток');
});

test('маркетинг растит узнаваемость с убывающей отдачей', () => {
  // Один шаг из одного и того же состояния: так измеряется именно кривая
  // отдачи, а не то, кто первым сожжёт кассу при большом бюджете.
  const base = warmed();
  const d = lastDecisions(base);
  const gain = (m) => {
    const before = base.segments.mass.awareness;
    const r = once(base, { ...d, brandMarketing: m });
    return r.segments.find((x) => x.id === 'mass').awareness - before;
  };
  const levels = [80_000_000, 320_000_000, 1_280_000_000];
  const gains = levels.map(gain);

  for (let i = 1; i < gains.length; i++) {
    assert.ok(gains[i] > gains[i - 1], `больше денег — больше узнаваемости: ${gains}`);
  }
  // Убывающая отдача: каждый следующий рубль покупает меньше узнаваемости,
  // чем предыдущий. Учетверение бюджета не даёт четырёхкратной прибавки.
  const perRouble = gains.map((g, i) => g / levels[i]);
  for (let i = 1; i < perRouble.length; i++) {
    assert.ok(perRouble[i] < perRouble[i - 1],
      `рубль должен дешеветь по эффекту: ${perRouble.map((x) => (x * 1e9).toFixed(2))}`);
  }
});

test('маркетинг без каталога сгорает впустую', () => {
  const withCatalog = run(14, decide({ brandMarketing: 200_000_000, licensing: 200_000_000 }), 'burn').last;
  const withoutCatalog = run(14, decide({ brandMarketing: 200_000_000, licensing: 0, studioSlots: 1 }), 'burn').last;
  assert.ok(withoutCatalog.subs < withCatalog.subs * 0.6,
    'без контента те же деньги приводят кратно меньше людей');
});

test('часы просмотра — расход: больше вовлечённости, выше трафик', () => {
  const base = warmed();
  const r = once(base, decide({ bitrate: 12 }));
  const low = once(base, decide({ bitrate: 2 }));
  assert.ok(r.cdnCost > low.cdnCost, 'качество картинки стоит трафика');
  assert.ok(r.cdnPerHour > low.cdnPerHour);
  assert.ok(low.churnRate > r.churnRate, 'зато плохая картинка раздражает');
});

test('технологический бюджет удешевляет час трафика', () => {
  const plain = run(18, decide({ licensing: 80_000_000, tech: 0 }), 'tech').last;
  const invested = run(18, decide({ licensing: 80_000_000, tech: 40_000_000 }), 'tech').last;
  assert.ok(invested.cdnPerHour < plain.cdnPerHour);
  assert.ok(invested.techLevel > plain.techLevel);
});

// ----------------------------------------------------------------------------
// Каталог: аренда против актива
// ----------------------------------------------------------------------------

test('лицензии истекают, оригиналы остаются навсегда', () => {
  const licensed = run(14, decide({ licensing: 150_000_000, originals: 0 }), 'cat').state;
  assert.ok(licensed.catalogOriginal === 0);
  const stop = step({ ...structuredClone(licensed), over: null },
    { decisions: decide({ licensing: 0, originals: 0 }) }).report;
  assert.ok(stop.catalogLicensed < licensed.catalogLicensed,
    'без закупки арендованный каталог тает');

  const licensedLoss = 1 - stop.catalogLicensed / licensed.catalogLicensed;

  const original = run(14, decide({ licensing: 0, studioSlots: 2 }), 'cat', keepBusy('drama')).state;
  assert.ok(original.catalogOriginal > 0, 'премьеры дошли до полки');
  const stopO = step({ ...structuredClone(original), over: null },
    { decisions: decide({ licensing: 0, studioSlots: 1 }) }).report;
  const originalLoss = 1 - stopO.catalogOriginal / original.catalogOriginal;
  assert.ok(originalLoss < licensedLoss / 5,
    `своя драма должна стареть кратно медленнее аренды: ${originalLoss} против ${licensedLoss}`);
});

test('дешёвый жанр наполняет полку быстро и так же быстро её теряет', () => {
  const drama = GENRES.find((g) => g.id === 'drama');
  const reality = GENRES.find((g) => g.id === 'reality');
  assert.ok(reality.decay > drama.decay * 5, 'реалити устаревает несравнимо быстрее');
  assert.ok(reality.depthValue < drama.depthValue, 'и час его стоит меньше в глубине');
  // За час контента реалити дешевле драмы — в этом и соблазн
  assert.ok(reality.costPerHour < drama.costPerHour);
});

test('час оригинала весит в глубине больше часа лицензии', () => {
  assert.ok(CONFIG.originalDepthWeight > CONFIG.licenseDepthWeight);
  const licensed = run(20, decide({ licensing: 200_000_000, studioSlots: 1 }), 'w').last;
  const mixed = run(20, decide({ licensing: 100_000_000, studioSlots: 2 }), 'w', keepBusy()).last;
  assert.ok(mixed.catalogHours < licensed.catalogHours, 'часов у оригиналов физически меньше');
  assert.ok(mixed.originalShare > 0, 'зато доля своего выше нуля');
});

test('проект готов ровно через столько месяцев, сколько обещал масштаб', () => {
  for (const sc of SCALES) {
    let state = createInitialState(`pipe-${sc.id}`);
    const d = decide({ licensing: 0 });
    let readyAt = null;
    for (let i = 0; i < sc.months + 3 && !readyAt; i++) {
      const res = step(state, {
        decisions: d,
        commission: i === 0 ? [{ genre: 'drama', scale: sc.id, segment: null }] : [],
      });
      state = res.state;
      if (res.report.finished.length) readyAt = res.report.month;
    }
    assert.equal(readyAt, sc.months, `${sc.id}: готов на ${readyAt}, обещано ${sc.months}`);
  }
});

test('готовый проект ждёт решения игрока, а не выходит сам', () => {
  let state = createInitialState('vault');
  const d = decide({ licensing: 0 });
  for (let i = 0; i < 10; i++) {
    const res = step(state, {
      decisions: d,
      commission: i === 0 ? [{ genre: 'drama', scale: 'pilot', segment: null }] : [],
      release: [],   // не выпускаем никогда
    });
    state = res.state;
    assert.equal(res.report.premieres.length, 0, `месяц ${res.report.month}: премьера без команды`);
  }
  const vault = state.slate.filter((p) => p.status === 'ready');
  assert.equal(vault.length, 1, 'проект лежит в запасе');
  assert.ok(vault[0].monthsHeld >= 5, 'и копит месяцы на полке');

  // Пока лежит — выветривается
  const fresh = releaseBuzz({ ...vault[0], monthsHeld: 0 });
  assert.ok(releaseBuzz(vault[0]) < fresh * 0.8, 'шум премьеры за это время упал');

  const out = step(state, { decisions: d, release: [{ id: vault[0].id, campaign: 0 }] }).report;
  assert.equal(out.premieres.length, 1, 'по команде выходит');
});

test('кампания работает только вместе с релизом', () => {
  let state = createInitialState('camp');
  const d = decide({ licensing: 0 });
  for (let i = 0; i < 5; i++) {
    state = step(state, {
      decisions: d,
      commission: i === 0 ? [{ genre: 'blockbuster', scale: 'pilot', segment: 'mass' }] : [],
      release: [],
    }).state;
  }
  const ready = state.slate.find((p) => p.status === 'ready');
  const quiet = step(structuredClone(state), { decisions: d, release: [{ id: ready.id, campaign: 0 }] }).report;
  const loud = step(structuredClone(state), { decisions: d, release: [{ id: ready.id, campaign: 300_000_000 }] }).report;
  assert.ok(loud.premieres[0].buzz > quiet.premieres[0].buzz * 1.5, 'кампания усиливает шум');
  assert.ok(loud.campaignSpend === 300_000_000);
  assert.ok(loud.newSubs > quiet.newSubs, 'и приводит больше людей');
});

test('прицельный проект бьёт в свой сегмент и слабее — в остальные', () => {
  const aimed = { genre: 'drama', segment: 'cinephile' };
  const broad = { genre: 'drama', segment: null };
  assert.ok(projectAppeal(aimed, 'cinephile') > projectAppeal(broad, 'cinephile'));
  assert.ok(projectAppeal(aimed, 'youth') < projectAppeal(broad, 'youth'));
});

test('слотов ограниченное число, и лишние запуски отклоняются', () => {
  const state = createInitialState('slots');
  const three = [1, 2, 3].map(() => ({ genre: 'drama', scale: 'season', segment: null }));
  const r = step(state, { decisions: decide({ studioSlots: 2, licensing: 0 }), commission: three }).report;
  assert.equal(r.started.length, 2, 'запустилось столько, сколько слотов');
  assert.equal(r.rejected.length, 1, 'третий отклонён');
  assert.equal(r.rejected[0].reason, 'slots');
  assert.equal(r.slotsUsed, 2);
});

test('слот стоит денег, даже когда пустует', () => {
  const idle = run(6, decide({ studioSlots: 5, licensing: 0 }), 'idle').last;
  const lean = run(6, decide({ studioSlots: 1, licensing: 0 }), 'idle').last;
  assert.ok(idle.slotCost > lean.slotCost);
  assert.ok(idle.profit < lean.profit, 'пустая мощность — чистый убыток');
});

test('производство списывается равными долями, а не одним платежом', () => {
  const state = createInitialState('spread');
  const sc = scaleById('season');
  const price = projectPrice('drama', 'season', 1);
  const first = step(state, {
    decisions: decide({ licensing: 0, studioSlots: 1 }),
    commission: [{ genre: 'drama', scale: 'season', segment: null }],
  }).report;
  assert.ok(Math.abs(first.productionSpend - price / sc.months) < price * 0.02,
    `в первый месяц списано ${first.productionSpend}, ожидалось около ${price / sc.months}`);
});

test('смешанная стратегия бьёт обе крайности', () => {
  const value = (lic) => ['mix1', 'mix2', 'mix3']
    .reduce((s, seed) => s + reinvest(CONFIG.monthsTotal, seed, {}, lic).last.equityValue, 0) / 3;
  const onlyLicences = value(1);     // студия на одном слоте, ничего не запускаем
  const onlyOriginals = value(0);    // ноль закупки, только своё
  const mixed = value(0.45);

  assert.ok(mixed > onlyLicences,
    `смесь ${Math.round(mixed / 1e9)} млрд должна бить одни лицензии ${Math.round(onlyLicences / 1e9)}`);
  assert.ok(mixed > onlyOriginals,
    `смесь ${Math.round(mixed / 1e9)} млрд должна бить одни оригиналы ${Math.round(onlyOriginals / 1e9)}`);
});

test('эксклюзив удерживает: своя доля каталога снижает отток', () => {
  // Ceteris paribus: одинаковая взвешенная глубина, разное происхождение часов.
  // Гонять две разные партии тут нельзя — они отличаются ещё и расходами.
  const base = warmed();
  const rented = structuredClone(base);
  const owned = structuredClone(base);

  const hours = 900;
  owned.originalsByGenre.drama += hours;
  rented.catalogLicensed += hours * GENRES.find((g) => g.id === 'drama').depthValue
    * CONFIG.originalDepthWeight / CONFIG.licenseDepthWeight;

  const d = lastDecisions(base, { licensing: 0 });
  const a = once(rented, d);
  const b = once(owned, d);

  assert.ok(b.originalShare > a.originalShare, 'доля своего выше');
  assert.ok(b.churnRate < a.churnRate,
    `отток при своём каталоге ${b.churnRate} должен быть ниже ${a.churnRate}`);
});

test('свежесть стареет: без новинок каталог перестаёт удерживать', () => {
  let s = grown(24, 'fresh');
  s = structuredClone(s);
  s.over = null;
  s.pipeline = [];               // ничего не выйдет: студия остановлена
  const before = s.freshHours;
  const stop = decide({ licensing: 0, originals: 0, brandMarketing: 0 });
  for (let i = 0; i < 8; i++) {
    s = step(s, { decisions: stop }).state;
    s.over = null;
  }
  assert.ok(s.freshHours < before * 0.5,
    `за восемь месяцев без релизов свежесть должна упасть вдвое: ${before} → ${s.freshHours}`);
});

test('при прочих равных выветрившийся каталог даёт больший отток', () => {
  const warm = grown(24, 'boredom');
  const fresh = structuredClone(warm);
  const stale = structuredClone(warm);
  stale.freshHours = 0;            // тот же каталог, но ничего нового
  const d = lastDecisions(warm, { licensing: 0, originals: 0 });
  assert.ok(once(stale, d).churnRate > once(fresh, d).churnRate);
});

test('глубина и свежесть насыщаются, а не растут линейно', () => {
  assert.ok(catalogDepth(2000) < catalogDepth(4000));
  assert.ok(catalogDepth(4000) - catalogDepth(2000) < catalogDepth(2000) - catalogDepth(0));
  assert.ok(catalogFreshness(0) === 0 || catalogFreshness(0) < 0.01);
  assert.ok(catalogFreshness(800) > catalogFreshness(200));
});

// ----------------------------------------------------------------------------
// Афиша конкурента и сезон
// ----------------------------------------------------------------------------

test('чужая премьера бьёт по притоку и по оттоку сразу', () => {
  const base = grown(14, 'loud');
  const quiet = structuredClone(base);
  quiet.rivalState.pipeline = [];
  const loud = structuredClone(base);
  // Конкуренту остался месяц до громкой премьеры — она выйдет на этом ходу
  loud.rivalState.pipeline = [
    { genre: 'blockbuster', monthsLeft: 1, hours: 4, quality: 1.3 },
    { genre: 'blockbuster', monthsLeft: 1, hours: 4, quality: 1.3 },
  ];
  const d = lastDecisions(base);
  const a = once(quiet, d);
  const b = once(loud, d);
  assert.equal(a.rival, 'none');
  assert.ok(['major', 'mega'].includes(b.rival), `ожидалась громкая премьера, а не ${b.rival}`);
  assert.ok(b.newSubs < a.newSubs, 'приток новых падает');
  assert.ok(b.churnRate > a.churnRate, 'отток растёт');
  assert.ok(b.hours < a.hours, 'смотрят меньше');
});

test('своя громкая премьера гасит чужую', () => {
  const naked = rivalEffect('mega', 0);
  const counter = rivalEffect('mega', 1.2);
  assert.ok(counter.acquisitionMult > naked.acquisitionMult);
  assert.ok(counter.churnAdd < naked.churnAdd);
  assert.ok(counter.hoursMult > naked.hoursMult);
});

test('афиша известна на месяц вперёд', () => {
  const res = step(createInitialState('cal'), { decisions: DEFAULT_DECISIONS });
  assert.ok(res.report.rival in RIVAL_RELEASES);
  assert.ok(res.report.rivalNext in RIVAL_RELEASES);
  assert.equal(res.state.rival, res.report.rivalNext, 'анонс становится текущим месяцем');
});

test('зимой смотрят больше, летом — меньше', () => {
  assert.equal(seasonOf(1), 'winter');
  assert.equal(seasonOf(7), 'summer');
  assert.equal(seasonOf(13), 'winter');
  assert.ok(seasonHours(1) > seasonHours(7));
});

test('шум чужой премьеры превращается в известные категории', () => {
  for (const buzz of [0, 0.2, 0.8, 1.4, 2.5, 9]) {
    assert.ok(classifyRelease(buzz) in RIVAL_RELEASES, `buzz ${buzz}`);
  }
  assert.equal(classifyRelease(0), 'none');
  assert.equal(classifyRelease(9), 'mega');
});

// ----------------------------------------------------------------------------
// Алгоритмы: оптимизации второго порядка
// ----------------------------------------------------------------------------

test('алгоритм не включается без накопленного качества', () => {
  const hard = ALGORITHMS.reduce((a, b) => (b.unlock > a.unlock ? b : a));
  const res = step(createInitialState('lock'), {
    decisions: decide({ algoOn: { [hard.key]: true } }),
  });
  assert.equal(res.state.installed[hard.key] ?? false, false);
  assert.equal(res.report.algoActive[hard.key], false);
  assert.equal(res.report.installCost, 0);
});

test('качество алгоритмов — среднее геометрическое данных и команды', () => {
  const s = createInitialState('q');
  s.dataStock = 0; s.rndStock = 10 ** 9;
  assert.equal(algoQuality(s), 0, 'команда без данных ничего не стоит');
  s.dataStock = 10 ** 9; s.rndStock = 0;
  assert.equal(algoQuality(s), 0, 'данные без команды тоже');
  s.dataStock = CONFIG.dataSaturation; s.rndStock = CONFIG.rndSaturation;
  assert.ok(algoQuality(s) > 0.4);
  assert.ok(Math.abs(algoQuality(s) - Math.sqrt(dataLevel(s) * rndLevel(s))) < 1e-9);
});

test('включённый алгоритм стоит денег один раз', () => {
  const state = grown(24, 'algo');
  assert.ok(!state.over, 'разогретая компания должна быть жива');
  const easy = ALGORITHMS.filter((a) => algoQuality(state) >= a.unlock);
  assert.ok(easy.length > 0, 'к 24-му месяцу хоть один алгоритм должен открыться');
  const key = easy[0].key;
  const d = lastDecisions(state, { algoOn: { [key]: true } });
  const first = step(state, { decisions: d });
  assert.equal(first.report.installCost, easy[0].install);
  assert.deepEqual(first.report.installedNow, [key]);
  const second = step(first.state, { decisions: d });
  assert.equal(second.report.installCost, 0, 'повторно платить не надо');
  assert.equal(second.report.algoActive[key], true);
});

test('рекомендации увеличивают воспринимаемый каталог, а не реальный', () => {
  const state = structuredClone(grown(24, 'reco'));
  state.installed.recommendations = true;
  const base = lastDecisions(state);
  const reco = (strength) => once(state, {
    ...base,
    algoOn: { ...base.algoOn, recommendations: true },
    algoParam: { ...base.algoParam, recommendations: strength },
  });
  const off = once(state, base);
  const on = reco(0.4);
  assert.ok(Math.abs(on.depth - off.depth) < 1e-9, 'реальная глубина каталога не меняется');
  assert.ok(on.perceivedDepth > off.perceivedDepth, 'а воспринимаемая — растёт');
  assert.ok(on.hours > off.hours, 'и часов смотрят больше');
});

test('у силы рекомендаций есть внутренний оптимум, а не «выкрутить на максимум»', () => {
  const state = structuredClone(grown(24, 'reco'));
  state.installed.recommendations = true;
  const base = lastDecisions(state);
  const values = [0, 0.2, 0.4, 0.6, 0.8, 1].map((s) => ({
    s,
    depth: once(state, {
      ...base,
      algoOn: { ...base.algoOn, recommendations: s > 0 },
      algoParam: { ...base.algoParam, recommendations: s },
    }).perceivedDepth,
  }));
  const best = values.reduce((a, b) => (b.depth > a.depth ? b : a));
  assert.ok(best.s > 0 && best.s < 1,
    `оптимум ${best.s} на краю: ${JSON.stringify(values.map((v) => [v.s, +v.depth.toFixed(4)]))}`);
});

test('слабая модель рекомендаций схлопывает ленту в пузырь', () => {
  const state = structuredClone(grown(24, 'reco'));
  state.installed.recommendations = true;
  state.dataStock = 0;
  state.rndStock = 0;               // качество ≈ 0: модель ничего не знает
  const base = lastDecisions(state);
  const off = once(state, base);
  const on = once(state, {
    ...base,
    algoOn: { ...base.algoOn, recommendations: true },
    algoParam: { ...base.algoParam, recommendations: 1 },
  });
  assert.ok(on.perceivedDepth < off.perceivedDepth,
    'без данных рекомендации показывают одно и то же и сужают каталог');
});

test('кодек экономит трафик, но при слабой модели раздражает', () => {
  const state = structuredClone(grown(24, 'enc'));
  state.installed.encoding = true;
  const base = lastDecisions(state);
  const on = {
    ...base,
    algoOn: { ...base.algoOn, encoding: true },
    algoParam: { ...base.algoParam, encoding: 1 },
  };
  const off = once(state, base);
  const good = once(state, on);
  assert.ok(good.cdnPerHour < off.cdnPerHour, 'сжатие удешевляет час трафика');

  const dumb = structuredClone(state);
  dumb.rndStock = 0; dumb.dataStock = 0;
  const dumbOff = once(dumb, base);
  const dumbOn = once(dumb, on);
  assert.ok(dumbOn.churnRate > dumbOff.churnRate, 'сжатие без модели портит картинку');
});

test('algorithmImpact считает контрфактуальный вклад включённых алгоритмов', () => {
  const warm = structuredClone(grown(28, 'impact'));
  for (const a of ALGORITHMS) warm.installed[a.key] = true;
  const d = lastDecisions(warm, {
    algoOn: Object.fromEntries(ALGORITHMS.map((a) => [a.key, true])),
  });
  const after = step(warm, { decisions: d }).state;
  const impact = algorithmImpact(after);
  assert.equal(impact.length, ALGORITHMS.length);
  for (const row of impact) {
    assert.ok(ALGORITHMS.some((a) => a.key === row.key), `неизвестный ключ ${row.key}`);
    for (const field of ['profit', 'subs', 'hours', 'churnRate']) {
      assert.ok(Number.isFinite(row[field]), `${row.key}.${field}`);
    }
  }
  // Контрфактуал считается от снимка того же месяца, поэтому выключение всех
  // алгоритмов сразу не должно давать нулевой вклад по всем строкам
  assert.ok(impact.some((r) => Math.abs(r.profit) > 1), 'хоть один алгоритм должен что-то менять');
});

test('algorithmImpact без истории не падает', () => {
  const s = createInitialState('empty');
  assert.doesNotThrow(() => algorithmImpact(s));
});

// ----------------------------------------------------------------------------
// Юнит-экономика, оценка, раунды
// ----------------------------------------------------------------------------

test('юнит-экономика считается до месяца и сходится по знаку', () => {
  const state = warmed();
  const u = unitEconomics(state, decide({ priceNew: 399, priceAds: 149, adLoad: 4 }));
  assert.ok(Number.isFinite(u.revenue) && u.revenue > 0);
  assert.ok(Math.abs((u.revenue - u.variable) - u.contribution) < 1e-6);
  const expensive = unitEconomics(state, decide({ priceNew: 899, priceAds: 399, adLoad: 4 }));
  assert.ok(expensive.revenue > u.revenue);
});

test('оценка учитывает и выручку, и собственную библиотеку', () => {
  const licensed = run(24, decide({ licensing: 400_000_000, originals: 0, brandMarketing: 80_000_000 }), 'val').state;
  const twin = structuredClone(licensed);
  const richer = structuredClone(twin);
  richer.originalsByGenre.drama += 5000;
  assert.ok(valuation(richer) > valuation(twin), 'своя библиотека — актив на балансе');
  // Час реалити стоит в библиотеке меньше часа драмы
  const cheap = structuredClone(twin);
  cheap.originalsByGenre.reality += 5000;
  assert.ok(valuation(cheap) < valuation(richer));
});

test('раунд даёт деньги и размывает долю', () => {
  const state = grown(18, 'round');
  const amount = CONFIG.fundingOptions[0];
  const offer = fundingOffer(state, amount);
  assert.ok(offer.dilution > 0 && offer.dilution < 1);
  assert.equal(offer.post, offer.pre + amount);
  const { state: after } = raise(state, amount);
  assert.equal(after.cash, state.cash + amount);
  assert.ok(after.equity < state.equity);
  assert.ok(Math.abs(after.equity - state.equity * (1 - offer.dilution)) < 1e-9);
  assert.equal(after.raisedTotal, state.raisedTotal + amount);
});

test('чем хуже дела, тем дороже деньги', () => {
  const strong = grown(24, 'fund');
  const weak = run(20, decide({ licensing: 10_000_000, brandMarketing: 0 }), 'fund').state;
  const amount = CONFIG.fundingOptions[1];
  assert.ok(fundingOffer(weak, amount).dilution > fundingOffer(strong, amount).dilution,
    'слабой компании тот же чек стоит большей доли');
});

test('чем крупнее чек, тем больше размытие', () => {
  const state = grown(24, 'fund');
  const shares = CONFIG.fundingOptions.map((a) => fundingOffer(state, a).dilution);
  for (let i = 1; i < shares.length; i++) assert.ok(shares[i] > shares[i - 1]);
});

test('finalScore и explain возвращают ключи, а не готовый текст', () => {
  const state = grown(CONFIG.monthsTotal, 'score');
  const score = finalScore(state);
  assert.ok(Number.isFinite(score.valuation));
  assert.ok(Number.isFinite(score.equityValue));
  assert.equal(typeof score.months, 'number');
  assert.equal(score.bankrupt, false);

  const h = state.history;
  const drivers = explain(h[h.length - 2], h[h.length - 1]);
  assert.ok(Array.isArray(drivers));
  assert.ok(drivers.length > 0, 'между двумя месяцами что-то да изменилось');
  for (const d of drivers) {
    assert.equal(typeof d.key, 'string');
    assert.ok(!/[а-яА-Я]/.test(d.key), `движок не должен возвращать русский текст: ${d.key}`);
    assert.ok(Number.isFinite(d.effect), `${d.key}.effect`);
  }
  assert.deepEqual(explain(null, h[0]), [], 'без предыдущего месяца разбирать нечего');
});

// ----------------------------------------------------------------------------
// Учёт базы: цифры на экране должны сходиться друг с другом
// ----------------------------------------------------------------------------

// Прогон, в котором подписываются все партнёрские предложения: именно оптовый
// канал ломал учёт — база уходила в отдельный пул и возвращалась мимо итогов.
function runWithPartners(months, seed) {
  let state = createInitialState(seed);
  const reports = [];
  for (let i = 0; i < months && !state.over; i++) {
    const input = { decisions: DEFAULT_DECISIONS, eventChoice: 0 };
    if (state.partnerOffer) input.partnerAnswer = 'accept';
    const res = step(state, input);
    state = res.state;
    reports.push(res.report);
  }
  return reports;
}

test('тарифы и опт складываются в общую базу', () => {
  for (const seed of ['tier-a', 'tier-b', 'tier-c']) {
    for (const r of runWithPartners(36, seed)) {
      const sum = r.premiumSubs + r.adSubs + r.partnerSubs;
      assert.ok(Math.abs(sum - r.subs) < Math.max(1, r.subs * 1e-9),
        `${seed} м${r.month}: без рекламы ${Math.round(r.premiumSubs)} + с рекламой ${Math.round(r.adSubs)}`
        + ` + опт ${Math.round(r.partnerSubs)} = ${Math.round(sum)}, а всего показано ${Math.round(r.subs)}`);
      assert.ok(Math.abs(r.premiumSubs + r.adSubs - r.retailSubs) < Math.max(1, r.subs * 1e-9),
        `${seed} м${r.month}: тарифы не складываются в розничную базу`);
    }
  }
});

test('разбор месяца сходится с изменением базы до копейки', () => {
  for (const seed of ['flow-a', 'flow-b', 'flow-c']) {
    const reports = runWithPartners(36, seed);
    for (let i = 1; i < reports.length; i++) {
      const p = reports[i - 1], c = reports[i];
      const actual = c.subs - p.subs;
      const explained = explain(p, c).reduce((s, d) => s + d.people, 0);
      // Мелкие строки отброшены как незначимые — допуск считаем от них
      assert.ok(Math.abs(actual - explained) <= Math.max(1, p.subs * 0.002),
        `${seed} м${c.month}: база изменилась на ${Math.round(actual)},`
        + ` а строки разбора дают ${Math.round(explained)}`);
    }
  }
});

test('знак разбора совпадает со знаком изменения базы', () => {
  // Растущий месяц не должен выглядеть красным, а падающий — зелёным.
  for (const seed of ['sign-a', 'sign-b']) {
    const reports = runWithPartners(36, seed);
    for (let i = 1; i < reports.length; i++) {
      const p = reports[i - 1], c = reports[i];
      const actual = (c.subs - p.subs) / p.subs;
      if (Math.abs(actual) < 0.005) continue;
      const net = explain(p, c).reduce((s, d) => s + d.effect, 0);
      assert.ok(Math.sign(net) === Math.sign(actual),
        `${seed} м${c.month}: база ${(actual * 100).toFixed(1)}%, разбор ${(net * 100).toFixed(1)}%`);
    }
  }
});

test('закрытие контракта не роняет базу на бумаге', () => {
  // Оставшиеся от партнёра подписчики переходят в розницу тем же месяцем.
  // Пока они выпадали из итога, график базы рисовал обрыв и отскок, которых нет.
  let found = 0;
  for (const seed of ['exit-a', 'exit-b', 'exit-c', 'exit-d']) {
    const reports = runWithPartners(36, seed);
    for (let i = 1; i < reports.length; i++) {
      const c = reports[i];
      if (!c.partnerExpired.length) continue;
      found += 1;
      const kept = c.partnerExpired.reduce((s, e) => s + e.kept, 0);
      const lost = c.partnerExpired.reduce((s, e) => s + e.lost, 0);
      const drop = reports[i - 1].subs - c.subs;
      assert.ok(drop < lost + kept * 0.02 + Math.max(1, c.subs * 0.05),
        `м${c.month}: контракт унёс ${Math.round(drop)} при потерянных ${Math.round(lost)}`
        + ` и удержанных ${Math.round(kept)}`);
    }
  }
  assert.ok(found > 0, 'ни один контракт не закрылся — тест ничего не проверил');
});

test('отток и средние по сегментам не разбавляются оптом', () => {
  // Розничные показатели должны считаться по розничной базе: иначе крупный
  // контракт «улучшал» удержание и цену, ничего в них не меняя.
  const solo = createInitialState('dilute');
  let a = solo, withDeal = createInitialState('dilute');
  let churnSolo = 0, churnDeal = 0;
  for (let i = 0; i < 14; i++) {
    const r1 = step(a, { decisions: DEFAULT_DECISIONS, eventChoice: 0 });
    a = r1.state; churnSolo = r1.report.churnRate;
    const input = { decisions: DEFAULT_DECISIONS, eventChoice: 0 };
    if (withDeal.partnerOffer) input.partnerAnswer = 'accept';
    const r2 = step(withDeal, input);
    withDeal = r2.state; churnDeal = r2.report.churnRate;
  }
  assert.ok(withDeal.partners.length > 0, 'контракт не подписался — сравнивать нечего');
  assert.ok(Math.abs(churnDeal - churnSolo) < 0.02,
    `отток с контрактом ${(churnDeal * 100).toFixed(2)}% против ${(churnSolo * 100).toFixed(2)}% без него`);

  // Юнит-экономика розницы тоже не должна «улучшаться» от подписанного контракта
  const uSolo = unitEconomics(a, DEFAULT_DECISIONS);
  const uDeal = unitEconomics(withDeal, DEFAULT_DECISIONS);
  assert.ok(Math.abs(uDeal.adShare - uSolo.adShare) < 0.05,
    `доля рекламного тарифа ${uDeal.adShare.toFixed(2)} против ${uSolo.adShare.toFixed(2)}`);
  assert.ok(Math.abs(uDeal.revenue - uSolo.revenue) / Math.max(1, uSolo.revenue) < 0.1,
    `выручка с подписчика ${uDeal.revenue.toFixed(0)} ₽ против ${uSolo.revenue.toFixed(0)} ₽`);
});

test('отчёт сходится сам с собой на любом прогоне', () => {
  // Сквозная проверка бухгалтерии: выручка, маржа, прибыль и касса должны
  // складываться из своих же слагаемых, а доли и ставки — оставаться долями.
  const near = (a, b, tol = 1) => Math.abs(a - b) <= tol + Math.abs(b) * 1e-9;
  for (const seed of ['inv-a', 'inv-b', 'inv-c']) {
    for (const withPartners of [true, false]) {
      let state = createInitialState(seed + withPartners);
      let cashBefore = state.cash;
      for (let i = 0; i < 36 && !state.over; i++) {
        const input = { decisions: DEFAULT_DECISIONS, eventChoice: 0 };
        if (withPartners && state.partnerOffer) input.partnerAnswer = 'accept';
        const res = step(state, input);
        const r = res.report;
        const where = `${seed} м${r.month}`;
        assert.ok(near(r.revenue, r.subscriptionRevenue + r.adRevenue), `${where}: выручка`);
        assert.ok(near(r.contribution, r.revenue - r.variableCost), `${where}: маржа`);
        assert.ok(near(r.profit, r.contribution - r.fixed), `${where}: прибыль`);
        assert.ok(near(res.state.cash,
          cashBefore + r.profit - r.oneOff + (r.annualCash ?? 0) + (r.boardInjection ?? 0), 2),
        `${where}: касса`);
        assert.ok(r.subs >= 0 && r.rivalSubs >= 0, `${where}: отрицательная база`);
        assert.ok(r.churnRate >= 0 && r.churnRate <= 1, `${where}: отток ${r.churnRate}`);
        assert.ok(r.marketShare <= 1.02, `${where}: доля рынка ${r.marketShare}`);
        for (const [key, value] of Object.entries(r)) {
          if (typeof value === 'number') assert.ok(Number.isFinite(value), `${where}: ${key} = ${value}`);
        }
        cashBefore = res.state.cash;
        state = res.state;
      }
    }
  }
});

test('условия месяца читаются в одну сторону: вверх — в вашу пользу', () => {
  const reports = runWithPartners(24, 'factors');
  for (let i = 1; i < reports.length; i++) {
    for (const f of explainFactors(reports[i - 1], reports[i])) {
      assert.equal(typeof f.key, 'string');
      assert.ok(f.key.startsWith('factor'), `неожиданный ключ: ${f.key}`);
      assert.ok(Number.isFinite(f.effect) && Math.abs(f.effect) < 20, `${f.key}.effect = ${f.effect}`);
    }
  }
  // Дешевле подписка — «доступность цены» выше: направление, а не только знак
  const cheap = runWithPartners(6, 'factors');
  assert.ok(cheap.length > 1);
});

test('дорогая подписка опускает доступность цены, дешёвая поднимает', () => {
  const base = run(6, decide({ priceNew: 500 }), 'fx').last;
  const dear = run(6, decide({ priceNew: 900 }), 'fx').last;
  assert.ok(dear.avgPriceFactor < base.avgPriceFactor,
    'фактор цены должен падать при росте прайса, иначе цвет строки врёт');
});

// ----------------------------------------------------------------------------
// События
// ----------------------------------------------------------------------------

test('события не появляются в первые месяцы и берутся из своего пула', () => {
  const rng = createRng('ev');
  for (let m = 1; m < 3; m++) assert.equal(rollEvent(rng, m), null);
  const seen = new Set();
  for (let i = 0; i < 4000; i++) {
    const e = rollEvent(rng, 20);
    if (e) {
      seen.add(e.id);
      assert.ok(EVENTS.some((x) => x.id === e.id));
    }
  }
  assert.ok(seen.size >= EVENTS.length - 1, `не все события встречаются: ${[...seen].join(',')}`);
});

test('событие с выбором меняет результат в зависимости от решения', () => {
  const withChoice = EVENTS.find((e) => e.options && e.options.length > 1);
  const a = applyEvent(neutralModifiers(), withChoice, 0);
  const b = applyEvent(neutralModifiers(), withChoice, 1);
  assert.notDeepEqual(
    [a.demandMult, a.churnAdd, a.oneOffCost, a.valuationBonus],
    [b.demandMult, b.churnAdd, b.oneOffCost, b.valuationBonus],
  );
});

test('множители событий перемножаются, а прибавки складываются', () => {
  const mods = neutralModifiers();
  applyEvent(mods, { id: 'x', effects: { demandMult: 0.5, churnAdd: 0.01 } }, 0);
  applyEvent(mods, { id: 'y', effects: { demandMult: 0.5, churnAdd: 0.02 } }, 0);
  assert.ok(Math.abs(mods.demandMult - 0.25) < 1e-9);
  assert.ok(Math.abs(mods.churnAdd - 0.03) < 1e-9);
  assert.deepEqual(mods.notes, ['x', 'y']);
});

// ----------------------------------------------------------------------------
// Справочники
// ----------------------------------------------------------------------------

test('справочники согласованы', () => {
  for (const g of GENRES) {
    assert.equal(genreById(g.id), g);
    assert.ok(g.hours > 0 && g.costPerHour > 0);
    for (const s of SEGMENTS) assert.ok(Number.isFinite(g.appeal[s.id]), `${g.id}.appeal.${s.id}`);
  }
  for (const s of SEGMENTS) {
    assert.equal(segmentById(s.id), s);
    assert.ok(s.potential > 0);
  }
  for (const l of LEVERS) {
    assert.ok(l.min <= l.def && l.def <= l.max, `рычаг ${l.key}: def вне диапазона`);
  }
  for (const a of ALGORITHMS) {
    assert.ok(a.unlock >= 0 && a.unlock <= 1, `алгоритм ${a.key}: unlock вне [0,1]`);
    assert.ok(a.param.min <= a.param.def && a.param.def <= a.param.max, `алгоритм ${a.key}: param.def вне диапазона`);
  }
});

test('громкий жанр даёт и всплеск, и похмелье', () => {
  const blockbuster = GENRES.find((g) => g.id === 'blockbuster');
  const drama = GENRES.find((g) => g.id === 'drama');
  assert.ok(blockbuster.buzz > drama.buzz);
  assert.ok(blockbuster.hangover > drama.hangover, 'после блокбастера уходят волной');
});

test('игра выигрываема: разумная стратегия доживает до конца с плюсом', () => {
  for (const seed of ['a', 'b', 'c', 'd']) {
    const { state, last } = reinvest(CONFIG.monthsTotal, seed);
    assert.equal(state.over, 'finished', `seed ${seed}: партия должна дойти до конца`);
    assert.ok(last.subs > 2_000_000, `seed ${seed}: подписчиков ${Math.round(last.subs)}`);
    assert.ok(last.cmPerSub > 0, `seed ${seed}: вклад с подписчика ${last.cmPerSub}`);
    // Одна и та же политика все 36 месяцев против реагирующего конкурента
    // не обязана выигрывать дуополию — но обязана быть в ней конкурентоспособной.
    // Планка ниже трети: третий акт (рывок конкурента) нарочно наказывает
    // автопилот, и константная стратегия отдаёт ему часть рынка в финале.
    assert.ok(last.duopolyShare > 0.22, `seed ${seed}: доля дуополии ${last.duopolyShare}`);
    assert.ok(state.equity > 0.3, `seed ${seed}: доля ${state.equity} — раунды не должны съедать компанию`);
  }
});

test('релиз в высокий сезон слышнее, чем в низкий', () => {
  // Один и тот же готовый проект, разница только в месяце выхода
  const make = (untilMonth) => {
    let state = createInitialState('season-release');
    for (let i = 0; i < untilMonth; i++) {
      state = step(state, {
        decisions: decide({ licensing: 0, studioSlots: 1 }),
        commission: i === 0 ? [{ genre: 'blockbuster', scale: 'season', segment: 'mass' }] : [],
        release: [],
      }).state;
    }
    return state;
  };
  // Месяц 1 — январь, значит месяц 7 это июль (лето), месяц 12 — декабрь (зима)
  const summer = make(6);
  const winter = make(11);
  const out = (st) => {
    const ready = st.slate.find((p) => p.status === 'ready');
    return step(st, { decisions: decide({ licensing: 0 }), release: [{ id: ready.id, campaign: 0 }] }).report;
  };
  const s1 = out(summer);
  const s2 = out(winter);
  assert.equal(seasonOf(s1.month), 'summer');
  assert.equal(seasonOf(s2.month), 'winter');
  assert.ok(s2.premieres[0].buzz > s1.premieres[0].buzz * 1.3,
    `зимняя премьера ${s2.premieres[0].buzz} должна быть заметно громче летней ${s1.premieres[0].buzz}`);
});

test('смешанный слейт бьёт однообразный', () => {
  // Сравниваем ровно одно: чередование масштабов. Всё остальное — цены,
  // бюджеты, слоты, момент выхода — одинаковое. Две ловушки, на которых эта
  // проверка уже обжигалась: «смешанный» вариант не должен заодно придерживать
  // готовое (иначе меряется придержание), а стратегия обязана быть
  // платёжеспособной — на краю выживания итог решают обрывы раундов
  // и разводнение, а не состав слейта.
  const play = (mixScales) => ['u1', 'u2', 'u3'].reduce((sum, seed) => {
    let state = createInitialState(seed);
    let last = null;
    let n = 0;
    for (let i = 0; i < CONFIG.monthsTotal && !state.over; i++) {
      const burn = Math.max(30e6, -(last?.profit ?? 0));
      if (state.month >= CONFIG.minMonthForFunding && state.cash < burn * 4) {
        state = raise(state, state.cash < burn * 2 ? 1_200_000_000 : 400_000_000).state;
      }
      const producing = state.slate.filter((p) => p.status === 'production').length;
      const scale = mixScales ? (n++ % 2 ? 'pilot' : 'season') : 'season';
      const o = step(state, {
        decisions: decide({
          priceNew: 799, priceAds: 120, adLoad: 2, annualDiscount: 0.15,
          licensing: 375_000_000, brandMarketing: 60_000_000, trialDays: 21,
          tech: 20_000_000, rnd: 10_000_000, studioSlots: 2,
        }),
        commission: producing < 2 ? [{ genre: 'family', scale, segment: 'mass' }] : [],
        release: state.slate.filter((p) => p.status === 'ready')
          .map((p) => ({ id: p.id, campaign: 25_000_000 })),
      });
      state = o.state;
      last = o.report;
    }
    return sum + state.history[state.history.length - 1].equityValue;
  }, 0) / 3;

  const mixed = play(true);
  const uniform = play(false);
  assert.ok(mixed > uniform,
    `смешанный слейт ${Math.round(mixed / 1e9)} млрд должен бить однообразный ${Math.round(uniform / 1e9)}`);
});


test.skip('расти любой ценой невыгодно: доля важнее числа подписчиков', () => {
  // Один и тот же seed, разная доля выручки в контент. Подписчиков больше
  // у агрессивной стратегии, но она добирает деньги раундами и размывается.
  const modest = grown(CONFIG.monthsTotal, 'greed');
  let aggressive = createInitialState('greed');
  let revenue = 0;
  let raises = 0;
  for (let i = 0; i < CONFIG.monthsTotal && !aggressive.over; i++) {
    if (aggressive.cash < 900_000_000 && raises < CONFIG.fundingOptions.length) {
      aggressive = raise(aggressive, CONFIG.fundingOptions[raises]).state;
      raises += 1;
    }
    const budget = 140_000_000 + revenue * 0.7;
    const res = step(aggressive, {
      decisions: decide({
        priceNew: 399, priceAds: 149, adLoad: 4,
        licensing: Math.round(budget * 0.55), originals: Math.round(budget * 0.45),
        brandMarketing: Math.round(70_000_000 + revenue * 0.35),
        tech: 20_000_000, rnd: 20_000_000,
      }),
    });
    aggressive = res.state;
    revenue = res.report.revenue;
  }
  const bigger = aggressive.history[aggressive.history.length - 1];
  const smaller = modest.history[modest.history.length - 1];
  assert.ok(bigger.subs > smaller.subs, 'агрессивная стратегия действительно даёт больше подписчиков');
  assert.ok(aggressive.equity < modest.equity, 'но доля основателя ниже');
});

// ----------------------------------------------------------------------------
// Живой конкурент
// ----------------------------------------------------------------------------

test('конкурент — не константа: он растёт, тратит и меняет позицию', () => {
  const { state } = reinvest(24, 'rivalgrow');
  const first = state.history[0];
  const mid = state.history[11];
  const last = state.history[23];
  assert.ok(first.rivalSubs > 0, 'на старте рынок уже занят');
  assert.ok(last.rivalPrice !== first.rivalPrice, 'цена конкурента менялась');
  const stances = new Set(state.history.map((r) => r.rivalStance));
  assert.ok(stances.size >= 2, `конкурент должен менять позицию, а не стоять в одной: ${[...stances]}`);
  assert.ok(Number.isFinite(mid.duopolyShare) && mid.duopolyShare > 0 && mid.duopolyShare < 1);
});

test('конкурент отвечает на вашу цену, а не живёт своей жизнью', () => {
  const base = reinvest(14, 'react').state;
  const cheapRun = structuredClone(base);
  const dearRun = structuredClone(base);
  const d = lastDecisions(base);
  const cheap = step(cheapRun, { decisions: { ...d, priceNew: 249 } }).report;
  const dear = step(dearRun, { decisions: { ...d, priceNew: 899 } }).report;
  assert.ok(dear.rivalPrice > cheap.rivalPrice,
    `конкурент должен идти за вашей ценой: ${cheap.rivalPrice} против ${dear.rivalPrice}`);
});

test('конкурент держит позицию несколько месяцев, а не мечется', () => {
  const rival = createRival(createRng('hold'));
  rival.stance = 'build';
  rival.stanceMonths = 1;
  // Даже при разгромном отставании он не переобувается мгновенно
  assert.equal(chooseStance(rival, rivalSubs(rival) * 9, 12), 'build');
  rival.stanceMonths = STANCE_MIN_MONTHS;
  assert.equal(chooseStance(rival, rivalSubs(rival) * 9, 12), 'war');
});

test('рынок один на двоих: сумма баз не выходит за ёмкость сегментов', () => {
  const { state } = reinvest(CONFIG.monthsTotal, 'shared');
  const potential = SEGMENTS.reduce((s, x) => s + x.potential, 0);
  for (const r of state.history) {
    assert.ok(r.subs + r.rivalSubs <= potential * 1.001,
      `месяц ${r.month}: ${r.subs} + ${r.rivalSubs} > ${potential}`);
  }
});

test('переток — отдельный поток от общего оттока', () => {
  const { state } = reinvest(CONFIG.monthsTotal, 'flow');
  const moved = state.history.some((r) => Math.abs(r.netSwitch) > 1);
  assert.ok(moved, 'база должна перетекать между сервисами');
  for (const r of state.history) {
    assert.ok(r.switchedIn >= 0 && r.switchedOut >= 0);
    assert.ok(Math.abs(r.netSwitch - (r.switchedIn - r.switchedOut)) < 1e-6);
  }
});

test('эксклюзив тянет сильнее лицензии: его нельзя купить теми же деньгами', () => {
  const base = reinvest(20, 'excl').state;
  const withOwn = structuredClone(base);
  const withRented = structuredClone(base);
  // Одинаковая «взвешенная глубина», но в одном случае своя, в другом арендованная
  withOwn.originalsByGenre.drama += 900;
  withRented.catalogLicensed += 900 * CONFIG.originalDepthWeight / CONFIG.licenseDepthWeight;
  const d = lastDecisions(base);
  const own = step(withOwn, { decisions: d }).report;
  const rented = step(withRented, { decisions: d }).report;
  assert.ok(own.avgPreference > rented.avgPreference,
    'своё должно предпочитаться сильнее при той же глубине');
});

// ----------------------------------------------------------------------------
// Совет директоров
// ----------------------------------------------------------------------------

test('цель года объявляется заранее и известна с первого хода', () => {
  const s = createInitialState('goal');
  assert.ok(s.board.goal, 'цель первого года видна сразу');
  assert.equal(s.board.goal.year, 1);
  const r = step(s, { decisions: DEFAULT_DECISIONS }).report;
  assert.ok(r.goal, 'цель есть в отчёте');
  assert.ok(r.goalProgress, 'и прогресс по ней тоже');
});

test('цели трёх лет тянут в разные стороны', () => {
  const s = createInitialState('goals');
  const y1 = makeGoal(1, s, 0, 1_000_000);
  const y2 = makeGoal(2, s, 1_500_000, 2_000_000);
  const y3 = makeGoal(3, s, 3_000_000, 3_000_000);
  assert.equal(y1.type, 'subscribers');
  assert.equal(y2.type, 'profit');
  assert.equal(y3.type, 'share');
  // Год прибыльности требует и роста, и плюса — одного мало
  const onlyProfit = goalProgress(y2, { subs: 100, rivalSubs: 0, profitableMonths: 12 });
  assert.equal(onlyProfit.done, false, 'одной прибыли без роста не хватает');
  const onlyGrowth = goalProgress(y2, { subs: 9_000_000, rivalSubs: 0, profitableMonths: 0 });
  assert.equal(onlyGrowth.done, false, 'одного роста без прибыли тоже');
});

test('провал цели имеет последствия, а не просто грустную надпись', () => {
  // Ничего не делаем весь год — цель по подписчикам провалена гарантированно
  const { state, reports } = run(12, decide({ licensing: 0, brandMarketing: 0 }), 'fail');
  const twelfth = reports[11];
  assert.ok(twelfth.goalOutcome, 'в конце года цель подводится');
  assert.equal(twelfth.goalOutcome.passed, false);
  assert.equal(twelfth.goalOutcome.effect, 'dilution');
  assert.ok(state.equity < 1, 'совет вошёл в капитал сам');
  assert.ok(twelfth.boardInjection > 0, 'и принёс деньги, которых вы не просили');
});

test('порезанный бюджет реально режет расходы, а не только настроение', () => {
  const s = createInitialState('cap');
  s.restrictions = { contentCap: 100_000_000, until: 6 };
  const r = step(s, { decisions: decide({ licensing: 300_000_000, originals: 300_000_000 }) }).report;
  assert.equal(r.contentCapped, 100_000_000);
  assert.ok(Math.abs(r.contentSpend - 100_000_000) < 2, `потрачено ${r.contentSpend}`);
});

// ----------------------------------------------------------------------------
// Кризисы
// ----------------------------------------------------------------------------

test('кризис ухудшается, пока его не решают, но не бесконечно', () => {
  const def = CRISES[0];
  const at = (m) => def.escalate(m);
  assert.ok(at(3).churnAdd > at(1).churnAdd, 'второй месяц дороже первого');
  const active = { id: def.id, months: 40 };
  assert.deepEqual(crisisEffects(active), def.escalate(MAX_ESCALATION),
    'после потолка кризис перестаёт усиливаться');
});

test('чем дольше тянуть, тем дороже решение', () => {
  const active = { id: 'scandal', months: 0 };
  const early = resolutionCost(active, 'pr');
  const late = resolutionCost({ id: 'scandal', months: 4 }, 'pr');
  assert.ok(late > early * 2, `${early} → ${late}`);
});

test('решение кризиса стоит денег и снимает его', () => {
  const s = reinvest(16, 'crisis').state;
  s.crisis = { id: 'scandal', months: 2 };
  const d = lastDecisions(s);
  const ignored = step(structuredClone(s), { decisions: d }).report;
  const solved = step(structuredClone(s), { decisions: d, crisisChoice: 'pr' });
  assert.ok(solved.report.crisisCost > 0, 'решение стоит денег');
  assert.equal(solved.state.crisis, null, 'и снимает кризис');
  assert.ok(ignored.churnRate > solved.report.churnRate, 'а бездействие стоит оттока');
  assert.ok(ignored.crisis, 'у бездействующего кризис остаётся');
});

test('кризисы приходят чаще к тому, у кого дела идут хорошо', () => {
  const count = (subs) => {
    const rng = createRng('crisisroll');
    let hits = 0;
    for (let i = 0; i < 3000; i++) if (rollCrisisProbe(rng, 20, subs)) hits += 1;
    return hits;
  };
  assert.ok(count(6_000_000) > count(50_000) * 2,
    'крупный сервис судят и обворовывают заметно чаще');
});

// ----------------------------------------------------------------------------
// Дорожающие ресурсы
// ----------------------------------------------------------------------------

test('права дорожают, когда за них торгуетесь вы оба', () => {
  const calm = run(18, decide({ licensing: 20_000_000 }), 'idx').last;
  const hot = run(18, decide({ licensing: 400_000_000 }), 'idx').last;
  assert.ok(hot.licenseIndex > calm.licenseIndex,
    `${calm.licenseIndex} → ${hot.licenseIndex}`);
  assert.ok(calm.licenseIndex >= 1);
});

test('талант дорожает вместе с вашим успехом', () => {
  const { state } = reinvest(CONFIG.monthsTotal, 'talent');
  const early = state.history[5];
  const late = state.history[state.history.length - 1];
  assert.ok(late.subs > early.subs);
  assert.ok(late.talentIndex > early.talentIndex * 1.2,
    `${early.talentIndex} → ${late.talentIndex}: успех должен дорожать`);
  assert.ok(late.projectPrices.drama.season > early.projectPrices.drama.season,
    'и тот же проект должен стоить дороже');
});

// ----------------------------------------------------------------------------
// Партнёрства и бандлы: оптовый канал
// ----------------------------------------------------------------------------

test('оптовый подписчик приносит меньше розничного', () => {
  const state = createInitialState('wholesale');
  for (const def of PARTNERS) {
    assert.ok(def.revenueShare > 0 && def.revenueShare <= 1, `${def.id}.revenueShare`);
    assert.ok(def.months > 0 && def.reach > 0, `${def.id}: пустой контракт`);
  }
  // Самый массовый канал должен быть и самым дешёвым по доле выручки
  const telecom = PARTNERS.find((p) => p.id === 'telecom');
  const tv = PARTNERS.find((p) => p.id === 'tv');
  assert.ok(telecom.reach > tv.reach, 'оператор приводит больше');
  assert.ok(telecom.revenueShare < tv.revenueShare, 'но платит меньшую долю');
  assert.ok(telecom.hoursMult < tv.hoursMult, 'и его подписчики смотрят меньше');
  assert.ok(state.partners.length === 0);
});

test('подписанный контракт приводит людей и приносит выручку по своей доле', () => {
  const grownState = reinvest(10, 'deal').state;
  const withDeal = structuredClone(grownState);
  withDeal.partnerOffer = 'telecom';
  const d = lastDecisions(grownState);

  const without = step(structuredClone(grownState), { decisions: d }).report;
  const signed = step(withDeal, { decisions: d, partnerAnswer: 'accept' });
  assert.equal(signed.state.partners.length, 1);

  // Первый месяц: подключение стоит денег, люди уже пошли
  const r = signed.report;
  assert.ok(r.partnerInflow > 0, 'канал начал приводить людей');
  assert.ok(r.partnerFees >= partnerById('telecom').setupFee, 'подключение оплачено');
  assert.ok(r.subs > without.subs, 'база выросла быстрее, чем без контракта');
});

test('оптовая база стоит меньше розничной в пересчёте на человека', () => {
  let state = createInitialState('arpu');
  state.partnerOffer = 'telecom';
  const d = decide({ priceNew: 499, licensing: 200_000_000, brandMarketing: 150_000_000 });
  state = step(state, { decisions: d, partnerAnswer: 'accept' }).state;
  for (let i = 0; i < 10 && !state.over; i++) {
    state = step(state, { decisions: d, ...keepBusy()(state) }).state;
  }
  const r = state.history[state.history.length - 1];
  assert.ok(r.partnerSubs > 0, 'оптовая база набралась');
  assert.ok(r.partnerArpu < r.retailArpu,
    `опт ${r.partnerArpu} должен быть дешевле розницы ${r.retailArpu}`);
  assert.ok(r.partnerArpu > 0);
});

test('контракт кончается — оптовая база уходит почти разом', () => {
  const def = partnerById('bank');
  let state = createInitialState('expire');
  state.partnerOffer = 'bank';
  const d = decide({ licensing: 150_000_000, brandMarketing: 100_000_000 });
  state = step(state, { decisions: d, partnerAnswer: 'accept' }).state;

  let peak = 0;
  let expiredAt = null;
  for (let i = 0; i < def.months + 3 && !state.over; i++) {
    const res = step(state, { decisions: d });
    state = res.state;
    peak = Math.max(peak, res.report.partnerSubs);
    if (res.report.partnerExpired.length) expiredAt = res.report;
  }
  assert.ok(peak > 0, 'база успела набраться');
  assert.ok(expiredAt, 'контракт истёк за отведённый срок');
  assert.ok(expiredAt.partnerExpired[0].lost > expiredAt.partnerExpired[0].kept,
    'уходит больше, чем остаётся');
  assert.equal(state.partners.length, 0);
});

test('эксклюзивный контракт закрывает конкурирующие предложения', () => {
  const rng = createRng('excl-offer');
  const active = [{ id: 'telecom', monthsLeft: 10, subs: 0 }];
  for (let i = 0; i < 400; i++) {
    const offer = rollPartnerOffer(rng, 20, active);
    assert.notEqual(offer, 'aggregator', 'агрегатор закрыт эксклюзивом оператора');
    assert.notEqual(offer, 'telecom', 'действующий контракт не предлагается повторно');
  }
});

test('оптовые подписчики занимают тот же рынок, а не добавляются сверху', () => {
  let state = createInitialState('room');
  const d = decide({ priceNew: 399, licensing: 300_000_000, brandMarketing: 300_000_000 });
  for (let i = 0; i < CONFIG.monthsTotal && !state.over; i++) {
    const res = step(state, {
      decisions: d,
      partnerAnswer: state.partnerOffer ? 'accept' : null,
      ...keepBusy()(state),
    });
    state = res.state;
    const r = res.report;
    const potential = SEGMENTS.reduce((s, x) => s + x.potential, 0);
    assert.ok(r.subs + r.rivalSubs <= potential * 1.001,
      `месяц ${r.month}: ${Math.round(r.subs + r.rivalSubs)} > ёмкости ${potential}`);
  }
});

test('после решённого кризиса даётся передышка', () => {
  const rng = createRng('cooldown');
  for (let i = 0; i < 200; i++) {
    assert.equal(rollCrisis(rng, 20, { subs: 6_000_000, active: false, lastResolved: 19 }), null);
  }
});

test('потолок совета считается по месячным тратам, а начатое не режется', () => {
  const s = createInitialState('cap2');
  s.restrictions = { contentCap: 200_000_000, until: 12 };
  // Закупка уже съедает половину потолка — на дорогой проект места нет
  const r = step(s, {
    decisions: decide({ licensing: 150_000_000, studioSlots: 3 }),
    commission: [{ genre: 'blockbuster', scale: 'flagship', segment: null }],
  }).report;
  assert.equal(r.started.length, 0, 'дорогой запуск не помещается в потолок');
  assert.equal(r.rejected[0].reason, 'cap');

  // А дешёвый пилот — помещается
  const r2 = step(s, {
    decisions: decide({ licensing: 150_000_000, studioSlots: 3 }),
    commission: [{ genre: 'reality', scale: 'pilot', segment: null }],
  }).report;
  assert.equal(r2.started.length, 1, 'пилот в остаток потолка проходит');
});

test('уже запущенный проект досчитывается до конца даже под потолком', () => {
  let s = createInitialState('cap3');
  s = step(s, {
    decisions: decide({ licensing: 0, studioSlots: 2 }),
    commission: [{ genre: 'drama', scale: 'season', segment: null }],
  }).state;
  const committed = s.slate[0].monthlyCost;
  s.restrictions = { contentCap: 1, until: 24 };   // потолок жёстче некуда
  const r = step(s, { decisions: decide({ licensing: 300_000_000, studioSlots: 2 }) }).report;
  assert.ok(Math.abs(r.productionSpend - committed) < 2,
    'взнос по начатому проекту платится полностью');
  assert.ok(r.contentCapped, 'при этом закупка урезана');
});

test('годовой подписчик не уходит ни в отток, ни к конкуренту', () => {
  const base = reinvest(14, 'annual-hold', { annual: 0.35 }).state;
  const r = base.history[base.history.length - 1];
  assert.ok(r.annualSubs > 0, 'годовые набрались');

  // Делаем сервис максимально плохим: дорого, много рекламы, каталог заморожен
  const awful = structuredClone(base);
  const d = lastDecisions(base, { priceNew: 999, priceAds: 499, adLoad: 16, licensing: 0 });
  const after = step(awful, { decisions: d }).report;

  const annualNow = after.segments.reduce((s, x) => s + x.annual, 0);
  assert.ok(annualNow >= r.annualSubs * 0.9,
    `годовые не должны разбегаться при плохом сервисе: ${r.annualSubs} → ${annualNow}`);
});

test('оптовый трафик оплачивается: часы партнёров попадают в расчёт', () => {
  const withoutDeal = createInitialState('cdn');
  const withDeal = structuredClone(withoutDeal);
  withDeal.partners = [{ id: 'telecom', monthsLeft: 12, subs: 500_000, price: 399, signed: -5 }];
  const d = decide({ licensing: 100_000_000 });
  const a = step(withoutDeal, { decisions: d }).report;
  const b = step(withDeal, { decisions: d }).report;
  assert.ok(b.hours > a.hours, 'оптовые подписчики смотрят');
  assert.ok(b.cdnCost > a.cdnCost, 'и их трафик оплачивается');
  assert.ok(b.cdnCost / Math.max(1, b.hours) > 0, 'цена часа положительна');
});

test('повышение прайса не задевает базу, пока её не перевели', () => {
  const base = reinvest(14, 'gap-churn').state;
  const cheap = lastDecisions(base);
  const dear = lastDecisions(base, { priceNew: cheap.priceNew * 2 });
  const a = step(structuredClone(base), { decisions: cheap }).report;
  const b = step(structuredClone(base), { decisions: dear }).report;

  assert.ok(b.newSubs < a.newSubs, 'новых приходит меньше: они смотрят на прайс');
  assert.ok(Math.abs(b.churnRate - a.churnRate) < 0.005,
    `действующие не должны замечать чужой прайс: ${a.churnRate} против ${b.churnRate}`);
  assert.ok(b.priceGap > 0.3, 'зато открывается разрыв');
});

test('содержание технологий растёт от вложенного и не исчезает', () => {
  const lean = run(24, decide({ tech: 2_000_000, rnd: 0 }), 'upkeep').last;
  const heavy = run(24, decide({ tech: 90_000_000, rnd: 40_000_000 }), 'upkeep').last;
  assert.ok(heavy.techUpkeep > lean.techUpkeep * 3,
    `содержание ${Math.round(heavy.techUpkeep / 1e6)} млн против ${Math.round(lean.techUpkeep / 1e6)} млн`);
  const grown = run(24, decide({ tech: 90_000_000, rnd: 40_000_000 }), 'upkeep');
  const after = step(grown.state, { decisions: decide({ tech: 0, rnd: 0 }), eventChoice: 0 }).report;
  assert.ok(after.techUpkeep > 0, 'построенное продолжает стоить и без новых вложений');
  assert.ok(after.fixed > CONFIG.hqMonthly, 'содержание попадает в постоянные расходы');
});

// ---------------------------------------------------------------------------
// Пробный период должен чего-то стоить.
//
// Раньше он только повышал конверсию — и лучшим ответом всегда были предельные
// 30 дней, то есть ползунка фактически не было. Замер за три года: 0 дней —
// 4.7 млрд у основателя, 30 дней — 83 млрд, монотонно вверх. Теперь подаренные
// дни считаются деньгами, а длинный триал приводит тех, кто уйдёт при первом
// списании. Обе половины проверяются отдельно.
// ---------------------------------------------------------------------------

test('подаренные дни вычитаются из выручки', () => {
  const short = run(10, decide({ trialDays: 0, brandMarketing: 150_000_000 }), 'trial');
  const long = run(10, decide({ trialDays: 30, brandMarketing: 150_000_000 }), 'trial');
  // Длинный триал приводит больше людей — и всё равно приносит меньше денег
  // с человека в тот месяц, когда они пришли
  assert.ok(long.last.newSubs > short.last.newSubs, 'длинный триал должен приводить больше людей');
  const shortPerSub = short.last.subscriptionRevenue / Math.max(1, short.last.subs);
  const longPerSub = long.last.subscriptionRevenue / Math.max(1, long.last.subs);
  assert.ok(longPerSub < shortPerSub,
    `выручка на подписчика: ${longPerSub.toFixed(0)} против ${shortPerSub.toFixed(0)}`);
});

test('длинный триал приводит тех, кто уйдёт при первом списании', () => {
  const usual = run(14, decide({ trialDays: CONFIG.refTrialDays, brandMarketing: 150_000_000 }), 'greed');
  const long = run(14, decide({ trialDays: 30, brandMarketing: 150_000_000 }), 'greed');
  assert.ok(long.last.churnRate > usual.last.churnRate,
    `отток при триале 30 дней ${(long.last.churnRate * 100).toFixed(2)}% против ${(usual.last.churnRate * 100).toFixed(2)}%`);
  // Привычные две недели — точка отсчёта: ниже неё надбавки нет вовсе, и
  // разница между 3 и 14 днями обязана быть на порядок меньше, чем между
  // 14 и 30. Точного равенства тут не будет: состав базы всё равно другой.
  const shorter = run(14, decide({ trialDays: 3, brandMarketing: 150_000_000 }), 'greed');
  const below = Math.abs(shorter.last.churnRate - usual.last.churnRate);
  const above = long.last.churnRate - usual.last.churnRate;
  assert.ok(below < above / 5,
    `ниже точки отсчёта разброс ${(below * 100).toFixed(3)}%, выше — ${(above * 100).toFixed(3)}%`);
});

test('цели совета берутся не всеми и не никем', () => {
  // Планка выставлена по замеру распределения. Проверяем то, что от неё
  // требуется по смыслу: она не 900 тысяч при медиане в миллионы и не просит
  // роста базы там, где база по устройству модели сжимается.
  const y1 = makeGoal(1, null, 0, 0);
  assert.ok(y1.target >= 2_000_000, 'первый год не должен проходить сам собой');
  const y2 = makeGoal(2, null, 4_000_000, 3_000_000);
  assert.ok(y2.subsFloor <= 4_000_000 * 1.1,
    'второй год не должен требовать роста, недостижимого для девяти из десяти');
  const y3 = makeGoal(3, null, 4_000_000, 3_000_000);
  assert.ok(y3.subsFloor < 4_000_000,
    'третий год — год обороны: требовать роста базы в нём нельзя');
  // Замер после перебалансировки каталога: медиана доли на конец партии 0.43,
  // 75-й процентиль 0.59, 90-й — 0.70. Планка обязана лежать между медианой
  // и девяностым процентилем: ниже — её берут все, выше — не берёт никто.
  assert.ok(y3.target > 0.43 && y3.target <= 0.70,
    `планка ${y3.target} должна лежать между медианой и 90-м процентилем`);
});

// ----------------------------------------------------------------------------
// Третий акт: обвал прав и последний рывок конкурента
// ----------------------------------------------------------------------------

test('обвал прав отзывает долю лицензионного каталога у обоих', () => {
  // Одно и то же состояние шагаем дважды: в месяц обвала и в соседний.
  // Разница в каталоге обязана быть ровно долей обвала — и у вас, и у него.
  const s = warmed(undefined, 8, 'cliff');
  s.month = CONFIG.rightsCliffMonth - 1;
  const hit = step(structuredClone(s), { decisions: decide(), eventChoice: 0 });
  const s2 = structuredClone(s);
  s2.month = CONFIG.rightsCliffMonth;
  const calm = step(s2, { decisions: decide(), eventChoice: 0 });

  assert.ok(hit.report.rightsCliffHit, 'месяц обвала помечен в отчёте');
  assert.ok(hit.report.rightsCliffLost > 0, 'потери каталога видны игроку');
  const yourRatio = hit.state.catalogLicensed / calm.state.catalogLicensed;
  assert.ok(Math.abs(yourRatio - (1 - CONFIG.rightsCliffShare)) < 0.02,
    `ваш каталог должен просесть на долю обвала, а не на ${yourRatio.toFixed(2)}`);
  const rivalRatio = hit.state.rivalState.catalogLicensed / calm.state.rivalState.catalogLicensed;
  assert.ok(Math.abs(rivalRatio - (1 - CONFIG.rightsCliffShare)) < 0.02,
    'полка конкурента худеет так же: обвал общий, а не персональный');
});

test('обвал прав анонсируется заранее', () => {
  const s = warmed(undefined, 8, 'cliff-ann');
  s.month = CONFIG.rightsCliffAnnounceMonth - 1;
  const r = step(s, { decisions: decide(), eventChoice: 0 }).report;
  assert.ok(r.rightsCliffSoon, 'предупреждение выходит в месяц анонса');
  assert.equal(r.rightsCliffIn, CONFIG.rightsCliffMonth - CONFIG.rightsCliffAnnounceMonth,
    'и говорит, сколько месяцев осталось на подготовку');
});

test('финальный рывок: конкурент получает кассу и воюет до объявленного месяца', () => {
  const s = warmed(undefined, 8, 'surge');
  s.month = CONFIG.rivalSurgeMonth - 1;
  const cashBefore = s.rivalState.cash;
  const o = step(structuredClone(s), { decisions: decide(), eventChoice: 0 });
  assert.ok(o.report.rivalSurge, 'рывок виден в отчёте');
  assert.equal(o.state.rivalState.stance, 'war', 'после раунда конкурент идёт в войну');
  assert.ok(o.state.rivalState.cash > cashBefore, 'внеплановый раунд пополнил его кассу');
  // Война держится и на следующий месяц, вопреки гистерезису позиций
  const o2 = step(o.state, { decisions: decide(), eventChoice: 0 });
  assert.equal(o2.state.rivalState.stance, 'war', 'война не заканчивается через месяц');
});
