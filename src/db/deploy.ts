/**
 * Brings the database up to this build, as the compose migrate service or
 * npm run db:deploy. Every step is safe to repeat:
 *
 *   1. New migrations, in one transaction.
 *   2. The grade table, refreshed from the code.
 *   3. The sheet's maps, into an empty bank only.
 *   4. Missing note counts, and entries folded by mod.
 *   5. Zero miss plays, read again once under a new full combo rule.
 *   6. Levels, where the rules or the players above changed.
 */
import "./env";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { and, eq, inArray, isNotNull, sql as raw } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sql } from "@/lib/db";
import { entries, scores, siteConfig } from "@/lib/schema";
import { rebuildLevelsIfRulesChanged, refreshProgress } from "@/lib/osu/sync";
import { fetchScore, toPlay, type OsuScore } from "@/lib/osu/client";
import { gradeFor, gradeRank, GRADE_RULES } from "@/lib/grading";
import {
  backfillNoteCounts, mergeLooseModEntries, seedGradeRules, seedSheet, seedSiteConfig,
} from "./seeding";

const MIGRATIONS = fileURLToPath(new URL("./migrations", import.meta.url));

type Journal = { entries: Array<{ tag: string; when: number }> };

/**
 * Marks the first migration applied on a database built with db:push, which
 * has the tables but no history. An empty history table counts as none,
 * since drizzle-kit creates it before it runs anything.
 */
async function adoptPushedDatabase(): Promise<boolean> {
  const [state] = await sql`
    select to_regclass('public.users') is not null as has_tables,
           to_regclass('drizzle.__drizzle_migrations') is not null as has_history_table`;
  if (!state.has_tables) return false;
  if (state.has_history_table) {
    const [{ n }] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
    if (n > 0) return false;
  }

  const journal = JSON.parse(
    readFileSync(MIGRATIONS + "/meta/_journal.json", "utf8"),
  ) as Journal;
  const first = journal.entries[0];
  const hash = createHash("sha256")
    .update(readFileSync(MIGRATIONS + "/" + first.tag + ".sql", "utf8"))
    .digest("hex");

  await sql.begin(async (tx) => {
    await tx`create schema if not exists drizzle`;
    await tx`
      create table if not exists drizzle.__drizzle_migrations (
        id serial primary key, hash text not null, created_at bigint
      )`;
    await tx`
      insert into drizzle.__drizzle_migrations (hash, created_at)
      values (${hash}, ${first.when})`;
  });
  return true;
}

/** Where the full combo rule the stored plays were read under is kept. */
const FC_RULE_KEY = "fc_rule";
const FC_RULE = "dropped slider ends count";

/**
 * Asks osu! again about every stored zero miss play that isn't a full
 * combo, once per FC_RULE, and regrades the ones that now are. Returns the
 * players whose grades moved.
 */
async function recheckFullCombos(): Promise<number[]> {
  const [stored] = await db
    .select({ value: siteConfig.value })
    .from(siteConfig)
    .where(eq(siteConfig.key, FC_RULE_KEY));
  if (stored?.value === FC_RULE) return [];

  const rows = await db
    .select({ id: scores.id, userId: scores.userId, osuScoreId: scores.osuScoreId })
    .from(scores)
    .where(and(eq(scores.missCount, 0), eq(scores.isFc, false), isNotNull(scores.osuScoreId)));

  const moved = new Set<number>();
  for (const r of rows) {
    let score: OsuScore | null;
    try {
      score = await fetchScore({ id: r.osuScoreId!, ruleset: null });
    } catch (e) {
      console.warn("Full combos not all rechecked, trying again next deploy: " + (e instanceof Error ? e.message : e));
      return [...moved];
    }
    if (!score) continue;
    const play = toPlay(score);
    if (!play.isFc) continue;
    const grade = gradeFor(play, GRADE_RULES);
    await db
      .update(scores)
      .set({ isFc: true, isPerfect: play.isPerfect, grade, gradeRank: gradeRank(grade, GRADE_RULES) })
      .where(eq(scores.id, r.id));
    moved.add(r.userId);
  }

  await db
    .insert(siteConfig)
    .values({ key: FC_RULE_KEY, value: FC_RULE })
    .onConflictDoUpdate({ target: siteConfig.key, set: { value: FC_RULE, updatedAt: new Date() } });
  console.log("Rechecked " + rows.length + " zero miss plays, " + moved.size + " players gained a full combo");
  return [...moved];
}

async function main() {
  if (await adoptPushedDatabase()) {
    console.log("Built with db:push before migrations were tracked; took it from there");
  }
  await migrate(db, { migrationsFolder: MIGRATIONS });
  console.log("Migrations up to date");

  await seedGradeRules();
  await seedSiteConfig();

  const [{ n }] = await db.select({ n: raw<number>`count(*)::int` }).from(entries);
  if (n === 0) {
    console.log("Empty bank, seeding the sheet's maps");
    await seedSheet();
  }

  const filled = await backfillNoteCounts();
  if (filled.length) console.log("Note counts filled for " + filled.length + " maps");

  const remoded = await mergeLooseModEntries();
  const regraded = await recheckFullCombos();

  // The previous build's app keeps running until this finishes, so a player
  // it syncs in the meantime is recomputed under the old rules. Their next
  // imported score puts that right.
  const levels = await rebuildLevelsIfRulesChanged();
  console.log(
    levels.rebuilt
      ? "Level rules changed, recomputed " + levels.players + " players"
      : "Level rules unchanged",
  );

  // A count, a merge or a regrade changes what those plays are worth.
  const moved = [...remoded, ...regraded];
  if (!levels.rebuilt && (filled.length || moved.length)) {
    const onFilled = filled.length
      ? await db
          .selectDistinct({ userId: scores.userId })
          .from(scores)
          .innerJoin(entries, eq(scores.entryId, entries.id))
          .where(inArray(entries.beatmapId, filled))
      : [];
    const players = new Set([...onFilled.map((p) => p.userId), ...moved]);
    for (const userId of players) await refreshProgress(userId);
    console.log("Recomputed " + players.size + " players on those maps");
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
