"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES, isCategory, normalizeCategories, shortCategory } from "@/lib/tiers";

/**
 * Categories as a set rather than one choice: a map can train more than one
 * skill, so it can sit in several. The button names what is ticked, short
 * form, and the list stays open while staff tick, since picking two is the
 * point.
 *
 * A label the grading team has dropped stays listed while a row carries it,
 * marked as such, so staff can untick it rather than have it vanish unseen.
 */
export function CategoryPicker({
  value,
  onChange,
  placeholder = "Pick a category",
  mini,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Row sized, to sit beside the small dropdowns on a card. */
  mini?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Old spellings read as what they became, so "Raw Aim" ticks Raw mechanic.
  const current = normalizeCategories(value);
  const picked = new Set(current);
  const options = CATEGORIES.concat(current.filter((v) => !CATEGORIES.includes(v)));
  const toggle = (c: string) =>
    onChange(picked.has(c) ? current.filter((v) => v !== c) : normalizeCategories([...current, c]));

  return (
    <div className="menu-wrap" ref={wrap}>
      <button
        className={"packpick-btn catpick-btn" + (mini ? " mini" : "")}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-empty={current.length ? undefined : true}
        title={current.join(", ") || undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="packpick-label">
          {current.length ? current.map((c) => shortCategory(c)).join(" + ") : placeholder}
        </span>
        <span className="caret" aria-hidden="true" />
      </button>

      {open ? (
        <div className="packgrid-pop catpick-pop" role="dialog" aria-label="Pick categories">
          {options.map((c) => (
            <label key={c} className="catpick-item" data-active={picked.has(c) || undefined}>
              <input type="checkbox" checked={picked.has(c)} onChange={() => toggle(c)} />
              <span>{c}</span>
              {isCategory(c) ? null : <span className="chip warn">no longer judged</span>}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
