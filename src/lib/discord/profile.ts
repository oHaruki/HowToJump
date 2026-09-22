import { eq, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import { userLevels, users } from "@/lib/schema";
import {
  getPlayerTallies, getProfilePlays, getRankOf, type ScoreLine,
} from "@/lib/queries";
import { MAIN_LEVEL } from "@/lib/levels";
import { profileLists, snapshotOf } from "@/lib/progress";
import { CATEGORIES } from "@/lib/tiers";
import { timeAgo } from "@/lib/time";
import { md, type Message } from "@/lib/discord/api";
import { profileEmbed } from "@/lib/discord/embeds";

/** What every command starts from: a player, by their osu! name. */

/**
 * A player by name, matched exactly but ignoring case. ilike would treat
 * the underscores common in osu! names as wildcards.
 */
export async function findPlayer(name: string) {
  const [user] = await db
    .select({
      id: users.id,
      osuUserId: users.osuUserId,
      username: users.username,
      avatarUrl: users.avatarUrl,
      countryCode: users.countryCode,
      lastSyncedAt: users.lastSyncedAt,
      syncEnabled: users.syncEnabled,
      bannedAt: users.bannedAt,
    })
    .from(users)
    .where(raw`lower(${users.username}) = lower(${name})`)
    .limit(1);
  return user ?? null;
}

/** What the bot says about a name nobody on the site answers to. */
export function unknownPlayer(name: string): string {
  return "**" + md(name) + "** hasn't connected their osu! account on the site yet.";
}

/** Everything /profile shows: the levels, the tallies and the best play. */
export async function profileReply(name: string): Promise<Message> {
  if (!name) return { content: "Give an osu! name: `/profile player:<name>`" };

  const user = await findPlayer(name);
  if (!user) return { content: unknownPlayer(name) };
  if (user.bannedAt) return { content: "**" + md(user.username) + "** isn't being tracked." };

  const [levelRows, standing, tallies, plays] = await Promise.all([
    db.select().from(userLevels).where(eq(userLevels.userId, user.id)),
    getRankOf(user.id, MAIN_LEVEL),
    getPlayerTallies([user.id]),
    getProfilePlays(user.id),
  ]);

  const levels = snapshotOf(levelRows);
  const best = profileLists(plays, null).top[0];
  const top: ScoreLine | null = best
    ? {
        entryId: best.entryId,
        osuBeatmapId: best.osuBeatmapId,
        osuBeatmapsetId: best.osuBeatmapsetId,
        // The profile names a play the way the bank does, without the artist.
        artist: null,
        title: best.title,
        version: best.version,
        mapper: best.mapper,
        mod: best.mod,
        tierOrder: best.tierOrder,
        categories: best.categories,
        stars: best.stars,
        noteCount: best.noteCount,
        grade: best.grade,
        missCount: best.missCount,
        accuracy: best.accuracy,
      }
    : null;

  return {
    embeds: [
      profileEmbed({
        player: user,
        main: levels[MAIN_LEVEL],
        categories: CATEGORIES.map((scope) => ({ scope, level: levels[scope] })),
        rank: standing?.rank ?? null,
        tally: tallies.get(user.id) ?? { clears: 0, fcs: 0, sss: 0, ss: 0, s: 0 },
        hardest: plays.reduce((m, p) => Math.max(m, p.tierOrder), 0) || null,
        top,
        footer: user.syncEnabled
          ? "Synced " + timeAgo(user.lastSyncedAt)
          : "Not being tracked",
      }),
    ],
  };
}
