import {
  pgTable, serial, integer, bigint, text, varchar, boolean, timestamp,
  doublePrecision, numeric, jsonb, uniqueIndex, index, primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ------------------------------------------------------------------ users */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    osuUserId: bigint("osu_user_id", { mode: "number" }).notNull(),
    username: varchar("username", { length: 64 }).notNull(),
    avatarUrl: text("avatar_url"),
    countryCode: varchar("country_code", { length: 4 }),
    globalRank: integer("global_rank"),
    /** user | helper | admin */
    role: varchar("role", { length: 16 }).notNull().default("user"),
    syncEnabled: boolean("sync_enabled").notNull().default(true),
    /** Newest play seen, fails included. Tells a sync whether a play arrived. */
    lastPlayedAt: timestamp("last_played_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    /**
     * osu!'s own play count, which rises with every play, graveyard maps
     * included. A rise between two checks is what makes a player due a sync.
     */
    osuPlayCount: integer("osu_play_count"),
    playCountCheckedAt: timestamp("play_count_checked_at", { withTimezone: true }),
    /**
     * The levels as the player last saw them on their profile, and when. The
     * profile animates from here to where they are now, and marks scores
     * imported since as new.
     */
    progressSeen: jsonb("progress_seen").$type<Record<string, unknown>>(),
    progressSeenAt: timestamp("progress_seen_at", { withTimezone: true }),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_osu_user_id_idx").on(t.osuUserId),
    index("users_role_idx").on(t.role),
    index("users_sync_idx").on(t.syncEnabled, t.lastSyncedAt),
  ],
);

/* -------------------------------------------------------------- beatmaps */

/** Metadata cached from the osu! API, keyed by difficulty ID. */
export const beatmaps = pgTable(
  "beatmaps",
  {
    id: serial("id").primaryKey(),
    osuBeatmapId: bigint("osu_beatmap_id", { mode: "number" }).notNull(),
    osuBeatmapsetId: bigint("osu_beatmapset_id", { mode: "number" }),
    artist: text("artist"),
    title: text("title").notNull(),
    version: text("version"),
    /** Difficulty owner, which differs from the set host on guest diffs. */
    mapper: text("mapper"),
    mapperUserId: bigint("mapper_user_id", { mode: "number" }),
    stars: doublePrecision("stars"),
    bpm: doublePrecision("bpm"),
    drainSeconds: integer("drain_seconds"),
    totalSeconds: integer("total_seconds"),
    cs: doublePrecision("cs"),
    ar: doublePrecision("ar"),
    od: doublePrecision("od"),
    hp: doublePrecision("hp"),
    maxCombo: integer("max_combo"),
    /** Circles, sliders and spinners, which set what a miss costs in EXP. */
    noteCount: integer("note_count"),
    /** ranked | loved | graveyard | qualified | wip | pending */
    status: varchar("status", { length: 24 }),
    coverUrl: text("cover_url"),
    cardUrl: text("card_url"),
    listUrl: text("list_url"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("beatmaps_osu_id_idx").on(t.osuBeatmapId)],
);

/* ------------------------------------------------------------ bank entries */

/**
 * One row is a beatmap *under a specific mod*. The same map with DT is a
 * separate entry with its own pack and its own leaderboard.
 */
export const entries = pgTable(
  "entries",
  {
    id: serial("id").primaryKey(),
    beatmapId: integer("beatmap_id").notNull().references(() => beatmaps.id, { onDelete: "cascade" }),
    /** Canonical mod string, "NM" when nomod. */
    mod: varchar("mod", { length: 16 }).notNull().default("NM"),
    tierOrder: integer("tier_order").notNull(),
    /** One map can train more than one skill, so it can sit in several. */
    categories: varchar("categories", { length: 48 }).array().notNull().default(sql`'{}'`),
    lengthBucket: varchar("length_bucket", { length: 24 }),
    speedBucket: varchar("speed_bucket", { length: 24 }),
    /** Mod-adjusted values, which differ from the beatmap's nomod numbers. */
    stars: doublePrecision("stars"),
    bpm: doublePrecision("bpm"),
    drainSeconds: integer("drain_seconds"),
    cs: doublePrecision("cs"),
    ar: doublePrecision("ar"),
    od: doublePrecision("od"),
    customBgUrl: text("custom_bg_url"),
    notes: text("notes"),
    judgedById: integer("judged_by_id").references(() => users.id),
    judgedByName: varchar("judged_by_name", { length: 64 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("entries_beatmap_mod_idx").on(t.beatmapId, t.mod),
    index("entries_tier_idx").on(t.tierOrder),
    index("entries_categories_idx").using("gin", t.categories),
    index("entries_active_idx").on(t.isActive),
    /*
     * The public bank reads one page at a time, filtered to active rows and
     * ordered by pack then stars. These three cover that: the sort index so
     * the page can be read straight off it rather than sorting the whole
     * bank first, the other two for the dropdowns that narrow it.
     */
    index("entries_bank_sort_idx").on(t.isActive, t.tierOrder, t.stars),
    index("entries_bank_mod_idx").on(t.isActive, t.mod),
    index("entries_bank_pacing_idx").on(t.isActive, t.lengthBucket, t.speedBucket),
  ],
);

/* -------------------------------------------------------------- suggestions */

export const suggestionBatches = pgTable("suggestion_batches", {
  id: serial("id").primaryKey(),
  createdById: integer("created_by_id").references(() => users.id),
  /** paste | upload | link */
  source: varchar("source", { length: 24 }).notNull().default("paste"),
  rowCount: integer("row_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const suggestions = pgTable(
  "suggestions",
  {
    id: serial("id").primaryKey(),
    batchId: integer("batch_id").references(() => suggestionBatches.id, { onDelete: "cascade" }),
    submittedById: integer("submitted_by_id").references(() => users.id),
    /** pending | approved | rejected | duplicate */
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    osuBeatmapId: bigint("osu_beatmap_id", { mode: "number" }).notNull(),
    osuBeatmapsetId: bigint("osu_beatmapset_id", { mode: "number" }),
    rawLink: text("raw_link"),
    /** The pasted row kept verbatim, for the audit trail. */
    rawPayload: jsonb("raw_payload"),
    title: text("title"),
    version: text("version"),
    mapper: text("mapper"),
    mod: varchar("mod", { length: 16 }).notNull().default("NM"),
    proposedTierOrder: integer("proposed_tier_order"),
    proposedCategories: varchar("proposed_categories", { length: 48 }).array().notNull().default(sql`'{}'`),
    proposedLength: varchar("proposed_length", { length: 24 }),
    proposedSpeed: varchar("proposed_speed", { length: 24 }),
    stars: doublePrecision("stars"),
    bpm: doublePrecision("bpm"),
    drainSeconds: integer("drain_seconds"),
    cs: doublePrecision("cs"),
    ar: doublePrecision("ar"),
    od: doublePrecision("od"),
    reviewerId: integer("reviewer_id").references(() => users.id),
    reviewNote: text("review_note"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("suggestions_status_idx").on(t.status),
    index("suggestions_batch_idx").on(t.batchId),
    index("suggestions_map_mod_idx").on(t.osuBeatmapId, t.mod),
  ],
);

/** Helpers can vote a pack, so placement is a consensus rather than one call. */
export const suggestionVotes = pgTable(
  "suggestion_votes",
  {
    suggestionId: integer("suggestion_id").notNull().references(() => suggestions.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    vote: integer("vote").notNull().default(1),
    proposedTierOrder: integer("proposed_tier_order"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.suggestionId, t.userId] })],
);

/* ------------------------------------------------------------------ scores */

export const scores = pgTable(
  "scores",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    entryId: integer("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
    /** osu!'s own score ID. The idempotency key that makes re-syncing safe. */
    osuScoreId: bigint("osu_score_id", { mode: "number" }),
    missCount: integer("miss_count").notNull().default(0),
    accuracy: doublePrecision("accuracy"),
    maxCombo: integer("max_combo"),
    isFc: boolean("is_fc").notNull().default(false),
    isPerfect: boolean("is_perfect").notNull().default(false),
    mods: varchar("mods", { length: 32 }).notNull().default("NM"),
    grade: varchar("grade", { length: 8 }).notNull(),
    gradeRank: integer("grade_rank").notNull(),
    /** osu_api | staff */
    source: varchar("source", { length: 16 }).notNull().default("osu_api"),
    isHidden: boolean("is_hidden").notNull().default(false),
    hiddenById: integer("hidden_by_id").references(() => users.id),
    hiddenReason: text("hidden_reason"),
    playedAt: timestamp("played_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** When this result landed: first import, or the last time it improved. */
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("scores_osu_score_id_idx").on(t.osuScoreId),
    uniqueIndex("scores_user_entry_idx").on(t.userId, t.entryId),
    index("scores_entry_rank_idx").on(t.entryId, t.gradeRank),
    index("scores_user_idx").on(t.userId),
  ],
);

/** Rollup refreshed on score import so pages never aggregate per request. */
export const userTierProgress = pgTable(
  "user_tier_progress",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tierOrder: integer("tier_order").notNull(),
    entriesTotal: integer("entries_total").notNull().default(0),
    entriesCleared: integer("entries_cleared").notNull().default(0),
    bestGradeRank: integer("best_grade_rank"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.tierOrder] })],
);

/**
 * Skill levels, one row per category plus "main". Rebuilt alongside the pack
 * rollup, so a profile, and later a Discord role, reads one row per level.
 */
export const userLevels = pgTable(
  "user_levels",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** A category label, or "main" for the combined level. */
    scope: varchar("scope", { length: 48 }).notNull(),
    exp: integer("exp").notNull().default(0),
    /** Null below Stone. */
    tierOrder: integer("tier_order"),
    /** 0 to 99 toward the next pack; null at the top. */
    progress: integer("progress"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.scope] })],
);

/* ------------------------------------------------------------------ config */

export const gradeRules = pgTable("grade_rules", {
  id: serial("id").primaryKey(),
  grade: varchar("grade", { length: 8 }).notNull(),
  sortOrder: integer("sort_order").notNull(),
  label: varchar("label", { length: 64 }).notNull(),
  minMiss: integer("min_miss"),
  maxMiss: integer("max_miss"),
  requiresFc: boolean("requires_fc").notNull().default(false),
  requiresPerfect: boolean("requires_perfect").notNull().default(false),
  /**
   * Share of a map's pack EXP the grade earns, as a percentage. Fractional:
   * the bottom bands are worth well under one percent of a pack.
   */
  expPercent: numeric("exp_percent", { precision: 6, scale: 3, mode: "number" })
    .notNull()
    .default(0),
});

/** Editable site copy, so the rules page is not hardcoded. */
export const siteConfig = pgTable("site_config", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    playsSeen: integer("plays_seen").notNull().default(0),
    playsMatched: integer("plays_matched").notNull().default(0),
    scoresImported: integer("scores_imported").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("sync_runs_user_idx").on(t.userId, t.startedAt)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id").references(() => users.id),
    actorName: varchar("actor_name", { length: 64 }),
    action: varchar("action", { length: 64 }).notNull(),
    entityType: varchar("entity_type", { length: 32 }),
    entityId: integer("entity_id"),
    detail: jsonb("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Beatmap = typeof beatmaps.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type Suggestion = typeof suggestions.$inferSelect;
export type Score = typeof scores.$inferSelect;
