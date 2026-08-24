# The ticketing model: formulas and assumptions

"TICKETGRAD" is a teaching model of a two-sided market. This page collects the
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
platform revenue = widget turnover × platform rate
subscriptions    = connected organisers × monthly fee
```

**There is no buyer fee on the widget at all** — and that is a chosen model, not
an oversight. On your own listings you set the price the buyer sees, which is why
you take from it twice. On the organiser's site they set it: there you are the
engine vendor, not the seller, and all your revenue from such a ticket is the
platform rate plus the subscription. Both arrangements exist in real life; the
pure SaaS one is taken here because it turns channel conflict into a real choice
rather than arithmetic.

Count it after the bank: acquiring comes off the full ticket price alike in both
channels, and on the platform rate it eats nearly everything. At default settings
a ₽1400 club ticket leaves you ₽179 through the listings and ₽4 through the
widget. The widget lives not off the ticket but off the subscription fee and off
turnover that would otherwise pass you by entirely.

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

Measured over 24 game codes (pure marketplace, median result in $M) the optimum
runs as a diagonal ridge:

| commission \ fee | 0% | 5% | 10% | 14% | 20% |
|---|---|---|---|---|---|
| **1%** | 1.7 | 10.9 | 29.9 | **43.2** | 31.8 |
| **5%** | 11.4 | 28.0 | **33.7** | 26.3 | 15.2 |
| **8%** | 22.1 | **38.0** | 29.0 | 19.7 | 10.3 |
| **10%** | **46.9** | 41.3 | 25.3 | 16.7 | 8.6 |
| **13%** | **63.7** | 45.9 | 21.3 | 13.8 | 7.1 |

The same 13% total yields $38M as 8/5 and $63.7M as 13/0. The asymmetry is not
an accident: the buyer fee is subtracted twice — first from the buyer's
conversion, then from the organiser's willingness to work with a platform where
their tickets sell slower. The commission is subtracted once. That is why
"switch the service fee off entirely" is a real differentiation strategy — but
only paired with a high commission: at a 1% commission the same zero produces
the worst result in the table.

In the platform build the answer flips: there zero is worse than a small fee
($177M against $191M at 2–5%). The widget and the subscription already carry
the revenue, turnover flows past your own listings, and a fee on what is left
behaves almost like pure upside.

---

## 3. Channel conflict

### A migration, not a checkbox

Ticking a type does not mean the widget is installed. Every organiser already
runs something: their own build or the rival's platform. Moving is a project:
integration, porting seat maps and season tickets, training the box office, and
an advance against events for the big ones. So a type does not have a yes/no but
a **share that has moved over**, and it grows exactly as far as it is paid for:

```
ceiling   = 1 − how much of the type the rival holds
moved this month = (ceiling − share) × 0.42 × payment^0.6 × platform maturity
payment   = onboarding budget per organiser / (₽260K / their need for the widget)
maturity  = platform level / (platform level + 0.18)
```

Three consequences. **Need works as a discount:** a club with no ticketing of its
own needs the widget badly and moves almost for free; a stadium with its own
system costs the most. **A raw product moves nobody:** while there is no platform,
onboarding money burns for nothing. **The rival holds their own:** whoever already
moved to them will not move again within the year — hence a ceiling below one.

Going back is instant and it stings: switching off someone else's site takes a
day, and the more organisers had moved over, the greater the resentment and the
more of them leave.

An organiser has two ways to sell: through your listings and through the
**ticketing widget** — your ticket sales embedded in their own site: their
domain, their branding, your engine underneath.

```
widget:        neutral  = own audience × (0.80 + 0.50 × platform level)
               widget   = neutral × push(type, platform rate)
               lost     = max(0, neutral − widget)
               listings = 1 − widget − lost

no widget:     lost     = own audience × 0.80
               listings = 1 − lost
               widget   = 0

push = 1 − 0.32 × (rate / 0.025 − 1) × (0.5 + 0.5 × sensitivity)
```

"Own audience" is the share of buyers the organiser brings themselves: sport
0.72, theatres 0.50, clubs 0.42, concerts 0.28. A fan goes to the club site
anyway; a promoter has almost no audience of their own.

Hence the asymmetric arithmetic. **Not connecting** an organiser loses you
their own traffic entirely: they sell past you. **Connecting** recovers that
turnover, but at the platform rate — several times lower. And you actively
help them grow their own channel: the stronger the platform, the harder they
push buyers towards it.

"Push" is how eagerly the organiser drives buyers into the widget rather than
your listings — and you set it, with the rate. **Below the market 2.5%** the
widget is nearly free to them, so they promote it themselves — a banner, a
mailing, a QR code on the poster — and move turnover out of your listings, where
you took both the fee and the commission. **Above it** they do the arithmetic and
route around the widget entirely: the box office at the door, season tickets sold
to their own people, the old in-house solution. That turnover does not come back
to your listings; it simply disappears. An expensive rate also slows migration —
a factor of `1 − 0.35 × (rate/0.025 − 1)` on adoption speed, because moving is an
investment decision with a payback period.

So the platform rate has a peak, not a ceiling. Measured across three reference
strategies (founder's equity over a full game, 12 seeds):

```
                0%       3.5%      7%
lean          8.55     8.52     8.02 B
mid           8.91    10.72     9.87 B
wide          9.36    13.96    12.86 B
```

The third effect is the least obvious and the most important. **Tickets sold
through the widget on the organiser's site never appear in your listings.** And
demand is computed from the listings, so giving everyone a widget undercuts the
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
hall into the widget on their own site and the listings get thinner.

**The optimum is neither "everyone" nor "nobody" but per type.**

---

## 3a. The subscription is a tier, not a deduction

The subscription is charged per connected organiser and does not depend on
turnover. It has two sides. The first is drag: the fee repels an organiser the
smaller their turnover is.

```
drag(type) = 1 − subscription × 6 / monthly turnover of the type
```

For a stadium turning over ₽17M a month, ₽100k is loose change; for a club
turning over ₽1.26M it is a reason not to connect at all. But in life an
organiser pays not for access to the widget but for a tier: priority in the
listings, hall analytics, a dedicated manager, box-office training. That is
the second side — value (without it the right answer would always collapse
to "charge nothing", and the lever would be a button):

```
value(type) = 1 + 0.50 × (fee / (fee + 45 000))
                       × platform level × widget need        (capped at 1.7)
appeal = … × drag(type) × value(type)
```

Three consequences, all economic rather than arithmetic.

**Free means no obligations.** At a zero subscription the value is exactly one:
the tier promises nothing, and the organiser feels it.

**You can only promise what you built.** The value is multiplied by platform
maturity: a ₽100k tier on a raw product is a con, and it carries no value at
all. Raising the subscription pays off after investment in the platform, not
from month one.

**A promise has to be serviced.** The tier is not paid for in words:

```
upkeep = connected × (₽2,400 + 0.30 × subscription)
```

Collecting a subscription and delivering nothing is not possible in this model —
the cost is booked automatically, alongside the revenue.

**The tier picks your clientele.** A 150-seat club walks away from ₽100k; a
seven-thousand-seat stadium does not. A high subscription changes not only the
money but the shape of the listings: the long tail disappears, breadth falls,
and that feeds back into demand through listing strength. Measured (founder's
equity, 12 seeds):

```
                 ₽0      ₽70–80k     ₽120k
lean           7.45      10.15        6.30 B   (organisers 1071 → 540)
mid            8.91      12.07       10.06 B   (organisers 1489 → 910)
wide          11.16      16.60       15.32 B   (organisers 1746 → 1128)
```

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

The reach → organisers → listings → buyers flywheel has a critical mass: the
brand is forgotten at 7.5% a month, and until marketing outruns forgetting
with a margin, equilibrium reach stays small and gives no pull. Measured on
the platform anchor: $400K/mo of marketing ends at $30M, $500K/mo at $63M.
Below roughly $450K/mo the flywheel never starts, and almost every other
investment runs at a loss — the most common answer to "why does nothing
grow for me".

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
turnover  = (listings tickets + widget tickets) × average price
revenue   = listings turnover × (fee + commission) + widget turnover × rate + subscriptions
acquiring = turnover × 0.022
```

**Acquiring comes out of your share, not the organiser's.** That is why a low
commission is more dangerous than it looks: a 3% take rate minus 2.2%
acquiring is almost nothing. Billions pass through the service; percentages of
it are yours, and one of those percentages goes to the bank.

---

## 6b. The hit of the month is announced in advance

The city is not the same every month: a stadium tour arrives, a derby is played,
a headline premiere opens, a festival happens. A hit raises demand, site load and
reseller interest all at once.

The point is that it is **visible a month ahead**. The announcement is what
turns capacity headroom into a decision: holding it all year is expensive, it
cannot be bought on the on-sale day — so you prepare exactly when the hit is
announced. If hits landed in the same turn, headroom would be bought blind,
and there would be no decision to make — only something to watch.

The chance of a hit depends on the season (34% in summer, 30% in winter, 26%
otherwise) and on whether you have organisers of the right type: somebody else's
tour does nothing for your listings.

## 6c. An advance is a loan, not a fee

An exclusive is not bought with money for rights but with an **advance against
future sales**: the organiser takes ₽120–500M now — for a production, a tour, a
venue — and repays it out of the revenue of their own tickets.

```
withheld per month = that type's turnover × 35%
term               = 12 months
not repaid by then -> written off as a loss
```

Three things follow that an ordinary commission does not have. **A cash gap:**
the money leaves in one payment and comes back over a year. **Repayment is not
revenue:** while the debt is open the inflow returns principal, so it is in the
cash and not in the profit. **Recoupment risk:** if the halls did not sell, there
is nothing to repay from, and the remainder is written off — the organiser sold
what they sold and does not owe the difference out of pocket.

This is why ticketing operators carry a large balance sheet on a thin margin:
they do not only take a percentage, they finance the market.

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

## 7a. Crises

A crisis is not a one-month multiplier but a problem that hangs on the
company, escalates every month (up to severity 5) and demands an explicit,
costly decision. The chance of a new one grows with turnover — a successful
service gets judged, written about and hunted:

```
monthly chance = 0.05 + 0.10 × min(1, GMV / $20M)
```

A three-month cool-down follows a resolution. A run sees 2–4 of them
(measured, 24 codes). Resolving is mandatory: the same anchor strategy ends
at a median of ~$40M with crises resolved and ~$8M with them ignored, often
in a distressed sale. Nearly every crisis hits trust while turnover holds up
for a while — the numbers look fine right up to the month it is too late.

Before the 2026-08 recalibration full frequency required a monthly GMV of
$60M, which runs never reached — nineteen written crises almost never fired.
Absolute figures in any measurement taken before that change are roughly half
of today's (crises are now part of normal play); the ratios between variants
still hold.

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
| 1 | monthly turnover of ₽1.2B or more | shareholders inject money themselves, your stake is cut by 18% |
| 2 | at least 3 profitable months with turnover above ₽700M | marketing capped for six months |
| 3 | 65% market share with 420+ organisers | valuation drops by 15% |

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

---

## The cost of what is already built

What you have built has a cost of ownership. If the spend were written off once
while the accumulated level stayed forever and cost nothing, the "invest in
technology" lever would be dishonest: pay once, enjoy the advantage forever.
That is not how it works, and two cost lines carry that price.

**Upkeep.** Every feature built has to be maintained: libraries updated, breakage
from other changes fixed, new people taught. The bill arrives every month and
does not depend on whether anyone uses the feature:

```
upkeep = cumulative investment × 1.25% в месяц
```

It is computed from the amount invested, not from the level. The level
saturates; the maintenance bill does not. So "invest a large sum at once" is not
a one-off cost but a permanent obligation.

**Infrastructure.** Servers grow with tickets sold: `servers = tickets × ₽1.4 × (1 − 0.30 × product level)`. Capacity headroom (a separate lever) covers the peak on the on-sale day; this line covers the steady traffic every month.

The point of splitting these two lines out of "office and administration" is
behavioural: the base fixed part is small, while upkeep and servers grow with
the product and the sales. Costs breathe together with the business, and every
"invest more" decision carries a tail of future obligations.

**Staff.** Beyond account managers (their own slider) the operator has a team you
cannot set to zero: integrations, finance, legal, second-line support. It grows
with the number of organisers being served: `staff = organisers × ₽6,000/mo`.
Together with the office (₽22M/mo) these are the fixed costs of scale: a passive
game of "sliders at midpoint, no funding rounds" no longer survives to the end
on the starting cash.
