"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { markChangesSeen } from "@/lib/actions";
import type { ChangeView } from "@/lib/changes";
import { ChangeRow } from "@/components/ChangeRow";
import { mapHref } from "@/components/ui";

const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

/**
 * The bell in the nav. Opens the player's level changes that their own
 * plays didn't make, newest first, with the EXP each one moved. A dot marks
 * any since they last opened it or closed their profile's popup.
 */
export function ChangesBell({ changes, seenAt }: { changes: ChangeView[]; seenAt: string | null }) {
  const [open, setOpen] = useState(false);
  // Read in this tab, ahead of the server.
  const [readTo, setReadTo] = useState<string | null>(null);
  // The read line when the panel opened, so what was new stays marked while it shows.
  const [line, setLine] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const seen = later(seenAt, readTo);
  const unread = changes.filter((c) => !seen || c.at > seen).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setLine(seen);
    setOpen(true);
    if (unread) {
      setReadTo(changes[0].at);
      void markChangesSeen();
    }
  };

  return (
    <div className="bell-wrap" ref={wrap}>
      <button
        className="tool bellbtn"
        type="button"
        aria-label={unread ? "EXP changes, " + unread + " new" : "EXP changes"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread ? <span className="bell-dot" /> : null}
      </button>

      {open ? (
        <div className="bell-panel" role="dialog" aria-label="EXP changes">
          <div className="bell-head">
            <b>EXP changes</b>
            <span>When a map you&apos;ve played is re-judged, or the EXP rules change, it shows here.</span>
          </div>
          {changes.length ? (
            <ul className="bell-list">
              {changes.map((c) => (
                <li key={c.id} data-new={!line || c.at > line ? true : undefined}>
                  {c.map ? (
                    <Link
                      className="bell-item"
                      href={mapHref(c.map.osuBeatmapId, c.map.mod)}
                      onClick={() => setOpen(false)}
                    >
                      <ChangeRow change={c} full />
                    </Link>
                  ) : (
                    <div className="bell-item">
                      <ChangeRow change={c} full />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="bell-empty">Nothing yet.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
