# Novograd Business Simulators

*[Русская версия](README.md)* · made by **[Ruben Deev](https://www.linkedin.com/in/ruben-deev)**

**▶ [Open the games index](https://ruben-deev.github.io/economics-simulators/)**

Four browser games about running a business. Each is one turn per period, a dozen levers and
a clear reason you can go bust. They exist first of all as **teaching tools**: the point is
not to win but to see why decisions lead to exactly these consequences. That is why the
interface carries a per-turn breakdown by factor, a unit economics table, a P&L report and
an explanation of the formulas.

The interface is bilingual — the **RU / EN** button in the header. The choice is remembered
between sessions and shared by all four games.

**Money.** The models are denominated in roubles, and every balance figure in the docs is a
rouble figure. The English interface shows dollars at a fixed rate of **₽100 = $1** — a round
rate on purpose, so the conversion can be done in your head. Only the display changes: the
score written into the world leaderboard stays in roubles, so one table holds one scale
regardless of the language a game was played in.

| Game | Business | Turn | Length | Central conflict |
|---|---|---|---|---|
| [🛵 **NOVOEDA**](https://ruben-deev.github.io/economics-simulators/games/foodtech/) | food delivery | week | 52 weeks | demand against throughput |
| [🎬 **KINOREKA**](https://ruben-deev.github.io/economics-simulators/games/cinema/) | streaming service | month | 36 months | a market war against a living rival |
| [🎟️ **TICKETGRAD**](https://ruben-deev.github.io/economics-simulators/games/tickets/) | ticketing marketplace | month | 36 months | a two-sided market and channel conflict |
| [🏙️ **NOVOGRAD**](https://ruben-deev.github.io/economics-simulators/games/ecosystem/) | service ecosystem | month | 36 months | focus against expansion over a shared customer base |

The games are built the same way but deliberately model **different** kinds of economics:
in delivery, revenue per customer grows with their activity; in subscription it is fixed
while cost grows; in ticketing billions pass through you and yours are the percentages.
The same words — "engagement", "retention", "growth" — mean different things in each.
That is clearest if you play more than one.

> If the links do not open, GitHub Pages has not been enabled in the repository yet:
> Settings → Pages → Source: **GitHub Actions**. After that it is enough to re-run the
> "Deploy games to GitHub Pages" workflow — from then on it publishes on every push.

## Quick start

The easiest route is [opening it in a browser](https://ruben-deev.github.io/economics-simulators/).
Nothing to install.

To hand games out offline, download the single-file build:
[delivery](https://ruben-deev.github.io/economics-simulators/games/foodtech/dist/novoeda-delivery-simulator-v1.24.14.html) ·
[streaming](https://ruben-deev.github.io/economics-simulators/games/cinema/dist/kinoreka-streaming-simulator-v1.30.0.html) ·
[ticketing](https://ruben-deev.github.io/economics-simulators/games/tickets/dist/biletville-ticketing-simulator-v1.33.9.html) ·
[ecosystem](https://ruben-deev.github.io/economics-simulators/games/ecosystem/dist/novograd-ecosystem-simulator-v1.28.0.html).
These are self-contained HTML files: double-click and they run with no network.

**For teachers** there is a ready pack in one archive — the game, the guide in both
languages, the formula write-up and a results-collection template:
[delivery](https://ruben-deev.github.io/economics-simulators/downloads/novoeda-teacher-pack.zip) ·
[streaming](https://ruben-deev.github.io/economics-simulators/downloads/kinoreka-teacher-pack.zip) ·
[ticketing](https://ruben-deev.github.io/economics-simulators/downloads/biletville-teacher-pack.zip) ·
[ecosystem](https://ruben-deev.github.io/economics-simulators/downloads/novograd-teacher-pack.zip).
Packs are rebuilt by `npm run build` (the `shared/tools/teacher-pack.js` step).

**World leaderboard.** Each game's final screen keeps a local per-device record
table — and on the website there is also a global one: the player can submit a
signed result string (with its checksum) and see their rank. The leaderboard
server takes five minutes to deploy on Google Apps Script — see
[`server/README.md`](server/README.md). Offline files contain no server address
and never send anything anywhere.

Locally:

```
npm start          # http://localhost:8080 — the games index
npm test           # model and translation tests for all four games
npm run build      # rebuild the single-file builds in games/*/dist/
```

The built files are already in the repository, so the build step is only needed after edits.

**Releasing a version.** Each game has its own version — the `version` field in its
`build.manifest.js`. They are independent: a change in the streaming game does not
rename the delivery file and pretend it was updated too. `package.json` stays the
version of the monorepo as a whole. The game's number
goes into the built file name (`…-simulator-v1.24.1.html`), into the page itself and into
the help behind the "?" button. Building a version also deletes the previous one from
`dist/`, so there is never a doubt about which file to hand out. Links in the READMEs, on
the index page and in the teacher guides carry the version; if you forget to update them,
`shared/tests/compat.test.mjs` lists every stale one.

**File or link.** The single-file build is meant for a laptop: double-click it and it
runs with no network. On a phone the link is more reliable. The reason is preview mode —
both Quick Look on a Mac and the document viewer in Telegram or another messenger
render HTML but **deliberately do not run JavaScript**. Telegram's built-in browser does
run scripts — the difference is between forwarding a file and sending a link. The game is a computed model;
without scripts only an empty shell is left. The page now explains this itself and says
how to open it in a real browser.
The site can also be **installed on a phone** ("Add to Home Screen"): the installed
index and any game opened at least once keep working offline.

**Important:** `games/<game>/index.html` will not open by double-clicking from a folder —
browsers do not load ES modules over `file://`, neither Safari nor Chrome. To run from
disk use the file in `dist/`; for development use `npm start`. If you do open the modular
version from a folder, the page explains what to do.

**Compatibility.** The baseline is spring-2021 browsers (Safari 14.1, Chrome 90).
Newer APIs that must not reach the code are listed in `shared/tests/compat.test.mjs`
and checked against the built files: one such function turns the game into a blank
page on someone else's machine, with no hint as to why.

---

# 🛵 NOVOEDA — food delivery

You run a food delivery service in the fictional city of Novograd. One turn is a week.

Too few couriers and delivery time rises catastrophically and customers leave. Too many and
you pay for idle time. That is the main loop of the game, and it is not solved by one number.

### What the player controls

| Lever | What it does | The other side |
|---|---|---|
| Delivery fee | direct revenue per order | demand is elastic, especially in the student district |
| Restaurant commission | your main revenue | a high rate scares restaurants off → selection falls |
| Courier pay per order | the main variable cost | below market and nobody takes a shift |
| Target courier headcount | throughput | you can only hire as many as apply |
| Marketing | awareness → new customers | diminishing returns, and awareness decays |
| Promo discount | instant demand | a direct deduction from contribution per order |
| Bad-weather bonus | keeps couriers on the road in a storm | a contingent cost: it costs nothing in clear weather |
| Restaurant onboarding | selection | costs money every week |
| Technology | courier productivity, speed, support | a cumulative investment, slow to pay back |
| Data science | algorithm quality | useless without data, and data only accrues from orders |
| City coverage | 6 districts with different economics | a one-off launch cost plus ongoing upkeep |
| Funding rounds | money for growth | dilution of your stake |

### What is modelled

* **Demand** — the customer base (a stock) × order frequency (a flow) driven by price,
  delivery time, selection and season.
* **Supply** — courier throughput. Above 90% utilisation delivery time grows
  catastrophically (a cubic relationship).
* **Labour market** — couriers only show up if earnings beat the market rate.
* **Restaurants** — onboarded by the sales team, they leave at high commission.
* **Weather** — a permanent weekly factor with a seasonal distribution. It hits from both
  sides at once: it raises demand and cuts throughput.

| Weather | Demand | Courier capacity | Courier churn |
|---|---|---|---|
| Clear | — | — | — |
| Rain | +16% | −12% | +5 pp |
| Frost | +14% | −22% | +9 pp |
| Snow | +22% | −34% | +13 pp |
| Heat | +4% | −24% | +12 pp |
| Ice | +10% | −44% | +21 pp |
| Storm | +30% | −40% | +17 pp |

Next week's forecast is public. The value is not in the information but in the reaction:
couriers hired today go on the road exactly in the week the forecast covers.

### Algorithms

| Algorithm | What it does | What you pay |
|---|---|---|
| Order batching | one courier carries several orders per trip | every order takes longer |
| Demand forecast and auto-hiring | headcount sized against the forecast and a target utilisation | forecast error, and loss of manual control |
| Targeted discounts | the discount goes only to customers who need it to order | model misfires and a sense of unfairness |
| Surge pricing | a premium at peak hours, flattening the peak load | customers hate an unpredictable price |
| Smart courier allocation | priority to districts with higher contribution | service in the other districts degrades |
| Flexible commission | per-partner rates for restaurants | part of your commission revenue |

📘 [Formulas and assumptions](docs/foodtech/en/economics.md) ·
🎓 [Lesson plans](docs/foodtech/en/teacher-guide.md)

---

# 🎬 KINOREKA — a streaming service

You build a streaming service. One turn is a month; a game is three years.

The catalogue can be rented (licences — cheap, immediate, but they expire and rivals have
them too) or produced in-house (fifty times more per hour, premiering in six months, but
yours forever and yours alone). Neither extreme works.

**The environment is non-stationary — there is no constant optimal strategy here.**
The rival is alive: he has his own cash, catalogue and a policy that answers your
decisions. Rights and talent get more expensive as you succeed. The board changes the
goal every year, and the year-two goal directly conflicts with the year-one strategy.
Crises do not resolve themselves. Measured: the best strategy split across three years
beats the best constant setting of the sliders by **85%**.

### What the player controls

| Lever | What it does | The other side |
|---|---|---|
| Price for new sign-ups | your main revenue | the base keeps paying what it signed at; moving them is a separate decision |
| Ad-tier price | brings in people who would not pay otherwise | cannibalises the expensive tier |
| Ad load | a second revenue line | churn rises directly; cinephiles leave first |
| Licensing budget | catalogue immediately | 4.5% expires monthly, rivals have it, and it barely counts as new |
| Studio slots | how many projects run in parallel | a slot costs money even when idle, and upkeep grows faster than the count |
| Annual plan discount | twelve months of cash at once, immune to churn | the price is locked and rises do not apply |
| Partnerships and bundles | the wholesale channel: people arrive cheaply and in thousands | you keep a share of list price, they watch less and leave all at once when the term ends |
| Brand marketing | the steady background of awareness | works slowly and burns for nothing against an empty catalogue |
| Release campaign | multiplies one specific premiere | only works together with a release |
| Free trial | conversion into paying subscribers | a long trial is a gift of free months |
| Streaming quality | less annoyance | bandwidth is the largest variable cost line |
| Technology | cheaper bandwidth, better project quality | a cumulative investment |
| Data science | algorithm quality | useless without viewing |
| Funding rounds | money for growth | dilution of your stake |

### What is modelled

* **The catalogue** — two stocks with different economics: the rented one expires, your own
  stays. An hour of exclusive content retains like a dozen hours of someone else's library.
* **Freshness** — a stock separate from depth. The catalogue can lose not a single hour and
  still lose subscribers, because viewers see the same shelf.
* **The slate** — concrete projects, not a budget. Three decisions each: what to
  commission (genre × scale × segment), when to release it, and how much campaign
  to put behind it. Until the premiere quality is only a range.
* **The vault** — a finished project does not ship itself. Holding until winter
  beats shipping in July: the season enters premiere buzz to the power of 2.2.
  But holding is not free — 4.5% of the buzz evaporates each month.
* **Clickable advice** — the key terms in every hint are links: clicking one scrolls
  to the lever it names, expands its collapsed group and highlights the block.
* **Wholesale against retail** — partnerships with an operator, a bank, a TV maker.
  People arrive cheaply and in thousands, but pay a share of list price, watch less
  and leave all at once when the term ends. Measured: "sign everything" gives more
  subscribers and less money than "sign only the good deals".
* **Two layers of price** — the list price for new sign-ups and what the existing
  base actually pays. The gap builds up quietly and closes painfully: moving the
  base to list price costs subscribers. An annual plan takes a person out of both
  churn and price rises.
* **Four audience segments** — mainstream, cinephiles, families, young viewers. Different
  elasticity, ad tolerance, loyalty and viewing volume.
* **Two tiers** — viewers distribute themselves between them; cutting the cheap tier's price
  poaches people from the expensive one.
* **Watch hours as a cost** — bandwidth grows with loyalty. The most loyal viewer is the
  most expensive one.
* **Post-premiere hangover** — its own stock: the louder the hit, the more people cancel
  once they have finished it.
* **A living rival** — one market for the two of you. He has his own cash, catalogue,
  pipeline and five legible stances, each held for at least four months. He answers your
  price, enters the genre you are strong in, can raise a round — and can go bust.
* **Switching** — you can grow by bringing in new viewers or by taking his. The second is
  faster, and exclusives are the one thing the same money cannot buy him.
* **Escalating resource costs** — rights get dearer when you both bid for them; talent
  gets dearer with your success. The growth flywheel has a brake.
* **Board goals** — one per year: growth, then market share, then profitability. Missing
  one costs equity, a capped budget or valuation.
* **Crises** — a lawsuit, a scandal, a showrunner leaving, platform decay. Every month
  without a decision costs more than the last, and the fix gets dearer too. They arrive
  more often the better you are doing.
* **The rival's line-up** — derived from his real pipeline, known a month in advance,
  and cancelled by your own premiere by no more than 65%.

| Rival stance | When | What he does | Your move |
|---|---|---|---|
| Steady growth | parity | price just under yours | build your catalogue |
| Price war | losing and rich | undercuts 28%, marketing ×1.6 | do not follow him down |
| Pressing | winning | price +6%, budgets ×1.15 | take his viewers |
| Harvesting | cash running low | cuts content, raises price | his catalogue goes stale — attack |
| Retreating | out of money | barely spends | push and the market is yours |

Your own loud premiere in the month of his partly cancels it (by no more than 65%):
viewers choose rather than leave.

### Algorithms

| Algorithm | What it does | What you pay |
|---|---|---|
| Recommendation feed | the perceived catalogue is larger than the real one | with a weak model the feed collapses into a bubble |
| Content demand forecast | the same budget buys the right things | buying drifts towards the already known; depth grows slower |
| Personal retention | the discount goes only to people about to leave | model misses: some who would have stayed get it too |
| Adaptive advertising | the same impressions at less irritation | only works on large data |
| Smart encoding | a cheaper hour of bandwidth | with a weak model the picture degrades |
| Release calendar | the premiere is spread out, churn is smoothed | a lower sign-up peak |

📘 [Formulas and assumptions](docs/cinema/en/economics.md) ·
🎓 [Lesson plans](docs/cinema/en/teacher-guide.md)

---

# 🎟️ TICKETGRAD — ticketing marketplace

You run a ticketing operator. One turn is a month, a game is 36 months, and
the year starts in September with the opening of the season.

This is a **two-sided market**: organisers provide the listings on one side,
buyers buy tickets on the other. Neither side arrives first on its own, and
that is the whole problem. Marketing into empty listings burns entirely; rich
listings without buyers produce empty halls, which is exactly why organisers
leave.

**Three decisions the game is built around.**

**One revenue, two sides.** The buyer pays the service fee on top of the
price; the organiser pays the commission out of theirs. The sum can be
identical and the consequences are not: the fee is visible at checkout and
comparable with the rival, the commission is visible in the contract.
Splitting evenly is the worst option: you subsidise one side — and which one
depends on your channels.

**Channel conflict.** A ticketing widget on the organiser's own site — your
ticket sales under their brand — keeps them from
leaving and recovers turnover that would otherwise pass you by. But sales
through it earn several times less, and those tickets **never appear in your
listings** — so they never build your reach. Give everyone a widget and
you undercut the very audience organisers come to you for. Measured: the
optimum is clubs and concerts, but not theatres and not sport.

**Turnover and revenue are different numbers.** Billions pass through the
service; percentages of it are yours. The 2.2% acquiring fee comes out of
those percentages, not out of the turnover: a 3% take rate minus acquiring is
almost nothing.

Plus a live rival with its own stances, shareholder goals for each year,
crises (resellers, a site that goes down at on-sale, the regulator, a
cancelled tour) and four second-order algorithms — including the one that
lifts conversion at the cost of trust.

🎓 [Class sessions](docs/tickets/en/teacher-guide.md) ·
📘 [Formula write-up](docs/tickets/en/economics.md)

---

# 🏙️ NOVOGRAD — service ecosystem

The endgame of the series. You are the winner of one of the three games above: your
business is compressed into a portfolio line, and the question is no longer "how do we
deliver the order" but "where do we expand". Ride-hailing with a price war against an
entrenched incumbent, e-commerce on shared logistics, the Plus subscription,
partnerships — all over the **shared customer base** of one city. Every new vertical
dilutes management focus, and the holding is valued as a sum of parts — a loss-making
branch with no growth is priced as a liability, not as "an investment".

You can start from any of the three legacy assets, and the ecosystem takes a different
shape each time: delivery brings strong logistics synergy with ride-hailing and
e-commerce, streaming brings the habit of paying by subscription, ticketing brings a
small but monied base and a partner network.

**Meta-progression.** Endgames of the older games grant NOVOGRAD a legacy: brand
awareness, launch discounts on "your" vertical, carried-over cash and valuation. On the
same device they are picked up automatically; from another device, a result string (the
same one used for the leaderboard) can be entered on the welcome screen. A finale counts
from a threshold: ₽0.3B for delivery, ₽1.5B for streaming, ₽1.2B for ticketing. Worthy
finales of all three games plus a worthy NOVOGRAD unlock a hidden reward, the Novograd
Conglomerate — strictly cosmetic: a badge on the final screens, no effect on the older
games' economics or records.

**The conglomerate year.** After the scored finale (36 months) an optional fourth year
opens: the scored result is frozen, the year has its own goal, a new vertical —
scooters — and the outcome goes as a separate row tagged "НОВОГРАД+" into its own
leaderboard.

📘 [Formula write-up](docs/ecosystem/en/economics.md) ·
🎓 [Lesson plans](docs/ecosystem/en/teacher-guide.md) ·
🇷🇺 [Russian docs](docs/ecosystem/economics.md)

---

## Algorithms: second-order optimisation

The mechanic is shared by all three games. A slider sets a **number** ("delivery fee = ₽149").
An algorithm sets a **rule** ("price = f(utilisation)"), and a rule can differ across
circumstances — which is why it can improve both ends of a trade-off that no single number
can resolve.

Algorithms unlock as quality grows: `quality = √(data × team)`. Data accumulates only from
the service running; the team comes from the data science budget. Neither works alone.

The Algorithms tab shows a **counterfactual breakdown**: the previous turn is re-simulated
with the algorithm switched off, revealing what it actually earned. Often the answer is
zero — surge is useless without congestion, personal retention pointless at low churn, and
forecasting adds nothing if you were already getting it right. Students see that an
algorithm's value is not a property of the algorithm but a property of the situation.

## Project layout

```
index.html                      the games index page
shared/
  rng.js                        deterministic PRNG (a game replays exactly from its seed)
  i18n.js                       translation core: setStrings() / t() / tx()
  charts.js                     canvas chart rendering
  format.js                     number and money formatting
  styles.css                    shared dark theme and grid
  tools/build.js                bundles the single-file builds from manifests
  tools/docs.js                 builds docs/**/*.md into the site's HTML pages
  tools/serve.js                local static server
games/<game>/
  index.html                    markup
  build.manifest.js             what goes into the single file, and in what order
  src/strings.js                interface dictionary, { ru, en }
  src/model/config.js           ALL world parameters: constants, levers, algorithms
  src/model/engine.js           the simulation core — pure functions, no DOM
  src/model/events.js           random events
  src/model/board.js            board goals (in every game)
  src/model/rival.js            the living rival (streaming, ticketing)
  src/model/crises.js           crises that last until resolved (streaming, ticketing)
  src/model/…                   the rest of the world: demand, pricing, partners — per game
  src/ui/app.js                 interface: levers, charts, reports
  tests/*.test.mjs              model and translation tests
  dist/kinoreka-streaming-simulator-v1.30.0.html
                                the built offline version (name in build.manifest.js)
docs/<game>/                    formulas and lesson plans (RU + en/)
```

All the economics lives in `games/<game>/src/model`. Those modules know nothing about the
browser, so they can be run in tests, in scripts, and used to build sensitivity charts.

The shared core in `shared/` knows nothing about delivery or cinema: the dictionary is
**injected** via `setStrings()` and the games return only keys. The bundler checks for name
collisions between modules, so a duplicate at the top level fails the build instead of
producing a white screen.

Text in the models is stored as `{ ru, en }` pairs so the original and the translation sit
side by side and neither can be lost silently. Tests enforce it.

## Tuning the balance for your course

Every number lives in `games/<game>/src/model/config.js`: starting capital, elasticities,
churn, content costs, algorithm unlock thresholds. You can change them without touching the
logic.

After editing it is worth running `npm test` — over 440 checks across the four games and the shared modules. The tests
verify qualitative properties (monotonic responses, interior optima, P&L consistency, no
NaNs, translation completeness) rather than specific numbers, so they survive rebalancing.

## Limits of the models

These are teaching models, not forecasting tools. In the delivery game the competitor does not
react to you (in the streaming game it does), customers are homogeneous within a segment, and whole pieces of reality (international markets, bidding
for ad inventory, individual contracts) are compressed into one or two coefficients. The
models exist to show the **structure** of the dependencies, not to predict a real market.
Detailed lists of assumptions are at the end of each `docs/<game>/economics.md`.

---

## Author

**[Ruben Deev](https://www.linkedin.com/in/ruben-deev)** — concept, economic models, interface and copy for all three games.

## License

[CC BY-NC-SA 4.0](LICENSE.md): use the games and materials freely in class, hand them
out to students, change the numbers to fit your course and work through the formulas
on the board — with attribution. Commercial use requires the author's separate
permission; derivatives carry the same license.
