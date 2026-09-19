import { CATEGORIES, TIERS, normalizeCategory, tierByOrder } from "@/lib/tiers";
import { GRADE_RULES, MISS_CURVE, REFERENCE_NOTES, expShare } from "@/lib/grading";

/**
 * Skill levels, as Kayrem set them out.
 *
 * Every play earns EXP: the pack's value times the share its grade earns. A
 * category's level adds up the player's best BEST_PLAYS plays in it, so more
 * easy maps never help, and a map added to the bank can never lower anyone,
 * since nobody has played it yet. Pure: the sync worker feeds it scores and
 * stores what comes back.
 */

/** How many plays in a category count toward its level. */
export const BEST_PLAYS = 10;

/** The combined level's scope in user_levels, beside the category labels. */
export const MAIN_LEVEL = "main";

/**
 * Bump when the formula itself changes, such as the main level moving from
 * an average to a sum. Changed numbers are noticed without it. 2: a map can
 * sit in several categories. 3: misses cost EXP by the map's note count.
 */
export const LEVEL_RULES_VERSION = 3;

/**
 * Everything a stored level depends on, as one string. Each deploy compares
 * it with the rules the stored levels were computed under and recomputes
 * everyone when they differ, so retuning a number is just a deploy.
 */
export function levelRules(): string {
  return JSON.stringify({
    version: LEVEL_RULES_VERSION,
    bestPlays: BEST_PLAYS,
    thresholdGrade: THRESHOLD_GRADE,
    categories: CATEGORIES,
    packs: TIERS.map((t) => [t.order, t.exp]),
    grades: GRADE_RULES.map((g) => [g.grade, g.expPercent]),
    missScaling: [REFERENCE_NOTES, MISS_CURVE],
  });
}

/**
 * A pack is reached when the best plays add up to BEST_PLAYS plays at this
 * grade on it. Two misses keeps pack names honest: a full combo on the pack
 * below is worth at most 70% of this pack's value, under this grade's 75%, so
 * no number of them reaches the next pack, however big packs grow.
 */
export const THRESHOLD_GRADE = "A";

export type Level = {
  /** EXP of the plays that count. */
  exp: number;
  /** The highest pack reached, null below Stone. */
  tierOrder: number | null;
  /** 0 to 99 toward the next pack, rounded down; null at the top. */
  progress: number | null;
};

/**
 * A play as the level rule sees it. A map can sit in several categories, so
 * one play can count toward several levels. Misses and the map's note count
 * set what the misses cost; a null count is a map osu! has not told us about
 * yet, which pays what the grade says. The id, when there is one, only
 * settles ties, so the same plays always count.
 */
export type LevelPlay = {
  id?: number;
  tierOrder: number;
  categories: readonly string[];
  grade: string;
  missCount: number;
  noteCount: number | null;
};

/**
 * EXP for one play: the pack's value times the share the play earns. Without
 * misses and a note count it is the grade's share as the table has it, which
 * is what a pack's threshold and a full combo's worth are read from.
 */
export function playExp(
  tierOrder: number,
  grade: string,
  missCount = 0,
  noteCount: number | null = null,
): number {
  const tier = tierByOrder(tierOrder);
  return tier ? (tier.exp * expShare(grade, missCount, noteCount)) / 100 : 0;
}

const expOf = (p: Omit<LevelPlay, "categories">) =>
  playExp(p.tierOrder, p.grade, p.missCount, p.noteCount);

/** EXP needed to reach a pack. */
export function threshold(tierOrder: number): number {
  return BEST_PLAYS * playExp(tierOrder, THRESHOLD_GRADE);
}

/** Where an EXP total sits: the pack it reached and the way to the next. */
export function levelFromExp(exp: number): Level {
  let reached: number | null = null;
  for (const t of TIERS) if (exp >= threshold(t.order)) reached = t.order;

  const next = reached == null ? TIERS[0].order : reached + 1;
  if (!tierByOrder(next)) return { exp, tierOrder: reached, progress: null };

  const from = reached == null ? 0 : threshold(reached);
  const share = (exp - from) / (threshold(next) - from);
  // Never 100: a full bar would read as the next pack before it is reached.
  const progress = Math.min(99, Math.max(0, Math.floor(share * 100)));
  return { exp, tierOrder: reached, progress };
}

/** EXP of the best BEST_PLAYS plays among these. */
export function bestExp(plays: Array<Omit<LevelPlay, "categories">>): number {
  return plays
    .map(expOf)
    .sort((a, b) => b - a)
    .slice(0, BEST_PLAYS)
    .reduce((sum, v) => sum + v, 0);
}

/**
 * Each category's counting plays, best first, as positions in `plays`.
 *
 * Renamed labels stay in the database until staff touch the row, so a play
 * on an entry still saying "Raw Aim" counts toward "Aim - raw mechanic".
 * Plays on entries carrying a dropped category count toward none until the
 * map is judged again. Ties go to the older id, so places never swap between
 * renders and the total below always adds up the same plays.
 */
function countingByCategory(plays: readonly LevelPlay[]): Map<string, number[]> {
  const scored = plays.map((p, i) => ({
    i,
    tie: p.id ?? i,
    exp: expOf(p),
    categories: new Set(p.categories.map((c) => normalizeCategory(c))),
  }));
  const out = new Map<string, number[]>();
  for (const c of CATEGORIES) {
    out.set(
      c,
      scored
        .filter((p) => p.categories.has(c))
        .sort((a, b) => b.exp - a.exp || a.tie - b.tie)
        .slice(0, BEST_PLAYS)
        .map((p) => p.i),
    );
  }
  return out;
}

/**
 * A level for every category the grading team judges on. A play on a map in
 * two categories counts in full toward both.
 */
export function categoryLevels(plays: readonly LevelPlay[]): Record<string, Level> {
  const out: Record<string, Level> = {};
  for (const [c, counting] of countingByCategory(plays)) {
    out[c] = levelFromExp(
      counting.reduce((sum, i) => sum + expOf(plays[i]), 0),
    );
  }
  return out;
}

/**
 * The EXP the leaderboard ranks by: every play that counts toward any
 * category, each added once. A map in two categories fills both levels, but
 * it is still one play, so it cannot count twice toward the total.
 */
export function totalExp(plays: readonly LevelPlay[]): number {
  const counted = new Set([...countingByCategory(plays).values()].flat());
  return [...counted].reduce((sum, i) => sum + expOf(plays[i]), 0);
}

/** Where a play stands in one category it counts toward. */
export type Place = { category: string; place: number };

/**
 * Which plays count toward a level, and where: each category's best
 * BEST_PLAYS by EXP, read with the same rules as categoryLevels. Maps a
 * play's id to its places, best first, so a profile can say "#3 in Raw
 * mechanic"; a play on a map in two categories can hold a place in both.
 */
export function countingPlaces(plays: Array<LevelPlay & { id: number }>): Map<number, Place[]> {
  const out = new Map<number, Place[]>();
  for (const [category, counting] of countingByCategory(plays)) {
    counting.forEach((i, n) => {
      const id = plays[i].id;
      out.set(id, [...(out.get(id) ?? []), { category, place: n + 1 }]);
    });
  }
  for (const places of out.values()) places.sort((a, b) => a.place - b.place);
  return out;
}

/**
 * A level as one number along the ladder: the pack's order plus its progress,
 * so 13.68 is Emerald 68/100, 0.5 is halfway to Stone and 16 is GOAT. The
 * profile animates along it, so a bar crossing a whole number is a rank up.
 */
export function levelValue(level: { tierOrder: number | null; progress: number | null }): number {
  return (level.tierOrder ?? 0) + (level.progress ?? 0) / 100;
}

/**
 * The main level: the average of the category levels, each read as a pack
 * number plus its progress, so it rewards being all round. Kayrem has still
 * to choose between this and adding up the EXP, which would reward
 * specialists; either way, this is the only place that changes. Its EXP is
 * the total from totalExp, which is what the leaderboard ranks by.
 *
 * Worked in hundredths, so 13.68 is Emerald 68/100 and floating point never
 * turns a 68 into a 67.
 */
export function mainLevel(levels: Level[], exp: number): Level {
  if (!levels.length) return { exp, tierOrder: null, progress: 0 };

  const hundredths = levels.map((l) => (l.tierOrder ?? 0) * 100 + (l.progress ?? 0));
  const average = Math.floor(hundredths.reduce((sum, h) => sum + h, 0) / levels.length);
  const whole = Math.floor(average / 100);
  const tierOrder = whole >= 1 ? whole : null;
  const top = tierOrder != null && !tierByOrder(tierOrder + 1);
  return { exp, tierOrder, progress: top ? null : average % 100 };
}
