import type { OsuScore } from "@/lib/osu/client";
import { refusedMod } from "@/lib/mods";

/**
 * Reading a pasted score link, and whether the score it names can go on a
 * player's profile. Pure, so it runs without the API or the database.
 */

/** A score as osu! addresses it: its ID, plus the ruleset for an old style one. */
export type ScoreRef = { id: number; ruleset: string | null };

const LINK =
  /^(?:https?:\/\/)?(?:www\.)?osu\.ppy\.sh\/scores\/(?:(osu|taiko|fruits|mania)\/)?(\d+)\/?(?:[?#].*)?$/i;

/** osu.ppy.sh/scores/<id>, the older osu.ppy.sh/scores/osu/<id>, or the bare ID. */
export function parseScoreLink(text: string | null | undefined): ScoreRef | null {
  const s = String(text ?? "").trim();
  const m = s.match(LINK);
  const id = Number(m ? m[2] : /^\d+$/.test(s) ? s : Number.NaN);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return { id, ruleset: m?.[1] ? m[1].toLowerCase() : null };
}

/** Why a score can't go on this player's profile, or null when it can. */
export function backfillProblem(score: OsuScore, osuUserId: number): string | null {
  if ((score.user_id ?? score.user?.id) !== osuUserId) {
    return "That score belongs to someone else. You can only add your own.";
  }
  const ruleset = score.ruleset_id ?? score.mode_int;
  if (ruleset != null && ruleset !== 0) return "Only osu!standard scores count.";
  if (score.passed === false) return "That play was a fail, so it can't count.";
  const refused = refusedMod(score.mods);
  if (refused) return "That play used " + refused + ", so it can't count.";
  return null;
}
