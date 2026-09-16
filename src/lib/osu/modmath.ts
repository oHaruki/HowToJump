/**
 * Mod adjusted difficulty values.
 *
 * A bank entry is a beatmap under one mod, so the figures shown against it
 * have to be the ones a player actually sees. DT does not just speed the song
 * up: it shortens the approach and hit windows, which raises effective AR and
 * OD. HR scales the raw values instead.
 *
 * Star rating is the exception. It needs the full difficulty calculator, so it
 * comes from the osu! API rather than from anything here.
 */

export type Diff = {
  cs: number | null;
  ar: number | null;
  od: number | null;
  hp?: number | null;
  bpm: number | null;
  drainSeconds: number | null;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Playback rate. Nightcore is Double Time with a pitch shift. */
export function rateOf(mod: string): number {
  const m = (mod || "NM").toUpperCase();
  if (m.includes("NC") || m.includes("DT")) return 1.5;
  if (m.includes("HT")) return 0.75;
  return 1;
}

/* AR is stored as a number but behaves as a time: how long a circle is
   visible before it must be hit. Speeding the song up shortens that time. */
export function arToPreempt(ar: number): number {
  return ar < 5 ? 1800 - 120 * ar : 1200 - 150 * (ar - 5);
}
export function preemptToAr(preempt: number): number {
  return preempt > 1200 ? (1800 - preempt) / 120 : 5 + (1200 - preempt) / 150;
}

/** OD is the 300 hit window, in milliseconds. */
export function odToWindow(od: number): number {
  return 80 - 6 * od;
}
export function windowToOd(window: number): number {
  return (80 - window) / 6;
}

/**
 * Applies a mod to a set of nomod values.
 *
 * Difficulty multipliers (HR, EZ) are applied to the raw numbers first, then
 * the rate change converts AR and OD through their underlying timings.
 */
export function applyMod(base: Diff, mod: string): Diff {
  const m = (mod || "NM").toUpperCase();
  const rate = rateOf(m);

  let cs = base.cs;
  let ar = base.ar;
  let od = base.od;
  let hp = base.hp ?? null;

  if (m.includes("HR")) {
    // Circle size is capped lower than the rest.
    if (cs != null) cs = clamp(cs * 1.3, 0, 10);
    if (ar != null) ar = clamp(ar * 1.4, 0, 10);
    if (od != null) od = clamp(od * 1.4, 0, 10);
    if (hp != null) hp = clamp(hp * 1.4, 0, 10);
  } else if (m.includes("EZ")) {
    if (cs != null) cs = cs * 0.5;
    if (ar != null) ar = ar * 0.5;
    if (od != null) od = od * 0.5;
    if (hp != null) hp = hp * 0.5;
  }

  if (rate !== 1) {
    // Circle size is a distance, so the rate leaves it alone.
    if (ar != null) ar = clamp(preemptToAr(arToPreempt(ar) / rate), 0, 11);
    if (od != null) od = clamp(windowToOd(odToWindow(od) / rate), 0, 11);
  }

  return {
    cs: cs == null ? null : round2(cs),
    ar: ar == null ? null : round2(ar),
    od: od == null ? null : round2(od),
    hp: hp == null ? null : round2(hp),
    bpm: base.bpm == null ? null : Math.round(base.bpm * rate),
    drainSeconds:
      base.drainSeconds == null ? null : Math.round(base.drainSeconds / rate),
  };
}

/* ------------------------------------------------------------- pacing */

/**
 * Length bucket from drain time. The boundaries come from how the sheet
 * already classifies its own maps: 1:06 and 1:20 are TV Size, 1:58 and 2:12
 * are Medium, and 3:10 upwards is Long.
 */
export function lengthBucketFor(drainSeconds: number | null | undefined): string {
  if (drainSeconds == null) return "";
  if (drainSeconds < 95) return "TV Size";
  if (drainSeconds < 180) return "Medium";
  if (drainSeconds < 300) return "Long";
  return "Marathon";
}

/**
 * A suggestion only, never applied silently.
 *
 * BPM alone cannot decide this: the sheet marks two 132 BPM maps as High,
 * because what matters is note density rather than the song's tempo. Staff
 * pick the real value, this just gives the dropdown a sensible starting point.
 */
export function speedGuessFor(bpm: number | null | undefined): string {
  if (bpm == null) return "";
  if (bpm < 170) return "Low";
  if (bpm < 220) return "Medium";
  return "High";
}
