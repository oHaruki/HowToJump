/**
 * Run with: node --import tsx --test src/lib/osu/plan.test.ts
 *
 * Covers who a sync pass picks: a play count rise, a retry for a play that
 * had not shown up yet, and the daily backstop, in that order and under a cap.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { planPass, type PlayCountReading } from "./plan";

const reading = (userId: number, stored: number | null, fetched: number | undefined): PlayCountReading => ({
  userId,
  stored,
  fetched,
});

test("only a rise in play count makes a player due", () => {
  const { now } = planPass({
    readings: [
      reading(1, 100, 101), // played
      reading(2, 100, 100), // did not
      reading(3, null, 50), // first reading: record it, nothing to compare
      reading(4, 100, undefined), // osu! did not return them
      reading(5, 100, 90), // went down: nothing new to fetch
    ],
    retrying: [],
    overdue: [],
    max: 40,
  });
  assert.deepEqual(now, [{ userId: 1, reason: "played" }]);
});

test("played comes before retries, retries before the backstop, each player once", () => {
  const { now, deferred } = planPass({
    readings: [reading(1, 5, 6), reading(2, 5, 6)],
    retrying: [3, 1],
    overdue: [4, 2, 3],
    max: 40,
  });
  assert.deepEqual(now, [
    { userId: 1, reason: "played" },
    { userId: 2, reason: "played" },
    { userId: 3, reason: "retry" },
    { userId: 4, reason: "backstop" },
  ]);
  assert.deepEqual(deferred, []);
});

test("over the cap, players who played wait for the next pass and the backstop just waits", () => {
  const { now, deferred } = planPass({
    readings: [reading(1, 5, 6), reading(2, 5, 6), reading(3, 5, 7)],
    retrying: [4],
    overdue: [5, 6],
    max: 2,
  });
  assert.deepEqual(now, [
    { userId: 1, reason: "played" },
    { userId: 2, reason: "played" },
  ]);
  assert.deepEqual(deferred, [3, 4]);
});

test("a cap of zero syncs nobody and defers everyone who played", () => {
  const { now, deferred } = planPass({
    readings: [reading(1, 5, 6)],
    retrying: [2],
    overdue: [3],
    max: 0,
  });
  assert.deepEqual(now, []);
  assert.deepEqual(deferred, [1, 2]);
});
