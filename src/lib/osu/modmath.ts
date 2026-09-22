/**
 * Mod adjusted difficulty values. DT shortens the approach and hit windows,
 * raising effective AR and OD; HR scales the raw values instead. Star
 * rating is not here — it comes from the osu! API.
 */

import { bucketFor, LENGTH_SCALE, SPEED_SCALE } from "@/lib/tiers";

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
 * Applies a mod to a set of nomod values: the HR/EZ multipliers first, then
 * the rate change through AR and OD's underlying timings.
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
 * Length bucket from drain time, on `LENGTH_SCALE`. Anything under the
 * scale's 0:30 floor counts as a Cut Ver.
 */
export function lengthBucketFor(drainSeconds: number | null | undefined): string {
  if (drainSeconds == null) return "";
  return bucketFor(LENGTH_SCALE, drainSeconds);
}

/**
 * A starting point for the dropdown, never applied silently: this reads BPM,
 * but what staff grade is note density.
 */
export function speedGuessFor(bpm: number | null | undefined): string {
  if (bpm == null) return "";
  return bucketFor(SPEED_SCALE, bpm);
}
