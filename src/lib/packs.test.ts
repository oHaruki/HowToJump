/**
 * Run with: node --import tsx --test src/lib/packs.test.ts
 *
 * Special packs: how a pack's board ranks players, and what an admin may
 * call one.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  packColor, packDescription, packNameProblem, packStandings, specialPackId, type PackPlay,
} from "./packs";
import { playExp } from "./levels";

const play = (userId: number, over: Partial<PackPlay> = {}): PackPlay => ({
  userId,
  tierOrder: 10,
  grade: "SS",
  missCount: 0,
  noteCount: 1500,
  accuracy: null,
  isFc: true,
  ...over,
});

test("a pack's board adds up the EXP of every map, most first", () => {
  const board = packStandings([
    play(1, { tierOrder: 15 }),
    play(2),
    play(2),
    play(3, { tierOrder: 11, grade: "A", missCount: 2, isFc: false }),
  ]);
  assert.deepEqual(board.map((s) => s.userId), [1, 2, 3]);
  assert.deepEqual(board.map((s) => s.rank), [1, 2, 3]);
  assert.equal(board[0].exp, playExp(15, "SS", 0));
  assert.equal(board[1].exp, 2 * playExp(10, "SS", 0));
  assert.equal(board[1].clears, 2);
  assert.equal(board[1].fcs, 2);
  assert.equal(board[1].ss, 2);
  assert.equal(board[2].fcs, 0);
});

test("the same EXP and clears go to the older account", () => {
  assert.deepEqual(
    packStandings([play(9), play(7)]).map((s) => s.userId),
    [7, 9],
  );
});

test("an empty pack has an empty board", () => {
  assert.deepEqual(packStandings([]), []);
});

test("a pack name can't be empty, a ladder pack's, or one already taken", () => {
  assert.equal(packNameProblem("Summer event", []), null);
  assert.match(packNameProblem("", []) ?? "", /name/);
  assert.match(packNameProblem("gold", []) ?? "", /ladder/);
  assert.match(packNameProblem("Opal", []) ?? "", /ladder/);
  assert.match(packNameProblem("SUMMER EVENT", ["Summer event"]) ?? "", /already/);
  assert.match(packNameProblem("x".repeat(41), []) ?? "", /40/);
});

test("a colour must be #rrggbb, and a description is trimmed or dropped", () => {
  assert.equal(packColor("#FF8800"), "#ff8800");
  assert.equal(packColor("ff8800"), null);
  assert.equal(packColor("#f80"), null);
  assert.equal(packDescription("  "), null);
  assert.equal(packDescription(" Aim event "), "Aim event");
  assert.equal(packDescription("y".repeat(400))?.length, 300);
});

test("a filter key names a special pack by ID, and a ladder pack by slug", () => {
  assert.equal(specialPackId("12"), 12);
  assert.equal(specialPackId("gold"), null);
  assert.equal(specialPackId(""), null);
});
