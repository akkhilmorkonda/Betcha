# Betcha ad — working rules

The full brief is `@REMOTION_PROMPT.md`. Read it in full before your first edit,
and re-read §3 (the grid) and §4 (the shot list) before touching any timing.

## Never change these

| | |
|---|---|
| `BPM` | `86.67` — measured from the mp3, not looked up |
| `OFFSET` | `0` — the chosen audio start is itself a downbeat |
| `DURATION_IN_FRAMES` | `997` — twelve bars. Not 900. 900 ends mid-bar. |
| `AUDIO_START_FRAME` | `3462` — 115.403 s in |

`src/beats.ts` and `src/theme.ts` are already written and are correct. Treat
them as read-only unless I say otherwise. If a shot doesn't fit the grid,
retime the shot, never the grid.

## Rules

- No hand-typed frame numbers anywhere. Every `from` and `durationInFrames`
  comes from `shot()`, `atBar()` or `atBeat()` in `beats.ts`.
- No hex colour literals outside `theme.ts`. Grep `src/shots` for `#` — zero hits.
- No font sizes outside the `size` scale in `theme.ts`.
- `Ad.tsx` is the timeline and nothing else: one `<Sequence>` per shot, no logic.
- Nothing appears at full opacity on its first frame. Everything enters.
- Assets are real and already in `public/` — `logo-transparent.png`,
  `logo-mark.png`, `track.mp3`. Load with `staticFile()`. Never draw a
  placeholder logo.
- Fonts load via `@remotion/google-fonts`, never a `<link>`.

## Verify by looking, not by reasoning

After building any shot, render a still at its first frame and its midpoint and
**read the PNG**:

```
npx remotion still BetchaAd out/f<N>.png --frame=<N>
```

Then say what is wrong with the composition before I look at it. Code that
compiles is not evidence the frame is composed. Do this every time.

For motion review use the cheap render, not the final one:

```
npm run preview     # 480p, crf 28
npm run render      # 1080p, crf 16 — only at the very end
```

## Build order

One pass per message. Do not run ahead.

1. `src/anim/` (`useCount.ts`, `Reveal.tsx`) and all of `src/ui/`. Render each
   component as a still on ink before moving on.
2. S1–S3 wired into `Ad.tsx`; remaining shots stubbed black.
3. S4–S6.
4. S7–S9, the `<Audio>`, then the §9 acceptance checklist end to end.

## Where things are

```
src/beats.ts   the grid + SHOTS table + shot() helper   [done, locked]
src/theme.ts   colours, type scale, spring presets      [done, locked]
src/Root.tsx   the single composition                   [done]
src/Ad.tsx     the timeline                             [stub]
src/ui/        BetCard OddsBar Stat Avatar
               VerdictChip PhoneFrame RatingRow         [todo]
src/shots/     S1Open … S9Logo                          [todo]
src/anim/      useCount.ts Reveal.tsx                   [todo]
```
