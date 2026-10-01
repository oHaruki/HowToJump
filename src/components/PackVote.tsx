"use client";

import { useState, useTransition } from "react";
import { votePack } from "@/lib/actions";
import { tierByOrder } from "@/lib/tiers";
import { votedPack, withVote, type PackVote as Vote, type VoteTally } from "@/lib/votes";

const CHOICES: Array<{ vote: Vote; symbol: string; key: "down" | "par" | "up"; says: string }> = [
  { vote: -1, symbol: "−", key: "down", says: "A pack lower" },
  { vote: 0, symbol: "=", key: "par", says: "On par" },
  { vote: 1, symbol: "+", key: "up", says: "A pack higher" },
];

/**
 * Three counters on whether a map sits in the right pack: a pack lower, on
 * par, or a pack higher. Everyone sees the counts. A signed in player clicks
 * one to vote and clicks it again to take the vote back. Named spells out
 * the pack each one points at.
 */
export function PackVote({
  entryId,
  tierOrder,
  tally,
  signedIn,
  named,
}: {
  entryId: number;
  tierOrder: number;
  tally: VoteTally;
  signedIn: boolean;
  named?: boolean;
}) {
  const [shown, setShown] = useState(tally);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const here = tierByOrder(tierOrder);

  function cast(vote: Vote) {
    if (!signedIn) {
      setNote("Sign in to vote");
      return;
    }
    if (pending) return;
    const next = shown.mine === vote ? null : vote;
    const before = shown;
    setShown(withVote(shown, next));
    setNote(null);
    start(async () => {
      try {
        const res = await votePack(entryId, next === null ? null : tierOrder + next);
        setShown(res.error ? before : res.tally);
        if (res.error) setNote(res.error);
      } catch {
        setShown(before);
        setNote("Vote failed, try again");
      }
    });
  }

  return (
    <span className="pvote">
      <span className="pvote-group" role="group" aria-label={"Is " + (here?.name ?? "this") + " the right pack?"}>
        {CHOICES.map((c) => {
          const pack = votedPack(tierOrder, c.vote);
          const mine = shown.mine === c.vote;
          const title = pack
            ? c.says + ": " + pack.name + (mine ? ". Your vote, click to take it back" : "")
            : (here?.name ?? "This") + (c.vote < 0 ? " is the lowest pack" : " is the top pack");
          return (
            <button
              key={c.key}
              className="pvote-btn"
              type="button"
              aria-pressed={mine}
              disabled={!pack}
              title={title}
              aria-label={title + ", " + shown[c.key] + (shown[c.key] === 1 ? " vote" : " votes")}
              onClick={() => cast(c.vote)}
            >
              <span className="pvote-sym">{c.symbol}</span>
              {named && pack ? <span className="pvote-pack">{pack.name}</span> : null}
              <b>{shown[c.key]}</b>
            </button>
          );
        })}
      </span>
      {note ? <span className="pvote-note" role="status">{note}</span> : null}
    </span>
  );
}
