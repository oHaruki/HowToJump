import { Cover } from "@/components/Cover";
import { ModChip, NONE } from "@/components/ui";
import { tierByOrder, tierFill } from "@/lib/tiers";
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
 * Four bands across: the pack, the map, what it is banked as, and the
 * figures. Cover art fills the card behind all of it and goes solid at the
 * right so the numbers stay readable.
 */
export function MapList({ rows }: { rows: BankRow[] }) {
  if (!rows.length) {
    return <p className="small">Nothing matches those filters yet.</p>;
  }

  return (
    <div className="review-list">
      {rows.map((m) => {
        const tier = tierByOrder(m.tierOrder);
        const url = m.osuBeatmapsetId
          ? "https://osu.ppy.sh/beatmapsets/" + m.osuBeatmapsetId + "#osu/" + m.osuBeatmapId
          : "https://osu.ppy.sh/b/" + m.osuBeatmapId;
        const pacing = [m.lengthBucket, m.speedBucket]
          .filter(Boolean)
          .join(" " + NONE + " ");

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
              <div className="mapcard-left">
              <div className="packtile">
                <span className="packtile-gem" style={{ background: tierFill(tier) }} />
                <span className="packtile-name">{tier ? tier.name : "unassigned"}</span>
              </div>

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
              </div>

              <div className="mapcard-tags">
                <ModChip mod={m.mod} />
                <span className="chip">{m.category}</span>
                {pacing ? <span className="chip">{pacing}</span> : null}
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
