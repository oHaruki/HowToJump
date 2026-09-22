import type { BankRow, ScoreLine } from "@/lib/queries";
import { entryName, gradeText } from "@/lib/queries";
import { playExp } from "@/lib/levels";
import { shortCategory, tierByOrder } from "@/lib/tiers";
import { clamp, fitLines, md, type Embed, type EmbedField, type Message } from "@/lib/discord/api";

/** Every message the bot sends, as the shapes Discord draws. */

/** The site's own address, or nothing when it is not configured. */
export function siteUrl(path: string): string | undefined {
  const base = (process.env.AUTH_URL ?? "").trim().replace(/\/+$/, "");
  return base ? base + path : undefined;
}

const osuUserUrl = (osuUserId: number) => "https://osu.ppy.sh/users/" + osuUserId;

type MapKeys = { osuBeatmapId: number; osuBeatmapsetId: number | null; mod: string };

const osuBeatmapUrl = (m: MapKeys) =>
  m.osuBeatmapsetId
    ? "https://osu.ppy.sh/beatmapsets/" + m.osuBeatmapsetId + "#osu/" + m.osuBeatmapId
    : "https://osu.ppy.sh/b/" + m.osuBeatmapId;

/** A map's page here, which shows the board, falling back to the one on osu!. */
function mapUrl(m: MapKeys): string {
  const mod = m.mod && m.mod !== "NM" ? "?mod=" + m.mod : "";
  return siteUrl("/beatmap/" + m.osuBeatmapId + mod) ?? osuBeatmapUrl(m);
}

/** The small square cover a set has, which is the size a thumbnail wants. */
function cover(osuBeatmapsetId: number | null): { url: string } | undefined {
  if (!osuBeatmapsetId) return undefined;
  return { url: "https://assets.ppy.sh/beatmaps/" + osuBeatmapsetId + "/covers/list.jpg" };
}

/** A pack's colour, as Discord takes one. */
export function tierColor(tierOrder: number | null | undefined): number {
  return parseInt((tierByOrder(tierOrder)?.color ?? "#777777").slice(1), 16);
}

export const fmt = (n: number) => Math.round(n).toLocaleString("en");

const stars = (n: number | null) => (n == null ? "?" : n.toFixed(2) + "★");

/** How far through a pack, drawn as a bar. */
export function levelBar(progress: number | null | undefined): string {
  const filled = Math.round(Math.min(99, Math.max(0, progress ?? 0)) / 10);
  return "▰".repeat(filled) + "▱".repeat(10 - filled);
}

/** "Diamond 62/100%", or where a level sits before the first pack. */
export function levelText(level: { tierOrder: number | null; progress: number | null }): string {
  const pack = tierByOrder(level.tierOrder);
  if (!pack) return "Unranked";
  return pack.name + (level.progress == null ? "" : " " + level.progress + "/100%");
}

type NameKeys = { title: string; version: string | null; mod: string };

/** "Artist - Title [Diff] +DT", the way an embed heads a map. */
function mapTitle(m: NameKeys & { artist?: string | null }): string {
  return (m.artist ? m.artist + " - " : "") + entryName(m);
}

/** A player as any message about them reads it. */
export type PlayerLike = {
  username: string;
  osuUserId: number;
  avatarUrl: string | null;
  countryCode: string | null;
};

/** The line a message about a player is headed with. */
export function playerAuthor(p: PlayerLike, note?: string) {
  const country = p.countryCode ? " (" + p.countryCode.toUpperCase() + ")" : "";
  return {
    name: p.username + country + (note ? " · " + note : ""),
    url: siteUrl("/u/" + p.osuUserId) ?? osuUserUrl(p.osuUserId),
    icon_url: p.avatarUrl ?? undefined,
  };
}

/** What a play is worth, which is the number every list here ranks by. */
const scoreExp = (s: ScoreLine) =>
  playExp(s.tierOrder, s.grade, s.missCount, s.noteCount, s.accuracy);

const categoryText = (categories: string[]) =>
  categories.map((c) => shortCategory(c)).join(" + ") || "Unjudged";

/** One score as a line: map, grade, pack and what it is worth. */
export function scoreLine(s: ScoreLine): string {
  const pack = tierByOrder(s.tierOrder)?.name ?? "?";
  const worth = fmt(scoreExp(s)) + " EXP";
  return md(entryName(s)) + " · " + gradeText(s) + " · " + pack + " · " + worth;
}

/* ------------------------------------------------------------ the feed */

/** One score, the way the feed and /sync both draw it. */
export function scoreEmbed(who: PlayerLike, s: ScoreLine): Embed {
  const skills = categoryText(s.categories);
  const mapper = s.mapper ? " · mapped by " + s.mapper : "";
  return {
    color: tierColor(s.tierOrder),
    author: playerAuthor(who),
    title: mapTitle(s),
    url: mapUrl(s),
    thumbnail: cover(s.osuBeatmapsetId),
    fields: [
      { name: "Grade", value: gradeText(s), inline: true },
      { name: "EXP", value: fmt(scoreExp(s)), inline: true },
      { name: "Pack", value: tierByOrder(s.tierOrder)?.name ?? "?", inline: true },
    ],
    footer: { text: stars(s.stars) + " · " + skills + mapper },
  };
}

/** Past this many, a sync's imports are listed rather than drawn one by one. */
const SCORES_DRAWN = 5;

/** A sync's imports: an embed each, or one digest when there are many. */
export function scoresMessage(who: PlayerLike, lines: ScoreLine[]): Message {
  if (lines.length <= SCORES_DRAWN) return { embeds: lines.map((s) => scoreEmbed(who, s)) };
  const best = lines.reduce((m, s) => Math.max(m, s.tierOrder), 0);
  return {
    embeds: [
      {
        color: tierColor(best),
        author: playerAuthor(who),
        title: lines.length + " new scores",
        url: siteUrl("/u/" + who.osuUserId),
        description: fitLines(lines.map(scoreLine)),
      },
    ],
  };
}

/* ---------------------------------------------------------- recent play */

/** A player's newest play as /rs draws it, on a bank map or not. */
export type RecentPlay = {
  osuBeatmapId: number;
  osuBeatmapsetId: number | null;
  artist: string | null;
  title: string;
  version: string | null;
  mapper: string | null;
  /** The mods as played, for the title: "HDDT", or "NM" for none. */
  mod: string;
  stars: number | null;
  /** The entry it landed on, when the map is in the bank under these mods. */
  entry: { mod: string; tierOrder: number; categories: string[] } | null;
  passed: boolean;
  grade: string;
  missCount: number;
  accuracy: number;
  combo: number;
  mapCombo: number | null;
  /** How much of the map a fail got through, in percent. */
  completion: number | null;
  playedAt: Date | null;
  /** What a pass on a bank entry is worth. */
  exp: number | null;
  /** Where the play stands: on the profile, not yet, or why it does not count. */
  note: string;
};

/** A player's newest play, for /rs. */
export function recentEmbed(who: PlayerLike, p: RecentPlay): Embed {
  const result = p.passed
    ? gradeText(p)
    : "Failed" + (p.completion == null ? "" : " at " + Math.floor(p.completion) + "%");
  const combo = fmt(p.combo) + "x" + (p.mapCombo ? " / " + fmt(p.mapCombo) + "x" : "");
  const fields: EmbedField[] = [
    { name: "Grade", value: result, inline: true },
    { name: "Accuracy", value: p.accuracy.toFixed(2) + "%", inline: true },
    { name: "Combo", value: combo, inline: true },
  ];
  if (p.entry) {
    fields.push(
      { name: "EXP", value: p.exp == null ? "—" : fmt(p.exp), inline: true },
      { name: "Pack", value: tierByOrder(p.entry.tierOrder)?.name ?? "?", inline: true },
    );
  }
  if (p.playedAt) {
    const at = Math.floor(p.playedAt.getTime() / 1000);
    fields.push({ name: "Played", value: "<t:" + at + ":R>", inline: true });
  }
  const skills = p.entry ? " · " + categoryText(p.entry.categories) : "";
  const mapper = p.mapper ? " · mapped by " + p.mapper : "";
  return {
    color: tierColor(p.entry?.tierOrder),
    author: playerAuthor(who, "most recent"),
    title: mapTitle(p),
    url: p.entry ? mapUrl({ ...p, mod: p.entry.mod }) : osuBeatmapUrl(p),
    thumbnail: cover(p.osuBeatmapsetId),
    description: p.note,
    fields,
    footer: { text: stars(p.stars) + skills + mapper },
  };
}

/* --------------------------------------------------------- first places */

/** Somebody taking a map's first place. */
export function mapRecordEmbed(who: PlayerLike, s: ScoreLine, previous: string | null): Embed {
  return {
    color: tierColor(s.tierOrder),
    author: playerAuthor(who, "new #1"),
    title: "🥇 " + mapTitle(s),
    url: mapUrl(s),
    thumbnail: cover(s.osuBeatmapsetId),
    description: previous
      ? "Took the lead from **" + md(previous) + "**."
      : "First score on the map.",
    fields: [
      { name: "Grade", value: gradeText(s), inline: true },
      { name: "EXP", value: fmt(scoreExp(s)), inline: true },
      { name: "Pack", value: tierByOrder(s.tierOrder)?.name ?? "?", inline: true },
    ],
    footer: { text: stars(s.stars) + " · " + categoryText(s.categories) },
  };
}

/** Somebody taking the top of the overall ranking. */
export function overallRecordEmbed(
  who: PlayerLike,
  level: { exp: number; tierOrder: number | null; progress: number | null },
  previous: string | null,
): Embed {
  const passed = previous ? ", past **" + md(previous) + "**" : "";
  return {
    color: tierColor(level.tierOrder),
    author: playerAuthor(who, "new #1"),
    title: "👑 #1 overall",
    url: siteUrl("/leaderboard"),
    thumbnail: who.avatarUrl ? { url: who.avatarUrl } : undefined,
    description:
      levelBar(level.progress) +
      " **" +
      levelText(level) +
      "**\n**" +
      fmt(level.exp) +
      " EXP**" +
      passed,
  };
}

/* ------------------------------------------------------------- new maps */

const nameOf = (r: BankRow): NameKeys => ({
  title: r.title ?? "Untitled",
  version: r.version,
  mod: r.mod,
});

/** One map just added to the bank. */
function newEntryEmbed(r: BankRow): Embed {
  const pack = tierByOrder(r.tierOrder);
  const mapper = r.mapper ? "mapped by " + r.mapper : "";
  const judge = r.judgedByName ? (mapper ? " · " : "") + "judged by " + r.judgedByName : "";
  return {
    color: tierColor(r.tierOrder),
    author: { name: "New in " + (pack?.name ?? "the bank"), url: siteUrl("/maps") },
    title: entryName(nameOf(r)),
    url: mapUrl(r),
    thumbnail: cover(r.osuBeatmapsetId),
    fields: [
      { name: "Pack", value: pack?.name ?? "?", inline: true },
      { name: "Stars", value: stars(r.stars), inline: true },
      { name: "BPM", value: r.bpm == null ? "?" : String(Math.round(r.bpm)), inline: true },
      { name: "Length", value: r.drain || "?", inline: true },
      { name: "AR", value: r.ar == null ? "?" : r.ar.toFixed(1), inline: true },
      { name: "Skills", value: categoryText(r.categories), inline: true },
    ],
    footer: { text: mapper + judge },
  };
}

/** Past this many, new maps are listed rather than drawn one by one. */
const ENTRIES_DRAWN = 4;

/** Maps just added to the bank: an embed each, or a digest when there are many. */
export function newEntriesMessage(rows: BankRow[]): Message {
  if (rows.length <= ENTRIES_DRAWN) return { embeds: rows.map(newEntryEmbed) };

  const byPack = new Map<number, BankRow[]>();
  for (const r of rows) byPack.set(r.tierOrder, [...(byPack.get(r.tierOrder) ?? []), r]);
  const lines = [...byPack.entries()]
    .sort((a, b) => b[0] - a[0])
    .flatMap(([tierOrder, packRows]) => [
      "**" + (tierByOrder(tierOrder)?.name ?? "?") + "**",
      ...packRows.map((r) => "• " + md(entryName(nameOf(r))) + " · " + stars(r.stars)),
    ]);

  return {
    embeds: [
      {
        color: tierColor(Math.max(...rows.map((r) => r.tierOrder))),
        author: { name: "New in the bank", url: siteUrl("/maps") },
        title: rows.length + " maps added",
        url: siteUrl("/maps"),
        description: fitLines(lines),
      },
    ],
  };
}

/* -------------------------------------------------------------- profile */

export type LevelState = { exp: number; tierOrder: number | null; progress: number | null };

/** Everything /profile draws, gathered by the caller. */
export type ProfileFacts = {
  player: PlayerLike;
  /** The main level, then one per category the grading team judges on. */
  main: LevelState;
  categories: Array<{ scope: string; level: LevelState }>;
  rank: number | null;
  tally: { clears: number; fcs: number; sss: number; ss: number; s: number };
  /** The highest pack the player has a score on. */
  hardest: number | null;
  top: ScoreLine | null;
  footer: string;
};

export function profileEmbed(f: ProfileFacts): Embed {
  const fields = f.categories.map((c) => ({
    name: shortCategory(c.scope),
    value: "**" + levelText(c.level) + "**",
    inline: true,
  }));

  fields.push(
    {
      name: "Clears",
      value: fmt(f.tally.clears) + " · " + fmt(f.tally.fcs) + " FC",
      inline: true,
    },
    {
      name: "Grades",
      value: "SSS " + f.tally.sss + " · SS " + f.tally.ss + " · S " + f.tally.s,
      inline: true,
    },
    { name: "Hardest pack", value: tierByOrder(f.hardest)?.name ?? "—", inline: true },
  );

  if (f.top) {
    const link = "[" + clamp(md(entryName(f.top)), 120) + "](" + mapUrl(f.top) + ")";
    fields.push({
      name: "Top play",
      value:
        link +
        "\n" +
        gradeText(f.top) +
        " · " +
        (tierByOrder(f.top.tierOrder)?.name ?? "?") +
        " · " +
        fmt(scoreExp(f.top)) +
        " EXP",
      inline: false,
    });
  }

  return {
    color: tierColor(f.main.tierOrder),
    author: playerAuthor(f.player, f.rank ? "#" + f.rank + " overall" : "unranked"),
    title: "Main level · " + levelText(f.main),
    url: siteUrl("/u/" + f.player.osuUserId),
    thumbnail: f.player.avatarUrl ? { url: f.player.avatarUrl } : undefined,
    description: levelBar(f.main.progress) + " **" + fmt(f.main.exp) + " EXP**",
    fields,
    footer: { text: f.footer },
  };
}

/** Past this many, a sync's first places are listed rather than drawn one by one. */
const RECORDS_DRAWN = 5;

/**
 * The first places one sync took. A player's first sync can sweep a lot of
 * maps nobody has played yet, so past a handful they become one list.
 */
export function recordsMessage(
  who: PlayerLike,
  maps: Array<{ line: ScoreLine; previous: string | null }>,
  overall: { level: LevelState; previous: string | null } | null,
): Message {
  const embeds: Embed[] = [];
  if (overall) embeds.push(overallRecordEmbed(who, overall.level, overall.previous));

  if (maps.length <= RECORDS_DRAWN) {
    embeds.push(...maps.map((m) => mapRecordEmbed(who, m.line, m.previous)));
  } else {
    embeds.push({
      color: tierColor(Math.max(...maps.map((m) => m.line.tierOrder))),
      author: playerAuthor(who, "new #1"),
      title: "🥇 " + maps.length + " first places",
      url: siteUrl("/u/" + who.osuUserId),
      description: fitLines(maps.map((m) => scoreLine(m.line))),
    });
  }
  return { embeds };
}
