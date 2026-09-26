import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { beatmaps, entries, packs, scores } from "@/lib/schema";
import { completionOf, fetchLatestScore, toPlay, type OsuScore, type PlayFacts } from "@/lib/osu/client";
import { compareResults, gradeFor, gradeRank } from "@/lib/grading";
import { playExp } from "@/lib/levels";
import type { SpecialPack } from "@/lib/packs";
import { modsAsPlayed, modsText, normalizeMod } from "@/lib/mods";
import { gradeText, isDeletedScore } from "@/lib/queries";
import { md, type Message } from "@/lib/discord/api";
import { recentEmbed, type RecentPlay } from "@/lib/discord/embeds";
import { findPlayer, unknownPlayer } from "@/lib/discord/profile";

/** /rs: a player's newest play, read from osu! as it stands. Nothing is stored. */
export async function recentReply(name: string): Promise<Message> {
  if (!name) return { content: "Give an osu! name: `/rs player:<name>`" };

  const user = await findPlayer(name);
  if (!user) return { content: unknownPlayer(name) };
  const who = "**" + md(user.username) + "**";
  if (!user.syncEnabled || user.bannedAt) return { content: who + " isn't being tracked." };

  const score = await fetchLatestScore(user.osuUserId);
  if (!score) return { content: who + " hasn't played in the last 24 hours." };
  return { embeds: [recentEmbed(user, await describeRecent(user.id, score))] };
}

type Banked = {
  id: number;
  mod: string;
  tierOrder: number;
  pack: SpecialPack | null;
  categories: string[];
  stars: number | null;
  artist: string | null;
  title: string;
  version: string | null;
  mapper: string | null;
  osuBeatmapsetId: number | null;
  noteCount: number | null;
  maxCombo: number | null;
};

/** Everything the embed shows, from the bank where the map is in it and from osu! where not. */
export async function describeRecent(userId: number, score: OsuScore): Promise<RecentPlay> {
  const play = toPlay(score);
  const grade = gradeFor({ missCount: play.missCount, isFc: play.isFc, isPerfect: play.isPerfect });
  const banked: Banked[] = await db
    .select({
      id: entries.id,
      mod: entries.mod,
      tierOrder: entries.tierOrder,
      pack: { id: packs.id, name: packs.name, color: packs.color },
      categories: entries.categories,
      stars: entries.stars,
      artist: beatmaps.artist,
      title: beatmaps.title,
      version: beatmaps.version,
      mapper: beatmaps.mapper,
      osuBeatmapsetId: beatmaps.osuBeatmapsetId,
      noteCount: beatmaps.noteCount,
      maxCombo: beatmaps.maxCombo,
    })
    .from(entries)
    .innerJoin(beatmaps, eq(entries.beatmapId, beatmaps.id))
    .leftJoin(packs, eq(entries.packId, packs.id))
    .where(and(eq(beatmaps.osuBeatmapId, play.osuBeatmapId), eq(entries.isActive, true)));

  const entry = banked.find((e) => normalizeMod(e.mod) === play.mods) ?? null;
  const known = entry ?? banked[0] ?? null;
  const map = score.beatmap;
  const set = score.beatmapset;
  const notes =
    known?.noteCount ??
    (map?.count_circles == null
      ? null
      : map.count_circles + (map.count_sliders ?? 0) + (map.count_spinners ?? 0));

  return {
    osuBeatmapId: play.osuBeatmapId,
    osuBeatmapsetId: known?.osuBeatmapsetId ?? set?.id ?? null,
    artist: known?.artist ?? set?.artist ?? null,
    title: known?.title ?? set?.title ?? "Beatmap " + play.osuBeatmapId,
    version: known?.version ?? map?.version ?? null,
    mapper: known?.mapper ?? set?.creator ?? null,
    mod: modsAsPlayed(score.mods),
    stars: entry ? entry.stars : (map?.difficulty_rating ?? null),
    entry: entry
      ? { mod: entry.mod, tierOrder: entry.tierOrder, pack: entry.pack, categories: entry.categories }
      : null,
    passed: play.passed,
    grade,
    missCount: play.missCount,
    accuracy: play.accuracy,
    combo: play.maxCombo,
    mapCombo: known?.maxCombo ?? null,
    completion: play.passed ? null : completionOf(score, notes),
    playedAt: play.playedAt,
    exp:
      entry && play.passed
        ? playExp(entry.tierOrder, grade, play.missCount, notes, play.accuracy)
        : null,
    note: await standing(userId, play, grade, entry, banked),
  };
}

/** One line on where the play stands against the bank and the player's profile. */
async function standing(
  userId: number,
  play: PlayFacts,
  grade: string,
  entry: Banked | null,
  banked: Banked[],
): Promise<string> {
  if (!entry) {
    if (!banked.length) return "Not a bank map, so it doesn't count.";
    const listed = modsText(banked.map((e) => normalizeMod(e.mod)));
    return "In the bank as " + listed + ", not " + modsText([play.mods]) + ", so it doesn't count.";
  }
  if (!play.passed) return "A fail, so it doesn't count.";
  if (play.refused) return "Played with " + play.refused + ", so it doesn't count.";
  if (await isDeletedScore(play.osuScoreId)) return "Deleted by an admin, so it doesn't count.";

  const best = await db.query.scores.findFirst({
    where: and(eq(scores.userId, userId), eq(scores.entryId, entry.id)),
    columns: { osuScoreId: true, grade: true, gradeRank: true, missCount: true, accuracy: true },
  });
  const where = entry.pack ? "the " + md(entry.pack.name) + " board" : "their profile";
  if (best && best.osuScoreId === play.osuScoreId) return "On " + where + ".";
  const candidate = { gradeRank: gradeRank(grade), missCount: play.missCount, accuracy: play.accuracy };
  if (best && compareResults(best, candidate) <= 0) {
    return "Their best here is still " + gradeText(best) + ".";
  }
  return "Not on " + where + " yet. It lands within a minute, or /sync pulls it in now.";
}
