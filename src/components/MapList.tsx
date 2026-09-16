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
 * The bank, one card per entry.
 *
 * Cover art fills the card and fades out to the right, so the map reads as
 * itself while the figures sit on solid ground. Title and chips take the left,
 * figures the right, which is what fills the width a table could not.
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
          <article className="mapcard" key={m.entryId}>
            <Cover
              setId={m.osuBeatmapsetId}
              kind="cover"
              tierOrder={m.tierOrder}
              className="mapcard-art"
              label={false}
            />

            <div className="mapcard-inner">
              <div className="mapcard-info">
                <a
                  className="mapcard-title"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {m.title}
                </a>
                <span className="mapcard-sub">
                  {[m.version ? "[" + m.version + "]" : "", m.mapper]
                    .filter(Boolean)
                    .join("  " + NONE + "  ")}
                </span>
                <div className="row-tight">
                  <TierChip tier={m.tierOrder} />
                  <ModChip mod={m.mod} />
                  <span className="chip">{m.category}</span>
                  {m.lengthBucket || m.speedBucket ? (
                    <span className="chip">
                      {[m.lengthBucket, m.speedBucket]
                        .filter(Boolean)
                        .join(" " + NONE + " ")}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mapcard-stats">
                <Stat
                  label="Stars"
                  value={m.stars != null ? m.stars.toFixed(2) + "★" : NONE}
                />
                <Stat label="BPM" value={m.bpm != null ? Math.round(m.bpm) : NONE} />
                <Stat label="Length" value={m.drain || NONE} />
                <Stat label="CS" value={m.cs ?? NONE} />
                <Stat label="AR" value={m.ar ?? NONE} />
                <Stat label="OD" value={m.od ?? NONE} />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
