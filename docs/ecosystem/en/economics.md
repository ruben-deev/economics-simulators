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
