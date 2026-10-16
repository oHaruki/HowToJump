import type { CSSProperties, ReactNode } from "react";
import { PACK_LEVELS, type MedalArt, type PackLevel } from "@/lib/achievements";
import { tierByOrder, tierFill } from "@/lib/tiers";

/**
 * An achievement's medal. A pack's marks are its gem, filling up level by
 * level; every other medal is a coin with a picture on a dark disc, ringed
 * in its pack's colour. Greyed out until earned.
 */

/** An Archimedean spiral around (cx, cy) out to `r`, for the snail's shell. */
function spiral(cx: number, cy: number, r: number, turns: number): string {
  const steps = Math.round(turns * 24);
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * turns * 2 * Math.PI;
    const d = 0.5 + (r - 0.5) * (i / steps);
    pts.push((cx + d * Math.cos(a)).toFixed(2) + " " + (cy + d * Math.sin(a)).toFixed(2));
  }
  return "M" + pts.join("L");
}

/** A circle with a scalloped edge, for fur. */
function fuzzy(cx: number, cy: number, r: number, bumps: number, depth: number): string {
  const at = (a: number, d: number) => (cx + d * Math.cos(a)).toFixed(2) + " " + (cy + d * Math.sin(a)).toFixed(2);
  let path = "M" + at(-Math.PI / 2, r);
  for (let i = 1; i <= bumps; i++) {
    const a = (i / bumps) * 2 * Math.PI - Math.PI / 2;
    path += "Q" + at(a - Math.PI / bumps, r + depth) + " " + at(a, r);
  }
  return path + "Z";
}

/** Cut out of a picture in the disc's colour. */
const cut = { fill: "var(--disc)" };
const line = (width: number) =>
  ({ fill: "none", stroke: "var(--disc)", strokeWidth: width, strokeLinecap: "round", strokeLinejoin: "round" }) as const;
const outline = (width: number) =>
  ({ fill: "none", stroke: "currentColor", strokeWidth: width, strokeLinecap: "round", strokeLinejoin: "round" }) as const;

/** The coins' pictures, drawn on a 32 grid in white, details cut in the disc's colour. */
const GLYPHS: Record<Exclude<MedalArt, PackLevel | "727">, ReactNode> = {
  snail: (
    <>
      <path d="M3.6 25.4c0-1 .8-1.9 1.9-1.9h20c1.9 0 3.5.9 3.9 2.1.2.5-.2 1-.7 1H5.4c-1 0-1.8-.3-1.8-1.2Z" />
      <path d="M5.4 23.8v-5.6c0-1.7 1.3-3 3-3s3 1.3 3 3v5.6Z" />
      <path d="M7.2 15.6 5.4 10.4M9.6 15.6l1.8-5.2" {...outline(1.4)} />
      <circle cx="5.2" cy="9.8" r="1.4" />
      <circle cx="11.6" cy="9.8" r="1.4" />
      <circle cx="19.6" cy="15.6" r="7.9" />
      <path d={spiral(19.6, 15.6, 6.2, 2.3)} {...line(1.35)} />
      <circle cx="8.9" cy="18.4" r=".95" {...cut} />
    </>
  ),
  tortoise: (
    <>
      <path d="M4 21.4a11.6 10.4 0 0 1 23.2 0Z" />
      <rect x="3" y="20.4" width="25.2" height="2.7" rx="1.35" />
      <rect x="7" y="22" width="3.6" height="4.8" rx="1.6" />
      <rect x="20.4" y="22" width="3.6" height="4.8" rx="1.6" />
      <rect x="25" y="18.2" width="4" height="3.2" rx="1.2" />
      <circle cx="28.6" cy="19.2" r="2.7" />
      <path
        d="M12.8 17.4 14.4 14.2h3.4l1.6 3.2-1.6 3.1h-3.4ZM9.4 20.4l3.4-3M22.8 20.4l-3.4-3M16.1 14.2v-3M7.4 15.4l5.4-1.2M24.8 15.4l-5.4-1.2"
        {...line(1.15)}
      />
      <circle cx="29.4" cy="18.6" r=".65" {...cut} />
    </>
  ),
  sloth: (
    <>
      <path d={fuzzy(16, 16.8, 11, 18, 1.5)} />
      <ellipse cx="10.4" cy="16.2" rx="4.3" ry="2.1" transform="rotate(-26 10.4 16.2)" {...cut} />
      <ellipse cx="21.6" cy="16.2" rx="4.3" ry="2.1" transform="rotate(26 21.6 16.2)" {...cut} />
      <circle cx="12.5" cy="15.1" r="1" />
      <circle cx="19.5" cy="15.1" r="1" />
      <ellipse cx="16" cy="19.4" rx="2.2" ry="1.5" {...cut} />
      <path d="M13.4 22.4c1.6 1.2 3.6 1.2 5.2 0" {...line(1.25)} />
    </>
  ),
  panda: (
    <>
      <circle cx="7.6" cy="8.6" r="4.1" fill="var(--disc)" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="24.4" cy="8.6" r="4.1" fill="var(--disc)" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="17.8" r="11" />
      <ellipse cx="11.1" cy="17" rx="3.1" ry="4.1" transform="rotate(-32 11.1 17)" {...cut} />
      <ellipse cx="20.9" cy="17" rx="3.1" ry="4.1" transform="rotate(32 20.9 17)" {...cut} />
      <circle cx="11.7" cy="16.5" r="1.05" />
      <circle cx="20.3" cy="16.5" r="1.05" />
      <ellipse cx="16" cy="21.8" rx="2" ry="1.35" {...cut} />
      <path d="M14.3 24.3c.9.7 2.5.7 3.4 0" {...line(1.1)} />
    </>
  ),
  rabbit: (
    <>
      <ellipse cx="11.6" cy="9.2" rx="3.3" ry="7.8" transform="rotate(-12 11.6 9.2)" />
      <ellipse cx="20.4" cy="9.2" rx="3.3" ry="7.8" transform="rotate(12 20.4 9.2)" />
      <ellipse cx="11.7" cy="9.8" rx="1.3" ry="5.2" transform="rotate(-12 11.7 9.8)" {...cut} />
      <ellipse cx="20.3" cy="9.8" rx="1.3" ry="5.2" transform="rotate(12 20.3 9.8)" {...cut} />
      <circle cx="16" cy="21.2" r="8.6" />
      <circle cx="12.7" cy="20" r="1.25" {...cut} />
      <circle cx="19.3" cy="20" r="1.25" {...cut} />
      <path d="M14.8 22.7h2.4L16 24.1Z" {...cut} />
      <path d="M16 24.1v1M16 25.1c-.8.8-2 .8-2.7.2M16 25.1c.8.8 2 .8 2.7.2" {...line(1)} />
    </>
  ),
  fox: (
    <>
      <path d="M4.4 3.8 13 11h6l8.6-7.2-1.2 11.8c-.7 5.4-4.6 9.8-10.4 13.2-5.8-3.4-9.7-7.8-10.4-13.2Z" />
      <path d="M7.1 8.2 11 11.3l-3.6 1.4ZM24.9 8.2 21 11.3l3.6 1.4Z" {...cut} />
      <ellipse cx="11.4" cy="15.8" rx="1.8" ry="1.15" transform="rotate(18 11.4 15.8)" {...cut} />
      <ellipse cx="20.6" cy="15.8" rx="1.8" ry="1.15" transform="rotate(-18 20.6 15.8)" {...cut} />
      <path d="M8.6 18.6c2.4 2.4 4.9 4 7.4 5.4 2.5-1.4 5-3 7.4-5.4" {...line(1.1)} />
      <path d="M14.6 24.6h2.8L16 26.2Z" {...cut} />
    </>
  ),
  horse: (
    <>
      <path d="M18.6 3.4 20.2 7c4 1.4 6.8 5.4 6.8 10.2 0 4.4-1.2 8.3-2.6 11.6H13.2c.2-3 1.4-5.4 3.5-7.4-2.2.7-4.6.7-6.7-.1-1.5 1.4-3.6 2-5.2 1-1.3-.8-1.5-2.5-.7-3.9l4.7-7.6c1.5-2.4 4-4 6.9-4.2Z" />
      <circle cx="13.4" cy="11.8" r="1.15" {...cut} />
      <circle cx="6.4" cy="18.6" r=".85" {...cut} />
      <path d="M20.8 8.8c1.5 2.5 2.1 5.5 1.7 8.5M23 8.6c1.7 2.7 2.4 5.9 2 9.1M19.2 3.9l-1.1 3.1" {...line(1.15)} />
    </>
  ),
  cheetah: (
    <>
      <path d="M5.8 5.2c2.2-.7 4.5.3 5.5 2.4L7.6 11.4c-1.8-1-2.7-3.9-1.8-6.2ZM26.2 5.2c-2.2-.7-4.5.3-5.5 2.4l3.7 3.8c1.8-1 2.7-3.9 1.8-6.2Z" />
      <ellipse cx="16" cy="17.6" rx="11.2" ry="10.4" />
      <g {...cut}>
        <circle cx="12.4" cy="10.6" r=".95" />
        <circle cx="16" cy="9.3" r=".95" />
        <circle cx="19.6" cy="10.6" r=".95" />
        <circle cx="8" cy="16.6" r=".85" />
        <circle cx="24" cy="16.6" r=".85" />
        <circle cx="9.4" cy="21.8" r=".75" />
        <circle cx="22.6" cy="21.8" r=".75" />
      </g>
      <path d="M10.2 14.9c1.4-1.1 3.3-1.1 4.5.2-1.3 1.2-3.1 1.2-4.5-.2ZM21.8 14.9c-1.4-1.1-3.3-1.1-4.5.2 1.3 1.2 3.1 1.2 4.5-.2Z" {...cut} />
      <path d="M14.1 15.8c-.6 2.6-.4 5 .5 7.4M17.9 15.8c.6 2.6.4 5-.5 7.4" {...line(1.35)} />
      <path d="M14.2 20.8h3.6L16 22.7Z" {...cut} />
      <path d="M16 22.7v1.5" {...line(1)} />
    </>
  ),
  grief: (
    <>
      <path d="M11.4 9.6C8.6 5.8 3.6 5.2 2.6 9.4c-.6 2.5 1.3 4.6 3.6 4.3" {...outline(2.7)} />
      <path d="M20.6 9.6c2.8-3.8 7.8-4.4 8.8-.2.6 2.5-1.3 4.6-3.6 4.3" {...outline(2.7)} />
      <path d="M10 9.4C11.7 7.6 13.8 7 16 7s4.3.6 6 2.4c1.2 1.6 1.4 4.6.4 7.6l-2.6 8.2c-.6 1.9-2.1 3-3.8 3s-3.2-1.1-3.8-3L9.6 17c-1-3-.8-6 .4-7.6Z" />
      <ellipse cx="13" cy="14.4" rx="1.95" ry="2.5" {...cut} />
      <ellipse cx="19" cy="14.4" rx="1.95" ry="2.5" {...cut} />
      <path d="M14.7 22.8c.3.9.8 1.3 1.3 1.3s1-.4 1.3-1.3" {...line(1.15)} />
      <path d="M16 7.6 15.2 10.2l1.3 1.6-.6 1.9" {...line(0.95)} />
    </>
  ),
};

/** A mark in white with a dark edge, so it reads on every pack's colour. */
const edged = {
  fill: "#fff",
  stroke: "#000",
  strokeOpacity: 0.5,
  strokeWidth: 1.6,
  strokeLinejoin: "round",
  paintOrder: "stroke",
} as const;

const PLUS = (
  <path d="M10.6 6.6h2.8v4h4v2.8h-4v4h-2.8v-4h-4v-2.8h4Z" {...edged} />
);

/** The marks laid over a pack's gem. */
const MARKS: Partial<Record<PackLevel, ReactNode>> = {
  pass: <circle cx="12" cy="12" r="2.6" fill="var(--fill-solid)" />,
  plus: PLUS,
  trueplus: PLUS,
  perfect: (
    <path d="M12 3.6c.9 4.4 3.9 7.4 8.4 8.4-4.5.9-7.5 3.9-8.4 8.4-.9-4.5-3.9-7.5-8.4-8.4 4.5-1 7.5-4 8.4-8.4Z" {...edged} />
  ),
};

const isPackLevel = (art: MedalArt): art is PackLevel => (PACK_LEVELS as readonly string[]).includes(art);

export function Medal({
  art,
  tierOrder,
  earned,
  size = 44,
  label,
}: {
  art: MedalArt;
  /** The pack whose colour it wears. */
  tierOrder: number;
  earned: boolean;
  size?: number;
  /** Read out and shown on hover. */
  label?: string;
}) {
  const tier = tierByOrder(tierOrder);
  const shared = {
    role: "img",
    "aria-label": label,
    title: label,
    "data-earned": earned || undefined,
  } as const;

  if (isPackLevel(art)) {
    return (
      <span
        className="medal medal-gem"
        data-level={art}
        {...shared}
        style={
          {
            "--size": size + "px",
            "--fill": tierFill(tier),
            "--fill-solid": tier?.color ?? "#777",
          } as CSSProperties
        }
      >
        <i />
        {MARKS[art] ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {MARKS[art]}
          </svg>
        ) : null}
      </span>
    );
  }

  return (
    <span
      className="medal medal-coin"
      data-art={art}
      {...shared}
      style={{ "--size": size + "px", "--ring": tierFill(tier) } as CSSProperties}
    >
      {art === "727" ? (
        <b>727</b>
      ) : (
        <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
          {GLYPHS[art]}
        </svg>
      )}
    </span>
  );
}
