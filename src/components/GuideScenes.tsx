import type { CSSProperties } from "react";
import { GradeLetter, ModIcons } from "@/components/ui";
import { BEST_PLAYS } from "@/lib/levels";
import { TIERS, tierByOrder, tierFill } from "@/lib/tiers";

/**
 * The how to play page's pictures: small scenes drawn from the site's own
 * pieces, each playing on a loop in CSS. Under reduced motion each one
 * holds a single frame of its story.
 */

/** A map as the scenes draw it. */
export type GuideMap = {
  osuBeatmapId: number;
  setId: number | null;
  title: string;
  version: string | null;
  mapper: string | null;
  mod: string;
  tierOrder: number;
  stars: number | null;
  /** The first skill the map is judged on, short. */
  skill: string;
};

const fmt = (n: number) => Math.round(n).toLocaleString("en");

/** A map's cover from osu!, or nothing when the set has none. */
function Art({ setId, kind, className }: { setId: number | null; kind: "cover" | "card"; className: string }) {
  return (
    <span className={className}>
      {setId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={"https://assets.ppy.sh/beatmaps/" + setId + "/covers/" + kind + ".jpg"}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : null}
    </span>
  );
}

/** A mouse pointer, its tip at the top left. */
function Pointer({ className }: { className: string }) {
  return (
    <svg className={"sc-pointer " + className} viewBox="0 0 16 22" aria-hidden="true">
      <path d="M1.5 1.5v15.8l4-3.9 2.6 6 2.9-1.3-2.6-5.9h5.5Z" />
    </svg>
  );
}

/** Sign in with osu! in the nav, then Allow on osu!, then signed in. */
export function LoginScene({ site }: { site: string }) {
  return (
    <div className="sc sc-login" role="img" aria-label="Sign in with osu! at the top right, then Allow on osu!">
      <div className="scl-bar" aria-hidden="true">
        <span className="scl-brand">
          <i />
          {site}
        </span>
        <span className="scl-links">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="scl-signin">Sign in with osu!</span>
        <span className="scl-me">
          <i />
          You
        </span>
      </div>
      <div className="scl-hero" aria-hidden="true">
        <b>Ranked osu! Aim</b>
        <i />
        <i />
        <span>
          <u />
          <u />
        </span>
      </div>
      <span className="scl-gems" aria-hidden="true">
        {TIERS.filter((t) => t.order % 2 === 0).map((t) => (
          <i key={t.slug} style={{ background: tierFill(t) }} />
        ))}
      </span>
      <span className="scl-dim" />
      <div className="scl-auth" aria-hidden="true">
        <span className="scl-osu">osu!</span>
        <b>{site} would like to</b>
        <ul>
          <li>Know who you are</li>
          <li>Read your public plays</li>
        </ul>
        <span className="scl-allow">Allow</span>
      </div>
      <span className="scl-toast" aria-hidden="true">
        <b>✓</b> Signed in with osu!
      </span>
      <span className="sc-tap scl-tap1" />
      <span className="sc-tap scl-tap2" />
      <Pointer className="scl-pointer" />
    </div>
  );
}

/** The bank, and osu!direct pressed on the middle map until it is in osu!. */
export function BankScene({ maps, pick }: { maps: GuideMap[]; pick: number }) {
  return (
    <div
      className="sc sc-bank"
      role="img"
      aria-label={"The map bank, with osu!direct pressed on " + maps[pick].title}
    >
      <div className="scb-filters" aria-hidden="true">
        <span className="scb-search">
          <svg viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          Title, difficulty or mapper
        </span>
        <span className="scb-pill" data-on="true">
          Pack <b>1</b>
        </span>
        <span className="scb-pill">Category</span>
        <span className="scb-pill">Mod</span>
      </div>
      <div className="scb-list" aria-hidden="true">
        {maps.map((m, i) => {
          const tier = tierByOrder(m.tierOrder);
          return (
            <div
              key={m.osuBeatmapId + m.mod}
              className="scb-card"
              data-pick={i === pick || undefined}
              style={{ "--pack": tier?.color ?? "#777" } as CSSProperties}
            >
              <Art setId={m.setId} kind="cover" className="scb-art" />
              <span className="scb-pack">
                <i style={{ background: tierFill(tier) }} />
                {tier?.name}
              </span>
              <span className="scb-info">
                <b>{m.title}</b>
                <span>{[m.version ? "[" + m.version + "]" : "", m.mapper].filter(Boolean).join(" · ")}</span>
                <span className="scb-links">
                  <span className="scb-direct">
                    <u>↓ osu!direct</u>
                    {i === pick ? <em>✓ In osu!</em> : null}
                  </span>
                  <span>osu! page ↗</span>
                </span>
              </span>
              <span className="scb-stats">
                <ModIcons mod={m.mod} />
                <b>{m.stars != null ? m.stars.toFixed(2) + "★" : ""}</b>
              </span>
              {i === pick ? (
                <span className="scb-dl">
                  <i />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <span className="sc-tap scb-tap" />
      <Pointer className="scb-pointer" />
    </div>
  );
}

/**
 * A five point star jump, one circle every half second. The delays put
 * each circle's hit on its half second of the loop; the fourth is missed.
 */
const CIRCLES = [
  { x: 50, y: 15, delay: "-0.9s" },
  { x: 65, y: 51, delay: "-0.4s" },
  { x: 25, y: 29, delay: "-2.4s" },
  { x: 75, y: 29, delay: "-1.9s", miss: true },
  { x: 35, y: 51, delay: "-1.4s" },
];

/** The map being played in osu!, with its mods on the HUD. */
export function PlayScene({ map, accuracy, combo }: { map: GuideMap; accuracy: number; combo: number }) {
  return (
    <div className="sc sc-play" role="img" aria-label={"Playing " + map.title + " in osu!, one miss in five"}>
      <Art setId={map.setId} kind="cover" className="scp-bg" />
      <span className="scp-hp" aria-hidden="true">
        <i />
      </span>
      <div className="scp-hud" aria-hidden="true">
        <b className="scp-score">00412880</b>
        <span className="scp-acc">{accuracy.toFixed(2)}%</span>
        {map.mod !== "NM" ? <ModIcons mod={map.mod} /> : null}
      </div>
      {CIRCLES.map((c, i) => (
        <span
          key={i}
          className="scp-hc"
          data-miss={c.miss || undefined}
          aria-hidden="true"
          style={{ left: c.x + "cqw", top: c.y + "cqw", "--d": c.delay } as CSSProperties}
        >
          <i className="scp-ring" />
          <i className="scp-body">{i + 1}</i>
          <i className="scp-judge">{c.miss ? "✕" : "300"}</i>
        </span>
      ))}
      <b className="scp-combo" aria-hidden="true">
        {combo}
        <small>x</small>
      </b>
      <span className="scp-cursor" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

/** The score as it lands: its grade and EXP, then a skill reaching the next pack. */
export function ExpScene({
  map,
  grade,
  misses,
  accuracy,
  exp,
}: {
  map: GuideMap;
  grade: string;
  misses: number;
  accuracy: number;
  exp: number;
}) {
  const skill = map.skill;
  const to = tierByOrder(map.tierOrder);
  const from = tierByOrder(map.tierOrder - 1);
  return (
    <div
      className="sc sc-exp"
      role="img"
      aria-label={
        grade + ", " + misses + (misses === 1 ? " miss" : " misses") + " at " + accuracy.toFixed(2) +
        "%, worth " + fmt(exp) + " EXP, and " + skill + " reaching " + (to?.name ?? "the next pack")
      }
      style={{ "--pack": to?.color ?? "#777" } as CSSProperties}
    >
      <div className="sce-card" aria-hidden="true">
        <Art setId={map.setId} kind="card" className="sce-art" />
        <GradeLetter grade={grade} />
        <span className="sce-map">
          <b>
            {map.title}
            {map.version ? <span> [{map.version}]</span> : null}
          </b>
          <span>
            New score · {misses} {misses === 1 ? "miss" : "misses"} · {accuracy.toFixed(2)}%
          </span>
        </span>
        <span className="sce-gain">
          +{fmt(exp)}
          <small>EXP</small>
        </span>
      </div>
      <div className="sce-level" aria-hidden="true">
        <span className="sce-label">{skill} level</span>
        <span className="sce-tier">
          <span className="sce-gems">
            <i data-empty={from ? undefined : true} style={from ? { background: tierFill(from) } : undefined} />
            <i style={{ background: tierFill(to) }} />
            <b className="sce-burst" />
          </span>
          <span className="sce-names">
            <b>{from?.name ?? "Unranked"}</b>
            <b>{to?.name}</b>
          </span>
          <span className="sce-ribbon">Rank up!</span>
        </span>
        <span className="sce-bar">
          <i style={{ background: from ? tierFill(from) : "#777" }} />
          <i style={{ background: tierFill(to) }} />
        </span>
        <span className="sce-foot">
          Your best {BEST_PLAYS} {skill} plays add up to this level
        </span>
      </div>
    </div>
  );
}
