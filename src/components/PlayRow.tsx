"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { GradeLetter, ModIcons, mapHref } from "@/components/ui";
import type { Place } from "@/lib/levels";
import { shortCategory, tierByOrder, tierFill } from "@/lib/tiers";
import { timeAgo } from "@/lib/time";

/**
 * One play as a slim row: place, grade, the map, then mods, accuracy,
 * misses and EXP in columns of one width, with the cover art fading in from
 * the left. A client component, since the fold below a list draws these in
 * the browser too.
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

const fmt = (n: number) => Math.round(n).toLocaleString("en");

/**
 * `rank` is the play's place in its list, shown first. With a `category`,
 * the place under the EXP is the one in that category.
 */
export function PlayRow({
  play: p,
  rank,
  category,
}: {
  play: PlayView;
  rank?: number;
  category?: string | null;
}) {
  const tier = tierByOrder(p.tierOrder);
  const colour = tier ? tier.color : "#777";
  const shown = category ? p.places.find((x) => x.category === category) : p.places[0];

  return (
    <article
      className="play"
      data-fresh={p.fresh ?? undefined}
      style={
        {
          "--pack": colour,
          "--art-fill":
            "linear-gradient(120deg, color-mix(in srgb, " + colour + " 45%, var(--bg-d)), var(--bg-d))",
        } as CSSProperties
      }
    >
      <div className="play-art">
        {p.osuBeatmapsetId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={"https://assets.ppy.sh/beatmaps/" + p.osuBeatmapsetId + "/covers/card.jpg"}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : null}
      </div>
      {rank != null ? <span className="play-rank">#{rank}</span> : null}
      <span className="play-grade">
        <GradeLetter grade={p.grade} />
      </span>
      <div className="play-info">
        <Link className="play-title" href={mapHref(p.osuBeatmapId, p.mod)}>
          {p.title}
          {p.version ? <span> [{p.version}]</span> : null}
        </Link>
        <div className="play-sub">
          <span className="play-gem" style={{ background: tierFill(tier) }} />
          <span>{tier?.name}</span>
          <span aria-hidden>·</span>
          <span>{p.categories.map((c) => shortCategory(c)).join(" + ")}</span>
          <span aria-hidden>·</span>
          <span>{timeAgo(p.playedAt)}</span>
          {p.fresh ? <span className="chip fresh">{p.fresh}</span> : null}
        </div>
      </div>
      <div className="play-stats">
        <span className="play-mods">{p.mod !== "NM" ? <ModIcons mod={p.mod} /> : null}</span>
        <span className="play-acc">{p.accuracy != null ? p.accuracy.toFixed(2) + "%" : "·"}</span>
        <span className="play-miss" data-zero={p.missCount === 0 || undefined}>
          {p.missCount}
          <i>{p.missCount === 1 ? " miss" : " misses"}</i>
        </span>
      </div>
      <div className="play-exp">
        <b>{fmt(p.exp)}</b>
        <span
          data-counts={shown ? true : undefined}
          title={p.places.map((x) => "#" + x.place + " " + shortCategory(x.category)).join(", ") || undefined}
        >
          {shown ? "#" + shown.place + " " + shortCategory(shown.category) : "EXP"}
          {!category && p.places.length > 1 ? " +" + (p.places.length - 1) : null}
        </span>
      </div>
    </article>
  );
}
