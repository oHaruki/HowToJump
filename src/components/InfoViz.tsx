import { BEST_PLAYS } from "@/lib/levels";
import { MODS, modLabel } from "@/lib/mods";
import { CATEGORIES, TIERS, shortCategory, tierFill } from "@/lib/tiers";

/** The info page's pictures, drawn from the constants the rules use. */

const fmt = (n: number) => n.toLocaleString("en");

/** Every pack in its own colour, beside what a full combo on it pays. */
export function PackLadder() {
  return (
    <div className="iv-packs">
      {TIERS.map((t) => (
        <div className="iv-pack" key={t.slug}>
          <span className="iv-gem" style={{ background: tierFill(t) }} />
          <span className="iv-pack-name">{t.name}</span>
          <span className="iv-pack-exp num">{fmt(t.exp)}</span>
        </div>
      ))}
    </div>
  );
}

/** Five skills, ten slots each: what a category's level is added up from. */
export function SkillSlots() {
  return (
    <div className="iv-list">
      {CATEGORIES.map((c) => (
        <div className="iv-row" key={c}>
          <span className="iv-row-name">{shortCategory(c)}</span>
          <span className="iv-slots" aria-hidden>
            {Array.from({ length: BEST_PLAYS }, (_, i) => (
              <i className="iv-slot" key={i} />
            ))}
          </span>
          <span className="iv-row-n num">{BEST_PLAYS}</span>
        </div>
      ))}
    </div>
  );
}

/** Every mod an entry can be banked under, with its full name. */
export function ModLegend() {
  return (
    <div className="iv-list">
      {MODS.map((m) => (
        <div className="iv-row" key={m}>
          <span className="chip chip-mod" data-nm={String(m === "NM")}>{m}</span>
          <span className="iv-row-name">{modLabel(m)}</span>
        </div>
      ))}
    </div>
  );
}

/** The three steps a score takes to get here. */
export function SyncFlow() {
  const steps = [
    { at: "osu!", what: "you play" },
    { at: "every minute", what: "the site looks" },
    { at: "your profile", what: "the score lands" },
  ];
  return (
    <div className="iv-flow">
      {steps.map((s, i) => (
        <div className="iv-step" key={s.at}>
          <span className="iv-step-at">{s.at}</span>
          <span className="iv-step-what">{s.what}</span>
          {i < steps.length - 1 ? (
            <span className="iv-step-arrow" aria-hidden>&#8594;</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
