# Class notes: the food-delivery simulator

*[Русская версия](../teacher-guide.md)*

The game suits courses on unit economics, operations management, marketplaces and systems
thinking. A full game is 52 turns, which at a relaxed pace takes 40–60 minutes. Seeing the
main forks usually takes 15–20 turns.

The interface is bilingual — the RU / EN button in the header switches it, and the choice
persists between sessions.

---

## The six ideas the game was built around

1. **Unit economics comes first.** While contribution per order is negative, growth
   accelerates death rather than approaching profit.
2. **Fixed and variable costs are different animals.** The first determine the scale you
   need; the second determine whether a given order is worth taking at all.
3. **A marketplace is a two-sided market.** Demand without supply does not convert:
   marketing spent with zero restaurants or zero couriers simply burns.
4. **The capacity constraint is non-linear.** 85% and 105% utilisation are not "slightly
   different" regimes; they are "working" and "broken".
5. **Bought growth is not built growth.** Promos and advertising lift demand instantly;
   retention is built from speed and selection.
6. **Money has a price.** A round at a low valuation costs you part of the company, and the
   final score counts precisely your stake.

---

## Where the model surprises people

### Marketing into an empty city does not convert

The first thing almost everyone does is switch marketing on at turn one. The result is
zero: the "Choice" multiplier is zero at zero restaurants. A two-sided market does not
start from one side, and that shows up in the weekly report rather than in theory.

Break-even is computed on the "Unit economics" tab. The interesting part is the spread
between teams: some reach profit at 20,000 orders and some at 8,000 — the whole difference
sits in decisions about price and courier pay.

*Question:* why can a team with higher contribution per order end up with lower total
profit?

### The metric changes the manager

"Maximise the number of orders" and "maximise your result (valuation × stake)" lead to
opposite decisions on the same map. Under the first, almost everyone turns on promos and
maximum marketing; the "Money" and "Cash" charts then show orders rising while cash falls.

This is the most direct place in the game to see a chosen KPI change behaviour, and it
transfers to real companies one to one.

### The system does not return to where it started

If the courier headcount is deliberately too small, the chain unwinds by itself: demand
exceeded capacity → delivery time rose → satisfaction fell → churn overtook inflow →
demand fell below where it started. The key word is "below": lost customers do not come
back on their own, and the "Week debrief" tab shows every link separately.

### Districts: the right answer depends on your unit economics

* Downtown — the best unit economics (high basket, short leg), but half the market is
  already taken.
* University — elasticity 2.2: discounts get the strongest response and the thinnest margin.
* Suburban — a 9 km leg, so a courier carries half as many orders; a high basket does not
  always compensate.
* Industrial — cheap to enter, but few restaurants and low frequency.

*Question:* which district is better at a contribution per order of ₽150, and which at ₽60?
Why does the answer change?

### The second city: entry timing matters more than the district mix

By week 20 growth in Novograd plateaus and the "Geography" panel shows the second city with
its entry price. The sums are worth doing before the decision: ₽30M to enter, ₽0.6M a week
of office, awareness from zero, marketing split across two cities, and 16 weeks of promo
war in which "StaroEd" halves the inflow.

By measurement: entering with all four districts in weeks 14–20 gives +28–36% on the final
result (the measurement was taken when the office cost twice as much, so the gain is
probably larger now), entering with the Eastern district alone gives +11–12%, and entering
after week 30 no longer pays the war back. Separately: after entry, market share is counted
across both cities, which makes the fourth-quarter goal (45%) noticeably harder.

Expansion is not "more districts" — it is a second launch of the company, with a working
machine and an enemy on home ground.

### Good weather for delivery is bad weather for delivery

Demand ×1.30 at capacity ×0.60: a storm doubles the load on every courier who does turn up.
Then the chain runs on — lost orders, delivery time, courier churn — and two more weeks of
consequences: couriers lost to a storm are delivery times after the storm, and delivery
times are customer churn.

"Set an ₽80 bonus and forget it" fails for two reasons, both visible in the game. The
promise costs money: a courier gets 35% of the bonus even in a clear week, otherwise it is
not a guarantee. And a permanent bonus wears off: the weather panel shows habit eating its
effect over eight to ten weeks. A weather-triggered bonus is both cheaper and stronger —
by measurement, "only in hard weeks" gives +87% over the best constant, while playing it
the other way round loses a quarter of the result.

A caveat for stronger groups: with predictive auto-hiring on, the bonus is redundant — the
headcount is already matched to the weather, and paying on top of it takes 28% off the
result. Two mechanics doing one job: you pay twice.

The forecast appears in two places: as a card in the weather panel and in words in the
"City" panel, which also spells out what it means for delivery times. It is public and
every competitor has it: the advantage comes from reaction speed, not from information.

### A strategy built for one quarter's goal does not carry to the next

Quarter one: 45,000 orders a week — almost everyone takes it through growth at any price
(low pay, high promo, many couriers). Quarter two announces something else: contribution
per order of at least ₽50 **and** flow no lower than 85% of before, which means changing
exactly what won quarter one. Quarter three: four profitable weeks out of thirteen with the
base intact. Quarter four: 45% of the city.

Missing quarter one costs 15% of the stake (the shareholders put money in themselves);
missing quarters two and three cuts marketing for the quarter ahead — that is, it breaks
precisely the move the team has been playing. Delivery price and commission turn out to be
decisions for a quarter, not settings.

The bars were set by measurement across 120 random strategies: quarter one is taken by 30%,
quarter two by 21%, quarter four by 23%. Almost no random strategy takes quarter three,
while a well-run one closes all thirteen weeks in profit — that goal separates a working
business from an almost-working one.

### A smart algorithm often contributes exactly zero

`quality = √(data × team)` — a strong team in week one buys nothing but cost: there is
nothing to train the model on. Further along, the "Algorithms" tab recomputes last week with
the algorithm switched off, and the contribution is frequently zero: surge does not work
without overload, allocation without a courier shortage, forecasting if the player was
sizing the shift correctly anyway. The algorithm costs the same whether it works or not.

Personal-discount reach has an interior optimum. Personal discounts make expensive promos
less ruinous without making them profitable: second-order optimisation does not replace a
first-order decision.

*Question:* you have ₽1M a week. Marketing, technology or data science? What does the
answer depend on, and how does it change between week 5 and week 40?

---

## Quick questions for oral debriefs

* You raised commission from 20% to 30% and revenue rose the very next week. Why might it be
  lower than the original level a month later?
* Courier utilisation is 60%. Should you cut couriers? What happens to the earnings of those
  who remain, and what does that mean for churn?
* LTV/CAC = 4. Does that mean you should double the marketing budget? (Not necessarily — CAC
  rises with budget because of diminishing returns, and courier capacity may not absorb the
  inflow.)
* You raised ₽120M in week 6 and are worth ₽5B in week 40. Is that a good result? (Compare
  with a game without the round: your stake might have been worth more.)
* Surge pricing brought in +₽250K this week while satisfaction fell. How do you tell whether
  it pays off over a quarter? (Look at churn and the customer base chart, not at the week's
  revenue.)
* Targeted discounts at 5% reach give the cheapest rouble of demand. So why not set 5%?
  (The absolute effect is small, and the customers left out notice the unfairness.)
* An algorithm shows a contribution of ₽0. Should you switch it off? (Yes, unless it becomes
  useful when the regime changes: surge wakes up under congestion, allocation under a courier
  shortage.)

---

## Technical notes for instructors

**The same city for the whole group.** A game is deterministic in its game code (seed):
an identical sequence of decisions under the same code produces an identical result.
The code is entered right on the welcome screen — invent one (say, `class-7b`), dictate
it to the group, and everyone plays the same city: the same weather, events and market.
The current game's code is shown in the help dialog ("?" button), so it can be shared
after the fact too. On the final screen the game produces a **result string** carrying
the game code, the score and a checksum. Ask students to send it in: a string with a
doctored score fails the checksum (faking it is harder than playing honestly). The final
screen also keeps a table of the best games on that device.

**The final screen as a homework-collection tool.** Beyond the result string and the
local table it has a "Copy" button (the result string in one tap), "Download CSV" (the
week-by-week history of the game — handy for spreadsheet debriefs), "Share as image"
(a result card for messengers; a vertical format on phones), the world leaderboard with
result submission, and a personal debrief — two or three findings about what exactly
cost the player money.

**Language in the link.** The header button switches the language, but it can be baked
straight into the link: `…/games/foodtech/?lang=en` (or `?lang=ru`). This matters when
a bare link is sent out: without the parameter the game picks the browser's language,
and part of the group may open the other version.

**Difficulty levels.** The welcome screen offers three levels — Easy, Normal, Hard. The
level goes into the result-string tag and each level keeps its own leaderboard, so do
not compare results across levels directly: announce the level together with the game
code.

**Tuning difficulty.** All parameters live in `games/foodtech/src/model/config.js`:
* `startCash` — how much room for error students have;
* `courierMarketWeeklyPay` — how tight the labour market is;
* `customerBaseChurn` — how expensive bad service turns out to be;
* `weeksTotal` — the length of a game;
* `SEASON_WEIGHTS` in `games/foodtech/src/model/weather.js` — how harsh the climate is;
* `rndSaturation` and `dataSaturation` — how quickly algorithms unlock;
* `unlock` and `install` in the `ALGORITHMS` array — availability thresholds and rollout costs.

To run a class on algorithms alone without spending turns on the ramp-up, hand students a
game with `dataStock` and `rndStock` already accumulated — that is what the tests in
`games/foodtech/tests/engine.test.mjs` do (the `warmState` helper).

After any edits, run `npm test`: the tests check qualitative properties of the model
(demand responding to price, restaurants churning at high commission, P&L consistency)
rather than specific numbers, so they survive rebalancing.

**Language.** The interface switches between Russian and English with the RU / EN button.
All text in the model is stored as `{ ru, en }` pairs in `games/foodtech/src/model/config.js`,
`games/foodtech/src/model/events.js` and `games/foodtech/src/strings.js`, so adding a third language means adding one more
key to each pair.

**Handing it out to students.** `npm run build` produces `games/foodtech/dist/novoeda-delivery-simulator-v1.31.0.html` — a single
file that works offline. Progress is saved in the browser's localStorage.
