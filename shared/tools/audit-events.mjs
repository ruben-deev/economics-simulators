// Доминация в событиях: для каждого события с выбором прогоняем обе ветки на
// одних и тех же кодах и двумя политиками в трёх сроках. Если один вариант
// выигрывает больше чем в 80% партий — это не решение, а викторина с известным
// ответом.
//
// Запуск: node shared/tools/audit-events.mjs
//
// Важно: событие нельзя форсировать раньше его собственного срока (minMonth /
// minWeek) — получится состояние, которого в игре не бывает, и вердикт будет
// вынесен о нём. Фильтр по сроку в скрипте уже стоит, не снимайте его.
//
// Известные исключения, которые доминируют ЗАМЫСЛОМ: три престижные траты
// (vanity_*) — единственное семейство, где правильный ответ известен заранее.
const R = new URL('../../games', import.meta.url).pathname;
const q = (a, p) => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * p)];

const GAMES = [
  { name: 'НОВОЕДА', dir: 'foodtech', turns: (C) => C.weeksTotal, forceAt: [8, 20, 34],
    policies: {
      скупая: (C, cfg) => (s) => ({ ...cfg.DEFAULT_DECISIONS, districts: cfg.DISTRICTS.filter((d) => d.city === 'novograd').slice(0, 2).map((d) => d.id), deliveryFee: 169, courierPay: 175, targetCouriers: s.week >= 8 ? 320 : 200, marketing: 500e3, sales: 250e3, tech: 300e3 }),
      щедрая: (C, cfg) => (s) => ({ ...cfg.DEFAULT_DECISIONS, districts: cfg.DISTRICTS.filter((d) => d.city === 'novograd').slice(0, 4).map((d) => d.id), deliveryFee: 129, courierPay: 195, targetCouriers: s.week >= 8 ? 800 : 450, marketing: 1.4e6, sales: 450e3, tech: 800e3 }),
    },
    cushion: 60e6, minTurn: (C) => C.minWeekForFunding, turnOf: (s) => s.week },
  { name: 'НОВОГРАД', dir: 'ecosystem', turns: (C) => C.monthsTotal, forceAt: [8, 16, 26],
    policies: {
      'одна вертикаль': (C, cfg) => () => ({ ...cfg.DEFAULT_DECISIONS, verticals: [], foodTake: 1.06, foodOps: 5e6, foodMarketing: 3e6, finance: 3e6 }),
      экосистема: (C, cfg) => (s) => ({ ...cfg.DEFAULT_DECISIONS, verticals: ['taxi', ...(s.month + 1 >= 12 ? ['ecom'] : []), ...(s.taxi.on && s.month + 1 >= 8 ? ['plus'] : [])], foodOps: 4e6, foodMarketing: 2e6, crossSell: 5e6, mgmt: 8e6, taxiSupply: 9e6, taxiMarketing: 14e6, ecomOps: 2e6, ecomMarketing: 6e6, ecomLogistics: 3e6, finance: 3e6 }),
    },
    cushion: 200e6, minTurn: (C) => C.minMonthForFunding, turnOf: (s) => s.month },
];
const SEEDS = Array.from({ length: 12 }, (_, i) => `дом-${i + 1}`);
const found = [];

for (const g of GAMES) {
  const eng = await import(`${R}/${g.dir}/src/model/engine.js`);
  const cfg = await import(`${R}/${g.dir}/src/model/config.js`);
  const evs = await import(`${R}/${g.dir}/src/model/events.js`);
  const C = cfg.CONFIG;
  const pool = [...(evs.EVENTS ?? []), ...(evs.VANITY_EVENTS ?? [])].filter((e) => e.options?.length === 2);
  console.log(`\n=== ${g.name}: ${pool.length} событий с выбором ===`);

  for (const ev of pool) {
    const rows = [];
    for (const [pname, mk] of Object.entries(g.policies)) {
      const policy = mk(C, cfg);
      // Форсировать событие раньше его собственного срока нельзя: получится
      // состояние, которого в игре не бывает, и вердикт будет о нём
      const gate = ev.minMonth ?? ev.minWeek ?? 0;
      const ats = g.forceAt.filter((x) => x >= gate);
      if (!ats.length) continue;
      for (const at of ats) {
        const play = (choice) => SEEDS.map((seed) => {
          let s = eng.createInitialState(seed);
          for (let i = 0; i < g.turns(C) && !s.over; i++) {
            if (g.turnOf(s) >= g.minTurn(C) && s.cash < g.cushion) s = eng.raise(s, C.fundingOptions[1]).state;
            const forced = g.turnOf(s) + 1 === at;
            const st = forced ? { ...s, pendingEvent: ev } : s;
            s = eng.step(st, { decisions: policy(s), eventChoice: forced ? choice : 0 }).state;
          }
          const f = eng.finalScore(s);
          return f.bankrupt ? 0 : f.equityValue;
        });
        const a = play(0); const b = play(1);
        const winsA = a.filter((v, i) => v > b[i]).length;
        rows.push({ pname, at, winsA, n: a.length, medA: q(a, 0.5), medB: q(b, 0.5) });
      }
    }
    if (!rows.length) { console.log(`${ev.id.padEnd(18)} пропущено: срок события позже всех точек замера`); continue; }
    const total = rows.reduce((s, r) => s + r.n, 0);
    const winsA = rows.reduce((s, r) => s + r.winsA, 0);
    const share = winsA / total;
    const verdict = share > 0.8 ? 'ДОМИНИРУЕТ вариант 1' : share < 0.2 ? 'ДОМИНИРУЕТ вариант 2' : 'решение';
    console.log(`${ev.id.padEnd(18)} вариант 1 выигрывает ${winsA}/${total} → ${verdict}`);
    if (share > 0.8 || share < 0.2) {
      found.push(`${g.name} · ${ev.id}: ${(share * 100).toFixed(0)}% побед у одного варианта`);
    }
  }
}
console.log('\n=== ПОДОЗРИТЕЛЬНЫЕ ===');
if (!found.length) console.log('нет');
for (const f of found) console.log('•', f);
