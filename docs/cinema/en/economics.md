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

### The anchor title

A catalogue is not uniform inside: among identical-looking rented hours sits a
franchise that a sizeable share of your base signed up for. While the rights are
yours, the whole licensed shelf weighs more:

```
licensed weight = hours × licenseDepthWeight × (1 + 0.22 if the franchise is yours)
```

Its contract runs separately from the rest of the package: 14 months from the
start of the run, a warning three months ahead, renewal for twelve. Renewal costs
money, and the price rises with the rights market and with how loudly your rival
is bidding:

```
price = 210M × √(rights index) × (1 + 0.35 × rival buzz)
```

If you do not renew, the franchise goes to your rival: the hours stay on your
shelf, the reason to stay does not. The base slides for three months (up to
+5.5pp of churn in the first one), and the rival gains buzz.

Measured (24 codes, licence-led anchor strategy): renewing is worth +20% on the
final result — it pays off if you live on rented catalogue. For the studio-led
strategy, which owns its shelf, the same contract is worth only +14%: the
franchise matters most to whoever is left with nothing without it. Renewing in
the last months of the run is pointless — the contract will not have time to
work.

### Originals: a slate, not a budget

Production is not a budget slider but a slate: every project is an object,
and it carries three decisions:

1. **What to commission** — genre × scale × the segment you are aiming at.
2. **When to release it** — a finished project sits in the vault until you say so.
3. **How much campaign to put behind it** — marketing tied to a specific premiere.

```
cost    = originalCostPerHour × costPerHour(genre) × hours(genre)
          × cost(scale) × talent_index
          charged in equal instalments over the production months
quality = clamp(0.55 + 0.5 × luck + 0.25 × (tech − studio_load), 0.25, 1.45)
```

| Scale | Months | Cost | Hours | Buzz |
|---|---|---|---|---|
| Pilot | 4 | ×0.40 | ×0.5 | ×0.45 |
| Season | 6 | ×1.0 | ×1.0 | ×1.0 |
| Flagship | 9 | ×2.6 | ×1.8 | ×2.3 |

Quality is fixed at commissioning, but until the premiere the player sees only a
**range**, narrowing as the project nears completion: a producer knows the budget
and the team, not the result.

### Studio slots

As many projects run in parallel as the studio has slots. A slot costs money every
month whether it is busy or idle, and upkeep grows faster than the count:

```
upkeep          = studioSlotMonthly × slots^1.45
project_quality −= slotQualityDrag × (busy / total)
```

Five parallel productions are not five times one: they also need coordinating, and
each gets less attention. Hence an interior optimum — three slots beats both one
and five.

### The vault: when to release

A finished project does not go out by itself. You can hold it — release into a
quiet month, answer a rival premiere with it, or wait for the high season:

```
buzz = buzz(genre) × buzz(scale) × quality
       × (1 − vaultDecay)^months_held
       × (1 + campaignPower × campaign/(campaign + refCampaign))
       × season^2.2
```

Holding is not free: 4.5% of the buzz evaporates each month. But the seasonal
multiplier raised to 2.2 means a winter premiere is nearly twice as loud as a
summer one — so holding until December usually beats shipping in July. Measured:
season-timed releases return about 6% more than "ship it as soon as it is ready".

### Cadence: the full season or an episode a week

When you release something ready, you choose not only the month but how it comes
out:

| | premiere buzz | hangover | while it runs |
|---|---|---|---|
| Full season | ×1.16 | ×1.55 | — |
| Weekly episodes | ×0.84 | ×0.45 | −2pp of churn, 2 mo. |

Dropping it all at once means a louder peak, but a month later there is nothing
to hold the viewer: they finish and cancel. A weekly release is quieter, but the
premiere lives for six weeks and holds the base the whole time.

Which is better depends on what you stand on. Measured (24 codes): for the
studio-led strategy, which lives on premieres, weekly release is worth +11%; for
the licence-led one, where premieres are seasoning on a rented shelf, it costs
−3% on the median but lifts the lower quartile (3.47 against 2.62 billion). So it
is also a choice between a loud result and a predictable one.

### Aiming at a segment

A project can be aimed at one segment or made broad:

```
pull = appeal(genre, segment) × 2.0    if aimed at this segment
       appeal(genre, segment) × 0.78   if aimed at another
```

Focus is always also a refusal. A mountain of reality TV will not hold cinephiles
however large it gets, while a drama aimed at them collects them and leaves
everyone else cold.

### Catalogue depth

Hours are not hours. Rivals have the same licences; only you have your exclusives.
And your own hours are not equal to each other either: every genre has its own value
for depth and its own rate of ageing.

```
weighted  = licensed × 0.5 + Σ(genre_hours × genre_value) × 9
depth     = saturation(weighted / refCatalogHours)
own_share = weighted_own / weighted
```

**Why an own hour weighs 9 and the catalogue reference sits at 7,500 hours.** An hour
of licence costs ₽600k and weighs 0.5, so ₽1.2M per effective hour. Your own hour is
far more expensive to produce, so without a large weight it would never pay off at
all — the weight of 9 puts its effective price in a comparable range. And the 7,500-hour
catalogue reference is reachable within a game, so depth does saturate: past some point
the next licensed hour stops paying off, which is exactly what makes "licences or
originals" a real choice. Measured, the buying optimum sits inside the slider's range,
and the share of own content in a polished strategy is around 20% — the central lesson
of the game (licences buy a base quickly, your own stays an asset) is confirmed by
measurement, not just by the teacher's guide.

| Genre | Value per hour | Monthly ageing | Cost per hour | Hangover |
|---|---|---|---|---|
| Prestige drama | 1.35 | 0.4% | ×1.25 | 0.45 |
| Blockbuster | 0.90 | 1.2% | ×2.45 | 1.00 |
| Family animation | 1.25 | 0.2% | ×1.55 | 0.10 |
| Reality and shows | 0.50 | 3.8% | ×0.55 | 0.20 |

Reality is the cheapest way to fill a shelf and the fastest way to lose it: two years
later almost nothing of that library is left. Family animation barely ages at all — it
gets rewatched. That difference is exactly why two companies with the same "amount of
content" are worth different amounts.

The weight ratio of roughly 12:1 against a price ratio of 50:1 is the whole trade-off.
An hour of exclusive content retains like a dozen hours of someone else's library and
costs five times that dozen. **Neither extreme works:** licences alone give you nothing
to hold people with and nothing to pull the rival's viewers away with; originals alone
leave six months with nothing to watch while the rival takes the market. The test named
`смешанная стратегия бьёт обе крайности` ("a mixed strategy beats both extremes") checks this.

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

## 3. Price: new sign-ups pay one thing, the existing base another

In a subscription business the price is not one number. An existing subscriber
pays what they signed up at, and moving them to a new price is a separate decision
with a separate cost.

```
list price  = what new sign-ups pay; only they see it
lockedPrice = what the segment's base actually pays on average
gap         = 1 − lockedPrice / list price
```

The gap opens every time you raise the list price and closes on its own — slowly,
as the base turns over. Closing it at once takes one decision, and it costs
subscribers:

```
shock = raiseShockBase × (jump / 0.1)^1.6 × elasticity(segment)
```

The reaction is non-linear: +10% is barely noticed, +40% takes out a visible chunk
of the base. You cannot repeat a rise within four months — people remember, and a
second one in a row costs far more.

### Annual plans

Some new sign-ups can be moved onto an annual plan with a discount:

```
annual_share = clamp(0.10 + 1.5 × discount × willingness(segment), 0, 0.75)
cash         = subscribers × discounted_price × 12   — at once, on sign-up
```

An annual subscriber is **excluded from churn** for the term, **exempt from price
rises** and **cannot switch to the rival**: they are paid up for a year. The value is not the discount but those two properties: it is a loan
against your own future revenue — cash today, a locked price tomorrow. The optimal
discount is interior, around 10%; beyond that you are simply selling cheaper to
people who would have stayed anyway.

---

## 3b. Partnerships: wholesale against retail

There are two fundamentally different ways to bring in subscribers.

**Retail** — marketing and premieres. The person chose you, pays full price, and
leaves when they get bored.

**Wholesale** — distribution inside someone else's subscription: a mobile operator,
a bank, a TV manufacturer, an aggregator. These subscribers arrive cheaply and in
thousands, but:

* you keep a share of the price, not all of it;
* they did not choose you and watch noticeably less;
* when the contract ends they leave all at once, not one by one.

| Partner | Term | Reach/mo | Your share | Hours | Churn |
|---|---|---|---|---|---|
| Mobile operator | 18 mo | 230K | 35% | 55% | 35% |
| Subscription aggregator | 12 mo | 160K | 45% | 60% | 40% |
| Bank bundle | 12 mo | 95K | 62% | 80% | 50% |
| Smart-TV preinstall | 24 mo | 55K | 85% | 125% | 70% |

**The rate is fixed at signing and does not follow your list price.** That is what a
contract is for: you can raise retail prices tomorrow, and the wholesale partner will
keep paying exactly what was agreed until the term ends.

Wholesale subscribers occupy the same segment capacity as retail ones — they are the
same people. You can add them into a single "how many subscribers do we have" figure,
but that is exactly how people fool themselves with a growth chart.

Measured on the tuned strategy:

```
decline everything             ₽232B | 8.96M subscribers
sign everything                ₽221B | 9.42M subscribers
only high-share deals (≥60%)   ₽235B | 9.18M subscribers
```

"Sign everything" produces **more subscribers and less money**. That is the lesson of
the mechanic in one line: growing the base and growing revenue are not the same thing,
and "how many subscribers" means nothing without "where did they come from".

Some contracts are exclusive: signing the operator locks you out of the aggregator.
Distribution is also a choice about who you will **not** be available through.

---

## 3a. Subscribers: two tiers, four segments

### Tier choice

Each segment splits itself between the paid and the ad-supported tier:

```
saving      = (ad_free_price − ad_tier_price) / ad_free_price
ad_pain     = (ad_load / refAdLoad)^1.6 / tolerance(segment)   — convex
ad_ceiling  = clamp(0.72 × tolerance(segment), 0.15, 0.9)
ad_share    = clamp(0.12 + 0.85 × saving × tolerance − 0.12 × ad_pain, 0.02, ad_ceiling)
```

Ad pain is convex: a couple of minutes an hour goes almost unnoticed,
and past that every extra spot annoys more than the previous one. With linear pain the
load optimum sat at zero on every anchor — there was no lever; with convexity each
anchor has an interior optimum at 2–4 min/hr, and heavy load is honestly expensive —
through irritation and because the cheap tier stops counting as a way in (see Inflow).

**The ceiling on the ad tier came out of measurement.** Some viewers will not watch with
ads at any price, and every segment has its own limit: cinephiles 32%, families 58%, the
mass audience 83%, the young 90%.

**The cheap tier's weight in the entry price is intrinsic, not actual.** A newcomer
judges "how much does trying this cost" by the blend of tiers they would consider
for themselves, not by the actual distribution of your base. The ad tier's weight
in that blend is the share of the segment that considers watching with ads at all,
and it fades with ad load: a tier you cannot stand to watch does not exist in a
newcomer's eyes. Were the weight actual, a vicious loop would open: cranking the
list price would inflate the cheap tier's share, the blend would get cheaper — and
demand would rise with the price. With the intrinsic weight the loop is broken, and
price has an honest interior optimum (measured: peak at ₽449, minus two-thirds of
the outcome at ₽999).

**The premium choice feels the full list price.** A newcomer taking the ad-free tier
judges it by its own price, not by the blend:

```
premium_take = clamp((399 / premium_price)^(elasticity × 0.8), 0.10, 1)
premium_new  = converted × (1 − ad_share) × premium_take
downgraded   = (1 − premium_take) × (1 − ad_share) × converted
               × clamp(0.5 × tolerance, 0, 0.9)   — onto the ad tier
```

Those scared off the premium tier partly step down to the cheap one (as far as the
segment tolerates ads); the rest do not sign up at all.

Hence a non-obvious consequence: **cutting the cheap tier's price poaches people from
your own expensive one**. Cannibalisation is not a side effect, it is the main mechanism.

### Inflow

Inflow splits into two independent questions that must not be confused:

1. **How many people will subscribe at all this month.** That depends on the best offer
   on the market, not only on yours.
2. **Which of the two gets them.** That is decided by preference (see section 6).

```
ad_weight   = clamp(0.5 × tolerance, 0.15, 0.75)
              × clamp(1 − 0.12 × max(0, ad_pain − 1), 0, 1)
entry_price = premium × (1 − ad_weight) + ad_price × ad_weight
paid_price  = lockedPrice × (1 − ad_share) + ad_price × ad_share
list_factor = (399 / entry_price) ^ elasticity(segment)  — for new sign-ups
paid_factor = (399 / paid_price) ^ elasticity(segment)   — for the existing base
appeal      = depth^(0.6 × depthWeight) × freshness^(0.5 × freshnessWeight)
ad_penalty  = 1 − 0.16 × ad_pain × ad_share × (1 − relief)

quality(side)   = list_factor × appeal × ad_penalty
category_trials = untapped × market_awareness × 0.115
                  × max(quality_you, quality_rival) × line-up × events
trials          = category_trials × preference × (1 + premiere_pull × 0.6)
converted       = trials × trialConversion × trial_length_factor
```

`untapped = potential(segment) − your subscribers − his`: the closer the market is to
saturation, the more expensive each further subscriber — regardless of who has them now.

**New sign-ups look at the list price; existing subscribers are annoyed by what they
themselves pay.** Until the base is moved onto the new list price, a rise does not
irritate them — that is the whole point of the gap: it lets the price grow without
paying in churn straight away. Churn uses `paid_factor`, inflow uses `list_factor`.

The split matters: service quality must enter the viewer's decision once. If it
entered both the inflow and the choice between services, it would effectively be
squared — any imbalance would instantly turn into a rout, and you could not learn
anything from an experiment.

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

**Buzz fatigue** (added in the 2026-08 audit). A city cannot be amazed every
month: each premiere tires the audience in proportion to its raw buzz, and
until the fatigue decays (−40% a month) the next premieres ring quieter — by
`1/(1 + 0.5 × fatigue)`. On top of that the buzz-to-trials conversion is
concave (`buzz^0.85`): market attention saturates. Without these two
mechanics a conveyor of loud premieres cancelled the hangover by
construction — the next spike arrived before the previous one wore off —
and the mass-market blockbuster dominated at 2.1× (measured). It now stays
the peak (~1.2×) but pays for the frequency of its noise, and outside the
mass segment it loses to retention genres.

**Annual plans are a loan, not earnings** (same audit). An annual prepayment
arrives as cash at once, but the final score deducts the unearned months as
a liability (deferred revenue): before that, merely enabling annual plans
doubled the score — a premiere spike caught into annuals stayed in the till
rouble-for-rouble even after the viewers left. With the deduction the annual
discount has an interior optimum (10–15%); both “monthly only” and an
aggressive 30% are live but inferior answers.

---

### Churn by tenure

The rate above is not the same for everyone. The base splits into two cohorts,
and they churn differently:

```
newcomer (under 3 months)   churn × 1.65
mature base                 churn × 0.86
```

Someone who signed up this month has not settled in: they are still trying the
service, comparing, and leaving is easy. Someone six months in has folded you
into a habit. Hence an uncomfortable consequence familiar to any growing service:
**the faster you grow, the higher your average churn** — not because the service
got worse, but because the share of newcomers went up. A loud premiere brings
triallists, not subscribers; subscribers are the ones still there three months
later.

The practical conclusion: monthly net adds are a poor health metric. What matters
is the mature part of the base, and that is what a valuation is actually paying
for.

The report carries both rates: `churnRate` is what actually happened with a mixed
base, and `churnBase` is the rate before the tenure split, which shows how your
decisions landed without the arithmetic of the mix.

### Shared passwords

One subscription gets used across several homes. The share of such viewers grows
by itself — from 6% at the start towards a 30% ceiling, and the faster the bigger
you are: a friend "already has it". These people watch the catalogue and cost you
bandwidth while paying nothing.

The out-of-home access lever decides when to close the free shop window:

```
agreed to pay = share × force × 0.34
left for good = share × force × 0.22
```

Force is 1 for hard enforcement and 0.35 for a polite request. Tightening leaves
reputational noise for three months (+1.2pp of churn in the first).

Measured: enforcement is worth +3–5% to the licence-led strategy, a polite
request about the same and without the resentment. The mechanic does not turn a
run around, but it is an honest late addition: when organic growth is over, the
only way left is deeper.

A shared password is not theft but a free shop window: those people already watch
your catalogue. The question is when to close it: too early and you lose reach,
too late and you have taught them not to pay.

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
glut          = impressions / (impressions + adInventorySaturation)
cpm           = base cpm × cpm_season × (1 − 0.45 × glut)
advertising   = impressions / 1000 × cpm
revenue       = subscriptions + advertising
```

`base cpm = ₽640`, a spot is 30 seconds, hence the factor of 2 (spots per minute).
The ad market is seasonal: winter ×1.25, autumn ×1.1, spring ×0.95,
summer ×0.75 — the same spot earns two-thirds more in winter than in July, turning
ad load from set-and-forget into a tactical decision.

There is a finite number of advertisers: the more impressions you dump, the cheaper each
one gets. This saturation — together with the ad-tier share ceiling — closes the loophole
where "crank the price and herd everyone onto the ad tier" would be a free
strategy — together with the ceiling on the ad tier this is what gave the price back its
meaning as a price.

```
variable costs = bandwidth + support + retention discounts
contribution   = revenue − variable costs
fixed costs    = hqMonthly + staff (₽6 × subscribers) + licensing + originals + marketing + technology + data science
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

## 6. A living rival

There is one market for the two of you. The rival has its own state — cash, catalogue,
subscriber base, production pipeline — and a policy that reads your decisions and
answers them.

A living rival is what keeps the game from collapsing into one winning setting of
the sliders: since the environment changes, the right answer to "should I raise the
price" depends on what the rival is doing now and what he can still afford.

### His stances

Viewers judge the rival with the same entry-price formula as you: two tiers with
the segment's intrinsic weights, faded by his ad load — no hidden handicap in
your favour. The one
declared asymmetry: his ad tier is priced at 45% of his list price against your
~37% — a corporation discounts its cheap tier less aggressively.

The rival picks a stance from his market share and his cash runway, and holds it for
**at least four months**. The hysteresis is not decoration: an opponent who changes
course every month is noise you cannot prepare for. An opponent who holds a course is
someone whose behaviour you can read and exploit.

| Stance | When | What he does | Your move |
|---|---|---|---|
| Steady growth | parity | price just under yours, moderate budgets | build your catalogue |
| Price war | losing and rich | undercuts by 28%, marketing ×1.6 | do not follow him down: his pockets are deeper |
| Pressing | winning | price +6%, budgets ×1.15 | take viewers while he gets expensive |
| Harvesting | cash running low | cuts content and marketing, raises price and ads | his catalogue goes stale — take the base |
| Retreating | out of money | barely spends | push, and the market is yours |

The rival has two funding rounds. Once they are spent and his cash goes negative he
goes bust, and his subscribers disperse across the market over three months. That is
the only way to get the whole market — and it means surviving the price war first.

### Two ways to grow

```
occupied = your subscribers + his subscribers
untapped = segment potential − occupied
```

**First, bring in people who have no subscription at all.** How many people decide to
subscribe depends on the best offer available on the market, not only on yours:

```
quality(side)  = price_factor × catalogue_appeal × ad_penalty
category_trials = untapped × market_awareness × 0.115 × max(you, rival)
```

A strong rival grows the whole category — including for you.

**Second, take people who already pay the other guy.** Inflow splits by the segment's
preference, and part of his base switches every month:

```
pull(side)  = price_factor^0.9 × catalogue × ad_penalty × awareness^0.35
              × (1 + 1.15 × exclusive) × (1 + 0.5 × premiere_buzz)
preference  = pull_you / (pull_you + pull_rival)
switching   = his_base × 0.035 × segment_loyalty × (2 × preference − 1)
```

The second route is faster than the first, but the rival knows how to answer.

Note the `exclusive` term. It is the one thing the same money cannot buy: a licence
sits on both shelves, your own show only on yours. And what counts is not volume in
general but volume **for this segment**: a mountain of reality TV will not hold
cinephiles, however large it gets.

```
exclusive(segment) = Σ(genre_hours × genre_value × genre_appeal_to_segment)
                     / (the same + threshold)
```

### The line-up

Rival premieres are no longer drawn from a die: what you see on screen is what actually
comes out of his pipeline. Next month's announcement is honest — it is a project one
month from release.

| Line-up | New sign-ups | Churn | Hours |
|---|---|---|---|
| Nothing notable | — | — | — |
| Minor release | −6% | +0.3 pp | −2% |
| Notable release | −13% | +0.9 pp | −4% |
| Major release | −22% | +1.7 pp | −7% |
| Event of the year | −32% | +2.8 pp | −11% |

This is a fight for attention, not switching: in the month of a loud rival premiere new
sign-ups convert worse and everyone watches less. Your own premiere in the same month
partly cancels his (`counter = min(0.65, own_buzz × 0.45)`), but an "event of the year"
cannot be fully cancelled — sometimes the right move is not to answer at all but to
release into a quiet month and collect the whole effect.

The season scales both sides: `winter 1.18`, `spring 1.00`, `autumn 1.06`, `summer 0.84`.

---

## 6d. The joint mega-hit: the one decision that grows the market

Everything else in this game is a split: inflow is «how many people will
subscribe at all» × «which of the two gets them». A joint project hits the
first multiplier and leaves the second alone.

**How it works.** Once per game, from month 6, you can shoot a mega-project
together: you pay half the budget and hold a slot for seven months. At the
premiere both services get the hours — the viewer's preference does not move.
The ceiling does: every segment's `potential` grows by 5% for 18 months, then
the bonus decays by 4 percentage points a month.

**What you pay besides money.** It is his hit too: the rival's awareness jumps
(35% of the remaining headroom) plus premiere buzz, and a joint project
legitimises a weak partner. The bigger market then splits by the same
preference — most of the growth goes to whoever the viewer was already choosing.

**Measured** (24 game codes, medians, bankruptcy = 0; three anchors differing
in how well you play). Next to each median is how many of the twenty-four
games the project actually improved: the spread here is wider than the effect,
and without that counter the median misleads.

| position | no project | launch at 6 | at 12 | at 20 |
|---|---|---|---|---|
| leading (a spendthrift game) | ₽12.30bn | −8.0% (14/24) | +2.0% (15/24) | 0.0% (17/24) |
| level (the best anchor) | ₽30.04bn | +9.5% (10/24) | **+14.7% (12/24)** | 0.0% (13/24) |
| trailing | ₽10.25bn | +2.8% (15/24) | −4.4% (8/24) | +2.1% (7/24) |

Read it as: **this is a bet, not an upgrade.** A solid game mid-way gains most
from it, a trailing one gains almost nothing, and by month 20 the expansion
window cannot pay back before the finale. It pays off in about half the games,
but the wins are larger than the losses — hence the positive median. It never
rescues a bad strategy: the spendthrift anchor stays below the best anchor
without it.

The expansion was cut from 14% to 5% after re-checking on 24 codes: at 14% the
best anchor gained +26…34% of median, which decides the game rather than being
felt in it.

**What the decomposition showed.** Switching parts off one at a time: without
the market expansion the best anchor's median falls from +15% to +7% at month
12 and goes negative at month 6 — so what works is the category growth, not the cheap co-financed
content (paying full price instead of half costs only 1–3 percentage points).
The wartime truce was removed from the mechanic: measurement showed it is no
gift — a rival who is not fighting on price quietly builds its catalogue, and
that is worse for the player, not better. A mechanic whose effect contradicts
its description cannot stay.

---

## 6a. Escalating resource costs

The flywheel "more subscribers → more money → more content → more subscribers" cannot
spin forever. It has two brakes, and both carry a lesson.

**Rights get more expensive when you are both bidding for them.** The index is shared:

```
pressure = max(0, (your_buying + his_buying − calm_volume) / scale)
index    → 1 + 1.15 × pressure          (smoothed, inertia 0.72)
```

You cannot bring the index down alone — you can only stop bidding. Hence a non-obvious
consequence that the tests check: trying to buy up the entire rights market on a large
budget bankrupts you, because you are raising the price against yourself.

**Talent gets more expensive with your success:**

```
talent_index = 1 + 0.95 × (subscribers / 4M)^0.7
```

This is exactly why a hit's cost grows faster than its audience: stars charge a
successful service differently. By the end of a good game a project costs twice what it
did at the start.

### 6a-2. The third act: the rights cliff and the rival's last push

Before these mechanics, measuring "from which turn can the game be abandoned" showed
that random decisions after month 30 barely changed the outcome: the finale played
itself. Now two things happen in the last third of the game — both deterministic,
both announced in advance.

**The rights cliff (month 27, announced in month 24).** The studios decide to build
their own storefronts and pull 30% of licensed catalogues from the whole market at
once — yours and the rival's alike. Original catalogues are untouched: what you own
cannot be taken away. The three months between the announcement and the cliff are
time to ramp up production; a service living on cheap licences meets the finale with
an emptying shelf and pricier rights (both sides rush to re-buy, so the rights index
climbs).

**The rival's last push (month 26, war until month 35).** The rival closes an
unscheduled round (₽5B beyond its usual limit) and declares a price war. While the
war is on, its budgets scale from its cash pile rather than its revenue: it burns 7%
of the war chest a month on licensing, production and marketing. A small rival with
a big cheque becomes big for a while — and when the cheque runs out, the runway logic
walks it into retreat. That is how the third act ends.

Measured: a constant strategy loses ~17% of its outcome to the third act; the share
of the outcome "decided" by turn 24 is 74%, by turn 30 — 87%, so the endgame stays
playable. The rest is bounded by the valuation windows (§9), which smooth late
mistakes and late manipulation alike — a deliberate trade in favour of blocking the
last-turn dash.

**Marketing saturates:** the deeper your penetration into a segment, the more expensive
the next viewer (`× 1 / (1 + 1.4 × penetration²)`).

---

## 6b. The board

A single goal for the whole game lets you pick a strategy on turn one and never revisit
it. The board sets a goal per year, and the goals are built to pull in different
directions.

| Year | Goal | What it tests |
|---|---|---|
| 1 | reach 3.4M subscribers | can you grow at all |
| 2 | duopoly share ≥ 52% **and** base no lower than ×1.05 | can you take market away, not just grow |
| 3 | 2 profitable months **and** base no lower than ×0.55 of its peak | can you earn once growth is over |

These numbers were measured, not guessed: each bar sits where the clearly better half
clears it and the middle does not. Year one is cleared by 37% of random strategies.
The year-two bar — 0.52 — sits between the median (0.49) and the ninetieth percentile
(0.60) of the duopoly share of well-tuned reference strategies at month 24.

Year two is the expansion year: the catalogue is built, the pipeline works, the market
is being divided right now — so the goal is share. The old goal of "profitable months
in year two" died when demand was rebuilt: well-tuned reference strategies have zero
profitable months in year 2, and a goal nobody clears teaches the same lesson as a goal
everybody clears. Profitability moved to year three — the year of defence and harvest:
rights expire, the rival makes its last push, the base inevitably melts (well-tuned
runs keep 55–65% of the peak). At least two profitable months — and not at the cost of
the base: hold at least 55% of the peak. About 36% of well-tuned runs clear it —
deliberately the hardest goal of the game, but a living one.

The goal is announced in the first month of the year and is on screen every turn with
its progress — this is planning, not a lottery.

Consequences of missing:

* **year 1** — the board injects ₽1.5B itself, on its own terms, and takes 18% of your
  stake;
* **year 2** — the content budget is capped at ₽140M a month for six months. The
  "pour everything into growth" strategy that worked until now stops being available;
* **year 3** — the final valuation drops by 15%.

Meeting a goal instead raises the valuation by 10–18%.

What matters is that the year-2 goal directly conflicts with the year-1 strategy. A team
that spent the first year pouring money into growth enters the second year deeply
unprofitable and has to rebuild. That is exactly why the mechanic is there: the strategy
has to be reassembled mid-game.

---

## 6c. Crises

A one-off event with a ±10% multiplier is an unlucky die roll: the player waits it out
because there is nothing to react to. A crisis works differently. It sits on the company,
gets worse every month and demands an explicit decision that costs money. You can stall —
but stalling is more expensive.

| Crisis | While unresolved | Resolutions |
|---|---|---|
| Scandal | churn +1.2 pp per month, awareness decays twice as fast | a campaign (₽70M × months) or wait |
| Rights holder sues | up to 55% of the rented library frozen + ₽22M/mo | settle (180 + 40 × months) or fight (₽30M/mo) |
| Showrunner leaves | the pipeline stalls, project quality falls | beat the offer (₽150M, talent costs rise for good) or rebuild the team (₽45M, lose a month and some quality) |
| Platform degradation | churn rises, hours fall, bandwidth gets dearer | invest (90 + 30 × months, part lands in your tech stock) or patch it |

Escalation hits a ceiling in the fifth month — after that the crisis stops getting worse,
but it does not go away on its own either.

The key detail: **crises arrive more often the better you are doing** (from 2% a month
with an empty service to 14% with millions of subscribers). A successful service gets
sued, gets its team poached and gets written about. This is not a punishment for success,
it is what success actually costs.

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
| A star asks for a cut | pay ₽260M × talent index / recast | the bargaining power of talent: a hit's cost grows faster than its audience |
| Sports rights | buy for ₽500M / pass | renting traffic versus building an asset |
| The board demands growth | run a sale (₽80 per subscriber) / hold the price | growing the base ≠ growing revenue |
| Viewer data leak | compensate (₽60 per subscriber) / say nothing | the data your algorithms learn from is also a liability |

**The price of a decision depends on your size.** Compensations and sales are charged
per head — against the base at the start of the month; the star's ask is indexed to the
price of talent. Honesty and generosity cost a small service almost nothing and a large
one dearly. That is why events have no "right answer": measured across three company
sizes, the profitable option changes with the state, and the mean gap between
"always first" and "always second" is a fraction of a percent.

---

## 9. Valuation and funding

```
run-rate    = average revenue over 6 months × 12
growth      = subscribers over 3 months / subscribers over the previous 3 months
margin      = profit over 6 months / revenue over the same 6 months
multiple    = clamp(2.2 + 6 × clamp(growth, −0.5, 1) + 2.5 × margin⁺ + 1.5 × margin⁻, 0.5, 12)
library     = Σ(genre_hours × genre_value) × originalCostPerHour × 0.45
position    = clamp(0.45 + 1.15 × duopoly_share, 0.45, 1.6)
valuation   = (run-rate × multiple + library) × position
final score = (valuation + cash in the till) × your stake
```

The cash in the till belongs to the shareholders: a rouble unspent by the finale is
worth a rouble, and a rouble spent has to come back as valuation growth. Without the
cash term, one-off costs late in the game would be free — including the price of
event decisions.

Your own library enters the valuation as a **separate term** — it is an asset on the
balance sheet, while licences are not. And an hour of reality is worth a third of an hour
of drama in it: a library is what people will still be watching in two years.

The `position` multiplier is not decoration either. In a duopoly the market pays not for
revenue as such but for who will be setting prices in three years. The loser is cheap
even with a good margin — which is precisely why "harvest the margin, do not invest in
content" does not work in this game: it produces profit and loses the market.

**Revenue and margin are taken over a six-month window, not the last month.** The last
month can be bought with one decision: crank the price and zero out content and marketing
one turn before the end. The business falls apart and the score goes up — measured, that
dash was worth +92%. The window closes it.

**The lower bound on growth is below zero.** A shrinking subscription is valued below
one standing still, so "harvest and lose the base" is never free. Valuation works the
same way in the delivery game next door.

A funding round:

```
round valuation = max(₽1.5B, valuation)
dilution        = clamp(amount / (round valuation + amount), 0.02, 0.75)
new stake       = old stake × (1 − dilution)
```

The floor under the valuation and the cap on dilution came from measurement too: without
them an early round took almost the whole company, and the game was decided by the month
the money ran out rather than by the economics.

The worse things are, the lower the valuation and the more the same money costs. The
valuation floor is ₽300M, so a ₽3B cheque at a weak company takes almost everything.

The final score counts **your stake**, not the size of the company. "Grow at any cost"
produces more subscribers and a smaller result — this is checked by the
`расти любой ценой невыгодно` test in `games/cinema/tests/engine.test.mjs`.

---

## 10. What the model leaves out

This is a teaching model, not a forecasting tool.

* **There is one rival and he is simplified.** He reacts to your price, your share and
  your genre choice, but his policy is five legible stances, not a full player. A real
  market has several players with different business models.
* **The board sets only three goals** and always of the same three types.
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
upkeep = cumulative investment × 1.35% в месяц
```

It is computed from the amount invested, not from the level. The level
saturates; the maintenance bill does not. So "invest a large sum at once" is not
a one-off cost but a permanent obligation.

**Infrastructure.** Load-driven infrastructure already exists here and is called traffic: `cdn = watch hours × cost per hour`. It grows with audience loyalty and gets cheaper with technology and encoding — see the watch-hours section.

The point of splitting these two lines out of "office and administration" is
behavioural: the base fixed part is small, while upkeep and traffic grow with
the product and the audience. Costs breathe together with the business, and
every "invest more" decision carries a tail of future obligations.

---

## The price of a free month

A gifted month has two prices, and both are obvious if you look at the cash rather
than at the subscriber chart. Without them the best answer would always be the
maximum 30 days — and the slider would effectively not exist.

**Given-away days are an invoice never sent.** Someone who arrives this month
watches free for the first `trialDays` days and pays only for the remainder:

```
given away = new subscribers × (trialDays / 30) × average price
```

**A long trial brings in more than the people who got a taste.** It also brings in
the people who came for exactly one free month. They do not leave straight away,
but at the first charge — which lands in next month's churn, after they have
already been counted in this month's growth. Hence the familiar picture: the
subscriber chart climbs beautifully and crumbles a month later.

```
greed       = clamp((trialDays − 14) / 23, 0, 1)
fresh share = last month's arrivals / base
churn += greed × fresh share × 0.55
```

The usual two weeks are the reference point: there the surcharge is exactly zero.
The optimum sits right there and falls off on both sides — a short
trial loses the people who never got a taste, a long one buys people who leave at
the first charge.
