/**
 * Run with: node --import tsx --test src/lib/osu/client.test.ts
 *
 * Reading a score: how much of the map a play got through.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { completionOf, type OsuScore } from "./client";

const fail = (over: Partial<OsuScore> = {}): OsuScore => ({
  accuracy: 0.9,
  max_combo: 50,
  rank: "F",
  mods: [],
  passed: false,
  statistics: { great: 126, ok: 11, miss: 9 },
  ...over,
});

test("a fail reads how far it got against what a full run would judge", () => {
  assert.equal(completionOf(fail({ maximum_statistics: { great: 292 } }), null), 50);
  // Without osu!'s own total, the map's note count stands in.
  assert.equal(completionOf(fail(), 584), 25);
  assert.equal(completionOf(fail(), null), null);
  // Never past the end.
  assert.equal(completionOf(fail({ maximum_statistics: { great: 100 } }), null), 100);
});
