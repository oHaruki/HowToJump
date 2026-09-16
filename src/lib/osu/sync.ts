import { and, eq, inArray, lt, or, isNull, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import { beatmaps, entries, scores, syncRuns, userTierProgress, users } from "@/lib/schema";
import { fetchRecentPlays, fetchBestPlays, type PlayFacts } from "@/lib/osu/client";
import { gradeFor, gradeRank, GRADE_RULES } from "@/lib/grading";
import { normalizeMod } from "@/lib/mods";

/**
 * Pulls a player's recent plays and keeps anything that lands on a bank entry.
 *
 * A play only counts for an entry when the mods match, because an entry is a
 * beatmap under one specific mod. A DT run does not count toward the nomod
 * entry, and vice versa.
 */

export type SyncResult = {
  playsSeen: number;
  playsMatched: number;
  scoresImported: number;
  error?: string;
};

/** Poll active players this often. Beats the 100 play cap comfortably. */
export const ACTIVE_INTERVAL_MS = 30 * 60 * 1000;
/** Someone counts as active if they played within this window. */
export const ACTIVE_WINDOW_MS = 6 * 60 * 60 * 1000;
/** Dormant players still get an occasional sweep. */
export const DORMANT_INTERVAL_MS = 24 * 60 * 60 * 1000;

type EntryRow = { id: number; mod: string; osuBeatmapId: number; tierOrder: number };

async function entryIndex(): Promise<Map<string, EntryRow>> {
  const rows = await db
    .select({
      id: entries.id,
      mod: entries.mod,
      tierOrder: entries.tierOrder,
      osuBeatmapId: beatmaps.osuBeatmapId,
    })
    .from(entries)
    .innerJoin(beatmaps, eq(entries.beatmapId, beatmaps.id))
    .where(eq(entries.isActive, true));

  const map = new Map<string, EntryRow>();
  for (const r of rows) {
    map.set(r.osuBeatmapId + "|" + normalizeMod(r.mod), r as EntryRow);
  }
  return map;
}

/**
 * Writes one play if it beats what the player already has on that entry.
 * Returns true when something was actually written.
 */
async function upsertScore(
  userId: number,
  entry: EntryRow,
  play: PlayFacts,
): Promise<boolean> {
  const grade = gradeFor(
    { missCount: play.missCount, isFc: play.isFc, isPerfect: play.isPerfect },
    GRADE_RULES,
  );
  const rank = gradeRank(grade, GRADE_RULES);

  const existing = await db.query.scores.findFirst({
    where: and(eq(scores.userId, userId), eq(scores.entryId, entry.id)),
  });

  const values = {
    userId,
    entryId: entry.id,
    osuScoreId: play.osuScoreId,
    missCount: play.missCount,
    accuracy: play.accuracy,
    maxCombo: play.maxCombo,
    isFc: play.isFc,
    isPerfect: play.isPerfect,
    mods: play.mods,
    grade,
    gradeRank: rank,
    source: "osu_api" as const,
    playedAt: play.playedAt,
  };

  if (!existing) {
    await db.insert(scores).values(values).onConflictDoNothing();
    return true;
  }

  // Keep the better result. Grade first, then accuracy as the tie break.
  const better =
    rank < existing.gradeRank ||
    (rank === existing.gradeRank && play.accuracy > (existing.accuracy ?? 0));
  if (!better) return false;

  await db.update(scores).set(values).where(eq(scores.id, existing.id));
  return true;
}

/** Recomputes the per pack rollup the profile and leaderboard pages read. */
export async function refreshProgress(userId: number): Promise<void> {
  const totals = await db
    .select({ tierOrder: entries.tierOrder, total: raw<number>`count(*)::int` })
    .from(entries)
    .where(eq(entries.isActive, true))
    .groupBy(entries.tierOrder);

  const cleared = await db
    .select({
      tierOrder: entries.tierOrder,
      done: raw<number>`count(*)::int`,
      best: raw<number>`min(${scores.gradeRank})::int`,
    })
    .from(scores)
    .innerJoin(entries, eq(scores.entryId, entries.id))
    .where(and(eq(scores.userId, userId), eq(scores.isHidden, false)))
    .groupBy(entries.tierOrder);

  const doneBy = new Map(cleared.map((c) => [c.tierOrder, c]));

  await db.delete(userTierProgress).where(eq(userTierProgress.userId, userId));
  if (!totals.length) return;

  await db.insert(userTierProgress).values(
    totals.map((t) => {
      const c = doneBy.get(t.tierOrder);
      return {
        userId,
        tierOrder: t.tierOrder,
        entriesTotal: t.total,
        entriesCleared: c?.done ?? 0,
        bestGradeRank: c?.best ?? null,
        updatedAt: new Date(),
      };
    }),
  );
}

/**
 * One sweep for one player. `accessToken` is their osu! token when we have
 * it; without one the app token still reads public recent plays.
 */
export async function syncUser(
  userId: number,
  osuUserId: number,
  accessToken?: string,
  opts?: { includeBest?: boolean },
): Promise<SyncResult> {
  const [run] = await db
    .insert(syncRuns)
    .values({ userId, startedAt: new Date() })
    .returning({ id: syncRuns.id });

  const result: SyncResult = { playsSeen: 0, playsMatched: 0, scoresImported: 0 };

  try {
    const index = await entryIndex();

    const plays: PlayFacts[] = await fetchRecentPlays(osuUserId, accessToken);
    if (opts?.includeBest) {
      // Swept once on sign in, to catch bank maps already in their top 100.
      try {
        plays.push(...(await fetchBestPlays(osuUserId, accessToken)));
      } catch {
        // A missing top 100 is not worth failing the whole sweep over.
      }
    }

    result.playsSeen = plays.length;
    let latest: Date | null = null;

    for (const play of plays) {
      if (!play.passed) continue;
      if (play.playedAt && (!latest || play.playedAt > latest)) latest = play.playedAt;
      const entry = index.get(play.osuBeatmapId + "|" + play.mods);
      if (!entry) continue;
      result.playsMatched += 1;
      if (await upsertScore(userId, entry, play)) result.scoresImported += 1;
    }

    if (result.scoresImported > 0) await refreshProgress(userId);

    await db
      .update(users)
      .set({ lastSyncedAt: new Date(), lastPlayedAt: latest ?? undefined })
      .where(eq(users.id, userId));

    await db
      .update(syncRuns)
      .set({
        finishedAt: new Date(),
        playsSeen: result.playsSeen,
        playsMatched: result.playsMatched,
        scoresImported: result.scoresImported,
      })
      .where(eq(syncRuns.id, run.id));

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.error = message;
    await db
      .update(syncRuns)
      .set({ finishedAt: new Date(), error: message })
      .where(eq(syncRuns.id, run.id));
    return result;
  }
}

/**
 * Picks the players due a sweep: anyone active in the last six hours whose
 * last sync is older than the active interval, plus dormant accounts on a
 * daily cadence.
 */
export async function usersDueForSync(limit = 40) {
  const now = Date.now();
  const activeCutoff = new Date(now - ACTIVE_INTERVAL_MS);
  const playedCutoff = new Date(now - ACTIVE_WINDOW_MS);
  const dormantCutoff = new Date(now - DORMANT_INTERVAL_MS);

  return db
    .select({ id: users.id, osuUserId: users.osuUserId, username: users.username })
    .from(users)
    .where(
      and(
        eq(users.syncEnabled, true),
        isNull(users.bannedAt),
        or(
          and(
            raw`${users.lastPlayedAt} > ${playedCutoff}`,
            or(isNull(users.lastSyncedAt), lt(users.lastSyncedAt, activeCutoff)),
          ),
          or(isNull(users.lastSyncedAt), lt(users.lastSyncedAt, dormantCutoff)),
        ),
      ),
    )
    .limit(limit);
}

/** One pass of the worker loop. */
export async function syncDueUsers(limit = 40) {
  const due = await usersDueForSync(limit);
  const results: Array<{ username: string } & SyncResult> = [];
  for (const u of due) {
    const r = await syncUser(u.id, u.osuUserId);
    results.push({ username: u.username, ...r });
  }
  return results;
}

export { inArray };
