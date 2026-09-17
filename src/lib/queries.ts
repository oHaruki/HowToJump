import { and, asc, desc, eq, ilike, or, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import { beatmaps, entries, scores, suggestions, users } from "@/lib/schema";
import { secondsToDrain } from "@/lib/import/parse";
import { CATEGORIES, LENGTHS, SPEEDS, orderByScale } from "@/lib/tiers";

/** One row of the map bank, flattened for display. */
export type BankRow = {
  entryId: number;
  osuBeatmapId: number;
  osuBeatmapsetId: number | null;
  title: string | null;
  version: string | null;
  mapper: string | null;
  listUrl: string | null;
  cardUrl: string | null;
  mod: string;
  tierOrder: number;
  category: string;
  lengthBucket: string | null;
  speedBucket: string | null;
  stars: number | null;
  bpm: number | null;
  drainSeconds: number | null;
  drain: string;
  cs: number | null;
  ar: number | null;
  od: number | null;
  judgedByName: string | null;
};

export type BankFilters = {
  q?: string;
  pack?: number;
  category?: string;
  mod?: string;
  length?: string;
  speed?: string;
};

const bankSelection = {
  entryId: entries.id,
  osuBeatmapId: beatmaps.osuBeatmapId,
  osuBeatmapsetId: beatmaps.osuBeatmapsetId,
  title: beatmaps.title,
  version: beatmaps.version,
  mapper: beatmaps.mapper,
  listUrl: beatmaps.listUrl,
  cardUrl: beatmaps.cardUrl,
  mod: entries.mod,
  tierOrder: entries.tierOrder,
  category: entries.category,
  lengthBucket: entries.lengthBucket,
  speedBucket: entries.speedBucket,
  stars: entries.stars,
  bpm: entries.bpm,
  drainSeconds: entries.drainSeconds,
  cs: entries.cs,
  ar: entries.ar,
  od: entries.od,
  judgedByName: entries.judgedByName,
};

function shape(rows: Array<Record<string, unknown>>): BankRow[] {
  return rows.map((r) => ({
    ...(r as Omit<BankRow, "drain">),
    drain: secondsToDrain((r as { drainSeconds: number | null }).drainSeconds),
  })) as BankRow[];
}

export async function getBank(filters: BankFilters = {}): Promise<BankRow[]> {
  const where = [eq(entries.isActive, true)];
  if (filters.pack) where.push(eq(entries.tierOrder, filters.pack));
  if (filters.category) where.push(eq(entries.category, filters.category));
  if (filters.mod) where.push(eq(entries.mod, filters.mod));
  if (filters.length) where.push(eq(entries.lengthBucket, filters.length));
  if (filters.speed) where.push(eq(entries.speedBucket, filters.speed));
  if (filters.q) {
    const like = "%" + filters.q + "%";
    where.push(
      or(
        ilike(beatmaps.title, like),
        ilike(beatmaps.version, like),
        ilike(beatmaps.mapper, like),
        ilike(beatmaps.artist, like),
      )!,
    );
  }

  const rows = await db
    .select(bankSelection)
    .from(entries)
    .innerJoin(beatmaps, eq(entries.beatmapId, beatmaps.id))
    .where(and(...where))
    .orderBy(desc(entries.tierOrder), desc(entries.stars))
    .limit(1000);

  return shape(rows);
}

/** Entry counts per pack, for the ladder grid. */
export async function getTierCounts(): Promise<Map<number, number>> {
  const rows = await db
    .select({ tierOrder: entries.tierOrder, n: raw<number>`count(*)::int` })
    .from(entries)
    .where(eq(entries.isActive, true))
    .groupBy(entries.tierOrder);
  return new Map(rows.map((r) => [r.tierOrder, r.n]));
}

export async function getBankStats() {
  const [row] = await db
    .select({
      total: raw<number>`count(*)::int`,
      hardest: raw<number | null>`max(${entries.stars})`,
    })
    .from(entries)
    .where(eq(entries.isActive, true));
  return { total: row?.total ?? 0, hardest: row?.hardest ?? null };
}

/** Distinct values actually present in the bank, for the filter dropdowns. */
export async function getFacets() {
  const rows = await db
    .select({
      category: entries.category,
      mod: entries.mod,
      lengthBucket: entries.lengthBucket,
      speedBucket: entries.speedBucket,
    })
    .from(entries)
    .where(eq(entries.isActive, true));

  const uniq = (xs: Array<string | null>) =>
    Array.from(new Set(xs.filter((x): x is string => Boolean(x)))).sort();

  // Each filter lists its values in the order its dropdown does, so pacing
  // reads Very low to Extreme+ rather than Extreme to Very low. Anything left
  // over from an older list sorts to the end instead of hiding mid-list.
  return {
    categories: orderByScale(uniq(rows.map((r) => r.category)), CATEGORIES),
    mods: uniq(rows.map((r) => r.mod)),
    lengths: orderByScale(uniq(rows.map((r) => r.lengthBucket)), LENGTHS),
    speeds: orderByScale(uniq(rows.map((r) => r.speedBucket)), SPEEDS),
  };
}

export async function getRecentEntries(limit = 4): Promise<BankRow[]> {
  const rows = await db
    .select(bankSelection)
    .from(entries)
    .innerJoin(beatmaps, eq(entries.beatmapId, beatmaps.id))
    .where(eq(entries.isActive, true))
    .orderBy(desc(entries.createdAt))
    .limit(limit);
  return shape(rows);
}

/** Every entry key already on the ladder, so the importer can spot repeats. */
export async function getExistingEntryKeys(): Promise<Set<string>> {
  const rows = await db
    .select({ osuBeatmapId: beatmaps.osuBeatmapId, mod: entries.mod })
    .from(entries)
    .innerJoin(beatmaps, eq(entries.beatmapId, beatmaps.id));
  return new Set(rows.map((r) => r.osuBeatmapId + "|" + r.mod));
}

/* ------------------------------------------------------------------ staff */

export async function getPendingSuggestions() {
  return db
    .select({
      id: suggestions.id,
      osuBeatmapId: suggestions.osuBeatmapId,
      osuBeatmapsetId: suggestions.osuBeatmapsetId,
      title: suggestions.title,
      version: suggestions.version,
      mapper: suggestions.mapper,
      mod: suggestions.mod,
      tierOrder: suggestions.proposedTierOrder,
      category: suggestions.proposedCategory,
      stars: suggestions.stars,
      bpm: suggestions.bpm,
      drainSeconds: suggestions.drainSeconds,
      cs: suggestions.cs,
      ar: suggestions.ar,
      od: suggestions.od,
      lengthBucket: suggestions.proposedLength,
      speedBucket: suggestions.proposedSpeed,
      batchId: suggestions.batchId,
      createdAt: suggestions.createdAt,
      submittedBy: users.username,
    })
    .from(suggestions)
    .leftJoin(users, eq(suggestions.submittedById, users.id))
    .where(eq(suggestions.status, "pending"))
    .orderBy(asc(suggestions.batchId), asc(suggestions.id));
}

export async function getStaffStats() {
  const [pending] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(suggestions)
    .where(eq(suggestions.status, "pending"));
  const [needPack] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(suggestions)
    .where(
      and(eq(suggestions.status, "pending"), raw`${suggestions.proposedTierOrder} is null`),
    );
  const [bank] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(entries)
    .where(eq(entries.isActive, true));
  const [players] = await db.select({ n: raw<number>`count(*)::int` }).from(users);
  return {
    pending: pending?.n ?? 0,
    needPack: needPack?.n ?? 0,
    bank: bank?.n ?? 0,
    players: players?.n ?? 0,
  };
}

/* --------------------------------------------------------------- profile */

export async function getUserScores(userId: number) {
  return db
    .select({
      scoreId: scores.id,
      grade: scores.grade,
      gradeRank: scores.gradeRank,
      missCount: scores.missCount,
      accuracy: scores.accuracy,
      mods: scores.mods,
      playedAt: scores.playedAt,
      entryId: entries.id,
      tierOrder: entries.tierOrder,
      mod: entries.mod,
      category: entries.category,
      lengthBucket: entries.lengthBucket,
      speedBucket: entries.speedBucket,
      stars: entries.stars,
      bpm: entries.bpm,
      drainSeconds: entries.drainSeconds,
      cs: entries.cs,
      ar: entries.ar,
      od: entries.od,
      osuBeatmapId: beatmaps.osuBeatmapId,
      osuBeatmapsetId: beatmaps.osuBeatmapsetId,
      title: beatmaps.title,
      version: beatmaps.version,
      mapper: beatmaps.mapper,
    })
    .from(scores)
    .innerJoin(entries, eq(scores.entryId, entries.id))
    .innerJoin(beatmaps, eq(entries.beatmapId, beatmaps.id))
    .where(and(eq(scores.userId, userId), eq(scores.isHidden, false)))
    .orderBy(desc(scores.playedAt))
    .limit(50);
}

/** Per entry leaderboard: best grade first, accuracy as the tie break. */
export async function getEntryLeaderboard(entryId: number, limit = 50) {
  return db
    .select({
      username: users.username,
      avatarUrl: users.avatarUrl,
      grade: scores.grade,
      missCount: scores.missCount,
      accuracy: scores.accuracy,
      playedAt: scores.playedAt,
    })
    .from(scores)
    .innerJoin(users, eq(scores.userId, users.id))
    .where(and(eq(scores.entryId, entryId), eq(scores.isHidden, false)))
    .orderBy(asc(scores.gradeRank), desc(scores.accuracy))
    .limit(limit);
}
