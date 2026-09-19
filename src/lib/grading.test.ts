/**
 * Run with: node --import tsx --test src/lib/grading.test.ts
 *
 * Misses by map size, as Kayrem settled it: a 1,500 note map counts as it
 * is, shorter maps make each miss count more on the gentle curve, and only
 * the EXP moves. The grade always reads the real misses.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { expShare, gradeFor, missFactor, scaledMisses } from "./grading";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.01, a + " is not " + b);

test("a 1,500 note map counts ×1, a 150 note map about ×3", () => {
  assert.equal(missFactor(1500), 1);
  near(missFactor(150), 3.16);
  near(missFactor(500), 1.73);
  near(missFactor(3000), 0.71);
  // A map osu! has not given a count for yet counts as it always did.
  assert.equal(missFactor(null), 1);
  assert.equal(missFactor(0), 1);
});

test("scaled misses round, and a miss never counts as none", () => {
  assert.equal(scaledMisses(0, 150), 0);
  assert.equal(scaledMisses(1, 150), 3);
  assert.equal(scaledMisses(2, 150), 6);
  assert.equal(scaledMisses(2, 1500), 2);
  assert.equal(scaledMisses(1, 3000), 1);
  assert.equal(scaledMisses(2, 3000), 1);
  assert.equal(scaledMisses(3, 3000), 2);
});

test("misses earn the share of what they count as", () => {
  assert.equal(expShare("A+", 1, 150), 65); // counts as 3: A-
  assert.equal(expShare("A", 2, 150), 50); // counts as 6: B
  assert.equal(expShare("A+", 1, 500), 75); // counts as 2: A
  assert.equal(expShare("A+", 1, 1500), 85); // as it is
  assert.equal(expShare("A", 2, 3000), 85); // counts as 1: A+
  assert.equal(expShare("A", 2, null), 75); // no count yet
});

test("full combos, 100% runs and clean passes are never scaled", () => {
  assert.equal(expShare("SSS", 0, 150), 120);
  assert.equal(expShare("SS", 0, 150), 100);
  assert.equal(expShare("S", 0, 150), 100);
});

test("the grade itself reads the real misses on any map", () => {
  assert.equal(gradeFor({ missCount: 1, isFc: false, isPerfect: false }), "A+");
  assert.equal(gradeFor({ missCount: 2, isFc: false, isPerfect: false }), "A");
});
