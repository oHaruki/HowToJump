/**
 * The seed's steps, shared by npm run db:seed, which runs all of them, and
 * the deploy step, which refreshes the grades every time but only seeds the
 * sheet's maps into an empty bank.
 *
 * If osu! credentials are present the beatmap metadata is pulled fresh from
 * the API. Without them the sheet's own numbers are used, so the seed still
 * works offline.
 */
import { db } from "@/lib/db";
import { beatmaps, entries, gradeRules, siteConfig } from "@/lib/schema";
import { GRADE_RULES } from "@/lib/grading";
import { normalizeMod } from "@/lib/mods";
import {
  normalizeCategories, normalizeLength, normalizeSpeed, tierByName,
} from "@/lib/tiers";
import { drainToSeconds, num } from "@/lib/import/parse";
import { fetchBeatmaps, type BeatmapFacts } from "@/lib/osu/client";

/** The rows exactly as they appear in the sheet, commas and all. */
const SHEET: string[][] = [
  ["https://osu.ppy.sh/beatmapsets/2209379#osu/4679115", "Raw Aim", "Long", "Medium", "NM", "4679115", "GranDSenpai", "Lunaticon [Relentless]", "9,92", "230", "3:10", "3,8", "10", "10", "Diamond", "Kayrem"],
  ["https://osu.ppy.sh/beatmapsets/2098957#osu/4402860", "Raw Aim", "Medium", "High", "NM", "4402860", "Hayakou", "NOT FOR SALE FOSSIL - MEOXA X KATABATIC BOOTLEG [Remains]", "9,44", "255", "1:58", "4", "10", "10", "Opal", "Kayrem"],
  ["https://osu.ppy.sh/beatmapsets/2353663#osu/5066679", "Consistency Aim", "Medium", "High", "NM", "5066679", "sophia", "erase u (Sped Up Ver.) [Your Goodbye Was the Sweetest Lie I Believed]", "7,78", "260", "2:12", "3,8", "9,8", "9,6", "Titanium", "Kayrem"],
  ["https://osu.ppy.sh/beatmapsets/1794786#osu/3678730", "Raw Aim", "Long", "Medium", "NM", "3678730", "-Kirigiri", "When My Devil Rises [DESPAIR]", "8,14", "214", "4:12", "4", "9,8", "9,2", "Sapphire", "Kayrem"],
  ["https://osu.ppy.sh/beatmapsets/202832#osu/479812", "Consistency Aim", "Long", "Medium", "NM", "479812", "Taeyang", "Boogie Woogie Splatter Show [Taeyang's square jump]", "8,84", "230", "3:59", "4", "10", "7", "Amethyst", "Kayrem"],
  ["https://osu.ppy.sh/beatmapsets/2377969#osu/5137765", "Raw Aim", "TV Size", "High", "NM", "5137765", "quantumvortex", "Bonfire (Camellia's ElectroHouse Bootleg) (Cut Ver.) [Inferno]", "8,14", "132", "1:20", "3,8", "10", "10", "Ruby", "Kayrem"],
  ["https://osu.ppy.sh/beatmapsets/2435809#osu/5309916", "Raw Aim", "TV Size", "High", "NM", "5309916", "quantumvortex", "Firestarter (Cut Ver.) [Blaze]", "8,48", "135", "1:06", "4", "10", "10", "Ruby", "Kayrem"],
];

const COL = {
  link: 0, category: 1, length: 2, speed: 3, mod: 4, id: 5,
  mapper: 6, title: 7, stars: 8, bpm: 9, drain: 10,
  cs: 11, ar: 12, od: 13, tier: 14, judge: 15,
};

function splitTitle(v: string) {
  const m = v.match(/^(.*)\s\[([^\]]+)\]$/);
  return m ? { title: m[1].trim(), version: m[2].trim() } : { title: v, version: "" };
}

const coverBase = (setId: number, kind: string) =>
  "https://assets.ppy.sh/beatmaps/" + setId + "/covers/" + kind + ".jpg";

/**
 * Replaces the grade table with the scale in the code. One transaction, so
 * the table is never seen empty.
 */
export async function seedGradeRules() {
  console.log("Seeding grade rules");
  await db.transaction(async (tx) => {
    await tx.delete(gradeRules);
    await tx.insert(gradeRules).values(GRADE_RULES);
  });
}

/** Adds the editable site copy's defaults, leaving any edited value alone. */
export async function seedSiteConfig() {
  console.log("Seeding site config");
  await db
    .insert(siteConfig)
    .values([
      { key: "discord_invite", value: "" },
      { key: "submit_channel", value: "#submissions" },
    ])
    .onConflictDoNothing();
}

/** Banks the sheet's maps. */
export async function seedSheet() {
  const ids = SHEET.map((r) => Number(r[COL.id]));

  let facts = new Map<number, BeatmapFacts>();
  if (process.env.OSU_CLIENT_ID && process.env.OSU_CLIENT_SECRET) {
    try {
      console.log("Fetching beatmap metadata from the osu! API");
      facts = await fetchBeatmaps(ids);
    } catch (e) {
      console.warn("osu! lookup failed, falling back to the sheet values:", e);
    }
  } else {
    console.log("No osu! credentials, using the sheet values");
  }

  for (const row of SHEET) {
    const osuBeatmapId = Number(row[COL.id]);
    const setId = Number((row[COL.link].match(/beatmapsets\/(\d+)/) ?? [])[1] ?? 0);
    const t = splitTitle(row[COL.title]);
    const f = facts.get(osuBeatmapId);
    const tier = tierByName(row[COL.tier]);
    if (!tier) {
      console.warn("Unknown pack, skipping:", row[COL.tier]);
      continue;
    }

    const [bm] = await db
      .insert(beatmaps)
      .values({
        osuBeatmapId,
        osuBeatmapsetId: f?.osuBeatmapsetId ?? setId,
        artist: f?.artist ?? null,
        title: f?.title ?? t.title,
        version: f?.version ?? t.version,
        mapper: f?.mapper ?? row[COL.mapper],
        mapperUserId: f?.mapperUserId ?? null,
        stars: f?.stars ?? num(row[COL.stars]),
        bpm: f?.bpm ?? num(row[COL.bpm]),
        drainSeconds: f?.drainSeconds ?? drainToSeconds(row[COL.drain]),
        totalSeconds: f?.totalSeconds ?? null,
        cs: f?.cs ?? num(row[COL.cs]),
        ar: f?.ar ?? num(row[COL.ar]),
        od: f?.od ?? num(row[COL.od]),
        hp: f?.hp ?? null,
        maxCombo: f?.maxCombo ?? null,
        status: f?.status ?? null,
        // Old sets genuinely have no cover art. The UI falls back to a
        // pack tinted placeholder, so a missing file here is fine.
        coverUrl: setId ? coverBase(setId, "cover") : null,
        cardUrl: setId ? coverBase(setId, "card") : null,
        listUrl: setId ? coverBase(setId, "list") : null,
        lastSyncedAt: f ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: beatmaps.osuBeatmapId,
        set: { title: f?.title ?? t.title },
      })
      .returning({ id: beatmaps.id });

    await db
      .insert(entries)
      .values({
        beatmapId: bm.id,
        mod: normalizeMod(row[COL.mod]),
        tierOrder: tier.order,
        categories: normalizeCategories(row[COL.category]),
        lengthBucket: normalizeLength(row[COL.length]),
        speedBucket: normalizeSpeed(row[COL.speed]),
        // The sheet's numbers are mod adjusted, so they win over the nomod API values.
        stars: num(row[COL.stars]),
        bpm: num(row[COL.bpm]),
        drainSeconds: drainToSeconds(row[COL.drain]),
        cs: num(row[COL.cs]),
        ar: num(row[COL.ar]),
        od: num(row[COL.od]),
        judgedByName: row[COL.judge],
      })
      .onConflictDoNothing();

    console.log("  banked", t.title, "[" + t.version + "]", row[COL.mod]);
  }
}
