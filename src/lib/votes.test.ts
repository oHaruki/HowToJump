/**
 * Run with: node --import tsx --test src/lib/votes.test.ts
 *
 * Pack votes: which packs a vote can name, and how the counts move. Stay
 * votes: who sits on which side, and which way they lean.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { NO_STAY, NO_VOTES, stayLean, voteFor, votedPack, withStay, withVote } from "./votes";

test("a vote names the pack below, the same one, or the one above", () => {
  assert.equal(votedPack(15, -1)?.name, "Amethyst");
  assert.equal(votedPack(15, 0)?.name, "Diamond");
  assert.equal(votedPack(15, 1)?.name, "GOAT");
});

test("there is no pack below Stone or above GOAT", () => {
  assert.equal(votedPack(1, -1), null);
  assert.equal(votedPack(16, 1), null);
});

test("a stored pack reads against wherever the entry sits now", () => {
  assert.equal(voteFor(15, 14), -1);
  assert.equal(voteFor(14, 14), 0);
  assert.equal(voteFor(13, 14), 1);
  assert.equal(voteFor(12, 14), null);
});

test("voting, moving a vote and taking it back keep the counts right", () => {
  const cast = withVote(NO_VOTES, -1);
  assert.deepEqual(cast, { down: 1, par: 0, up: 0, mine: -1 });
  const moved = withVote(cast, 1);
  assert.deepEqual(moved, { down: 0, par: 0, up: 1, mine: 1 });
  assert.deepEqual(withVote(moved, null), NO_VOTES);
});

test("a stay vote moves the voter's name between the two sides", () => {
  const cast = withStay(NO_STAY, false, "Kayrem");
  assert.deepEqual(cast, { stay: [], drop: ["Kayrem"], mine: false });
  const moved = withStay({ ...cast, stay: ["Haruki"] }, true, "Kayrem");
  assert.deepEqual(moved, { stay: ["Haruki", "Kayrem"], drop: [], mine: true });
  assert.deepEqual(withStay(moved, null, "Kayrem"), { stay: ["Haruki"], drop: [], mine: null });
});

test("the staff lean whichever way has more votes", () => {
  assert.equal(stayLean(NO_STAY), null);
  assert.equal(stayLean({ stay: ["a"], drop: ["b", "c"], mine: null }), "drop");
  assert.equal(stayLean({ stay: ["a", "b"], drop: ["c"], mine: null }), "stay");
  assert.equal(stayLean({ stay: ["a"], drop: ["b"], mine: null }), "split");
});
