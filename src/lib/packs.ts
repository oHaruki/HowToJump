import { playExp } from "@/lib/levels";
import { tierByName } from "@/lib/tiers";

/**
 * Special packs: packs an admin makes beside the ladder. A map in one is
 * judged into a ladder pack and earns EXP like any other, but that EXP
 * counts toward no level, only toward the special pack's own board. Pure,
 * so it runs in the browser too.
 */

/** A special pack as pickers and pages show it. */
export type SpecialPack = { id: number; name: string; color: string };

/** The special pack a picker or URL key names, or null for a ladder pack's slug. */
export function specialPackId(key: string | null | undefined): number | null {
  return key && /^\d+$/.test(key) ? Number(key) : null;
}

/* ------------------------------------------------------------ the board */

/** A player's best on one map in a pack. */
export type PackPlay = {
  userId: number;
  tierOrder: number;
  grade: string;
  missCount: number;
  noteCount: number | null;
  accuracy: number | null;
  isFc: boolean;
};

export type PackStanding = {
  rank: number;
  userId: number;
  exp: number;
  clears: number;
  fcs: number;
  sss: number;
  ss: number;
  s: number;
};

/**
 * A pack's board: the EXP of every map added up, most first, then more
 * clears, then the older account.
 */
export function packStandings(plays: readonly PackPlay[]): PackStanding[] {
  const by = new Map<number, Omit<PackStanding, "rank">>();
  for (const p of plays) {
    const t = by.get(p.userId) ?? { userId: p.userId, exp: 0, clears: 0, fcs: 0, sss: 0, ss: 0, s: 0 };
    t.exp += playExp(p.tierOrder, p.grade, p.missCount, p.noteCount, p.accuracy);
    t.clears += 1;
    if (p.isFc) t.fcs += 1;
    if (p.grade === "SSS") t.sss += 1;
    if (p.grade === "SS") t.ss += 1;
    if (p.grade === "S") t.s += 1;
    by.set(p.userId, t);
  }
  return [...by.values()]
    .sort((a, b) => b.exp - a.exp || b.clears - a.clears || a.userId - b.userId)
    .map((t, i) => ({ ...t, rank: i + 1 }));
}

/* ---------------------------------------------------------- what admins type */

const MAX_NAME = 40;
const MAX_DESCRIPTION = 300;

/** Why a pack name can't be used, or null when it can. `taken` holds the other packs' names. */
export function packNameProblem(name: string, taken: readonly string[]): string | null {
  if (!name) return "Give the pack a name.";
  if (name.length > MAX_NAME) return "Keep the name to " + MAX_NAME + " characters.";
  if (tierByName(name)) return name + " is a ladder pack.";
  const lower = name.toLowerCase();
  if (taken.some((t) => t.toLowerCase() === lower)) return "There is already a pack called " + name + ".";
  return null;
}

/** A colour as "#rrggbb", or null when it isn't one. */
export function packColor(input: string | null | undefined): string | null {
  const v = String(input ?? "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(v) ? v : null;
}

/** A description trimmed and capped, or null when empty. */
export function packDescription(input: string | null | undefined): string | null {
  const v = String(input ?? "").trim().slice(0, MAX_DESCRIPTION);
  return v || null;
}
