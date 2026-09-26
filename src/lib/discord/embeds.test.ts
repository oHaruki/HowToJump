/**
 * Run with: node --import tsx --test src/lib/discord/embeds.test.ts
 *
 * The shapes the bot sends. Nothing here connects: the builders are given
 * rows and return the JSON Discord draws.
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { BankRow, ScoreLine } from "../queries";
import type { RecentPlay } from "./embeds";

process.env.DATABASE_URL ??= "postgres://unused:unused@127.0.0.1:5432/unused";
process.env.AUTH_URL = "https://howtojump.test";

const E = await import("./embeds");
const { trimEmbed, EMBED_LIMITS } = await import("./api");

const who = { username: "Kayrem", osuUserId: 7, avatarUrl: "https://a.test/7.png", countryCode: "de" };

const score = (over: Partial<ScoreLine> = {}): ScoreLine => ({
  entryId: 1,
  osuBeatmapId: 100,
  osuBeatmapsetId: 200,
  artist: "Camellia",
  title: "Ghost",
  version: "Extra",
  mapper: "Sotarks",
  mod: "NM",
  tierOrder: 10,
  pack: null,
  categories: ["Aim - raw mechanic"],
  stars: 7.5,
  noteCount: 1000,
  grade: "S",
  missCount: 0,
  accuracy: null,
  ...over,
});

const row =(over: Partial<BankRow> = {}): BankRow => ({
  entryId: 1,
  osuBeatmapId: 100,
  osuBeatmapsetId: 200,
  title: "Ghost",
  version: "Extra",
  mapper: "Sotarks",
  listUrl: null,
  cardUrl: null,
  mod: "NM",
  tierOrder: 10,
  pack: null,
  categories: ["Aim - raw mechanic"],
  lengthBucket: "Medium",
  speedBucket: "High",
  stars: 7.5,
  bpm: 200,
  drainSeconds: 130,
  drain: "2:10",
  cs: 4,
  ar: 9.8,
  od: 9,
  judgedByName: "Kayrem",
  isActive: true,
  ...over,
});

const many = <T>(n: number, make: (i: number) => T) => Array.from({ length: n }, (_, i) => make(i));

test("a bar fills in tenths of the way through a pack", () => {
  assert.equal(E.levelBar(0), "▱".repeat(10));
  assert.equal(E.levelBar(50), "▰".repeat(5) + "▱".repeat(5));
  // Capped at 99, so a full bar never reads as the next pack.
  assert.equal(E.levelBar(99), "▰".repeat(10));
  assert.equal(E.levelBar(null), "▱".repeat(10));
});

test("a level reads as its pack and how far through it is", () => {
  assert.equal(E.levelText({ tierOrder: 15, progress: 62 }), "Diamond 62/100%");
  assert.equal(E.levelText({ tierOrder: 16, progress: null }), "GOAT");
  assert.equal(E.levelText({ tierOrder: null, progress: 0 }), "Unranked");
});

test("a few imports are drawn one by one, and many become one list", () => {
  const few = E.scoresMessage(who, many(5, (i) => score({ entryId: i })));
  assert.equal(few.embeds?.length, 5);
  assert.equal(few.embeds?.[0].title, "Camellia - Ghost [Extra]");

  const lots = E.scoresMessage(who, many(6, (i) => score({ entryId: i })));
  assert.equal(lots.embeds?.length, 1);
  assert.equal(lots.embeds?.[0].title, "6 new scores");
});

test("a score names its pack, its grade and what it is worth", () => {
  const [embed] = E.scoreEmbed(who, score({ grade: "SS", missCount: 0 })).fields ?? [];
  assert.equal(embed.name, "Grade");
  assert.equal(embed.value, "SS (FC)");
  const worth = E.scoreEmbed(who, score()).fields?.find((f) => f.name === "EXP");
  assert.ok(Number(worth?.value.replace(/,/g, "")) > 0);
});

const event = { id: 3, name: "Summer Event", color: "#ff8800" };

test("a score in a special pack names it beside its pack, worth the same EXP", () => {
  const ladder = E.scoreEmbed(who, score());
  const embed = E.scoreEmbed(who, score({ pack: event }));
  assert.equal(embed.color, 0xff8800);
  const value = (e: typeof embed, name: string) => e.fields?.find((f) => f.name === name)?.value;
  assert.equal(value(embed, "Pack"), "Summer Event (Topaz)");
  assert.equal(value(embed, "EXP"), value(ladder, "EXP"));
  assert.match(E.scoreLine(score({ pack: event })), /Summer Event \(Topaz\) · [\d,]+ EXP$/);
});

const recent = (over: Partial<RecentPlay> = {}): RecentPlay => ({
  osuBeatmapId: 100,
  osuBeatmapsetId: 200,
  artist: "Camellia",
  title: "Ghost",
  version: "Extra",
  mapper: "Sotarks",
  mod: "HDDT",
  stars: 7.5,
  entry: { mod: "DT", tierOrder: 10, pack: null, categories: ["Aim - raw mechanic"] },
  passed: true,
  grade: "A",
  missCount: 2,
  accuracy: 97.126,
  combo: 812,
  mapCombo: 1204,
  completion: null,
  playedAt: new Date("2026-09-23T10:00:00Z"),
  exp: 11640,
  note: "On their profile.",
  ...over,
});

test("a recent play on a bank map shows its grade, EXP and pack, and links to its board", () => {
  const embed = E.recentEmbed(who, recent());
  // The title keeps the mods as played; the link goes to the entry they landed on.
  assert.equal(embed.title, "Camellia - Ghost [Extra] +HDDT");
  assert.equal(embed.url, "https://howtojump.test/beatmap/100?mod=DT");
  assert.equal(embed.color, E.tierColor(10));
  assert.equal(embed.author?.name, "Kayrem (DE) · most recent");
  assert.equal(embed.description, "On their profile.");
  assert.deepEqual(embed.fields?.map((f) => f.name), ["Grade", "Accuracy", "Combo", "EXP", "Pack", "Played"]);
  const value = (name: string) => embed.fields?.find((f) => f.name === name)?.value;
  assert.equal(value("Grade"), "A (2 misses)");
  assert.equal(value("Accuracy"), "97.13%");
  assert.equal(value("Combo"), "812x / 1,204x");
  assert.equal(value("EXP"), "11,640");
  assert.equal(value("Pack"), "Topaz");
  assert.equal(value("Played"), "<t:" + Date.parse("2026-09-23T10:00:00Z") / 1000 + ":R>");
});

test("a fail says how far it got, and a map off the bank carries no EXP or pack", () => {
  const fail = E.recentEmbed(who, recent({ passed: false, completion: 63.8, exp: null }));
  assert.equal(fail.fields?.find((f) => f.name === "Grade")?.value, "Failed at 63%");

  const off = E.recentEmbed(
    who,
    recent({ entry: null, exp: null, mapCombo: null, note: "Not a bank map, so it doesn't count." }),
  );
  assert.deepEqual(off.fields?.map((f) => f.name), ["Grade", "Accuracy", "Combo", "Played"]);
  assert.equal(off.url, "https://osu.ppy.sh/beatmapsets/200#osu/100");
  assert.equal(off.color, E.tierColor(null));
  assert.equal(off.fields?.find((f) => f.name === "Combo")?.value, "812x");
});

test("a few new maps are drawn one by one, and many are listed by pack", () => {
  const few = E.newEntriesMessage(many(4, (i) => row({ entryId: i })));
  assert.equal(few.embeds?.length, 4);
  assert.equal(few.embeds?.[0].title, "Ghost [Extra]");

  const lots = E.newEntriesMessage([
    ...many(3, (i) => row({ entryId: i, tierOrder: 10 })),
    ...many(3, (i) => row({ entryId: 10 + i, tierOrder: 15, title: "Blue Zenith" })),
  ]);
  assert.equal(lots.embeds?.length, 1);
  assert.equal(lots.embeds?.[0].title, "6 maps added");
  const text = lots.embeds?.[0].description ?? "";
  // Hardest pack heads the list, the way the bank itself is ordered.
  assert.ok(text.indexOf("Diamond") < text.indexOf("Topaz"));
});

test("new maps in a special pack are listed after the ladder's, and link to the pack", () => {
  const one = E.newEntriesMessage([row({ pack: event })]);
  assert.equal(one.embeds?.[0].author?.name, "New in Summer Event");
  assert.equal(one.embeds?.[0].author?.url, "https://howtojump.test/packs/3");

  const lots = E.newEntriesMessage([
    ...many(3, (i) => row({ entryId: i, tierOrder: 15, pack: event })),
    ...many(3, (i) => row({ entryId: 10 + i, tierOrder: 2 })),
  ]);
  const text = lots.embeds?.[0].description ?? "";
  assert.ok(text.indexOf("Copper") < text.indexOf("Summer Event"));
});

test("the overall place is drawn above the maps, and says who was passed", () => {
  const message = E.recordsMessage(
    who,
    [{ line: score(), previous: "Someone" }],
    { level: { exp: 500, tierOrder: 12, progress: 30 }, previous: "Rival" },
  );
  assert.equal(message.embeds?.length, 2);
  assert.equal(message.embeds?.[0].title, "👑 #1 overall");
  assert.ok(message.embeds?.[0].description?.includes("Rival"));
  assert.ok(message.embeds?.[1].description?.includes("Took the lead from **Someone**"));
});

test("a map nobody had played says so rather than naming a holder", () => {
  const embed = E.mapRecordEmbed(who, score(), null);
  assert.equal(embed.description, "First score on the map.");
});

test("a sweep of first places becomes one list rather than an embed each", () => {
  const maps = many(6, (i) => ({ line: score({ entryId: i }), previous: null }));
  const message = E.recordsMessage(who, maps, null);
  assert.equal(message.embeds?.length, 1);
  assert.equal(message.embeds?.[0].title, "🥇 6 first places");
});

test("a profile carries a level per category, the tallies and the best play", () => {
  const embed = E.profileEmbed({
    player: who,
    main: { exp: 12345, tierOrder: 12, progress: 40 },
    categories: [
      { scope: "Aim - consistency", level: { exp: 1, tierOrder: 11, progress: 5 } },
      { scope: "Precision", level: { exp: 0, tierOrder: null, progress: 0 } },
    ],
    rank: 3,
    tally: { clears: 128, fcs: 20, sss: 1, ss: 2, s: 3 },
    hardest: 15,
    top: score(),
    footer: "Synced just now",
  });

  assert.equal(embed.title, "Main level · Sapphire 40/100%");
  assert.equal(embed.author?.name, "Kayrem (DE) · #3 overall");
  const names = embed.fields?.map((f) => f.name) ?? [];
  assert.deepEqual(names, ["Consistency", "Precision", "Clears", "Grades", "Hardest pack", "Top play"]);
  assert.equal(embed.fields?.find((f) => f.name === "Precision")?.value, "**Unranked**");
  assert.equal(embed.fields?.find((f) => f.name === "Hardest pack")?.value, "Diamond");
});

test("a name carrying markdown is escaped, so it reads as itself", () => {
  const embed = E.mapRecordEmbed(who, score(), "some_name_here");
  assert.ok(embed.description?.includes("some\_name\_here"));
});

test("every link is absolute, since Discord drops anything else", () => {
  const links = (v: unknown): string[] =>
    typeof v !== "object" || v === null
      ? []
      : Object.entries(v).flatMap(([k, x]) =>
          (k === "url" || k === "icon_url") && typeof x === "string" ? [x] : links(x),
        );

  const site = E.newEntriesMessage([row()]);
  for (const url of links(site)) assert.match(url, /^https:\/\//);

  // With no address configured the site's own links are left out entirely.
  delete process.env.AUTH_URL;
  try {
    const bare = E.scoresMessage(who, [score()]);
    for (const url of links(bare)) assert.match(url, /^https:\/\//);
    assert.equal(bare.embeds?.[0].url, "https://osu.ppy.sh/beatmapsets/200#osu/100");
  } finally {
    process.env.AUTH_URL = "https://howtojump.test";
  }
});

test("an embed is cut to the sizes Discord accepts", () => {
  const long = "x".repeat(5000);
  const cut = trimEmbed({
    title: long,
    description: long,
    author: { name: long },
    footer: { text: long },
    fields: [{ name: long, value: long }],
  });
  assert.equal(cut.title?.length, EMBED_LIMITS.title);
  assert.equal(cut.description?.length, EMBED_LIMITS.description);
  assert.equal(cut.author?.name.length, EMBED_LIMITS.author);
  assert.equal(cut.footer?.text.length, EMBED_LIMITS.footer);
  assert.equal(cut.fields?.[0].value.length, EMBED_LIMITS.fieldValue);
});
