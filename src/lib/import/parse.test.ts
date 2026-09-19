/**
 * Run with: node --import tsx --test src/lib/import/parse.test.ts
 *
 * Covers the cases that actually bite when reading the sheet: European
 * decimal commas, drain times, link shapes, and the fact that an entry is a
 * beatmap plus a mod rather than a beatmap alone.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  classify, drainToSeconds, extractBeatmapId, extractBeatmapsetId,
  normalizations, num, parsePaste, secondsToDrain, splitLine, splitTitle,
} from "./parse";
import { normalizeMod, modsFromApi } from "../mods";
import {
  CATEGORIES, LENGTHS, SPEEDS, isCategory, normalizeCategories, normalizeCategory,
  normalizeLength, normalizeSpeed, orderByScale,
} from "../tiers";
import { gradeFor } from "../grading";
import {
  applyMod, arToPreempt, preemptToAr, odToWindow, windowToOd,
  lengthBucketFor, speedGuessFor,
} from "../osu/modmath";

const T = "\t";
const HEADER = [
  "Link", "Main Category", "Length", "Speed", "Mod", "BG", "ID", "Mapper",
  "Title [Difficulty name]", "Stars", "BPM", "Drain", "CS", "AR", "OD", "Pack?", "Judgement",
].join(T);

const ROW_LUNATICON = [
  "https://osu.ppy.sh/beatmapsets/2209379#osu/4679115", "Raw Aim", "Long", "Medium",
  "NM", "", "4679115", "GranDSenpai", "Lunaticon [Relentless]",
  "9,92", "230", "3:10", "3,8", "10", "10", "Diamond", "Kayrem",
].join(T);

test("decimal commas are normalised, not truncated", () => {
  assert.equal(num("9,92"), 9.92);
  assert.equal(num("3,8"), 3.8);
  assert.equal(num("10"), 10);
  assert.equal(num(""), null);
  assert.equal(num("   "), null);
  assert.equal(num("not a number"), null);
});

test("drain times round trip", () => {
  assert.equal(drainToSeconds("3:10"), 190);
  assert.equal(drainToSeconds("1:06"), 66);
  assert.equal(drainToSeconds("4:12"), 252);
  assert.equal(drainToSeconds("bad"), null);
  assert.equal(secondsToDrain(190), "3:10");
  assert.equal(secondsToDrain(66), "1:06");
});

test("difficulty IDs come out of every link shape", () => {
  assert.equal(extractBeatmapId("https://osu.ppy.sh/beatmapsets/2209379#osu/4679115"), 4679115);
  assert.equal(extractBeatmapId("https://osu.ppy.sh/b/479812"), 479812);
  assert.equal(extractBeatmapId("https://osu.ppy.sh/beatmaps/5066679"), 5066679);
  assert.equal(extractBeatmapId("5309916"), 5309916);
  // The ID column wins when present.
  assert.equal(extractBeatmapId("https://osu.ppy.sh/beatmapsets/2209379", "4679115"), 4679115);
  // A set link with no difficulty cannot resolve, and must not guess.
  assert.equal(extractBeatmapId("https://osu.ppy.sh/beatmapsets/2377969"), null);
  assert.equal(extractBeatmapsetId("https://osu.ppy.sh/beatmapsets/2209379#osu/4679115"), 2209379);
});

test("title and difficulty split apart", () => {
  assert.deepEqual(splitTitle("Lunaticon [Relentless]"), {
    title: "Lunaticon",
    version: "Relentless",
  });
  // Titles containing brackets keep everything but the trailing difficulty.
  assert.deepEqual(splitTitle("Bonfire (Cut Ver.) [Inferno]"), {
    title: "Bonfire (Cut Ver.)",
    version: "Inferno",
  });
  assert.deepEqual(splitTitle("No difficulty here"), {
    title: "No difficulty here",
    version: "",
  });
});

test("quoted CSV cells survive a comma in the title", () => {
  const cells = splitLine('a,"Hello, world",c', ",");
  assert.deepEqual(cells, ["a", "Hello, world", "c"]);
  const escaped = splitLine('"He said ""hi""",b', ",");
  assert.deepEqual(escaped, ['He said "hi"', "b"]);
});

test("a real sheet row reads correctly end to end", () => {
  const { mode, rows } = parsePaste(HEADER + "\n" + ROW_LUNATICON);
  assert.equal(mode, "sheet");
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.beatmapId, 4679115);
  assert.equal(r.beatmapsetId, 2209379);
  assert.equal(r.title, "Lunaticon");
  assert.equal(r.version, "Relentless");
  assert.equal(r.mapper, "GranDSenpai");
  assert.equal(r.stars, 9.92);
  assert.equal(r.cs, 3.8);
  assert.equal(r.bpm, 230);
  assert.equal(r.drainSeconds, 190);
  assert.equal(r.tier, "Diamond");
  assert.equal(r.tierObj?.order, 15);
  assert.equal(r.mod, "NM");
  assert.equal(r.status, "new");
});

test("headerless rows fall back to column order", () => {
  const { rows } = parsePaste(ROW_LUNATICON);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].beatmapId, 4679115);
  assert.equal(rows[0].stars, 9.92);
});

test("bare links parse as links", () => {
  const { mode, rows } = parsePaste(
    "https://osu.ppy.sh/beatmapsets/2209379#osu/4679115\n5309916",
  );
  assert.equal(mode, "links");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].beatmapId, 4679115);
  assert.equal(rows[1].beatmapId, 5309916);
  // No pack or category yet, so both need staff input.
  assert.equal(rows[0].status, "attention");
});

test("a set link with no difficulty is an error, with a useful note", () => {
  const { rows } = parsePaste(
    HEADER + "\n" +
      ["https://osu.ppy.sh/beatmapsets/2377969", "Raw Aim", "TV Size", "High", "NM",
       "", "", "", "Bonfire (Cut Ver.)", "8,14", "132", "1:20", "3,8", "10", "10",
       "Ruby", "Kayrem"].join(T),
  );
  assert.equal(rows[0].status, "error");
  assert.match(rows[0].notes[0], /difficulty/i);
});

test("a row with no pack asks for one instead of silently passing", () => {
  const noPack = ROW_LUNATICON.split(T);
  noPack[15] = "";
  const { rows } = parsePaste(HEADER + "\n" + noPack.join(T));
  assert.equal(rows[0].status, "attention");
  assert.equal(rows[0].notes[0], "Pick a pack");
});

test("an unknown pack name is reported rather than dropped", () => {
  const bad = ROW_LUNATICON.split(T);
  bad[15] = "Mythic";
  const { rows } = parsePaste(HEADER + "\n" + bad.join(T));
  assert.equal(rows[0].status, "attention");
  assert.match(rows[0].notes[0], /Mythic/);
});

test("identity is beatmap plus mod, so the same map under HR is new", () => {
  const hr = ROW_LUNATICON.split(T);
  hr[4] = "HR";
  const { rows } = parsePaste([HEADER, ROW_LUNATICON, hr.join(T), ROW_LUNATICON].join("\n"));
  classify(rows, new Set());
  assert.equal(rows[0].status, "new");        // NM
  assert.equal(rows[1].status, "new");        // HR is a separate entry
  assert.equal(rows[2].status, "duplicate");  // NM again
});

test("rows already on the ladder are flagged, not re-imported", () => {
  const { rows } = parsePaste(HEADER + "\n" + ROW_LUNATICON);
  classify(rows, new Set(["4679115|NM"]));
  assert.equal(rows[0].status, "exists");
});

test("normalisations are reported so staff can see what changed", () => {
  const { rows } = parsePaste(HEADER + "\n" + ROW_LUNATICON);
  const norms = normalizations(rows[0]);
  assert.ok(norms.some(([from, to]) => from === "9,92" && to === "9.92"));
  // Drain time is stored in seconds too, but that conversion is bookkeeping
  // and is not something staff are asked to check.
  assert.ok(!norms.some(([from]) => from === "3:10"));
});

test("mod strings resolve to one canonical form", () => {
  assert.equal(normalizeMod(""), "NM");
  assert.equal(normalizeMod("nm"), "NM");
  assert.equal(normalizeMod("hr,dt"), "HRDT");
  assert.equal(normalizeMod("DTHR"), "HRDT");
  assert.equal(normalizeMod("HR DT"), "HRDT");
  // Hidden moves no notes, so it never splits an entry.
  assert.equal(normalizeMod("hd,dt"), "DT");
  assert.equal(normalizeMod("HD"), "NM");
  assert.equal(normalizeMod("HDHRDT"), "HRDT");
  // Nightcore is Double Time with another sound.
  assert.equal(normalizeMod("NC"), "DT");
  assert.equal(normalizeMod("NCHD"), "DT");
  assert.equal(normalizeMod("DTNC"), "DT");
  // Mods that do not change difficulty never split an entry either.
  assert.equal(normalizeMod("NFHD"), "NM");
  assert.equal(normalizeMod("CL"), "NM");
  assert.equal(modsFromApi([{ acronym: "DT" }, { acronym: "HD" }]), "DT");
  assert.equal(modsFromApi([{ acronym: "NC" }, { acronym: "HR" }]), "HRDT");
  assert.equal(modsFromApi([]), "NM");
});

test("grades land on the right side of every boundary", () => {
  const g = (missCount: number) => gradeFor({ missCount, isFc: false, isPerfect: false });
  assert.equal(g(0), "S");
  assert.equal(g(1), "A+");
  assert.equal(g(2), "A");
  assert.equal(g(3), "A-");
  assert.equal(g(4), "B+");
  assert.equal(g(5), "B+");
  assert.equal(g(6), "B");
  assert.equal(g(7), "B");
  assert.equal(g(8), "B-");
  assert.equal(g(10), "B-");
  assert.equal(g(11), "C+");
  assert.equal(g(30), "C-");
  assert.equal(g(31), "D+");
  assert.equal(g(60), "D-");
  assert.equal(g(61), "F+");
  assert.equal(g(100), "F");
  assert.equal(g(101), "Pass");
  assert.equal(g(9999), "Pass");
});

test("combo beats misscount", () => {
  assert.equal(gradeFor({ missCount: 0, isFc: true, isPerfect: true }), "SSS");
  assert.equal(gradeFor({ missCount: 0, isFc: true, isPerfect: false }), "SS");
  // Zero misses but a dropped combo is S, not SS.
  assert.equal(gradeFor({ missCount: 0, isFc: false, isPerfect: false }), "S");
});

/* ------------------------------------------------------------- mod math */

test("DT shortens the approach and hit windows, not just the song", () => {
  const base = { cs: 4, ar: 9.8, od: 9.2, bpm: 214, drainSeconds: 252 };
  const dt = applyMod(base, "DT");
  assert.equal(dt.cs, 4);          // a distance, so the rate leaves it alone
  assert.equal(dt.ar, 10.87);
  assert.equal(dt.od, 10.58);
  assert.equal(dt.bpm, 321);       // 214 * 1.5
  assert.equal(dt.drainSeconds, 168); // 252 / 1.5
});

test("HR scales the raw values and caps them at ten", () => {
  const hr = applyMod({ cs: 4, ar: 9.8, od: 9.2, bpm: 214, drainSeconds: 252 }, "HR");
  assert.equal(hr.cs, 5.2);        // 4 * 1.3
  assert.equal(hr.ar, 10);         // 9.8 * 1.4 would be 13.72, capped
  assert.equal(hr.od, 10);
  assert.equal(hr.bpm, 214);       // no rate change
  assert.equal(hr.drainSeconds, 252);
});

test("EZ halves, HT slows", () => {
  const ez = applyMod({ cs: 4, ar: 9, od: 8, bpm: 200, drainSeconds: 200 }, "EZ");
  assert.equal(ez.cs, 2);
  assert.equal(ez.ar, 4.5);
  assert.equal(ez.od, 4);
  const ht = applyMod({ cs: 4, ar: 9, od: 8, bpm: 200, drainSeconds: 200 }, "HT");
  assert.equal(ht.bpm, 150);
  assert.equal(ht.drainSeconds, 267);
  assert.ok(ht.ar! < 9 && ht.od! < 8);
});

test("NM changes nothing, and NC matches DT", () => {
  const base = { cs: 4, ar: 9, od: 8, bpm: 180, drainSeconds: 180 };
  assert.deepEqual(applyMod(base, "NM"), { ...base, hp: null });
  const dt = applyMod(base, "DT");
  const nc = applyMod(base, "NC");
  assert.equal(nc.ar, dt.ar);
  assert.equal(nc.bpm, dt.bpm);
});

test("combined mods apply the multiplier before the rate", () => {
  // HR raises AR to 10, then DT converts that through the approach timing.
  const hrdt = applyMod({ cs: 4, ar: 8, od: 8, bpm: 180, drainSeconds: 180 }, "HRDT");
  const dtOnly = applyMod({ cs: 4, ar: 8, od: 8, bpm: 180, drainSeconds: 180 }, "DT");
  assert.ok(hrdt.ar! > dtOnly.ar!);
  assert.equal(hrdt.cs, 5.2);
  assert.equal(hrdt.bpm, 270);
});

test("AR and OD conversions round trip", () => {
  for (const ar of [0, 4.9, 5, 7.5, 9.8, 10]) {
    assert.ok(Math.abs(preemptToAr(arToPreempt(ar)) - ar) < 1e-9);
  }
  for (const od of [0, 5, 8.4, 10]) {
    assert.ok(Math.abs(windowToOd(odToWindow(od)) - od) < 1e-9);
  }
});

test("length buckets match how the sheet already classifies its maps", () => {
  assert.equal(lengthBucketFor(45), "Cut Ver.");  // under a minute
  assert.equal(lengthBucketFor(66), "TV Size");   // Firestarter 1:06
  assert.equal(lengthBucketFor(80), "TV Size");   // Bonfire 1:20
  assert.equal(lengthBucketFor(118), "Medium");   // FOSSIL 1:58
  assert.equal(lengthBucketFor(132), "Medium");   // erase u 2:12
  assert.equal(lengthBucketFor(190), "Long");     // Lunaticon 3:10
  assert.equal(lengthBucketFor(252), "Long");     // When My Devil Rises 4:12
  assert.equal(lengthBucketFor(400), "Marathon");
  assert.equal(lengthBucketFor(null), "");
});

test("a pacing boundary belongs to the longer, faster bucket", () => {
  assert.equal(lengthBucketFor(59), "Cut Ver.");
  assert.equal(lengthBucketFor(60), "TV Size");   // 1:00
  assert.equal(lengthBucketFor(89), "TV Size");
  assert.equal(lengthBucketFor(90), "Medium");    // 1:30
  assert.equal(lengthBucketFor(179), "Medium");
  assert.equal(lengthBucketFor(180), "Long");     // 3:00
  assert.equal(lengthBucketFor(299), "Long");
  assert.equal(lengthBucketFor(300), "Marathon"); // 5:00
});

test("speed buckets follow the BPM scale", () => {
  assert.equal(speedGuessFor(169), "Very low");
  assert.equal(speedGuessFor(170), "Low");
  assert.equal(speedGuessFor(199), "Low");
  assert.equal(speedGuessFor(200), "Medium");
  assert.equal(speedGuessFor(214), "Medium");
  assert.equal(speedGuessFor(239), "Medium");
  assert.equal(speedGuessFor(240), "High");
  assert.equal(speedGuessFor(255), "High");
  assert.equal(speedGuessFor(279), "High");
  assert.equal(speedGuessFor(280), "Very high");
  assert.equal(speedGuessFor(319), "Very high");
  assert.equal(speedGuessFor(320), "Extreme");
  assert.equal(speedGuessFor(360), "Extreme");
  assert.equal(speedGuessFor(361), "Extreme+");
  assert.equal(speedGuessFor(null), "");
});

test("speed is only ever a suggestion", () => {
  // The sheet marks 132 BPM maps as High because density, not tempo, decides
  // it. The guess only sees BPM, so it says Very low and staff override it.
  assert.equal(speedGuessFor(132), "Very low");
});

test("pacing labels resolve to one spelling", () => {
  // The scale renamed Short to Cut Ver., so older sheet rows still land.
  assert.equal(normalizeLength("Short"), "Cut Ver.");
  assert.equal(normalizeLength("cut ver."), "Cut Ver.");
  assert.equal(normalizeLength("tv size"), "TV Size");
  assert.equal(normalizeLength("TV Size"), "TV Size");
  assert.equal(normalizeLength(""), "");
  assert.equal(normalizeSpeed("very high"), "Very high");
  assert.equal(normalizeSpeed("v high"), "Very high");
  assert.equal(normalizeSpeed("extreme"), "Extreme");
  // The plus has to survive the match, or Extreme+ collapses into Extreme.
  assert.equal(normalizeSpeed("extreme+"), "Extreme+");
  // Anything off the scale is kept as pasted rather than silently reworded.
  assert.equal(normalizeSpeed("Ludicrous"), "Ludicrous");
});

test("renamed categories resolve, dropped ones ask to be judged again", () => {
  // The sheet's own wording, from before the list was rewritten.
  assert.equal(normalizeCategory("Raw Aim"), "Aim - raw mechanic");
  assert.equal(normalizeCategory("Consistency Aim"), "Aim - consistency");
  assert.equal(normalizeCategory("anti-aim"), "Anti-aim");
  assert.equal(normalizeCategory("Aim Control"), "Aim control");
  assert.equal(normalizeCategory("Precision"), "Precision");
  assert.equal(normalizeCategory(""), "");
  // Flow Aim and Speed are gone, and folding them into a surviving category
  // would be judging the map rather than reading the sheet.
  assert.equal(normalizeCategory("Flow Aim"), "Flow Aim");
  assert.ok(!isCategory("Flow Aim"));
  assert.ok(!isCategory("Speed"));
  assert.ok(isCategory("Raw Aim"));
});

test("a paste carrying a dropped category is held back", () => {
  const dropped = ROW_LUNATICON.split(T);
  dropped[1] = "Flow Aim";
  const { rows } = parsePaste(HEADER + "\n" + dropped.join(T));
  assert.equal(rows[0].status, "attention");
  assert.match(rows[0].notes[0], /unknown category/i);

  // The same row on the new list sails through.
  const { rows: ok } = parsePaste(HEADER + "\n" + ROW_LUNATICON);
  assert.deepEqual(ok[0].categories, ["Aim - raw mechanic"]);
  assert.equal(ok[0].status, "new");
});

test("one cell can put a map in several categories", () => {
  const both = ROW_LUNATICON.split(T);
  both[1] = "Raw Aim / Consistency";
  const { rows } = parsePaste(HEADER + "\n" + both.join(T));
  // Scale order, not the order they were typed in.
  assert.deepEqual(rows[0].categories, ["Aim - consistency", "Aim - raw mechanic"]);
  assert.equal(rows[0].status, "new");

  assert.deepEqual(normalizeCategories("Precision, anti-aim; Precision"), ["Anti-aim", "Precision"]);
  assert.deepEqual(normalizeCategories(["Aim control", "Raw Aim"]), ["Aim - raw mechanic", "Aim control"]);
  assert.deepEqual(normalizeCategories(""), []);

  // One dropped label in the set holds the row back, named.
  both[1] = "Raw Aim + Flow Aim";
  const { rows: held } = parsePaste(HEADER + "\n" + both.join(T));
  assert.equal(held[0].status, "attention");
  assert.deepEqual(held[0].notes, ["Unknown category: Flow Aim"]);
});

test("filters read along their list, not the alphabet", () => {
  assert.deepEqual(
    orderByScale(["Medium", "Extreme+", "Very low", "High"], SPEEDS),
    ["Very low", "Medium", "High", "Extreme+"],
  );
  assert.deepEqual(
    orderByScale(["Marathon", "Medium", "Cut Ver."], LENGTHS),
    ["Cut Ver.", "Medium", "Marathon"],
  );
  assert.deepEqual(
    orderByScale(["Precision", "Anti-aim", "Aim - consistency"], CATEGORIES),
    ["Aim - consistency", "Anti-aim", "Precision"],
  );
  // A label from an older list is not lost, it just sorts last.
  assert.deepEqual(
    orderByScale(["Flow Aim", "Precision"], CATEGORIES),
    ["Precision", "Flow Aim"],
  );
});
