/**
 * Brings the database up to this build. `docker compose up` runs it as the
 * migrate service before the app starts, on every deploy; locally it is
 * npm run db:deploy. Every step is safe to repeat:
 *
 *   1. New migrations, all in one transaction, so a failure leaves the
 *      database as it was and compose leaves the running app alone.
 *   2. The grade table, refreshed from the code.
 *   3. The sheet's maps, but only into an empty bank, so a deploy can never
 *      undo what staff changed.
 *   4. Levels, recomputed when the numbers behind them changed.
 */
import "./env";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sql as raw } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sql } from "@/lib/db";
import { entries } from "@/lib/schema";
import { rebuildLevelsIfRulesChanged } from "@/lib/osu/sync";
import { seedGradeRules, seedSheet, seedSiteConfig } from "./seeding";

const MIGRATIONS = fileURLToPath(new URL("./migrations", import.meta.url));

type Journal = { entries: Array<{ tag: string; when: number }> };

/**
 * Databases set up before migrations were tracked were built with db:push:
 * they have the tables but no migration history, so replaying the first
 * migration would fail on tables that already exist. Recording that one as
 * applied, the way drizzle's migrator records it, lets the rest run; those
 * are written to be harmless where db:push got there first.
 *
 * An empty history table counts as none. drizzle-kit migrate creates the
 * table before it runs anything, so a run that failed on those existing
 * tables leaves one behind.
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

  // The previous build's app keeps running until this finishes, so a player
  // it syncs in the meantime is recomputed under the old rules. Their next
  // imported score puts that right.
  const levels = await rebuildLevelsIfRulesChanged();
  console.log(
    levels.rebuilt
      ? "Level rules changed, recomputed " + levels.players + " players"
      : "Level rules unchanged",
  );

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
