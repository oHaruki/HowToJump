import type { ReactNode } from "react";
import { LENGTHS, SPEEDS, normalizeCategory } from "@/lib/tiers";
import type { PackVote } from "@/lib/votes";

/* Line icons for a map's tags, drawn on a 24 grid in the text's colour. */

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="ticon" viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

const CATEGORY_ICONS: Record<string, ReactNode> = {
  "Aim - consistency": (
    <Icon>
      <path d="M3 15.5 7.5 8.5 12 15.5 16.5 8.5 21 15.5" {...line} />
    </Icon>
  ),
  "Aim - raw mechanic": (
    <Icon>
      <path d="M13.5 2.5 5 13.5h6.2l-1 8 8.8-11.2h-6.3l.8-7.8Z" {...line} />
    </Icon>
  ),
  "Anti-aim": (
    <Icon>
      <path d="M7 21V10.5a5 5 0 0 1 10 0V18" {...line} />
      <path d="M13.6 14.9 17 18.3l3.4-3.4" {...line} />
    </Icon>
  ),
  "Aim control": (
    <Icon>
      <circle cx="6" cy="18.5" r="2.4" {...line} />
      <circle cx="18" cy="5.5" r="2.4" {...line} />
      <path d="M6 16.1C6 9 18 15 18 7.9" {...line} />
    </Icon>
  ),
  Precision: (
    <Icon>
      <circle cx="12" cy="12" r="6.2" {...line} />
      <path d="M12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5" {...line} />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </Icon>
  ),
  Gimmick: (
    <Icon>
      <path d="M10.5 5c.5 4.6 2 6.1 6.5 6.5-4.5.4-6 1.9-6.5 6.5-.5-4.6-2-6.1-6.5-6.5 4.5-.4 6-1.9 6.5-6.5Z" {...line} />
      <path d="M18.5 3c.2 1.6.6 2 2 2.2-1.4.2-1.8.6-2 2.2-.2-1.6-.6-2-2-2.2 1.4-.2 1.8-.6 2-2.2Z" {...line} strokeWidth={1.4} />
    </Icon>
  ),
};

/** A category's icon. A label no longer judged has none. */
export function CategoryIcon({ category }: { category: string }) {
  return CATEGORY_ICONS[normalizeCategory(category)] ?? null;
}

/** A clock that fills a fifth more for each length step. */
export function LengthIcon({ value }: { value: string }) {
  const step = LENGTHS.indexOf(value) + 1;
  const r = 5.6;
  const turn = (step / LENGTHS.length) * 2 * Math.PI;
  const x = (12 + r * Math.sin(turn)).toFixed(2);
  const y = (12 - r * Math.cos(turn)).toFixed(2);
  return (
    <Icon>
      <circle cx="12" cy="12" r="8.6" {...line} />
      {step === LENGTHS.length ? (
        <circle cx="12" cy="12" r={r} fill="currentColor" />
      ) : step > 0 ? (
        <path
          d={`M12 12V${12 - r}A${r} ${r} 0 ${step / LENGTHS.length > 0.5 ? 1 : 0} 1 ${x} ${y}Z`}
          fill="currentColor"
        />
      ) : null}
    </Icon>
  );
}

/** A gauge whose needle swings further for each speed step. */
export function SpeedIcon({ value }: { value: string }) {
  const step = SPEEDS.indexOf(value);
  const angle = ((200 - (step / (SPEEDS.length - 1)) * 220) * Math.PI) / 180;
  const x = (12 + 5.6 * Math.cos(angle)).toFixed(2);
  const y = (14 - 5.6 * Math.sin(angle)).toFixed(2);
  return (
    <Icon>
      <path d="M4.48 16.74A8 8 0 1 1 19.52 16.74" {...line} />
      {step >= 0 ? <path d={`M12 14L${x} ${y}`} {...line} strokeWidth={2} /> : null}
      <circle cx="12" cy="14" r="1.7" fill="currentColor" />
    </Icon>
  );
}

/** A pack vote: down a pack, on par, or up a pack. */
export function VoteIcon({ vote }: { vote: PackVote }) {
  const d = vote < 0 ? "M6 9.5l6 6 6-6" : vote > 0 ? "M6 14.5l6-6 6 6" : "M6 9.5h12M6 14.5h12";
  return (
    <Icon>
      <path d={d} {...line} strokeWidth={2.2} />
    </Icon>
  );
}
