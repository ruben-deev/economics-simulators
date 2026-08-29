# Class notes: the streaming simulator

*[Русская версия](../teacher-guide.md)*

The game suits courses on subscription economics, media business, unit economics and
corporate finance. One game is 36 turns, which at a calm pace is 40–60 minutes.
Seeing the main forks usually takes only 12–18 turns.

The three games in the set model different kinds of business, which is the point of
playing more than one. In delivery (`docs/foodtech/`) revenue per customer grows with
their activity; in subscription it is fixed while cost grows; in ticketing
(`docs/tickets/`) billions pass through you and yours are the percentages. The same
words — "engagement", "retention", "growth" — mean different things in each.

---

## The six ideas the game was built around

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
   and take a share; the final score counts the share.

---

## Where the model surprises people

### Where to put the first billion

Both extremes fail, and they fail differently. All into marketing: the base grows for two
or three turns and stalls — there is nowhere to send the viewer, and the debrief prints
"The catalogue is nearly empty: marketing is burning for nothing right now." All into
originals: nothing reaches the screen for six months, cash runs out around turn 9–13, and
the "Studio and production" panel shows projects in the pipeline and no premieres.

*Question:* what is the smallest catalogue at which marketing converts at all, and how
many months can the company afford to go without a premiere?

### Two tiers are not a product line, they are cannibalisation

The expected effect of cutting the ad-tier price is "more people will come". The actual
effect is different: part of the audience moves down from the expensive tier. The cheap
tier earns from people who would not have paid at all and loses on people who would have
paid full price. The split is on the "Audience" tab.

The ad load works on two different lags: revenue rises immediately, churn a turn later.
Tolerance for ads differs by segment: 0.45 for film buffs, 1.35 for the young.

*Question:* how does that spread change the answer to "should we raise the ad load"?

### One hit is a loan, not growth

A blockbuster produces a sign-up spike roughly six turns later and a slump two turns after
that. The cause is a genre constant: `hangover` is 1.0 for a blockbuster and 0.1 for family
animation. A blockbuster gives a spike one and a half times bigger and a slump ten times
deeper. The only cure is a second project started while the first is still in production —
otherwise the next premiere lands six months after the slump.

*Question:* does a subscription business live off the schedule of premieres or their size?

### The rival can be read

The rival holds five stances and each lasts at least four months — that is a course, not
noise. When it is "harvesting" it cuts content and raises the price: its catalogue starts
to wear out, and that is the best moment to take its base by switching. When it is in a
price war, stay out: it has more money and a war of attrition is not winnable.

The month's results carry a separate "switching" line: people who did not cancel a
subscription but chose a different one. There are two ways to grow — bring in people with
no subscription, and take people who pay the neighbour. The second is faster, but the
neighbour has a reply and the open market does not.

*Question:* why is a strong rival sometimes useful? (It grows the whole category: new
inflow is computed from the best offer on the market, not only from yours.)

### Knowing the rival's line-up is worth almost nothing

The "Rival's line-up" panel shows next month's announcement — that is, the schedule of
someone else's releases is public and everyone has it. You can answer with a premiere of
your own, but counter-programming is capped at 65%: someone else's "event of the year"
cannot be fully cancelled out. The alternative is to release the same title a month later,
into a quiet month.

The advantage comes not from the knowledge but from having a project ready to ship.
And readiness is laid down six months earlier.

*Question:* why are there fewer rival premieres in summer while your own spike is also
weaker? (The seasonal hours multiplier is 0.84 — everyone watches less.)

### Licences versus originals: the optimum is in the interior

The one place where I have a real measurement rather than an observation. Four strategies,
the same studio slots and price, differing only in the rights-buying budget (audit 2026-08,
24 fixed codes, full game):

| Strategy | Rights budget | Capital | Subscribers | Own share |
|---|---|---|---|---|
| A | 0 | 0.2bn | 1.6M | 94% |
| B | 150M/mo | 6.4bn | 2.7M | 43% |
| C | 500M/mo | **13.2bn** | 5.2M | 30% |
| D | 800M/mo | 7.1bn | 4.8M | 27% |

You cannot skip buying: A builds a library out of its own output alone, a third of its
games end in bankruptcy, and the survivors are worth thirty times less than C. You cannot
live on buying alone either: D buys more than C and ends up almost twice as bad — buying
past the point of sense drives the rights index up and you pay more to yourself. The curve
is humped: from 150M to 500M the result doubles, past roughly 550M it falls.

Three numbers on screen explain it: the own share of the catalogue (which drives exclusive
retention), freshness (A holds it only through premieres and sags between them), and the
valuation — C's is higher not only because of revenue: the library enters the valuation as
a separate term, while licences do not enter it at all, because renting is not owning.

*Question:* D has almost as many subscribers as C and buys 60% more rights. Why does an
investor value it at nearly half? (The short answer is the line "rights expired on N hours,
M bought" in the "Industry" panel: a licence is a rental, and you pay every month just to
stay where you are.)

### A smart algorithm can be switched on to your own harm

`quality = √(data × team)`, and data accumulates only from viewing — a strong data-science
team on turn one buys nothing but cost. It gets worse: turn recommendations to maximum
strength at a model quality of 0.3 and the perceived catalogue **falls** — the benefit is
linear in strength, the harm is quadratic. The optimum personalisation strength sits inside
the range and moves right as quality grows: a "smart algorithm" has a dial, not just
a switch.

The "Algorithms" tab recomputes last month with the algorithm turned off. The contribution
is often near zero: retention is useless at low churn, encoding does not pay off at low
traffic, and there is no release calendar to stretch without premieres. The algorithm costs
the same whether it works or not.

*Question:* do recommendations replace content, or take it off the shelf?

### The valuation and your stake are different numbers

The score counts valuation × stake, not valuation. A game where the round is taken later
usually has fewer subscribers and a bigger score.

*Question:* when is raising at a low valuation still right? (When without the money the
company will not live to the point where the valuation grows. A round is not a mistake;
taking one earlier than needed is.)

### A business does not have one goal for life

The most interesting place in the game if there is time for only one. The year-one goal is
3.4M subscribers; it is taken by pouring money into content and marketing, usually while
running deep into the red. In the first month of year two the board announces something
else: a duopoly share of at least 52% **and** a base at least 1.05× the current one.
"Just grow" is no longer enough — the rival grows too, and share is taken by taking, not by
budget: content against its strong genres, price and promo at its weakest moment. In the
first month of year three the goal changes again: at least two profitable months and a base
no lower than 55% of the peak. The expansion strategy that just won year two directly
contradicts year three.

Missing a goal cuts the content budget for six months — that is, it breaks precisely the
move the team has been playing until now.

*Question:* what should the team have done in month 10 if it had known the year-two goal in
advance? (It does know: the goal is announced at the start of the year and sits on screen
every turn. The question is who was looking at it.)

### Crises arrive more often the better things go

After month 7 crisis frequency grows with the size of the service. Each one offers two
buttons: an expensive fix and cheap inaction. The cost of the fix rises every month you
wait while churn runs the whole time. "A rights-holder lawsuit" stands apart: it freezes
part of the **rented** library — what you own cannot be taken away, which is one more
argument for originals that never shows up in the P&L.

*Question:* when is "wait it out" still the right answer? (With two months left in the
game, paying for the fix can cost more than living with the problem. Count the remaining
horizon, not the month.)

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

**The final screen as a homework-collection tool.** Beyond the result string and the
local table it has "Copy" and "Download CSV" buttons (the month-by-month history of
the game), "Share as image" (a result card for messengers; a vertical format on
phones), the world leaderboard with result submission, and a personal debrief — two
or three findings about what exactly cost the player money.

**Language in the link.** The header button switches the language, but it can be baked
straight into the link: `…/games/cinema/?lang=en` (or `?lang=ru`). Without the
parameter the game picks the browser's language, and part of the group may open the
other version.

**Difficulty levels.** The welcome screen offers three levels — Easy, Normal, Hard.
The level goes into the result-string tag and each level keeps its own leaderboard —
do not compare results across levels directly.

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

**Handing it out to students.** `npm run build` produces `games/cinema/dist/kinoreka-streaming-simulator-v1.40.0.html` —
a single file that works offline. Progress is saved in the browser's localStorage.

**Language.** The interface switches between Russian and English with the RU / EN button.
All text in the model is stored as `{ ru, en }` pairs in
`games/cinema/src/model/config.js`, `games/cinema/src/model/events.js` and
`games/cinema/src/strings.js`.
