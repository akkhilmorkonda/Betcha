# Build a promotional film for Betcha in Remotion

You are a motion designer and Remotion engineer. Build a finished, renderable
advertisement — 997 frames at 30 fps, 33.2 seconds, cut to the measured tempo of
the supplied track. Not a demo of Remotion features — a film. Every beat below is
specified; where something is not specified, choose the restrained option.

Read this entire brief before writing a line of code.

---

## 0 — WHAT BETCHA IS (so the copy is never generic)

Betcha is a prediction market for a friend group. One person becomes **the
House**: they make a claim, pick a side, and post the most they're willing to
lose. Everyone else can only take the opposite side. Prices come from each
person's **track record** — a rating per person per category — so money can
never move the odds; only results do. Winners are paid at the price they locked.

The single sentence the film exists to land:

> **Your friends' track record is the price.**

The tagline, used once, at the end: **Betcha can't.**

---

## 1 — NON-NEGOTIABLES

**Format.** 1920×1080, 30 fps, exactly **997 frames**. One composition,
`id="BetchaAd"`. 997 is twelve bars of the track at its measured tempo — it is
not a round number and must not be rounded to 900. See §3.

**Brand assets** (already in the repo, do not redraw them):
- `public/logo-transparent.png` — full lockup, alpha
- `public/logo-mark.png` — the crowned "b" alone, alpha
- Copy both into `remotion/public/` and load with `staticFile()`.

**Typefaces.** Space Grotesk (500, 700) for every number and headline; DM Sans
(400, 500, 700) for supporting text. Load with `@remotion/google-fonts`, never a
`<link>` — fonts must be resolved before the first frame renders or the opening
shot ships with fallback metrics.

**Colour, exact. Never invent a shade.**

| token | hex | use |
|---|---|---|
| ink | `#0B0D12` | the film's ground, 90% of frames |
| panel | `#14171F` | cards |
| edge | `#242938` | 1px card borders |
| cream | `#F8F4EF` | headlines, primary numbers |
| dim | `#A8B0C0` | supporting text |
| muted | `#7E8798` | labels, eyebrows |
| mint | `#6AF899` | the accent. Yes, up, win |
| red | `#E2565C` | No, down, loss |
| gold | `#F0B429` | pending / unresolved only |

Mint is the only saturated colour and it must feel rationed — if more than
about 15% of any frame is mint, you have overused it.

---

## 2 — SETUP

```
npx create-video@latest --blank betcha-ad
cd betcha-ad && npm i @remotion/google-fonts @remotion/media-utils
```

`Root.tsx` registers one composition: 1920×1080, fps 30, durationInFrames 997.

File layout — build it this way, not as one giant file:

```
src/
  Root.tsx
  Ad.tsx                 // the timeline: <Sequence> per shot, nothing else
  theme.ts               // colours, type scale, spring presets
  beats.ts               // the beat grid (below)
  ui/                    // the rebuilt app, reusable across shots
    BetCard.tsx  OddsBar.tsx  Stat.tsx  Avatar.tsx
    VerdictChip.tsx  PhoneFrame.tsx  RatingRow.tsx
  shots/
    S1Open.tsx  S2Noise.tsx  S3Card.tsx  S4Price.tsx  S5Take.tsx
    S6Proof.tsx  S7Payout.tsx  S8Reprice.tsx  S9Logo.tsx
  anim/
    useCount.ts          // number counters
    Reveal.tsx           // the one text-entrance component
```

---

## 3 — THE BEAT GRID

These numbers were measured from the actual `public/track.mp3`, not taken from a
BPM database. The file is 198.76 s long. Onset-strength autocorrelation over the
full track gives a stable tempo of **86.67 BPM** with the first downbeat at
**1.870 s**; the common published figure of ~173 BPM is the same grid at double
time, and librosa's default `beat_track` reports 103.36 BPM, which is an octave
error — do not use either.

`beats.ts`:

```ts
export const FPS = 30;
export const BPM = 86.67;       // measured from track.mp3, not from Tunebat
export const OFFSET = 0;        // the chosen audio start IS a downbeat — leave at 0
export const beat = (FPS * 60) / BPM;        // 20.7685
export const bar  = beat * 4;                // 83.0737
export const atBar  = (n: number) => Math.round(OFFSET + bar * n);
export const atBeat = (n: number) => Math.round(OFFSET + beat * n);
```

**Every cut, every entrance and every number-slam lands on `atBar` or `atBeat`.
No hand-typed frame numbers anywhere in the codebase.** This is what makes the
film feel scored rather than merely timed.

Bar starts, for reference:
`0, 83, 166, 249, 332, 415, 498, 581, 665, 748, 831, 914, 997`.

Accents inside a bar land on beats 1 and 3 (`atBeat(n*4)` and `atBeat(n*4+2)`).
Never place a beat on an odd subdivision unless the shot note says so.

---

## 4 — SHOT LIST

Nine shots. Each is a `<Sequence>` in `Ad.tsx` with `from` and
`durationInFrames` computed from `atBar`. Shots overlap by 4–6 frames so
cross-fades have material; hard cuts do not overlap.

| shot | bars | frames |
|---|---|---|
| S1 OPEN | 0–2 | 0–166 |
| S2 NOISE | 2–4 | 166–332 |
| S3 CARD | 4–6 | 332–498 |
| S4 PRICE | 6–8 | 498–665 |
| S5 TAKE | 8–9 | 665–748 |
| S6 PROOF | 9–10 | 748–831 |
| S7 PAYOUT | 10–10.5 | 831–872 |
| S8 REPRICE | 10.5–11 | 872–914 |
| S9 LOGO | 11–12 | 914–997 |

The cut at frame 498 is deliberate: with the audio start specified in §7, the
track's own section change lands at frame 492, six frames early. Let the picture
cut land on the bar at 498 and the music will feel like it turned for the cut.

### S1 · OPEN — bars 0–2 (frames 0–166)
Black. The crowned **b** mark scales in from 0.86 with a soft spring, mint crown
arriving ~3 frames after the letterform so it reads as landing on the head.
Around `atBeat(4)` the full wordmark wipes in from the mark's right edge —
a clip-path reveal, not a fade. Hold. At `atBeat(6)` a single line of DM Sans
28px in `muted`, centred under the lockup: *a prediction market for your group
chat*. Everything exits on `atBar(2)` with a 6-frame scale-down to 0.98 and fade.

### S2 · THE NOISE — bars 2–4 (frames 166–332)
Three quotes in Space Grotesk 72px, cream, staggered 6 frames apart, each
rising 24px into place with slight overshoot, each at a different x-offset so
they read as a pile-up, not a list:

> "I'll beat you at tennis."
> "No way you get a higher grade."
> "Betcha can't do it."

On `atBar(3.5)` they all desaturate to `muted` and drift back 40px with a blur
of 6px, and one line snaps forward in mint:

> **Nothing is ever on the line.**

### S3 · THE CARD — bars 4–6 (frames 332–498)
A `PhoneFrame` (390×844 content, rounded 48px, 1px `edge` border, subtle
inner shadow) rises from y+80 into centre-left, tilted ~8° on Y with a slight
perspective, then settles to flat by `atBeat(18)`.

Inside it, the real feed card assembles in order, 3 frames apart:
title → proposer row → action button.

```
UNTAKEN                                        (gold pill, top right)
Akkhil cold-plunges for 3 minutes
[avatar] Dev says no chance · $60 up · 2 days left
[            Akkhil does it · 10.71x            ]   (mint, full width)
```

To the right of the phone, in the empty half, Space Grotesk 44px `dim`:
**Someone puts money where their mouth is.**

### S4 · THE PRICE — bars 6–8 (frames 498–665)
The phone slides left and shrinks to 0.7. In the freed space, the derivation
builds left to right, one element per beat:

```
Akkhil · dares          the cold plunge
   1089          vs          1484              →        10.71x
 0 for 11            nobody has beaten it            a 9% shot
```

`1089`, `1484` and `10.71x` each **count up** from 0 over 14 frames with an
ease-out cubic, tabular numerals so nothing reflows. `0 for 11` types in
character by character in red, 2 frames per character.

Then the line that matters, appearing on `atBar(7)` in cream 56px, holding
alone for the full remaining bar:

> **Money doesn't move this price. Only results do.**

### S5 · TAKE IT — bar 8–9 (frames 665–748)
Back to the phone, full size. A soft mint ring pulses once under the action
button; the gold `UNTAKEN` pill cross-dissolves to a mint `LIVE` pill and the
card's border flashes mint for 5 frames. Beneath, a stake row writes on:

```
you  →  $6.18 at 10.71x  →  pays $66.18
```

The `$66.18` lands with a 1.06 scale pop on `atBeat(35)`.

### S6 · PROOF — bar 9–10 (frames 748–831)
Split screen. Left: a stylised hand-drawn tally card — *Math Game*, two names,
three strokes against two, strokes drawing on with a stroke-dashoffset animation
staggered 2 frames apart. Right: the verdict arriving —

```
MUSE SPARK
CLEARLY TRUE                                    (mint chip, scale-in)
— Column headed Yaxin shows three strokes
— Column headed Dev shows two
```

Observation lines type on 1.5 frames per character, monospaced feel via tabular
numerals, `dim`.

### S7 · PAYOUT — bar 10–10.5 (frames 831–872)
Two counters race in opposite directions on the same downbeat:

```
you    +$60.00          (mint, counts up)
Dev    −$60.00          (red, counts down)
```

Under them, 28px `muted`: **exactly what he put up. never a cent more.**

### S8 · REPRICE — bar 10.5–11 (frames 872–914)
Fast. Two rating rows flip like a split-flap:

```
Akkhil · dares     1089 → 1118      (mint)
the cold plunge    1484 → 1469      (red)
```

Then, snapping in on `atBar(11)`'s approach, the other bet's price changing:
**8.47x → 7.32x**, the old value struck through and sliding up as the new value
drops in.

### S9 · LOGO — bar 11–12 (frames 914–997)
Everything clears to ink on the downbeat at 914. The lockup returns at rest,
centred. Beneath it, in Space Grotesk 64px cream: **Betcha can't.** A single
mint underline draws left to right beneath it over 8 frames and stops. Hold,
still, for the rest of the bar. The film ends on the downbeat at 997 — the last
frame is silent and composed, not a fade-to-nothing mid-phrase.

---

## 5 — MOTION RULES (this is the difference between v1 and this)

**No linear easing anywhere.** Movement uses `spring({ frame, fps, config })`
with `{ damping: 200, mass: 0.6, stiffness: 120 }` for entrances and
`{ damping: 30, mass: 0.4 }` where a small overshoot is wanted. Opacity uses
`interpolate` with `Easing.out(Easing.cubic)`.

**Everything enters, nothing appears.** No element may pop into existence at
full opacity and final position on a single frame — except a deliberate
number-slam, which is the only hard cut in the film and is used at most twice.

**Stagger is the whole trick.** Sibling elements enter 3–6 frames apart, never
together. A card and its contents are not one animation; the card arrives, then
its children.

**Distance is small.** Entrances travel 16–40px. Anything flying 200px across
the frame reads as a template.

**Scale is subtle.** 0.94 → 1.0 for entrances, 1.0 → 1.06 for emphasis. Never
0.5 → 1.0.

**Blur costs nothing and buys a lot.** 4–8px blur on exit, resolving to 0 on
entrance, on the larger elements only.

**Hold longer than feels right.** A statement line gets a full bar alone. Dead
air is confidence; the most common failure of AI-generated motion is that
nothing is ever still.

**One camera move at a time.** If the phone is moving, the text is still.

---

## 6 — TYPOGRAPHY RULES

- Type scale, no other sizes: **120 / 72 / 56 / 44 / 32 / 28**.
- Every number is Space Grotesk 700 with
  `fontVariantNumeric: 'tabular-nums'` — counters must not reflow.
- Letter-spacing: `-3px` at 120, `-2px` at 72, `-1px` at 56, `0` below.
- Line-height 1.05 on display, 1.35 on body.
- Eyebrow labels: 28px, `muted`, uppercase, `letterSpacing: 2px`.
- Headlines are sentence case, never Title Case. Full stops on statements.
- At most two type sizes visible in any one frame.

---

## 7 — AUDIO

The track is **Danza Kuduro** (Don Omar ft. Lucenzo), already at
`public/track.mp3`. Copy it into `remotion/public/`.

The film does **not** start at the top of the song. The passage at **115.403 s**
was selected by scoring every downbeat in the track on three things: the
strength of the onset at that downbeat, the mean energy of the 33 seconds that
follow, and whether a section change lands near a planned cut. It won on all
three — it is the strongest downbeat in the track by a wide margin, it sits in
the highest-energy passage, and the section turn six frames from the S3→S4 cut
is free structure the picture gets to use.

115.403 s × 30 fps = frame **3462**. Because that point is itself a downbeat,
`OFFSET` stays 0.

```tsx
<Audio
  src={staticFile('track.mp3')}
  startFrom={3462}
  volume={(f) =>
    interpolate(f, [947, 997], [1, 0], { extrapolateLeft: 'clamp' })}
/>
```

The track runs 198.76 s, so there are 83 s of audio after the start point —
the 33.2-second film never reaches the end of the file.

Do not re-time the film by ear against a different start. If a different start
is wanted, it must be a downbeat: `1.870 + n × 2.7691` seconds.

If the file is absent, the composition must still render silently. Guard it.

---

## 8 — DO NOT

- No stock imagery, gradients-as-decoration, particles, confetti, lens flares,
  glassmorphism, or floating 3D shapes.
- No generic "AI" visuals: no neural nets, no glowing brains, no circuit traces.
- No typewriter effect on headlines. Only on the two places specified.
- No emoji, ever.
- No text under 28px. Nothing is readable at 28px on a phone anyway; 32 is the
  real floor for anything that matters.
- No more than two colours plus ink and cream in a single frame.
- No sliding transitions between shots except the one specified in S4. Cut.
- Do not invent product features. Everything shown above exists.
- Do not put the entire film in one component.
- Do not round the composition to 900 frames or the BPM to 89. Both break the
  grid the entire film is cut to.

---

## 9 — ACCEPTANCE

Before you say it is done, verify:

1. `npx remotion render BetchaAd out/betcha.mp4 --codec=h264 --crf=16` completes.
2. The composition is exactly 997 frames and `BPM === 86.67`.
3. Every `from` in `Ad.tsx` comes from `atBar()` or `atBeat()`.
4. Every colour is a `theme.ts` token. Grep for `#` in `src/shots` — zero hits.
5. Pause on frames 100, 300, 560, 780, 950. Each is a composed frame that could
   be a poster. If any one is mid-transition mush, retime that shot.
6. Mute the audio and watch. The film still reads.
7. Unmute and watch the cuts at 166, 332, 498, 665, 748, 831. Each should land
   on a kick. If they drift, `OFFSET` is wrong, not `BPM`.
8. No element appears at full opacity on its first frame.

Deliver the render, and a one-paragraph note on what you'd tighten with more
time.
