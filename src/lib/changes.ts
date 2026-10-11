import { shortCategory, tierByOrder } from "@/lib/tiers";

/**
 * Changes to a player's levels that their own plays didn't make: staff
 * moving a map they played, a score of theirs taken off, new EXP rules.
 * Logged as they happen, listed under the bell, and split out of the level
 * up popup's total. Safe to import from the client.
 */

export type ChangeKind = "entry" | "score" | "rules" | "recheck";

/** What happened to a map, each part present only when it changed. */
export type ChangeDetail = {
  /** Ladder pack by order. */
  tier?: [number, number];
  /** Special pack by name; null is the ladder. */
  pack?: [string | null, string | null];
  categories?: [string[], string[]];
  mod?: [string, string];
  removed?: boolean;
  restored?: boolean;
};

/** Why a player's levels are being recomputed, when it isn't a play of theirs. */
export type ChangeCause = { kind: ChangeKind; entryId?: number | null; detail?: ChangeDetail };

/** A logged change as the bell and the popup draw it. */
export type ChangeView = {
  id: number;
  /** When it happened, as ISO. */
  at: string;
  kind: ChangeKind;
  text: string;
  /** Main EXP gained or lost. */
  exp: number;
  /** The map's ladder pack before and after, when it moved. */
  tier: [number, number] | null;
  /** Levels that ended up in another pack, main first. */
  levels: Array<{ scope: string; from: number | null; to: number | null }>;
  map: {
    osuBeatmapId: number;
    setId: number | null;
    title: string;
    version: string | null;
    mod: string;
    tierOrder: number;
  } | null;
};

const tierName = (order: number) => tierByOrder(order)?.name ?? "no pack";

/** What happened, in a line: "Moved down from Emerald to Sapphire". */
export function changeText(kind: ChangeKind, d: ChangeDetail | null): string {
  if (kind === "score") return "Your score was removed";
  if (kind === "rules") return "EXP rules updated";
  if (kind === "recheck") return "Plays rechecked against osu!";

  const parts: string[] = [];
  if (d?.removed) parts.push("Taken out of the bank");
  if (d?.restored) parts.push("Put back in the bank");
  if (d?.pack) parts.push(d.pack[1] ? "Moved to " + d.pack[1] : "Back on the ladder");
  if (d?.tier) {
    const [from, to] = d.tier;
    parts.push("Moved " + (to > from ? "up" : "down") + " from " + tierName(from) + " to " + tierName(to));
  }
  if (d?.categories) parts.push("Now " + d.categories[1].map((c) => shortCategory(c)).join(", "));
  if (d?.mod) parts.push(d.mod[1] === "NM" ? "Now banked without mods" : "Now banked under " + d.mod[1]);
  return parts.join(" · ") || "Map re-judged";
}

/** "+1,234", "−1,234" with a true minus, or "±0". */
export function signedExp(n: number): string {
  const r = Math.round(n);
  if (r === 0) return "±0";
  return (r > 0 ? "+" : "−") + Math.abs(r).toLocaleString("en");
}

/** Of an EXP change, the part the logged changes made and the part plays made. */
export function splitGain(
  net: number,
  changes: readonly { exp: number }[],
): { played: number; readjusted: number } {
  const readjusted = changes.reduce((sum, c) => sum + c.exp, 0);
  return { played: net - readjusted, readjusted };
}
