/**
 * The grading scale. db:deploy seeds it into the grade_rules table and
 * recomputes every stored level.
 */
export type GradeRule = {
  grade: string;
  sortOrder: number;
  label: string;
  minMiss: number | null;
  maxMiss: number | null;
  requiresFc: boolean;
  requiresPerfect: boolean;
  /** The most this grade pays before accuracy, as a percentage of the map's pack EXP. */
  expPercent: number;
};

/* ------------------------------------------------ what a misscount costs */

/**
 * The miss curve: CLEAN_SHARE * (1 + misses / MISS_SPREAD) ^ -MISS_POWER.
 * CLEAN_SHARE is what a pass with no misses earns before accuracy.
 */
export const CLEAN_SHARE = 90;
export const MISS_SPREAD = 43;
export const MISS_POWER = 4.5;

/** The share of a map's pack EXP a misscount earns, as a percentage. */
export function shareForMisses(misses: number): number {
  if (!Number.isFinite(misses) || misses <= 0) return CLEAN_SHARE;
  return CLEAN_SHARE * Math.pow(1 + misses / MISS_SPREAD, -MISS_POWER);
}

/** Rounded to the precision grade_rules.exp_percent keeps. */
const stored = (share: number) => Math.round(share * 1000) / 1000;

const miss = (
  grade: string,
  sortOrder: number,
  label: string,
  minMiss: number | null,
  maxMiss: number | null,
): GradeRule => ({
  grade, sortOrder, label, minMiss, maxMiss,
  requiresFc: false, requiresPerfect: false,
  // The curve read at this grade's cleanest misscount.
  expPercent: stored(shareForMisses(minMiss ?? 0)),
});

export const GRADE_RULES: GradeRule[] = [
  { grade: "SSS", sortOrder: 1, label: "100%", minMiss: null, maxMiss: null, requiresFc: false, requiresPerfect: true, expPercent: 120 },
  { grade: "SS", sortOrder: 2, label: "Full combo", minMiss: null, maxMiss: null, requiresFc: true, requiresPerfect: false, expPercent: 100 },
  miss("S", 3, "0 miss", 0, 0),
  miss("A+", 4, "1 miss", 1, 1),
  miss("A", 5, "2 miss", 2, 2),
  miss("A-", 6, "3 miss", 3, 3),
  miss("B+", 7, "4-5 miss", 4, 5),
  miss("B", 8, "6-7 miss", 6, 7),
  miss("B-", 9, "8-10 miss", 8, 10),
  miss("C+", 10, "11-15 miss", 11, 15),
  miss("C", 11, "16-20 miss", 16, 20),
  miss("C-", 12, "21-30 miss", 21, 30),
  miss("D+", 13, "31-40 miss", 31, 40),
  miss("D", 14, "41-50 miss", 41, 50),
  miss("D-", 15, "51-60 miss", 51, 60),
  miss("F+", 16, "61-80 miss", 61, 80),
  miss("F", 17, "81-100 miss", 81, 100),
  miss("Pass", 18, "100+ miss pass", 101, null),
];

export type PlayShape = {
  missCount: number;
  isFc: boolean;
  isPerfect: boolean;
};

/**
 * The grade a play earns. A 100% is SSS and a full combo is SS; everything
 * else comes from the miss bands. `requiresPerfect` means the run osu!
 * ranks X.
 */
export function gradeFor(play: PlayShape, rules: GradeRule[] = GRADE_RULES): string {
  const sorted = rules.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  if (play.isPerfect) {
    const r = sorted.find((x) => x.requiresPerfect);
    if (r) return r.grade;
  }
  if (play.isFc) {
    const r = sorted.find((x) => x.requiresFc);
    if (r) return r.grade;
  }
  // A missing or nonsense count grades as clean.
  const m = Number.isFinite(play.missCount) ? Math.max(0, play.missCount) : 0;
  for (const r of sorted) {
    if (r.requiresFc || r.requiresPerfect) continue;
    if (r.minMiss == null) continue;
    if (m >= r.minMiss && (r.maxMiss == null || m <= r.maxMiss)) return r.grade;
  }
  return sorted.length ? sorted[sorted.length - 1].grade : "Pass";
}

/** Lower is better. Picks a personal best and sorts leaderboards. */
export function gradeRank(grade: string, rules: GradeRule[] = GRADE_RULES): number {
  const r = rules.find((x) => x.grade === grade);
  return r ? r.sortOrder : 999;
}

/** The percentage of a map's pack EXP a grade earns before accuracy; 0 for an unknown grade. */
export function expPercentFor(grade: string, rules: GradeRule[] = GRADE_RULES): number {
  return rules.find((x) => x.grade === grade)?.expPercent ?? 0;
}

/** A result as anything choosing between two on the same map reads it. */
export type ResultShape = {
  gradeRank: number;
  missCount: number;
  accuracy: number | null;
};

/**
 * Which of two results on the same map is better, negative when the first
 * one is: grade, then misscount, then accuracy.
 */
export function compareResults(a: ResultShape, b: ResultShape): number {
  return (
    a.gradeRank - b.gradeRank ||
    a.missCount - b.missCount ||
    (b.accuracy ?? 0) - (a.accuracy ?? 0)
  );
}

/* ---------------------------------------------------- misses by map size */

/**
 * How map length scales a miss. On SHORT_NOTES to LONG_NOTES notes a miss
 * counts once; outside that each counts (nearest edge / notes) ^ MISS_CURVE
 * times, floored at MIN_MISS_FACTOR. Only the EXP moves; the grade letter
 * always reads the real misses.
 */
export const SHORT_NOTES = 1000;
export const LONG_NOTES = 1600;
export const MISS_CURVE = 0.5;
export const MIN_MISS_FACTOR = 0.8;

/** How many misses one miss counts as on a map this size; 1 when unknown. */
export function missFactor(noteCount: number | null | undefined): number {
  if (!noteCount || noteCount <= 0) return 1;
  const edge = Math.min(LONG_NOTES, Math.max(SHORT_NOTES, noteCount));
  return Math.max(MIN_MISS_FACTOR, Math.pow(edge / noteCount, MISS_CURVE));
}

/**
 * Misses as they count on a map this size, never below one. `weight` is how
 * many misses one counts as on the map's pack.
 */
export function scaledMisses(
  missCount: number,
  noteCount: number | null | undefined,
  weight = 1,
): number {
  if (missCount <= 0) return 0;
  return Math.max(1, missCount * missFactor(noteCount) * weight);
}

/* ------------------------------------------------ what accuracy wins back */

/** Accuracy wins back (accuracy / 100) ^ ACC_EXPONENT of one miss. */
export const ACC_EXPONENT = 24;

/** The share of one miss a play's accuracy wins back, 0 to 1; 0 when unknown. */
export function accuracyCredit(accuracy: number | null | undefined): number {
  if (accuracy == null || !Number.isFinite(accuracy) || accuracy <= 0) return 0;
  return Math.pow(Math.min(accuracy, 100) / 100, ACC_EXPONENT);
}

/** Every step expShare takes, so a player can be shown where their EXP came from. */
/** A share accuracy lifts toward the one above it. */
type Climb = {
  /** The share of one miss the accuracy won back, 0 to 1. */
  credit: number;
  /** The share before accuracy. */
  base: number;
  share: number;
};

export type ShareSteps =
  | { kind: "perfect"; share: number }
  /* A full combo, and a pass with no misses that broke the combo. */
  | ({ kind: "fc" } & Climb)
  | ({ kind: "clean" } & Climb)
  | {
      kind: "misses";
      misses: number;
      /** How many misses one counts as on a map this size. */
      factor: number;
      /** How many misses one counts as on the map's pack. */
      weight: number;
      /** The misses once scaled, 0 for none. */
      counted: number;
      /** The part of a miss the accuracy won back. */
      wonBack: number;
      share: number;
    };

/** A share accuracy lifts from `base` toward `top`. */
const climb = <K extends "fc" | "clean">(kind: K, base: number, top: number, credit: number) =>
  ({ kind, credit, base, share: base * Math.pow(top / base, credit) }) as { kind: K } & Climb;

/**
 * The share of a map's pack EXP a play earns, with the steps to it. A 100%
 * run keeps its own share. A full combo climbs toward it with accuracy, and
 * a pass with no misses climbs toward a full combo. Any other play reads the
 * curve at its scaled misses, less the part of one miss its accuracy wins
 * back, at most its last real miss. `weight` is how many misses one counts
 * as on the map's pack.
 */
export function explainShare(
  grade: string,
  missCount: number,
  noteCount: number | null | undefined,
  accuracy: number | null | undefined = null,
  weight = 1,
  rules: GradeRule[] = GRADE_RULES,
): ShareSteps {
  const perfect = rules.find((r) => r.requiresPerfect);
  if (perfect && grade === perfect.grade) return { kind: "perfect", share: perfect.expPercent };
  const credit = accuracyCredit(accuracy);
  const fc = rules.find((r) => r.requiresFc);
  const full = fc?.expPercent ?? 100;
  if (fc && grade === fc.grade) return climb("fc", full, perfect?.expPercent ?? full, credit);
  const counted = scaledMisses(missCount, noteCount, weight);
  if (counted === 0) return climb("clean", shareForMisses(0), full, credit);
  const room = Math.min(1, counted - scaledMisses(missCount - 1, noteCount, weight));
  return {
    kind: "misses",
    misses: missCount,
    factor: missFactor(noteCount),
    weight,
    counted,
    wonBack: room * credit,
    share: shareForMisses(counted - room * credit),
  };
}

/** The share of a map's pack EXP a play earns, as a percentage. */
export function expShare(
  grade: string,
  missCount: number,
  noteCount: number | null | undefined,
  accuracy: number | null | undefined = null,
  weight = 1,
  rules: GradeRule[] = GRADE_RULES,
): number {
  return explainShare(grade, missCount, noteCount, accuracy, weight, rules).share;
}
