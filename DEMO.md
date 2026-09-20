# Betcha — demo runbook

Every figure below comes from the seed. Regenerate with `npm run demo:numbers`
after any reseed. Balances shown are **after escrow** — money tied up in live
bets is excluded, which is what the app displays.

---

## Pre-flight

```bash
npm test               # expect 61/61
npm run spark:check    # expect 200 — key, base URL, model
npm run db:reset       # push + generate + seed. REQUIRED after any schema change.
npm run db:snapshot    # freeze this state
npm run dev
```

Between rehearsals, and between judging slots:

```bash
npm run db:restore     # instant, and works even if the seed script breaks
```

Set the browser up **before** you present:

1. Normal window at `/c/HACKMIT` — this is you, Akkhil.
2. Incognito window, switch to **Dev** via the avatar top-right.
3. Have `tests/DSC_0156.JPG` reachable in one click.

Cookies are per-window-session, so incognito gives you a second member with no
logging in and out.

---

## The state you load into

Everyone started the semester with **$120**. After 172 settled bets:

| | Balance | Forecasting | Grades | Sports | Dares |
|---|---|---|---|---|---|
| Dev | **$191.84** | **1338** | 1147 | 1272 | 1173 |
| Shash | $147.17 | 1225 | 1234 | **1411** | 1225 |
| Priya | $141.83 | 1239 | 1325 | 1189 | 1159 |
| Yaxin | $115.54 | 1165 | 1300 | 1217 | 1300 |
| Akkhil | $68.93 | 1171 | **1325** | 1282 | **1089** |
| Marcus | $54.68 | 1058 | 1088 | 1292 | **1408** |

**You are 0 for 11 at dares.** That one number does most of the work.

### Live bets

| Bet | Backed by | Side | Up | Takers get | Room |
|---|---|---|---|---|---|
| Akkhil cold-plunges 3 min | Dev | no chance | **$60** | **10.71x** | **$6.18** — *pending* |
| Akkhil does 100 pushups | Priya | no chance | $40 | 8.47x | $5.35 — *pending* |
| Shash gets an A- in orgo | Shash *(himself)* | he'll do it | $40 | 1.07x | $581 |
| Yaxin runs 5 miles | Yaxin *(herself)* | she'll do it | $30 | 1.39x | $64 |

The two dares bets have **no taker**, so they show as UNTAKEN. That's the demo.

---

## The run — about two minutes

### 0:00 · Open on the circle

> "This is my group chat. A hundred and seventy-two bets settled this semester.
> Everyone started with a hundred and twenty dollars. We settle up over dinner."

### 0:15 · Standings → Sharpest

> "Two boards. What you're up, and who actually calls it right. Dev's on top of
> both — and he's 2 and 9 at dares himself. Being good at something and knowing
> who'll pull it off are different talents."

### 0:30 · Tap the cold plunge

> "Dev has sixty dollars up saying I can't do it. Nobody's taken him on."

Open **Why 10.71x?**

> "Because I have never once finished a dare. Zero for eleven. The price is my
> record — not a number Dev picked, and not whoever bet first."

### 0:50 · Switch to yourself, take him on for $6.18

The bet flips from UNTAKEN to live in front of the room.

> "Six dollars and eighteen cents is all he's covering at these odds, because
> sixty dollars only stretches so far against a ten-to-one shot. If I do it, I
> get sixty-six dollars and his sixty is gone."

### 1:05 · Submit the fridge photo

Spark returns **UNCLEAR**, citing *"No running distance, time, stopwatch,
fitness app, bib, timestamp, or name Akkhil visible."*

> "Ninety-nine percent confident about what it's looking at — and it still
> refuses to settle the bet. That's why we gate on the verdict, not the
> confidence score."

It drops to a circle vote on its own.

### 1:25 · Vote it through

Out: Akkhil (subject), Dev (put it up), whoever took him on.
The remaining 3 can vote; **2 settle it**.

> "Anyone with money on it is locked out — including whoever put the bet up."

### 1:40 · Payout

| | |
|---|---|
| You | **+$60.00** |
| Dev | **−$60.00** (exactly what he put up) |
| Akkhil · dares | 1089 → **1118** |
| Cold plunge challenge | 1484 → **1469** |

### 1:50 · Back to the circle — the close

The **pushups** bet was **8.47x**. It is now **7.32x**.

> "I just proved I can take a plunge. Every other dare on me got cheaper,
> automatically. Nobody gets that price again."

Stop there.

---

## If something breaks

**Spark errors or times out.** Evidence falls to a circle vote by design. Say
*"no usable photo, so the circle decides"* and carry on. There's also a
**"Can't photograph this — put it to the circle"** button, one tap.

**A stake is refused.** You've hit what the backer is covering. The message says
how much is left. This is the system working.

**You can't create a bet.** If the backing is too small for the odds the app
refuses and tells you the minimum — a $5 backing can't support a 10x line.

**Blank screen / no circle.** Database is empty. `npm run db:reset`.

**`Unknown argument` from Prisma.** Schema changed without a regenerate.
`npm run db:reset`, then **restart the dev server** — Next caches the client in
memory.

**Everything is wrong.** `npm run db:restore`. Instant.

---

## Questions you will get

**"Where do the difficulty numbers come from?"**
A starting prior the circle corrects. The plunge seeded at 1500 and sits at 1484
because people kept failing it. Point at the challenge rating moving on the
payout screen.

**"Can't you bet a lot to move the odds?"**
No — there's a test that floods one side with 20 stakes and asserts the price is
unchanged to twelve decimal places.

**"Where does the money come from?"**
Nowhere. Whoever opens a bet is the counterparty and escrows what they're
willing to lose. The circle holds exactly $720 forever, which is a test, not a
claim.

**"What if the house loses more than they put up?"**
It can't. Fuzzed over 5,000 random bets — random ratings, random backing from $1
to $200, random takers filling random slices — asserting the loss never exceeds
what was posted, on either outcome.

**"What stops someone farming the leaderboard?"**
Conviction weighting is symmetric: bet big and be wrong and you fall twice as
fast. Expected movement is zero for an honest forecaster at any stake size.

**"Is this real money?"**
No. Fake balances, settled between friends however they like.
