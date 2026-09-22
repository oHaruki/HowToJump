/**
 * Recomputes every player's pack rollup and skill levels, whether or not
 * the rules changed. Deploys already do this when the rules change.
 *
 * Usage: npm run levels:rebuild
 */
import "./env";
import { sql } from "@/lib/db";
import { rebuildLevelsIfRulesChanged } from "@/lib/osu/sync";

async function main() {
  const { players } = await rebuildLevelsIfRulesChanged(true);
  console.log("rebuilt levels for " + players + " players");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
