/**
 * Run with: node --import tsx --test src/lib/osu/backfill.test.ts
 *
 * Reading a pasted score link, and which scores can go on a profile.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { backfillProblem, parseScoreLink } from "./backfill";
import type { OsuScore } from "./client";

test("a score link reads as its ID, in every shape osu! hands out", () => {
  const plain = { id: 7534121696, ruleset: null };
  assert.deepEqual(parseScoreLink("https://osu.ppy.sh/scores/7534121696"), plain);
  assert.deepEqual(parseScoreLink("  osu.ppy.sh/scores/7534121696/  "), plain);
  assert.deepEqual(parseScoreLink("http://www.osu.ppy.sh/scores/7534121696?mode=osu"), plain);
  assert.deepEqual(parseScoreLink("https://osu.ppy.sh/scores/7534121696#top"), plain);
  assert.deepEqual(parseScoreLink("7534121696"), plain);
  // An old style link carries its ruleset, which the lookup needs.
  assert.deepEqual(parseScoreLink("https://osu.ppy.sh/scores/osu/4378262390"), {
    id: 4378262390,
    ruleset: "osu",
  });
  assert.deepEqual(parseScoreLink("https://osu.ppy.sh/scores/Mania/12"), { id: 12, ruleset: "mania" });
});

test("anything that is not a score link reads as nothing", () => {
  for (const text of [
    "",
    null,
    undefined,
    "hello",
    "https://osu.ppy.sh/beatmaps/123",
    "https://osu.ppy.sh/users/2/scores/3",
    "https://example.com/scores/7534121696",
    "https://osu.ppy.sh/scores/",
    "https://osu.ppy.sh/scores/12abc",
    "-5",
    "0",
    "99999999999999999999",
  ]) {
    assert.equal(parseScoreLink(text), null, JSON.stringify(text) + " was read as a score");
  }
});

const score = (over: Partial<OsuScore> = {}): OsuScore => ({
  id: 1,
  user_id: 42,
  ruleset_id: 0,
  beatmap_id: 100,
  accuracy: 0.97,
  max_combo: 500,
  rank: "A",
  mods: [],
  statistics: { miss: 2 },
  passed: true,
  ...over,
});

test("only the player's own osu!standard passes can be added", () => {
  assert.equal(backfillProblem(score(), 42), null);
  assert.match(backfillProblem(score({ user_id: 43 }), 42) ?? "", /someone else/);
  assert.match(backfillProblem(score({ ruleset_id: 3 }), 42) ?? "", /osu!standard/);
  assert.match(backfillProblem(score({ passed: false }), 42) ?? "", /fail/);
  // Older replies name the player and mode differently.
  assert.equal(backfillProblem(score({ user_id: undefined, user: { id: 42 } }), 42), null);
  assert.match(
    backfillProblem(score({ ruleset_id: undefined, mode_int: 1 }), 42) ?? "",
    /osu!standard/,
  );
  // A reply that names no player at all is never taken as the player's.
  assert.notEqual(backfillProblem(score({ user_id: undefined }), 42), null);
});
