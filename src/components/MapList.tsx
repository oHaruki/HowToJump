import type { ReactNode } from "react";
import { MapCard, PackTile } from "@/components/MapCard";
import { CategoryChips, ModChip, PacingChips, mapHref } from "@/components/ui";
import type { BankRow } from "@/lib/queries";

/** The public bank. Read only, so the pack is a tile and there are no actions. */
export function MapList({ rows }: { rows: BankRow[] }) {
  if (!rows.length) {
    return <p className="small">Nothing matches those filters yet.</p>;
  }

  return (
    <div className="review-list">
      {rows.map((m) => (
        <BankCard key={m.entryId} map={m} />
      ))}
    </div>
  );
}

/** One bank entry as its card, with a player's score where a page has one. */
export function BankCard({
  map: m,
  score,
  tone,
}: {
  map: BankRow;
  score?: ReactNode;
  tone?: "muted";
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
      pack={<PackTile tierOrder={m.tierOrder} />}
      tags={
        <>
          <ModChip mod={m.mod} />
          <CategoryChips categories={m.categories} />
          <PacingChips length={m.lengthBucket} speed={m.speedBucket} />
        </>
      }
      score={score}
      tone={tone}
    />
  );
}
