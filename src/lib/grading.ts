/**
 * The grading scale.
 *
 * This array is what the app grades against, and db:deploy seeds it into the
 * grade_rules table so the numbers can be read from the database. Nothing
 * reads that table back, so retuning a grade is a code change: the deploy
 * reseeds the table and recomputes every stored level, which is all a retune
 * takes. It used to say staff could retune without a deploy, which was never
 * true of anything the app actually read.
 */
export type GradeRule = {
  grade: string;
  sortOrder: number;
  label: string;
  minMiss: number | null;
  maxMiss: number | null;
  requiresFc: boolean;
  requiresPerfect: boolean;
  /**
   * The share of a map's pack EXP this grade earns, as a percentage.
   *
   * A 100% run earns a fifth more than the map is worth and a full combo all
   * of it; those two are set by hand. Every band of misses takes the share
   * the curve gives its cleanest misscount, so what is shown beside a grade
   * is the best that grade pays. EXP itself is read off the curve at the
   * play's own misscount, not out of this column.
   */
  expPercent: number;
};

/* ------------------------------------------------ what a misscount costs */

/**
 * EXP falls away with the misscount on one smooth curve.
 *
 * It used to be read out of the band table below, which meant two plays on
 * the same pack could be worth exactly the same despite one dropping thirty
 * more notes, and one extra miss at a band edge could halve a play. The
 * grade letter still comes from the bands, osu! style; only the EXP is
 * continuous.
 *
 * Three numbers, all halvings of the map's pack EXP. MISS_KNEE sets how
 * sharply the first few misses bite. MISS_SLOPE is the steady fall after
 * that. MISS_ACCEL is what each miss costs on top of the last one, and it
 * is the one that matters most: without it the fall is flat, every miss
 * costing the same 4.5% of what is left however many have gone already, so
 * going from thirty misses to fifty only cost a third of the play. Thirty
 * misses and fifty are both a map survived rather than cleared, and the gap
 * between them and a clean clear has to say so.
 *
 * Past MISS_ACCEL_CAP the acceleration stops: there is nothing left to take,
 * and the share still has to fit grade_rules.exp_percent and keep falling
 * so that two hopeless passes are never worth exactly the same.
 */
export const MISS_KNEE = 0.8;
export const MISS_SLOPE = 0.0664;
export const MISS_ACCEL = 0.001;
export const MISS_ACCEL_CAP = 60;

/** A pack is reached at BEST_PLAYS plays of this misscount on it. */
export const THRESHOLD_MISSES = 2;
export const THRESHOLD_SHARE = 75;

/** What the acceleration has cost by this misscount, and no more after the cap. */
const accelerated = (misses: number) => MISS_ACCEL * Math.pow(Math.min(misses, MISS_ACCEL_CAP), 2);

/* Pinned rather than fitted, so THRESHOLD_MISSES pays THRESHOLD_SHARE to the
   last decimal. Every pack's threshold is read from that one number, and a
   pack boundary landing on 74.98% of where it is written would be a puzzle. */
const MISS_KNEE_WEIGHT =
  (Math.log2(100 / THRESHOLD_SHARE) - MISS_SLOPE * THRESHOLD_MISSES - accelerated(THRESHOLD_MISSES)) /
  Math.log2(1 + THRESHOLD_MISSES / MISS_KNEE);

/**
 * The share of a map's pack EXP a misscount earns, as a percentage. Zero
 * misses is the whole of it, and it falls away from there without a step.
 */
export function shareForMisses(misses: number): number {
  if (!Number.isFinite(misses) || misses <= 0) return 100;
  const halvings =
    MISS_KNEE_WEIGHT * Math.log2(1 + misses / MISS_KNEE) +
    MISS_SLOPE * misses +
    accelerated(misses);
  return 100 * Math.pow(2, -halvings);
}

/** Rounded to what grade_rules.exp_percent keeps, so the two cannot differ. */
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
  // The best this grade pays: its cleanest misscount, off the same curve.
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
 * The top two grades are not about misses: a 100% is SSS and a full combo is
 * SS. `requiresPerfect` is the flag for the first of those, named for the
 * column it seeds; what it means is the run osu! ranks X.
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
  // A count osu! could not give us, or a nonsense one, grades as clean
  // rather than falling off the bottom of the table.
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

/** The percentage of a map's pack EXP a grade earns; 0 for an unknown grade. */
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
 * one is: grade, then the misscount, then accuracy.
 *
 * The misscount has to be in there because a grade covers a band. 21 misses
 * and 24 are both C-, so on the grade alone the sloppier run took the
 * personal best, and the leaderboard place with it, on a point of accuracy.
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
 * Misses cost more EXP on a short map than on a long one, since staying
 * clean over 150 notes is far easier than over 1,500. The grade letter still
 * reads the real misses, osu! style, so every grade stays reachable on every
 * map; only the EXP a play earns moves.
 *
 * A map of REFERENCE_NOTES, a normal consistency map, counts as it is.
 * Elsewhere each miss counts (REFERENCE_NOTES / notes) ^ MISS_CURVE times.
 * That's the gentle curve Kayrem picked: a 30 second map of about 150 notes
 * counts each miss about three times, rather than the ten that plain division
 * would give.
 *
 * MIN_MISS_FACTOR is how far that can go the other way. The rule was only
 * ever that a short map punishes misses more; a long map paying less just
 * fell out of the same formula, and unbounded it swallowed the whole miss
 * curve. Thirty misses on a 6,000 note map counted as fifteen and earned
 * what a clean Emerald full combo does. A long map may now discount a miss
 * by a fifth at most, which still pays a clean marathon for the stamina
 * without handing a sloppy one a way around the curve.
 */
export const REFERENCE_NOTES = 1500;
export const MISS_CURVE = 0.5;
export const MIN_MISS_FACTOR = 0.8;

/** How many misses one miss counts as on a map this size; 1 when unknown. */
export function missFactor(noteCount: number | null | undefined): number {
  if (!noteCount || noteCount <= 0) return 1;
  return Math.max(MIN_MISS_FACTOR, Math.pow(REFERENCE_NOTES / noteCount, MISS_CURVE));
}

/** Misses as they count on a map this size: rounded, and never below one. */
export function scaledMisses(missCount: number, noteCount: number | null | undefined): number {
  if (missCount <= 0) return 0;
  return Math.max(1, Math.round(missCount * missFactor(noteCount)));
}

/**
 * The share of a map's pack EXP a play earns.
 *
 * A 100% run and a full combo are not about misses, so they keep the share
 * set against their own rule. Everything else is the curve read at the
 * play's misses as they count on a map that size, which is the real
 * misscount on a 1,500 note map and on a map with no count yet.
 */
export function expShare(
  grade: string,
  missCount: number,
  noteCount: number | null | undefined,
  rules: GradeRule[] = GRADE_RULES,
): number {
  const own = rules.find((r) => r.grade === grade && (r.requiresFc || r.requiresPerfect));
  if (own) return own.expPercent;
  return shareForMisses(scaledMisses(missCount, noteCount));
}
