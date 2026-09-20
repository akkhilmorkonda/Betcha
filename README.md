# Betcha

Peer-to-peer prediction market for friend groups. Fake currency, Elo-priced odds,
photo-evidence resolution with a circle-vote fallback. HackMIT 2026.

## Run it

```bash
npm install
npm run db:push     # creates prisma/dev.db from the schema
npm run db:seed     # loads the demo circle
npm run dev
```

Other scripts:

```bash
npm test            # engine unit tests, no DB needed
npm run seed:sim    # print the seeded circle's Elo spread without touching the DB
npm run db:reset    # wipe and reseed
```

## How the odds work

Elo here is a **skill** rating — how good a person is at the thing, per category.
It prices bets *about* that person, not bets *by* them.

- Solo bets price the subject against a rated `ChallengeTemplate`.
  `p = 1 / (1 + 10^((R_challenge - R_subject) / 400))`
- Head-to-head bets price the subject against the opponent's rating.
- Lines are clamped to [0.05, 0.95] so neither side is ever unbettable.

**Money does not move the line.** Odds are a pure function of current ratings, so
two people with the same opinion get the same price whether they bet first or
last. The line still moves during a session — because *ratings* move. Resolve one
bet and every open bet on that person in that category re-prices immediately.

Payout is fixed odds. Each position locks its multiplier at placement, like
taking a price at a sportsbook, and a circle bank is the counterparty. The bank
collects losing stakes and pays winners `stake x locked multiplier`.

Because a bank does not self-fund the way a pool does, each bet carries a
`LIABILITY_CAP` (2000). Once further money on a side would push the bank's loss
on that outcome past the cap, that side stops accepting stakes. Money on the
opposite side buys the capacity back.

### The forecasting rating

A third rating, separate from the two above and invisible to pricing. It scores
how well you call OTHER people's bets. The line already states the expected
score, so no opponent lookup is needed:

```
E = implied probability of the side you took
S = 1 if you won, 0 if you didn't
new = old + K x conviction x (S - E)
```

Conviction is your stake as a fraction of your bankroll at placement, clamped to
[0.25, 2]. Staking 100 of a 1,100 bankroll is a bigger call than 100 of 3,400,
and the rating says so. The weight is SYMMETRIC — go big and be wrong and you
fall twice as fast — so for an honest forecaster the expected move is zero at any
stake size. Betting bigger or more often buys speed and variance, never drift.
That is what balance cannot do: balance rewards volume, this does not.

Stake size moves this rating. It never moves the line.

### Skill and challenge on resolution

On resolution the subject's rating and the challenge's rating move in opposite
directions (K=32 and K=16), so the template bank self-calibrates across the
circle like chess puzzle ratings. New ratings use a provisional K=64 for their
first 5 bets.

## Seed data

Ratings are not hand-typed. `src/lib/seed-data.ts` gives each member a hidden
true skill per category, then runs 144 historical bets through the real engine in
`src/lib/market.ts`. Elo has to discover the skill, exactly as it would with real
users. Current spread: 305 points in grades, 258 in dares, 206 in sports.

## Stack

Next.js 15 (App Router) · Prisma · SQLite locally, Postgres at deploy · Tailwind.
Change the `datasource` provider in `prisma/schema.prisma` to ship on Postgres —
the schema avoids enums and arrays so the port is that one line.
