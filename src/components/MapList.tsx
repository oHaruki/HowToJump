import type { ReactNode } from "react";
import { MapCard, PackTile } from "@/components/MapCard";
import { PackVote } from "@/components/PackVote";
import { CategoryChips, ModChip, PacingChips, mapHref } from "@/components/ui";
import type { BankRow } from "@/lib/queries";
import { timeAgo } from "@/lib/time";
import { NO_VOTES, type VoteTally } from "@/lib/votes";

/** The public bank: the pack as a tile, and players' votes on it. */
export function MapList({
  rows,
  votes,
  signedIn,
  showAdded,
}: {
  rows: BankRow[];
  votes: Map<number, VoteTally>;
  signedIn: boolean;
  /** Adds when each entry was added. */
  showAdded?: boolean;
}) {
  if (!rows.length) {
    return <p className="small">Nothing matches those filters yet.</p>;
  }

  return (
    <div className="review-list">
      {rows.map((m) => (
        <BankCard
          key={m.entryId}
          map={m}
          votes={{ tally: votes.get(m.entryId) ?? NO_VOTES, signedIn }}
          added={showAdded ? m.createdAt : undefined}
        />
      ))}
    </div>
  );
}

/**
 * One bank entry as its card, with a player's score or the pack votes where
 * a page has them.
 */
export function BankCard({
  map: m,
  score,
  tone,
  votes,
  added,
}: {
  map: BankRow;
  score?: ReactNode;
  tone?: "muted";
  votes?: { tally: VoteTally; signedIn: boolean };
  added?: Date;
}) {
  return (
    <MapCard
      osuBeatmapId={m.osuBeatmapId}
      osuBeatmapsetId={m.osuBeatmapsetId}
      title={m.title}
      version={m.version}
      mapper={m.mapper}
      tierOrder={m.tierOrder}
      stars={m.stars}
      bpm={m.bpm}
      drain={m.drain}
      cs={m.cs}
      ar={m.ar}
      od={m.od}
      href={mapHref(m.osuBeatmapId, m.mod)}
      copyId
      pack={<PackTile tierOrder={m.tierOrder} />}
      tags={
        <>
          <ModChip mod={m.mod} />
          <CategoryChips categories={m.categories} />
          <PacingChips length={m.lengthBucket} speed={m.speedBucket} />
          {added ? <span className="small">Added {timeAgo(added)}</span> : null}
          {votes ? (
            <PackVote
              entryId={m.entryId}
              tierOrder={m.tierOrder}
              tally={votes.tally}
              signedIn={votes.signedIn}
            />
          ) : null}
        </>
      }
      score={score}
      tone={tone}
    />
  );
}
