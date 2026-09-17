import type { ReactNode } from "react";
import { Cover } from "@/components/Cover";
import { NONE } from "@/components/ui";
import { tierByOrder, tierFill } from "@/lib/tiers";

/**
 * One card, used by every surface that shows a map.
 *
 * Cover art fills it and fades to solid at the right, the pack sits on the
 * left, the map and its chips next, the figures right. The slots are what
 * differ: the bank shows the pack as a tile, staff screens put a control
 * there instead and add actions on the end.
 */
export function MapCard({
  osuBeatmapId,
  osuBeatmapsetId,
  title,
  version,
  mapper,
  tierOrder,
  stars,
  bpm,
  drain,
  cs,
  ar,
  od,
  pack,
  tags,
  actions,
  leading,
  status,
  tone,
  packEditable,
  extraStats,
  linkTitle = true,
}: {
  osuBeatmapId: number;
  osuBeatmapsetId: number | null;
  title: string | null;
  version: string | null;
  mapper: string | null;
  tierOrder: number | null;
  stars: number | null;
  bpm: number | null;
  drain: string;
  cs: number | null;
  ar: number | null;
  od: number | null;
  /** Left slot: a pack tile on the bank, a control on staff screens. */
  pack?: ReactNode;
  tags?: ReactNode;
  actions?: ReactNode;
  leading?: ReactNode;
  status?: ReactNode;
  tone?: "error" | "attention" | "muted";
  /** Widens the pack slot when it holds a control rather than a tile. */
  packEditable?: boolean;
  /** Appended to the figures, for surfaces with their own, like a score. */
  extraStats?: ReactNode;
  linkTitle?: boolean;
}) {
  const url = osuBeatmapsetId
    ? "https://osu.ppy.sh/beatmapsets/" + osuBeatmapsetId + "#osu/" + osuBeatmapId
    : "https://osu.ppy.sh/b/" + osuBeatmapId;
  const sub = [version ? "[" + version + "]" : "", mapper]
    .filter(Boolean)
    .join("  " + NONE + "  ");

  return (
    <article className="mapcard" data-tone={tone ?? ""}>
      <Cover
        setId={osuBeatmapsetId}
        kind="cover"
        tierOrder={tierOrder}
        className="mapcard-art"
        label={false}
      />

      <div className="mapcard-inner">
        {leading ? <div className="mapcard-lead">{leading}</div> : null}

        <div className="mapcard-left">
          {pack ? (
            <div className={"mapcard-pack" + (packEditable ? " editable" : "")}>
              {pack}
            </div>
          ) : null}

          <div className="mapcard-info">
            {linkTitle ? (
              <a
                className="mapcard-title"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {title || "beatmap " + osuBeatmapId}
              </a>
            ) : (
              <span className="mapcard-title">{title || "beatmap " + osuBeatmapId}</span>
            )}
            <span className="mapcard-sub">{sub}</span>
          </div>

          {tags ? <div className="mapcard-tags">{tags}</div> : null}
        </div>

        <div className="mapcard-stats">
          <span>
            <i>Stars</i>
            <b>{stars != null ? stars.toFixed(2) + "★" : NONE}</b>
          </span>
          <span>
            <i>BPM</i>
            <b>{bpm != null ? Math.round(bpm) : NONE}</b>
          </span>
          <span>
            <i>Length</i>
            <b>{drain || NONE}</b>
          </span>
          <span><i>CS</i><b>{cs ?? NONE}</b></span>
          <span><i>AR</i><b>{ar ?? NONE}</b></span>
          <span><i>OD</i><b>{od ?? NONE}</b></span>
          {extraStats}
        </div>

        {status ? <div className="mapcard-status">{status}</div> : null}
        {actions ? <div className="mapcard-actions">{actions}</div> : null}
      </div>
    </article>
  );
}

/** The pack as it appears on read-only surfaces. */
export function PackTile({ tierOrder }: { tierOrder: number | null }) {
  const tier = tierByOrder(tierOrder);
  return (
    <div className="packtile">
      <span className="packtile-gem" style={{ background: tierFill(tier) }} />
      <span className="packtile-name">{tier ? tier.name : "unassigned"}</span>
    </div>
  );
}
