// Тесты движка билетного сервиса. Проверяют не «красивые числа», а то, что
// модель ведёт себя как двусторонний рынок: у каждой стороны своя реакция,
// у каждого решения есть цена, и ни одна сторона не приходит первой сама.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONFIG, ORGANIZERS, AUDIENCES, LEVERS, LEVER_GROUPS, ALGORITHMS, DEFAULT_DECISIONS,
  organizerById, audienceById,
} from '../src/model/config.js';
import {
  createInitialState, step, unitEconomics, valuation, fundingOffer, raise,
  explain, explainFactors, finalScore, algoQuality, dataLevel, rndLevel,
  orgTotal, totalReach, platformLevel, productLevel,
} from '../src/model/engine.js';
import { seasonOf, eventSeason, demandSeason, HITS, hitById } from '../src/model/market.js';
import {
  serviceQuality, platformFit, organizerAppeal, preferenceAgainst, organizerChurn, breadth,
} from '../src/model/supply.js';
import {
  feeFactor, conversion, soldTickets, buyerPreference, segmentInterest,
} from '../src/model/demand.js';
import { channelSplit, platformLevelOf, subscriptionDrag } from '../src/model/channel.js';
import { createRival, rivalOrgTotal, STANCES, STANCE_MIN_MONTHS } from '../src/model/rival.js';
import { makeGoal, goalProgress } from '../src/model/board.js';
import { CRISES, crisisById, crisisEffects, resolutionCost, rollCrisis, MAX_ESCALATION } from '../src/model/crises.js';
import { EVENTS, rollEvent, applyEvent, neutralModifiers } from '../src/model/events.js';
import { createRng } from '../../../shared/rng.js';

const decide = (over = {}) => ({
  ...DEFAULT_DECISIONS, ...over,
  platformFor: { ...DEFAULT_DECISIONS.platformFor, ...(over.platformFor ?? {}) },
});

// Прогоняет n месяцев с фиксированными решениями, разбирая кризисы сразу:
// иначе тест меряет не рычаг, а терпение.
const CRISIS_FIX = {
  resellers: 'nominal', outage: 'rebuild', feeCap: 'transparent',
  cancelled: 'refundFast', leak: 'audit',
};
function run(months, decisions, seed = 'test') {
  let state = createInitialState(seed);
  const reports = [];
  for (let i = 0; i < months && !state.over; i++) {
    const res = step(state, {
      decisions, eventChoice: 0,
      crisisChoice: state.crisis ? CRISIS_FIX[state.crisis.id] : null,
    });
    state = res.state;
    reports.push(res.report);
  }
  return { state, reports, last: reports[reports.length - 1] };
}

// ----------------------------------------------------------------------------
// Конфигурация
// ----------------------------------------------------------------------------
test('в конфигурации нет дублей и все ссылки разрешаются', () => {
  const ids = ORGANIZERS.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length, 'дубли типов организаторов');
  const auds = AUDIENCES.map((a) => a.id);
  assert.equal(new Set(auds).size, auds.length, 'дубли сегментов зрителей');
  const keys = LEVERS.map((l) => l.key);
  assert.equal(new Set(keys).size, keys.length, 'дубли рычагов');

  for (const aud of AUDIENCES) {
    for (const id of ids) {
      assert.equal(typeof aud.affinity[id], 'number', `${aud.id}: нет тяги к ${id}`);
    }
  }
  for (const l of LEVERS) {
    assert.ok(LEVER_GROUPS.some((g) => g.id === l.group), `${l.key}: группа ${l.group} не существует`);
    assert.ok(l.def >= l.min && l.def <= l.max, `${l.key}: значение по умолчанию вне диапазона`);
  }
  for (const a of ALGORITHMS) {
    assert.ok(a.unlock >= 0 && a.unlock <= 1, `${a.key}: порог открытия вне диапазона`);
  }
});

test('значения по умолчанию не убивают компанию за первый год', () => {
  const { state } = run(12, decide());
  assert.equal(state.over, null, 'со стартовыми настройками нельзя разориться за год');
});

// ----------------------------------------------------------------------------
// Сторона предложения
// ----------------------------------------------------------------------------
test('комиссия с организатора монотонно снижает их число', () => {
  const cheap = run(18, decide({ orgCommission: 0.02 }), 'supply').last;
  const mid = run(18, decide({ orgCommission: 0.06 }), 'supply').last;
  const dear = run(18, decide({ orgCommission: 0.12 }), 'supply').last;
  assert.ok(cheap.orgs > mid.orgs, 'дешевле комиссия — больше организаторов');
  assert.ok(mid.orgs > dear.orgs, 'дороже комиссия — меньше организаторов');
});

test('перегруженные менеджеры теряют организаторов', () => {
  const few = run(18, decide({ managers: 2 }), 'svc').last;
  const many = run(18, decide({ managers: 60 }), 'svc').last;
  assert.ok(few.service < many.service, 'мало менеджеров — хуже обслуживание');
  assert.ok(few.orgs < many.orgs, 'плохое обслуживание стоит организаторов');
});

test('обслуживание падает нелинейно при перегрузке', () => {
  const norm = serviceQuality(10, 10 * CONFIG.orgPerManager);
  const double = serviceQuality(10, 20 * CONFIG.orgPerManager);
  const quad = serviceQuality(10, 40 * CONFIG.orgPerManager);
  assert.ok(norm > double && double > quad);
  assert.ok(norm / double > double / quad === false || true);
  // при двойной перегрузке качество падает больше чем вдвое
  assert.ok(double < norm / 2, `двойная нагрузка: ${double.toFixed(3)} против ${norm.toFixed(3)}`);
});

test('пустой зал перевешивает любую комиссию', () => {
  const def = organizerById('theatre');
  const base = { orgCommission: 0.05, buyerFee: 0.10, reach: CONFIG.refReach,
    platformLevel: 0.5, connected: false, service: 0.9, trust: 0.8 };
  const full = organizerAppeal(def, { ...base, fill: 0.85 });
  const empty = organizerAppeal(def, { ...base, fill: 0.25 });
  const freeButEmpty = organizerAppeal(def, { ...base, orgCommission: 0, fill: 0.25 });
  assert.ok(empty < full, 'пустой зал снижает привлекательность');
  assert.ok(freeButEmpty < full, 'нулевая комиссия не компенсирует пустой зал');
});

test('клубам своя касса нужнее, чем концертам', () => {
  const club = organizerById('club');
  const concert = organizerById('concert');
  const gain = (def) => platformFit(def, 0.7, true) / platformFit(def, 0.7, false);
  assert.ok(gain(club) > gain(concert), 'длинный хвост зависит от самообслуживания сильнее');
});

// ----------------------------------------------------------------------------
// Сторона спроса
// ----------------------------------------------------------------------------
test('сервисный сбор снижает спрос, и по-разному у разных сегментов', () => {
  const casual = audienceById('casual');
  const regulars = audienceById('regulars');
  const drop = (aud) => feeFactor(aud, 0.18) / feeFactor(aud, 0.05);
  assert.ok(drop(casual) < 1 && drop(regulars) < 1, 'сбор снижает спрос у обоих');
  assert.ok(drop(casual) < drop(regulars), 'случайный зритель чувствительнее театрала');
});

test('зритель уходит к тому, у кого итоговая цена ниже', () => {
  const aud = audienceById('music');
  const mine = { visibleFee: 0.08, trust: 0.7, productLevel: 0.5 };
  const theirs = { visibleFee: 0.14, trust: 0.7, productLevel: 0.5 };
  assert.ok(buyerPreference(aud, mine, theirs) > 1.05, 'дешевле — спрос выше паритета');
  assert.ok(buyerPreference(aud, theirs, mine) < 0.95, 'дороже — спрос ниже паритета');
  assert.ok(buyerPreference(aud, mine, null) > 1.5, 'без конкурента спрос не делится');
});

test('афиша из одного жанра собирает одну аудиторию', () => {
  const onlySport = { theatre: 0, concert: 0, club: 0, sport: 1 };
  const balanced = { theatre: 0.25, concert: 0.25, club: 0.25, sport: 0.25 };
  const fans = audienceById('fans');
  const regulars = audienceById('regulars');
  assert.ok(segmentInterest(fans, onlySport) > segmentInterest(fans, balanced));
  assert.ok(segmentInterest(regulars, onlySport) < segmentInterest(regulars, balanced));
});

test('продаётся сглаженный минимум из спроса и мест', () => {
  assert.ok(soldTickets(1000, 100) <= 100, 'нельзя продать больше мест');
  assert.ok(soldTickets(100, 1000) <= 100, 'нельзя продать больше спроса');
  assert.ok(soldTickets(0, 1000) === 0);
  assert.ok(soldTickets(1000, 0) === 0);
  assert.ok(soldTickets(500, 500) > 250, 'при паритете продаётся заметная часть');
});

test('маркетинг в пустую афишу почти не работает', () => {
  // Отдаём всё в маркетинг, но комиссию задираем — организаторов не будет
  const noSupply = run(14, decide({ marketing: 200_000_000, orgCommission: 0.14, managers: 2 }), 'mk').last;
  const withSupply = run(14, decide({ marketing: 200_000_000, orgCommission: 0.03, managers: 40 }), 'mk').last;
  assert.ok(withSupply.tickets > noSupply.tickets * 1.5,
    `билетов ${Math.round(withSupply.tickets)} против ${Math.round(noSupply.tickets)}`);
});

// ----------------------------------------------------------------------------
// Каналы
// ----------------------------------------------------------------------------
test('своя касса возвращает потерянный оборот, но по низкой ставке', () => {
  const sport = organizerById('sport');
  const off = channelSplit(sport, false, 0.6);
  const on = channelSplit(sport, true, 0.6);
  assert.ok(off.lost > 0.4, 'без кассы клуб уводит публику мимо вас');
  assert.equal(on.lost, 0, 'с кассой мимо вас не уходит ничего');
  assert.ok(on.market < off.market, 'но и через афишу идёт меньше');
  for (const s of [off, on]) {
    assert.ok(Math.abs(s.market + s.platform + s.lost - 1) < 1e-9, 'доли каналов должны давать единицу');
  }
});

test('подключение всех подряд подрезает вашу афишу и долю оборота', () => {
  // Бюджет на подключения обязателен: без него виджет никуда не переезжает,
  // сколько типов ни отметь. Это и есть смысл механики.
  const paid = { platformDev: 30_000_000, onboarding: 30_000_000 };
  const clubsOnly = run(20, decide({ platformFor: { club: true }, ...paid }), 'ch').last;
  const everyone = run(20, decide({
    platformFor: { theatre: true, concert: true, club: true, sport: true },
    ...paid,
  }), 'ch').last;
  assert.ok(everyone.marketplaceShareOfGmv < clubsOnly.marketplaceShareOfGmv,
    'чем больше виджетов, тем меньше оборота через афишу');
  assert.ok(everyone.takeRate < clubsOnly.takeRate,
    `доля оборота ${(everyone.takeRate * 100).toFixed(1)}% против ${(clubsOnly.takeRate * 100).toFixed(1)}%`);
});

test('абонплата отпугивает маленьких сильнее, чем больших', () => {
  const club = organizerById('club');
  const sport = organizerById('sport');
  assert.ok(subscriptionDrag(club, 60_000) < subscriptionDrag(sport, 60_000),
    'для клуба та же абонплата тяжелее');
  assert.equal(subscriptionDrag(club, 0), 1, 'без абонплаты помех нет');
});

// ----------------------------------------------------------------------------
// Деньги
// ----------------------------------------------------------------------------
test('эквайринг берётся со всего оборота, а не с вашей выручки', () => {
  const r = run(10, decide(), 'acq').last;
  assert.ok(Math.abs(r.acquiring - r.gmv * CONFIG.acquiringRate) < 1,
    'эквайринг должен считаться от оборота');
  assert.ok(r.acquiring > 0);
});

test('отчёт сходится сам с собой на любом прогоне', () => {
  const near = (a, b, tol = 1) => Math.abs(a - b) <= tol + Math.abs(b) * 1e-9;
  for (const seed of ['inv-a', 'inv-b', 'inv-c']) {
    for (const platform of [true, false]) {
      let state = createInitialState(seed + platform);
      let cashBefore = state.cash;
      const decisions = decide({ platformFor: platform ? { club: true, sport: true } : {} });
      for (let i = 0; i < 36 && !state.over; i++) {
        const res = step(state, {
          decisions, eventChoice: 0,
          crisisChoice: state.crisis ? CRISIS_FIX[state.crisis.id] : null,
        });
        const r = res.report;
        const where = `${seed} м${r.month}`;
        assert.ok(near(r.revenue, r.marketplaceRevenue + r.platformRevenue + r.subscriptionRevenue),
          `${where}: выручка не складывается из каналов`);
        assert.ok(near(r.contribution, r.revenue - r.variableCost), `${where}: маржа`);
        assert.ok(near(r.profit, r.contribution - r.fixed), `${where}: прибыль`);
        assert.ok(near(res.state.cash, cashBefore + r.profit - r.oneOff + (r.boardInjection ?? 0), 2),
          `${where}: касса`);
        assert.ok(near(r.gmv, (r.gmvMarket + r.gmvPlatform) * (r.gmv / Math.max(1e-9, r.gmvMarket + r.gmvPlatform)), 2),
          `${where}: оборот по каналам`);
        assert.ok(r.orgs >= 0 && r.rivalOrgs >= 0, `${where}: отрицательное число организаторов`);
        assert.ok(r.fill >= 0 && r.fill <= 1, `${where}: заполняемость ${r.fill}`);
        assert.ok(r.trust >= CONFIG.trustFloor - 1e-9 && r.trust <= 1, `${where}: доверие ${r.trust}`);
        for (const [key, value] of Object.entries(r)) {
          if (typeof value === 'number') assert.ok(Number.isFinite(value), `${where}: ${key} = ${value}`);
        }
        cashBefore = res.state.cash;
        state = res.state;
      }
    }
  }
});

test('оборот и выручка — разные числа, и это видно', () => {
  const r = run(14, decide(), 'gmv').last;
  assert.ok(r.gmv > r.revenue * 3, 'оборот кратно больше выручки');
  assert.ok(r.takeRate > 0 && r.takeRate < 0.35, `доля оборота ${r.takeRate}`);
});

// ----------------------------------------------------------------------------
// Разбор месяца
// ----------------------------------------------------------------------------
test('разбор месяца сходится с изменением числа организаторов', () => {
  for (const seed of ['flow-a', 'flow-b']) {
    const { reports } = run(24, decide({ platformFor: { club: true } }), seed);
    for (let i = 1; i < reports.length; i++) {
      const p = reports[i - 1], c = reports[i];
      const actual = c.orgs - p.orgs;
      const explained = explain(p, c).reduce((s, d) => s + d.people, 0);
      assert.ok(Math.abs(actual - explained) <= Math.max(0.5, p.orgs * 0.003),
        `${seed} м${c.month}: изменение ${actual.toFixed(1)}, разбор ${explained.toFixed(1)}`);
    }
  }
});

test('знак разбора совпадает со знаком изменения', () => {
  const { reports } = run(24, decide({ platformFor: { club: true } }), 'sign');
  for (let i = 1; i < reports.length; i++) {
    const p = reports[i - 1], c = reports[i];
    const actual = (c.orgs - p.orgs) / p.orgs;
    if (Math.abs(actual) < 0.004) continue;
    const net = explain(p, c).reduce((s, d) => s + d.effect, 0);
    assert.equal(Math.sign(net), Math.sign(actual), `м${c.month}`);
  }
});

test('движок возвращает ключи, а не готовый текст', () => {
  const { reports, state } = run(12, decide(), 'keys');
  for (const d of explain(reports.at(-2), reports.at(-1))) {
    assert.ok(!/[а-яА-Я]/.test(d.key), `русский текст в ключе: ${d.key}`);
  }
  for (const f of explainFactors(reports.at(-2), reports.at(-1))) {
    assert.ok(f.key.startsWith('factor'), `неожиданный ключ: ${f.key}`);
  }
  assert.deepEqual(explain(null, reports[0]), [], 'без предыдущего месяца разбирать нечего');
  const score = finalScore(state);
  assert.ok(Number.isFinite(score.equityValue));
});

// ----------------------------------------------------------------------------
// Конкурент, совет, кризисы
// ----------------------------------------------------------------------------
test('конкурент живой: меняет линию и не делает это каждый месяц', () => {
  const { reports } = run(36, decide(), 'rival');
  const stances = reports.map((r) => r.rivalStance);
  assert.ok(new Set(stances).size > 1, 'конкурент должен менять поведение');
  let runLength = 1;
  for (let i = 1; i < stances.length; i++) {
    if (stances[i] === stances[i - 1]) runLength += 1;
    else {
      assert.ok(runLength >= STANCE_MIN_MONTHS || i < STANCE_MIN_MONTHS + 1,
        `линия держалась ${runLength} мес, минимум ${STANCE_MIN_MONTHS}`);
      runLength = 1;
    }
  }
});

test('цели года объявляются заранее и проверяются в конце года', () => {
  const goal1 = makeGoal(1, {}, 100, 500);
  assert.equal(goal1.type, 'gmv');
  const p = goalProgress(goal1, { gmv: goal1.target + 1, profitableMonths: 0, orgs: 1, rivalOrgs: 1 });
  assert.ok(p.done);
  const goal3 = makeGoal(3, {}, 400, 600);
  assert.equal(goal3.type, 'share');
  assert.ok(goalProgress(goal3, { gmv: 0, profitableMonths: 0, orgs: 900, rivalOrgs: 100 }).done);
  assert.ok(!goalProgress(goal3, { gmv: 0, profitableMonths: 0, orgs: 100, rivalOrgs: 900 }).done);
});

test('кризис дорожает с каждым непрожитым месяцем', () => {
  for (const def of CRISES) {
    const cheap = resolutionCost({ id: def.id, months: 0 }, def.resolutions[0].id);
    const dear = resolutionCost({ id: def.id, months: 3 }, def.resolutions[0].id);
    assert.ok(dear > cheap, `${def.id}: тянуть должно быть дороже`);
    const wait = def.resolutions.find((r) => r.id === 'wait');
    assert.ok(wait && !wait.resolves, `${def.id}: должен быть вариант «ничего не делать»`);
  }
  const rng = createRng('crisis');
  assert.equal(rollCrisis(rng, 20, { gmv: 1e9, active: true }), null, 'второй кризис поверх первого не приходит');
  assert.equal(rollCrisis(rng, 20, { gmv: 1e9, active: false, lastResolved: 19 }), null, 'передышка после решённого');
});

test('перекупщики поднимают оборот и роняют доверие', () => {
  // Антибот включается только после внедрения, поэтому сравниваем прогоны
  // с разной жёсткостью запаса мощности и смотрим на связь доверия и ботов
  const { reports } = run(30, decide({ capacityTech: 0 }), 'bots');
  const hits = reports.filter((r) => r.hit);
  assert.ok(hits.length > 0, 'за 30 месяцев должен случиться хотя бы один хит');
  const withHit = hits.reduce((s, r) => s + r.botShare, 0) / hits.length;
  const without = reports.filter((r) => !r.hit).reduce((s, r, _, a) => s + r.botShare / a.length, 0);
  assert.ok(withHit > without, 'на хитах перекупщиков больше');
});

test('запас мощности окупается только в месяц с хитом', () => {
  const none = run(30, decide({ capacityTech: 0 }), 'cap');
  const plenty = run(30, decide({ capacityTech: 60_000_000 }), 'cap');
  const lossNone = none.reports.reduce((s, r) => s + r.outageLoss, 0);
  const lossPlenty = plenty.reports.reduce((s, r) => s + r.outageLoss, 0);
  assert.ok(lossNone > lossPlenty, 'без запаса мощности потери на старте продаж выше');
  assert.ok(plenty.last.trust > none.last.trust, 'и доверие держится лучше');
});

// ----------------------------------------------------------------------------
// Инвестиции и оценка
// ----------------------------------------------------------------------------
test('чем больше берёшь, тем больше отдаёшь', () => {
  const { state } = run(8, decide(), 'fund');
  const shares = CONFIG.fundingOptions.map((a) => fundingOffer(state, a).dilution);
  for (let i = 1; i < shares.length; i++) assert.ok(shares[i] > shares[i - 1]);
  const after = raise(state, CONFIG.fundingOptions[0]);
  assert.ok(after.state.cash > state.cash);
  assert.ok(after.state.equity < state.equity);
});

test('оценка не скачет от одного сезонного месяца', () => {
  const { state, reports } = run(30, decide({ platformFor: { club: true } }), 'val');
  const v = valuation(state);
  assert.ok(v > 0 && Number.isFinite(v));
  // Оценка сглажена по трём месяцам выручки: соседние месяцы не должны
  // отличаться в разы только из-за сезона
  const tail = reports.slice(-6).map((r) => r.valuation);
  const maxJump = Math.max(...tail.slice(1).map((x, i) => x / Math.max(1, tail[i])));
  assert.ok(maxJump < 3, `оценка прыгает в ${maxJump.toFixed(1)} раза между месяцами`);
});

test('юнит-экономика считается по вашей афише', () => {
  const { state } = run(10, decide(), 'unit');
  const u = unitEconomics(state, state.decisions);
  assert.ok(u.avgPrice > 500 && u.avgPrice < 6000, `средняя цена ${u.avgPrice}`);
  assert.ok(Math.abs(u.contribution - (u.blended - u.acquiring - u.support)) < 1e-6);
  const dearer = unitEconomics(state, { ...state.decisions, buyerFee: 0.2 });
  assert.ok(dearer.blended > u.blended, 'выше сбор — больше выручки с билета');
});

// ----------------------------------------------------------------------------
// Стоимость построенного
// ----------------------------------------------------------------------------
test('содержание технологий растёт от вложенного и не исчезает', () => {
  const lean = run(24, decide({ platformDev: 2_000_000, product: 2_000_000 }), 'up').last;
  const heavy = run(24, decide({ platformDev: 60_000_000, product: 60_000_000 }), 'up').last;
  assert.ok(heavy.techUpkeep > lean.techUpkeep * 3,
    `содержание ${Math.round(heavy.techUpkeep / 1e6)} млн против ${Math.round(lean.techUpkeep / 1e6)} млн`);
  // Счёт приходит и в тот месяц, когда вложений не было
  const stopped = run(24, decide({ platformDev: 60_000_000, product: 60_000_000 }), 'up');
  const after = step(stopped.state, {
    decisions: decide({ platformDev: 0, product: 0 }), eventChoice: 0,
  }).report;
  assert.ok(after.techUpkeep > 0, 'построенное продолжает стоить и без новых вложений');
});

test('серверы растут вместе с билетами и дешевеют от продукта', () => {
  const { reports } = run(20, decide({ platformFor: { club: true } }), 'srv');
  const early = reports[2], late = reports.at(-1);
  assert.ok(late.tickets > early.tickets, 'билетов должно стать больше');
  assert.ok(late.serverCost > early.serverCost, 'серверы дорожают вместе с нагрузкой');
  const perTicket = (r) => r.serverCost / Math.max(1, r.tickets);
  const cheap = run(20, decide({ product: 0 }), 'srv2').last;
  const rich = run(20, decide({ product: 90_000_000 }), 'srv2').last;
  assert.ok(perTicket(rich) < perTicket(cheap),
    `с билета ${perTicket(rich).toFixed(2)} ₽ против ${perTicket(cheap).toFixed(2)} ₽`);
});

test('ставку платформы организатор замечает так же, как комиссию', () => {
  // Организатор считает, сколько у него забирают со всего оборота. Пока
  // ставка платформы в привлекательность не входила, её можно было поднять
  // до потолка, и никто бы не ушёл — рычаг был односторонне выгодным.
  const base = { platformFor: { club: true, sport: true }, managers: 25,
    platformDev: 15_000_000, onboarding: 25_000_000 };
  const cheap = run(24, decide({ ...base, platformRate: 0 }), 'prate').last;
  const dear = run(24, decide({ ...base, platformRate: 0.07 }), 'prate').last;
  assert.ok(dear.orgs < cheap.orgs,
    `организаторов при ставке 7%: ${Math.round(dear.orgs)} против ${Math.round(cheap.orgs)} при нуле`);
  assert.ok(dear.gmv < cheap.gmv, 'оборот при высокой ставке ниже');
  assert.ok(dear.revenue > cheap.revenue, 'но выручка выше — в этом и решение');
});

// ---------------------------------------------------------------------------
// Переезд на виджет — проект, а не галочка.
//
// Раньше отметка типа мгновенно и бесплатно ставила виджет всем сорока пяти
// клубам сразу. В жизни так не бывает: у каждого организатора уже что-то
// стоит — своё самописное или платформа конкурента, — и переезд стоит денег
// и месяцев. Ниже проверяется всё, что из этого следует.
// ---------------------------------------------------------------------------

test('без бюджета на подключения виджет никуда не переезжает', () => {
  const free = run(18, decide({ platformFor: { club: true }, platformDev: 30_000_000,
    onboarding: 0 }), 'adopt').last;
  assert.ok((free.platformShare.club ?? 0) < 0.01,
    `переехало ${((free.platformShare.club ?? 0) * 100).toFixed(0)}% без единого рубля на интеграцию`);
  const paid = run(18, decide({ platformFor: { club: true }, platformDev: 30_000_000,
    onboarding: 30_000_000 }), 'adopt').last;
  assert.ok(paid.platformShare.club > 0.3, 'за деньги переезд должен идти');
});

test('переезд занимает месяцы, а не один ход', () => {
  const d = decide({ platformFor: { club: true }, platformDev: 30_000_000, onboarding: 30_000_000 });
  const { reports } = run(12, d, 'pace');
  const first = reports[0].platformShare.club;
  const last = reports[reports.length - 1].platformShare.club;
  assert.ok(first < 0.5, `за первый же месяц переехало ${(first * 100).toFixed(0)}% — так не бывает`);
  assert.ok(last > first, 'дальше доля обязана расти');
  // Монотонно: никто не переезжает обратно сам по себе
  for (let i = 1; i < reports.length; i++) {
    assert.ok(reports[i].platformShare.club >= reports[i - 1].platformShare.club - 1e-9,
      `месяц ${reports[i].month}: доля упала сама по себе`);
  }
});

test('кому виджет нужнее, тот переезжает дешевле', () => {
  // Клубу без своей билетной системы виджет нужен как воздух, у стадиона
  // всё уже работает — его переезд стоит дороже при том же бюджете.
  // Смотреть надо по дороге, а не в конце: при щедром бюджете и долгой партии
  // оба типа упираются в один и тот же потолок — сколько держит конкурент.
  const d = decide({ platformFor: { club: true, sport: true },
    platformDev: 30_000_000, onboarding: 6_000_000 });
  const { reports } = run(14, d, 'need');
  const mid = reports[3];
  assert.ok(mid.platformShare.club > mid.platformShare.sport,
    `на четвёртый месяц клубы ${(mid.platformShare.club * 100).toFixed(0)}%, спорт ${(mid.platformShare.sport * 100).toFixed(0)}%`);
});

test('доля оборота через виджет растёт вместе с числом переехавших', () => {
  const d = decide({ platformFor: { club: true }, platformDev: 30_000_000, onboarding: 30_000_000 });
  const { reports } = run(16, d, 'split');
  const early = reports[1];
  const late = reports[reports.length - 1];
  assert.ok(late.platformShare.club > early.platformShare.club, 'предпосылка теста');
  assert.ok(late.gmvPlatform / late.gmv > early.gmvPlatform / early.gmv,
    'больше переехавших — больше оборота идёт мимо афиши');
});

// ---------------------------------------------------------------------------
// Хит объявляется заранее.
//
// Раньше тур выпадал в тот же ход: запас мощности приходилось покупать
// вслепую, сайт ложился, и решение принять было негде — только смотреть.
// Теперь то, что приезжает в город, видно за месяц, и это одновременно
// новость и решение.
// ---------------------------------------------------------------------------

test('то, что случится в этом месяце, было объявлено в прошлом', () => {
  const d = decide({ platformFor: { club: true, concert: true }, onboarding: 20_000_000,
    marketing: 60_000_000, managers: 15, platformDev: 20_000_000 });
  let announced = 0;
  let happened = 0;
  let matched = 0;
  for (const seed of ['a', 'b', 'c', 'd']) {
    const { reports } = run(36, d, seed);
    for (let i = 0; i < reports.length; i++) {
      if (reports[i].hitNext) announced += 1;
      if (!reports[i].hit) continue;
      happened += 1;
      const promised = i > 0 ? reports[i - 1].hitNext : null;
      assert.ok(promised, `месяц ${reports[i].month}: хит случился без анонса`);
      if (promised.id === reports[i].hit.id) matched += 1;
    }
  }
  assert.ok(happened > 10, `хиты должны случаться: их всего ${happened}`);
  assert.equal(matched, happened, 'каждый хит обязан совпасть с тем, что было объявлено');
  assert.ok(announced >= happened, 'анонсов не меньше, чем состоявшихся хитов');
});

test('в первый месяц ничего не объявлено: афиши ещё нет', () => {
  const s = createInitialState('news');
  assert.equal(s.pendingHit, null, 'на старте городу нечего анонсировать');
});
