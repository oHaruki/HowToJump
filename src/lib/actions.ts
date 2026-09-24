"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, or, sql as rawSql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  auditLog, beatmaps, deletedScores, entries, scores, suggestionBatches, suggestions, users,
  type Suggestion,
} from "@/lib/schema";
import { auth, requireAdmin, requireStaff } from "@/lib/auth";
import {
  fetchBeatmaps, fetchStarRating, fetchUser, type BeatmapFacts,
} from "@/lib/osu/client";
import {
  backfillScore, clearOffModScores, cooldownLeft, refreshEntryPlayers, refreshProgress, syncUser,
} from "@/lib/osu/sync";
import { parseScoreLink } from "@/lib/osu/backfill";
import { modAcronyms, normalizeMod } from "@/lib/mods";
import {
  CATEGORIES, normalizeCategories, normalizeLength, normalizeSpeed, tierByName,
} from "@/lib/tiers";
import { applyMod, lengthBucketFor, speedGuessFor } from "@/lib/osu/modmath";
import {
  classify, parsePaste, rowFromLink, secondsToDrain, type ParsedRow,
} from "@/lib/import/parse";
import { describeScores, entryName, getExistingEntryKeys, gradeText } from "@/lib/queries";
import { announceEntries } from "@/lib/discord";

async function record(
  actorId: number | undefined,
  actorName: string | undefined,
  action: string,
  entityType: string,
  entityId: number | null,
  detail?: unknown,
) {
  await db.insert(auditLog).values({
    actorId: actorId ?? null,
    actorName: actorName ?? null,
    action,
    entityType,
    entityId,
    detail: detail ? (detail as object) : null,
  });
}

/** Splits a textarea into trimmed, non-empty lines. */
function splitLines(text: string): string[] {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/* ---------------------------------------------------------------- preview */

export type PreviewRow = Omit<ParsedRow, "tierObj"> & {
  tierOrder: number | null;
  /** Nomod values from the osu! API, so a mod change recalculates from the base. */
  baseCs: number | null;
  baseAr: number | null;
  baseOd: number | null;
  baseBpm: number | null;
  baseDrainSeconds: number | null;
  baseStars: number | null;
};

/**
 * Parses a paste, enriches every difficulty ID against the osu! API in
 * batches of 50, then applies the row's mod. The API's nomod numbers win
 * over the sheet's, so a mod is never applied twice.
 */
export async function previewPaste(
  text: string,
  defaults?: { tier?: string; categories?: string[]; mod?: string },
  asLinks?: boolean,
): Promise<{ mode: string | null; rows: PreviewRow[] }> {
  await requireStaff();

  const parsed = asLinks
    ? {
        mode: "links" as string | null,
        // One link per line, all sharing the pack, categories and mod chosen above.
        rows: splitLines(text).map((l) => rowFromLink(l, defaults)),
      }
    : parsePaste(text);

  const existing = await getExistingEntryKeys();
  classify(parsed.rows, existing);

  const ids = parsed.rows
    .map((r) => r.beatmapId)
    .filter((n): n is number => typeof n === "number");

  let facts = new Map<number, BeatmapFacts>();
  let lookupWorked = true;
  try {
    facts = await fetchBeatmaps(ids);
  } catch {
    // A lookup failure must not lose the paste. Rows keep the sheet's values,
    // and nothing is reported as missing on the strength of a failed call.
    lookupWorked = false;
  }

  const rows: PreviewRow[] = [];
  for (const r of parsed.rows) {
    const f = r.beatmapId ? facts.get(r.beatmapId) : undefined;
    const { tierObj, ...rest } = r;

    // osu! knew nothing about this ID. Saying "pick a pack" here would imply
    // the row is one dropdown away from importable, when it is a dead ID.
    if (r.beatmapId && lookupWorked && !f) {
      rows.push({
        ...rest,
        tierOrder: tierObj ? tierObj.order : null,
        status: "error",
        notes: ["No beatmap with ID " + r.beatmapId + " on osu!"],
        baseCs: null, baseAr: null, baseOd: null,
        baseBpm: null, baseDrainSeconds: null, baseStars: null,
      });
      continue;
    }

    const base = {
      cs: f?.cs ?? r.cs ?? null,
      ar: f?.ar ?? r.ar ?? null,
      od: f?.od ?? r.od ?? null,
      bpm: f?.bpm ?? r.bpm ?? null,
      drainSeconds: f?.drainSeconds ?? r.drainSeconds ?? null,
    };
    const adjusted = applyMod(base, r.mod);

    // Star rating cannot be derived locally, so a modded row asks osu! for it.
    let stars = f?.stars ?? r.stars ?? null;
    if (r.beatmapId && r.mod !== "NM") {
      try {
        stars = (await fetchStarRating(r.beatmapId, modAcronyms(r.mod))) ?? stars;
      } catch {
        // Keep the nomod rating rather than dropping the row.
      }
    }

    rows.push({
      ...rest,
      tierOrder: tierObj ? tierObj.order : null,
      title: f?.title || r.title,
      version: f?.version || r.version,
      mapper: f?.mapper || r.mapper,
      beatmapsetId: f?.osuBeatmapsetId ?? r.beatmapsetId,
      stars,
      bpm: adjusted.bpm,
      drainSeconds: adjusted.drainSeconds,
      drain: secondsToDrain(adjusted.drainSeconds),
      cs: adjusted.cs,
      ar: adjusted.ar,
      od: adjusted.od,
      // Pacing is derived when the sheet did not say, so links get it too.
      length: r.length || lengthBucketFor(adjusted.drainSeconds),
      speed: r.speed || speedGuessFor(adjusted.bpm),
      baseCs: base.cs,
      baseAr: base.ar,
      baseOd: base.od,
      baseBpm: base.bpm,
      baseDrainSeconds: base.drainSeconds,
      baseStars: f?.stars ?? null,
    });
  }

  return { mode: parsed.mode, rows };
}

/** Mod adjusted star rating for one map. Everything else recalculates in the browser. */
export async function starRatingFor(
  osuBeatmapId: number,
  mod: string,
): Promise<number | null> {
  await requireStaff();
  const acronyms = modAcronyms(mod);
  if (!acronyms.length) return null;
  try {
    return await fetchStarRating(osuBeatmapId, acronyms);
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------------- import */

const ImportRow = z.object({
  beatmapId: z.number().int().positive(),
  beatmapsetId: z.number().int().nullable().optional(),
  title: z.string().default(""),
  version: z.string().default(""),
  mapper: z.string().default(""),
  mod: z.string().default("NM"),
  tierOrder: z.number().int().min(1).max(16),
  categories: z.array(z.string().min(1)).min(1),
  length: z.string().default(""),
  speed: z.string().default(""),
  stars: z.number().nullable().optional(),
  bpm: z.number().nullable().optional(),
  drainSeconds: z.number().nullable().optional(),
  cs: z.number().nullable().optional(),
  ar: z.number().nullable().optional(),
  od: z.number().nullable().optional(),
  raw: z.record(z.string(), z.string()).optional(),
});

export async function importRows(
  rowsInput: unknown,
  source: "paste" | "upload" | "link" = "paste",
) {
  const staff = await requireStaff();
  const rows = z.array(ImportRow).parse(rowsInput);
  if (!rows.length) return { created: 0, batchId: null as number | null };

  const [batch] = await db
    .insert(suggestionBatches)
    .values({ createdById: staff.id, source, rowCount: rows.length })
    .returning({ id: suggestionBatches.id });

  await db.insert(suggestions).values(
    rows.map((r) => ({
      batchId: batch.id,
      submittedById: staff.id,
      status: "pending",
      osuBeatmapId: r.beatmapId,
      osuBeatmapsetId: r.beatmapsetId ?? null,
      rawPayload: r.raw ?? null,
      title: r.title,
      version: r.version,
      mapper: r.mapper,
      mod: normalizeMod(r.mod),
      proposedTierOrder: r.tierOrder,
      proposedCategories: normalizeCategories(r.categories),
      proposedLength: normalizeLength(r.length) || null,
      proposedSpeed: normalizeSpeed(r.speed) || null,
      stars: r.stars ?? null,
      bpm: r.bpm ?? null,
      drainSeconds: r.drainSeconds ?? null,
      cs: r.cs ?? null,
      ar: r.ar ?? null,
      od: r.od ?? null,
    })),
  );

  await record(staff.id, staff.name ?? undefined, "suggestions.import", "batch", batch.id, {
    rows: rows.length,
    source,
  });

  revalidatePath("/staff");
  revalidatePath("/staff/queue");
  return { created: rows.length, batchId: batch.id };
}

/* ---------------------------------------------------------------- reviews */

/**
 * Makes sure every beatmap has a row, looking the new ones up on osu! 50 to
 * a request. Returns each osu! beatmap ID's row ID.
 */
async function ensureBeatmaps(osuBeatmapIds: number[]): Promise<Map<number, number>> {
  const ids = Array.from(new Set(osuBeatmapIds));
  const rowIds = async () => {
    const rows = await db
      .select({ id: beatmaps.id, osuBeatmapId: beatmaps.osuBeatmapId })
      .from(beatmaps)
      .where(inArray(beatmaps.osuBeatmapId, ids));
    return new Map(rows.map((r) => [r.osuBeatmapId, r.id]));
  };

  const found = await rowIds();
  const missing = ids.filter((id) => !found.has(id));
  if (!missing.length) return found;

  let facts = new Map<number, BeatmapFacts>();
  try {
    facts = await fetchBeatmaps(missing);
  } catch {
    // Every missing map goes in as Unknown.
  }

  await db
    .insert(beatmaps)
    .values(
      missing.map((osuBeatmapId) => {
        const f = facts.get(osuBeatmapId);
        return {
          osuBeatmapId,
          osuBeatmapsetId: f?.osuBeatmapsetId ?? null,
          artist: f?.artist ?? null,
          title: f?.title ?? "Unknown",
          version: f?.version ?? null,
          mapper: f?.mapper ?? null,
          mapperUserId: f?.mapperUserId ?? null,
          stars: f?.stars ?? null,
          bpm: f?.bpm ?? null,
          drainSeconds: f?.drainSeconds ?? null,
          totalSeconds: f?.totalSeconds ?? null,
          cs: f?.cs ?? null,
          ar: f?.ar ?? null,
          od: f?.od ?? null,
          hp: f?.hp ?? null,
          maxCombo: f?.maxCombo ?? null,
          noteCount: f?.noteCount ?? null,
          status: f?.status ?? null,
          coverUrl: f?.coverUrl ?? null,
          cardUrl: f?.cardUrl ?? null,
          listUrl: f?.listUrl ?? null,
          lastSyncedAt: f ? new Date() : null,
        };
      }),
    )
    .onConflictDoNothing();
  return rowIds();
}

/**
 * Admin only. The single place anything is written into entries: helpers
 * fill the queue, admins decide what the ladder holds.
 */
export async function approveSuggestions(ids: number[]) {
  const admin = await requireAdmin();
  if (!ids.length) return { approved: 0 };

  // A pack is required before anything reaches the ladder.
  const rows = (
    await db.select().from(suggestions).where(inArray(suggestions.id, ids))
  ).filter(
    (s): s is Suggestion & { proposedTierOrder: number } =>
      s.status === "pending" && s.proposedTierOrder != null,
  );
  if (!rows.length) return { approved: 0 };

  const beatmapRowIds = await ensureBeatmaps(rows.map((s) => s.osuBeatmapId));

  const { added, approved } = await db.transaction(async (tx) => {
    const created = await tx
      .insert(entries)
      .values(
        rows.map((s) => ({
          beatmapId: beatmapRowIds.get(s.osuBeatmapId)!,
          mod: normalizeMod(s.mod),
          tierOrder: s.proposedTierOrder,
          // The importer will not send a row without one, so this only stands in
          // for a suggestion that somehow arrived with the field empty.
          categories: s.proposedCategories.length
            ? normalizeCategories(s.proposedCategories)
            : [CATEGORIES[0]],
          lengthBucket: s.proposedLength,
          speedBucket: s.proposedSpeed,
          stars: s.stars,
          bpm: s.bpm,
          drainSeconds: s.drainSeconds,
          cs: s.cs,
          ar: s.ar,
          od: s.od,
          judgedById: admin.id,
          judgedByName: admin.name ?? null,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: entries.id });

    const marked = await tx
      .update(suggestions)
      .set({ status: "approved", reviewerId: admin.id, reviewedAt: new Date() })
      .where(
        and(
          inArray(suggestions.id, rows.map((s) => s.id)),
          eq(suggestions.status, "pending"),
        ),
      )
      .returning({ id: suggestions.id });

    return { added: created.map((e) => e.id), approved: marked.length };
  });

  await record(admin.id, admin.name ?? undefined, "suggestions.approve", "suggestion", null, {
    ids,
    approved,
  });
  await announceEntries(added);
  revalidatePath("/staff");
  revalidatePath("/staff/queue");
  revalidatePath("/maps");
  revalidatePath("/ladder");
  revalidatePath("/");
  return { approved };
}

export async function rejectSuggestions(ids: number[], note?: string) {
  const staff = await requireStaff();
  if (!ids.length) return { rejected: 0 };
  await db
    .update(suggestions)
    .set({
      status: "rejected",
      reviewerId: staff.id,
      reviewNote: note ?? null,
      reviewedAt: new Date(),
    })
    .where(and(inArray(suggestions.id, ids), eq(suggestions.status, "pending")));
  await record(staff.id, staff.name ?? undefined, "suggestions.reject", "suggestion", null, {
    ids,
  });
  revalidatePath("/staff");
  revalidatePath("/staff/queue");
  return { rejected: ids.length };
}

export async function setSuggestionTier(id: number, tierName: string) {
  await requireStaff();
  const t = tierByName(tierName);
  await db
    .update(suggestions)
    .set({ proposedTierOrder: t ? t.order : null })
    .where(eq(suggestions.id, id));
  revalidatePath("/staff/queue");
}

/* ------------------------------------------------------------- bank admin */

/**
 * Edits everything staff assign on a banked entry. Changing the mod
 * recalculates the figures from the beatmap's nomod values, re-fetches the
 * star rating and takes off the scores set under the old mod; beatmap and
 * mod are unique, so a collision is checked before anything is written.
 */
export async function updateEntry(
  entryId: number,
  patch: {
    tier?: string;
    categories?: string[];
    mod?: string;
    length?: string;
    speed?: string;
  },
) {
  const staff = await requireStaff();

  const [current] = await db
    .select({
      id: entries.id,
      beatmapId: entries.beatmapId,
      mod: entries.mod,
      osuBeatmapId: beatmaps.osuBeatmapId,
      baseCs: beatmaps.cs,
      baseAr: beatmaps.ar,
      baseOd: beatmaps.od,
      baseBpm: beatmaps.bpm,
      baseDrain: beatmaps.drainSeconds,
    })
    .from(entries)
    .innerJoin(beatmaps, eq(entries.beatmapId, beatmaps.id))
    .where(eq(entries.id, entryId));
  if (!current) throw new Error("That entry no longer exists");

  const set: Record<string, unknown> = { updatedAt: new Date() };

  if (patch.tier) {
    const t = tierByName(patch.tier);
    if (!t) throw new Error("Unknown pack: " + patch.tier);
    set.tierOrder = t.order;
  }
  if (patch.categories) {
    const categories = normalizeCategories(patch.categories);
    if (!categories.length) throw new Error("Pick at least one category");
    set.categories = categories;
  }
  if (patch.length !== undefined) set.lengthBucket = normalizeLength(patch.length) || null;
  if (patch.speed !== undefined) set.speedBucket = normalizeSpeed(patch.speed) || null;

  const nextMod = patch.mod ? normalizeMod(patch.mod) : null;
  if (nextMod && nextMod !== current.mod) {
    const clash = await db.query.entries.findFirst({
      where: and(eq(entries.beatmapId, current.beatmapId), eq(entries.mod, nextMod)),
    });
    if (clash) throw new Error("This map is already in the bank under " + nextMod);

    const adjusted = applyMod(
      {
        cs: current.baseCs,
        ar: current.baseAr,
        od: current.baseOd,
        bpm: current.baseBpm,
        drainSeconds: current.baseDrain,
      },
      nextMod,
    );
    set.mod = nextMod;
    set.cs = adjusted.cs;
    set.ar = adjusted.ar;
    set.od = adjusted.od;
    set.bpm = adjusted.bpm;
    set.drainSeconds = adjusted.drainSeconds;

    // Star rating needs osu!'s calculator, so it is asked for rather than derived.
    try {
      const sr = await fetchStarRating(current.osuBeatmapId, modAcronyms(nextMod));
      if (sr != null) set.stars = sr;
    } catch {
      // Keep the previous rating rather than blanking it.
    }

    // Pacing follows the new length unless staff set it in the same edit.
    if (patch.length === undefined) {
      set.lengthBucket = lengthBucketFor(adjusted.drainSeconds) || null;
    }
  }

  await db.update(entries).set(set).where(eq(entries.id, entryId));
  // The scores set under the old mod come off with it.
  const cleared = set.mod ? await clearOffModScores(entryId) : [];
  await record(
    staff.id, staff.name ?? undefined, "entry.update", "entry", entryId,
    cleared.length ? { ...patch, cleared } : patch,
  );
  // A new pack or category changes what every play on the map is worth.
  if (patch.tier || patch.categories) await refreshEntryPlayers(entryId);
  for (const userId of new Set(cleared.map((s) => s.userId))) await refreshProgress(userId);

  revalidatePath("/staff/bank");
  revalidatePath("/maps");
  revalidatePath("/ladder");
  revalidatePath("/");
}

export async function removeEntry(entryId: number) {
  const staff = await requireStaff();
  await db
    .update(entries)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(entries.id, entryId));
  await record(staff.id, staff.name ?? undefined, "entry.remove", "entry", entryId);
  await refreshEntryPlayers(entryId);
  revalidatePath("/staff/bank");
  revalidatePath("/maps");
  revalidatePath("/ladder");
}

/** Puts a removed entry back on the ladder. Removing only clears the flag. */
export async function restoreEntry(entryId: number) {
  const staff = await requireStaff();
  await db
    .update(entries)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(entries.id, entryId));
  await record(staff.id, staff.name ?? undefined, "entry.restore", "entry", entryId);
  await refreshEntryPlayers(entryId);
  revalidatePath("/staff/bank");
  revalidatePath("/maps");
  revalidatePath("/ladder");
}

export async function setUserRole(userId: number, role: "user" | "helper" | "admin") {
  const admin = await requireAdmin();
  if (userId === admin.id && role !== "admin") {
    // Stops the last admin locking themselves out of the staff area.
    const [{ n }] = await db
      .select({ n: rawSql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, "admin"));
    if (n <= 1) throw new Error("You are the only admin, promote someone else first");
  }
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
  await record(admin.id, admin.name ?? undefined, "user.role", "user", userId, { role });
  revalidatePath("/staff/members");
}

/** Grants a role by osu! ID or username, creating the local row if needed. */
export async function addStaffMember(
  identifier: string,
  role: "helper" | "admin",
): Promise<{ username: string; created: boolean }> {
  const admin = await requireAdmin();
  const trimmed = identifier.trim();
  if (!trimmed) throw new Error("Enter an osu! user ID or username");

  const profile = await fetchUser(trimmed);
  if (!profile) throw new Error("No osu! player found for " + trimmed);

  const existing = await db.query.users.findFirst({
    where: eq(users.osuUserId, profile.id),
  });

  if (existing) {
    await db
      .update(users)
      .set({ role, username: profile.username, updatedAt: new Date() })
      .where(eq(users.id, existing.id));
    await record(admin.id, admin.name ?? undefined, "user.role", "user", existing.id, { role });
    revalidatePath("/staff/members");
    return { username: profile.username, created: false };
  }

  const [created] = await db
    .insert(users)
    .values({
      osuUserId: profile.id,
      username: profile.username,
      avatarUrl: profile.avatar_url,
      countryCode: profile.country_code,
      globalRank: profile.statistics?.global_rank ?? null,
      role,
    })
    .returning({ id: users.id });

  await record(admin.id, admin.name ?? undefined, "user.add", "user", created.id, {
    role,
    osuUserId: profile.id,
  });
  revalidatePath("/staff/members");
  return { username: profile.username, created: true };
}

/* ----------------------------------------------------------------- scores */

/**
 * Deletes a score from its map, the player's profile and their levels. Its
 * osu! score ID is kept, so neither the sync nor a link brings it back.
 */
export async function deleteScore(scoreId: number) {
  const admin = await requireAdmin();
  const gone = await db.transaction(async (tx) => {
    const [row] = await tx.delete(scores).where(eq(scores.id, scoreId)).returning();
    if (row?.osuScoreId != null) {
      await tx
        .insert(deletedScores)
        .values({ osuScoreId: row.osuScoreId, deletedById: admin.id })
        .onConflictDoNothing();
    }
    return row;
  });
  if (!gone) throw new Error("That score is already gone");

  await record(admin.id, admin.name ?? undefined, "score.delete", "score", scoreId, {
    userId: gone.userId,
    entryId: gone.entryId,
    osuScoreId: gone.osuScoreId,
    grade: gone.grade,
    missCount: gone.missCount,
    accuracy: gone.accuracy,
  });
  await refreshProgress(gone.userId);
}

/* ------------------------------------------------------------------- sync */

export type SyncSummary = {
  error?: string;
  /** Set when the cooldown refused the sync: seconds since the last one. */
  syncedSecondsAgo?: number;
  playsSeen: number;
  /** "Title [Diff] +DT · A", one for each score the sync kept. */
  imported: string[];
};

export async function syncMyScores(): Promise<SyncSummary> {
  const session = await auth();
  if (!session?.user) throw new Error("Sign in first");

  const [me] = await db
    .select({ lastSyncedAt: users.lastSyncedAt })
    .from(users)
    .where(eq(users.id, session.userId));
  const last = me?.lastSyncedAt ?? null;
  if (last && cooldownLeft(last) > 0) {
    return {
      syncedSecondsAgo: Math.round((Date.now() - last.getTime()) / 1000),
      playsSeen: 0,
      imported: [],
    };
  }

  // The app token, not the player's: theirs is only issued at sign in and
  // expires a day later, while recent plays are public either way.
  const result = await syncUser(session.userId, session.osuUserId);
  revalidatePath("/me");
  if (result.error) return { error: result.error, playsSeen: result.playsSeen, imported: [] };

  const lines = await describeScores(result.imported);
  return {
    playsSeen: result.playsSeen,
    imported: lines.map((s) => entryName(s) + " · " + s.grade),
  };
}

/* ------------------------------------------------------------ backfill */

export type BackfillSummary = {
  error?: string;
  /** "Title [Diff] +DT · A (2 misses)" for the score that was kept. */
  added?: string;
  /** True when it replaced a worse score of theirs on the same map. */
  improved?: boolean;
};

/** Adds one of the signed in player's own scores from its osu! link. */
export async function addScoreByLink(link: string): Promise<BackfillSummary> {
  const session = await auth();
  if (!session?.userId) return { error: "Sign in first." };

  const ref = parseScoreLink(String(link ?? "").slice(0, 300));
  if (!ref) {
    return { error: "That isn't a score link. It looks like https://osu.ppy.sh/scores/7534121696." };
  }
  if (ref.ruleset && ref.ruleset !== "osu") return { error: "Only osu!standard scores count." };

  const result = await backfillScore(session.userId, session.osuUserId, ref);
  if (!result.ok) return { error: result.error };
  revalidatePath("/me");

  const [line] = await describeScores([result.imported]);
  return {
    added: line ? entryName(line) + " · " + gradeText(line) : "the score",
    improved: result.improved,
  };
}
