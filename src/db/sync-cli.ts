/**
 * One sync pass from the command line, for cron or a manual run.
 * Usage: npm run sync
 */
import "./env";
import { sql } from "@/lib/db";
import { syncDueUsers } from "@/lib/osu/sync";

async function main() {
  const results = await syncDueUsers(40);
  const imported = results.reduce((n, r) => n + r.scoresImported, 0);
  console.log("swept " + results.length + " players, imported " + imported + " scores");
  for (const r of results) {
    console.log(
      "  " + r.username + ": " + r.playsSeen + " plays, " +
        r.playsMatched + " on bank entries, " + r.scoresImported + " kept" +
        (r.error ? " (error: " + r.error + ")" : ""),
    );
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
