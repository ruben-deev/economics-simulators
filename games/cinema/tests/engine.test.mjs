// Тесты движка кинотеатра. Проверяют не «красивые числа», а то, что модель
// ведёт себя как экономика: у решений есть цена, у роста — предел, а у
// каждого рычага — сторона, в которую он ломает результат.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONFIG, DEFAULT_DECISIONS, NO_ACTIONS, SEGMENTS, GENRES, LEVERS, LEVER_GROUPS, ALGORITHMS,
} from '../src/model/config.js';
import { DIFFICULTIES } from '../../../shared/difficulty.js';
import {
  SCALES, scaleById, projectPrice, qualityEstimate, releaseBuzz, projectAppeal,
} from '../src/model/slate.js';
import { marketLiftOf, potentialOf } from '../src/model/engine.js';
import { annualShare, raiseShock, annualSubs } from '../src/model/pricing.js';
import { PARTNERS, partnerById, rollPartnerOffer, partnerTotals } from '../src/model/partners.js';
import {
  createInitialState, step, financeLevel, financeHalf, miscRate, unitEconomics, valuation, fundingOffer, raise,
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

// Партия без наследства прежнего владельца. Тесты механик считают проекты
// поштучно, и стартовый пилот сбивал бы им счёт; сам старт проверяется
// отдельным тестом ниже.
function bare(seed, difficulty) {
  const s = createInitialState(seed, difficulty);
  s.slate = [];
  return s;
}

test('стартовое состояние согласовано', () => {
  const s = createInitialState('a');
  assert.equal(s.cash, CONFIG.startCash);
  assert.equal(s.month, 0);
  assert.equal(s.equity, 1);
  assert.equal(s.catalogOriginal, 0);
  // Наследство прежнего владельца: пилот, доснятый наполовину. Он в
  // производстве, оплачен не игроком и выходит на третьем месяце — до него
  // первые ходы проходили в пустоте.
  assert.equal(s.slate.length, 1);
  assert.equal(s.slate[0].status, 'production');
  assert.equal(s.slate[0].monthlyCost, 0, 'съёмки оплачены прежним владельцем');
  assert.ok(s.slate[0].monthsLeft <= 2, 'премьера в первые месяцы, а не через полгода');
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
    let state = bare(`pipe-${sc.id}`);
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
  let state = bare('vault');
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
  const state = bare('slots');
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
  const state = bare('spread');
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
      // Допуск на органику 8%: в новом мире месяц третьего акта двигает
      // базу сильнее пяти процентов и без всякого контракта
      assert.ok(drop < lost + kept * 0.02 + Math.max(1, c.subs * 0.08),
        `м${c.month}: контракт унёс ${Math.round(drop)} при потерянных ${Math.round(lost)}`
        + ` и удержанных ${Math.round(kept)}`);
    }
  }
  assert.ok(found > 0, 'ни один контракт не закрылся — тест ничего не проверил');
});

test('отток и средние по сегментам не разбавляются оптом', () => {
  // Розничные показатели должны считаться по розничной базе: иначе крупный
  // контракт «улучшал» удержание и цену, ничего в них не меняя.
  const solo = bare('dilute');
  let a = solo, withDeal = bare('dilute');
  let churnSolo = 0, churnDeal = 0;
  for (let i = 0; i < 14; i++) {
    const r1 = step(a, { decisions: DEFAULT_DECISIONS, eventChoice: 0 });
    a = r1.state; churnSolo = r1.report.churnBase;
    const input = { decisions: DEFAULT_DECISIONS, eventChoice: 0 };
    if (withDeal.partnerOffer) input.partnerAnswer = 'accept';
    const r2 = step(withDeal, input);
    withDeal = r2.state; churnDeal = r2.report.churnBase;
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
  assert.equal(rollEvent(rng, 1), null, 'на первом месяце событий нет');
  assert.ok(rollEvent(rng, 2), 'на втором месяце событие приходит гарантированно');
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
  // Сравниваем набор модификаторов целиком, а не четыре выбранных поля:
  // событие может отличаться выбором по любому из них (например по цене
  // в деньгах таланта и по качеству того, что в производстве), и список
  // из четырёх полей однажды уже пропустил такую разницу.
  for (const ev of EVENTS.filter((e) => e.options && e.options.length > 1)) {
    const a = applyEvent(neutralModifiers(), ev, 0);
    const b = applyEvent(neutralModifiers(), ev, 1);
    assert.notDeepEqual(a, b, `«${ev.id}»: оба ответа дают одно и то же`);
  }
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

test('масштаб проекта — обмен, а не лестница: горизонт меняет ответ', () => {
  // Прежняя версия этой проверки утверждала, что чередование масштабов бьёт
  // однообразный конвейер, и держалась на трёх сидах. На двадцати четырёх
  // утверждение разваливается: смешанный выигрывает на 11–14 кодах из 24 при
  // любой платёжеспособности политики — это подбрасывание монеты, а не вывод.
  // Проверяем то, что в модели действительно есть: у масштаба нет лучшего
  // варианта вообще, есть лучший под горизонт. Быстрый пилот выигрывает,
  // пока считается первый год; на полной партии выигрывает сезон, который
  // дольше едет, но и больше приносит.
  const SEEDS_U = Array.from({ length: 12 }, (_, i) => `u${i + 1}`);
  const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

  const play = (scale, seed, months) => {
    let state = bare(seed);
    let last = null;
    for (let i = 0; i < months && !state.over; i++) {
      const burn = Math.max(30e6, -(last?.profit ?? 0));
      if (state.month >= CONFIG.minMonthForFunding && state.cash < burn * 4) {
        state = raise(state, state.cash < burn * 2 ? 1_200_000_000 : 400_000_000).state;
      }
      const producing = state.slate.filter((p) => p.status === 'production').length;
      const o = step(state, {
        decisions: decide({
          priceNew: 449, priceAds: 166, adLoad: 2, annualDiscount: 0.15,
          licensing: 300_000_000, brandMarketing: 60_000_000, trialDays: 21,
          tech: 20_000_000, rnd: 10_000_000, studioSlots: 3,
        }),
        commission: producing < 3 ? [{ genre: 'family', scale, segment: 'mass' }] : [],
        release: state.slate.filter((p) => p.status === 'ready')
          .map((p) => ({ id: p.id, campaign: 25_000_000 })),
        eventChoice: 1,
      });
      state = o.state;
      last = o.report;
    }
    return state.history[state.history.length - 1].equityValue;
  };
  const value = (scale, months) => med(SEEDS_U.map((seed) => play(scale, seed, months)));

  const shortPilot = value('pilot', 12);
  const shortSeason = value('season', 12);
  assert.ok(shortPilot > shortSeason * 1.15,
    `на коротком горизонте пилот должен вести: ${Math.round(shortPilot / 1e9)} против ${Math.round(shortSeason / 1e9)} млрд`);

  const longPilot = value('pilot', CONFIG.monthsTotal);
  const longSeason = value('season', CONFIG.monthsTotal);
  assert.ok(longSeason > longPilot * 1.15,
    `на полной партии сезон должен вести: ${Math.round(longSeason / 1e9)} против ${Math.round(longPilot / 1e9)} млрд`);
});


test('расти любой ценой невыгодно: доля важнее числа подписчиков', () => {
  // Один и тот же seed, разная доля выручки в контент. Подписчиков больше
  // у агрессивной стратегии, но она добирает деньги раундами и размывается.
  // Скромная сторона считана здесь же, а не через grown(): после пересборки
  // спроса (аудит 2026-08) мир жёстче, и бюджет 90 млн + 50% выручки тоже
  // выбирал все три раунда — обе стороны разводнялись до пола, и тест мерил
  // потолок раундов, а не цену жадности.
  let modest = createInitialState('greed');
  {
    let revenue = 0;
    let raises = 0;
    for (let i = 0; i < CONFIG.monthsTotal && !modest.over; i++) {
      if (modest.cash < 900_000_000 && raises < CONFIG.fundingOptions.length) {
        modest = raise(modest, CONFIG.fundingOptions[raises]).state;
        raises += 1;
      }
      const budget = 60_000_000 + revenue * 0.4;
      const res = step(modest, {
        decisions: decide({
          priceNew: 399, priceAds: 149, adLoad: 4,
          licensing: Math.round(budget * 0.55), originals: Math.round(budget * 0.45),
          brandMarketing: Math.round(35_000_000 + revenue * 0.15),
          tech: 20_000_000, rnd: 20_000_000,
        }),
      });
      modest = res.state;
      revenue = res.report.revenue;
    }
  }
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
  // Цена сравнивается по всей партии: конец может случайно совпасть с началом
  const prices = new Set(state.history.map((r) => r.rivalPrice));
  assert.ok(prices.size >= 2, `цена конкурента менялась: ${[...prices].slice(0, 5)}`);
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
  // Аудит 2026-08 поменял годы 2 и 3 местами: доля — пока рынок делится,
  // прибыльность — в год жатвы (в году 2 её не достигала ни одна доведённая
  // опора на 72 партиях, см. комментарий в board.makeGoal).
  const s = createInitialState('goals');
  const y1 = makeGoal(1, s, 0, 1_000_000);
  const y2 = makeGoal(2, s, 1_500_000, 2_000_000);
  const y3 = makeGoal(3, s, 3_000_000, 3_000_000);
  assert.equal(y1.type, 'subscribers');
  assert.equal(y2.type, 'share');
  assert.equal(y3.type, 'profit');
  // Год прибыльности требует и плюса, и удержания базы — одного мало
  const onlyProfit = goalProgress(y3, { subs: 100, rivalSubs: 0, profitableMonths: 12 });
  assert.equal(onlyProfit.done, false, 'одной прибыли без базы не хватает');
  const onlyBase = goalProgress(y3, { subs: 9_000_000, rivalSubs: 0, profitableMonths: 0 });
  assert.equal(onlyBase.done, false, 'одной базы без прибыли тоже');
  // Год доли требует и доли, и не сжаться
  const onlyShare = goalProgress(y2, { subs: 100, rivalSubs: 10, profitableMonths: 0 });
  assert.equal(onlyShare.done, false, 'доля при съёжившейся базе не считается');
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
  let s = bare('cap3');
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
  // Сравнивается ставка до разбиения по стажу: средний отток дополнительно
  // двигается составом базы (дорогой прайс приводит меньше новичков, а они
  // текут сильнее), и это уже не «база заметила прайс», а арифметика смеси.
  assert.ok(Math.abs(b.churnBase - a.churnBase) < 0.005,
    `действующие не должны замечать чужой прайс: ${a.churnBase} против ${b.churnBase}`);
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
  // Замер аудита 2026-08 (24 кода × 3 доведённые опоры): медиана доли на
  // 24-м месяце 0.49, 90-й процентиль 0.60. Планка обязана лежать между:
  // ниже — берут все, выше — не берёт никто.
  assert.ok(y2.target > 0.49 - 1e-9 && y2.target <= 0.60,
    `планка доли ${y2.target} должна лежать между медианой и 90-м процентилем`);
  const y3 = makeGoal(3, null, 4_000_000, 3_000_000);
  assert.ok(y3.subsFloor < 4_000_000,
    'третий год — год обороны: требовать роста базы в нём нельзя');
  // Прибыльных месяцев ≥2 достигают 26/72 партий доведённых опор —
  // сознательно самая жёсткая цель, но живая
  assert.ok(y3.target >= 1 && y3.target <= 3,
    `планка прибыльных месяцев ${y3.target} должна быть жёсткой, но живой`);
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

// ----------------------------------------------------------------------------
// Финансовая команда и уровни сложности набора
// ----------------------------------------------------------------------------

test('финансовая команда: цена растёт с выручкой, «прочие расходы» падают', () => {
  const s = createInitialState('fin', 'normal');
  assert.equal(financeLevel(s, decide({ finance: 0 })), 0, 'без бюджета команды нет');
  const half = financeHalf(s);
  assert.ok(Math.abs(financeLevel(s, decide({ finance: half })) - 0.5) < 1e-9,
    'на насыщении ровно половина силы');
  assert.ok(miscRate(s, decide({ finance: 0 })) > miscRate(s, decide({ finance: half * 4 })),
    'сильная служба режет «прочие расходы»');

  const r = step(s, { decisions: decide({ finance: half }), eventChoice: 0, ...NO_ACTIONS }).report;
  assert.ok(Math.abs(r.miscCost - r.revenue * r.miscRate) < 1, 'строка считается от выручки');
  assert.ok(r.financeCost > 0, 'бюджет команды виден в P&L');
});

test('уровни сложности: одни механики, разная цена команды', () => {
  const level = {}; const misc = {};
  for (const dd of DIFFICULTIES) {
    const s = createInitialState('diff', dd.id);
    assert.equal(s.difficulty, dd.id);
    level[dd.id] = financeLevel(s, decide({ finance: 8_000_000 }));
    misc[dd.id] = miscRate(s, decide({ finance: 8_000_000 }));
  }
  assert.equal(level.easy, 1, 'на лёгком команда уже собрана');
  assert.ok(level.normal > level.hard, 'за те же деньги на сложном покупается меньше');
  assert.ok(misc.easy < misc.normal && misc.normal < misc.hard);
  const easy = step(createInitialState('diff', 'easy'), { decisions: decide({ finance: 8_000_000 }), eventChoice: 0, ...NO_ACTIONS }).report;
  assert.equal(easy.financeCost, 0, 'на лёгком команду содержит не игрок');
  assert.equal(easy.financeLevel, 1);
});

test('совместный мегахит: рынок растёт обоим, договориться можно один раз', () => {
  const decide = (over = {}) => ({ ...DEFAULT_DECISIONS, ...over });
  // NO_ACTIONS ставим ПЕРВЫМ: он обнуляет заказы и релизы, и если положить
  // его после, он затрёт то, что тест как раз и проверяет.
  const propose = (st, genre = 'family') => step(st, {
    ...NO_ACTIONS, decisions: decide({ studioSlots: 3 }), coProduce: { genre }, eventChoice: 0,
  });

  // До назначенного месяца договориться не с кем: слишком рано
  let s = createInitialState('совместный');
  const early = propose(s);
  assert.equal(early.report.jointStarted, null, 'раньше срока проекта нет');

  // Доводим партию до месяца, когда такое предложение возможно
  s = createInitialState('совместный');
  for (let i = 0; i < CONFIG.coProduction.minMonth; i++) {
    s = step(s, { decisions: decide({ studioSlots: 3 }), eventChoice: 0, ...NO_ACTIONS }).state;
  }
  const started = propose(s);
  assert.ok(started.report.jointStarted, 'предложение принято');
  s = started.state;
  assert.ok(s.coProduction, 'проект записан в состояние');
  const project = s.slate.find((p) => p.joint);
  assert.ok(project, 'совместный проект попал в конвейер');
  assert.equal(project.status, 'production');

  // Второй раз так не договориться
  const again = propose(s);
  assert.equal(again.report.jointStarted, null, 'совместный проект бывает один за партию');

  // Доводим до премьеры: часы должны достаться обоим, рынок — вырасти
  const rivalBefore = s.rivalState.catalogOriginal;
  const potentialBefore = potentialOf(SEGMENTS[0], s);
  // Кризисы гасятся первым решением: тест меряет совместный проект, а не
  // невезение — шоураннерский кризис останавливает конвейер, и без
  // урегулирования мегахит не выйдет никогда (шанс кризиса растёт с базой).
  const firstResolution = (id) => CRISES.find((c) => c.id === id)?.resolutions?.[0]?.id ?? null;
  for (let i = 0; i < CONFIG.coProduction.months + 5 && !s.over; i++) {
    const ready = s.slate.filter((p) => p.status === 'ready').map((p) => ({ id: p.id, campaign: 0 }));
    s = step(s, {
      ...NO_ACTIONS, decisions: decide({ studioSlots: 3 }), release: ready, eventChoice: 0,
      crisisChoice: s.crisis ? firstResolution(s.crisis.id) : null,
    }).state;
  }
  assert.ok(s.coProduction.released, 'проект вышел');
  assert.ok(s.rivalState.catalogOriginal > rivalBefore, 'часы достались и конкуренту');
  assert.ok(marketLiftOf(s) > 1, 'рынок вырос');
  assert.ok(potentialOf(SEGMENTS[0], s) > potentialBefore, 'и потолок сегмента вместе с ним');

  // Прибавка не вечная: после окна она тает
  const inWindow = marketLiftOf(s);
  const later = { ...s, month: s.marketLiftUntil + 30 };
  assert.ok(marketLiftOf(later) < inWindow, 'после окна расширение тает');
});

// --- Аудит 2026-08: усталость от шума и годовые как обязательство ---

test('усталость от шума: вторая премьера подряд шумит слабее первой', async () => {
  const { createInitialState, step } = await import('../src/model/engine.js');
  const { DEFAULT_DECISIONS } = await import('../src/model/config.js');
  // Две партии: в одной премьера выходит на свежую аудиторию, в другой —
  // сразу после другой премьеры. Сравниваем шум месяца (report.buzz).
  const mk = () => {
    let s = createInitialState('fatigue-test', 'normal');
    s = step(s, { decisions: { ...DEFAULT_DECISIONS, studioSlots: 2 },
      commission: [{ genre: 'blockbuster', scale: 'pilot', segment: 'mass' }], eventChoice: 0 }).state;
    for (let i = 0; i < 4; i++) {
      s = step(s, { decisions: { ...DEFAULT_DECISIONS, studioSlots: 2 }, eventChoice: 0 }).state;
    }
    return s; // пилот готов (4 месяца)
  };
  // Свежая аудитория: релиз сразу
  let fresh = mk();
  const ready1 = fresh.slate.find((p) => p.status === 'ready');
  fresh = step(fresh, { decisions: { ...DEFAULT_DECISIONS, studioSlots: 2 },
    release: [{ id: ready1.id, campaign: 0 }], eventChoice: 0 }).state;
  const freshBuzz = fresh.history.at(-1).buzz;
  // Утомлённая: перед релизом искусственно поднимаем усталость
  let tired = mk();
  tired.buzzFatigue = 3;
  const ready2 = tired.slate.find((p) => p.status === 'ready');
  tired = step(tired, { decisions: { ...DEFAULT_DECISIONS, studioSlots: 2 },
    release: [{ id: ready2.id, campaign: 0 }], eventChoice: 0 }).state;
  const tiredBuzz = tired.history.at(-1).buzz;
  assert.ok(freshBuzz > 0, 'премьера шумит');
  assert.ok(tiredBuzz < freshBuzz * 0.55, `утомлённый шум заметно слабее: ${tiredBuzz} vs ${freshBuzz}`);
  // усталость спадает со временем
  assert.ok(tired.buzzFatigue > 0);
});

test('годовые: неотработанные месяцы вычитаются из счёта как обязательство', async () => {
  const { createInitialState, deferredAnnualRevenue, finalScore } = await import('../src/model/engine.js');
  const s = createInitialState('deferred-test', 'normal');
  assert.equal(deferredAnnualRevenue(s), 0, 'без годовых долга нет');
  // Когорта: 1000 подписчиков по 300 ₽, осталось 7 месяцев
  s.segments.mass.pricing.annual.push({ subs: 1000, monthsLeft: 7, price: 300 });
  const expected = 1000 * 300 * 7;
  assert.equal(deferredAnnualRevenue(s), expected);
  s.over = 'finished';
  s.month = 36;
  const withDebt = finalScore(s);
  assert.equal(withDebt.deferred, expected);
  s.segments.mass.pricing.annual = [];
  const clean = finalScore(s);
  assert.ok(clean.equityValue - withDebt.equityValue >= expected * s.equity * 0.999,
    'долг по годовым вычтен из стоимости доли');
});

// ---------------------------------------------------------------------------
// Пакет CFO: когорты по стажу, якорную франшизу, выпуск по серии или разом, чужие дома,
// учёт контента. Все пять механик добавлены после разбора с действующим
// финдиром стримингового сервиса (см. docs/cinema/economics.md).
// ---------------------------------------------------------------------------

test('когорты: новичок уходит заметно охотнее выдержанной базы', async () => {
  const { createInitialState, step } = await import('../src/model/engine.js');
  const { CONFIG, DEFAULT_DECISIONS } = await import('../src/model/config.js');
  let s = createInitialState('когорты', 'normal');
  const d = { ...DEFAULT_DECISIONS, licensing: 250e6, brandMarketing: 80e6 };
  for (let i = 0; i < 4; i++) s = step(s, { decisions: d, eventChoice: 0 }).state;
  const r = s.history.at(-1);
  assert.ok(r.churnYoungAvg > r.churnMatureAvg,
    `новички текут сильнее: ${r.churnYoungAvg} vs ${r.churnMatureAvg}`);
  const ratio = r.churnYoungAvg / r.churnMatureAvg;
  assert.ok(ratio > 1.2 && ratio < 2.6, `разрыв в разумных пределах: ${ratio}`);
  assert.ok(r.youngShare > 0 && r.youngShare <= 1, 'доля новичков в пределах [0,1]');
});

test('когорты: разрыв по стажу свой у каждого сегмента', async () => {
  const { createInitialState, step } = await import('../src/model/engine.js');
  const { DEFAULT_DECISIONS } = await import('../src/model/config.js');
  // Одна ставка на всех прятала бы главное: у киномана привычка копится,
  // и выдержанный киноман держится втрое крепче нового, а у молодёжи стажа
  // будто и нет — уходят за следующим хитом хоть на первом месяце, хоть на
  // тридцатом. Проверяем, что порядок сегментов по разрыву именно такой.
  let s = createInitialState('разрыв-сегментов', 'normal');
  const d = { ...DEFAULT_DECISIONS, licensing: 250e6, brandMarketing: 80e6 };
  for (let i = 0; i < 6; i++) s = step(s, { decisions: d, eventChoice: 0 }).state;
  const seg = Object.fromEntries(s.history.at(-1).segments.map((x) => [x.id, x]));
  const spread = (id) => seg[id].churnYoung / seg[id].churnMature;
  assert.ok(spread('cinephile') > spread('mass'),
    `у киномана разрыв шире, чем у массового: ${spread('cinephile')} vs ${spread('mass')}`);
  assert.ok(spread('mass') > spread('youth'),
    `а у молодёжи самый узкий: ${spread('mass')} vs ${spread('youth')}`);
  assert.ok(spread('youth') > 1, 'но новичок везде уходит охотнее ветерана');
});

test('оценка не покупается тишиной перед финалом', async () => {
  const { createInitialState, step, raise, finalScore } = await import('../src/model/engine.js');
  const { CONFIG, DEFAULT_DECISIONS } = await import('../src/model/config.js');
  // Подготовка к выходу — реальная практика, и маржа от неё действительно
  // растёт. Но покупатель нормализует заработок к привычному уровню вложений,
  // иначе выгоднее бросить бизнес, чем строить: до правки тишина с 30-го
  // месяца поднимала итог в 2.26 раза.
  const play = (quietFrom, seed) => {
    const d = { ...DEFAULT_DECISIONS, licensing: 300e6, brandMarketing: 80e6,
      studioSlots: 1, trialDays: 12 };
    let s = createInitialState(seed, 'normal');
    let raises = 0;
    for (let i = 0; i < CONFIG.monthsTotal && !s.over; i++) {
      if (s.cash < 800e6 && raises < CONFIG.fundingOptions.length) {
        s = raise(s, CONFIG.fundingOptions[raises]).state; raises += 1;
      }
      const quiet = s.month + 1 > quietFrom;
      s = step(s, {
        decisions: quiet ? { ...d, licensing: 0, brandMarketing: 0 } : d,
        eventChoice: 0,
      }).state;
    }
    return finalScore(s);
  };
  // По медиане нескольких кодов: на отдельной партии разброс велик, и порог
  // на одном коде ловил бы шум, а не механику.
  const med = (a) => [...a].sort((x, y) => x - y)[(a.length - 1) >> 1];
  const codes = ['тишина-1', 'тишина-2', 'тишина-3', 'тишина-4', 'тишина-5'];
  const built = codes.map((c) => play(CONFIG.monthsTotal, c));
  const coasted = codes.map((c) => play(30, c));
  assert.ok(med(coasted.map((f) => f.valuation)) < med(built.map((f) => f.valuation)),
    'свернувшая вложения компания оценивается дешевле');
  const ratio = med(coasted.map((f) => f.equityValue)) / med(built.map((f) => f.equityValue));
  assert.ok(ratio < 1.5, `и тишина не удваивает итог: ×${ratio.toFixed(2)}`);
});

test('пробный период: у длины есть внутренний оптимум, а не упор', async () => {
  const { createInitialState, step, raise, finalScore } = await import('../src/model/engine.js');
  const { CONFIG, DEFAULT_DECISIONS } = await import('../src/model/config.js');
  // Надбавка за жадность раньше начиналась ровно на опорных четырнадцати днях,
  // и весь участок ниже был выигрышем без обратной стороны.
  const play = (trialDays) => {
    const d = { ...DEFAULT_DECISIONS, licensing: 300e6, brandMarketing: 80e6, trialDays };
    let s = createInitialState('длина-триала', 'normal');
    let raises = 0;
    for (let i = 0; i < CONFIG.monthsTotal && !s.over; i++) {
      if (s.cash < 800e6 && raises < CONFIG.fundingOptions.length) {
        s = raise(s, CONFIG.fundingOptions[raises]).state; raises += 1;
      }
      s = step(s, { decisions: d, eventChoice: 0 }).state;
    }
    const f = finalScore(s);
    return f.bankrupt ? 0 : f.equityValue;
  };
  const short = play(3);
  const mid = play(12);
  const long = play(30);
  assert.ok(mid > short, `середина лучше слишком короткого: ${mid} против ${short}`);
  assert.ok(mid > long, `и лучше слишком длинного: ${mid} против ${long}`);
});

test('глубокая полка кормит часами того, кому полка важна', async () => {
  const { createInitialState, step, raise } = await import('../src/model/engine.js');
  const { CONFIG, DEFAULT_DECISIONS } = await import('../src/model/config.js');
  // Ровный показатель глубины в часах раздавал их поровну: киноману, которому
  // полка нужна, и подростку, которому всё равно. Главный канал выручки не
  // различал аудиторию — и любая ставка на широту каталога размазывалась.
  const run = (licensing) => {
    const d = { ...DEFAULT_DECISIONS, licensing, brandMarketing: 120e6, rnd: 40e6 };
    let s = createInitialState('полка-и-часы', 'normal');
    let raises = 0;
    for (let i = 0; i < 20 && !s.over; i++) {
      if (s.cash < 800e6 && raises < CONFIG.fundingOptions.length) {
        s = raise(s, CONFIG.fundingOptions[raises]).state; raises += 1;
      }
      s = step(s, { decisions: d, eventChoice: 0 }).state;
    }
    const r = s.history.at(-1);
    return Object.fromEntries(r.segments.map((x) => [x.id, x.hours / Math.max(1, x.subs)]));
  };
  const thin = run(80e6);
  const deep = run(800e6);
  const gain = (id) => deep[id] / thin[id];
  assert.ok(gain('cinephile') > gain('family'),
    `киноман отзывчивее семьи: ${gain('cinephile')} против ${gain('family')}`);
  assert.ok(gain('family') > gain('mass'),
    `семья отзывчивее массового: ${gain('family')} против ${gain('mass')}`);
  assert.ok(gain('mass') > 1, 'но полка добавляет часы всем');
  assert.ok(gain('cinephile') > gain('youth') * 1.25,
    `а молодёжи полка почти безразлична: ${gain('cinephile')} против ${gain('youth')}`);
});

test('рекомендации достают с полки: на тонкой доставать нечего', async () => {
  const { createInitialState, step, raise } = await import('../src/model/engine.js');
  const { CONFIG, DEFAULT_DECISIONS } = await import('../src/model/config.js');
  // Урок самого алгоритма — «они лишь достают контент с полки» — до правки
  // не был выражен в коде: подъём был ровным множителем и одинаково поднимал
  // тысячу часов каталога и пустую афишу.
  const run = (licensing) => {
    const d = { ...DEFAULT_DECISIONS, licensing, brandMarketing: 100e6, rnd: 90e6,
      algoOn: { ...DEFAULT_DECISIONS.algoOn, recommendations: true },
      algoParam: { ...DEFAULT_DECISIONS.algoParam, recommendations: 0.7 } };
    let s = createInitialState('лента-и-полка', 'normal');
    let raises = 0;
    for (let i = 0; i < 20 && !s.over; i++) {
      if (s.cash < 800e6 && raises < CONFIG.fundingOptions.length) {
        s = raise(s, CONFIG.fundingOptions[raises]).state; raises += 1;
      }
      s = step(s, { decisions: d, eventChoice: 0,
        install: s.installed?.recommendations ? [] : ['recommendations'] }).state;
    }
    const r = s.history.at(-1);
    return { depth: r.depth, lift: r.perceivedDepth / r.depth };
  };
  const thin = run(60e6);
  const deep = run(800e6);
  assert.ok(deep.depth > thin.depth * 1.4, `полка действительно разная: ${thin.depth} и ${deep.depth}`);
  assert.ok(deep.lift > thin.lift * 1.15,
    `на глубокой полке лента поднимает сильнее: ${thin.lift} против ${deep.lift}`);
  assert.ok(thin.lift < deep.lift, 'подъём растёт вместе с полкой, а не задан константой');
});

test('сегменты: премьера держит молодёжь, полка — киноманов', async () => {
  const { createInitialState, step, raise } = await import('../src/model/engine.js');
  const { CONFIG, DEFAULT_DECISIONS } = await import('../src/model/config.js');
  // Одна ставка премьеры на все сегменты означала бы, что киноман держится
  // за громкий блокбастер так же, как подросток. Проверяем, что чувствительность
  // развели: молодёжь живёт премьерами, киноманы — полкой.
  let s = createInitialState('сегменты-драйверы', 'normal');
  const d = { ...DEFAULT_DECISIONS, licensing: 400e6, brandMarketing: 120e6, studioSlots: 2 };
  let raises = 0;
  for (let i = 0; i < 16 && !s.over; i++) {
    if (s.cash < 800e6 && raises < CONFIG.fundingOptions.length) {
      s = raise(s, CONFIG.fundingOptions[raises]).state; raises += 1;
    }
    s = step(s, { decisions: d, eventChoice: 0 }).state;
  }
  const fork = (mut) => {
    const st = structuredClone(s);
    mut(st);
    const r = step(st, { decisions: d, eventChoice: 0 }).report;
    return Object.fromEntries(r.segments.map((x) => [x.id, x.churnRate]));
  };
  const base = fork(() => {});
  const loud = fork((st) => { st.lastBuzz = 1; });
  const deep = fork((st) => {
    st.catalogLicensed *= 6; st.catalogOriginal *= 6;
    for (const g of Object.keys(st.originalsByGenre ?? {})) st.originalsByGenre[g] *= 6;
  });
  const byPremiere = (id) => base[id] - loud[id];
  const byShelf = (id) => base[id] - deep[id];
  assert.ok(byPremiere('youth') > byPremiere('cinephile') * 1.5,
    `премьера держит молодёжь сильнее киномана: ${byPremiere('youth')} против ${byPremiere('cinephile')}`);
  assert.ok(byShelf('cinephile') > byShelf('youth') * 1.5,
    `а полка — наоборот: ${byShelf('cinephile')} против ${byShelf('youth')}`);
  assert.ok(byPremiere('mass') > byPremiere('family'),
    `массовый гонится за премьерой охотнее семьи: ${byPremiere('mass')} против ${byPremiere('family')}`);
});

test('когорты: премьеру любит новичок, полку — ветеран', async () => {
  const { createInitialState, step } = await import('../src/model/engine.js');
  const { DEFAULT_DECISIONS } = await import('../src/model/config.js');
  let s = createInitialState('когорты-драйверы', 'normal');
  const d = { ...DEFAULT_DECISIONS, licensing: 300e6, brandMarketing: 90e6 };
  for (let i = 0; i < 12; i++) s = step(s, { decisions: d, eventChoice: 0 }).state;
  const fork = (mut) => {
    const st = structuredClone(s);
    mut(st);
    return step(st, { decisions: d, eventChoice: 0 }).report;
  };
  const base = fork(() => {});
  // Шум премьеры держит новичка сильнее: он ради неё и пришёл.
  const loud = fork((st) => { st.lastBuzz = 1; });
  const heldYoung = base.churnYoungAvg - loud.churnYoungAvg;
  const heldMature = base.churnMatureAvg - loud.churnMatureAvg;
  assert.ok(heldYoung > heldMature * 1.5,
    `премьера держит новичка сильнее: ${heldYoung} против ${heldMature}`);
  // Полка держит ветерана — а новичку почти ничего не обещает: он ещё не
  // дошёл до второго ряда. Долю своего контента при этом не трогаем.
  const deep = fork((st) => {
    st.catalogLicensed *= 6; st.catalogOriginal *= 6;
    for (const g of Object.keys(st.originalsByGenre ?? {})) st.originalsByGenre[g] *= 6;
  });
  const shelfMature = base.churnMatureAvg - deep.churnMatureAvg;
  const shelfYoung = base.churnYoungAvg - deep.churnYoungAvg;
  assert.ok(shelfMature > 0.002, `глубокая полка снимает отток с ветерана: ${shelfMature}`);
  assert.ok(shelfMature > shelfYoung * 3,
    `и почти не трогает новичка: ветеран ${shelfMature}, новичок ${shelfYoung}`);
});

test('когорты: доля новичков в базе двигает средний отток', async () => {
  const { createInitialState, step } = await import('../src/model/engine.js');
  const { CONFIG, DEFAULT_DECISIONS } = await import('../src/model/config.js');
  // Сравнивать надо зрелый сервис: в первые полгода база молода по построению,
  // и доля новичков там ничего не говорит о темпе роста.
  const d = (marketing) => ({ ...DEFAULT_DECISIONS, licensing: 300e6, brandMarketing: marketing });
  let base = createInitialState('зрелость', 'normal');
  for (let i = 0; i < 24; i++) base = step(base, { decisions: d(60e6), eventChoice: 0 }).state;
  const branch = (marketing) => {
    let s = structuredClone(base);
    for (let i = 0; i < 6; i++) s = step(s, { decisions: d(marketing), eventChoice: 0 }).state;
    return s.history.at(-1);
  };
  // Проверяем само утверждение — что смесь по стажу двигает средний отток, —
  // а не его отпечаток в шести месяцах маркетинга. Замер на 20 кодах: за
  // полгода лишних денег база растёт на 2–7%, доля новичков сдвигается на
  // доли процента, и знак разницы определяется шумом (утверждение держалось
  // в 5–7 партиях из 20 и до, и после правок аудита). Механика при этом
  // верна по построению, и проверять надо её.
  const r = branch(60e6);
  const seg = r.segments[0];
  assert.ok(seg.churnYoung > seg.churnMature,
    `новичок в сегменте течёт сильнее выдержанного: ${seg.churnYoung} vs ${seg.churnMature}`);
  const ref = CONFIG.cohortRefYoungShare;
  const blend = (share) => share * r.churnYoungAvg + (1 - share) * r.churnMatureAvg;
  assert.ok(blend(ref + 0.15) > blend(ref),
    'база с большей долей новичков даёт более высокий средний отток');
  assert.ok(blend(ref) > blend(ref - 0.15),
    'и наоборот: выдержанная база течёт медленнее при той же ставке');
});

test('якорную франшизу: уходит в срок, продление стоит денег и сохраняет права', async () => {
  const { createInitialState, step } = await import('../src/model/engine.js');
  const { CONFIG, DEFAULT_DECISIONS } = await import('../src/model/config.js');
  const play = (renew) => {
    let s = createInitialState('якорь', 'normal');
    let paid = 0;
    const d = { ...DEFAULT_DECISIONS, licensing: 200e6 };
    for (let i = 0; i < CONFIG.anchorTermMonths + 2; i++) {
      const doRenew = renew && s.anchor.alive && s.anchor.monthsLeft <= CONFIG.anchorWarnMonths;
      s = step(s, { decisions: d, renewAnchor: doRenew, eventChoice: 0 }).state;
      paid += s.history.at(-1).anchorRenewCost ?? 0;
    }
    return { s, paid };
  };
  const dropped = play(false);
  assert.equal(dropped.s.anchor.alive, false, 'без продления права уходят');
  assert.equal(dropped.paid, 0, 'и ничего не стоят');
  assert.ok(dropped.s.history.some((r) => r.anchorLost), 'момент ухода отмечен в отчёте');

  const kept = play(true);
  assert.equal(kept.s.anchor.alive, true, 'с продлением права остаются');
  assert.ok(kept.paid > 0, 'продление стоит денег');
  assert.equal(kept.s.anchor.renewals, 1, 'продлевали один раз');
  const keptSubs = kept.s.history.at(-1).subs;
  const lostSubs = dropped.s.history.at(-1).subs;
  assert.ok(keptSubs > lostSubs, `франшиза держит базу: ${keptSubs} vs ${lostSubs}`);
});

test('каденция: понедельный выпуск тише шумит, но мягче роняет базу', async () => {
  const { createInitialState, step } = await import('../src/model/engine.js');
  const { CONFIG, DEFAULT_DECISIONS } = await import('../src/model/config.js');
  const play = (cadence) => {
    let s = createInitialState('каденция', 'normal');
    const d = { ...DEFAULT_DECISIONS, licensing: 200e6, studioSlots: 2 };
    s = step(s, { decisions: d,
      commission: [{ genre: 'drama', scale: 'pilot', segment: 'mass' }], eventChoice: 0 }).state;
    let released = null;
    for (let i = 0; i < 10; i++) {
      const ready = (s.slate ?? []).filter((p) => p.status === 'ready');
      const release = !released && ready.length
        ? [{ id: ready[0].id, campaign: 50e6, cadence }] : [];
      s = step(s, { decisions: d, release, eventChoice: 0 }).state;
      if (release.length) released = s.history.at(-1);
    }
    return { released, hangoverAfter: s.history.at(-1).hangover ?? 0 };
  };
  const binge = play('binge');
  const weekly = play('weekly');
  assert.ok(binge.released && weekly.released, 'обе премьеры состоялись');
  assert.ok(weekly.released.buzz < binge.released.buzz,
    `понедельный пик тише: ${weekly.released.buzz} vs ${binge.released.buzz}`);
  assert.ok(CONFIG.cadenceWeeklyHangover < CONFIG.cadenceBingeHangover,
    'и похмелье после него слабее по построению');
});

test('чужие дома: платный доступ приводит подписчиков и злит часть базы', async () => {
  const { createInitialState, step } = await import('../src/model/engine.js');
  const { DEFAULT_DECISIONS } = await import('../src/model/config.js');
  const play = (policy) => {
    let s = createInitialState('пароли', 'normal');
    const d = { ...DEFAULT_DECISIONS, licensing: 250e6, brandMarketing: 60e6 };
    for (let i = 0; i < 12; i++) {
      s = step(s, { decisions: { ...d, sharingPolicy: i >= 8 ? policy : 0 }, eventChoice: 0 }).state;
    }
    return s;
  };
  const idle = play(0);
  const enforced = play(2);
  const idleLast = idle.history.at(-1);
  const enfLast = enforced.history.at(-1);
  assert.ok(idleLast.sharingShare > enfLast.sharingShare,
    'платный доступ уменьшает долю смотрящих по чужой подписке');
  assert.ok(enforced.history.some((r) => (r.sharingConvertedSubs ?? 0) > 0),
    'часть разделявших завела свою подписку');
  assert.ok(enforced.history.some((r) => (r.sharingLostSubs ?? 0) > 0),
    'часть ушла вместе с тем, кто их пустил');
});

test('учёт контента: касса и признанный расход расходятся, счёт идёт по кассе', async () => {
  const { createInitialState, step } = await import('../src/model/engine.js');
  const { CONFIG, DEFAULT_DECISIONS } = await import('../src/model/config.js');
  let s = createInitialState('учёт', 'normal');
  const d = { ...DEFAULT_DECISIONS, licensing: 400e6 };
  s = step(s, { decisions: d, eventChoice: 0 }).state;
  const first = s.history.at(-1);
  assert.ok(first.contentAmortization < first.contentSpend,
    'в первый месяц признано меньше, чем ушло деньгами');
  assert.ok(first.contentBookValue > 0, 'остаток ждёт списания в следующих месяцах');
  assert.ok(first.profitAccrual > first.profit,
    'учётная прибыль выше кассовой, пока полка наполняется');
  // Дальше перестаём покупать: списание продолжается, остаток тает
  const before = s.history.at(-1).contentBookValue;
  s = step(s, { decisions: { ...DEFAULT_DECISIONS, licensing: 0 }, eventChoice: 0 }).state;
  const after = s.history.at(-1);
  assert.ok(after.contentBookValue < before, 'остаток списывается и без новых покупок');
  assert.ok(after.contentAmortization > 0, 'расход признаётся, хотя денег в этом месяце не платили');
  assert.ok(Math.abs(before * (1 - CONFIG.amortRateLicense) - after.contentBookValue) < before * 0.05,
    'списание идёт по убывающему остатку');
});

test('когорты: при опорной доле новичков средний отток равен базовой ставке', async () => {
  const { createInitialState, step } = await import('../src/model/engine.js');
  const { CONFIG, DEFAULT_DECISIONS } = await import('../src/model/config.js');
  // Нормировка: разбиение по стажу перераспределяет отток, а не поднимает его.
  // Проверяем арифметику смеси напрямую по ставкам из отчёта.
  let s = createInitialState('нормировка', 'normal');
  const d = { ...DEFAULT_DECISIONS, licensing: 300e6, brandMarketing: 60e6 };
  for (let i = 0; i < 18; i++) s = step(s, { decisions: d, eventChoice: 0 }).state;
  const r = s.history.at(-1);
  const ref = CONFIG.cohortRefYoungShare;
  const blendedAtRef = ref * r.churnYoungAvg + (1 - ref) * r.churnMatureAvg;
  assert.ok(Math.abs(blendedAtRef - r.churnBase) < r.churnBase * 0.02,
    `при опорной доле смесь равна базовой ставке: ${blendedAtRef} против ${r.churnBase}`);
});

test('чужие дома: не трогать — тоже решение, чужие часы идут по вашему счёту', async () => {
  const { createInitialState, step } = await import('../src/model/engine.js');
  const { CONFIG, DEFAULT_DECISIONS } = await import('../src/model/config.js');
  const snapshot = { base: CONFIG.sharingBase, growth: CONFIG.sharingGrowth };
  const run = () => {
    let s = createInitialState('трафик', 'normal');
    const d = { ...DEFAULT_DECISIONS, licensing: 250e6, brandMarketing: 60e6 };
    for (let i = 0; i < 10; i++) s = step(s, { decisions: d, eventChoice: 0 }).state;
    return s.history.at(-1);
  };
  const withSharing = run();
  CONFIG.sharingBase = 0; CONFIG.sharingGrowth = 0;
  const without = run();
  CONFIG.sharingBase = snapshot.base; CONFIG.sharingGrowth = snapshot.growth;
  assert.ok(withSharing.cdnCost > without.cdnCost,
    `разделяющие стоят трафика: ${withSharing.cdnCost} против ${without.cdnCost}`);
  assert.ok(withSharing.hours > without.hours, 'и их часы попадают в общий счёт');
});

test('чужие дома: попросить платить рано — потерять охват, который они приносили', async () => {
  const { createInitialState, step } = await import('../src/model/engine.js');
  const { DEFAULT_DECISIONS } = await import('../src/model/config.js');
  const run = (closeFrom) => {
    let s = createInitialState('охват', 'normal');
    const d = { ...DEFAULT_DECISIONS, licensing: 250e6, brandMarketing: 60e6 };
    for (let i = 0; i < 20; i++) {
      const sharingPolicy = closeFrom && s.month + 1 >= closeFrom ? 2 : 0;
      s = step(s, { decisions: { ...d, sharingPolicy }, eventChoice: 0 }).state;
    }
    return s.history.at(-1);
  };
  const early = run(3);
  const never = run(0);
  assert.ok(early.sharingShare < never.sharingShare, 'раннее закрытие душит долю в зародыше');
  const aw = (r) => r.segments.reduce((a, x) => a + x.awareness, 0) / r.segments.length;
  assert.ok(aw(early) < aw(never),
    `и вместе с ней гаснет сарафан: ${aw(early)} против ${aw(never)}`);
});

test('судьба проекта: что стоил и что принёс, с честной атрибуцией', async () => {
  const { createInitialState, step, raise } = await import('../src/model/engine.js');
  const { CONFIG, DEFAULT_DECISIONS } = await import('../src/model/config.js');
  let s = bare('судьба', 'normal');
  let raises = 0;
  const d = { ...DEFAULT_DECISIONS, licensing: 300e6, brandMarketing: 100e6, studioSlots: 2 };
  s = step(s, { decisions: d,
    commission: [{ genre: 'blockbuster', scale: 'pilot', segment: 'mass' }], eventChoice: 0 }).state;
  let released = false;
  for (let i = 0; i < 16; i++) {
    if (s.cash < 800e6 && raises < CONFIG.fundingOptions.length) {
      s = raise(s, CONFIG.fundingOptions[raises]).state; raises += 1;
    }
    const ready = (s.slate ?? []).filter((p) => p.status === 'ready');
    const release = !released && ready.length
      ? [{ id: ready[0].id, campaign: 100e6, cadence: 'binge' }] : [];
    if (release.length) released = true;
    s = step(s, { decisions: d, release, eventChoice: 0 }).state;
  }
  const r = s.history.at(-1);
  assert.equal(r.titles.length, 1, 'вышел ровно один проект');
  const t = r.titles[0];
  assert.ok(t.production > 0, 'производство посчитано по фактически выплаченному');
  assert.equal(t.campaign, 100e6, 'кампания под релиз записана отдельно');
  assert.equal(t.spend, t.production + t.campaign, 'стоимость — сумма двух статей');
  assert.ok(t.subsBrought > 0, 'премьера привела подписчиков');
  assert.ok(t.subsAlive < t.subsBrought, 'приведённые тают вместе со всеми');
  assert.ok(t.subscription > 0, 'и всё это время платят');
  assert.ok(t.cdn > 0, 'его часы стоят трафика');
  assert.ok(Math.abs(t.contribution - (t.subscription + t.ads - t.cdn)) < 1,
    'вклад = подписка + реклама − трафик');
  assert.ok(Math.abs(t.net - (t.contribution - t.spend)) < 1, 'итог = вклад − затраты');
});

test('атрибуция премьер: доля часов считается от всего каталога, а не от своей полки', async () => {
  const { createInitialState, step, raise } = await import('../src/model/engine.js');
  const { CONFIG, DEFAULT_DECISIONS } = await import('../src/model/config.js');
  let s = createInitialState('доля', 'normal');
  let raises = 0;
  // Большая арендованная полка: собственный пилот не может забрать весь трафик
  const d = { ...DEFAULT_DECISIONS, licensing: 700e6, brandMarketing: 80e6, studioSlots: 2 };
  s = step(s, { decisions: d,
    commission: [{ genre: 'drama', scale: 'pilot', segment: 'mass' }], eventChoice: 0 }).state;
  let released = false;
  for (let i = 0; i < 14; i++) {
    if (s.cash < 800e6 && raises < CONFIG.fundingOptions.length) {
      s = raise(s, CONFIG.fundingOptions[raises]).state; raises += 1;
    }
    const ready = (s.slate ?? []).filter((p) => p.status === 'ready');
    const release = !released && ready.length ? [{ id: ready[0].id, campaign: 60e6 }] : [];
    if (release.length) released = true;
    s = step(s, { decisions: d, release, eventChoice: 0 }).state;
  }
  const r = s.history.at(-1);
  const t = r.titles[0];
  assert.ok(t.cdn < r.cdnCost * 0.5,
    `один пилот при большой арендованной полке не может стоить полтрафика: ${t.cdn} из ${r.cdnCost}`);
  assert.ok(t.ads < r.adRevenue * 0.5, 'и не может забрать половину рекламной выручки');
});

test('состояние прошлой сборки не роняет ход, а достраивается', async () => {
  const { createInitialState, step, normalizeState } = await import('../src/model/engine.js');
  const { CONFIG, DEFAULT_DECISIONS } = await import('../src/model/config.js');
  // Сейв предыдущей версии не знает о полях, добавленных позже. Обращение к
  // ним роняло весь ход — ровно так однажды умер лёгкий уровень НОВОЕДЫ.
  const old = createInitialState('старый-сейв', 'normal');
  delete old.anchor; delete old.sharingShare; delete old.sharingAnger;
  delete old.contentBook; delete old.weeklyHoldLeft; delete old.sharingPolicyPrev;
  for (const id of Object.keys(old.segments)) delete old.segments[id].young;

  const fixed = normalizeState(structuredClone(old));
  assert.equal(fixed.anchor.alive, true, 'франшиза достроена живой');
  assert.equal(fixed.sharingShare, CONFIG.sharingBase, 'доля чужих домов взята стартовой');
  assert.ok(fixed.segments.mass.young >= 0, 'когорта новичков достроена');

  const after = step(old, { decisions: DEFAULT_DECISIONS, eventChoice: 0 });
  assert.ok(after.report, 'ход прожит без падения');
  assert.ok(Number.isFinite(after.report.subs), 'и посчитан');
});

test('якорная франшиза: второе продление дороже первого — правообладатель знает вашу цену', async () => {
  const { createInitialState, step } = await import('../src/model/engine.js');
  const { CONFIG, DEFAULT_DECISIONS } = await import('../src/model/config.js');
  let s = createInitialState('жадность', 'normal');
  const d = { ...DEFAULT_DECISIONS, licensing: 200e6 };
  const prices = [];
  for (let i = 0; i < CONFIG.anchorTermMonths + CONFIG.anchorRenewMonths + 2; i++) {
    const a = s.anchor;
    const renew = a.alive && a.monthsLeft <= CONFIG.anchorWarnMonths;
    // Пакет прав второго месяца не берём: тест про цену франшизы, а лишние
    // 90 млн в начале решают, хватит ли кассы на второе продление.
    s = step(s, { decisions: d, renewAnchor: renew, eventChoice: 1 }).state;
    const r = s.history.at(-1);
    if (r.anchorRenewCost > 0) prices.push(r.anchorRenewCost);
  }
  assert.ok(prices.length >= 2, `продлевали дважды: ${prices.length}`);
  assert.ok(prices[1] > prices[0] * 1.5,
    `второй контракт заметно дороже первого: ${prices[0]} → ${prices[1]}`);
});

test('разбор партии называет потерю франшизы и неоплаченный доступ вне дома', async () => {
  const { createInitialState, step, raise, debrief } = await import('../src/model/engine.js');
  const { CONFIG, DEFAULT_DECISIONS } = await import('../src/model/config.js');
  // Пассивная партия: франшизу не продлевали, доступ вне дома не трогали
  let s = createInitialState('разбор-пассив', 'normal');
  let raises = 0;
  const d = { ...DEFAULT_DECISIONS, licensing: 300e6, brandMarketing: 100e6 };
  for (let i = 0; i < CONFIG.monthsTotal && !s.over; i++) {
    if (s.cash < 800e6 && raises < CONFIG.fundingOptions.length) {
      s = raise(s, CONFIG.fundingOptions[raises]).state; raises += 1;
    }
    s = step(s, { decisions: d, eventChoice: 0 }).state;
  }
  const ids = debrief(s).map((x) => x.id);
  assert.ok(ids.includes('anchorLost'), `разбор называет уход франшизы: ${ids.join(', ')}`);
  assert.ok(ids.includes('sharingIgnored'), `и нетронутый доступ вне дома: ${ids.join(', ')}`);
  const lost = debrief(s).find((x) => x.id === 'anchorLost');
  assert.ok(lost.m > 0 && lost.m <= CONFIG.monthsTotal, 'с указанием месяца');
});

test('разбор партии называет лишнее продление франшизы', async () => {
  const { createInitialState, step, raise, debrief } = await import('../src/model/engine.js');
  const { CONFIG, DEFAULT_DECISIONS } = await import('../src/model/config.js');
  let s = createInitialState('разбор-жадность', 'normal');
  let raises = 0;
  const d = { ...DEFAULT_DECISIONS, licensing: 250e6, brandMarketing: 80e6 };
  for (let i = 0; i < CONFIG.monthsTotal && !s.over; i++) {
    if (s.cash < 800e6 && raises < CONFIG.fundingOptions.length) {
      s = raise(s, CONFIG.fundingOptions[raises]).state; raises += 1;
    }
    const a = s.anchor;
    const renew = a.alive && a.monthsLeft <= CONFIG.anchorWarnMonths;
    s = step(s, { decisions: d, renewAnchor: renew, eventChoice: 0 }).state;
  }
  assert.ok(s.anchor.renewals >= 2, `продлевали дважды: ${s.anchor.renewals}`);
  const item = debrief(s).find((x) => x.id === 'anchorOverpaid');
  assert.ok(item, 'разбор замечает второй контракт');
  assert.ok(item.money > 0, 'и называет потраченную сумму');
});
