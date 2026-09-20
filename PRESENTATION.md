# Betcha — slide generation prompt (corrected)

Corrected against what is actually built. Every number here comes from
`npm run demo:numbers`. Nothing in this document describes a feature that
does not exist.

---

Create a polished, high-energy 5–7 minute hackathon presentation for **Betcha**.

## PRODUCT

Betcha is a social prediction market for friend groups. The core mechanic:

**Anyone can become the House.**

1. The House makes a claim and **picks a side** — "I say Akkhil can't do it."
2. The House sets the **maximum they are willing to lose**, and that money is
   escrowed immediately.
3. Betcha prices the bet from the participants' **track records** — a rating per
   person per category, against a difficulty rating for the challenge.
4. Everyone else can **only take the opposite side**. The House is alone on theirs.
5. Bets are capped by the House's **maximum loss**, not by total stakes —
   $50 behind a 10x line only supports about $5 of bets.
6. The bet is not live until somebody takes the House on.
7. The outcome is settled by **photo evidence** or, when a photo can't settle it,
   by a **vote of members with no money on it**.
8. Winners are paid at the price they locked. The result updates everyone's
   ratings, so the next bet on that person is priced differently.

Currency is simulated. **The app displays dollars, so the deck must say dollars** —
do not invent a separate points currency that contradicts the screen.

Playful, social, competitive. A prediction market for your group chat, not for
financial markets.

## WHAT IS TRUE AND WHAT IS NOT

These distinctions matter. A judge will ask.

**Odds come from Elo — deterministic arithmetic, no model involved.** Each person
has a skill rating per category; each challenge has a difficulty rating. The
price is the logistic of the gap between them. Never say or imply that AI
generates the odds.

**Muse Spark reads photo evidence.** It looks at one photo against one claim and
returns a verdict plus the concrete things it saw. It does not score entries, it
does not compare two images, and it does not compute probabilities.

**Betcha does not discover or suggest markets.** There is no AI finding matchups.
Do not build a slide around it.

**There is no join-by-QR flow.** The demo runs on the presenters' own devices.

## PRESENTATION GOAL

Judges understand the whole product in 90 seconds. The live demo is the
centrepiece; the deck supports it. 5–7 minutes, 9–11 slides, very little text,
large typography, betting-market UI, real product screenshots.

## VISUAL STYLE

Dark background (#0B0D12), high contrast, large tabular numbers, probability
bars, betting cards, green/red for yes/no only — never for good/bad. Use the
Betcha logo (`public/logo-transparent.png`) and real screenshots.

Avoid: corporate consulting slides, stock photography, dense architecture
diagrams, generic "AI startup" visuals.

---

## SLIDE 1 — HOOK

**BETCHA**
*"Betcha can't."*

Subtitle: **A prediction market for your group chat.**

Visual: a real bet card from the app.

> Dev says **no chance** · $60 up · UNTAKEN
> Akkhil cold-plunges for 3 minutes
> **[ Akkhil does it · 10.71x ]**

Speaker: *"Everyone has opinions about their friends. We built somewhere to put
money behind them."*

## SLIDE 2 — THE PROBLEM

**"Your friends are always making predictions."**

Three speech bubbles: *"I'll beat you at tennis." / "No way you get a higher
grade." / "Betcha can't do it."*

Then: **But nothing is ever on the line.**

## SLIDE 3 — THE CORE MECHANIC

**"Anyone can become the House."**

Six steps, icons and two-word labels:

**MAKE A CLAIM → PICK YOUR SIDE → SET YOUR MAX LOSS → BETCHA PRICES IT →
FRIENDS TAKE YOU ON → IT SETTLES**

Speaker: *"The House states a claim, picks a side, and says the most they're
willing to lose. That money is locked up the moment they post it."*

## SLIDE 4 — MAX LOSS IS NOT A STAKE

**"$60 is the most Dev can lose. It is not what Dev bet."**

Real card: Dev, no chance, **$60**, takers get **10.71x**, **$6.18** available.

Callout: **$60 of backing at 10.71x only covers $6.18 of bets.**

Speaker: *"Sixty dollars doesn't stretch far against a ten-to-one shot. The cap
is on what the House can lose, not on what people can stake — and it can never
be exceeded."*

## SLIDE 5 — ONE SIDE ONLY

**"The House can't bet against itself."**

Dev on the left with his side. Arrow to everyone else, who may only take the
other one. Show the bet flipping **UNTAKEN → LIVE** the moment someone does.

Bottom: **Money only ever moves between friends. There is no house edge, because
the house is your friend.**

## SLIDE 6 — WHERE THE PRICE COMES FROM

**"So who sets the odds?"**

Answer: **Your track record does.**

Show the actual derivation from the app:

> Akkhil · dares **1089** vs cold plunge **1484** → **9%** → **10.71x**
> *Akkhil has never once finished a dare. 0 for 11.*

Then the line that matters:

**Money does not move this price. Only results do.**

Speaker: *"This is ordinary Elo, not a model. Every person carries a rating per
category, every challenge carries a difficulty, and the price is the gap between
them. Twenty people betting one side wouldn't shift it a decimal place."*

## SLIDE 7 — THE CHALLENGES LEARN TOO

**"And the challenges rate themselves."**

> Cold plunge: seeded at **1500** → now **1484**
> *Because people keep failing it.*

Speaker: *"We guessed every difficulty at the start. The circle corrects them by
playing. When someone finally beats the plunge, it gets cheaper for everyone."*

## SLIDE 8 — SETTLING IT

**"Then someone has to prove it."**

Two paths, equal weight:

**PHOTO** → Muse Spark reads what's in frame → settles it
**NO PHOTO, OR NOT CONCLUSIVE** → the circle votes

Real Spark output as the visual — verdict chip plus its observations.

Include the honest part:

> We submitted a photo of a fridge against a running bet. Spark came back
> **99% confident** — and **refused to settle it.**

Speaker: *"We gate on the verdict, not the confidence number, exactly because of
that. And anyone with money on a bet is locked out of the vote — including
whoever put it up."*

## SLIDE 9 — LIVE DEMO

**"Okay. Let's actually do one."**

Almost no text. Then run it.

## SLIDE 10 — SETTLEMENT (live)

The payout screen, live. Dev's $60 gone, the taker paid, ratings moving:

> Akkhil · dares **1089 → 1118**
> Cold plunge **1484 → 1469**
> The other open dares bet: **8.47x → 7.32x**

Speaker: *"I just proved I can take a plunge, so every other dare on me got
cheaper automatically. Nobody gets that price again."*

## SLIDE 11 — THE LOOP

**"Every result prices the next bet."**

PREDICT → BACK IT → IT HAPPENS → IT SETTLES → **EVERY RATING MOVES** → the next
market is priced better.

Two boards, because they are different talents:

> **Money** — Dev $191.84
> **Sharpest** — Dev 1338, from 30 correct calls out of 38

Closing: **"You bring the friends. We'll price the argument."**

---

## RULES

1. Never claim AI sets the odds. Elo sets the odds.
2. Never show a feature that isn't built — no market discovery, no AI scoring,
   no QR join flow.
3. Say dollars, because the app says dollars.
4. Use real screenshots and real numbers from `npm run demo:numbers`.
5. Make **max loss** visually distinct from **stake**.
6. Make the House visually distinct from the people taking it on.
7. Under 45 seconds of mechanics before the demo starts.
8. The vote path is a feature, not a fallback — present it that way.
9. Frame it as a social prediction game, never as gambling.
10. Terminology must match the screen: *put it up*, *take them on*, *backing*,
    *settled*. "House" is fine in speech; it is not a label in the UI.

## TERMS

- **House** — whoever opens the bet and backs it
- **Max loss** — the most the House can lose; escrowed on creation
- **Take them on** — betting the opposite side
- **Skill rating** — per person per category; prices bets about them
- **Challenge rating** — how hard a dare is; moves when people attempt it
- **Forecasting rating** — how well you call other people's bets; never affects odds
