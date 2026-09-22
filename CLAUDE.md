# Betcha

Peer-to-peer prediction market for friend groups. You bet fake currency on whether
your friends will do things; odds come from their track record. Built for HackMIT
2026, now being taken to the iOS App Store as a real product.

**Next.js 15 (App Router) · React 19 · Prisma 6 · Postgres · Tailwind 3 · Better Auth 1.7.5**

---

## Commands

```bash
npm run dev            # next dev
npm test               # 194 cases across both workspaces, node --test, no DB needed
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
packages/core/          @betcha/core — shared with the future Expo client.
  market.ts             pure pricing + Elo. no Prisma. the heart of the product.
  eligibility.ts        pure. who may take which side, and who may end a bet early.
  circles.ts            pure. invite codes, name rules, join rules.
  templates.ts          pure. which categories may carry free text at all.
  schemas.ts            pure. zod shape of every request body.
  format.ts             money(). the ONLY place cents become dollars.
  categories.ts rng.ts avatar.ts
  seed-data.ts          hidden true skills -> simulated bets -> discovered Elo.

apps/api/               the Next.js app; becomes a pure API in Phase 4.
  src/lib/bets.ts       Prisma-bound orchestration. calls into core.
  src/lib/moderation.ts written policy + the two model calls. server only.
  src/lib/spark.ts      vision-model evidence verdicts.
  src/lib/auth.ts session.ts guard.ts rate-limit.ts account-deletion.ts db.ts
  src/app/api/          route handlers.
  src/app/c/[code]      circle feed, new bet, standings.
  src/app/b/[id]        bet detail.
  src/app/signin  src/app/account
  prisma/               schema, migrations, seed.
```

`packages/core` holds what a React Native bundle could import: no Prisma, no
`next/*`, no Node built-ins. Server concerns stay in `apps/api`. When something
is pure but server-only — rate limiting, account deletion — it stays in the app,
because "pure" is not the same as "shared".

**`.env` lives in `apps/api/`, not at the repo root.** That is where Next reads
it and where the package scripts run. Root scripts delegate with `-w apps/api`.

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

**Landed and verified (186/186 tests, tsc clean, `next build` clean):**
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

**Phase 1 is complete.** Wave 1 of Phase 2 has landed too.

**Wave 1 (186/186 tests, tsc clean, `next build` clean, no migration drift):**
- **Account deletion is safe.** Anonymize in place, ledger relations `Restrict`,
  `databaseHooks.user.delete.before` vetoes the row delete. See the trap below —
  it corrects what this file used to say.
- **Content safety is three layers, only the last of which is a model.**
  `dares` is template-only, enforced at the schema boundary *and* in `createBet`,
  which unlike the schema can load the `ChallengeTemplate` row and confirm it is
  itself a dare — closing the bypass of pointing a `dares` bet at a `grades`
  template. Then `TITLE_POLICY`, enforced as the classifier's system prompt and
  again offline. Then `omni-moderation-latest` for photos, before Spark reads
  them, and a `chat/completions` call for titles before any write.
- **Invariant 9 applied twice.** `/moderations` returns `category_scores` right
  next to the booleans — the same trap in a different costume. Nothing in
  `moderation.ts` reads a score. A test asserts no score key exists on the
  result type at all, plus two 20,000-case fuzzes.
- **`startVote` has a deadline guard.** Before the deadline only the SUBJECT may
  force a vote — the remaining time is the thing being bet on and it is theirs.
  After it, any member may. The PROPOSER gets no early exit despite backing the
  bet: they are the counterparty to every position, so "end it before they can
  do it" is exactly the move the guard stops. There is a named test so nobody
  adds them as an exception later.
- **The seed fixture can ship.** Fictional cast, and the four Guideline 1.4.5
  templates cut (`d1` cold plunge, `d4` ghost pepper, `d9` barefoot lap,
  `d8` lunch alone). 24 templates, 181 resolved bets, 4 open — still populated,
  which matters because an empty circle reads as Guideline 2.1 "incomplete".

**Open, and each one is a decision rather than a task:**
- **No delete button.** The path is safe, the UI is not wired.
- **No audit trail of unreviewed titles.** With no `OPENAI_API_KEY`, photos
  REFUSE (there is no offline fallback for an image) but titles ALLOW with an
  `unreviewed` verdict — that asymmetry is deliberate. The flag cannot be
  persisted: there is no column. Adding `Bet.titleReviewed` is a schema change
  nobody has decided on.
- **`custom` is a wide-open free-text category.** The product constraints name
  `grades` and `sports` and say nothing about `custom`, which is the obvious
  place to relabel a dare.
- **`d8` "eat lunch alone" would pass `TITLE_POLICY`.** It was cut from the seed
  bank, but the policy's harassment clause does not catch opt-in social
  isolation. Widen it or accept it, deliberately.
- **`resolutionDeadline` is written at creation and read by nothing.** Nothing
  expires a bet nobody settles; after the deadline it sits open until a member
  acts.
- `src/app/c/[code]/new/page.tsx` still offers a "custom" toggle for `dares`,
  which now 400s. The error surfaces correctly, but the toggle should be hidden.

---

## Traps

**The database is Postgres.** `schema.prisma` and `src/lib/auth.ts` both name
the provider and **must be changed together** — a mismatch fails every request
with P1012 at the Prisma layer, or a silent adapter mismatch at the Better Auth
layer. The SQLite migration history is gone: it was dialect-specific and could
never have replayed here, so the three migrations were deleted and re-cut as one
`init_postgres`. Nothing was converted, because the only data was seed fixtures.

Neon issues two URLs. The **direct** one is in `DATABASE_URL` and is what
`datasource db` uses for both `url` and `directUrl`, because migrations cannot
run through PgBouncer. `DATABASE_URL_POOLED` is the pooled endpoint and is
currently unused — wire it into `url` (leaving `directUrl` direct) if connection
count ever becomes a problem.

CI runs its own Postgres **service container**, not the Neon database: it starts
empty every run, so `migrate deploy` is exercised exactly as a deployment would
exercise it, and no CI run can touch real data. The drift check needs a second
database on that container, created by an explicit step — the service only
creates one.

**Metro will not follow a Windows junction, and that is how npm links workspace
packages here.** Measured, not guessed — see the spike notes below.

When the Expo client lands in a monorepo, `npm install` links `packages/core`
into `node_modules`. On Windows a real symlink needs admin or Developer Mode;
**Developer Mode is off on the dev machine**, so npm falls back to a *junction*.
Metro's resolver does not traverse junctions, and the bundle dies with
`Unable to resolve module @betcha/core` — even though the junction reads fine
from the shell, and even with `--clear`. Swap the junction for a real directory
and the identical code bundles, which is how this was isolated.

Fix, verified to produce a byte-identical bundle to the non-junction build:

```js
// metro.config.js
const core = path.resolve(__dirname, "..", "..", "packages", "core");
config.watchFolders = [...(config.watchFolders ?? []), core];
config.resolver.extraNodeModules = { "@betcha/core": core };
config.resolver.nodeModulesPaths = [
  ...(config.resolver.nodeModulesPaths ?? []),
  path.resolve(__dirname, "node_modules"),
];
```

All three lines are needed. Without the third, code inside `core` cannot find
hoisted dependencies (`zod`) and fails one step later, which reads like a
different bug. Enabling Developer Mode is the alternative, but ship the config
anyway: it costs nothing on EAS's macOS workers, where symlinks already work,
and it does not depend on a machine setting.

**What the same spike PROVED IS FINE** — do not re-litigate these:
`.ts` runtime specifiers resolve under Metro; so does a `"main": "./src/index.ts"`
entry and a barrel that re-exports through `.ts` specifiers. `market.ts`,
`schemas.ts`, `circles.ts`, `categories.ts`, `format.ts` and `eligibility.ts`
bundled as 680 modules, verified by grepping the Hermes output for string
literals only those files contain. **The `.ts` convention survives the move to
mobile; the test runner does not need to change.**

Current as of the spike: `expo@57.0.24`, React 19.2.3, RN 0.86.3. The app is on
React 19.0.0 — that mismatch is exactly why Expo cannot live at the repo root.
Unproven: a full `npm install` on a real workspace. The spike's workspace install
truncated at 86 packages with no `metro`, and was worked around rather than
diagnosed. Watch for it.

**`.ts` import extensions are load-bearing.** `tests/*.test.ts` and
`src/lib/seed-data.ts` import with explicit `.ts` because they run under
`node --experimental-strip-types`. Do not "clean them up". `seed-data.ts` is not in
the Next app graph, so nothing bundled is affected. `eligibility.ts` imports its
type with `import type ... from "./market.ts"` — type-only, erased at compile time,
safe for both the bundler and node.

**Account deletion anonymizes; it must never cascade, and `beforeDelete` cannot
stop it.** Guideline 5.1.1(v) requires in-app deletion, so `deleteUser` is on.

Every foreign key into `User` is required and non-null, so removing the row has
only two alternatives and both are wrong. Cascading deletes *other members'*
positions and votes — money leaves one side of the books with nothing balancing
it, so invariant 4 breaks by construction. Repointing to a shared tombstone
collides, because `Position` is unique on `[betId, userId]`: the second person
to delete hits the first on any bet they both touched.

So the row survives, scrubbed in place. `src/lib/account-deletion.ts` says what
a scrubbed row contains; Better Auth destroys the `Session` and `Account` rows
(password hash included) itself. Exactly one row is mutated and no money column
is touched, which is what makes "every other member's history is byte-identical"
a guarantee rather than a hope.

**An earlier version of this file prescribed a `beforeDelete` hook. That hook
provably cannot do the job** — verified against the installed better-auth 1.7.5
source, not its prose docs. In `dist/api/routes/update-user.mjs` the hook is
awaited and the delete then runs *unconditionally*, consulting no return value;
throwing is its only interruption, which would fail the request *after* the
scrub had committed — PII gone and a 500 returned. The hook that works is
`databaseHooks.user.delete.before`, which `dist/db/with-hooks.mjs` treats as
"skip the delete" when it returns `false`. `auth.ts` uses both: `beforeDelete`
scrubs, the database hook vetoes the row delete.

The veto is deliberately unconditional, so **no `User` row can be deleted by any
path**, including a future admin tool. That is the same invariant the schema now
enforces: the four ledger relations are `Restrict`, and `Bet`'s three are
explicitly `Restrict` — note `Bet.opponent` is optional and was therefore
defaulting to `SetNull`, which would have silently blanked the opponent out of a
live head-to-head.

**There is still no delete button.** The path is safe; the UI is not wired, so
5.1.1(v) is not yet satisfied end to end.

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

**The seed cast is fictional — keep it that way.** `alice`/`bob`/`carol`/`dave`/
`erin`/`frank`, keys and display names both. Real names were spread much wider
than this note once implied: they were also in `spark.ts`'s **model prompt**, in
`market.ts` and `lifecycle.test.ts` comments, and in five scripts that index
simulation results **by member key** — `story-check.ts` hard-failed on the
rename and `pick-seed.ts` silently ranked a key that no longer existed. None of
those scripts run in CI. If you ever rename members again, grep the whole tree,
not just `seed-data.ts`.

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
`eligibility.ts`, `circles.ts`, `rate-limit.ts` or `moderation.ts` — those 194 cases are the safety net for the
whole economy.
New invariants get a pure module and a fuzz test, not an inline `if`.
