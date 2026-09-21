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

/**
 * Length and speed, one chip each.
 *
 * Both are graded words rather than numbers, so a single "Long - Medium" cell
 * left no way to tell which of them was the time and which the tempo. Each
 * now carries its own chip, and the key sits in a recessed cell of its own:
 * styling them alike and trusting the words to carry the difference did not
 * work, since a dim label and a bright value still read as one phrase.
 *
 * The pair also takes a line of its own, rather than wrapping wherever the
 * mod and category happen to run out of room. A long title or a long category
 * used to decide whether a card showed one row of chips or two, which left
 * the list ragged; now every card reads the same way.
 *
 * The two keys are the only wording here, so renaming them is a one line job.
 */
export function PacingChips({
  length,
  speed,
}: {
  length: string | null;
  speed: string | null;
}) {
  if (!length && !speed) return null;
  return (
    <span className="pacing">
      {length ? <KeyedChip label="Length" value={length} /> : null}
      {speed ? <KeyedChip label="Speed" value={speed} /> : null}
    </span>
  );
}

function KeyedChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="chip chip-keyed">
      <i>{label}</i>
      <b>{value}</b>
    </span>
  );
}

/**
 * A map's categories, one chip each. Written as stored, so a label the
 * grading team has since renamed or dropped still shows for what it is.
 */
export function CategoryChips({ categories }: { categories: readonly string[] }) {
  return (
    <>
      {categories.map((c) => (
        <span key={c} className="chip">{c}</span>
      ))}
    </>
  );
}

/**
 * A dropdown whose first line is a label, not a choice.
 *
 * Pack, category, length and speed all have to end up with a real value, so
 * "Pick a category" is there to say the field is still empty rather than to
 * be selected; picking it would only undo the field. Disabling it leaves it
 * visible while nothing is set and takes it out of the list once something is.
 *
 * A value the scale does not know, such as a label the sheet used before it
 * was renamed, stays in the list so opening the dropdown cannot silently
 * rewrite it.
 */
export function PickSelect({
  value,
  options,
  placeholder,
  onChange,
  disabled,
  hint,
}: {
  value: string;
  options: string[];
  placeholder: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** Hover text, used to spell out what the buckets mean. */
  hint?: string;
}) {
  const all = value && !options.includes(value) ? options.concat(value) : options;
  return (
    <select
      className="mini"
      value={value}
      disabled={disabled}
      title={hint}
      aria-label={placeholder}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {all.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/**
 * A country flag, drawn with the same artwork osu! uses. Emoji flags would be
 * simpler, but Windows shows them as two bare letters.
 */
export function Flag({ code }: { code: string | null | undefined }) {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
  const points = code
    .toUpperCase()
    .split("")
    .map((c) => (0x1f1e6 + c.charCodeAt(0) - 65).toString(16))
    .join("-");
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="flag"
      src={"https://osu.ppy.sh/assets/images/flags/" + points + ".svg"}
      alt={code.toUpperCase()}
      title={code.toUpperCase()}
      loading="lazy"
    />
  );
}

/* osu!'s grade colours by family: gold at the top, then green, blue, purple, red. */
function gradeTone(grade: string): string {
  if (grade === "SSS" || grade === "SS" || grade === "S") return grade.toLowerCase();
  const letter = grade.charAt(0);
  return "ABCD".includes(letter) ? letter.toLowerCase() : "f";
}

/**
 * A grade drawn the way osu! draws one on a scoreboard: a big slanted letter
 * in its family's colours, no box around it.
 */
export function GradeLetter({ grade, big }: { grade: string; big?: boolean }) {
  return (
    <span className={"gl" + (big ? " big" : "")} data-tone={gradeTone(grade)}>
      {grade}
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

/**
 * A map's page on this site: /beatmap/ and the same number as on osu!, so it
 * can be typed from memory. Anything banked under a mod carries it, since
 * one beatmap can be banked more than once.
 */
export function mapHref(osuBeatmapId: number, mod?: string | null) {
  return "/beatmap/" + osuBeatmapId + (mod && mod !== "NM" ? "?mod=" + mod : "");
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

export function MapCell({ map, plain }: { map: MapLike; plain?: boolean }) {
  return (
    <div className="map-cell">
      <Thumb map={map} />
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

/**
 * What sits where a slow list will be.
 *
 * The site's own art rather than a generic spinner, cropped to the figure and
 * served at a fourteenth of the hero's weight, since an icon that says the
 * page is still working should not itself be the download. She is mid leap
 * already, so the loop bobs her instead of rotating: a jump reads as motion
 * where a spinning character would only read as a spinning character.
 *
 * role="status" so the wait is announced rather than being a silent gap, and
 * the bob is an animation, which the reduced motion rule already turns off.
 */
export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="loading-art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/loader.webp" alt="" width={87} height={160} />
      </span>
      <span className="small">{label}</span>
    </div>
  );
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
