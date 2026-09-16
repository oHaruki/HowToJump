"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  auditLog, beatmaps, entries, suggestionBatches, suggestions, users,
} from "@/lib/schema";
import { auth, requireAdmin, requireStaff } from "@/lib/auth";
import { fetchBeatmaps, type BeatmapFacts } from "@/lib/osu/client";
import { syncUser } from "@/lib/osu/sync";
import { normalizeMod } from "@/lib/mods";
import { tierByName } from "@/lib/tiers";
import { classify, parsePaste, rowFromLink, type ParsedRow } from "@/lib/import/parse";
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

/* ---------------------------------------------------------------- preview */

export type PreviewRow = Omit<ParsedRow, "tierObj"> & {
  tierOrder: number | null;
  apiStars: number | null;
  apiTitle: string | null;
};

/**
 * Parses a paste, then enriches every difficulty ID against the osu! API in
 * batches of 50, so the sheet's numbers get checked against the real ones and
 * mapper, cover art and ranked status fill themselves in.
 */
export async function previewPaste(
  text: string,
  defaults?: { tier?: string; category?: string; mod?: string },
  asLinks?: boolean,
): Promise<{ mode: string | null; rows: PreviewRow[] }> {
  await requireStaff();

  const parsed = asLinks
    ? { mode: "links" as string | null, rows: [rowFromLink(text, defaults)] }
    : parsePaste(text);

  const existing = await getExistingEntryKeys();
  classify(parsed.rows, existing);

  const ids = parsed.rows
    .map((r) => r.beatmapId)
    .filter((n): n is number => typeof n === "number");

  let facts = new Map<number, BeatmapFacts>();
  try {
    facts = await fetchBeatmaps(ids);
  } catch {
    // A lookup failure must not lose the paste. Rows keep the sheet's values.
  }

  const rows: PreviewRow[] = parsed.rows.map((r) => {
    const f = r.beatmapId ? facts.get(r.beatmapId) : undefined;
    const { tierObj, ...rest } = r;
    return {
      ...rest,
      tierOrder: tierObj ? tierObj.order : null,
      // Prefer what osu! says over what the sheet says.
      title: f?.title || r.title,
      version: f?.version || r.version,
      mapper: f?.mapper || r.mapper,
      beatmapsetId: f?.osuBeatmapsetId ?? r.beatmapsetId,
      stars: r.stars ?? f?.stars ?? null,
      bpm: r.bpm ?? f?.bpm ?? null,
      drainSeconds: r.drainSeconds ?? f?.drainSeconds ?? null,
      cs: r.cs ?? f?.cs ?? null,
      ar: r.ar ?? f?.ar ?? null,
      od: r.od ?? f?.od ?? null,
      apiStars: f?.stars ?? null,
      apiTitle: f?.title ?? null,
    };
  });

  return { mode: parsed.mode, rows };
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

export async function moveEntryTier(entryId: number, tierName: string) {
  const staff = await requireStaff();
  const t = tierByName(tierName);
  if (!t) return;
  await db
    .update(entries)
    .set({ tierOrder: t.order, updatedAt: new Date() })
    .where(eq(entries.id, entryId));
  await record(staff.id, staff.name ?? undefined, "entry.move", "entry", entryId, {
    tier: t.name,
  });
  revalidatePath("/staff/bank");
  revalidatePath("/maps");
  revalidatePath("/ladder");
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
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
  await record(admin.id, admin.name ?? undefined, "user.role", "user", userId, { role });
  revalidatePath("/staff/members");
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
