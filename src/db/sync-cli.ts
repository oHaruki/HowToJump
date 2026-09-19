/**
 * One sync pass from the command line, for cron or a manual run.
 * Usage: npm run sync
 */
import "./env";
import { sql } from "@/lib/db";
import { syncDueUsers } from "@/lib/osu/sync";

async function main() {
  const pass = await syncDueUsers();
  if (pass.skipped) {
    console.log("another pass is running, nothing to do");
  } else {
    const imported = pass.results.reduce((n, r) => n + r.scoresImported, 0);
    console.log(
      "checked " + pass.checked + " play counts, swept " + pass.results.length +
        " players, imported " + imported + " scores",
    );
    for (const r of pass.results) {
      console.log(
        "  " + r.username + " (" + r.reason + "): " + r.playsSeen + " plays, " +
          r.playsMatched + " on bank entries, " + r.scoresImported + " kept" +
          (r.error ? " (error: " + r.error + ")" : ""),
      );
    }
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
