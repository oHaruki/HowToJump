import { tierByOrder, type Tier } from "@/lib/tiers";

/** A pack lower, on par, or a pack higher than where the entry sits. */
export type PackVote = -1 | 0 | 1;

/** An entry's counts, and the signed in player's own vote. */
export type VoteTally = { down: number; par: number; up: number; mine: PackVote | null };

export const NO_VOTES: VoteTally = { down: 0, par: 0, up: 0, mine: null };

function keyOf(vote: PackVote): "down" | "par" | "up" {
  return vote < 0 ? "down" : vote > 0 ? "up" : "par";
}

/** The pack a vote names, null past either end of the ladder. */
export function votedPack(tierOrder: number, vote: PackVote): Tier | null {
  return tierByOrder(tierOrder + vote);
}

/** A voted pack against the entry's own, null when it is not a neighbour. */
export function voteFor(entryTier: number, votedTier: number): PackVote | null {
  const d = votedTier - entryTier;
  return d === -1 || d === 0 || d === 1 ? (d as PackVote) : null;
}

/** The counts once the player's vote moves, or is taken back with null. */
export function withVote(t: VoteTally, vote: PackVote | null): VoteTally {
  const next = { ...t, mine: vote };
  if (t.mine !== null) next[keyOf(t.mine)] -= 1;
  if (vote !== null) next[keyOf(vote)] += 1;
  return next;
}
