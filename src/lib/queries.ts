import {
  and, arrayContained, arrayContains, asc, desc, eq, ilike, inArray, isNull, not, or,
  sql as raw,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { beatmaps, entries, scores, suggestions, userLevels, users } from "@/lib/schema";
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
  /** Every skill the map is judged on, in the scale's order. */
  categories: string[];
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
   * Staff only: just the entries carrying a category the team no longer
   * judges, or none at all. Labels are left alone in the database when the
   * scale is renamed and fixed as staff touch the rows, so this is the queue
   * of rows that never got touched.
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
  categories: entries.categories,
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
  if (filters.staleLabels) {
    where.push(
      or(
        not(arrayContained(entries.categories, CATEGORIES)),
        raw`cardinality(${entries.categories}) = 0`,
      )!,
    );
  }
  if (filters.pack) where.push(eq(entries.tierOrder, filters.pack));
  if (filters.category) where.push(arrayContains(entries.categories, [filters.category]));
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

/**
 * Listed entries per pack and set of categories, for the staff coverage grid,
 * which counts a map once in each of its categories. Labels the grading team
 * has dropped come back as they are, so the page can count them apart.
 */
export async function getCoverage(): Promise<
  Array<{ tierOrder: number; categories: string[]; n: number }>
> {
  return db
    .select({
      tierOrder: entries.tierOrder,
      categories: entries.categories,
      n: raw<number>`count(*)::int`,
    })
    .from(entries)
    .where(eq(entries.isActive, true))
    .groupBy(entries.tierOrder, entries.categories);
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
      categories: entries.categories,
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
    categories: orderByScale(uniq(rows.flatMap((r) => r.categories)), CATEGORIES),
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
      categories: suggestions.proposedCategories,
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

/**
 * Every play a profile shows, newest first: visible scores on maps still on
 * the ladder. All of them rather than a page, since top plays are ranked by
 * EXP across the lot, and a player has hundreds at most.
 */
export async function getProfilePlays(userId: number) {
  return db
    .select({
      scoreId: scores.id,
      grade: scores.grade,
      missCount: scores.missCount,
      accuracy: scores.accuracy,
      isFc: scores.isFc,
      isPerfect: scores.isPerfect,
      playedAt: scores.playedAt,
      createdAt: scores.createdAt,
      importedAt: scores.importedAt,
      entryId: entries.id,
      tierOrder: entries.tierOrder,
      mod: entries.mod,
      categories: entries.categories,
      stars: entries.stars,
      noteCount: beatmaps.noteCount,
      osuBeatmapId: beatmaps.osuBeatmapId,
      osuBeatmapsetId: beatmaps.osuBeatmapsetId,
      title: beatmaps.title,
      version: beatmaps.version,
      mapper: beatmaps.mapper,
    })
    .from(scores)
    .innerJoin(entries, eq(scores.entryId, entries.id))
    .innerJoin(beatmaps, eq(entries.beatmapId, beatmaps.id))
    .where(
      and(eq(scores.userId, userId), eq(scores.isHidden, false), eq(entries.isActive, true)),
    )
    .orderBy(desc(scores.playedAt), desc(scores.id));
}

export type ProfilePlay = Awaited<ReturnType<typeof getProfilePlays>>[number];

export type ScoreLine = {
  entryId: number;
  title: string;
  version: string | null;
  mod: string;
  tierOrder: number;
  categories: string[];
  grade: string;
  missCount: number;
};

/**
 * The maps behind what a sync just imported, in the order it imported them,
 * for the Sync now button, the /rs reply and the score feed.
 */
export async function describeScores(
  imported: Array<{ entryId: number; grade: string; missCount: number }>,
): Promise<ScoreLine[]> {
  if (!imported.length) return [];
  const rows = await db
    .select({
      entryId: entries.id,
      title: beatmaps.title,
      version: beatmaps.version,
      mod: entries.mod,
      tierOrder: entries.tierOrder,
      categories: entries.categories,
    })
    .from(entries)
    .innerJoin(beatmaps, eq(entries.beatmapId, beatmaps.id))
    .where(inArray(entries.id, imported.map((i) => i.entryId)));
  const byId = new Map(rows.map((r) => [r.entryId, r]));
  return imported.flatMap((i) => {
    const r = byId.get(i.entryId);
    return r ? [{ ...r, grade: i.grade, missCount: i.missCount }] : [];
  });
}

/** "Title [Diff] +DT", the way the bank names an entry. */
export function entryName(s: { title: string; version: string | null; mod: string }): string {
  const diff = s.version ? " [" + s.version + "]" : "";
  const mod = s.mod && s.mod !== "NM" ? " +" + s.mod : "";
  return s.title + diff + mod;
}

/** "A (2 misses)", or the top two grades by what they mean. */
export function gradeText(s: { grade: string; missCount: number }): string {
  if (s.grade === "SSS") return "SSS (100%)";
  if (s.grade === "SS") return "SS (FC)";
  return s.grade + " (" + s.missCount + (s.missCount === 1 ? " miss)" : " misses)");
}

/** Per entry leaderboard: best grade first, then misses, then accuracy. */
const boardScore = {
  scoreId: scores.id,
  userId: users.id,
  osuUserId: users.osuUserId,
  username: users.username,
  avatarUrl: users.avatarUrl,
  countryCode: users.countryCode,
  grade: scores.grade,
  missCount: scores.missCount,
  accuracy: scores.accuracy,
  maxCombo: scores.maxCombo,
  isFc: scores.isFc,
  mods: scores.mods,
  playedAt: scores.playedAt,
};

export type BoardScore = {
  rank: number;
  scoreId: number;
  userId: number;
  osuUserId: number;
  username: string;
  avatarUrl: string | null;
  countryCode: string | null;
  grade: string;
  missCount: number;
  accuracy: number | null;
  maxCombo: number | null;
  isFc: boolean;
  mods: string;
  playedAt: Date | null;
};

/** Who can appear on a map's board: visible scores by players not banned. */
const onBoard = (entryId: number) =>
  and(eq(scores.entryId, entryId), eq(scores.isHidden, false), isNull(users.bannedAt));

/**
 * How a map's leaderboard is ordered, osu! style: best grade first, then the
 * misscount, then accuracy, and on a dead heat whoever set it first. The
 * misscount is what the site grades on and a grade covers a band, so 21
 * misses has to stand above 24 even where 24 carried the better accuracy.
 *
 * One fragment, read both by the list below and by the row_number that ranks
 * a single player, so a change to one can never leave the other behind.
 */
export const boardOrder = raw`${scores.gradeRank}, ${scores.missCount}, ${scores.accuracy} desc nulls last, ${scores.playedAt} asc nulls last, ${scores.id}`;

/** A player's place on a board, counted under that same order. */
export const boardRank = raw<number>`(row_number() over (order by ${boardOrder}))::int`;

/** A map's leaderboard, best first. */
export async function getEntryLeaderboard(entryId: number, limit = 50): Promise<BoardScore[]> {
  const rows = await db
    .select(boardScore)
    .from(scores)
    .innerJoin(users, eq(scores.userId, users.id))
    .where(onBoard(entryId))
    .orderBy(boardOrder)
    .limit(limit);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** A player's best on a map and where it stands, or null if they have none. */
export async function getEntryRankOf(entryId: number, userId: number): Promise<BoardScore | null> {
  const ranked = db
    .select({
      ...boardScore,
      // Both tables have an id; inside a subquery each needs its own name.
      scoreId: raw<number>`${scores.id}`.as("score_id"),
      userId: raw<number>`${users.id}`.as("user_id"),
      rank: boardRank.as("rank"),
    })
    .from(scores)
    .innerJoin(users, eq(scores.userId, users.id))
    .where(onBoard(entryId))
    .as("ranked");
  const [row] = await db.select().from(ranked).where(eq(ranked.userId, userId));
  return (row as BoardScore | undefined) ?? null;
}

/** How many players have a score on a map. */
export async function getEntryPlayerCount(entryId: number): Promise<number> {
  const [row] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(scores)
    .innerJoin(users, eq(scores.userId, users.id))
    .where(onBoard(entryId));
  return row?.n ?? 0;
}

/**
 * Everything a beatmap's page shows, by osu!'s own beatmap ID so a link can
 * be typed straight from osu!. The same beatmap can be banked under more
 * than one mod, so every listed entry comes back, and the page picks one.
 */
export async function getBeatmapPage(osuBeatmapId: number) {
  return db
    .select({
      entryId: entries.id,
      mod: entries.mod,
      tierOrder: entries.tierOrder,
      categories: entries.categories,
      lengthBucket: entries.lengthBucket,
      speedBucket: entries.speedBucket,
      stars: entries.stars,
      bpm: entries.bpm,
      drainSeconds: entries.drainSeconds,
      cs: entries.cs,
      ar: entries.ar,
      od: entries.od,
      judgedByName: entries.judgedByName,
      osuBeatmapId: beatmaps.osuBeatmapId,
      osuBeatmapsetId: beatmaps.osuBeatmapsetId,
      artist: beatmaps.artist,
      title: beatmaps.title,
      version: beatmaps.version,
      mapper: beatmaps.mapper,
      maxCombo: beatmaps.maxCombo,
      noteCount: beatmaps.noteCount,
      status: beatmaps.status,
    })
    .from(entries)
    .innerJoin(beatmaps, eq(entries.beatmapId, beatmaps.id))
    .where(and(eq(beatmaps.osuBeatmapId, osuBeatmapId), eq(entries.isActive, true)))
    .orderBy(asc(entries.tierOrder), asc(entries.id));
}

export type BeatmapEntry = Awaited<ReturnType<typeof getBeatmapPage>>[number];

/* -------------------------------------------------------------- rankings */

export const RANKING_PAGE_SIZE = 50;

const rankedPlayer = {
  userId: users.id,
  osuUserId: users.osuUserId,
  username: users.username,
  avatarUrl: users.avatarUrl,
  countryCode: users.countryCode,
  exp: userLevels.exp,
  tierOrder: userLevels.tierOrder,
  progress: userLevels.progress,
};

export type RankingRow = {
  rank: number;
  userId: number;
  osuUserId: number;
  username: string;
  avatarUrl: string | null;
  countryCode: string | null;
  exp: number;
  tierOrder: number | null;
  progress: number | null;
};

/** Everyone with EXP in a scope, banned players left out. */
const inRanking = (scope: string) =>
  and(eq(userLevels.scope, scope), raw`${userLevels.exp} > 0`, isNull(users.bannedAt));

/**
 * One page of the EXP leaderboard for a scope: "main" for overall, or a
 * category label. Most EXP first; on a tie the older account, so places are
 * stable from one load to the next.
 */
export async function getRankings(scope: string, page = 1) {
  const [counted] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(userLevels)
    .innerJoin(users, eq(users.id, userLevels.userId))
    .where(inRanking(scope));
  const total = counted?.n ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / RANKING_PAGE_SIZE));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount);
  const offset = (current - 1) * RANKING_PAGE_SIZE;

  const rows = total
    ? await db
        .select(rankedPlayer)
        .from(userLevels)
        .innerJoin(users, eq(users.id, userLevels.userId))
        .where(inRanking(scope))
        .orderBy(desc(userLevels.exp), asc(users.id))
        .limit(RANKING_PAGE_SIZE)
        .offset(offset)
    : [];

  return {
    rows: rows.map((r, i): RankingRow => ({ ...r, rank: offset + i + 1 })),
    total,
    page: current,
    pageCount,
    pageSize: RANKING_PAGE_SIZE,
  };
}

/** A player's place in a scope's leaderboard, or null while they have no EXP there. */
export async function getRankOf(userId: number, scope: string): Promise<RankingRow | null> {
  const ranked = db
    .select({
      ...rankedPlayer,
      rank: raw<number>`(row_number() over (order by ${userLevels.exp} desc, ${users.id}))::int`.as("rank"),
    })
    .from(userLevels)
    .innerJoin(users, eq(users.id, userLevels.userId))
    .where(inRanking(scope))
    .as("ranked");
  const [row] = await db.select().from(ranked).where(eq(ranked.userId, userId));
  return (row as RankingRow | undefined) ?? null;
}

export type PlayerTally = { clears: number; fcs: number; sss: number; ss: number; s: number };

/** Clears, full combos and top grades for some players, on maps still listed. */
export async function getPlayerTallies(userIds: number[]): Promise<Map<number, PlayerTally>> {
  if (!userIds.length) return new Map();
  const rows = await db
    .select({
      userId: scores.userId,
      clears: raw<number>`count(*)::int`,
      fcs: raw<number>`(count(*) filter (where ${scores.isFc}))::int`,
      sss: raw<number>`(count(*) filter (where ${scores.grade} = 'SSS'))::int`,
      ss: raw<number>`(count(*) filter (where ${scores.grade} = 'SS'))::int`,
      s: raw<number>`(count(*) filter (where ${scores.grade} = 'S'))::int`,
    })
    .from(scores)
    .innerJoin(entries, eq(scores.entryId, entries.id))
    .where(
      and(inArray(scores.userId, userIds), eq(scores.isHidden, false), eq(entries.isActive, true)),
    )
    .groupBy(scores.userId);
  return new Map(rows.map(({ userId, ...t }) => [userId, t]));
}
