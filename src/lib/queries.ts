import {
  and, asc, desc, eq, ilike, notInArray, or, sql as raw,
} from "drizzle-orm";
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
  /** False once staff take an entry off the ladder. Staff surfaces only. */
  isActive: boolean;
};

/**
 * Which side of `isActive` to read. Public pages only ever see "listed";
 * staff can look at what they have taken off the ladder, which is otherwise
 * invisible and so unrecoverable.
 */
export type BankStatus = "listed" | "removed" | "all";

export type BankFilters = {
  q?: string;
  pack?: number;
  category?: string;
  mod?: string;
  length?: string;
  speed?: string;
  /** Staff only. Defaults to "listed" everywhere else. */
  status?: BankStatus;
  /**
   * Staff only: just the entries whose category is not one the team still
   * judges. Labels are left alone in the database when the scale is renamed
   * and fixed as staff touch the rows, so this is the queue of rows that
   * never got touched.
   */
  staleLabels?: boolean;
};

/** One screen of the bank. Enough to scroll, few enough to stay cheap. */
export const BANK_PAGE_SIZE = 48;

export type BankPage = {
  rows: BankRow[];
  /** Every entry matching the filters, not just the ones on this page. */
  total: number;
  /** Clamped into range, so a hand typed page never shows an empty list. */
  page: number;
  pageCount: number;
  pageSize: number;
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
  isActive: entries.isActive,
};

function shape(rows: Array<Record<string, unknown>>): BankRow[] {
  return rows.map((r) => ({
    ...(r as Omit<BankRow, "drain">),
    drain: secondsToDrain((r as { drainSeconds: number | null }).drainSeconds),
  })) as BankRow[];
}

/** The active/removed half of a filter set, shared by the count queries. */
function statusWhere(status: BankStatus = "listed") {
  if (status === "all") return undefined;
  return eq(entries.isActive, status !== "removed");
}

function bankWhere(filters: BankFilters) {
  const where = [];
  const status = statusWhere(filters.status);
  if (status) where.push(status);
  if (filters.staleLabels) where.push(notInArray(entries.category, CATEGORIES));
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
  return and(...where);
}

/*
 * Hardest pack first, hardest map within it. The entry ID is a tiebreak
 * rather than a preference: two entries on the same stars would otherwise be
 * free to swap places between two queries, and a paged list that reorders
 * under itself shows one of them twice and drops the other.
 */
const bankOrder = [desc(entries.tierOrder), desc(entries.stars), desc(entries.id)];

/** The whole filtered bank. Staff screens only; public pages take a page. */
export async function getBank(filters: BankFilters = {}): Promise<BankRow[]> {
  const rows = await db
    .select(bankSelection)
    .from(entries)
    .innerJoin(beatmaps, eq(entries.beatmapId, beatmaps.id))
    .where(bankWhere(filters))
    .orderBy(...bankOrder)
    .limit(1000);

  return shape(rows);
}

/**
 * One page of the bank, plus how many entries the filters match.
 *
 * The count comes first because it decides which page is actually being
 * asked for: a stale link or a hand typed number past the end shows the last
 * page rather than an empty list, and clamping after fetching would mean
 * fetching the wrong rows. Both queries are indexed and narrow.
 */
export async function getBankPage(
  filters: BankFilters = {},
  page = 1,
): Promise<BankPage> {
  const where = bankWhere(filters);

  const [counted] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(entries)
    .innerJoin(beatmaps, eq(entries.beatmapId, beatmaps.id))
    .where(where);

  const total = counted?.n ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / BANK_PAGE_SIZE));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount);

  const rows = total
    ? await db
        .select(bankSelection)
        .from(entries)
        .innerJoin(beatmaps, eq(entries.beatmapId, beatmaps.id))
        .where(where)
        .orderBy(...bankOrder)
        .limit(BANK_PAGE_SIZE)
        .offset((current - 1) * BANK_PAGE_SIZE)
    : [];

  return {
    rows: shape(rows),
    total,
    page: current,
    pageCount,
    pageSize: BANK_PAGE_SIZE,
  };
}

/** Entry counts per pack, for the ladder grid and the pack picker. */
export async function getTierCounts(
  status: BankStatus = "listed",
): Promise<Map<number, number>> {
  const rows = await db
    .select({ tierOrder: entries.tierOrder, n: raw<number>`count(*)::int` })
    .from(entries)
    .where(statusWhere(status))
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

/**
 * Distinct values actually present in the bank, for the filter dropdowns.
 *
 * Distinct in SQL rather than in JS: the four columns are all short scales,
 * so what comes back is a few dozen combinations however big the bank gets,
 * where selecting the columns raw shipped one row per entry on every load.
 */
export async function getFacets(status: BankStatus = "listed") {
  const rows = await db
    .selectDistinct({
      category: entries.category,
      mod: entries.mod,
      lengthBucket: entries.lengthBucket,
      speedBucket: entries.speedBucket,
    })
    .from(entries)
    .where(statusWhere(status));

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
