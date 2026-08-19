# Teaching notes: the ticketing service in class

The game suits courses on marketplaces and two-sided markets, platform
economics, product strategy and unit economics. One game is 36 turns — 40–60
minutes at a calm pace. A class session usually needs 12–18 turns.

The three games in the set are built differently, and that is the point of
playing more than one. In delivery (`docs/foodtech/`) revenue per customer grows
with their activity. In the streaming service (`docs/cinema/`) it is fixed by the
subscription while cost grows. Here it grows with nothing at all: billions pass
through the service and what becomes yours is percentages — part of which the
bank takes straight away.

---

## What the student should take away

1. **A two-sided market does not start from one side.** Organisers come for the
   buyers, buyers come for the listings. Marketing into empty listings burns
   entirely; rich listings with no buyers give empty halls, after which the
   organisers leave. Both mistakes look like "we under-invested" and are cured by
   opposite actions.
2. **Turnover and revenue are different accounts.** The GMV in the header and
   your revenue differ tenfold. Acquiring comes off turnover, not revenue, so at
   a low take rate the bank eats nearly all of it.
3. **The same commission can be taken from two sides, and the consequences
   differ.** The buyer fee is visible at checkout and hits demand; the organiser
   commission is invisible to the buyer and hits supply. Same sum, different
   elasticities.
4. **A partner's own channel is a choice between "less per ticket" and "nothing
   per ticket".** A widget on the organiser's site recovers turnover that would
   otherwise pass you by, but earns several times less and does not fill your
   listings.
5. **Migrating between platforms is a project, not a checkbox.** Everyone already
   runs something. Speed is bought with budget, and those sitting on the rival's
   platform cannot be won over.
6. **Trust is spent invisibly and recovers slowly.** Resellers lift turnover and
   sink reputation: the numbers look fine right up to the month when it is
   too late.

---

## Session 1. "How much is 14%?" (30 minutes)

The task: split the take rate between the two sides.

1. Fix the total at 14% and ask the teams to divide it: 14/0, 0/14, 7/7, 10/4.
   Each team justifies its choice before the first turn.
2. Five turns, then compare: turnover, organiser count, market share.
3. Debrief: buyer segments have fee elasticities from 0.8 to 2.6, organiser types
   have commission sensitivities from 0.85 to 3.1. So there is no right answer —
   there is an answer for your mix of listings.

Homework question: how does the answer change if you want to grow in clubs rather
than theatres?

---

## Session 2. "Who gets a widget" (40 minutes)

The task: see channel conflict in numbers rather than in words.

1. Open the channels panel and read the "What a ticket earns you" line out loud:
   ₽179 through the listings, ₽4 through the widget (clubs, default settings).
   Ask: why install the widget at all?
2. The answer is in the "past you" column: for sport 58% of turnover goes past
   the service entirely. The widget recovers that part at a low rate.
3. Let the teams pick types and play 8 turns. Compare with the measurement in
   `economics.md`: clubs +95%, concerts +100%, theatres −4%, sport −1%.
4. Debrief: why clubs and concerts win. Clubs have no ticketing of their own and
   there are thousands of them; promoters have no audience of their own, so there
   is nothing to lose.

---

## Session 3. "Migration costs money" (30 minutes)

The task: see that a decision and its execution are different things.

1. Ask them to tick types for the widget and **not touch** the onboarding budget.
   Three turns. Nothing happens — the share that moved stays at zero.
2. Now give them the budget. Watch the "Moved over" column: it grows in parts,
   and faster for clubs than for sport.
3. Debrief: need works as a discount, a raw product moves nobody, and the rival
   holds their own — so the ceiling is below one.

A good moment to talk about the difference between a plan and a budget.

---

## Session 4. "One tour" (35 minutes)

The task: show why you pay for something you do not need nine months out of
twelve.

1. Play until the first announcement in the "What is on in town" panel.
2. Forbid half the teams from touching capacity headroom; tell the other half to
   raise it.
3. Play the announced month and compare the lost demand.
4. Debrief: headroom is held all year for a single day, and it cannot be bought
   on that day. The same holds for warehouse stock, cloud reserve and an on-call
   shift.

---

## Session 5. "Turnover up, trust down" (40 minutes)

The task: separate two metrics that are usually confused.

1. Give the teams the goal of maximising turnover over six turns.
2. Almost all will turn off bot protection or never install it: resellers buy
   faster than people, and turnover really does grow.
3. Show the trust chart and ask what will happen over the next six months.
4. Play on until conversion falls. Debrief: trust enters both conversion and
   appeal to organisers, but with a lag.

A separate question: "fee at the last step" raises conversion at once and lowers
trust gradually. Which teams switched it on, and why?

---

## Session 6. "The exclusive" (30 minutes)

The task: learn to price an advance.

1. Wait for an exclusive offer and read the advance out loud (₽120–500M against
   a monthly revenue of roughly ₽150–240M).
2. Have the teams decide before they see the consequences.
3. Debrief from the measurement: taking every offer gives ₽990M and 4 bankruptcies
   out of 6; taking one only when there is still payroll left afterwards gives
   ₽7.77B and no bankruptcies; never taking one gives ₽7.45B.
4. The conclusion is not "exclusives are bad" but "an advance is a cash gap, and
   the decision is made on the cash left over, not on how good the deal looks".

---

## Session 7. "Shareholder goals" (35 minutes)

The task: show that a strategy built for one year's goal does not carry to
the next.

1. Year one: monthly turnover from ₽1.2B. Almost everyone gets there by growth at
   any cost.
2. Year two announces something else: three profitable months **and** turnover
   above ₽700M. Pause and ask them to say out loud what has to change.
3. Year three — 65% market share with 420 organisers: different again.
4. Debrief: the take rate is a decision for the year, not a setting. The bars were
   set by measuring the distribution, not by guessing: year one is cleared by 30%
   of strategies, year two by a few percent, year three by 24%. The measurement runs 120 random
   strategies and assumes a player who raises rounds rather than dying halfway
   through: without rounds the bars would read about half as high.

---

## Quick questions for oral debrief

* Why can a service at a 3% take rate lose money while turnover grows?
* Why does the buyer fee hit demand harder than the same commission on the
  organiser?
* What happens to your listings if you hand the widget to all four types?
* Why does hall fill matter more than the size of the commission for keeping an
  organiser?
* Where does the ceiling on widget migration come from, and why is it below 100%?
* How does turnover through the widget differ from turnover through the listings
  for your reach?
* Why does the year start in September, and who benefits from that?

---

## Technical notes for the teacher

* The game is a single HTML file, `dist/biletville-ticketing-simulator-v1.25.0.html`.
  No internet, no install, runs from a USB stick.
* The game saves in the browser. To have every team play the same world, hand out
  the same file and dictate a shared game code — it is entered on the welcome
  screen, and under one code everyone gets the same city: the same listings,
  events and hit of the month. The current game's code is shown in the help
  dialog ("?"). On the final screen the game produces a result string carrying
  the code, the score and a checksum — ask students to send it in: a doctored
  score fails the checksum. The final screen also keeps a table of the best
  games on that device.
* The language switches in the header and on the welcome screen; the model is
  identical either way.
* Formulas and constants are in `docs/tickets/en/economics.md`. Everything that
  can be changed without touching the logic lives in
  `games/tickets/src/model/config.js`.
* It plays on a phone: tables turn into cards and the turn button is pinned to
  the bottom of the screen.
