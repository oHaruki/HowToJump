import { Cover } from "@/components/Cover";
import { ModChip, NONE, TierChip } from "@/components/ui";
import type { BankRow } from "@/lib/queries";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span>
      <i>{label}</i>
      <b>{value}</b>
    </span>
  );
}

/**
 * The bank as cards rather than a table.
 *
 * Eleven columns of figures plus cover art does not fit on one screen, and a
 * horizontal scrollbar hides exactly the things people come here to compare.
 * The same shape as the review queue, minus the controls.
 */
export function MapList({ rows }: { rows: BankRow[] }) {
  if (!rows.length) {
    return <p className="small">Nothing matches those filters yet.</p>;
  }

  return (
    <div className="review-list">
      {rows.map((m) => {
        const url = m.osuBeatmapsetId
          ? "https://osu.ppy.sh/beatmapsets/" + m.osuBeatmapsetId + "#osu/" + m.osuBeatmapId
          : "https://osu.ppy.sh/b/" + m.osuBeatmapId;
        return (
          <div className="review-card map-card" key={m.entryId}>
            <Cover
              setId={m.osuBeatmapsetId}
              kind="card"
              tierOrder={m.tierOrder}
              className="review-art"
            />

            <div className="review-body">
              <div>
                <a className="t-title" href={url} target="_blank" rel="noopener noreferrer">
                  {m.title}
                </a>
                <span className="t-diff">
                  {[m.version ? "[" + m.version + "]" : "", m.mapper]
                    .filter(Boolean)
                    .join("  " + NONE + "  ")}
                </span>
              </div>

              <div className="statline">
                <Stat
                  label="Stars"
                  value={m.stars != null ? m.stars.toFixed(2) + "★" : NONE}
                />
                <Stat label="BPM" value={m.bpm != null ? Math.round(m.bpm) : NONE} />
                <Stat label="Length" value={m.drain || NONE} />
                <Stat label="CS" value={m.cs ?? NONE} />
                <Stat label="AR" value={m.ar ?? NONE} />
                <Stat label="OD" value={m.od ?? NONE} />
                <Stat
                  label="Pacing"
                  value={
                    [m.lengthBucket, m.speedBucket].filter(Boolean).join(" " + NONE + " ") ||
                    NONE
                  }
                />
              </div>

              <div className="review-controls">
                <TierChip tier={m.tierOrder} />
                <ModChip mod={m.mod} />
                <span className="chip">{m.category}</span>
                {m.judgedByName ? (
                  <span className="small">judged by {m.judgedByName}</span>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
