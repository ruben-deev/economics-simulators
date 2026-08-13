# Teaching notes: using the simulator in class

*[Русская версия](../teacher-guide.md)*

The game suits courses on unit economics, operations management, marketplaces and systems
thinking. A full game is 52 turns, which at a relaxed pace takes 40–60 minutes. For a single
class, 15–20 turns is usually enough.

The interface is bilingual — the RU / EN button in the header switches it, and the choice
persists between sessions.

---

## What students should take away

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

## Scenario 1. "Find break-even" (30 minutes)

The task: launch one district and drive it to a weekly profit of ≥ 0 without raising money.

How it goes:
1. In the first three turns students usually switch marketing on immediately — and see
   nothing happen. Discuss why: the Selection multiplier is zero at zero restaurants.
2. Once contribution turns positive, ask them to open the Unit economics tab and compute
   break-even out loud.
3. Compare the answers across teams: one will reach profit at 20,000 orders, another at
   8,000. The entire difference comes from decisions about price and courier pay.

Debrief question: how can a team with higher contribution per order end up with lower total
profit?

---

## Scenario 2. "Buy growth" (45 minutes)

The task: maximise the number of orders over 20 weeks. Nothing is said about profit.

Almost every team turns on promos and maximum marketing. Then:
1. Show the Money and Cash charts — orders climbing while cash falls.
2. Introduce a second condition: now maximise *your result* (valuation × stake).
3. Let them replay.

This is the most valuable scenario: it shows how the metric chosen for evaluation changes
the behaviour of the manager. A direct parallel to KPIs in real companies.

---

## Scenario 3. "Operational crisis" (20 minutes)

The task: hand students a game where courier headcount is deliberately too small (for
example, set the target to half of what is needed and run five weeks), then ask them to
explain what happened using the weekly breakdown.

The expected answer: demand exceeded capacity → delivery time rose → satisfaction fell →
churn overtook acquisition → demand fell below where it started. The key idea: the system
did not return to its starting point, it settled below it. Lost customers do not come back
on their own.

---

## Scenario 4. "A portfolio of districts" (40 minutes)

The task: expand into three districts over 30 weeks and justify the order of entry.

Material for discussion:
* Downtown — the best unit economics (high basket, short legs), but half the market is taken.
* Campus — elasticity 2.2: discounts produce the maximum response and the minimum margin.
* Suburbs — a 9 km leg, so a courier completes half as many orders; the high basket does not
  always compensate.
* Industrial — cheap to enter, but few restaurants and low frequency.

Question: which district is better with a contribution of ₽150 per order, and which with
₽60? Why does the answer change?

---

## Scenario 5. "Storm on Thursday" (25 minutes)

The task: get the service running steadily, then wait for a forecast showing a storm or ice
and explain what has to be done a week ahead of it.

How it goes:
1. Ask up front: weather lifts demand — is that good or bad? Most people say good. Then show
   the table: demand ×1.30 at capacity ×0.60 — a storm doubles the load on every courier
   who does show up.
2. Let them live through a storm week unprepared. Work through the report: lost orders,
   delivery time, courier churn — and the two weeks after: couriers lost in the storm are
   post-storm delivery times, and delivery times are customer churn.
3. Replay with preparation: hiring a week early and a bad-weather bonus. Compare contribution
   and losses.
4. Discuss why "set the bonus to ₽80 and forget it" does not work. Two reasons, both visible
   in the game: the promise is paid for (35% of the bonus reaches the courier even in a clear
   week — otherwise it is not a guarantee), and a permanent bonus wears off — the weather
   panel shows habit eating its effect over eight to ten weeks. A forecast-driven bonus is
   both cheaper and stronger, and a mistimed one is ruinous: measured, playing it
   backwards loses a quarter of the final score.

The core idea: the weather forecast is public and every competitor sees it. The advantage
comes not from the information but from the speed of the reaction to it.

---

## Scenario 6. "The quarter's goal" (40 minutes)

The task: show that a strategy built for one quarter's goal does not carry to the next.

1. Quarter one: 45,000 orders a week. Almost everyone gets there by growth at any cost —
   a low fee, a heavy promo, plenty of couriers.
2. Quarter two announces something else: contribution of ₽60 per order **and** an order
   flow no lower than before. Pause and ask them to say out loud what has to change.
   It usually turns out that what has to change is exactly what won them quarter one.
3. Quarter three — six profitable weeks out of thirteen with a base that has not shrunk.
   Quarter four — a 45% city share.
4. Debrief: the delivery fee and the commission are decisions for the quarter, not
   settings. Missing quarter one costs 15% of the stake (shareholders inject the money
   themselves); missing two or three caps marketing for a quarter ahead — which breaks
   exactly the move the team has been using so far.

The bars were set by measuring 120 random strategies: 30% clear the first quarter, 21%
the second, 23% the fourth. Almost no random strategy clears the third, while a well-tuned one
closes all thirteen weeks in profit — that goal separates a working business from an
almost-working one.

---

## Scenario 7. "Smart algorithms" (50 minutes)

The task: run the service to week 25 with ordinary levers, then switch on data science and
roll out algorithms, justifying each decision.

How it goes:
1. Point at the formula `quality = √(data × team)`. Ask in advance: what happens if you hire
   a strong team in week one? (Answer: nothing but costs — there is nothing to learn from.)
2. After the first rollout, open the Algorithms tab: the previous week has been re-simulated
   with the algorithm switched off. Frequently the contribution turns out to be zero.
3. Work through why. Surge does nothing without congestion, allocation nothing without a
   courier shortage, forecasting nothing if the player already sized the team correctly. The
   algorithm costs the same either way.
4. Set them the task of finding the discount reach that maximises the result. The optimum is
   inside the range, which is a good prompt to discuss why.

The main conclusion: second-order optimisation does not replace a first-order decision.
Targeted discounts make an expensive promo less ruinous; they do not make it profitable.
Strategy first, then the algorithms that make it cheaper.

Debrief question: you have ₽1M a week. Where does it go — marketing, technology or data
science? What does the answer depend on, and how does it change between week 5 and week 40?

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

**Handing it out to students.** `npm run build` produces `games/foodtech/dist/novoeda-delivery-simulator-v1.9.3.html` — a single
file that works offline. Progress is saved in the browser's localStorage.
