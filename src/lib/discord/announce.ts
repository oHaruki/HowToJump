import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { describeScores, getEntriesByIds } from "@/lib/queries";
import { postChannel } from "@/lib/discord/api";
import {
  newEntriesMessage, recordsMessage, scoresMessage, type PlayerLike,
} from "@/lib/discord/embeds";

/**
 * What the site tells the server about on its own: every imported score,
 * every first place taken, and every map added to the bank. The bot posts
 * each in its own channel, and each stays quiet until one is named.
 */

/** A first place a sync took, for the channel that shouts about them. */
export type RecordTaken =
  | {
      kind: "map";
      entryId: number;
      grade: string;
      missCount: number;
      accuracy: number | null;
      /** Whoever held the place, or null when the map had no score. */
      previous: string | null;
    }
  | {
      kind: "overall";
      exp: number;
      tierOrder: number | null;
      progress: number | null;
      previous: string | null;
    };

/** The player a message is about, or null once they are gone. */
async function playerOf(userId: number): Promise<PlayerLike | null> {
  const [who] = await db
    .select({
      username: users.username,
      osuUserId: users.osuUserId,
      avatarUrl: users.avatarUrl,
      countryCode: users.countryCode,
    })
    .from(users)
    .where(eq(users.id, userId));
  return who ?? null;
}

/** Posts imported scores to the feed channel, if one is set up. Never throws. */
export async function announceScores(
  userId: number,
  imported: Array<{ entryId: number; grade: string; missCount: number; accuracy: number | null }>,
): Promise<void> {
  const channel = process.env.DISCORD_SCORES_CHANNEL_ID;
  if (!channel || !imported.length) return;
  try {
    const [who, lines] = await Promise.all([playerOf(userId), describeScores(imported)]);
    if (!who || !lines.length) return;
    await postChannel(channel, scoresMessage(who, lines));
  } catch {
    // The score is saved either way; the feed is a courtesy.
  }
}

/** Posts the first places a sync took, if a channel is set up. Never throws. */
export async function announceRecords(
  userId: number,
  records: RecordTaken[],
): Promise<void> {
  const channel = process.env.DISCORD_RECORDS_CHANNEL_ID;
  if (!channel || !records.length) return;
  try {
    const maps = records.filter((r) => r.kind === "map");
    const [who, lines] = await Promise.all([
      playerOf(userId),
      describeScores(
        maps.map((r) => ({
          entryId: r.entryId, grade: r.grade, missCount: r.missCount, accuracy: r.accuracy,
        })),
      ),
    ]);
    if (!who) return;

    const byEntry = new Map(lines.map((l) => [l.entryId, l]));
    const taken = maps.flatMap((r) => {
      const line = byEntry.get(r.entryId);
      return line ? [{ line, previous: r.previous }] : [];
    });
    const top = records.find((r) => r.kind === "overall");
    if (!taken.length && !top) return;
    await postChannel(
      channel,
      recordsMessage(who, taken, top ? { level: top, previous: top.previous } : null),
    );
  } catch {
    // The place stands whether or not the message lands.
  }
}

/** Posts maps just added to the bank, if a channel is set up. Never throws. */
export async function announceEntries(entryIds: number[]): Promise<void> {
  const channel = process.env.DISCORD_MAPS_CHANNEL_ID;
  if (!channel || !entryIds.length) return;
  try {
    const rows = await getEntriesByIds(entryIds);
    if (rows.length) await postChannel(channel, newEntriesMessage(rows));
  } catch {
    // The maps are on the ladder either way.
  }
}
