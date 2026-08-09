# Streaming economics model: formulas and assumptions

*[Русская версия](../economics.md)*

This document describes exactly what `games/cinema/src/model/engine.js` computes. Every
constant that appears in the formulas lives in `games/cinema/src/model/config.js` and can
be changed by the instructor.

The time step is **one month**. All flows (sign-ups, hours, revenue, costs) are monthly;
all stocks (subscribers, catalogue, cash, accumulated data) are end-of-month values.
A game lasts 36 months.

---

## 1. The overall picture

```
marketing ──► awareness ──► free trials ──────────┐
                                                  ├──► SUBSCRIBER BASE (stock)
   boredom, price, ads ──► churn ─────────────────┘          │
                                                             ▼
licensing budget ──► catalogue (rented, expires) ─┐    watch hours
studio budget ──► pipeline (6 mo) ──► premieres ──┤          │
                                                  │          ▼
                                        depth + freshness   bandwidth (cost)
                                                  │          │
                                    revenue = subscriptions + advertising
                                                  │
                                          P&L ──► cash ──► funding ──► your stake
```

Three feedback loops the whole game is built around:

> **The staleness spiral.** No premieres → churn rises → revenue falls → the content
> budget is cut → even fewer premieres.

> **The one-show syndrome.** A loud premiere brings a crowd → the crowd finishes it →
> the crowd leaves. A single hit with nothing behind it is a loan, not growth.

> **The engagement trap.** Viewers watch more → they are more loyal → but bandwidth
> outruns the subscription and rising hours eat the margin.

The key difference from the delivery game: here **revenue per person is fixed**
(a subscription) while cost per person grows with engagement. That inverts the usual
logic — growth in engagement is something to calculate, not to celebrate.

---

## 2. The catalogue: renting versus owning

The catalogue is the central stock of the game. It is filled in two ways with
fundamentally different economics.

### Licences

```
hours_bought  = licensing_budget / licenseCostPerHour × forecast_efficiency
licensed(t)   = licensed(t−1) × (1 − licenseDecay) + hours_bought
```

`licenseCostPerHour = ₽600,000`, `licenseDecay = 0.045` — 4.5% of the library expires
every month. Licences arrive **immediately**: pay this month, it is on the shelf this
month.

### Originals

```
studio_fund(t) = studio_fund(t−1) + originals_budget
while studio_fund ≥ project_cost:
    studio_fund −= project_cost
    into the pipeline: { hours, quality, monthsLeft = originalLeadMonths }

project_cost    = originalCostPerHour × costPerHour(genre) × hours(genre)
project_quality = clamp(0.55 + 0.5 × luck + 0.25 × tech_level, 0.25, 1.45)
```

`originalCostPerHour = ₽31,000,000` — **fifty times** a licensed hour.
`originalLeadMonths = 6`: half a year between the decision and the premiere. It is the
only lever in the game with that kind of lag, and it produces the classic beginner
mistake — seeing churn rise and starting a show that will land long after it mattered.

An unused budget is **not lost**: the studio fund carries over. "Half a project a month"
is a working strategy, just a slow one.

### Catalogue depth

Hours are not hours. Rivals have the same licences; only you have your exclusives:

```
weighted   = licensed × licenseDepthWeight + original × originalDepthWeight
           = licensed × 0.5 + original × 6
depth      = saturation(weighted / refCatalogHours)
own_share  = original × 6 / weighted
```

A 12:1 weight ratio against a 50:1 price ratio is the whole trade-off. An hour of
exclusive content retains like a dozen hours of someone else's library — and costs five
times that dozen. **Neither extreme works:** licences alone give you nothing to hold
people with (own share = 0, no exclusive retention), originals alone leave six months
with nothing to watch and the cash runs out before the first premiere.

### Freshness

```
new(t)    = new(t−1) × (1 − freshDecay) + premiere_hours + bought × licenseFreshShare
freshness = √(new / refFreshHours), capped
```

`freshDecay = 0.22` — a release stops feeling new in roughly four months.
`licenseFreshShare = 0.10`: a bought licence barely counts as new — it is someone else's
and often not first-run. The feeling that "something new has appeared" comes almost
entirely from your own premieres.

Freshness enters churn directly:

```
boredom = max(0, 1 − freshness) × freshnessWeight(segment) × 0.055
```

The catalogue can lose not a single hour and still lose subscribers, because viewers see
the same shelf. This is the most common way to lose the game.

---

## 3. Subscribers: two tiers, four segments

### Tier choice

Each segment splits itself between the paid and the ad-supported tier:

```
saving      = (ad_free_price − ad_tier_price) / ad_free_price
ad_pain     = (ad_load / refAdLoad) / tolerance(segment)
ad_share    = clamp(0.12 + 0.85 × saving × tolerance − 0.12 × ad_pain, 0.02, 0.94)
```

Hence a non-obvious consequence: **cutting the cheap tier's price poaches people from
your own expensive one**. Cannibalisation is not a side effect, it is the main mechanism.

### Inflow

```
blended_price = premium × (1 − ad_share) + ad_price × ad_share
price_factor  = (399 / blended_price) ^ elasticity(segment)
appeal        = depth^(0.6 × depthWeight) × freshness^(0.5 × freshnessWeight)
ad_penalty    = 1 − 0.16 × ad_pain × ad_share × (1 − relief)

trials    = untapped × awareness × 0.055 × price_factor × appeal × ad_penalty
            × rival_lineup × (1 + premiere_pull × 0.6)
converted = trials × trialConversion × trial_length_factor
```

`untapped = potential(segment) − current subscribers`: the closer you are to a segment's
ceiling, the more expensive each further subscriber becomes.

### Awareness

```
per_viewer = (marketing × segment_share_of_market) / potential
gain       = clamp(0.28 × (per_viewer / refMarketingPerViewer)^0.55, 0, awarenessMaxGain)
awareness(t) = awareness(t−1) + (1 − awareness) × gain
               − awareness × awarenessDecay + premiere_pull × 0.02
```

The exponent 0.55 produces diminishing returns: quadrupling the budget does not quadruple
the effect. `awarenessDecay = 0.06` — a brand is forgotten unless it is repeated.

Note that awareness is **multiplied** by catalogue appeal. Marketing against an empty
catalogue burns for nothing — there is nowhere to bring the viewer.

### Churn

```
churn = (baseChurn × loyalty + boredom + price_anger + ad_anger + quality_annoyance)
        × exclusive_hold
      + rival_lineup + hangover × 0.018 × freshnessWeight
      − premiere_buzz × 0.030

exclusive_hold = 1 − exclusiveRetention × own_share = 1 − 0.40 × own_share
```

`baseChurn = 0.035` — 3.5% a month with a perfect service, i.e. an average subscription
life of about 29 months. Real churn in the game usually runs 5–12%, i.e. 8–20 months.

**Hangover** is a stock of its own. A premiere adds `buzz × hangover(genre)` to it, and
next month that stock works on churn. This is how "finished it, cancelled" is modelled:
a blockbuster has `hangover = 1.0`, family animation `0.1`.

---

## 4. Watch hours and bandwidth

```
hours(segment) = subscribers × baseHoursPerSub × baseHours(segment) × season
                 × depth^0.35 × (1 + 0.22 × recommendations × quality)
                 × rival_lineup

per_hour = cdnCostPerHour × (bitrate / refBitrate) × (1 − 0.30 × tech_level)
           × (1 − encoding_saving)
bandwidth = hours × per_hour
```

This is the **only large variable cost line** of a subscription business — and it grows
with the loyalty of the audience. Families watch one and a half times as much as the
mainstream: they are the most loyal and the most expensive.

The teaching point: in a subscription business "engagement" is not a success metric,
it is a cost line. Success is when hours convert into retention faster than into a
bandwidth bill.

---

## 5. Revenue

```
subscriptions = ad_free_subs × premium_price + ad_subs × ad_price
impressions   = ad_hours × ad_load × 2 × adaptive_ads_yield
advertising   = impressions / 1000 × cpm
revenue       = subscriptions + advertising
```

`cpm = ₽480`, a spot is 30 seconds, hence the factor of 2 (spots per minute).

```
variable costs = bandwidth + support + retention discounts
contribution   = revenue − variable costs
fixed costs    = hqMonthly + licensing + originals + marketing + technology + data science
profit         = contribution − fixed costs
```

The content budget is deliberately classed as a fixed cost: it does not depend on how many
subscribers you have this month. That gives a direct break-even calculation:

```
break-even subscribers = fixed costs / contribution per subscriber
```

That number is on screen every month. It explains why streaming is a scale business:
fixed costs are enormous, contribution per subscriber is small, and everything comes down
to whether you can build the base before the cash runs out.

---

## 6. The rival's line-up

The analogue of weather in the delivery game: a permanent external background, not a rare
event. Every month a rival release is drawn from a seasonal table.

| Line-up | New sign-ups | Churn | Hours |
|---|---|---|---|
| Nothing notable | — | — | — |
| Minor release | −7% | +0.4 pp | −2% |
| Notable release | −16% | +1.2 pp | −5% |
| Major release | −28% | +2.4 pp | −9% |
| Event of the year | −42% | +4.0 pp | −14% |

Winter brings more and louder rival premieres, summer noticeably fewer. The season also
scales watch hours: `winter 1.18`, `spring 1.00`, `autumn 1.06`, `summer 0.84`.

**The line-up is known a month in advance** — rival release dates are published long
before the release. The value is not in the information but in the reaction. There are
three answers:

1. **Counter-programming.** Your own loud premiere in the same month partly cancels
   theirs: `counter = min(0.65, own_buzz × 0.45)`. Viewers choose rather than leave.
2. **Wait it out.** Spread the release (the `pacing` algorithm) or pull marketing for a
   month — do not spend money in a month when attention is taken anyway.
3. **Ignore it.** Sometimes the right answer: a minor rival release is cheaper to absorb
   than to answer.

There is a real trap here: releasing your premiere against the "event of the year" is the
loudest move, not the most profitable one. Counter-programming is capped at 65%, whereas
the same premiere in a quiet month collects the whole effect.

---

## 7. Algorithms: second-order optimisation

A slider sets a **number** ("price = ₽399"). An algorithm sets a **rule** ("discount =
f(this particular viewer's churn risk)"), and a rule can differ across circumstances.

Algorithms unlock as quality grows:

```
quality    = √(data_level × team_level)
data_level = saturation(accumulated watch hours / dataSaturation)
team_level = saturation(spent on data science / rndSaturation)
```

The geometric mean means **neither factor rescues a zero in the other**: a team without
data is exactly as useless as data without a team. Data accumulates only from viewing —
so algorithms arrive later the smaller your audience is.

| Algorithm | Unlock | What it does | What it costs you |
|---|---|---|---|
| Recommendation feed | 0.10 | the perceived catalogue is larger than the real one | with a weak model the feed collapses into a bubble |
| Content demand forecast | 0.18 | the same budget buys the right things | buying drifts towards the already known; depth grows slower |
| Personal retention | 0.28 | the discount goes only to people about to leave | model misses: some who would have stayed get it too |
| Adaptive advertising | 0.36 | the same impressions at less irritation | complexity, and it only works on large data |
| Smart encoding | 0.22 | a cheaper hour of bandwidth | with a weak model the picture degrades |
| Release calendar | 0.44 | the premiere is spread out, churn is smoothed | a lower sign-up peak |

### Recommendations: why the slider has a safe setting

```
lift            = 1 + 0.35 × strength × quality
bubble          = 1 − 0.30 × strength² × (1 − quality)
perceived_depth = depth × lift × bubble
```

The benefit is linear in personalisation strength; the harm is **quadratic**. So the
optimal strength is always interior and moves right as the model improves: a cautious feed
helps even on weak data, while an aggressive one on the same data collapses the catalogue
into a dozen identical cards. That is the central lesson about "smart algorithms": the
question is not whether to switch it on but how hard to push — and the answer depends on
how much you know.

### Counterfactual analysis

The Algorithms tab **re-simulates last month with the algorithm switched off** and shows
the difference. The answer is often close to zero: retention is pointless when churn is
already low, encoding does not pay while traffic is small, and there is nothing to spread
out with the release calendar if there are no premieres. Students see that an algorithm's
value is not a property of the algorithm but a property of the situation.

---

## 8. Events

Once a month, with a 30% chance from month 3 onwards, an event occurs. Five simply happen;
four require a decision:

| Event | Choice | Economic meaning |
|---|---|---|
| A star asks for a cut | pay ₽120M / recast | the bargaining power of talent: a hit's cost grows faster than its audience |
| Sports rights | buy for ₽400M / pass | renting traffic versus building an asset |
| The board demands growth | run a sale / hold the price | growing the base ≠ growing revenue |
| Viewer data leak | own it and compensate / say nothing | the data your algorithms learn from is also a liability |

---

## 9. Valuation and funding

```
run-rate   = revenue × 12
growth     = subscribers over 3 months / subscribers over the previous 3 months
multiple   = clamp(2.2 + 5 × growth + 4 × margin⁺ + 1.5 × margin⁻, 0.5, 12)
library    = original_hours × originalCostPerHour × 0.35
valuation  = run-rate × multiple + library
final score = valuation × your stake
```

Your own library enters the valuation as a **separate term** — it is an asset on the
balance sheet, while licences are not. Here the model says out loud what the whole game
is built to teach: two services with identical revenue are worth different amounts if one
rents its catalogue and the other owns it.

A funding round:

```
dilution  = amount / (valuation + amount)
new stake = old stake × (1 − dilution)
```

The worse things are, the lower the valuation and the more the same money costs. The
valuation floor is ₽300M, so a ₽3B cheque at a weak company takes almost everything.

The final score counts **your stake**, not the size of the company. "Grow at any cost"
produces more subscribers and a smaller result — this is checked by the
`расти любой ценой невыгодно` test in `games/cinema/tests/engine.test.mjs`.

---

## 10. What the model leaves out

This is a teaching model, not a forecasting tool.

* **The rival does not react.** Its line-up is drawn at random and does not depend on your
  actions. Real streaming is a two-sided game; this is a game against nature.
* **No international market.** One language, one country, one audience ceiling.
* **The catalogue is homogeneous within a type.** All licensed hours are alike, whereas in
  practice one show can cost as much as a thousand others.
* **Piracy is not a permanent factor** — only a one-off event.
* **Advertising sells at a fixed CPM.** There is no real ad market with seasonality and
  bidding for inventory.
* **Viewers within a segment are identical.** Personal discounts are modelled as a share,
  not as a distribution over individual people.

The model shows the **structure** of a subscription business: why content is a capital
investment with a lag, why engagement costs money, and why growing the base and growing
the value of your stake are not the same thing.
