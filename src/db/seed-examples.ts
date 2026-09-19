/**
 * Example bank entries, for checking the bank's search and filters.
 *
 *   npm run seed:examples            insert them (replaces any already there)
 *   npm run seed:examples -- --clear remove them and stop
 *
 * Sixty rows is enough to page at forty eight, and they are spread so that
 * every filter has something to find: all sixteen packs, four mods, the whole
 * length and speed scales, some in two categories at once, a handful carrying
 * category wording the grading scale has dropped, and a handful already taken
 * off the ladder.
 *
 * Every row is marked by an osu! beatmap ID at or above EXAMPLE_ID_BASE,
 * which is far outside the real range, so clearing matches exactly these and
 * can never touch a judged entry. They are ordinary active entries otherwise,
 * so they also show on the public bank until they are cleared.
 */
import "./env";
import { gte, inArray, sql as raw } from "drizzle-orm";
import { db, sql } from "@/lib/db";
import { beatmaps, entries } from "@/lib/schema";
import {
  CATEGORIES, LENGTH_SCALE, SPEED_SCALE, TIERS, bucketFor,
} from "@/lib/tiers";

/** Above every real osu! beatmap ID, so these rows are always separable. */
const EXAMPLE_ID_BASE = 900_000_000;
const COUNT = 60;

const ARTISTS = ["Exampleon", "Testcore", "Mockwave", "Nullbeat", "Probesynth"];
const WORDS_A = ["Neon", "Crimson", "Velvet", "Frozen", "Golden", "Hollow"];
const WORDS_B = ["Requiem", "Paradigm", "Afterglow", "Zenith", "Cascade", "Bootleg"];
const VERSIONS = ["Insane", "Extra", "Extreme", "Another", "Expert", "Lunatic"];
const MAPPERS = [
  "example_rin", "example_kai", "example_mio",
  "example_sora", "example_yuki", "example_haru",
];
const MODS = ["NM", "DT", "HR", "HD"];

/**
 * Wording the scale no longer uses. Two are old spellings of a category that
 * still exists and two were dropped outright, which is the mix the Stale
 * label filter is there to surface.
 */
const STALE_CATEGORIES = ["Raw Aim", "Consistency Aim", "Flow Aim", "Speed"];

const pick = <T,>(xs: T[], i: number) => xs[i % xs.length];

function row(i: number) {
  const osuBeatmapId = EXAMPLE_ID_BASE + i;

  // Spread across the whole of both scales rather than clustering mid range,
  // so Cut Ver. and Marathon and Extreme+ all have something in them.
  const drainSeconds = 40 + ((i * 37) % 300);
  const bpm = 150 + ((i * 23) % 220);

  return {
    osuBeatmapId,
    // A quarter have no set at all, which is the no cover art case; the rest
    // point at a plausible set, some of which genuinely 404.
    osuBeatmapsetId: i % 4 === 0 ? null : 1_000_000 + i,
    artist: pick(ARTISTS, i),
    title: "[Example] " + pick(WORDS_A, i) + " " + pick(WORDS_B, i * 3),
    version: pick(VERSIONS, i * 5),
    mapper: pick(MAPPERS, i),
    mod: pick(MODS, i),
    tierOrder: pick(TIERS, i * 7).order,
    // Every seventh row keeps wording the scale has dropped, and every fifth
    // other one sits in two categories.
    categories:
      i % 7 === 0
        ? [pick(STALE_CATEGORIES, i)]
        : i % 5 === 0
          ? [pick(CATEGORIES, i * 3), pick(CATEGORIES, i * 3 + 1)]
          : [pick(CATEGORIES, i * 3)],
    lengthBucket: bucketFor(LENGTH_SCALE, drainSeconds),
    speedBucket: bucketFor(SPEED_SCALE, bpm),
    stars: Math.round((3 + ((i * 13) % 70) / 10) * 100) / 100,
    bpm,
    drainSeconds,
    cs: 4,
    ar: 9.5,
    od: 8.5,
    // Every tenth row is already off the ladder, for Removed only.
    isActive: i % 10 !== 0,
  };
}

async function clear() {
  const ids = await db
    .select({ id: beatmaps.id })
    .from(beatmaps)
    .where(gte(beatmaps.osuBeatmapId, EXAMPLE_ID_BASE));

  if (ids.length) {
    // Entries first: the foreign key cascades, but being explicit means the
    // count printed below is the number of rows actually taken out.
    await db.delete(entries).where(
      inArray(entries.beatmapId, ids.map((r) => r.id)),
    );
    await db.delete(beatmaps).where(gte(beatmaps.osuBeatmapId, EXAMPLE_ID_BASE));
  }
  console.log("Cleared " + ids.length + " example beatmaps");
}

async function main() {
  // Always a clean slate, so the script is safe to run twice.
  await clear();

  if (process.argv.includes("--clear")) {
    await report();
    await sql.end();
    return;
  }

  const rows = Array.from({ length: COUNT }, (_, i) => row(i + 1));

  for (const r of rows) {
    const [bm] = await db
      .insert(beatmaps)
      .values({
        osuBeatmapId: r.osuBeatmapId,
        osuBeatmapsetId: r.osuBeatmapsetId,
        artist: r.artist,
        title: r.title,
        version: r.version,
        mapper: r.mapper,
        stars: r.stars,
        bpm: r.bpm,
        drainSeconds: r.drainSeconds,
        cs: r.cs,
        ar: r.ar,
        od: r.od,
      })
      .returning({ id: beatmaps.id });

    await db.insert(entries).values({
      beatmapId: bm.id,
      mod: r.mod,
      tierOrder: r.tierOrder,
      categories: r.categories,
      lengthBucket: r.lengthBucket,
      speedBucket: r.speedBucket,
      stars: r.stars,
      bpm: r.bpm,
      drainSeconds: r.drainSeconds,
      cs: r.cs,
      ar: r.ar,
      od: r.od,
      judgedByName: "example",
      isActive: r.isActive,
    });
  }

  const stale = rows.filter((r) => r.categories.some((c) => !CATEGORIES.includes(c))).length;
  const removed = rows.filter((r) => !r.isActive).length;
  console.log(
    "Inserted " + rows.length + " example entries" +
    " (" + stale + " with a stale label, " + removed + " removed)",
  );

  await report();
  await sql.end();
}

async function report() {
  const [{ n }] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(entries);
  console.log("Bank now holds " + n + " entries in total.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
