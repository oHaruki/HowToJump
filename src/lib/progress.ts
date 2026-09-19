import { z } from "zod";
import { MAIN_LEVEL } from "@/lib/levels";
import { CATEGORIES } from "@/lib/tiers";

/**
 * What a profile remembers between visits: every level as the player last
 * saw it. The page animates from there to where they are now, and sends it
 * back when they leave, so what comes back is checked rather than trusted.
 */

export type LevelState = { exp: number; tierOrder: number | null; progress: number | null };
export type LevelSnapshot = Record<string, LevelState>;

/** The main level first, then the categories, the order a profile shows them. */
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
 * that reached a higher pack. A level that fell, when a map was judged
 * down, is not news to celebrate, so it is left out.
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
 * had no score on, "improved" for a better result on one they had. Nothing is
 * new on a first visit, or every score would be.
 */
export function freshness(
  score: { createdAt: Date; importedAt: Date },
  seenAt: Date | null,
): "new" | "improved" | null {
  if (!seenAt || score.importedAt <= seenAt) return null;
  return score.createdAt > seenAt ? "new" : "improved";
}
