import Link from "next/link";
import { TIERS, tierByName, tierByOrder, tierFill, type Tier } from "@/lib/tiers";
import { modLabel } from "@/lib/mods";
import { Cover } from "@/components/Cover";

/** Middot stands in for an empty cell so a lone dash never reads as a minus. */
export const NONE = "·";

export function TierChip({ tier }: { tier: Tier | string | number | null }) {
  const t =
    typeof tier === "string"
      ? tierByName(tier)
      : typeof tier === "number"
        ? tierByOrder(tier)
        : tier;
  return (
    <span className="chip chip-tier">
      <span className="dot" style={{ background: tierFill(t) }} />
      {t ? t.name : "unassigned"}
    </span>
  );
}

export function ModChip({ mod }: { mod: string }) {
  const m = mod || "NM";
  return (
    <span className="chip chip-mod" data-nm={String(m === "NM")} title={modLabel(m)}>
      {m}
    </span>
  );
}

export function GradeBadge({ grade }: { grade: string }) {
  return <span className="grade-badge">{grade}</span>;
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="box box-tight scard">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

export type MapLike = {
  osuBeatmapId: number;
  osuBeatmapsetId: number | null;
  title: string | null;
  version: string | null;
  listUrl?: string | null;
  tierOrder?: number | null;
};

export function beatmapUrl(m: MapLike) {
  return m.osuBeatmapsetId
    ? "https://osu.ppy.sh/beatmapsets/" + m.osuBeatmapsetId + "#osu/" + m.osuBeatmapId
    : "https://osu.ppy.sh/b/" + m.osuBeatmapId;
}

/** Cover art. The 404 fallback lives in Cover, which needs the client. */
export function Thumb({ map }: { map: MapLike }) {
  return (
    <Cover
      setId={map.osuBeatmapsetId}
      tierOrder={map.tierOrder ?? null}
      className="thumb"
    />
  );
}

/** Wider card art, used where the background itself is worth judging. */
export function Banner({ map }: { map: MapLike }) {
  return (
    <Cover
      setId={map.osuBeatmapsetId}
      kind="card"
      tierOrder={map.tierOrder ?? null}
      className="banner"
    />
  );
}

export function MapCell({
  map,
  plain,
  banner,
}: {
  map: MapLike;
  plain?: boolean;
  banner?: boolean;
}) {
  return (
    <div className="map-cell">
      {banner ? <Banner map={map} /> : <Thumb map={map} />}
      <div style={{ minWidth: 0 }}>
        {plain ? (
          <span className="t-title">{map.title}</span>
        ) : (
          <a
            className="t-title"
            href={beatmapUrl(map)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {map.title}
          </a>
        )}
        {map.version ? <span className="t-diff">[{map.version}]</span> : null}
      </div>
    </div>
  );
}

export function SectionHead({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="section-head">
      <span className="lbl">{label}</span>
      <h1>{title}</h1>
      {children ? <p className="lede">{children}</p> : null}
    </div>
  );
}

export function Notice({
  kind = "",
  tag,
  children,
}: {
  kind?: "" | "api" | "warnline" | "bad";
  tag?: string;
  children: React.ReactNode;
}) {
  const chipClass =
    kind === "warnline" ? "chip warn" : kind === "bad" ? "chip bad" : "chip info";
  return (
    <div className={"notice " + kind}>
      {tag ? (
        <span className={chipClass} style={{ flex: "none" }}>
          {tag}
        </span>
      ) : null}
      <div>{children}</div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="small">{children}</p>;
}

export function LadderGrid({
  counts,
  hrefFor,
}: {
  counts: Map<number, number>;
  hrefFor?: (t: Tier) => string;
}) {
  return (
    <div className="ladder">
      {TIERS.map((t) => {
        const n = counts.get(t.order) ?? 0;
        return (
          <Link key={t.slug} className="gem" href={hrefFor ? hrefFor(t) : "/maps?pack=" + t.slug}>
            <span className="gem-swatch" style={{ background: tierFill(t) }} />
            <span>
              <span className="gem-name">{t.name}</span>
              <span className="gem-meta">
                #{t.order} {NONE} {n} {n === 1 ? "entry" : "entries"}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
