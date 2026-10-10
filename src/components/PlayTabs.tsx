"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * Lists that share one spot on a page, one open at a time, under tabs that
 * double as the section's heading. Every list stays mounted, so rows a list
 * has folded out are still there after switching away and back.
 */

export type PlayTab = {
  label: string;
  /** A line under the tabs about the open list. */
  note: string;
  /** A short tag beside the label, such as how many scores are new. */
  badge?: string;
  /** Drawn at the right end of the tabs while this list is open, such as a filter. */
  aside?: ReactNode;
  content: ReactNode;
};

export function PlayTabs({ tabs }: { tabs: PlayTab[] }) {
  const [open, setOpen] = useState(0);
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  // Left and right arrows move between tabs.
  function onKey(e: KeyboardEvent) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (open + step + tabs.length) % tabs.length;
    setOpen(next);
    buttons.current[next]?.focus();
  }

  return (
    <>
      <div className="section-head plays-head">
        <div className="plays-bar">
          <div className="tabs tabs-lg plays-tabs" role="tablist" onKeyDown={onKey}>
            {tabs.map((t, i) => (
              <button
                key={t.label}
                ref={(el) => {
                  buttons.current[i] = el;
                }}
                type="button"
                role="tab"
                id={id + "-tab-" + i}
                aria-selected={i === open}
                aria-controls={id + "-panel-" + i}
                tabIndex={i === open ? 0 : -1}
                onClick={() => setOpen(i)}
              >
                {t.label}
                {t.badge ? <span className="chip fresh">{t.badge}</span> : null}
              </button>
            ))}
          </div>
          {tabs[open].aside}
        </div>
        <p className="small">{tabs[open].note}</p>
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.label}
          role="tabpanel"
          id={id + "-panel-" + i}
          aria-labelledby={id + "-tab-" + i}
          hidden={i !== open}
        >
          {t.content}
        </div>
      ))}
    </>
  );
}
