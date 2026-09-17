import { MapCard, PackTile } from "@/components/MapCard";
import { ModChip, NONE } from "@/components/ui";
import type { BankRow } from "@/lib/queries";

/** The public bank. Read only, so the pack is a tile and there are no actions. */
export function MapList({ rows }: { rows: BankRow[] }) {
  if (!rows.length) {
    return <p className="small">Nothing matches those filters yet.</p>;
  }

  return (
    <div className="review-list">
      {rows.map((m) => {
        const pacing = [m.lengthBucket, m.speedBucket]
          .filter(Boolean)
          .join(" " + NONE + " ");
        return (
          <MapCard
            key={m.entryId}
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
            pack={<PackTile tierOrder={m.tierOrder} />}
            tags={
              <>
                <ModChip mod={m.mod} />
                <span className="chip">{m.category}</span>
                {pacing ? <span className="chip">{pacing}</span> : null}
              </>
            }
          />
        );
      })}
    </div>
  );
}
