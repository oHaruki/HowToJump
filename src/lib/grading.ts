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
 * The miss curve, in halvings of the map's pack EXP.
 *
 * MISS_KNEE sets how sharply the first few misses bite, MISS_SLOPE the
 * steady fall after that, and MISS_ACCEL what each miss adds on top of the
 * last. The acceleration stops at MISS_ACCEL_CAP.
 */
export const MISS_KNEE = 0.8;
export const MISS_SLOPE = 0.0664;
export const MISS_ACCEL = 0.001;
export const MISS_ACCEL_CAP = 60;

/** A pack is reached at BEST_PLAYS plays of this misscount on it. */
export const THRESHOLD_MISSES = 2;
export const THRESHOLD_SHARE = 75;

/** What the acceleration has cost by this misscount, flat after the cap. */
const accelerated = (misses: number) => MISS_ACCEL * Math.pow(Math.min(misses, MISS_ACCEL_CAP), 2);

/* Pins the curve so THRESHOLD_MISSES pays THRESHOLD_SHARE exactly. */
const MISS_KNEE_WEIGHT =
  (Math.log2(100 / THRESHOLD_SHARE) - MISS_SLOPE * THRESHOLD_MISSES - accelerated(THRESHOLD_MISSES)) /
  Math.log2(1 + THRESHOLD_MISSES / MISS_KNEE);

/** The share of a map's pack EXP a misscount earns, as a percentage. */
export function shareForMisses(misses: number): number {
  if (!Number.isFinite(misses) || misses <= 0) return 100;
  const halvings =
    MISS_KNEE_WEIGHT * Math.log2(1 + misses / MISS_KNEE) +
    MISS_SLOPE * misses +
    accelerated(misses);
  return 100 * Math.pow(2, -halvings);
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
 * How map length scales a miss. A map of REFERENCE_NOTES counts as it is;
 * elsewhere each miss counts (REFERENCE_NOTES / notes) ^ MISS_CURVE times,
 * floored at MIN_MISS_FACTOR. Only the EXP moves — the grade letter always
 * reads the real misses.
 */
export const REFERENCE_NOTES = 1500;
export const MISS_CURVE = 0.5;
export const MIN_MISS_FACTOR = 0.8;

/** How many misses one miss counts as on a map this size; 1 when unknown. */
export function missFactor(noteCount: number | null | undefined): number {
  if (!noteCount || noteCount <= 0) return 1;
  return Math.max(MIN_MISS_FACTOR, Math.pow(REFERENCE_NOTES / noteCount, MISS_CURVE));
}

/** Misses as they count on a map this size, never below one. */
export function scaledMisses(missCount: number, noteCount: number | null | undefined): number {
  if (missCount <= 0) return 0;
  return Math.max(1, missCount * missFactor(noteCount));
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
export type ShareSteps =
  | { kind: "perfect"; share: number }
  | {
      kind: "fc";
      /** The share of one miss the accuracy won back, 0 to 1. */
      credit: number;
      share: number;
    }
  | {
      kind: "misses";
      misses: number;
      /** How many misses one counts as on this map. */
      factor: number;
      /** The misses once scaled, 0 for none. */
      counted: number;
      /** The part of a miss the accuracy won back. */
      wonBack: number;
      share: number;
    };

/**
 * The share of a map's pack EXP a play earns, with the steps to it. A 100%
 * run keeps its own share and a full combo climbs toward it with accuracy.
 * Any other play reads the curve at its scaled misses, less the part of one
 * miss its accuracy wins back, at most its last real miss.
 */
export function explainShare(
  grade: string,
  missCount: number,
  noteCount: number | null | undefined,
  accuracy: number | null | undefined = null,
  rules: GradeRule[] = GRADE_RULES,
): ShareSteps {
  const perfect = rules.find((r) => r.requiresPerfect);
  if (perfect && grade === perfect.grade) return { kind: "perfect", share: perfect.expPercent };
  const credit = accuracyCredit(accuracy);
  const fc = rules.find((r) => r.requiresFc);
  if (fc && grade === fc.grade) {
    const top = perfect?.expPercent ?? fc.expPercent;
    return { kind: "fc", credit, share: fc.expPercent * Math.pow(top / fc.expPercent, credit) };
  }
  const counted = scaledMisses(missCount, noteCount);
  const room = counted === 0 ? 0 : Math.min(1, counted - scaledMisses(missCount - 1, noteCount));
  return {
    kind: "misses",
    misses: missCount,
    factor: missFactor(noteCount),
    counted,
    wonBack: room * credit,
    share: counted === 0 ? shareForMisses(0) : shareForMisses(counted - room * credit),
  };
}

/** The share of a map's pack EXP a play earns, as a percentage. */
export function expShare(
  grade: string,
  missCount: number,
  noteCount: number | null | undefined,
  accuracy: number | null | undefined = null,
  rules: GradeRule[] = GRADE_RULES,
): number {
  return explainShare(grade, missCount, noteCount, accuracy, rules).share;
}
