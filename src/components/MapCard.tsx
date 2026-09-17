import type { CSSProperties, ReactNode } from "react";
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
      <CardArt setId={osuBeatmapsetId} tierOrder={tierOrder} />

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

/**
 * The art behind a card: a pack tinted gradient with the cover over it.
 *
 * osu! serves every set from a predictable URL, but old sets genuinely have
 * no cover uploaded and 404 there, and nothing in the metadata says which.
 * The gradient is painted underneath rather than swapped in, so a 404 just
 * leaves it showing.
 *
 * Doing it this way, instead of with Cover's onError, fixes the case that
 * matters and drops the client component. An image that 404s does so while
 * the page is still loading, before React has attached anything, so the
 * error never reaches a handler: the fallback only ever fired for a set with
 * no ID at all, and a real 404 sat there showing the browser's broken image
 * icon. The gradient under a failed image needs no JavaScript, and a bank
 * page is forty eight cards that no longer wait on hydration to look right.
 */
function CardArt({
  setId,
  tierOrder,
}: {
  setId: number | null;
  tierOrder: number | null;
}) {
  const tier = tierByOrder(tierOrder);
  // Read by the layer and by the patch over a broken image, so one value
  // cannot drift from the other.
  const fill =
    "linear-gradient(120deg, color-mix(in srgb, " +
    (tier ? tier.color : "#777") +
    " 26%, var(--bg-d)), var(--bg-d))";

  return (
    <div className="mapcard-art" style={{ "--art-fill": fill } as CSSProperties}>
      {setId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={"https://assets.ppy.sh/beatmaps/" + setId + "/covers/cover.jpg"}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : null}
    </div>
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
