# The economic model: formulas and assumptions

*[Русская версия](../economics.md)*

This document describes exactly what `games/foodtech/src/model/engine.js` computes. Every constant that
appears in the formulas lives in `games/foodtech/src/model/config.js` and can be changed by the instructor.

The time step is **one week**. All flows (orders, revenue, costs) are weekly; all stocks
(customers, couriers, restaurants, cash) are end-of-week values.

---

## 1. The overall structure

```
marketing ──► awareness ──► trial orders ──┐
                                           ├──► CUSTOMER BASE (a stock)
          satisfaction ──► churn ──────────┘          │
                                                      ▼
price, speed, selection, season ────────────►  order frequency
                                                      │
                                  demand = base × frequency
                                                      │
                            courier capacity ──► the constraint
                                                      │
                                        orders delivered
                                                      │
                                  revenue ─► P&L ─► cash
```

The central feedback loop, around which the whole game is built:

> not enough couriers → delivery time rises → satisfaction falls →
> customer churn rises → demand falls → revenue falls → no money to pay couriers

Note that delivery time enters the model with a one-week lag. This is not a convenience:
a customer reacts to the experience they have already had. That lag is what allows the
system to oscillate, exactly as real operations do.

---

## 2. The city

Six districts, each with its own profile. The average basket depends on district income:

```
average basket = ₽900 × (income level) ^ 0.7
```

The addressable market is smaller than the population: some residents are firmly locked
into a competitor.

```
addressable market = potential × (1 − competitor strength × 0.6)
```

This is a ceiling on reach. Downtown has a competitor strength of 0.5, so at most 70% of
its 130,000 residents can ever be yours, no matter what you spend on marketing. The lesson:
market share is limited not only by your budget but by the structure of the market.

---

## 2b. Weather

Weather applies every week rather than appearing occasionally as an event. The type is
drawn from a seasonal table (week 1 is the start of January):

| Season | Weeks | What can happen |
|---|---|---|
| Winter | 49–52, 1–8 | clear, snow, hard frost, ice, storm |
| Spring | 9–21 | clear, rain, storm, frost |
| Summer | 22–34 | clear, rain, storm, heat |
| Autumn | 35–47 | clear, rain, storm, frost |

Each weather type sets three numbers: a demand multiplier, a capacity multiplier and an
addition to courier churn. The key property is that they point in opposite directions:

```
storm: demand ×1.30,  capacity ×0.80,  churn +12 pp
ice:   demand ×1.10,  capacity ×0.74,  churn +16 pp
```

In a storm, courier utilisation rises from both ends at once: 1.30 / 0.80 = ×1.63. That
combination — a demand peak during a capacity trough — is what breaks delivery times in
real services, and it is why weather is a system of its own here rather than a random event.

**The forecast is public.** Next week's weather is known to the player in advance: weather
reports are available to everyone, and hiding them would be artificial. The point is that
hiring this week puts couriers on the road next week, so the forecast is a call to action
rather than a hint.

**The bad-weather bonus** is a conditional cost:

```
coverage      = min(1, bonus / ₽80)
pay per order = bonus × severity × 0.4
capacity      = base + (1 − base) × 0.70 × coverage
churn         = base × (1 − 0.85 × coverage)
```

The 0.4 factor reflects that even a severe storm rarely lasts a full week. In clear weather
severity is 0, so the bonus costs nothing — the expense appears exactly when shifts would
otherwise be abandoned.

Economically it is an alternative to keeping spare couriers: permanent excess headcount
costs money all 52 weeks, while the bonus is only paid in bad ones. With a thin roster the
bonus wins; with a large buffer it becomes wasted spending.

---

## 3. Demand

A customer's order frequency is a product of multipliers, each equal to 1.0 at the
reference point:

```
frequency = base frequency × Price × √Speed × √Selection × season × weather × events
```

**Price.** The customer sees the full amount: basket + delivery − promo.

```
Price = ( (basket + 149) / (basket + fee − promo) ) ^ elasticity,   clamped to 0.20…2.50
```

Elasticity differs by district: 0.8 in the Suburbs (the wealthy do not notice) and 2.2 on
Campus (students count every rouble). This is the most vivid lesson in the game: the same
discount produces a different lift in different districts and an identical hit to margin.

**Speed.**

```
Speed = (35 min / last week's delivery time) ^ 0.6,   clamped to 0.40…1.30
```

**Selection.** A saturating function of connected restaurants, normalised so that 80
restaurants give 1.0:

```
Selection = [ R / (R + 50) ] / [ 80 / 130 ],   clamped to 0…1.35
```

At R = 0 the multiplier is zero: with no restaurants there is nothing to order, and no
amount of marketing fixes that.

**Seasonality.** An annual sine wave of ±10% plus a +15% New Year spike.

```
district demand = district customers × frequency
```

---

## 4. Supply: couriers

```
orders per courier = 105 × (1 + 0.35 × tech level)
                         × (3.5 km / average leg) ^ 0.45
                         × morale
                         × batching effect (see section 7b)
                         × weather
```

Morale is a lagged indicator: `clamp(0.85 + 0.15 × earnings/market, 0.75, 1.08)`. An
underpaid courier does not quit instantly — they simply work at half effort and take orders
from a competitor (multi-apping).

```
capacity            = couriers × orders per courier
district capacity   = capacity × district share (see section 7b)
district utilisation = district demand / district capacity
delivered           = min(district demand, district capacity)
```

Without the allocation algorithm, capacity is split in proportion to demand, so utilisation
is identical everywhere and equal to the citywide figure.

Delivery time grows cubically with utilisation — this is a queue model:

```
time = base × (1 + 0.85 × min(utilisation, 2.2)³) × (1 − 0.12 × tech)
```

| Utilisation | Time multiplier |
|---|---|
| 50% | 1.11 |
| 70% | 1.29 |
| 85% | 1.52 |
| 100% | 1.85 |
| 120% | 2.47 |
| 150% | 3.87 |

The practical conclusion students usually reach on their own: above 90% utilisation this
is no longer arithmetic but an avalanche. Optimal utilisation is lower than it looks —
delivery speed is the dominant retention driver, so spare capacity often pays for itself.
Two things hold it back: courier upkeep (₽2,200/wk per person) and the fact that an idle
courier earns little and leaves.

### The labour market

A candidate judges expected, not actual earnings: they see the rate and assume they can
fill at least 75% of a shift.

```
expected earnings = rate × 0.75 × orders per courier
attractiveness    = expected earnings / ₽14,000 (the market alternative)

applications = 400 × clamp((attractiveness − 0.9) / 0.6, 0, 1.4) × (1 + 0.6 × awareness)
```

Below the threshold there are simply no applicants: a rate below market means nobody comes
out for a shift. Hiring is capped by applications, and each hire costs ₽8,000 up front
(screening, training, equipment).

Churn is computed from **actual** earnings — idle time annoys a courier as much as a low
rate. Note the 1.15 threshold: it is not enough for a courier to earn "the market rate",
they need a premium for the instability.

```
churn = 0.05 + max(0, 1.15 − actual earnings/market) × 0.55
            + max(0, utilisation − 0.9) × 0.35
            + weather
```

---

## 5. Supply: restaurants

```
viability      = clamp((0.30 − commission) / 0.12, 0, 1)
attractiveness = (0.35 + 0.65 × √(orders per restaurant / 45))
                 × (0.20 / commission) ^ 0.8
                 × (0.25 + 0.75 × viability)
sales power    = 0.35 × (sales budget / 150,000) ^ 0.6          (capped at 0.8)
signed up      = remaining pool × min(0.4, sales power × attractiveness × 0.5)
churn          = 0.015 + max(0, 1 − attractiveness) × 0.12
```

The 0.35 term represents pioneers: some restaurants join even at zero order flow, otherwise
a marketplace could never be started at all (the classic chicken-and-egg problem).

The viability multiplier is a hard ceiling on commission. A restaurant has its own
economics: above roughly 30% delivery is loss-making for them at any volume, and no amount
of order flow compensates. Without this constraint, "raise the commission" would be a
dominant strategy. The commission restaurants perceive is lowered by the flexible-rate
algorithm.

---

## 6. Customers: stock and flows

**Awareness** is a cumulative stock, not a one-off advertising effect:

```
gain       = 0.30 × (spend per potential customer / ₽12) ^ 0.55     (capped at 0.35)
awareness += (1 − awareness) × gain − awareness × 0.05
```

The 0.55 exponent is diminishing returns: doubling the budget adds about 46% to the gain,
not 100%. Subtracting 5% is forgetting: stop spending and awareness slides back down.

**Satisfaction** is a weighted assessment of the experience:

```
satisfaction = 0.35 × Speed + 0.25 × Selection + 0.25 × Price
             + 0.15 × (1 − 2 × share of undelivered orders in the district)
             − algorithm penalties (surge, targeting)
```

Speed carries the most weight — in food delivery it genuinely is the primary retention factor.

**Customer flows:**

```
trial orders = (addressable market − customers) × awareness × 0.05
               × satisfaction × Selection
word of mouth = customers × 0.02 × max(0, satisfaction − 1)
churn        = customers × (0.07 + max(0, 1 − satisfaction) × 0.30
                            + competitor strength × 0.012)

customers(t+1) = customers(t) − churn + trials + word of mouth
```

A base churn of 7% a week means that even with perfect service a customer lasts about
14 weeks. A customer who is bought but not retained disappears within a quarter — which is
precisely why marketing without service quality is a subscription to losses.

---

## 7. Money

### The economics of one order

```
service revenue = basket × commission + delivery fee
variable costs  = courier pay + promo + payment processing (1.8% of what the customer pays)
                  + support (₽14, reduced by up to ₽8 through technology)
contribution    = revenue − variable costs
```

Take rate is the share of the basket the service keeps. In the game it usually lands at
30–40%, above the real-world 20–30%: the model is slightly generous so that reaching profit
is visible within 52 weeks.

### The weekly P&L

```
GMV              = Σ orders × district basket
revenue          = commission + delivery fees
contribution     = revenue − variable costs
fixed costs      = district running costs + office (₽900K + ₽2,200 × couriers)
                   + marketing + sales + technology + data science
operating profit = contribution − fixed costs
one-off costs    = district launches + hiring + algorithm rollouts + event costs
cash(t+1)        = cash(t) + profit − one-off costs
```

Cash below zero is bankruptcy and the game ends. A company dies of an empty account, not
of a loss: these are different things, and the game lets you feel the difference.

**Break-even:**

```
orders per week to break even = fixed costs / contribution per order
```

If contribution per order is negative, break-even does not exist at any volume. That is the
first thing to check whenever "we will grow into profitability" comes up.

---

## 7b. Algorithms: second-order optimisation

An ordinary lever sets a **number**: a delivery fee of ₽149 — for every customer, at every
hour, in any weather. An algorithm sets a **rule**: price = f(utilisation),
discount = f(customer), headcount = f(forecast). A rule can be different in different
circumstances, so it can improve both ends of a trade-off that a single number cannot resolve.

That is what second-order optimisation means: you optimise not the value of a parameter but
the function that chooses the value.

### Algorithm quality

```
data    = cumulative orders / (orders + 400,000)
team    = data science spend / (spend + ₽25M)
quality = √(data × team)
```

A geometric mean, not an arithmetic one: if either factor is zero, quality is zero. You
cannot train a model without data, and nobody turns data into decisions without a team.
Hence the natural order of operations — volume first, algorithms second. Data science bought
before the orders exist is simply a cost line.

Each algorithm requires a minimum quality to become available and a one-off rollout payment.
Once live, it is tuned with a slider.

### Order batching

```
orders per courier ×= 1 + 0.60 × aggressiveness × quality
delivery time      ×= 1 + 0.16 × aggressiveness × (1 − 0.6 × quality)
rate per order     ×= 1 − 0.20 × aggressiveness × quality
```

A second address on the way costs the platform less than the first, so the rate for an
individual order in a batch is lower — while the courier's weekly earnings rise, because
they complete more orders. The price is time: an order waits for a companion and travels
a chain. The worse the batching algorithm, the more time suffers for the same gain.

### Targeted discounts

```
lift             = 1 + precision × (1/reach − 1) × 0.75
cost per order   = promo × reach
effect on demand = min(promo × (0.4 + 0.6 × precision), promo × reach × lift)
satisfaction penalty = (1 − reach)² × (1 − precision) × 0.35 × min(1, promo/50)
```

At 30% reach and 0.8 precision you get the effect of a ₽53 discount while paying ₽28 — the
same lift in demand for half the money. This is price discrimination in its purest form.

Three constraints stop you from shrinking reach to nothing: a ceiling on the effect (even a
perfect model cannot create more demand than discounting everyone), the falling absolute
effect as reach narrows, and a quadratic penalty for perceived unfairness. The optimum sits
inside the range.

### Surge pricing

```
premium        = strength × clamp((utilisation − 0.7) / 0.6, 0, 1)
delivery fee  ×= 1 + 0.35 × premium
demand        ×= 1 − 0.10 × premium      (some orders shift or are abandoned)
delivery time ×= 1 − 0.12 × premium × quality
satisfaction penalty = strength^1.5 × (0.03 + 0.35 × premium) × (1 − 0.5 × quality)
```

The premium only appears above 70% utilisation. Surge earns twice: directly, through a
higher price at peak, and indirectly, by flattening the peak and speeding delivery up for
everyone. It pays for this in customer irritation, and the penalty grows faster than the
premium — which is why maxing out the slider is a losing move.

### Smart courier allocation

```
district weight   = demand × (1 + 2.5 × skew × quality × (district contribution / average − 1))
district capacity = total capacity × weight / Σ weights
```

Capacity is committed to a district: spare couriers in one district do not rescue the one
next door, they simply idle. Without the algorithm, weights equal demand and utilisation is
identical everywhere. With it, the profitable district gets more couriers and the rest get
fewer, where delivery times and churn both rise.

An important property: with surplus capacity the algorithm can only do harm. It is useful
precisely when couriers are short — that is, at the least convenient moment.

### Flexible commission

```
commission for revenue          = rate × (1 − 0.06 × spread)
commission as restaurants see it = rate × (1 − 0.35 × spread × quality)
```

Large, in-demand partners get a preferential rate and the rest pay more. Average revenue
falls slightly while the perceived rate falls considerably, so the algorithm lets you hold
a higher rate card without losing partners. This is segmentation instead of a single price —
the same idea as targeted discounts, applied to the other side of the marketplace.

### Demand forecast and auto-hiring

```
forecast = demand × growth rate × weather shift × (1 + error),   error ~ ±0.30 × (1 − quality)
target headcount = forecast / orders per courier / target utilisation
```

The headcount slider stops being used. You no longer choose a number of couriers, you choose
a **policy**: the target utilisation. Low utilisation means fast delivery and an expensive
roster; high utilisation means savings and a risk of missing your promises. The forecast
accounts for next week's weather, which is exactly when the hires you make today go out.

### The counterfactual breakdown

The game answers the question "what did this algorithm actually earn" honestly: the previous
week is re-simulated with the algorithm switched off and the difference is displayed in the
interface. In a real company that answer costs weeks of A/B testing — and frequently turns
out to be zero.

---

## 8. Valuation and funding rounds

```
growth   = orders over the last 4 weeks / orders over the previous 4
margin   = profit / revenue
multiple = 2.0 + 5 × min(growth − 1, 1) + 4 × max(0, margin/0.25) + 1.5 × min(0, margin/0.25)
valuation = annual revenue × multiple     (never below ₽40M)
```

A funding round:

```
dilution   = round size / (valuation + round size)
your stake ×= (1 − dilution)
```

The final score is **valuation × your stake**. Raising as much money as possible is
therefore not a strategy: every round at a low valuation costs you a piece of the company.
Early money is the most expensive money there is.

---

## 9. What the model deliberately simplifies

* **The competitor does not adapt.** Its strength is a per-district constant and it never
  responds to your prices. Real competitive dynamics — price wars, restaurant exclusives —
  are out of scope.
* **Customers are homogeneous within a district.** No frequency cohorts, no subscription,
  no premium segment.
* **Logistics is compressed into one number** — orders per courier. No batching geometry,
  no zones, no peak hours within a week.
* **Restaurants do not negotiate individually** (apart from one event about a large chain).
* **No taxes, depreciation or working capital** — cash flow only.
* **Algorithms are described by their effects, not their implementation.** There is no
  router and no propensity model in here: there are coefficients that capture what such
  systems do to the economics. Algorithm quality is a single scalar, whereas in reality
  every model has its own accuracy and its own shelf life.

All of this keeps the model transparent: any number on screen can be traced back to a
formula in a couple of steps. For a teaching tool, that matters more than realism.

---

## The cost of what is already built

The "invest in technology" lever used to be dishonest: the spend was written off
once, the accumulated level stayed forever and cost nothing. That is not how it
works. Two lines were missing from the model.

**Upkeep.** Every feature built has to be maintained: libraries updated, breakage
from other changes fixed, new people taught. The bill arrives every week and
does not depend on whether anyone uses the feature:

```
upkeep = cumulative investment × 0.34% в неделю
```

It is computed from the amount invested, not from the level. The level
saturates; the maintenance bill does not. So "invest a large sum at once" is not
a one-off cost but a permanent obligation.

**Infrastructure.** Servers grow not from your decision but from orders: `servers = orders × ₽1.9 × (1 − 0.35 × tech level)`. It is the one line that gets more expensive exactly when things go well — and the one technology pays back directly.

Both lines used to hide inside "office and administration" and grew with neither
the product nor the load. The base fixed line was reduced by exactly what these
two add under the reference strategy, so the balance did not shift — but the
behaviour did: costs now grow together with the business.
