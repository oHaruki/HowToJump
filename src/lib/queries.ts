import {
  and, arrayContained, arrayContains, arrayOverlaps, asc, desc, eq, ilike, inArray, isNull, not,
  or, sql as raw,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  beatmaps, deletedScores, entries, packs, roles, scores, siteConfig, suggestions, userLevels,
  users,
} from "@/lib/schema";
import { secondsToDrain } from "@/lib/import/parse";
import {
  BUILT_IN_ROLES, PLAYER, customRoleId, customRoleKey, isPermission, orderRoles, type RoleView,
} from "@/lib/roles";
import { packStandings, type PackStanding, type SpecialPack } from "@/lib/packs";
import { CATEGORIES, LENGTHS, SPEEDS, normalizeCategory, orderByScale } from "@/lib/tiers";

/** On the ladder rather than in a special pack. */
export const onLadder = isNull(entries.packId);

/** A special pack as a row carries it, null for a ladder entry. Needs packs left joined. */
const packSelection = { id: packs.id, name: packs.name, color: packs.color };

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
  /** The special pack a map sits in, off the ladder. */
  pack: SpecialPack | null;
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

/** Which side of `isActive` to read. Public pages only see "listed". */
export type BankStatus = "listed" | "removed" | "all";

export type BankFilters = {
  q?: string;
  /** A ladder pack's order. */
  pack?: number;
  /** A special pack's ID. */
  specialPack?: number;
  /** Staff only: special packs' maps beside the ladder's when no pack is picked. */
  everyPack?: boolean;
  category?: string;
  mod?: string;
  length?: string;
  speed?: string;
  /** Staff only. Defaults to "listed" everywhere else. */
  status?: BankStatus;
  /** Staff only: entries carrying a dropped category, or none at all. */
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
  pack: packSelection,
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

/** Entries with their beatmap and special pack, which is what bankSelection reads. */
const bankFrom = () =>
  db
    .select(bankSelection)
    .from(entries)
    .innerJoin(beatmaps, eq(entries.beatmapId, beatmaps.id))
    .leftJoin(packs, eq(entries.packId, packs.id));

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
  if (filters.specialPack) where.push(eq(entries.packId, filters.specialPack));
  else if (!filters.everyPack) where.push(onLadder);
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

/* The ladder, then each special pack. Hardest pack first, hardest map
   within it. The entry ID breaks ties, so a paged list keeps a stable
   order across queries. */
const bankOrder = [
  raw`${entries.packId} asc nulls first`,
  desc(entries.tierOrder),
  desc(entries.stars),
  desc(entries.id),
];

/** The whole filtered bank, for staff screens and one pack's page. The bank itself takes a page. */
export async function getBank(filters: BankFilters = {}): Promise<BankRow[]> {
  const rows = await bankFrom()
    .where(bankWhere(filters))
    .orderBy(...bankOrder)
    .limit(1000);

  return shape(rows);
}

/**
 * One page of the bank, plus how many entries the filters match. The count
 * runs first and clamps the page, so a number past the end shows the last
 * page rather than an empty list.
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
    ? await bankFrom()
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
    .where(and(statusWhere(status), onLadder))
    .groupBy(entries.tierOrder);
  return new Map(rows.map((r) => [r.tierOrder, r.n]));
}

export type SpecialPackRow = SpecialPack & { description: string | null; maps: number };

/** Every special pack, oldest first, with how many listed maps each holds. */
export async function getSpecialPacks(): Promise<SpecialPackRow[]> {
  return db
    .select({
      ...packSelection,
      description: packs.description,
      maps: raw<number>`(count(${entries.id}) filter (where ${entries.isActive}))::int`,
    })
    .from(packs)
    .leftJoin(entries, eq(entries.packId, packs.id))
    .groupBy(packs.id)
    .orderBy(asc(packs.id));
}

/** One special pack, or null. */
export async function getSpecialPack(id: number): Promise<SpecialPackRow | null> {
  return (await getSpecialPacks()).find((p) => p.id === id) ?? null;
}

/**
 * Listed entries per pack and set of categories, for the staff coverage
 * grid. A map counts once in each of its categories, and dropped labels
 * come back as they are.
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
    .where(and(eq(entries.isActive, true), onLadder))
    .groupBy(entries.tierOrder, entries.categories);
}

export async function getBankStats() {
  const [row] = await db
    .select({
      total: raw<number>`count(*)::int`,
      hardest: raw<number | null>`max(${entries.stars})`,
    })
    .from(entries)
    .where(and(eq(entries.isActive, true), onLadder));
  return { total: row?.total ?? 0, hardest: row?.hardest ?? null };
}

/**
 * Distinct values present in the bank, for the filter dropdowns. Distinct
 * in SQL, so this stays a few dozen rows however big the bank gets.
 * `everyPack` reads special packs' maps too.
 */
export async function getFacets(status: BankStatus = "listed", everyPack = false) {
  const rows = await db
    .selectDistinct({
      categories: entries.categories,
      mod: entries.mod,
      lengthBucket: entries.lengthBucket,
      speedBucket: entries.speedBucket,
    })
    .from(entries)
    .where(and(statusWhere(status), everyPack ? undefined : onLadder));

  const uniq = (xs: Array<string | null>) =>
    Array.from(new Set(xs.filter((x): x is string => Boolean(x)))).sort();

  // Each filter in its own scale's order, with unknown values last.
  return {
    categories: orderByScale(uniq(rows.flatMap((r) => r.categories)), CATEGORIES),
    mods: uniq(rows.map((r) => r.mod)),
    lengths: orderByScale(uniq(rows.map((r) => r.lengthBucket)), LENGTHS),
    speeds: orderByScale(uniq(rows.map((r) => r.speedBucket)), SPEEDS),
  };
}

export async function getRecentEntries(limit = 4): Promise<BankRow[]> {
  const rows = await bankFrom()
    .where(and(eq(entries.isActive, true), onLadder))
    .orderBy(desc(entries.createdAt))
    .limit(limit);
  return shape(rows);
}

/** Some entries by their IDs, in the bank's own order. */
export async function getEntriesByIds(ids: number[]): Promise<BankRow[]> {
  if (!ids.length) return [];
  const rows = await bankFrom()
    .where(inArray(entries.id, ids))
    .orderBy(...bankOrder);
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

/* ----------------------------------------------------------------- roles */

const roleView = (r: typeof roles.$inferSelect): RoleView => ({
  key: customRoleKey(r.id),
  name: r.name,
  permissions: r.permissions.filter(isPermission),
  builtIn: false,
});

/** Where the order the roles rank in is kept, as role keys from highest down. */
export const ROLE_ORDER_KEY = "role_order";

/** Every staff role from highest to lowest, as the roles board ranks them. */
export async function getRoles(): Promise<RoleView[]> {
  const [custom, [order]] = await Promise.all([
    db.select().from(roles).orderBy(asc(roles.id)),
    db
      .select({ value: siteConfig.value })
      .from(siteConfig)
      .where(eq(siteConfig.key, ROLE_ORDER_KEY)),
  ]);
  return orderRoles([...BUILT_IN_ROLES, ...custom.map(roleView)], order ? order.value.split(",") : []);
}

/** The role a user row's key names; a key that names none reads as a player. */
export async function getRole(key: string): Promise<RoleView> {
  const builtIn = BUILT_IN_ROLES.find((r) => r.key === key);
  if (builtIn) return builtIn;
  const id = customRoleId(key);
  if (id == null) return PLAYER;
  const [row] = await db.select().from(roles).where(eq(roles.id, id));
  return row ? roleView(row) : PLAYER;
}

/* --------------------------------------------------------------- profile */

/**
 * Every play a profile shows, newest first: visible scores on maps still on
 * the ladder, special packs left out. All of them, since top plays are
 * ranked by EXP across the lot.
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
      and(
        eq(scores.userId, userId),
        eq(scores.isHidden, false),
        eq(entries.isActive, true),
        onLadder,
      ),
    )
    .orderBy(desc(scores.playedAt), desc(scores.id));
}

export type ProfilePlay = Awaited<ReturnType<typeof getProfilePlays>>[number];

export type ScoreLine = {
  entryId: number;
  osuBeatmapId: number;
  osuBeatmapsetId: number | null;
  artist: string | null;
  title: string;
  version: string | null;
  mapper: string | null;
  mod: string;
  tierOrder: number;
  /** The special pack a map sits in, off the ladder. */
  pack: SpecialPack | null;
  categories: string[];
  stars: number | null;
  noteCount: number | null;
  grade: string;
  missCount: number;
  accuracy: number | null;
};

/** The maps behind a sync's imports, in the order they were imported. */
export async function describeScores(
  imported: Array<{ entryId: number; grade: string; missCount: number; accuracy: number | null }>,
): Promise<ScoreLine[]> {
  if (!imported.length) return [];
  const rows = await db
    .select({
      entryId: entries.id,
      osuBeatmapId: beatmaps.osuBeatmapId,
      osuBeatmapsetId: beatmaps.osuBeatmapsetId,
      artist: beatmaps.artist,
      title: beatmaps.title,
      version: beatmaps.version,
      mapper: beatmaps.mapper,
      mod: entries.mod,
      tierOrder: entries.tierOrder,
      pack: packSelection,
      categories: entries.categories,
      stars: entries.stars,
      noteCount: beatmaps.noteCount,
    })
    .from(entries)
    .innerJoin(beatmaps, eq(entries.beatmapId, beatmaps.id))
    .leftJoin(packs, eq(entries.packId, packs.id))
    .where(inArray(entries.id, imported.map((i) => i.entryId)));
  const byId = new Map(rows.map((r) => [r.entryId, r]));
  return imported.flatMap((i) => {
    const r = byId.get(i.entryId);
    return r ? [{ ...r, grade: i.grade, missCount: i.missCount, accuracy: i.accuracy }] : [];
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
 * How a map's leaderboard is ordered: grade, then misscount, then accuracy,
 * then whoever set it first. One fragment, read both by the list below and
 * by the row_number that ranks a single player.
 */
export const boardOrder = raw`${scores.gradeRank}, ${scores.missCount}, ${scores.accuracy} desc nulls last, ${scores.playedAt} asc nulls last, ${scores.id}`;

/** A player's place on a board, counted under that same order. */
export const boardRank = raw<number>`(row_number() over (order by ${boardOrder}))::int`;

/** That order in words, for the caption over a board. */
export const BOARD_ORDER_TEXT =
  "Best grade first, then the misscount, then accuracy. A tie goes to whoever set it first.";

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

/** Whoever holds a map's first place, or null while nobody has a score. */
export async function getEntryLeader(entryId: number): Promise<BoardScore | null> {
  const [row] = await db
    .select(boardScore)
    .from(scores)
    .innerJoin(users, eq(scores.userId, users.id))
    .where(onBoard(entryId))
    .orderBy(boardOrder)
    .limit(1);
  return row ? { ...row, rank: 1 } : null;
}

/** Whether an admin deleted this osu! score, which keeps it off the site. */
export async function isDeletedScore(osuScoreId: number | null): Promise<boolean> {
  if (osuScoreId == null) return false;
  const [row] = await db
    .select({ osuScoreId: deletedScores.osuScoreId })
    .from(deletedScores)
    .where(eq(deletedScores.osuScoreId, osuScoreId));
  return row != null;
}

/**
 * Everything a beatmap's page shows, by osu!'s own beatmap ID. One beatmap
 * can be banked under several mods, so every listed entry comes back.
 */
export async function getBeatmapPage(osuBeatmapId: number) {
  return db
    .select({
      entryId: entries.id,
      mod: entries.mod,
      tierOrder: entries.tierOrder,
      pack: packSelection,
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
    .leftJoin(packs, eq(entries.packId, packs.id))
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
 * One page of the EXP leaderboard for a scope: "main" or a category label.
 * Most EXP first, then the older account.
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

/** Whoever leads a scope, or null while nobody has EXP in it. */
export async function getTopRanked(scope: string): Promise<RankingRow | null> {
  const [row] = await db
    .select(rankedPlayer)
    .from(userLevels)
    .innerJoin(users, eq(users.id, userLevels.userId))
    .where(inRanking(scope))
    .orderBy(desc(userLevels.exp), asc(users.id))
    .limit(1);
  return row ? { ...row, rank: 1 } : null;
}

export type PlayerTally = { clears: number; fcs: number; sss: number; ss: number; s: number };

/**
 * Every spelling of a category the bank holds, renamed labels included,
 * the way levels count them.
 */
async function categorySpellings(category: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ label: raw<string>`unnest(${entries.categories})` })
    .from(entries);
  const found = rows.map((r) => r.label).filter((l) => normalizeCategory(l) === category);
  return found.length ? found : [category];
}

/**
 * Clears, full combos and top grades for some players, on ladder maps still
 * listed. With a category, only maps in it.
 */
export async function getPlayerTallies(
  userIds: number[],
  category?: string,
): Promise<Map<number, PlayerTally>> {
  if (!userIds.length) return new Map();
  const inCategory = category
    ? arrayOverlaps(entries.categories, await categorySpellings(category))
    : undefined;
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
      and(
        inArray(scores.userId, userIds),
        eq(scores.isHidden, false),
        eq(entries.isActive, true),
        onLadder,
        inCategory,
      ),
    )
    .groupBy(scores.userId);
  return new Map(rows.map(({ userId, ...t }) => [userId, t]));
}

/* ----------------------------------------------------------- pack boards */

export type PackRankingRow = PackStanding & {
  osuUserId: number;
  username: string;
  avatarUrl: string | null;
  countryCode: string | null;
};

/**
 * A special pack's board, most EXP first: visible scores on its listed maps
 * by players not banned. Worked out on each read, since a pack holds few maps.
 */
export async function getPackStandings(packId: number): Promise<PackRankingRow[]> {
  const rows = await db
    .select({
      userId: users.id,
      osuUserId: users.osuUserId,
      username: users.username,
      avatarUrl: users.avatarUrl,
      countryCode: users.countryCode,
      tierOrder: entries.tierOrder,
      grade: scores.grade,
      missCount: scores.missCount,
      accuracy: scores.accuracy,
      isFc: scores.isFc,
      noteCount: beatmaps.noteCount,
    })
    .from(scores)
    .innerJoin(users, eq(scores.userId, users.id))
    .innerJoin(entries, eq(scores.entryId, entries.id))
    .innerJoin(beatmaps, eq(entries.beatmapId, beatmaps.id))
    .where(
      and(
        eq(entries.packId, packId),
        eq(entries.isActive, true),
        eq(scores.isHidden, false),
        isNull(users.bannedAt),
      ),
    );
  const who = new Map(rows.map((r) => [r.userId, r]));
  return packStandings(rows).map((s) => {
    const p = who.get(s.userId)!;
    return {
      ...s,
      osuUserId: p.osuUserId,
      username: p.username,
      avatarUrl: p.avatarUrl,
      countryCode: p.countryCode,
    };
  });
}

/** A player's scores in a special pack, by entry. */
export async function getPackScoresOf(packId: number, userId: number) {
  const rows = await db
    .select({
      entryId: scores.entryId,
      tierOrder: entries.tierOrder,
      grade: scores.grade,
      missCount: scores.missCount,
      accuracy: scores.accuracy,
      noteCount: beatmaps.noteCount,
    })
    .from(scores)
    .innerJoin(entries, eq(scores.entryId, entries.id))
    .innerJoin(beatmaps, eq(entries.beatmapId, beatmaps.id))
    .where(
      and(
        eq(entries.packId, packId),
        eq(scores.userId, userId),
        eq(scores.isHidden, false),
      ),
    );
  return new Map(rows.map((r) => [r.entryId, r]));
}
