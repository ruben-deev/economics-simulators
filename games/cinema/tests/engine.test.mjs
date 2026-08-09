// Тесты движка кинотеатра. Проверяют не «красивые числа», а то, что модель
// ведёт себя как экономика: у решений есть цена, у роста — предел, а у
// каждого рычага — сторона, в которую он ломает результат.

import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG, DEFAULT_DECISIONS, SEGMENTS, GENRES, LEVERS, ALGORITHMS } from '../src/model/config.js';
import {
  createInitialState, step, unitEconomics, valuation, fundingOffer, raise,
  explain, finalScore, algoQuality, dataLevel, rndLevel, techLevel,
  algorithmImpact, catalogDepth, catalogFreshness, projectCost, genreById, segmentById,
} from '../src/model/engine.js';
import { RIVAL_RELEASES, rollRivalRelease, rivalEffect, seasonOf, seasonHours } from '../src/model/market.js';
import { EVENTS, rollEvent, applyEvent, neutralModifiers } from '../src/model/events.js';
import { createRng } from '../../../shared/rng.js';

const decide = (over = {}) => ({ ...DEFAULT_DECISIONS, ...over });

// Прогоняет n месяцев с фиксированными решениями
function run(months, decisions, seed = 'test') {
  let state = createInitialState(seed);
  const reports = [];
  for (let i = 0; i < months && !state.over; i++) {
    const res = step(state, { decisions, eventChoice: 0 });
    state = res.state;
    reports.push(res.report);
  }
  return { state, reports, last: reports[reports.length - 1] };
}

// Разогретое состояние, от которого удобно сравнивать один шаг
function warmed(decisions = decide({ licensing: 40_000_000, marketing: 30_000_000 }), months = 10, seed = 'warm') {
  return run(months, decisions, seed).state;
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
        pricePremium: 399, priceAds: 149, adLoad: 4,
        licensing: Math.round(budget * 0.55),
        originals: Math.round(budget * 0.45),
        marketing: Math.round(45_000_000 + revenue * 0.25),
        tech: 20_000_000, rnd: 20_000_000,
        ...over,
      }),
    });
    state = res.state;
    revenue = res.report.revenue;
  }
  return state;
}

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
  assert.equal(s.pipeline.length, 0);
  assert.ok(s.catalogLicensed >= 0);
});

test('симуляция детерминирована при одном seed', () => {
  const d = decide({ licensing: 60_000_000, originals: 40_000_000, marketing: 50_000_000 });
  const a = run(24, d, 'seed-42');
  const b = run(24, d, 'seed-42');
  assert.deepEqual(
    a.reports.map((r) => [r.subs, r.cash, r.hours]),
    b.reports.map((r) => [r.subs, r.cash, r.hours]),
  );
});

test('разные seed дают разные партии', () => {
  const d = decide({ licensing: 60_000_000, originals: 40_000_000, marketing: 50_000_000 });
  const a = run(24, d, 'seed-1');
  const b = run(24, d, 'seed-2');
  assert.notDeepEqual(a.reports.map((r) => r.cash), b.reports.map((r) => r.cash));
});

test('ни одна метрика не становится NaN или бесконечной', () => {
  const { reports } = run(CONFIG.monthsTotal, decide({
    licensing: 120_000_000, originals: 200_000_000, marketing: 90_000_000,
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
    licensing: 300_000_000, marketing: 400_000_000, pricePremium: 149, priceAds: 49,
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
  const d = decide({ licensing: 50_000_000, originals: 80_000_000, marketing: 40_000_000 });
  let cash = state.cash;
  for (let i = 0; i < 18 && !state.over; i++) {
    const res = step(state, { decisions: d, eventChoice: 0 });
    state = res.state;
    cash += res.report.profit - res.report.oneOff;
    assert.ok(Math.abs(cash - res.report.cash) < 1, `месяц ${res.report.month}: ${cash} ≠ ${res.report.cash}`);
  }
});

test('после банкротства партия останавливается', () => {
  // Огромные постоянные расходы при нулевой выручке
  const { state, reports } = run(CONFIG.monthsTotal, decide({
    licensing: 900_000_000, originals: 900_000_000, marketing: 900_000_000,
    tech: 200_000_000, rnd: 200_000_000,
  }), 'ruin');
  assert.equal(state.over, 'bankrupt');
  assert.ok(state.cash < 0);
  assert.ok(reports.length < CONFIG.monthsTotal);
  const after = step(state, { decisions: DEFAULT_DECISIONS });
  assert.equal(after.state.month, state.month, 'шаг после конца партии не должен двигать месяц');
});

test('партия заканчивается ровно через monthsTotal месяцев', () => {
  const { state, reports } = run(CONFIG.monthsTotal + 5, decide({ licensing: 30_000_000 }), 'finish');
  assert.equal(state.over, 'finished');
  assert.equal(reports.length, CONFIG.monthsTotal);
  assert.equal(state.month, CONFIG.monthsTotal);
});

// ----------------------------------------------------------------------------
// Экономические зависимости: направление важнее величины
// ----------------------------------------------------------------------------

test('выше цена — меньше приток новых подписчиков', () => {
  const base = warmed();
  const cheap = once(base, decide({ pricePremium: 249, priceAds: 99 }));
  const dear = once(base, decide({ pricePremium: 699, priceAds: 299 }));
  assert.ok(dear.newSubs < cheap.newSubs, `${dear.newSubs} должно быть меньше ${cheap.newSubs}`);
  assert.ok(dear.arpu > cheap.arpu, 'зато выручка с подписчика выше');
});

test('дорогая подписка сильнее гонит отток', () => {
  const base = warmed();
  const cheap = once(base, decide({ pricePremium: 249, priceAds: 99 }));
  const dear = once(base, decide({ pricePremium: 899, priceAds: 399 }));
  assert.ok(dear.churnRate > cheap.churnRate);
});

test('оптимум цены внутренний, а не на краю диапазона', () => {
  const lever = LEVERS.find((l) => l.key === 'pricePremium');
  const prices = [lever.min, 249, 349, 399, 499, 599, lever.max];
  const results = prices.map((p) => {
    const { last } = run(30, decide({
      pricePremium: p, priceAds: Math.round(p * 0.37),
      licensing: 260_000_000, originals: 260_000_000, marketing: 120_000_000,
    }), 'price-opt');
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
  const gains = [20_000_000, 80_000_000, 320_000_000].map((m) => {
    const { last } = run(12, decide({ marketing: m, licensing: 60_000_000 }), 'mkt');
    return last.subs;
  });
  assert.ok(gains[1] > gains[0] && gains[2] > gains[1], 'больше денег — больше базы');
  const first = gains[1] - gains[0];
  const second = gains[2] - gains[1];
  assert.ok(second < first * 4,
    `учетверение бюджета не должно давать четырёхкратную прибавку: ${first} → ${second}`);
});

test('маркетинг без каталога сгорает впустую', () => {
  const withCatalog = run(14, decide({ marketing: 200_000_000, licensing: 200_000_000 }), 'burn').last;
  const withoutCatalog = run(14, decide({ marketing: 200_000_000, licensing: 0 }), 'burn').last;
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

  const original = run(14, decide({ licensing: 0, originals: 150_000_000 }), 'cat').state;
  assert.ok(original.catalogOriginal > 0, 'премьеры дошли до полки');
  const stopO = step({ ...structuredClone(original), over: null },
    { decisions: decide({ licensing: 0, originals: 0 }) }).report;
  assert.equal(stopO.catalogOriginal, original.catalogOriginal, 'свой каталог не уменьшается');
});

test('час оригинала весит в глубине больше часа лицензии', () => {
  assert.ok(CONFIG.originalDepthWeight > CONFIG.licenseDepthWeight);
  const licensed = run(20, decide({ licensing: 200_000_000, originals: 0 }), 'w').last;
  const mixed = run(20, decide({ licensing: 100_000_000, originals: 100_000_000 }), 'w').last;
  assert.ok(mixed.catalogHours < licensed.catalogHours, 'часов у оригиналов физически меньше');
  assert.ok(mixed.originalShare > 0, 'зато доля своего выше нуля');
});

test('премьера появляется ровно через originalLeadMonths месяцев', () => {
  const genre = GENRES[0];
  const budget = projectCost(genre);
  let state = createInitialState('pipe');
  const d = decide({ genre: genre.id, originals: budget, licensing: 0 });
  const premiereMonths = [];
  for (let i = 0; i < CONFIG.originalLeadMonths + 2; i++) {
    const res = step(state, { decisions: i === 0 ? d : decide({ genre: genre.id, originals: 0 }) });
    state = res.state;
    if (res.report.premieres.length) premiereMonths.push(res.report.month);
  }
  assert.deepEqual(premiereMonths, [CONFIG.originalLeadMonths]);
});

test('копилка студии переносит недоиспользованный бюджет', () => {
  const genre = GENRES[0];
  const half = Math.floor(projectCost(genre) / 2);
  let state = createInitialState('fund');
  const first = step(state, { decisions: decide({ genre: genre.id, originals: half, licensing: 0 }) });
  assert.equal(first.report.started.length, 0, 'на полпроекта денег не хватает');
  assert.ok(first.report.studioFund >= half - 1);
  const second = step(first.state, { decisions: decide({ genre: genre.id, originals: half + 10, licensing: 0 }) });
  assert.equal(second.report.started.length, 1, 'на втором месяце копилка дала проект');
});

test('только оригиналы разоряют, смешанная стратегия — нет', () => {
  const budget = 220_000_000;
  const onlyOriginals = run(CONFIG.monthsTotal, decide({
    licensing: 0, originals: budget, marketing: 120_000_000,
  }), 'mix');
  const mixed = run(CONFIG.monthsTotal, decide({
    licensing: Math.round(budget * 0.5), originals: Math.round(budget * 0.5), marketing: 120_000_000,
  }), 'mix');
  assert.equal(onlyOriginals.state.over, 'bankrupt',
    'полгода без единой премьеры при полном бюджете — это банкротство');
  assert.equal(mixed.state.over, 'finished');
  assert.ok(mixed.last.subs > onlyOriginals.last.subs);
});

test('эксклюзив удерживает: своя доля каталога снижает отток', () => {
  const licensed = run(24, decide({ licensing: 400_000_000, originals: 0, marketing: 80_000_000 }), 'hold').last;
  const owned = run(24, decide({ licensing: 200_000_000, originals: 260_000_000, marketing: 80_000_000 }), 'hold').last;
  assert.ok(owned.originalShare > licensed.originalShare);
  assert.ok(owned.churnRate < licensed.churnRate,
    `отток при своём каталоге ${owned.churnRate} должен быть ниже ${licensed.churnRate}`);
});

test('свежесть стареет: без новинок каталог перестаёт удерживать', () => {
  let s = grown(24, 'fresh');
  s = structuredClone(s);
  s.over = null;
  s.pipeline = [];               // ничего не выйдет: студия остановлена
  const before = s.freshHours;
  const stop = decide({ licensing: 0, originals: 0, marketing: 0 });
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
  const base = warmed();
  const quiet = structuredClone(base); quiet.rival = 'none';
  const loud = structuredClone(base); loud.rival = 'mega';
  const a = once(quiet, decide());
  const b = once(loud, decide());
  assert.ok(b.newSubs < a.newSubs);
  assert.ok(b.churnRate > a.churnRate);
  assert.ok(b.hours < a.hours);
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

test('генератор афиши выдаёт только известные типы', () => {
  const rng = createRng('rival');
  for (let m = 1; m <= 200; m++) {
    assert.ok(rollRivalRelease(rng, m) in RIVAL_RELEASES);
  }
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
  const u = unitEconomics(state, decide({ pricePremium: 399, priceAds: 149, adLoad: 4 }));
  assert.ok(Number.isFinite(u.revenue) && u.revenue > 0);
  assert.ok(Math.abs((u.revenue - u.variable) - u.contribution) < 1e-6);
  const expensive = unitEconomics(state, decide({ pricePremium: 899, priceAds: 399, adLoad: 4 }));
  assert.ok(expensive.revenue > u.revenue);
});

test('оценка учитывает и выручку, и собственную библиотеку', () => {
  const licensed = run(24, decide({ licensing: 400_000_000, originals: 0, marketing: 80_000_000 }), 'val').state;
  const twin = structuredClone(licensed);
  const withLibrary = valuation({ ...twin, catalogOriginal: twin.catalogOriginal + 5000 });
  assert.ok(withLibrary > valuation(twin), 'своя библиотека — актив на балансе');
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
  const weak = run(20, decide({ licensing: 10_000_000, marketing: 0 }), 'fund').state;
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
    const state = grown(CONFIG.monthsTotal, seed);
    const last = state.history[state.history.length - 1];
    assert.equal(state.over, 'finished', `seed ${seed}: партия должна дойти до конца`);
    assert.ok(last.subs > 2_000_000, `seed ${seed}: подписчиков ${Math.round(last.subs)}`);
    assert.ok(last.cmPerSub > 0, `seed ${seed}: вклад с подписчика ${last.cmPerSub}`);
    assert.ok(last.equityValue > CONFIG.startCash, `seed ${seed}: доля стоит ${last.equityValue}`);
    assert.ok(state.equity > 0.3, `seed ${seed}: доля ${state.equity} — раунды не должны съедать компанию`);
  }
});

test('расти любой ценой невыгодно: доля важнее числа подписчиков', () => {
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
        pricePremium: 399, priceAds: 149, adLoad: 4,
        licensing: Math.round(budget * 0.55), originals: Math.round(budget * 0.45),
        marketing: Math.round(70_000_000 + revenue * 0.35),
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
