# Instructor notes: the streaming simulator in class

*[Русская версия](../teacher-guide.md)*

The game suits courses on subscription economics, media business, unit economics and
corporate finance. One game is 36 turns, which at a calm pace is 40–60 minutes.
A class session usually needs only 12–18 turns.

The three games in the set model different kinds of business, which is the point of
playing more than one. In delivery (`docs/foodtech/`) revenue per customer grows with
their activity; in subscription it is fixed while cost grows; in ticketing
(`docs/tickets/`) billions pass through you and yours are the percentages. The same
words — "engagement", "retention", "growth" — mean different things in each.

---

## What the student should take away

1. **Content is a capital investment with a lag.** A decision to produce in-house pays off
   in six months. By the time the problem shows up in the report, production is too slow
   a cure.
2. **Renting and owning look identical in the P&L and different on the balance sheet.**
   A licence and an original are the same cost line; they are not the same asset.
3. **Engagement is a cost.** In subscription, revenue per person is fixed while bandwidth
   grows with hours. The most loyal viewer is the most expensive one.
4. **Churn matters more than inflow.** At 10% monthly churn, half the base turns over in
   six months: you run to stand still.
5. **A catalogue can shrink by nothing and still lose people.** Freshness is a separate
   stock from depth.
6. **Growing the base ≠ growing the value of your stake.** Funding rounds finance growth
   and take equity; the final score counts equity.

---

## Scenario 1. "Where to put the first billion" (30 minutes)

Task: maximise subscribers over 12 turns. Starting capital is ₽4B.

Almost every team does one of two things: pour everything into marketing, or everything
into in-house production. Both fail, and differently:

1. **All marketing.** The base grows for two or three turns and stalls: there is nowhere
   to bring the viewer, catalogue appeal is near zero. Show the analysis line "the
   catalogue is nearly empty: marketing simply burns right now".
2. **All originals.** Nothing appears on screen for six months and the cash runs out
   around turn 9–13. Show the "Studio and production" panel: projects in the pipeline,
   no premieres.

Debrief: ask them to name the minimum catalogue at which marketing makes any sense, and
to calculate how many months the company can afford to have no premieres.

---

## Scenario 2. "Two tiers" (40 minutes)

Task: 15 turns, maximise revenue. Prices and ad load are free.

Running the session:
1. Let them play 5 turns, then stop and ask what is happening to the split between tiers.
   The Audience tab shows the ad-tier share by segment.
2. Ask: what happens if you cut the ad-tier price by ₽50? The expected answer is "more
   people arrive". The actual effect is that part of the audience **moves down from the
   expensive tier**. Let them check.
3. Raise ad load from 4 to 12 minutes an hour. Ad revenue rises immediately, churn rises
   next turn. Discuss how to tell whether the move paid off.

The core idea: two tiers are not a "broad line-up", they are cannibalisation management.
The cheap tier earns from people who would not have paid at all, and loses on people who
would have paid full price.

Debrief question: cinephiles have an ad tolerance of 0.45, young viewers 1.35. How does
that change the answer to "should we raise ad load"?

---

## Scenario 3. "One hit" (40 minutes)

Task: make one blockbuster and hold on to the base it brings.

Running the session:
1. Everything into a blockbuster, wait six turns, watch the sign-up spike.
2. Two turns later, the collapse. Show the "hangover" line in the month analysis.
3. Ask: what should have been done on turn 5 to prevent this? (Answer: start the second
   project while the first was still in production — otherwise the next premiere is six
   months after the collapse.)
4. Let them replay with a continuous pipeline.

Compare genres: `hangover` is 1.0 for a blockbuster and 0.1 for family animation.
The blockbuster gives a spike one and a half times as large and a collapse ten times
as large.

The core idea: a single hit with nothing behind it is a loan, not growth. A subscription
business lives on the release schedule, not on the size of any one release.

---

## Scenario 4. "Reading the rival" (45 minutes)

Task: 18 turns, get to 50% market share.

Running the session:
1. Show the rival panel. He has five stances, and each is held for at least four
   months — that is not noise, it is a course you can read.
2. Ask in advance: what do you do when he is "harvesting"? (Answer: he cuts content
   and raises price — his catalogue will go stale and you can take his base by
   switching. That is the best moment to attack.)
3. Let a team undercut him while he is in "price war". Show the result: he has more
   money; you do not win a war of attrition.
4. Work through the "switching" line in the month results: these are people who did
   not give up on streaming — they chose someone else.

The core idea: there are two ways to grow — bring in people with no subscription, and
take people who pay the other guy. The second is faster, but the other guy has a
counter-move and the untapped market does not.

Debrief question: why is a strong rival sometimes useful? (He grows the whole category:
new sign-ups are computed from the best offer on the market, not only from yours.)

---

## Scenario 4a. "The rival's line-up" (35 minutes)

Task: 15 turns, and answer the rival's "event of the year" at least once.

Running the session:
1. Point students at the "Rival line-up" panel: the right card is next month's
   announcement. Ask what can be done with that knowledge in one turn.
2. Let them play. Most teams answer with their own premiere. Show that counter-programming
   is capped at 65%: an "event of the year" cannot be fully cancelled.
3. Offer the alternative: release the same premiere a month later, into a quiet month.
   Compare the resulting growth in the base.

The core idea: everyone has the same information — rival release schedules are public.
The advantage comes not from knowing but from having a project ready to ship. And
readiness is decided six months earlier.

Debrief question: why are there fewer rival premieres in summer but also a weaker spike
for you? (The seasonal hours multiplier is 0.84 — everyone watches less.)

---

## Scenario 5. "Licences versus originals" (50 minutes)

Split the group into four teams. Everyone gets three studio slots and the same price —
only the rights budget differs:

| Team | Rights budget | Equity | Subscribers | Own share |
|---|---|---|---|---|
| A | 0 | ₽7B | 1.6M | 90% |
| B | ₽150M/mo | **₽129B** | 5.4M | 41% |
| C | ₽320M/mo | **₽128B** | 6.7M | 34% |
| D | ₽500M/mo | ₽83B | 6.8M | 30% |

Measured across four seeds, full game. Three things are visible at once:

1. **You cannot do it without buying.** Team A builds a library out of its own work alone
   and ends the game worth twenty times less than the others. In-house production is far
   too slow to assemble a catalogue by itself.
2. **You cannot do it on buying alone either.** D has the most subscribers — and a result
   half as good as B and C: buying beyond measure heats the rights index, and you pay
   more to yourself. That is the central question for the debrief.
3. **The optimum is inside, and it is flat.** From ₽150M to ₽320M the outcome barely
   moves — what decides is not the exact rights figure but the in-house production
   running next to it.

Debrief on three numbers on screen:
* **own share of the catalogue** — it drives exclusive retention;
* **freshness** — for the buyers it only holds up while buying continues and drops at the
  first economy;
* **company valuation** — C's is higher on lower revenue, because the library enters
  the valuation as a separate term while licences do not enter it at all: they are rent.

Debrief question: team D has more subscribers, lower churn and more revenue. Why does the
investor value it lower than C?

---

## Scenario 6. "Smart algorithms" (50 minutes)

Task: run the service to turn 20 on ordinary levers, then start switching on algorithms,
explaining each decision.

Running the session:
1. Ask in advance: what happens if you hire a strong data science team on turn 1?
   (Answer: nothing but cost. `quality = √(data × team)`, and data accumulates only
   from viewing.)
2. Switch recommendations to full strength at model quality 0.3. The perceived catalogue
   will **fall**. Show the formula: the benefit is linear in strength, the harm quadratic.
3. Set the task of finding the optimal personalisation strength. The optimum is interior
   and moves right as quality grows — a good moment to discuss why a "smart algorithm"
   has a setting and not just a switch.
4. Open the Algorithms tab: last month re-simulated with the algorithm off. The
   contribution is often about zero.

Work out why. Retention is pointless at low churn, encoding does not pay at low traffic,
and there is nothing for the release calendar to spread out without premieres. The
algorithm costs the same whether or not it works.

The main conclusion: second-order optimisation does not replace a first-order decision.
Recommendations increase consumption of what you already have — they do not replace
content, they only take it off the shelf.

---

## Scenario 7. "The board" (30 minutes)

Task: 20 turns, maximise **your stake in money**, not the number of subscribers.

Running the session:
1. Do not mention funding rounds in advance. Let the team accelerate, hit the cash wall
   and raise.
2. On turn 20, compare two metrics: company valuation and the final score
   (valuation × stake).
3. Let them replay with the instruction "raise as late as possible".

The usual outcome: the second game has fewer subscribers and a larger score.

Debrief question: when is raising at a low valuation still right? (When without the money
the company will not survive to the point where the valuation grows. A round is not a
mistake; a round taken earlier than needed is.)

---

## Scenario 8. "The year-two goal" (50 minutes)

The single most valuable scenario in the course if you only have time for one.

Task: play 24 turns, meeting the board's goals.

Running the session:
1. Year one has one goal: reach 3.4M subscribers. Almost every team pours money into
   content and marketing and meets it while going deeply into the red.
2. In the first month of year two the board announces a new goal: **four profitable
   months out of twelve and a base no smaller than it was**. Pause and ask the
   teams to say out loud what they will have to change.
3. It usually turns out that the year-one strategy directly contradicts the year-two
   goal. They cannot cut content — the base falls; they cannot not cut it — there will
   be no profit. The working answer usually lies in price and ad load, not in the budget.
4. If the goal is missed, show the consequence: the content budget is capped for six
   months. "Pour everything into growth" stops being physically available.

The core idea: a business does not have one goal for life. The strategy that wins year
one fails year two — and that is not a planning error, it is a normal change of stage.
What has to be learned is not "the right setting" but the ability to rebuild it.

Debrief question: what should the team have done in month 10 if it had known the
year-two goal in advance? (It did know — the goal is announced at the start of the year
and is on screen every turn. The question is who was looking at it.)

---

## Scenario 9. "A crisis will not go away on its own" (35 minutes)

Task: finish a game with a crisis running, explaining every decision.

Running the session:
1. Wait for a crisis (from month 7 onwards they arrive more often the larger the
   service is). Show the two buttons: the expensive fix and the cheap inaction.
2. Split the teams: half resolve immediately, half stall for three months.
3. Compare the total losses. The cost of the fix grows every month, and churn runs
   the whole time.
4. Discuss "A rights holder sues" separately: it freezes part of the **rented** library.
   What you own cannot be taken away — one more argument for originals that never
   appears in the P&L.

The core idea: crises arrive more often the better things are going. This is not a
punishment for success, it is what success actually costs — and no growth model
includes it.

Debrief question: why is "wait it out" sometimes the right answer after all? (With two
months left in the game, paying for the fix can cost more than living with the problem.
What matters is the remaining horizon, not the month.)

---

## Quick questions for oral debrief

* Churn is 8% a month. How long does a subscription last, and what does that mean for LTV?
* Hours per subscriber rose from 18 to 26. Is that good news? (Look at bandwidth and at
  contribution per subscriber: rising hours can eat the entire margin.)
* You bought 300 hours of licences. After how many months is half of it gone?
  (`licenseDecay = 0.045` → about 15 months.)
* Freshness has fallen to 0.2 and the catalogue has not shrunk. Where is the churn
  coming from?
* A premiere brought +400K sign-ups and −180K a month later. A failure? (It depends on
  what comes next. Count the area under the curve, not the spike.)
* Your blockbuster lands in the same month as the rival's "event of the year". Should you
  move it? (Counter-programming gives at most 65%; a quiet month gives 100%, but costs
  you a month. Work it out through the change in the base.)
* LTV/CAC = 5. Does that mean marketing should be doubled? (Not necessarily: CAC rises
  with the budget because of diminishing returns, and without a catalogue marketing does
  not convert at all.)
* An algorithm shows a contribution of ₽0. Switch it off? (Yes, unless the regime is about
  to change: retention wakes up when churn rises, encoding when traffic grows.)

---

## Technical notes for the instructor

**The same scenario for the whole group.** A game is deterministic in its game code
(seed): the same sequence of decisions on the same code gives an identical result.
The code is entered right on the welcome screen — invent one, dictate it to the group,
and everyone plays the same market: the same rival premieres, events and seasons.
The current game's code is shown in the help dialog ("?"). On the final screen the game
produces a result string carrying the code, the score and a checksum — ask students to
send it in: a doctored score fails the checksum. The final screen also keeps a table of
the best games on that device.

**Tuning difficulty.** All parameters live in `games/cinema/src/model/config.js`:
* `startCash` — how much room there is for mistakes;
* `monthsTotal` — the length of a game;
* `originalLeadMonths` — how painful the production lag is;
* `originalDepthWeight` and `licenseDepthWeight` — how strongly exclusives beat a rented
  catalogue;
* `baseChurn` and `exclusiveRetention` — how expensive a boring catalogue is;
* `cdnCostPerHour` — how visible the "engagement trap" is;
* `freshDecay` — how quickly a release stops feeling new;
* `rndSaturation` and `dataSaturation` — how quickly algorithms unlock;
* `unlock` and `install` in the `ALGORITHMS` array — availability threshold and rollout
  cost;
* `SEASON` in `games/cinema/src/model/market.js` — seasonality of viewing;
* `switchIntensity` and `competeSharpness` — how fast the base flows between services.
  Higher is more dynamic and more brutal; lower is calmer and more predictable;
* `exclusivePull` — how strongly exclusives pull viewers across;
* `licenseInflation` and `talentInflation` — how hard the growth flywheel is braked;
* the rival's starting parameters in `games/cinema/src/model/rival.js` (`createRival`)
  and the stance thresholds in `chooseStance`;
* the board's goals in `games/cinema/src/model/board.js` (`makeGoal`);
* the list and severity of crises in `games/cinema/src/model/crises.js`.

To run a session on algorithms alone without spending turns on the ramp-up, hand students
a game with `dataStock` and `rndStock` already accumulated — that is what the tests in
`games/cinema/tests/engine.test.mjs` do (the `grown` helper).

After changes it is worth running `npm test`: the tests check qualitative properties of
the model (an interior price optimum, ad revenue traded against churn, a mixed content
strategy beating both extremes) rather than specific numbers, so they survive rebalancing.

**Handing it out to students.** `npm run build` produces `games/cinema/dist/kinopotok-streaming-simulator-v1.11.2.html` —
a single file that works offline. Progress is saved in the browser's localStorage.

**Language.** The interface switches between Russian and English with the RU / EN button.
All text in the model is stored as `{ ru, en }` pairs in
`games/cinema/src/model/config.js`, `games/cinema/src/model/events.js` and
`games/cinema/src/strings.js`.
