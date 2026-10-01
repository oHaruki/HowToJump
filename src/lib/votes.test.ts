/**
 * Run with: node --import tsx --test src/lib/votes.test.ts
 *
 * Pack votes: which packs a vote can name, and how the counts move.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { NO_VOTES, voteFor, votedPack, withVote } from "./votes";

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
