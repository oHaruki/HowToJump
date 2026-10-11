/**
 * Run with: node --import tsx --test src/lib/changes.test.ts
 *
 * Covers the level changes a player's own plays didn't make: how each is
 * worded, how EXP is signed, how a total splits between plays and
 * readjustments, and which snapshots count as a move.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { changeText, signedExp, splitGain } from "./changes";
import { levelsMoved, packMoves, snapshotOf } from "./progress";
import { MAIN_LEVEL } from "./levels";
import { tierByName } from "./tiers";

const order = (name: string) => tierByName(name)!.order;

test("a map moved between packs says which way and where", () => {
  assert.equal(
    changeText("entry", { tier: [order("Emerald"), order("Sapphire")] }),
    "Moved down from Emerald to Sapphire",
  );
  assert.equal(
    changeText("entry", { tier: [order("Sapphire"), order("Emerald")] }),
    "Moved up from Sapphire to Emerald",
  );
});

test("special packs, removals, categories and mods each get their own words", () => {
  assert.equal(changeText("entry", { pack: [null, "Deleted Ruby"] }), "Moved to Deleted Ruby");
  assert.equal(changeText("entry", { pack: ["Deleted Ruby", null] }), "Back on the ladder");
  assert.equal(changeText("entry", { removed: true }), "Taken out of the bank");
  assert.equal(changeText("entry", { restored: true }), "Put back in the bank");
  assert.equal(changeText("entry", { categories: [["Precision"], ["Precision", "Gimmick"]] }), "Now Precision, Gimmick");
  assert.equal(changeText("entry", { mod: ["NM", "HR"] }), "Now banked under HR");
  assert.equal(changeText("entry", { mod: ["HR", "NM"] }), "Now banked without mods");
  assert.equal(
    changeText("entry", { tier: [order("Ruby"), order("Topaz")], mod: ["NM", "HR"] }),
    "Moved down from Ruby to Topaz · Now banked under HR",
  );
  assert.equal(changeText("entry", null), "Map re-judged");
});

test("changes that aren't about one map read on their own", () => {
  assert.equal(changeText("score", null), "Your score was removed");
  assert.equal(changeText("rules", null), "EXP rules updated");
  assert.equal(changeText("recheck", null), "Plays rechecked against osu!");
});

test("EXP is signed with a true minus, and zero reads ±0", () => {
  assert.equal(signedExp(15787), "+15,787");
  assert.equal(signedExp(-15787), "−15,787");
  assert.equal(signedExp(0), "±0");
  assert.equal(signedExp(-0.4), "±0");
});

test("a net change splits into what plays made and what readjustments made", () => {
  assert.deepEqual(splitGain(-15787, [{ exp: -17887 }]), { played: 2100, readjusted: -17887 });
  assert.deepEqual(splitGain(500, []), { played: 500, readjusted: 0 });
  assert.deepEqual(splitGain(0, [{ exp: -300 }, { exp: 300 }]), { played: 0, readjusted: 0 });
});

test("a snapshot moved when any level's EXP, pack or progress differs", () => {
  const before = snapshotOf([{ scope: MAIN_LEVEL, exp: 30000, tierOrder: 9, progress: 10 }]);
  assert.equal(levelsMoved(before, snapshotOf([{ scope: MAIN_LEVEL, exp: 30000, tierOrder: 9, progress: 10 }])), false);
  assert.equal(levelsMoved(before, snapshotOf([{ scope: MAIN_LEVEL, exp: 29000, tierOrder: 9, progress: 10 }])), true);
  assert.equal(levelsMoved(before, snapshotOf([{ scope: MAIN_LEVEL, exp: 30000, tierOrder: 9, progress: 11 }])), true);
  assert.equal(
    levelsMoved(before, snapshotOf([
      { scope: MAIN_LEVEL, exp: 30000, tierOrder: 9, progress: 10 },
      { scope: "Precision", exp: 10, tierOrder: null, progress: 1 },
    ])),
    true,
  );
});

test("pack moves list every level that changed pack, either way, main first", () => {
  const before = snapshotOf([
    { scope: MAIN_LEVEL, exp: 30000, tierOrder: 9, progress: 10 },
    { scope: "Precision", exp: 20000, tierOrder: 12, progress: 5 },
    { scope: "Gimmick", exp: 900, tierOrder: 1, progress: 40 },
  ]);
  const after = snapshotOf([
    { scope: MAIN_LEVEL, exp: 28000, tierOrder: 8, progress: 90 },
    { scope: "Precision", exp: 18000, tierOrder: 11, progress: 70 },
    { scope: "Gimmick", exp: 900, tierOrder: 1, progress: 40 },
  ]);
  assert.deepEqual(packMoves(before, after), [
    { scope: MAIN_LEVEL, from: 9, to: 8 },
    { scope: "Precision", from: 12, to: 11 },
  ]);
});
