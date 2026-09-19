/**
 * Run with: node --import tsx --test src/lib/progress.test.ts
 *
 * Covers what the profile remembers between visits: reading a stored
 * snapshot defensively, what counts as a change worth showing, and which
 * scores are new since the player last looked.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  PROFILE_SCOPES, UNRANKED, changesSince, freshness, readSnapshot, seenBody, snapshotOf,
  type LevelSnapshot,
} from "./progress";
import { MAIN_LEVEL, countingPlaces, levelValue } from "./levels";

const RAW = "Aim - raw mechanic";
const snap = (main: [number, number | null, number | null], raw: [number, number | null, number | null]): LevelSnapshot => {
  const s = snapshotOf([]);
  s[MAIN_LEVEL] = { exp: main[0], tierOrder: main[1], progress: main[2] };
  s[RAW] = { exp: raw[0], tierOrder: raw[1], progress: raw[2] };
  return s;
};

test("a snapshot always has every level, unranked where nothing is stored", () => {
  const s = snapshotOf([{ scope: RAW, exp: 33700, tierOrder: 13, progress: 68 }]);
  assert.deepEqual(Object.keys(s), PROFILE_SCOPES);
  assert.deepEqual(s[RAW], { exp: 33700, tierOrder: 13, progress: 68 });
  assert.deepEqual(s["Precision"], UNRANKED);
});

test("a stored snapshot is read back, and anything that is not one is refused", () => {
  const good = snap([10, 2, 40], [10, 2, 40]);
  assert.deepEqual(readSnapshot(good), good);
  assert.equal(readSnapshot(null), null);
  assert.equal(readSnapshot("nope"), null);
  assert.equal(readSnapshot({ [RAW]: { exp: -5, tierOrder: 3, progress: 1 } }), null);
  assert.equal(readSnapshot({ [RAW]: { exp: 5, tierOrder: 17, progress: 1 } }), null);
  assert.equal(readSnapshot({ [RAW]: { exp: 5, tierOrder: 3, progress: 100 } }), null);
  assert.equal(seenBody.safeParse({ snapshot: good, renderedAt: new Date().toISOString() }).success, true);
});

test("changes since the last visit: EXP gained and every pack reached", () => {
  const before = snap([30000, 9, 10], [25000, 12, 90]);
  const now = snap([33700, 9, 40], [33700, 13, 68]);
  const { expGain, rankUps } = changesSince(before, now);
  assert.equal(expGain, 3700);
  assert.deepEqual(rankUps, [{ scope: RAW, from: 12, to: 13 }]);
});

test("reaching the first pack counts as a rank up, falling back does not", () => {
  assert.deepEqual(changesSince(snap([0, null, 0], [0, null, 50]), snap([300, 1, 5], [300, 1, 5])).rankUps, [
    { scope: MAIN_LEVEL, from: null, to: 1 },
    { scope: RAW, from: null, to: 1 },
  ]);
  assert.deepEqual(changesSince(snap([900, 3, 0], [900, 3, 0]), snap([800, 2, 50], [800, 2, 50])).rankUps, []);
});

test("a score is new, improved, or old news, against when the player last looked", () => {
  const seenAt = new Date("2026-09-18T20:00:00Z");
  const before = new Date("2026-09-18T19:00:00Z");
  const after = new Date("2026-09-18T21:00:00Z");
  assert.equal(freshness({ createdAt: after, importedAt: after }, seenAt), "new");
  assert.equal(freshness({ createdAt: before, importedAt: after }, seenAt), "improved");
  assert.equal(freshness({ createdAt: before, importedAt: before }, seenAt), null);
  assert.equal(freshness({ createdAt: after, importedAt: after }, null), null);
});

test("counting places: each category's best ten by EXP, older id first on a tie", () => {
  const plays = [
    { id: 1, tierOrder: 13, categories: [RAW], grade: "A" },
    { id: 2, tierOrder: 14, categories: [RAW], grade: "SS" },
    { id: 3, tierOrder: 13, categories: [RAW], grade: "A" },
    { id: 4, tierOrder: 13, categories: ["Raw Aim"], grade: "SS" }, // old spelling, same category
    { id: 5, tierOrder: 16, categories: ["Flow Aim"], grade: "SSS" }, // dropped, counts nowhere
    ...Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, tierOrder: 1, categories: [RAW], grade: "Pass" })),
  ];
  const place = (id: number) => countingPlaces(plays).get(id)?.map((p) => p.place);
  assert.deepEqual(place(2), [1]);
  assert.deepEqual(place(4), [2]);
  assert.deepEqual(place(1), [3]);
  assert.deepEqual(place(3), [4]);
  assert.equal(place(5), undefined);
  assert.deepEqual(place(105), [10]);
  assert.equal(place(106), undefined);
});

test("a play on a map in two categories holds a place in each, best first", () => {
  const CONSISTENCY = "Aim - consistency";
  const places = countingPlaces([
    { id: 1, tierOrder: 14, categories: [RAW], grade: "SS" },
    { id: 2, tierOrder: 13, categories: [RAW, CONSISTENCY], grade: "SS" },
  ]);
  assert.deepEqual(places.get(2), [
    { category: CONSISTENCY, place: 1 },
    { category: RAW, place: 2 },
  ]);
});

test("a level reads as one number along the ladder", () => {
  assert.equal(levelValue({ tierOrder: 13, progress: 68 }), 13.68);
  assert.equal(levelValue({ tierOrder: null, progress: 50 }), 0.5);
  assert.equal(levelValue({ tierOrder: 16, progress: null }), 16);
});
