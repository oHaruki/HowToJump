import type { CSSProperties } from "react";
import Link from "next/link";
import { GradeBadge, ModChip, mapHref } from "@/components/ui";
import type { Place } from "@/lib/levels";
import { shortCategory, tierByOrder, tierFill } from "@/lib/tiers";

/**
 * A profile's plays, osu! profile style: cover art behind each row, the map
 * and when, the grade, and on the right what it is worth. A play that counts
 * toward a category's level says where it stands among them, and one that
 * landed since the last look slides in carrying its pack's colour.
 */

export type PlayView = {
  scoreId: number;
  entryId: number;
  title: string;
  version: string | null;
  mapper: string | null;
  mod: string;
  tierOrder: number;
  categories: string[];
  grade: string;
  missCount: number;
  accuracy: number | null;
  playedAt: Date | null;
  osuBeatmapId: number;
  osuBeatmapsetId: number | null;
  exp: number;
  /** Where it stands among the plays counting toward each category, best first. */
  places: Place[];
  fresh: "new" | "improved" | null;
};

/** Rows shown before the rest fold away. */
const SHOWN = 8;

const fmt = (n: number) => Math.round(n).toLocaleString("en");

export function timeAgo(d: Date | null, now = Date.now()): string {
  if (!d) return "never";
  const mins = Math.round((now - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + " min ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + (hrs === 1 ? " hour ago" : " hours ago");
  const days = Math.round(hrs / 24);
  if (days < 31) return days + (days === 1 ? " day ago" : " days ago");
  return d.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}

export function PlayList({ plays, empty }: { plays: PlayView[]; empty: string }) {
  if (!plays.length) return <p className="small">{empty}</p>;
  const rest = plays.slice(SHOWN);
  return (
    <div className="plays">
      {plays.slice(0, SHOWN).map((p) => (
        <PlayRow key={p.scoreId} play={p} />
      ))}
      {rest.length ? (
        <details className="more">
          <summary>Show {rest.length} more</summary>
          <div className="plays">
            {rest.map((p) => (
              <PlayRow key={p.scoreId} play={p} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function PlayRow({ play: p }: { play: PlayView }) {
  const tier = tierByOrder(p.tierOrder);
  const colour = tier ? tier.color : "#777";
  const misses = p.missCount === 1 ? "1 miss" : p.missCount + " misses";
  const best = p.places[0];

  return (
    <article
      className="play"
      data-fresh={p.fresh ?? undefined}
      style={
        {
          "--pack": colour,
          "--art-fill":
            "linear-gradient(120deg, color-mix(in srgb, " + colour + " 30%, var(--bg-d)), var(--bg-d))",
        } as CSSProperties
      }
    >
      <div className="play-art">
        {p.osuBeatmapsetId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={"https://assets.ppy.sh/beatmaps/" + p.osuBeatmapsetId + "/covers/cover.jpg"}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : null}
      </div>
      <div className="play-in">
        <span className="play-gem" style={{ background: tierFill(tier) }} title={tier?.name} />
        <div className="play-info">
          <Link className="play-title" href={mapHref(p.osuBeatmapId, p.mod)}>
            {p.title}
            {p.version ? <span> [{p.version}]</span> : null}
          </Link>
          <div className="play-sub">
            {p.mod !== "NM" ? <ModChip mod={p.mod} /> : null}
            <span>{tier?.name}</span>
            <span aria-hidden>·</span>
            <span>{p.categories.map((c) => shortCategory(c)).join(" + ")}</span>
            <span aria-hidden>·</span>
            <span>{timeAgo(p.playedAt)}</span>
            {p.fresh ? <span className="chip fresh">{p.fresh}</span> : null}
          </div>
        </div>
        <div className="play-score">
          <GradeBadge grade={p.grade} />
          <span className="play-acc">
            {p.accuracy != null ? p.accuracy.toFixed(2) + "%" : "·"}
            <br />
            {misses}
          </span>
        </div>
        <div className="play-exp">
          <b>{fmt(p.exp)}</b>
          <span
            data-counts={best ? true : undefined}
            title={p.places.map((x) => "#" + x.place + " " + shortCategory(x.category)).join(", ") || undefined}
          >
            {best ? "#" + best.place + " " + shortCategory(best.category) : "EXP"}
            {p.places.length > 1 ? " +" + (p.places.length - 1) : null}
          </span>
        </div>
      </div>
    </article>
  );
}
