/**
 * The grading scale is data, not code, so staff can retune a threshold
 * without a deploy. This array seeds the grade_rules table and is also the
 * fallback the app grades against when the table has not been seeded.
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
   * The share of a map's pack EXP this grade earns, as a percentage. Kayrem's
   * scale: a 100% run earns a fifth more than the map is worth, a full combo
   * or zero misses all of it, then less for every miss band.
   */
  expPercent: number;
};

const miss = (
  grade: string,
  sortOrder: number,
  label: string,
  minMiss: number | null,
  maxMiss: number | null,
  expPercent: number,
): GradeRule => ({
  grade, sortOrder, label, minMiss, maxMiss,
  requiresFc: false, requiresPerfect: false, expPercent,
});

export const GRADE_RULES: GradeRule[] = [
  { grade: "SSS", sortOrder: 1, label: "100%", minMiss: null, maxMiss: null, requiresFc: false, requiresPerfect: true, expPercent: 120 },
  { grade: "SS", sortOrder: 2, label: "Full combo", minMiss: null, maxMiss: null, requiresFc: true, requiresPerfect: false, expPercent: 100 },
  miss("S", 3, "0 miss", 0, 0, 100),
  miss("A+", 4, "1 miss", 1, 1, 85),
  miss("A", 5, "2 miss", 2, 2, 75),
  miss("A-", 6, "3 miss", 3, 3, 65),
  miss("B+", 7, "4-5 miss", 4, 5, 55),
  miss("B", 8, "6-7 miss", 6, 7, 50),
  miss("B-", 9, "8-10 miss", 8, 10, 44),
  miss("C+", 10, "11-15 miss", 11, 15, 36),
  miss("C", 11, "16-20 miss", 16, 20, 29),
  miss("C-", 12, "21-30 miss", 21, 30, 21),
  miss("D+", 13, "31-40 miss", 31, 40, 15),
  miss("D", 14, "41-50 miss", 41, 50, 10),
  miss("D-", 15, "51-60 miss", 51, 60, 7),
  miss("F+", 16, "61-80 miss", 61, 80, 5),
  miss("F", 17, "81-100 miss", 81, 100, 2),
  miss("Pass", 18, "100+ miss pass", 101, null, 1),
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
  const m = Number.isFinite(play.missCount) ? play.missCount : 0;
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
 */
export const REFERENCE_NOTES = 1500;
export const MISS_CURVE = 0.5;

/** How many misses one miss counts as on a map this size; 1 when unknown. */
export function missFactor(noteCount: number | null | undefined): number {
  if (!noteCount || noteCount <= 0) return 1;
  return Math.pow(REFERENCE_NOTES / noteCount, MISS_CURVE);
}

/** Misses as they count on a map this size: rounded, and never below one. */
export function scaledMisses(missCount: number, noteCount: number | null | undefined): number {
  if (missCount <= 0) return 0;
  return Math.max(1, Math.round(missCount * missFactor(noteCount)));
}

/**
 * The share of a map's pack EXP a play earns. 100% runs, full combos and
 * zero-miss passes keep their own share. Anything with misses earns what its
 * scaled misses would, read off the same table. A map still waiting for its
 * note count earns what the grade says, as every map did before.
 */
export function expShare(
  grade: string,
  missCount: number,
  noteCount: number | null | undefined,
  rules: GradeRule[] = GRADE_RULES,
): number {
  if (missCount <= 0 || !noteCount) return expPercentFor(grade, rules);
  const scaled = gradeFor(
    { missCount: scaledMisses(missCount, noteCount), isFc: false, isPerfect: false },
    rules,
  );
  return expPercentFor(scaled, rules);
}
