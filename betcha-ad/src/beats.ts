/**
 * THE GRID. Measured from public/track.mp3, not looked up.
 *
 *   file length      198.76 s
 *   tempo            86.67 BPM   (onset-autocorrelation over the full track)
 *   first downbeat   1.870 s
 *
 * Published figures of ~173 BPM are this grid at double time. librosa's
 * default beat_track() reports 103.36 BPM, which is an octave error.
 * Do not "correct" these numbers. Every cut in the film derives from them.
 */

export const FPS = 30;
export const BPM = 86.67;

/** Frames before the first downbeat. The chosen audio start IS a downbeat. */
export const OFFSET = 0;

export const beat = (FPS * 60) / BPM; // 20.7685
export const bar = beat * 4; // 83.0737

export const atBar = (n: number) => Math.round(OFFSET + bar * n);
export const atBeat = (n: number) => Math.round(OFFSET + beat * n);

/** 12 bars. 33.23 s. Not 900 — 900 ends mid-bar. */
export const DURATION_IN_FRAMES = atBar(12); // 997

/**
 * The film starts at 115.403 s into the track, not at the top.
 * Selected by scoring every downbeat on onset strength, forward energy, and
 * proximity of a section change to a planned cut. It won all three: strongest
 * downbeat in the track (14.70 vs 13.81 for the runner-up), highest-energy
 * passage, and the section turn lands at frame 492 — six frames before the
 * S3 -> S4 cut at 498.
 *
 * 115.403 s * 30 fps = 3462.
 * Any alternative start must also be a downbeat: 1.870 + n * 2.7691 seconds.
 */
export const AUDIO_START_FRAME = 3462;

/** Audio fade-out covers the last 50 frames, under the logo. */
export const AUDIO_FADE_FROM = DURATION_IN_FRAMES - 50; // 947

/** Shot boundaries. Every <Sequence> from/duration comes from here. */
export const SHOTS = {
  S1Open:    { from: atBar(0),    to: atBar(2) },     //   0 - 166
  S2Noise:   { from: atBar(2),    to: atBar(4) },     // 166 - 332
  S3Card:    { from: atBar(4),    to: atBar(6) },     // 332 - 498
  S4Price:   { from: atBar(6),    to: atBar(8) },     // 498 - 665
  S5Take:    { from: atBar(8),    to: atBar(9) },     // 665 - 748
  S6Proof:   { from: atBar(9),    to: atBar(10) },    // 748 - 831
  S7Payout:  { from: atBar(10),   to: atBar(10.5) },  // 831 - 872
  S8Reprice: { from: atBar(10.5), to: atBar(11) },    // 872 - 914
  S9Logo:    { from: atBar(11),   to: atBar(12) },    // 914 - 997
} as const;

export type ShotName = keyof typeof SHOTS;

export const shot = (name: ShotName) => {
  const { from, to } = SHOTS[name];
  return { from, durationInFrames: to - from };
};
