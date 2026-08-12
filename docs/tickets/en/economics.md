# The ticketing model: formulas and assumptions

"BILETON" is a teaching model of a two-sided market. This page collects the
formulas it computes with and the assumptions it makes. All numbers live in
`games/tickets/src/model/config.js` and can be changed without touching logic.

---

## 1. The loop

```
organisers ──> listings (events and seats) ──> buyers ──> tickets ──> turnover
     ^                                                                   │
     └────────────── audience reach <──── marketing <────────────── revenue
```

The loop closes in both directions, and that is the central property of the
model: organisers go where the buyers are, buyers go where the listings are.
Neither side arrives first on its own. Hence two traps: marketing into empty
listings burns entirely, and rich listings without buyers produce empty halls,
which is exactly why organisers leave.

One turn is a month; a game is 36 months. The year starts in September, with
the opening of the season: a theatre and a stadium have opposite years, and
"sign up theatres" looks different in summer than in autumn.

---

## 2. One revenue, two sides

You take money twice from the same transaction:

```
listings revenue = listings turnover × (buyer fee + organiser commission)
platform revenue = checkout turnover × platform rate
subscriptions    = connected organisers × monthly fee
```

**The buyer fee** is paid on top of the ticket price. It is visible at
checkout and comparable with the rival, so it hits demand directly:

```
demand multiplier(segment) = ((1 + 0.10) / (1 + fee)) ^ elasticity(segment)
```

Elasticities: theatre regulars 0.8, music fans 1.7, sports fans 2.1, casual
buyers 2.6. The same 18% fee costs you four times more among casual buyers
than among regulars.

**The organiser commission** is invisible to the buyer. The organiser sees it
in the contract — and keeps the rival offer in mind:

```
commission factor = ((0.05 + 0.035) / (commission + 0.035)) ^ (sensitivity × 0.45)
```

Sensitivity: clubs 0.85, theatres 1.5, concerts 2.4, sport 3.1. A sports club
with a billion in turnover haggles over tenths of a percent; a 150-seat club
barely cares.

**The sum can be identical and the consequences are not.** That is the first
decision of the game: 14% can be taken as 14/0, as 0/14, or anything between.
The model is built so that splitting evenly is the worst option: you subsidise
one side — and which one depends on how your channels are set up.

---

## 3. Channel conflict

An organiser has two ways to sell: through your listings and through the
checkout on their own site.

```
connected:     checkout = own audience × (0.80 + 0.50 × platform level)
               listings = 1 − checkout
               lost     = 0

not connected: lost     = own audience × 0.80
               listings = 1 − lost
               checkout = 0
```

"Own audience" is the share of buyers the organiser brings themselves: sport
0.72, theatres 0.50, clubs 0.42, concerts 0.28. A fan goes to the club site
anyway; a promoter has almost no audience of their own.

Hence the asymmetric arithmetic. **Not connecting** an organiser loses you
their own traffic entirely: they sell past you. **Connecting** recovers that
turnover, but at the platform rate — several times lower. And you actively
help them grow their own channel: the stronger the platform, the harder they
push buyers towards it.

The third effect is the least obvious and the most important. **Tickets sold
through the organiser's checkout never appear in your listings.** And demand
is computed from the listings, so handing checkouts to everyone undercuts the
very audience organisers come to you for. Measured on the reference strategy:

```
nobody                     0.88 B
clubs only                 1.72 B   (+95%)
concerts only              1.77 B  (+100%)
theatres only              0.85 B    (−4%)
sport only                 0.87 B    (−1%)
clubs + concerts           2.63 B
all four types             2.59 B
```

Clubs need self-service badly: there are thousands of them and no way to serve
them by hand. Concerts cost you almost nothing: they have no audience of their
own to lose. Theatres and sport cost more than they bring: they move half the
hall into their own checkout and the listings get thinner.

**The optimum is neither "everyone" nor "nobody" but per type.**

---

## 4. The two-sided market

```
appeal = commission factor
       × fee drag                  (the organiser sees that a ticket with a
                                    mark-up sells worse)
       × audience pull             (reach / 4.5M) ^ 0.55
       × platform fit
       × service quality
       × fill factor
       × trust factor
```

`audience pull` is the core of the cross-side effect: the argument "we have an
audience" works exactly as far as that audience exists.

`fill factor` is what the organiser sees with their own eyes:

```
factor = clamp(fill / 0.62, 0.15, 1.6) ^ 0.9
```

An empty hall is not beaten by any commission: even at a zero rate an
organiser with 25% fill leaves.

The free pool is split between you and the rival by the same formula, and the
rival is evaluated with **the same function** as you — otherwise the
comparison would be dishonest and the balance a fudge.

---

## 5. Demand and fill

```
reach(segment) += (1 − reach) × gain(marketing, listing power) − reach × 0.075
demand(segment) = potential × reach × interest × conversion × 0.28 × season × buyer choice
sold            = seats × (1 − exp(−demand / seats))
```

Demand is allocated across event types in proportion to `affinity[type] ×
listing share[type]`, and fill is computed per type — that is what the
organiser of that type sees, not the service average.

**Buyer choice.** Big events are on both operators: a promoter rarely gives a
tour to one. So the buyer compares the final price:

```
score(side) = demand multiplier(fee) × (0.82 + 0.18 × trust) × (0.88 + 0.14 × product)
multiplier  = 2 × your score^2.2 / (your score^2.2 + rival score^2.2)
```

Parity gives 1.0. Without this the buyer fee would be free for you: the
organiser barely sees it, and a buyer with nowhere else to go pays anything.

---

## 6. Turnover, revenue and acquiring

```
turnover  = (listings tickets + checkout tickets) × average price
revenue   = listings turnover × (fee + commission) + checkout turnover × rate + subscriptions
acquiring = turnover × 0.022
```

**Acquiring comes out of your share, not the organiser's.** That is why a low
commission is more dangerous than it looks: a 3% take rate minus 2.2%
acquiring is almost nothing. Billions pass through the service; percentages of
it are yours, and one of those percentages goes to the bank.

---

## 7. Trust

The one asset that cannot be bought in the month it turns out to be needed.

```
damage   = reseller share × 0.28
         + hidden fee × 0.030
         + dynamic fee spread × 0.016 × (1 − quality/2)
         + on-sale losses × 0.35
         + crisis effect
recovery = 0.055 × (0.4 + 0.6 × support quality) × (1 − trust)
```

Trust enters both conversion and appeal to organisers. The trap is that
turnover holds up for a while as trust falls: the numbers look fine right up
to the month it is too late.

**Resellers** buy faster than people on the hits, and turnover even grows —
that is the whole lesson: turnover and trust are different accounts.
**Capacity** is held all year and pays off in a single day, if that day comes
at all.

---

## 8. Algorithms

Quality = `sqrt(data × team)`: data without a team is useless, and so is a
team without data.

| Algorithm | What it gives | What you pay |
|---|---|---|
| Personal listings | casual buyers find somewhere to go; the long tail starts selling | with weak data the feed collapses into a dozen hits and small organisers stop selling |
| Dynamic fee | more revenue from the same turnover, weak events fill up | buyers see the fee was different yesterday |
| Bot protection | tickets go to people | strict checks cut off real buyers too |
| Fee at the last step | conversion rises at once and visibly | trust falls just as reliably, and it compounds over months |

---

## 9. Shareholder goals

| Year | Goal | Failure |
|---|---|---|
| 1 | monthly turnover of ₽520M or more | shareholders inject money themselves, your stake is cut by 18% |
| 2 | at least 3 profitable months with turnover above ₽700M | marketing capped for six months |
| 3 | 30% market share with 420+ organisers | valuation drops by 15% |

The strategy that wins year one (low rates for turnover) fails year two. That
is the point: the take rate is a decision for the year, not a setting.

---

## 10. What the model leaves out

* **Money held on account.** In reality tickets are paid for now and the
  organiser is paid after the event, and half the industry lives on that gap.
  Here revenue is recognised at the moment of sale; cancellations appear only
  as a crisis.
* **Individual events.** Organisers are averaged into types: there is no
  specific tour with a specific sales curve.
* **The secondary market.** Resellers are a parameter, not a side of the
  market with its own economics.
* **Regions and currency.** One market, one season, one currency.
* **More than two operators.** There is one rival; an oligopoly of five
  behaves differently.

The model shows the **structure** of a two-sided market, not a forecast of any
particular ticketing business.
