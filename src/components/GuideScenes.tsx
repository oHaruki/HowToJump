import type { CSSProperties } from "react";
import { GradeLetter, ModIcons } from "@/components/ui";
import { BEST_PLAYS, type Level } from "@/lib/levels";
import { TIERS, tierByName, tierByOrder, tierFill } from "@/lib/tiers";

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
function Art({
  setId,
  kind,
  className,
}: {
  setId: number | null;
  kind: "cover" | "cover@2x" | "card";
  className: string;
}) {
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

/** The star the circles jump around, in the order they are hit. */
const STAR = [
  { x: 50, y: 15 },
  { x: 65, y: 51 },
  { x: 25, y: 29 },
  { x: 75, y: 29 },
  { x: 35, y: 51 },
];
/** Seconds between hits, and how long a circle shows before its hit. */
const BEAT = 0.5;
const APPROACH = 0.9;
/** Three times around the star, the fourth circle of the third missed. */
const CIRCLES = STAR.length * 3;
const MISSED = 13;
const LOOP = CIRCLES * BEAT;
/** A colour for each time around the star, as osu! cycles combo colours. */
const ROUND_COLOURS = ["Emerald", "Sapphire", "Rhodonite"].map((n) => tierByName(n)?.color ?? "#777");

/** The negative delay that puts second `t` of the loop at an animation's start. */
const delayAt = (t: number) => ((t % LOOP) + LOOP) % LOOP - LOOP + "s";

/** The combo after each circle, once the loop has gone round: up one per hit, back to 0 on the miss. */
function combos(): number[] {
  const out: number[] = [];
  let combo = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < CIRCLES; k++) {
      combo = k === MISSED ? 0 : combo + 1;
      if (pass) out.push(combo);
    }
  }
  return out;
}

/** The map being played in osu!: the combo builds circle by circle until a miss breaks it. */
export function PlayScene({ map, accuracy }: { map: GuideMap; accuracy: number }) {
  const path = Object.fromEntries(
    STAR.flatMap((at, i) => [["--x" + i, at.x + "cqw"], ["--y" + i, at.y + "cqw"]]),
  ) as CSSProperties;
  return (
    <div
      className="sc sc-play"
      role="img"
      aria-label={"Playing " + map.title + " in osu!: the combo builds, then one miss breaks it"}
    >
      <Art setId={map.setId} kind="cover@2x" className="scp-bg" />
      <span className="scp-hp" aria-hidden="true">
        <i />
      </span>
      <div className="scp-hud" aria-hidden="true">
        <span className="scp-acc">{accuracy.toFixed(2)}%</span>
        {map.mod !== "NM" ? <ModIcons mod={map.mod} /> : null}
      </div>
      {Array.from({ length: CIRCLES }, (_, k) => {
        const at = STAR[k % STAR.length];
        return (
          <span
            key={k}
            className="scp-hc"
            data-miss={k === MISSED || undefined}
            aria-hidden="true"
            style={
              {
                left: at.x + "cqw",
                top: at.y + "cqw",
                "--d": delayAt(k * BEAT - APPROACH),
                "--combo": ROUND_COLOURS[Math.floor(k / STAR.length)],
              } as CSSProperties
            }
          >
            <i className="scp-ring" />
            <i className="scp-body">{(k % STAR.length) + 1}</i>
            <i className="scp-judge">{k === MISSED ? "✕" : "300"}</i>
          </span>
        );
      })}
      <span className="scp-combo" aria-hidden="true">
        {combos().map((n, k) => (
          <b
            key={k}
            data-miss={k === MISSED || undefined}
            data-rest={k === MISSED - 1 || undefined}
            style={{ "--d": delayAt(k * BEAT) } as CSSProperties}
          >
            {n}
            <small>x</small>
          </b>
        ))}
      </span>
      <span className="scp-cursor" aria-hidden="true" style={path}>
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

/**
 * The score as it lands: its grade and EXP, then the map's skill filling
 * its bar from `before` and ranking up to where `after` sits.
 */
export function ExpScene({
  map,
  grade,
  misses,
  accuracy,
  exp,
  before,
  after,
}: {
  map: GuideMap;
  grade: string;
  misses: number;
  accuracy: number;
  exp: number;
  before: Level;
  after: Level;
}) {
  const skill = map.skill;
  const from = tierByOrder(before.tierOrder);
  const to = tierByOrder(after.tierOrder);
  return (
    <div
      className="sc sc-exp"
      role="img"
      aria-label={
        grade + ", " + misses + (misses === 1 ? " miss" : " misses") + " at " + accuracy.toFixed(2) +
        "%, worth " + fmt(exp) + " EXP, and " + skill + " reaching " + (to?.name ?? "the next pack")
      }
      style={
        {
          "--pack": to?.color ?? "#777",
          "--from-p": (before.progress ?? 0) / 100,
          "--to-p": (after.progress ?? 0) / 100,
        } as CSSProperties
      }
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
        <span className="sce-label">
          <span>{skill} level</span>
          <b>{fmt(after.exp)} EXP</b>
        </span>
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
