# NOVOEDA — a food delivery economics simulator

*[Русская версия](README.md)*

A browser-based teaching game. You run a food delivery service in the fictional city of
Novograd. Each turn is one week. You move the levers of the business and watch how they
travel through a model of demand, supply and money.

The game is built first and foremost as a **teaching tool**: winning matters less than
seeing *why* a decision leads to the consequence it does. That is why the interface
breaks every week down into contributing factors, shows a live unit economics table,
a weekly P&L, and the formulas behind all of it.

The interface is bilingual — use the **RU / EN** button in the header. The choice is
remembered between sessions.

## Quick start

Option 1 — a single file, nothing to install:

```
node tools/build.js
```

then open `dist/game.html` by double-clicking it. The file is self-contained: it works
offline, with no network and no build tooling. (A built copy is already in the repository.)

Option 2 — with a local server (needed for development, since ES modules do not load
over `file://`):

```
npm start          # http://localhost:8080
```

Model tests:

```
npm test
```

## What you control

| Lever | What it does | The other side of it |
|---|---|---|
| Delivery fee | direct revenue on every order | demand is elastic, brutally so on campus |
| Restaurant commission | your main revenue source | too high and restaurants leave, taking selection with them |
| Courier pay per order | your largest variable cost | below market, nobody comes out for a shift |
| Target courier headcount | delivery capacity | you can only hire as many as apply |
| Marketing | awareness, and through it new customers | diminishing returns, and awareness decays |
| Promo discount | an instant lift in demand | a direct deduction from contribution |
| Bad-weather bonus | keeps couriers on the road in a storm | a conditional cost: nothing when the sky is clear |
| Restaurant acquisition | selection | costs money every single week |
| Technology | courier productivity, speed, support cost | cumulative, and slow to pay back |
| Data science | algorithm quality | worthless without data, and data only comes from orders |
| City coverage | 6 districts with different economics | one-off launch cost plus permanent running cost |
| Funding rounds | money for growth | dilution of your stake |

## What is modelled

* **Demand** — a customer base (a stock) × order frequency (a flow). Frequency depends on
  price, delivery speed, selection, season and weather.
* **Supply** — courier capacity. Above 90% utilisation, delivery time grows like an
  avalanche (a cubic function of utilisation).
* **The labour market** — couriers only apply when earnings beat the market rate; they
  leave when underpaid or overloaded.
* **Restaurants** — signed up by your sales team, lost to high commission and thin order flow.
* **Money** — a weekly P&L that separates variable from fixed costs, a cash balance,
  and bankruptcy at zero.
* **Weather** — a permanent weekly factor drawn by season.
* **Events** — 11 random events, several of which require a decision.
* **Valuation** — annual revenue × a multiple driven by growth and margin.
  Final score = valuation × your stake.

## Weather

Weather is not a rare event; it is the background of every week. It is drawn from a
seasonal table: ice only in winter, heat only in summer. The effect always cuts both ways:

| Weather | Demand | Courier capacity | Courier churn |
|---|---|---|---|
| Clear | — | — | — |
| Rain | +16% | −8% | +4 pp |
| Hard frost | +14% | −12% | +7 pp |
| Snow | +22% | −18% | +9 pp |
| Heatwave | +4% | −14% | +10 pp |
| Ice | +10% | −26% | +16 pp |
| Storm | +30% | −20% | +12 pp |

**Next week's forecast is public** — a weather report is available to everyone. The value
is not in the information but in the reaction: couriers hired today go on the road exactly
in the week the forecast covers. The demand forecasting algorithm does this automatically;
by hand it is possible too, it just takes attention.

**The bad-weather bonus** is a conditional cost. It is paid in proportion to how severe
the weather is, and only for the part of the week it actually lasts, so in clear weeks it
costs nothing. In exchange it recovers up to 70% of the abandoned shifts and holds couriers
in place. It pays off with a thin roster and loses to simply keeping spare capacity — two
competing ways to buy reliability.

## Algorithms: second-order optimisation

A slider sets a **number** ("delivery fee = ₽149"). An algorithm sets a **rule**
("price = f(utilisation)"), and a rule can be different in different circumstances — which
is why it can improve both ends of a trade-off a single number cannot resolve.

Algorithms unlock as quality grows: `quality = √(data × team)`. Data accumulates only from
completed orders; the team comes from your data science budget. Neither half works alone.

| Algorithm | What it does | What you pay |
|---|---|---|
| Order batching | one courier carries several orders per trip | every order takes longer |
| Demand forecast and auto-hiring | headcount sized against the forecast and a target utilisation | forecast error, and loss of manual control |
| Targeted discounts | the discount goes only to customers who need it to order | model misfires and a sense of unfairness |
| Surge pricing | a premium at peak hours, flattening the peak load | customers hate an unpredictable price |
| Smart courier allocation | priority to districts with higher contribution | service in the other districts degrades |
| Flexible commission | per-partner rates for restaurants | part of your commission revenue |

The Algorithms tab shows a **counterfactual breakdown**: last week is re-simulated with the
algorithm switched off, revealing what it actually earned. Often the answer is zero — surge
is useless without congestion, allocation without a courier shortage, and forecasting if you
already size the team correctly.

Full formulas and assumptions: [docs/en/economics.md](docs/en/economics.md).
Lesson plans and debrief questions: [docs/en/teacher-guide.md](docs/en/teacher-guide.md).

## Project layout

```
index.html              game markup
src/styles.css          styling
src/i18n.js             translations and the t()/tx() helpers
src/model/config.js     ALL world parameters: districts, constants, levers, algorithms
src/model/weather.js    weather: seasonal tables and effects
src/model/engine.js     the simulation core — pure functions, no DOM
src/model/events.js     random events
src/model/rng.js        deterministic PRNG (a game replays exactly from its seed)
src/ui/                 interface: levers, charts, reports
tests/engine.test.mjs   model tests (49 checks)
tools/build.js          bundles dist/game.html into a single file
tools/serve.js          local static server
```

All the economics lives in `src/model`. Those modules know nothing about the browser, so
they can be run in tests, in scripts, and used to build sensitivity charts.

Text in the model is stored as `{ ru, en }` pairs so the original and the translation sit
side by side and neither can be lost silently.

## Tuning the balance for your course

Every number lives in `src/model/config.js`: starting capital, district launch costs, the
market wage for couriers, elasticities, customer churn and so on. You can change them
without touching the logic. After editing, run `npm test` — the tests check qualitative
properties of the model (monotonic responses, P&L consistency, no NaNs) rather than specific
numbers, so they survive rebalancing.

## Limits of the model

This is a teaching model, not a forecasting tool. The competitor does not react to you,
restaurants do not negotiate individually, customers are homogeneous within a district,
and all of logistics is compressed into a single "orders per courier" figure. The model
exists to show the **structure** of the dependencies in a food delivery business, not to
predict a real market.
