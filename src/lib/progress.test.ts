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
  PROFILE_SCOPES, UNRANKED, changesSince, freshness, profileLists, readSnapshot, seenBody,
  snapshotOf, type LevelSnapshot,
} from "./progress";
import { MAIN_LEVEL, countingPlaces, levelValue } from "./levels";
import { gradeFor } from "./grading";
import { tierByName } from "./tiers";

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

// The two 2-miss plays are worth the same, and neither is the cleaner, so
// the tie falls through to the older id.
test("counting places: each category's best ten by EXP, older id last on a tie", () => {
  const plays = [
    { id: 1, tierOrder: 13, categories: [RAW], grade: "A", missCount: 2, noteCount: null },
    { id: 2, tierOrder: 14, categories: [RAW], grade: "SS", missCount: 0, noteCount: null },
    { id: 3, tierOrder: 13, categories: [RAW], grade: "A", missCount: 2, noteCount: null },
    { id: 4, tierOrder: 13, categories: ["Raw Aim"], grade: "SS", missCount: 0, noteCount: null }, // old spelling, same category
    { id: 5, tierOrder: 16, categories: ["Flow Aim"], grade: "SSS", missCount: 0, noteCount: null }, // dropped, counts nowhere
    ...Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, tierOrder: 1, categories: [RAW], grade: "Pass", missCount: 101, noteCount: null })),
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

test("counting places: among equals, the cleaner run is numbered first", () => {
  // Same pack, same 1,500 note map, both B: only the misscount tells them
  // apart, and it has to beat the newer score's higher id.
  const play = (id: number, missCount: number) =>
    ({ id, tierOrder: 13, categories: [RAW], grade: "B", missCount, noteCount: 1500 });
  const places = countingPlaces([play(1, 7), play(2, 6)]);
  assert.deepEqual(places.get(2), [{ category: RAW, place: 1 }]);
  assert.deepEqual(places.get(1), [{ category: RAW, place: 2 }]);
});

test("a play on a map in two categories holds a place in each, best first", () => {
  const CONSISTENCY = "Aim - consistency";
  const places = countingPlaces([
    { id: 1, tierOrder: 14, categories: [RAW], grade: "SS", missCount: 0, noteCount: null },
    { id: 2, tierOrder: 13, categories: [RAW, CONSISTENCY], grade: "SS", missCount: 0, noteCount: null },
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

/* ------------------------------------------------ the two lists a profile draws */

const EMERALD = tierByName("Emerald")!.order;
const PRECISION = "Precision";

/** A play as getProfilePlays hands it over, newest first. */
const play = (
  scoreId: number,
  missCount: number,
  opts: { pack?: number; noteCount?: number | null; categories?: string[]; at?: string } = {},
) => ({
  scoreId,
  tierOrder: opts.pack ?? EMERALD,
  categories: opts.categories ?? [RAW],
  grade: gradeFor({ missCount, isFc: false, isPerfect: false }),
  missCount,
  noteCount: opts.noteCount === undefined ? 1500 : opts.noteCount,
  playedAt: new Date(opts.at ?? "2026-09-20T12:00:00Z"),
  createdAt: new Date(opts.at ?? "2026-09-20T12:00:00Z"),
  importedAt: new Date(opts.at ?? "2026-09-20T12:00:00Z"),
});

/** Newest first, the order the query hands them over in. */
const newestFirst = <T extends { playedAt: Date }>(plays: T[]) =>
  plays.slice().sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());

test("the history keeps the order it was given, whatever the plays are worth", () => {
  const plays = newestFirst([
    play(1, 0, { at: "2026-09-01T00:00:00Z" }),
    play(2, 40, { at: "2026-09-20T00:00:00Z" }),
  ]);
  const { recent, top } = profileLists(plays, null);
  // The 40 miss run is the newer one, so it heads the history and tails the
  // top plays. A history that reordered itself by EXP would not be a history.
  assert.deepEqual(recent.map((p) => p.scoreId), [2, 1]);
  assert.deepEqual(top.map((p) => p.scoreId), [1, 2]);
});

test("the screenshot case: the cleaner of two tied plays leads and is #1", () => {
  // Misses count by map length, so six on a 1,500 note map and twelve on a
  // 6,000 note one are worth the same. The twelve was set first, which used
  // to win it #1 while being drawn underneath.
  const plays = newestFirst([
    play(12, 12, { at: "2026-09-01T00:00:00Z", noteCount: 6000 }),
    play(40, 6, { at: "2026-09-20T00:00:00Z" }),
  ]);
  const { recent, top } = profileLists(plays, null);
  assert.equal(recent[0].exp, recent[1].exp, "the two have to be worth the same");

  assert.deepEqual(top.map((p) => p.scoreId), [40, 12]);
  assert.deepEqual(top.map((p) => p.places[0].place), [1, 2]);
  assert.equal(top[0].missCount, 6);
});

test("nothing in the top plays is ever drawn above something numbered better", () => {
  // A spread wide enough that plays tie often: same pack, same miss bands.
  const plays = newestFirst([
    play(1, 6, { at: "2026-09-01T00:00:00Z" }),
    play(2, 7, { at: "2026-09-02T00:00:00Z" }),
    play(3, 6, { at: "2026-09-03T00:00:00Z" }),
    play(4, 0, { at: "2026-09-04T00:00:00Z" }),
    play(5, 7, { at: "2026-09-05T00:00:00Z" }),
    play(6, 12, { at: "2026-09-06T00:00:00Z" }),
    play(7, 12, { at: "2026-09-07T00:00:00Z", noteCount: null }),
    play(8, 2, { at: "2026-09-08T00:00:00Z" }),
  ]);
  const { top } = profileLists(plays, null);
  const shown = top
    .map((p) => p.places.find((x) => x.category === RAW)?.place)
    .filter((place): place is number => place != null);
  assert.deepEqual(shown, shown.map((_, i) => i + 1), "drawn out of order from its numbering");
  // And EXP never rises as the list goes down.
  for (let i = 1; i < top.length; i++) assert.ok(top[i].exp <= top[i - 1].exp);
});

test("a play on a map in two categories holds a place in both lists", () => {
  const plays = [play(1, 0, { categories: [RAW, PRECISION] }), play(2, 0, { categories: [RAW] })];
  const { top } = profileLists(plays, null);
  const both = top.find((p) => p.scoreId === 1)!;
  assert.deepEqual(
    both.places.map((x) => x.category).sort(),
    [RAW, PRECISION].sort(),
  );
  assert.deepEqual(top.find((p) => p.scoreId === 2)!.places, [{ category: RAW, place: 2 }]);
});

test("a play on a dropped label counts nowhere but still shows", () => {
  const { recent, top } = profileLists([play(1, 0, { categories: ["Flow Aim"] })], null);
  assert.equal(recent.length, 1);
  assert.deepEqual(top[0].places, []);
});

test("each list says what is worth what, and what landed since the last look", () => {
  const seenAt = new Date("2026-09-10T00:00:00Z");
  const plays = [
    play(1, 0, { at: "2026-09-20T00:00:00Z" }),
    play(2, 0, { at: "2026-09-01T00:00:00Z" }),
  ];
  const { recent } = profileLists(plays, seenAt);
  assert.equal(recent.find((p) => p.scoreId === 1)!.fresh, "new");
  assert.equal(recent.find((p) => p.scoreId === 2)!.fresh, null);
  // A clean clear of an Emerald map is that pack's value.
  assert.equal(recent[0].exp, tierByName("Emerald")!.exp);
  // Nothing is new on a first visit, or every score would be.
  assert.equal(profileLists(plays, null).recent.every((p) => p.fresh === null), true);
});

test("the two lists hold the same plays, worked out once", () => {
  const plays = newestFirst([play(1, 3), play(2, 20), play(3, 0), play(4, 60)]);
  const { recent, top } = profileLists(plays, null);
  assert.equal(recent.length, top.length);
  assert.deepEqual(
    recent.map((p) => p.scoreId).sort(),
    top.map((p) => p.scoreId).sort(),
  );
  for (const p of top) {
    const same = recent.find((r) => r.scoreId === p.scoreId)!;
    assert.equal(same.exp, p.exp);
    assert.deepEqual(same.places, p.places);
  }
});

test("no plays is two empty lists rather than a throw", () => {
  const { recent, top } = profileLists([], new Date());
  assert.deepEqual(recent, []);
  assert.deepEqual(top, []);
});
