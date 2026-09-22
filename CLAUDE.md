# Betcha

Peer-to-peer prediction market for friend groups. You bet fake currency on whether
your friends will do things; odds come from their track record. Built for HackMIT
2026, now being taken to the iOS App Store as a real product.

**Next.js 15 (App Router) · React 19 · Prisma 6 · Postgres · Tailwind 3 · Better Auth 1.7.5**

---

## Commands

```bash
npm run dev            # next dev
npm test               # 111 cases, node --test, no DB needed
npm run build          # prisma generate && next build
npm run db:seed        # load the demo circle (+ credential accounts)
npm run seed:sim       # print the seeded Elo spread without touching the DB
npm run demo:numbers   # exact figures for the demo runbook
npm run spark:check    # smoke-test the vision model
```

Migrations are `npx prisma migrate dev`. **`db:push` and `db:reset` in package.json
still call `prisma db push`, which bypasses migration history** — rewrite them to
`migrate dev` / `migrate reset` rather than using them.

---

## Architecture

```
src/lib/market.ts       pure pricing + Elo. no Prisma. the heart of the product.
src/lib/eligibility.ts  pure. who may take which side.
src/lib/circles.ts      pure. invite codes, name rules, join rules.
src/lib/rate-limit.ts   pure. sliding-window policy, one per action.
src/lib/schemas.ts      pure. zod shape of every request body.
src/lib/guard.ts        request-facing. readBody + rateLimit, used by every write route.
src/lib/session.ts      who is calling. wraps Better Auth. the only identity source.
src/lib/bets.ts         Prisma-bound orchestration. calls into the two above.
src/lib/spark.ts        vision-model evidence verdicts.
src/lib/seed-data.ts    hidden true skills -> 144 simulated bets -> discovered Elo.
src/app/api/            route handlers.
src/app/c/[code]        circle feed, new bet, standings.
src/app/signin          sign in / sign up.
src/app/b/[id]          bet detail.
```

Pure modules carry the invariants and are the only things the test suite can
reach. **Put new rules in a pure module and call it from `bets.ts`**, not inline
inside a Prisma call — a rule buried in a transaction is a rule nobody can test.

---

## Invariants — do not break these

The test suite exists to hold these. If a change makes one fail, the change is
wrong, not the test.

1. **Money never moves the line.** Odds are a pure function of current ratings:
   `p = 1 / (1 + 10^((R_challenge − R_subject) / 400))`, clamped to [0.05, 0.95].
   Two people with the same opinion get the same price whether they bet first or
   last. The line still moves during a session because *ratings* move.

2. **Fixed odds.** Each position locks its multiplier at placement. A circle bank
   pays winners `stake × locked multiplier`.

3. **A proposer never loses more than they posted.** The cap is per bet and is
   the proposer's own `Bet.proposerLiability`, bounded by `MIN_LIABILITY` and
   `MAX_LIABILITY` in `market.ts` — there is no global `LIABILITY_CAP` constant,
   despite what this file used to claim. Once further money on a side would push
   the bank past that backing, `remainingCapacity` stops accepting stakes on it.
   Fuzzed over 5,000 random bets, asserted exactly now that money is integer
   cents.

4. **Conservation.** Money in equals money out across a full resolution.

5. **The forecasting rating is unfarmable.** Conviction = stake ÷ bankroll at
   placement, clamped [0.25, 2], and the weight is symmetric — go big and wrong,
   fall twice as fast. Expected movement is zero for an honest forecaster at any
   stake size. This is what balance cannot be. Never make it asymmetric.

6. **Three ratings, three jobs.** Skill (person × category) prices bets *about* a
   person. Challenge (per template) self-calibrates like a chess puzzle rating.
   Forecasting (person × circle) scores how well you call *other people's* bets and
   **never touches pricing**. Balance is currency, not a rating.

7. **Side A is always "the subject does it". Side B is always "they don't."**
   In a head-to-head, A is "subject wins", B is "opponent wins". Lots of code
   depends on this.

8. **Nobody profits from their own failure.** `src/lib/eligibility.ts`: the subject
   may take only side A; the head-to-head opponent may take only side B. Backing
   yourself to *succeed* is the motivating loop and stays legal — the ban is
   deliberately one-directional. Don't "simplify" it into a blanket ban.

9. **Evidence gates on the verdict enum, never the confidence float.** A real Spark
   response came back `confidence 0.99, verdict "unclear"` on an irrelevant photo.
   Under a confidence threshold that photo would have paid out real positions. The
   regression case is in `tests/spark.test.ts` and is the most valuable test here.

---

## Where the project stands

Phase 1 of the App Store plan. Auth is wired and the read path is closed.

**Landed and verified (111/111 tests, tsc clean, `next build` clean):**
- Self-deal guard (`eligibility.ts` + 10 tests incl. a 20k-case fuzz)
- `createBet` checks subject and opponent are circle members
- Head-to-head against yourself refused at creation
- **The database is live.** `migrate dev` has run; `prisma/migrations/` exists.
- **Better Auth is the session.** `src/lib/session.ts` now reads a signed Better
  Auth session. The `bc_user` cookie is gone.
- **The persona swap is gone.** `MemberSwitcher.tsx` deleted, `POST /api/session`
  deleted (GET remains, scoped to the caller's own record).
- **`GET /api/circle/[code]` requires membership.** A non-member gets the same
  404 as a nonexistent code, so probing can't distinguish the two.
- **Circle create + join exist.** `POST /api/circle`, `POST /api/circle/[code]/join`.
  Rules live in the pure module `src/lib/circles.ts` with 14 tests.
- **Every write route validates its body and spends a rate-limit token.**
  `readBody` + `rateLimit` from `guard.ts`, schemas in `schemas.ts`, policy in
  `rate-limit.ts`. Schemas are `.strict()`, so an unknown key is a 400 rather
  than something forwarded to Prisma. Better Auth has its own `rateLimit` for
  the endpoints it owns; sign-in is 5/min.
- **Money is integer cents throughout** — schema, engine, API, UI state and
  tests. Conservation is now asserted to the cent rather than within `1e-6`.
  Fixed an edge where `remainingCapacity` could admit a stake that breached the
  proposer's cap by a cent.
- **Evidence submission is authorized, not just authenticated.** The route read
  `me` and then never used it, so anyone holding a bet id could settle a bet
  between six other people. It now requires membership of the bet's circle, via
  `evidenceRefusal` in `eligibility.ts` (6 tests, incl. a 5k fuzz), and checks
  that *before* reading the request body.
- **`next.config.mjs` is empty.** The ngrok/trycloudflare wildcards are gone, and
  the whole `experimental.serverActions` block with them: there is no
  `"use server"` anywhere in `src/`, so `allowedOrigins` governed nothing and
  `bodySizeLimit` bounded nothing (it applies to Server Actions, never route
  handlers). Evidence size is bounded by `submitEvidenceBody` in `schemas.ts`.
- **Remotion is gone.** `remotion/`, `remotion.config.ts`, `betcha-ad/` and
  `REMOTION_PROMPT.md` deleted; both packages dropped. Nothing in `src/`,
  `tests/`, `prisma/` or `scripts/` ever imported it. Recoverable from git
  history if the promo video is ever wanted again.
- `/signin` page (sign in + sign up); the circle page redirects there on 401.
- Seeded users get real credential accounts hashed with Better Auth's own
  `hashPassword`, so the demo circle is reachable. Password: `SEED_PASSWORD`,
  default `betcha-dev-password`.

**Phase 1 is complete.** What remains below is Phase 2 and beyond.

**Known, deliberately not fixed:**
- Bets have no deadline guard on `startVote`: any member can force an open bet
  to a circle vote before its deadline by submitting evidence with no photo.
  The vote itself excludes stakeholders, so this is a nuisance rather than a
  theft, but the subject loses the time they had left to complete the challenge.

---

## Traps

**The database is SQLite again, temporarily.** `schema.prisma` and
`src/lib/auth.ts` both name the provider and **must be changed together** — a
mismatch fails every request with P1012 at the Prisma layer, or a silent adapter
mismatch at the Better Auth layer. `prisma/migrations/` is SQLite-dialect SQL and
**will not replay against Postgres**: delete the directory and re-cut the initial
migration when you switch. Nothing should be built on this history.

**Rate limiting is in-process and therefore per-instance.** `src/lib/guard.ts`
holds a module-level `Map`, and Better Auth's own limiter defaults to memory
too. Two servers behind a load balancer each allow the full quota, and a deploy
resets every window. That is honest for one container and wrong for serverless,
where a cold start is a fresh quota. When this scales horizontally the store
moves to Redis and only `hit` changes — the policies and their tests do not.

**`.ts` import extensions are load-bearing.** `tests/*.test.ts` and
`src/lib/seed-data.ts` import with explicit `.ts` because they run under
`node --experimental-strip-types`. Do not "clean them up". `seed-data.ts` is not in
the Next app graph, so nothing bundled is affected. `eligibility.ts` imports its
type with `import type ... from "./market.ts"` — type-only, erased at compile time,
safe for both the bundler and node.

**`deleteUser` is enabled in `auth.ts` and the delete path is a landmine.**
Guideline 5.1.1(v) requires in-app account deletion, so the flag is on. But
`Membership`, `Position`, `Rating` and `Vote` all declare `onDelete: Cascade`
against `User` — deleting a user destroys other members' financial history — and
`Bet.creator/subject/opponent` are required relations with no `onDelete`, so
Postgres will RESTRICT and the delete will simply fail for anyone who has ever been
in a bet. **Do not ship a delete button until a `beforeDelete` hook anonymizes
instead of cascading.**

**Do not set `user.modelName` in `auth.ts`.** The adapter already resolves to the
Prisma model `User` with zero config. A capitalized custom `modelName` trips a
false-positive `SCHEMA_MISMATCH` on better-auth 1.7.3–1.7.5 that fails every auth
request. Fixed in 1.7.6, unpublished as of 2026-09-22.

**Money is integer cents.** `Membership.balance`, `Position.amount`,
`Position.payout`, `Position.balanceAtEntry` and `Bet.proposerLiability` are all
`Int`. Elo, probabilities and multipliers are genuinely continuous and stay
`Float` — do not "make them consistent".

Two rules hold this together. `payoutFor` in `market.ts` is **the only place a
money figure is rounded**; `settleFixed` and `bankPnl` both go through it, which
is what makes the proposer's loss exactly the negative of the bettors' gain.
`money()` in `format.ts` is **the only place cents become dollars** — the sole
correct division by 100 in the codebase. Round anywhere else and conservation
breaks a cent at a time; divide anywhere else and a figure renders 100x wrong.

`remainingCapacity` floors and then *verifies*, stepping down until admitting the
stake provably fits under the cap. It does not trust the division, because
`payoutFor` rounds and the last cent could otherwise breach the proposer's
backing.

**zod is a direct dependency on purpose.** It arrived transitively through
`@remotion/cli`, a devDependency, and every request body now depends on it.
Removing Remotion would have taken runtime validation with it. Still 5 audit
findings after that removal, unchanged.

**`npm audit` reports 5 vulnerabilities. Leave them.** All are build/dev-only:
postcss via next, deepmerge-ts via the prisma CLI (a devDependency). Nothing is in
the runtime path. `npm audit fix` is a no-op that only adds platform binaries to the
lockfile; `--force` installs Next 16, a major bump. Do the Next 16 upgrade
deliberately, in Phase 4, when the app becomes a pure API backend.

**`seed-data.ts` contains real people's names.** Must go before production.

---

## Product constraints — decided, don't relitigate

- **Fake currency, no cash-out, ever.** The moment balance converts to anything of
  value, this is a gambling operator under App Store Guideline 5.3.4, needs
  per-jurisdiction licensing, and the App Store path closes.
- **Age rating 18+.** Frequent simulated gambling. There is no honest route to 13+;
  answering the questionnaire otherwise is grounds for removal.
- **Guideline 1.4.5 is the existential risk**: "apps should not urge customers to
  participate in activities (like bets, challenges, etc.) ... that risks physical
  harm." So: `dares` is **template-only** at launch, from a vetted bank. Free text
  survives in `grades` and `sports`, gated on a pre-publish safety classifier.
  Four templates to cut from `seed-data.ts`: `d1` cold plunge, `d4` ghost pepper
  wing, `d9` barefoot lap, `d8` eat lunch alone.
- **Content filtering is two checks, not one.** Photos → OpenAI
  `omni-moderation-latest` (free, image-capable), before the image reaches a circle
  vote. Bet titles → a small LLM call against a written policy, because the
  moderation endpoint does not classify "risky physical challenge".
- **OpenAI for evidence verdicts too.** `spark.ts` already posts an OpenAI-shaped
  payload to `${base}/chat/completions`, so replacing the hackathon Muse Spark
  endpoint is an env change, not a rewrite. Keep the verdict-enum gate exactly as
  designed.
- **Client is Expo / React Native**, built from Windows via EAS Cloud. The Next.js
  app becomes the API. A Capacitor wrap of the current web UI is precisely what
  Guideline 4.2 rejects.

Long-form reasoning, the full gap list and the phased roadmap live in the
**claude.ai "HackMIT" project**: `app-store-readiness.md`, `build-log.md`,
`auth-decision.md`.

---

## Working style

Run `npm test` before and after any change to `market.ts`, `bets.ts`,
`eligibility.ts`, `circles.ts` or `rate-limit.ts` — those 111 cases are the safety net for the
whole economy.
New invariants get a pure module and a fuzz test, not an inline `if`.
