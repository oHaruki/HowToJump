"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, or, sql as rawSql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  auditLog, beatmaps, entries, suggestionBatches, suggestions, users,
} from "@/lib/schema";
import { auth, requireAdmin, requireStaff } from "@/lib/auth";
import {
  fetchBeatmaps, fetchStarRating, fetchUser, type BeatmapFacts,
} from "@/lib/osu/client";
import { syncUser } from "@/lib/osu/sync";
import { modAcronyms, normalizeMod } from "@/lib/mods";
import { tierByName } from "@/lib/tiers";
import { applyMod, lengthBucketFor, speedGuessFor } from "@/lib/osu/modmath";
import {
  classify, parsePaste, rowFromLink, secondsToDrain, type ParsedRow,
} from "@/lib/import/parse";
import { getExistingEntryKeys } from "@/lib/queries";

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
  /**
   * Nomod values straight from the osu! API. Kept so that changing the mod in
   * the preview recalculates from the real base rather than compounding on
   * figures that were already adjusted once.
   */
  baseCs: number | null;
  baseAr: number | null;
  baseOd: number | null;
  baseBpm: number | null;
  baseDrainSeconds: number | null;
  baseStars: number | null;
};

/**
 * Parses a paste, enriches every difficulty ID against the osu! API in batches
 * of 50, then applies the row's mod to the values so what staff see is what a
 * player would see.
 *
 * The API's numbers win over the sheet's. The sheet cannot say which mod its
 * figures were written for, so deriving from the nomod truth is the only way
 * to avoid applying a mod twice.
 */
export async function previewPaste(
  text: string,
  defaults?: { tier?: string; category?: string; mod?: string },
  asLinks?: boolean,
): Promise<{ mode: string | null; rows: PreviewRow[] }> {
  await requireStaff();

  const parsed = asLinks
    ? {
        mode: "links" as string | null,
        // One link per line, all sharing the pack, category and mod chosen above.
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

/**
 * The mod adjusted star rating for one map, for when staff change the mod on
 * a row already in the preview. Everything else recalculates in the browser.
 */
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
  category: z.string().min(1),
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
      proposedCategory: r.category,
      proposedLength: r.length || null,
      proposedSpeed: r.speed || null,
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

/** Makes sure the beatmap row exists, pulling fresh metadata when it does not. */
async function ensureBeatmap(osuBeatmapId: number): Promise<number> {
  const found = await db.query.beatmaps.findFirst({
    where: eq(beatmaps.osuBeatmapId, osuBeatmapId),
  });
  if (found) return found.id;

  let facts: BeatmapFacts | undefined;
  try {
    facts = (await fetchBeatmaps([osuBeatmapId])).get(osuBeatmapId);
  } catch {
    facts = undefined;
  }

  const [created] = await db
    .insert(beatmaps)
    .values({
      osuBeatmapId,
      osuBeatmapsetId: facts?.osuBeatmapsetId ?? null,
      artist: facts?.artist ?? null,
      title: facts?.title ?? "Unknown",
      version: facts?.version ?? null,
      mapper: facts?.mapper ?? null,
      mapperUserId: facts?.mapperUserId ?? null,
      stars: facts?.stars ?? null,
      bpm: facts?.bpm ?? null,
      drainSeconds: facts?.drainSeconds ?? null,
      totalSeconds: facts?.totalSeconds ?? null,
      cs: facts?.cs ?? null,
      ar: facts?.ar ?? null,
      od: facts?.od ?? null,
      hp: facts?.hp ?? null,
      maxCombo: facts?.maxCombo ?? null,
      status: facts?.status ?? null,
      coverUrl: facts?.coverUrl ?? null,
      cardUrl: facts?.cardUrl ?? null,
      listUrl: facts?.listUrl ?? null,
      lastSyncedAt: facts ? new Date() : null,
    })
    .returning({ id: beatmaps.id });
  return created.id;
}

export async function approveSuggestions(ids: number[]) {
  const staff = await requireStaff();
  if (!ids.length) return { approved: 0 };

  const rows = await db.select().from(suggestions).where(inArray(suggestions.id, ids));
  let approved = 0;

  for (const s of rows) {
    if (s.status !== "pending") continue;
    // A pack is required before anything reaches the ladder.
    if (!s.proposedTierOrder) continue;

    const beatmapRowId = await ensureBeatmap(s.osuBeatmapId);
    await db
      .insert(entries)
      .values({
        beatmapId: beatmapRowId,
        mod: normalizeMod(s.mod),
        tierOrder: s.proposedTierOrder,
        category: s.proposedCategory ?? "Raw Aim",
        lengthBucket: s.proposedLength,
        speedBucket: s.proposedSpeed,
        stars: s.stars,
        bpm: s.bpm,
        drainSeconds: s.drainSeconds,
        cs: s.cs,
        ar: s.ar,
        od: s.od,
        judgedById: staff.id,
        judgedByName: staff.name ?? null,
      })
      .onConflictDoNothing();

    await db
      .update(suggestions)
      .set({ status: "approved", reviewerId: staff.id, reviewedAt: new Date() })
      .where(eq(suggestions.id, s.id));
    approved += 1;
  }

  await record(staff.id, staff.name ?? undefined, "suggestions.approve", "suggestion", null, {
    ids,
    approved,
  });
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
 * Edits everything staff assign on a banked entry.
 *
 * Changing the mod is the interesting case: it changes what the entry *is*,
 * so the figures are recalculated from the beatmap's nomod values and the
 * star rating is re-fetched. It can also collide, because a beatmap and mod
 * pair is unique, so that is checked before anything is written.
 */
export async function updateEntry(
  entryId: number,
  patch: {
    tier?: string;
    category?: string;
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
  if (patch.category) set.category = patch.category;
  if (patch.length !== undefined) set.lengthBucket = patch.length || null;
  if (patch.speed !== undefined) set.speedBucket = patch.speed || null;

  const nextMod = patch.mod ? normalizeMod(patch.mod) : null;
  if (nextMod && nextMod !== current.mod) {
    const clash = await db.query.entries.findFirst({
      where: and(eq(entries.beatmapId, current.beatmapId), eq(entries.mod, nextMod)),
    });
    if (clash) throw new Error("This map is already on the ladder under " + nextMod);

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
  await record(staff.id, staff.name ?? undefined, "entry.update", "entry", entryId, patch);

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

/**
 * Grants a role by osu! ID or username. Creates the local row when that
 * player has never signed in, so staff can be set up ahead of time.
 */
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

/* ------------------------------------------------------------------- sync */

export async function syncMyScores() {
  const session = await auth();
  if (!session?.user) throw new Error("Sign in first");
  const result = await syncUser(
    session.userId,
    session.osuUserId,
    session.osuAccessToken,
    { includeBest: true },
  );
  revalidatePath("/me");
  return result;
}
