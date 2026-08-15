# NOVOGRAD: the model explained

An ecosystem simulator — the endgame of the set. The player starts where any
of the three games ended: their company won its market, that market is
saturated, and there is no one left to acquire. One turn is a month; the
game runs three years.

## The core formula

```
holding revenue = unique customers × holding ARPU
```

The in-game month breakdown decomposes every revenue change into exactly
these two factors. After saturation the first one is nearly frozen — the
second decides the game. That is the answer to a market ceiling.

## Base topology: a hub and its spokes

The starting asset is the hub of the shared base. Overlaps are counted
between the hub and each vertical: cross-sell offers a hub customer their
SECOND service (there are no triple overlaps in the model by construction).
The ecosystem’s shape follows the starting asset literally:

* **delivery** — courier logistics: e-commerce launches 40% cheaper and at a
  better margin, but peak conflicts cost the hub some service quality;
* **streaming** — the habit of paying: the Plus subscription is cheaper to
  launch and converts better, and the content is yours — no cinema licence
  needed;
* **ticketing** — a partner network: all cross-sell is 20% cheaper and the
  ticketing partnership is already in hand. A small base and treasury —
  hard mode.

## Cross-sell versus cold marketing

```
channel intake = min(budget / cost per customer, pool × reach × service quality)
```

Cross-sell is several times cheaper than cold acquisition but runs into
capacity: the hub’s pool is finite, and conversion depends on the receiving
vertical’s quality — no amount of traffic saves a dead product. Overspend
burns and is shown in the report. Cold marketing costs more but scales and
brings people who are new to the holding. Measured: the optimal split of a
shared budget is roughly 20/80.

## The Novograd Plus subscription

The Amazon Prime dilemma: the perks cost a subscriber roughly what they pay
(at a mass-market price, more). The subscription pays off through frequency
and through the churn it cuts across every service at once. Subscribers come
only from multi-service customers: the subscription needs something to glue.

## Valuation: sum of parts

Each part is valued on its own revenue window (6 months — a one-turn sprint
does not buy valuation) and its own multiple: the mature hub like a cash
cow, the growing verticals like growth stories, the subscription highest of
all (recurring revenue). The premium is paid for measurable glue: the share
of customers on two or more services. A deeply loss-making vertical with no
growth is a “zoo” — investors subtract its annual burn. In the final year
(act three) the demand is harsher: show a profitable ecosystem, not a zoo.

## The final score

```
score = (sum-of-parts valuation + cash) × your stake
```

Cash belongs to the shareholders: a rouble unspent at the finish is worth a
rouble. Rounds sell a stake at today’s valuation — expansion nearly always
runs on outside money, and the only question is the valuation you take it
at.

The verdict scale is per asset. Measured ceilings differ threefold
(delivery 13.6, streaming 13.7, ticketing 3.4 bn ₽ for polished strategies),
so a single ruler would call an excellent ticketing game “a modest outcome”.
Thresholds live in the asset descriptor at 80% / 45% / 15% of its measured
optimum. The leaderboard stays shared: the score itself is not scaled.

## What carries over from the previous game

Three **currencies of the finale** and three **flags** carry over. The
currencies are what the company actually was: customers, cash, valuation.
The flags are the fact that you played it: your own asset (cheaper win-backs
and more organic growth), a cinema licence and a ticketing partnership,
both discounted for the first year.

The unit of the scale is the source game’s **solid finale** (`solid` in
`shared/meta.js`); the ceiling is twice that, i.e. a polished run. An exactly
solid finale carries no numbers at all: what carries is what you did *above*
a solid game.

| Channel | What it carries | At the ceiling (×2) |
|---|---|---|
| Own-asset flag | whether that game’s endgame was played | +2.0% of the median score |
| Customers | the base and the pool of lapsed users | +12% base → **+10.3% of the score** |
| Cash | the money you did not spend there | +18% treasury → +2.5% |
| Valuation | your standing with investors (round terms and floor) | +15% / +30% → +3.3% |
| All three currencies | | **+12.4% of the score** (17 games out of 24 improved) |

Measured over 24 game codes, one policy, bankruptcy = 0, medians compared
(averages lie near bankruptcy — see below). Next to the median is how many
games the carry actually helped: with this much spread a median alone
misleads. The first measurement used eight codes and gave +14.8% — the gap
shows why eight is not enough.

A side effect worth knowing: the carry raises the board's targets too (they
scale with the carried base), so bankruptcies go up, not down — 7 games out
of 24 against 3 with the flag alone. A bigger company takes bigger risks
because bigger things are demanded of it.

Customers are the strongest and the most non-linear channel: +6% of the base
gives +2.5% of the score, +12% gives +10.3%, and +21% gives +33%. An extra
customer drags cross-sell, glue and the valuation multiple along. Hence +12%
at the ceiling and not a percent more.

**The carry-over does not bypass the board.** Yearly targets scale with the
carried base, not with the asset descriptor: bring a bigger company and you
must build a bigger second leg.

**Averages lie near bankruptcy.** On some game codes the legacy flips a
seed: a run that went bankrupt without it survives with it — and the average
jumps 20–36% where the median moves 8–15%. The cushion decides where the run
was on the edge anyway.

### Why the thresholds were reset

The audit showed the carry-over was not the same for the three games.
Measured anchor strategies (6 codes, bankruptcy = 0):

| Game | cautious | middling | sweeping | polished |
|---|---|---|---|---|
| NOVOYEDA | 3.90 | 5.57 | 9.87 | 8.30 bn |
| KINOREKA | 15.29 | 15.49 | bankrupt | 35.80 bn |
| BILETVILLE | 0.84 | 2.13 | 5.01 | 5.58 bn |

The old thresholds were ₽1bn / ₽30bn / ₽2.8bn. Any NOVOYEDA finale therefore
hit the carry ceiling (even a cautious run scored four times the threshold),
while KINOREKA carried almost nothing — its middling run is half its own
threshold. Two different bars are now separate:

* **entry** (`threshold`) — the asset is unlocked, ★ on the card. It sits
  below each game’s cautious anchor: ₽1bn / ₽12bn / ₽1.2bn. A gate, not an
  achievement;
* **the unit of carry** (`solid`) — a solid finale: ₽5.5bn / ₽16bn / ₽2.5bn,
  the middling anchor of each game. The ceiling (×2) is a polished run.

The games’ own verdict scales were re-measured the same way: NOVOYEDA put
“excellent” at ₽3bn while a cautious run scores 3.9 (everyone got it), and
KINOREKA put it at ₽80bn, which no anchor reaches. Now: NOVOYEDA 10 / 5.5 / 2,
KINOREKA 32 / 16 / 8, BILETVILLE “solid” ₽2.5bn (was 4).

## A legacy is a head start, not a rent

The first per-flag measurement exposed a skew: permanently waived monthly
fees (the free ticketing partnership, the cinema licence discount) were worth
+11.5% and +8.0% of the final score, and the whole stack +21% for delivery.
The cause was structural: saving ₽2.5M a month compounds across all 36
months. The fix is not a tweak to the numbers but a term: legacy discounts
now last the first year, after which everyone pays the same.

Measured after the fix (share of the final score, on tuned anchors):

| Asset | own asset | licence | partnership | flag stack |
|---|---|---|---|---|
| delivery | +3.5% | +0.2% | +0.8% | **+4.5%** |
| streaming | +0.7% | 0.0% | +0.3% | **+2.5%** |
| ticketing | +2.2% | +0.5% | 0.0% | **+2.7%** |

The zeros are not errors: your own content needs no cinema licence, your own
ticketing needs no partnership.

## Are the three starts equal?

Compare each finale with its own “solid” threshold under one policy
(12 codes, medians):

| Start | ×1 (solid finale) | ×1.5 | ×2 (ceiling) |
|---|---|---|---|
| NOVOYEDA (delivery) | 1.72× | 1.87× | 2.24× |
| KINOREKA (streaming) | 1.48× | 1.59× | 1.66× |
| BILETVILLE (ticketing) | 1.51× | 1.73× | 1.92× |

The carry-over does not break the balance: the spread holds at 1.16–1.17×
at ×1 and ×1.5, so all three starts get roughly the same relative boost. At
the very ceiling delivery pulls ahead (1.35×), but it cannot get there: ×2
for NOVOYEDA means ₽11bn against a polished anchor of 8.3. At realistically
reachable levels (delivery ×1.5, streaming and ticketing ×2) the numbers are
1.87 / 1.66 / 1.92 — a 1.16× spread, exactly as without any carry-over.

## The mid-game crisis: an antitrust case

The only event on a schedule rather than a die roll: if it has not fired by
month 22 it arrives forcibly — provided the holding has something to tie
together (a live subscription or shared logistics). Otherwise the middle of
the game sags: the launches are behind you and act three is ahead.

Three outcomes diverge permanently and are paid in different currencies:

| Outcome | The price | What stays intact |
|---|---|---|
| Split off logistics | a one-off ₽60 per customer plus a permanent e-commerce margin loss (the courier network’s owner loses its bonus; everyone else pays a market mark-up) | the subscription and the glue |
| Open the subscription to rivals | +5 pp of subscriber churn and permanently weaker ecosystem retention | the structure and the cash |
| Litigate | ₽10M a month for six months, worse cross-sell while the case runs, and supervision of the unified account to the end of the game | the structure and the subscription |

Domination audit on a full build: 13/75/13 with cheap capital, 40/20/40 with
expensive capital. On a build without e-commerce, splitting logistics is
predictably the cheapest — that is not an imbalance but a property of
structure: it is easy to concede what you do not have.

## The post-endgame: the conglomerate year

The game is scored at month 36, the result is frozen and already submitted —
after that you may play one more year, but it is played for maturity rather
than valuation. The rule of the act: **there is no outside money left**. For
three years the expansion ran on rounds; now that move is closed and cash
comes from profit alone.

The board sets a single goal for twelve months: hold glue at 38% or better
and grow the holding by 11% — on your own. Profitability stopped being a bar:
by month 36 nearly every build has it (measured), while growth without
external capital does not come for free.

Measured across three builds (6 games each): a strong build clears the goal
in 3 runs out of 6, a medium one in 4, a weak one never (its glue sits at
~25% against 44–50% for the others). Growth is measured against your own
frozen score, so the bar is equally fair for a modest game and a record one.

The act’s result goes out as a separate string tagged NOVOGRAD+ into a
separate table: a 36-month game and a 48-month game are not comparable and
must not share a ranking.

## The price of decisions (an extract from the measurements)

| Decision | Shape of the answer |
|---|---|
| Launching taxi | available from turn 1; optimum months 1–3, “never” ≈ −90% |
| The Taxograd war | 9 months: intake −45%, fares −15%; a truce costs 3% of the market permanently |
| Launching e-commerce | gate: month ≥8 and a profitable hub; “never” ≈ −15%, late up to −40% |
| The Plus subscription | “never” ≈ −25%; ₽299 is an interior optimum |
| Milking the hub | works in the moment; past the 115% threshold customers flee — and the cross-sell pool with them |
| The three games’ legacy | stacks to +4–6% of the score: felt, not decisive |

The numbers are notional, chosen for playability: the game illustrates the
mechanics of the relationships, not the magnitudes.

## What the model leaves out

Merger regulation, ecosystem-on-ecosystem competition (beyond the raid
event), scooters (the next phase), the labour market beyond driver churn,
and international expansion. The assumptions are deliberate: the model
teaches the structure of ecosystem economics, not the valuation of a real
company.
