"use client";

import { useEffect, useRef, useState } from "react";
import type { SpecialPack } from "@/lib/packs";
import { TIERS, tierBySlug, tierFill } from "@/lib/tiers";

/**
 * Pack filter as the ladder rather than a list.
 *
 * A native select renders sixteen identical lines of text, which throws away
 * the one thing that makes a pack recognisable. This lays them out four
 * across, in the same bands as the ladder page, each with its own colour,
 * with any special packs under them.
 *
 * A pack is keyed by its slug on the ladder and by its ID as a string when
 * special.
 */
export function PackPicker({
  value,
  counts,
  onChange,
  placeholder = "All packs",
  allowClear = true,
  special = [],
}: {
  value: string;
  /** Maps per pack, keyed like `value`. */
  counts?: Record<string, number>;
  onChange: (key: string) => void;
  /** Shown when nothing is picked. "Set pack" when used as a bulk action. */
  placeholder?: string;
  /** Off where clearing makes no sense, such as setting a pack on a row. */
  allowClear?: boolean;
  /** Special packs, offered under the ladder's. */
  special?: readonly SpecialPack[];
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const tier = value ? tierBySlug(value) : null;
  const pack = tier ? null : (special.find((p) => String(p.id) === value) ?? null);
  const fill = tier ? tierFill(tier) : pack?.color;

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
        {fill ? <span className="dot" style={{ background: fill }} /> : null}
        <span className="packpick-label">{tier?.name ?? pack?.name ?? placeholder}</span>
        <span className="caret" aria-hidden="true" />
      </button>

      {open ? (
        <div className="packgrid-pop" role="dialog" aria-label="Pick a pack">
          {allowClear ? (
            <button
              className="packgrid-all"
              type="button"
              data-active={String(!value)}
              onClick={() => pick("")}
            >
              {placeholder}
            </button>
          ) : null}
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
          {special.length ? (
            <>
              <span className="lbl packgrid-head">Special packs</span>
              <div className="packgrid">
                {special.map((p) => {
                  const key = String(p.id);
                  const n = counts?.[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      className="packgrid-item"
                      data-active={String(value === key)}
                      onClick={() => pick(key)}
                    >
                      <span className="packgrid-gem" style={{ background: p.color }} />
                      <span className="packgrid-name">{p.name}</span>
                      {n != null ? <span className="packgrid-count">{n}</span> : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
