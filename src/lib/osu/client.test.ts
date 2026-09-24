/**
 * Run with: node --import tsx --test src/lib/osu/client.test.ts
 *
 * Reading a score: whether it held the combo, and how much of the map a
 * play got through.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { completionOf, toPlay, type OsuScore } from "./client";

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

const play = (over: Partial<OsuScore> = {}): OsuScore => ({
  accuracy: 0.99,
  max_combo: 2385,
  rank: "S",
  mods: [],
  legacy_perfect: false,
  is_perfect_combo: false,
  statistics: { great: 1973, ok: 10 },
  maximum_statistics: { great: 1983, legacy_combo_increase: 402 },
  ...over,
});

test("a stable combo short only by its 100s is a full combo", () => {
  assert.equal(toPlay(play({ max_combo: 2384 })).isFc, true);
  assert.equal(toPlay(play({ max_combo: 2375 })).isFc, true);
  // More combo gone than there are 100s means it broke.
  assert.equal(toPlay(play({ max_combo: 2374 })).isFc, false);
  assert.equal(toPlay(play({ max_combo: 2010 })).isFc, false);
});

test("a lazer combo short only by its dropped slider ends is a full combo", () => {
  const lazer = (combo: number, tails: number) =>
    toPlay(play({
      max_combo: combo,
      statistics: { great: 301, ok: 15, large_tick_hit: 7, slider_tail_hit: tails },
      maximum_statistics: { great: 316, large_tick_hit: 7, slider_tail_hit: 105 },
    }));
  assert.equal(lazer(425, 102).isFc, true);
  assert.equal(lazer(424, 102).isFc, false);
  assert.equal(lazer(370, 105).isFc, false);
});

test("a miss is never a full combo, and osu!'s own flag still counts", () => {
  assert.equal(toPlay(play({ statistics: { great: 1982, miss: 1 } })).isFc, false);
  assert.equal(toPlay(play({ max_combo: 10, legacy_perfect: true })).isFc, true);
  // Without the map's totals only the flag can tell.
  assert.equal(toPlay(play({ max_combo: 2384, maximum_statistics: undefined })).isFc, false);
});
