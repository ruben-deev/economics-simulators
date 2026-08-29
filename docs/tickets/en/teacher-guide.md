# Class notes: the ticketing simulator

*[Русская версия](../teacher-guide.md)*

The game suits courses on marketplaces and two-sided markets, platform economics, product
strategy and unit economics. One game is 36 turns, which at a calm pace is 40–60 minutes.
Seeing the main forks usually takes 12–18 turns.

The three games in the set are built differently, which is the point of playing more than
one. In delivery (`docs/foodtech/`) revenue per customer grows with their activity. In
streaming (`docs/cinema/`) it is fixed by the subscription while cost grows. Here it grows
with nothing at all: billions pass through the service and percentages are yours — and the
bank takes part of those first.

---

## The six ideas the game was built around

1. **A two-sided market does not start from one side.** Promoters come for the audience,
   the audience comes for the line-up. Marketing into an empty line-up burns entirely;
   a rich line-up without an audience means empty halls, after which promoters leave.
   Both mistakes look like "we underinvested" and are cured by opposite things.
2. **Turnover and revenue are different accounts.** The GMV in the header and your revenue
   differ by a factor of ten. Card processing is charged on turnover, not on revenue, so at
   a low take rate the bank eats nearly all of it.
3. **The same commission can be charged to either side, with different consequences.**
   A buyer fee is visible at checkout and hits demand; a promoter commission is invisible to
   the buyer and hits supply. Same amount, different elasticities.
4. **A partner's own channel is a choice between "less per ticket" and "nothing per
   ticket".** A widget on the promoter's site recovers turnover that would otherwise pass
   you by, but it brings in several times less and does not fill your line-up.
5. **Migrating between platforms is a project, not a checkbox.** Everyone already runs
   something. Speed is bought with budget, and those who sit with the rival cannot be
   pulled away.
6. **Trust is spent invisibly and rebuilt slowly.** Scalpers lift turnover and sink
   reputation: the numbers look fine right up to the month when it is too late.

---

## Where the model surprises people

### There is no single "right" take rate

The same total 14% can be split 14/0, 0/14, 7/7 or 10/4, and those are different
businesses. Audience elasticity to the buyer fee runs from 1.5 to 4.5; promoter sensitivity
to commission from 0.7 to 2.6. There is no right answer — there is an answer for your
line-up mix.

*Question:* how does the split change if you need to grow in clubs rather than theatres?

### The widget pays pennies — and is still sometimes right

The "Your money per ticket" line in the channels panel: ₽179 through the line-up, ₽4
through the widget (clubs, default settings). The obvious question is why bother with the
widget at all. The answer is in the next column, "past you": 58% of sports turnover bypasses
the service entirely, and the widget recovers that part at a low rate.

By the measurement in `economics.md`: clubs +95%, concerts +100%, theatres −4%, sports −1%.
The winners are the ones with nothing to lose: clubs have no box office of their own and
there are thousands of them; promoters have no audience of their own.

### A decision and its execution are different things

You can tick the types for the widget and leave the integration budget alone. Then nothing
happens: the migrated share sits at zero for as many turns as you like. With a budget, the
"Migrated" column grows in pieces, faster for clubs than for sports. Need works like a
discount, a raw product moves nobody, and the rival holds its own — the ceiling is below
one.

This is a good moment to talk about how a plan differs from a budget.

### Spare capacity is held all year for one day

The "City" panel announces a tour ahead of time. A team that raised spare capacity before
the announced month and a team that left it alone diverge on demand lost in that month.
Capacity cannot be bought on the day of peak load — the same is true of a warehouse, cloud
headroom and an on-call shift.

### Turnover up, trust down

Turn bot protection off, or never roll it out, and turnover really does rise: scalpers buy
faster than people. The trust chart goes down at the same time, and trust feeds both
conversion and attractiveness to promoters — but with a lag, so the conversion drop arrives
months later.

A separate case of the same kind: a fee revealed at the last step lifts conversion
immediately and erodes trust gradually.

### An exclusive advance is a cash gap

An advance of ₽120–500M against monthly revenue of roughly ₽150–240M. By measurement:
taking everything on offer — ₽990M and 4 bankruptcies out of 6; taking one only when there
is still payroll left afterwards — ₽7.77bn and no bankruptcies; taking none at all —
₽7.45bn.

The conclusion is not "exclusives are bad" but "the decision is made on the cash left over,
not on how attractive the deal is".

### A strategy built for one year's goal does not carry to the next

Year one: turnover of ₽1.2bn a month — almost everyone takes it through growth at any price.
Year two announces something else: three profitable months **and** turnover above ₽700M.
Year three: 65% market share with 420 promoters — different again. The take rate turns out
to be a decision for a year, not a setting.

The bars were set from a measured distribution rather than by eye: the year-one goal is
taken by 30% of strategies, year two by a few per cent, year three by 24%. The measurement
runs 120 random strategies and assumes a player who raises rounds rather than dying
mid-game: without rounds the bars would read half as high as they do.

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

* The game is a single HTML file, `dist/biletville-ticketing-simulator-v1.36.1.html`.
  No internet, no install, runs from a USB stick.
* The game saves in the browser. To have every team play the same world, hand out
  the same file and dictate a shared game code — it is entered on the welcome
  screen, and under one code everyone gets the same city: the same listings,
  events and hit of the month. The current game's code is shown in the help
  dialog ("?"). On the final screen the game produces a result string carrying
  the code, the score and a checksum — ask students to send it in: a doctored
  score fails the checksum. The final screen also keeps a table of the best
  games on that device.
* Beyond the result string, the final screen has "Copy" and "Download CSV"
  buttons (the month-by-month history), "Share as image" (a result card for
  messengers; a vertical format on phones), the world leaderboard with result
  submission, and a personal debrief.
* The language switches in the header and on the welcome screen; the model is
  identical either way. It can also be baked into the link:
  `…/games/tickets/?lang=en` (or `?lang=ru`) — without the parameter the game
  picks the browser's language.
* Formulas and constants are in `docs/tickets/en/economics.md`. Everything that
  can be changed without touching the logic lives in
  `games/tickets/src/model/config.js`.
* It plays on a phone: tables turn into cards and the turn button is pinned to
  the bottom of the screen.
