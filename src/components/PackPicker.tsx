"use client";

import { useEffect, useRef, useState } from "react";
import { TIERS, tierBySlug, tierFill } from "@/lib/tiers";

/**
 * Pack filter as the ladder rather than a list.
 *
 * A native select renders sixteen identical lines of text, which throws away
 * the one thing that makes a pack recognisable. This lays them out four
 * across, in the same bands as the ladder page, each with its own colour.
 */
export function PackPicker({
  value,
  counts,
  onChange,
}: {
  value: string;
  counts?: Record<string, number>;
  onChange: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const selected = value ? tierBySlug(value) : null;

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

  const pick = (slug: string) => {
    onChange(slug);
    setOpen(false);
  };

  return (
    <div className="menu-wrap" ref={wrap}>
      <button
        className="packpick-btn"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {selected ? (
          <span className="dot" style={{ background: tierFill(selected) }} />
        ) : null}
        <span>{selected ? selected.name : "All packs"}</span>
        <span className="caret" aria-hidden="true" />
      </button>

      {open ? (
        <div className="packgrid-pop" role="dialog" aria-label="Pick a pack">
          <button
            className="packgrid-all"
            type="button"
            data-active={String(!value)}
            onClick={() => pick("")}
          >
            All packs
          </button>
          <div className="packgrid">
            {TIERS.map((t) => {
              const n = counts?.[t.slug];
              return (
                <button
                  key={t.slug}
                  type="button"
                  className="packgrid-item"
                  data-active={String(value === t.slug)}
                  onClick={() => pick(t.slug)}
                >
                  <span className="packgrid-gem" style={{ background: tierFill(t) }} />
                  <span className="packgrid-name">{t.name}</span>
                  {n != null ? <span className="packgrid-count">{n}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
