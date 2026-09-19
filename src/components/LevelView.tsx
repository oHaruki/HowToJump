import type { CSSProperties } from "react";
import { levelValue } from "@/lib/levels";
import { TIERS, tierByOrder, tierFill } from "@/lib/tiers";

/**
 * Levels as the profile page shows them: still, at where the player is now.
 * Anything that moves happens in the level up popup, once the player asks
 * for it, so a page left open never plays to nobody.
 */

type Level = { exp: number; tierOrder: number | null; progress: number | null };

const fmt = (n: number) => Math.round(n).toLocaleString("en");
const TOP = TIERS[TIERS.length - 1].order;

/**
 * The pack a point along the ladder sits in, and how far through it.
 * Shared with the popup, which walks a value along the ladder.
 */
export function ladderPosition(value: number) {
  const whole = value >= TOP ? TOP : Math.floor(value + 1e-9);
  const tier = whole >= 1 ? tierByOrder(whole) : null;
  const into = tier?.order === TOP ? 100 : Math.max(0, (value - whole) * 100);
  return { tier, next: tierByOrder(tier ? tier.order + 1 : TIERS[0].order), into };
}

/** A level with its bar: the pack reached, the way to the next, the EXP. */
export function LevelBar({
  level,
  label,
  size = "md",
}: {
  level: Level;
  label: string;
  size?: "lg" | "md";
}) {
  const { tier, next, into } = ladderPosition(levelValue(level));
  const colour = tier ? tier.color : "#777";
  return (
    <div
      className="lvl"
      data-size={size}
      style={
        {
          "--tier": colour,
          "--fill": tier ? tierFill(tier) : colour,
          "--next": next ? next.color : colour,
        } as CSSProperties
      }
    >
      <span className="lvl-label">{label}</span>
      <span className="lvl-tier">
        <span
          className="lvl-gem"
          style={tier ? { background: tierFill(tier) } : undefined}
          data-empty={tier ? undefined : true}
        />
        <span className="lvl-name">{tier ? tier.name : "Unranked"}</span>
      </span>
      <span className="lvl-bar">
        <i style={{ width: into + "%" }} />
      </span>
      <span className="lvl-foot">
        {next ? (
          <>
            {level.progress ?? 0}/100 to <b>{next.name}</b>
          </>
        ) : (
          "Top of the ladder"
        )}
      </span>
      <span className="lvl-exp">
        <b className="num">{fmt(level.exp)}</b>
        <small>EXP</small>
      </span>
    </div>
  );
}

const VIEW_W = 470;
const VIEW_H = 330;
const CX = 235;
const CY = 172;
const R = 110;
/* The ladder's four bands of four: Bronze, Titanium, Sapphire, GOAT. */
const RINGS = [4, 8, 12, 16];

function spoke(i: number, count: number, radius: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / count;
  return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
}

/**
 * The five categories as one shape. Each ring is a band of the ladder, and
 * each corner wears the colour of the pack that category has reached.
 */
export function SkillRadar({ axes }: { axes: Array<{ label: string; value: number }> }) {
  const n = axes.length;
  const radius = (v: number) => (R * Math.max(0, Math.min(TOP, v))) / TOP;
  const points = axes.map((a, i) => spoke(i, n, radius(a.value)));
  const accent = ladderPosition(Math.max(0, ...axes.map((a) => a.value))).tier?.color ?? "#777";

  return (
    <svg
      className="radar"
      viewBox={"0 0 " + VIEW_W + " " + VIEW_H}
      role="img"
      aria-label={axes
        .map((a) => a.label + " " + (ladderPosition(a.value).tier?.name ?? "Unranked"))
        .join(", ")}
      style={{ "--radar": accent } as CSSProperties}
    >
      {RINGS.map((ring) => (
        <polygon
          key={ring}
          className="radar-ring"
          points={axes.map((_, i) => spoke(i, n, radius(ring)).join(",")).join(" ")}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = spoke(i, n, R);
        return <line key={i} className="radar-axis" x1={CX} y1={CY} x2={x} y2={y} />;
      })}
      <polygon className="radar-shape" points={points.map((p) => p.join(",")).join(" ")} />
      {points.map(([x, y], i) => {
        const tier = ladderPosition(axes[i].value).tier;
        return (
          <circle
            key={i}
            className="radar-dot"
            cx={x}
            cy={y}
            r={5}
            style={{ fill: tier ? tier.color : "#777" }}
          />
        );
      })}
      {axes.map((a, i) => {
        const [x, y] = spoke(i, n, R + 18);
        const cos = Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / n);
        const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
        const above = y < CY - R / 2;
        const tier = ladderPosition(a.value).tier;
        return (
          <text key={a.label} x={x} y={above ? y - 18 : y + 4} textAnchor={anchor}>
            <tspan className="radar-label" x={x}>
              {a.label}
            </tspan>
            <tspan
              className="radar-tier"
              x={x}
              dy="1.35em"
              style={{ fill: tier ? "color-mix(in srgb, " + tier.color + " 70%, #d2d2d2)" : undefined }}
            >
              {tier ? tier.name : "Unranked"}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}
