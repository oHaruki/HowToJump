"use client";

import { useRef, useState } from "react";
import { PlayRow, type PlayView } from "@/components/PlayRow";
import { categorySlug } from "@/lib/tiers";

/**
 * The rest of a list, a page at a time. Pages already fetched are kept, so
 * folding the list back and opening it again asks for nothing.
 */

/** Rows each "Show more" adds. */
const PAGE = 10;

/** Dates do not survive JSON, so they arrive as strings and are revived. */
type Wire = Omit<PlayView, "playedAt"> & { playedAt: string | null };

export function PlayMore({
  userId,
  list,
  category,
  count,
  offset,
}: {
  userId: number;
  list: "top" | "recent";
  /** The one category the list is narrowed to, if any. */
  category?: string | null;
  /** How many rows are past the ones the page drew. */
  count: number;
  /** How many rows the page drew. */
  offset: number;
}) {
  const [rows, setRows] = useState<PlayView[]>([]);
  const [shown, setShown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Set once the server has nothing past `rows`.
  const [ended, setEnded] = useState(false);
  // A ref, so a second click mid-request does not send a second one.
  const loading = useRef(false);
  const bar = useRef<HTMLDivElement>(null);

  const total = ended ? rows.length : count;
  const left = total - shown;
  const want = Math.min(total, shown + PAGE);

  async function more() {
    if (loading.current) return;
    if (rows.length >= want) {
      setShown(want);
      return;
    }
    loading.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const limit = want - rows.length;
      const res = await fetch(
        "/api/plays?user=" + userId + "&list=" + list +
          (category ? "&category=" + categorySlug(category) : "") +
          "&offset=" + (offset + rows.length) + "&limit=" + limit,
      );
      if (!res.ok) throw new Error("plays: " + res.status);
      const body: { plays: Wire[] } = await res.json();
      const have = new Set(rows.map((p) => p.scoreId));
      const next = rows.concat(
        body.plays
          .filter((p) => !have.has(p.scoreId))
          .map((p) => ({ ...p, playedAt: p.playedAt ? new Date(p.playedAt) : null })),
      );
      setRows(next);
      setShown(Math.min(want, next.length));
      if (body.plays.length < limit) setEnded(true);
    } catch {
      setFailed(true);
    } finally {
      loading.current = false;
      setBusy(false);
    }
  }

  function less() {
    setShown(0);
    // Brings the buttons back on screen.
    requestAnimationFrame(() => bar.current?.scrollIntoView({ block: "nearest" }));
  }

  return (
    <>
      {rows.slice(0, shown).map((p, i) => (
        <PlayRow
          key={p.scoreId}
          play={p}
          rank={list === "top" ? offset + i + 1 : undefined}
          category={category}
        />
      ))}
      <div className="more" ref={bar}>
        <div className="more-btns">
          {left > 0 ? (
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void more()}>
              {busy ? "Loading" : "Show " + Math.min(PAGE, left) + " more"}
            </button>
          ) : null}
          {shown > 0 ? (
            <button type="button" className="btn btn-sm" onClick={less}>
              Show less
            </button>
          ) : null}
        </div>
        <span className="more-count">
          {offset + shown} of {offset + total}
        </span>
        {failed ? <span className="small more-fail">Could not load more. Try again.</span> : null}
      </div>
    </>
  );
}
