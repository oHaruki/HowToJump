/**
 * Seeds the grading scale and the map bank rows from the original sheet.
 *
 * Run with: npm run db:seed
 *
 * Deploys do not need this: npm run db:deploy refreshes the grades on every
 * run and seeds the sheet's maps when the bank is empty.
 */
import "./env";
import { sql as raw } from "drizzle-orm";
import { db, sql } from "@/lib/db";
import { entries } from "@/lib/schema";
import { seedGradeRules, seedSheet, seedSiteConfig } from "./seeding";

async function main() {
  await seedGradeRules();
  await seedSiteConfig();
  await seedSheet();

  const [{ n }] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(entries);
  console.log("Done. " + n + " entries on the ladder.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
