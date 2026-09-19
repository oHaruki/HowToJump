import { and, asc, eq, inArray, isNull, lt, notInArray, or, sql as raw } from "drizzle-orm";
import { db, sql } from "@/lib/db";
import {
  beatmaps, entries, scores, siteConfig, syncRuns, userLevels, userTierProgress, users,
} from "@/lib/schema";
import { MAIN_LEVEL, categoryLevels, levelRules, mainLevel, totalExp } from "@/lib/levels";
import { fetchPlayCounts, fetchRecentPlays, type PlayFacts } from "@/lib/osu/client";
import { gradeFor, gradeRank, GRADE_RULES } from "@/lib/grading";
import { normalizeMod } from "@/lib/mods";
import { announceScores } from "@/lib/discord";
import { planPass, type SyncReason } from "@/lib/osu/plan";

/**
 * Pulls a player's recent plays and keeps anything that lands on a bank entry.
 *
 * A play only counts for an entry when the mods match, because an entry is a
 * beatmap under one specific mod. A DT run does not count toward the nomod
 * entry, and vice versa.
 */

export type ImportedScore = {
  entryId: number;
  grade: string;
  missCount: number;
};

export type SyncResult = {
  playsSeen: number;
  playsMatched: number;
  scoresImported: number;
  /** What was kept, so a button or a bot can say which maps moved. */
  imported: ImportedScore[];
  /** Newest play in the fetch, fails included. */
  latestPlayAt: Date | null;
  error?: string;
};

/** Everyone is swept at least this often, whatever their play count says. */
export const BACKSTOP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** How long a player waits between syncs they ask for themselves. */
export const MANUAL_SYNC_COOLDOWN_MS = 30 * 1000;

/** Seconds until a player may ask for another sync, 0 when they may now. */
export function cooldownLeft(lastSyncedAt: Date | null, now = Date.now()): number {
  if (!lastSyncedAt) return 0;
  const left = MANUAL_SYNC_COOLDOWN_MS - (now - lastSyncedAt.getTime());
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

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
 * Returns the grade when something was actually written.
 */
async function upsertScore(
  userId: number,
  entry: EntryRow,
  play: PlayFacts,
): Promise<string | null> {
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
    // New or improved, this is when it landed, which the profile marks.
    importedAt: new Date(),
  };

  if (!existing) {
    await db.insert(scores).values(values).onConflictDoNothing();
    return grade;
  }

  // Keep the better result. Grade first, then accuracy as the tie break.
  const better =
    rank < existing.gradeRank ||
    (rank === existing.gradeRank && play.accuracy > (existing.accuracy ?? 0));
  if (!better) return null;

  await db.update(scores).set(values).where(eq(scores.id, existing.id));
  return grade;
}

/**
 * Recomputes the per pack rollup and the skill levels the profile reads.
 *
 * Both count visible scores on entries still on the ladder, valued at the
 * entry's current pack, so re-judging a map moves every level that used it.
 */
export async function refreshProgress(userId: number): Promise<void> {
  const counted = and(
    eq(scores.userId, userId),
    eq(scores.isHidden, false),
    eq(entries.isActive, true),
  );

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
    .where(counted)
    .groupBy(entries.tierOrder);

  const doneBy = new Map(cleared.map((c) => [c.tierOrder, c]));

  await db.delete(userTierProgress).where(eq(userTierProgress.userId, userId));
  if (totals.length) {
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

  const plays = await db
    .select({
      id: scores.id,
      tierOrder: entries.tierOrder,
      categories: entries.categories,
      grade: scores.grade,
      missCount: scores.missCount,
      noteCount: beatmaps.noteCount,
    })
    .from(scores)
    .innerJoin(entries, eq(scores.entryId, entries.id))
    .innerJoin(beatmaps, eq(entries.beatmapId, beatmaps.id))
    .where(counted);

  const byCategory = categoryLevels(plays);
  const levels = [
    ...Object.entries(byCategory).map(([scope, level]) => ({ scope, ...level })),
    { scope: MAIN_LEVEL, ...mainLevel(Object.values(byCategory), totalExp(plays)) },
  ];
  const now = new Date();

  // Upserted rather than cleared and refilled, so the worker and a Sync now
  // landing on the same player at once cannot trip over each other's rows.
  await db
    .insert(userLevels)
    .values(
      levels.map((l) => ({
        userId,
        scope: l.scope,
        exp: Math.round(l.exp),
        tierOrder: l.tierOrder,
        progress: l.progress,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [userLevels.userId, userLevels.scope],
      set: {
        exp: raw`excluded.exp`,
        tierOrder: raw`excluded.tier_order`,
        progress: raw`excluded.progress`,
        updatedAt: raw`excluded.updated_at`,
      },
    });
  // A category the grading team has since dropped leaves a row behind.
  await db
    .delete(userLevels)
    .where(
      and(
        eq(userLevels.userId, userId),
        notInArray(userLevels.scope, levels.map((l) => l.scope)),
      ),
    );
}

/**
 * Re-judging or pulling a map changes what every play on it is worth, so
 * everyone with a score on it is recomputed. Adding a map never needs this:
 * nobody has a score on it yet.
 */
export async function refreshEntryPlayers(entryId: number): Promise<number> {
  const players = await db
    .selectDistinct({ userId: scores.userId })
    .from(scores)
    .where(eq(scores.entryId, entryId));
  for (const p of players) await refreshProgress(p.userId);
  return players.length;
}

/** Where the rules the stored levels were computed under are kept. */
const LEVEL_RULES_KEY = "level_rules";

/**
 * Recomputes everyone's rollups when the level rules in this build differ
 * from the ones the stored levels were computed under, then records the new
 * ones. Every deploy calls it, so retuning a number needs nothing else;
 * `force` is for npm run levels:rebuild.
 */
export async function rebuildLevelsIfRulesChanged(
  force = false,
): Promise<{ rebuilt: boolean; players: number }> {
  const rules = levelRules();
  const [stored] = await db
    .select({ value: siteConfig.value })
    .from(siteConfig)
    .where(eq(siteConfig.key, LEVEL_RULES_KEY));
  if (!force && stored?.value === rules) return { rebuilt: false, players: 0 };

  const players = await db.selectDistinct({ userId: scores.userId }).from(scores);
  for (const p of players) await refreshProgress(p.userId);

  await db
    .insert(siteConfig)
    .values({ key: LEVEL_RULES_KEY, value: rules })
    .onConflictDoUpdate({
      target: siteConfig.key,
      set: { value: rules, updatedAt: new Date() },
    });
  return { rebuilt: true, players: players.length };
}

/**
 * One sweep for one player. `accessToken` is their osu! token when we have
 * it; without one the app token still reads public recent plays.
 */
export async function syncUser(
  userId: number,
  osuUserId: number,
  accessToken?: string,
): Promise<SyncResult> {
  const [run] = await db
    .insert(syncRuns)
    .values({ userId, startedAt: new Date() })
    .returning({ id: syncRuns.id });

  const result: SyncResult = {
    playsSeen: 0,
    playsMatched: 0,
    scoresImported: 0,
    imported: [],
    latestPlayAt: null,
  };

  try {
    const index = await entryIndex();
    const plays: PlayFacts[] = await fetchRecentPlays(osuUserId, accessToken);

    result.playsSeen = plays.length;
    let latest: Date | null = null;

    for (const play of plays) {
      // Fails count too: they tell the next pass whether a new play arrived.
      if (play.playedAt && (!latest || play.playedAt > latest)) latest = play.playedAt;
      if (!play.passed) continue;
      const entry = index.get(play.osuBeatmapId + "|" + play.mods);
      if (!entry) continue;
      result.playsMatched += 1;
      const grade = await upsertScore(userId, entry, play);
      if (grade) {
        result.scoresImported += 1;
        result.imported.push({ entryId: entry.id, grade, missCount: play.missCount });
      }
    }
    result.latestPlayAt = latest;

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

    if (result.imported.length) await announceScores(userId, result.imported);

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

/* ------------------------------------------------------------ the pass */

/** Most players a pass reads play counts for: ten requests' worth. */
const PLAY_COUNT_BATCH = 500;

/** Most syncs in one pass, which together with the counts fits osu!'s minute. */
const MAX_SYNCS_PER_PASS = 40;

/** How many more passes look for a play whose count rose before it showed up. */
const MAX_RETRIES = 3;

/** Arbitrary key for the advisory lock that keeps passes from overlapping. */
const PASS_LOCK_KEY = 20260918;

/*
 * Players whose count rose but whose play had not reached recent plays yet,
 * against how many retries they have used. A stable score can land there a
 * few seconds after the count moves. Kept in memory: a restart loses at most
 * a retry, and the backstop sweep covers that.
 */
const retrying = new Map<number, number>();

export type PassResult = {
  /** True when another pass held the lock, so this one did nothing. */
  skipped: boolean;
  /** Players whose play count was read. */
  checked: number;
  results: Array<{ username: string; reason: SyncReason } & SyncResult>;
};

/**
 * One pass of the worker, which calls it every minute.
 *
 * osu! cannot push a score to us, so the site asks. Reading everyone's recent
 * plays each minute would cost a request per player; instead the pass reads
 * play counts, fifty players to a request, and fetches recent plays only for
 * players whose count went up. Anyone not synced in a day is swept anyway.
 *
 * A busy pass can outlast the minute, so each one holds a transaction scoped
 * advisory lock and a pass that finds it taken returns at once. The lock goes
 * with the transaction, so a crash cannot leave it held.
 */
export async function syncDueUsers(maxSyncs = MAX_SYNCS_PER_PASS): Promise<PassResult> {
  const outcome = await sql.begin(async (tx) => {
    const [lock] = await tx`select pg_try_advisory_xact_lock(${PASS_LOCK_KEY}) as locked`;
    if (!lock?.locked) return null;
    return runPass(maxSyncs);
  });
  return (outcome as PassResult | null) ?? { skipped: true, checked: 0, results: [] };
}

async function runPass(maxSyncs: number): Promise<PassResult> {
  const tracked = and(eq(users.syncEnabled, true), isNull(users.bannedAt));

  const candidates = await db
    .select({ id: users.id, osuUserId: users.osuUserId, osuPlayCount: users.osuPlayCount })
    .from(users)
    .where(tracked)
    .orderBy(raw`${users.playCountCheckedAt} asc nulls first`, asc(users.id))
    .limit(PLAY_COUNT_BATCH);

  const counts = await fetchPlayCounts(candidates.map((c) => c.osuUserId));

  if (candidates.length) {
    await db
      .update(users)
      .set({ playCountCheckedAt: new Date() })
      .where(inArray(users.id, candidates.map((c) => c.id)));
  }
  for (const c of candidates) {
    const n = counts.get(c.osuUserId);
    if (n != null && n !== c.osuPlayCount) {
      await db.update(users).set({ osuPlayCount: n }).where(eq(users.id, c.id));
    }
  }

  const overdue = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        tracked,
        or(
          isNull(users.lastSyncedAt),
          lt(users.lastSyncedAt, new Date(Date.now() - BACKSTOP_INTERVAL_MS)),
        ),
      ),
    )
    .orderBy(raw`${users.lastSyncedAt} asc nulls first`)
    .limit(maxSyncs);

  const plan = planPass({
    readings: candidates.map((c) => ({
      userId: c.id,
      stored: c.osuPlayCount,
      fetched: counts.get(c.osuUserId),
    })),
    retrying: Array.from(retrying.keys()),
    overdue: overdue.map((o) => o.id),
    max: maxSyncs,
  });
  for (const id of plan.deferred) if (!retrying.has(id)) retrying.set(id, 0);

  const rows = plan.now.length
    ? await db
        .select({
          id: users.id,
          osuUserId: users.osuUserId,
          username: users.username,
          lastPlayedAt: users.lastPlayedAt,
        })
        .from(users)
        .where(and(tracked, inArray(users.id, plan.now.map((d) => d.userId))))
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));

  const results: PassResult["results"] = [];
  for (const due of plan.now) {
    const u = byId.get(due.userId);
    if (!u) {
      // Banned or opted out since the play was seen.
      retrying.delete(due.userId);
      continue;
    }
    const r = await syncUser(u.id, u.osuUserId);
    results.push({ username: u.username, reason: due.reason, ...r });
    if (due.reason === "backstop") continue;

    const arrived =
      r.latestPlayAt != null && (u.lastPlayedAt == null || r.latestPlayAt > u.lastPlayedAt);
    if (arrived) {
      retrying.delete(u.id);
    } else if (due.reason === "played") {
      retrying.set(u.id, 0);
    } else {
      const used = (retrying.get(u.id) ?? 0) + 1;
      if (used >= MAX_RETRIES) retrying.delete(u.id);
      else retrying.set(u.id, used);
    }
  }

  return { skipped: false, checked: candidates.length, results };
}
