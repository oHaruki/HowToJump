import { z } from "zod";
import { MAIN_LEVEL, byWorth, countingPlaces, playExp, type Place } from "@/lib/levels";
import { CATEGORIES } from "@/lib/tiers";

/**
 * What a profile remembers between visits: every level as the player last
 * saw it. The page sends it back when they leave, so it is validated here.
 */

export type LevelState = { exp: number; tierOrder: number | null; progress: number | null };
export type LevelSnapshot = Record<string, LevelState>;

/** The main level first, then the categories, in profile order. */
export const PROFILE_SCOPES = [MAIN_LEVEL, ...CATEGORIES];

export const UNRANKED: LevelState = { exp: 0, tierOrder: null, progress: 0 };

const levelState = z.object({
  exp: z.number().min(0).max(1e9),
  tierOrder: z.number().int().min(1).max(16).nullable(),
  progress: z.number().int().min(0).max(99).nullable(),
});

const snapshot = z
  .record(z.string().max(48), levelState)
  .refine((s) => Object.keys(s).length <= PROFILE_SCOPES.length + 4);

/** What the page sends when the player leaves it. */
export const seenBody = z.object({
  snapshot,
  renderedAt: z.string().max(40),
});

/** The stored levels as a snapshot, with every scope present. */
export function snapshotOf(rows: Array<{ scope: string } & LevelState>): LevelSnapshot {
  const out: LevelSnapshot = {};
  for (const scope of PROFILE_SCOPES) {
    const r = rows.find((x) => x.scope === scope);
    out[scope] = r ? { exp: r.exp, tierOrder: r.tierOrder, progress: r.progress } : { ...UNRANKED };
  }
  return out;
}

/** A stored snapshot, or null when there is none or it does not read as one. */
export function readSnapshot(raw: unknown): LevelSnapshot | null {
  const parsed = snapshot.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export type RankUp = { scope: string; from: number | null; to: number };

/**
 * What moved between two snapshots: EXP gained overall, and every level
 * that reached a higher pack. Levels that fell are left out.
 */
export function changesSince(
  before: LevelSnapshot,
  now: LevelSnapshot,
): { expGain: number; rankUps: RankUp[] } {
  const expGain = (now[MAIN_LEVEL]?.exp ?? 0) - (before[MAIN_LEVEL]?.exp ?? 0);
  const rankUps = PROFILE_SCOPES.flatMap((scope) => {
    const from = before[scope]?.tierOrder ?? null;
    const to = now[scope]?.tierOrder ?? null;
    return to != null && (from == null || to > from) ? [{ scope, from, to }] : [];
  });
  return { expGain, rankUps };
}

/**
 * Whether a score landed since the player last looked: "new" for a map they
 * had no score on, "improved" for a better result. Nothing is new on a
 * first visit.
 */
export function freshness(
  score: { createdAt: Date; importedAt: Date },
  seenAt: Date | null,
): "new" | "improved" | null {
  if (!seenAt || score.importedAt <= seenAt) return null;
  return score.createdAt > seenAt ? "new" : "improved";
}

/* ------------------------------------------------ the two lists a profile draws */

/** What the working below needs of a play. */
export type PlayForProfile = {
  scoreId: number;
  tierOrder: number;
  categories: readonly string[];
  grade: string;
  missCount: number;
  noteCount: number | null;
  accuracy: number | null;
  createdAt: Date;
  importedAt: Date;
};

/** A play with everything a row shows worked out. */
export type ShownPlay<T> = T & {
  /** Settles ties the same way countingPlaces does. */
  id: number;
  exp: number;
  places: Place[];
  fresh: "new" | "improved" | null;
};

/**
 * A profile's two lists, from one pass over the player's plays. `recent`
 * keeps the order it was given; `top` is the same plays under byWorth,
 * which is the order countingPlaces numbers them in.
 */
export function profileLists<T extends PlayForProfile>(
  plays: readonly T[],
  seenAt: Date | null,
): { recent: Array<ShownPlay<T>>; top: Array<ShownPlay<T>> } {
  const places = countingPlaces(plays.map((p) => ({ ...p, id: p.scoreId })));
  const recent = plays.map((p) => ({
    ...p,
    id: p.scoreId,
    exp: playExp(p.tierOrder, p.grade, p.missCount, p.noteCount, p.accuracy),
    places: places.get(p.scoreId) ?? [],
    fresh: freshness(p, seenAt),
  }));
  return { recent, top: recent.slice().sort(byWorth) };
}
