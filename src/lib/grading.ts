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
};

const miss = (
  grade: string,
  sortOrder: number,
  label: string,
  minMiss: number | null,
  maxMiss: number | null,
): GradeRule => ({
  grade, sortOrder, label, minMiss, maxMiss,
  requiresFc: false, requiresPerfect: false,
});

export const GRADE_RULES: GradeRule[] = [
  { grade: "SSS", sortOrder: 1, label: "Perfect combo", minMiss: null, maxMiss: null, requiresFc: false, requiresPerfect: true },
  { grade: "SS", sortOrder: 2, label: "Full combo", minMiss: null, maxMiss: null, requiresFc: true, requiresPerfect: false },
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

/** Combo beats misscount: a perfect run is SSS, a full combo is SS. */
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
