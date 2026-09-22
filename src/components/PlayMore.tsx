"use client";

import { useRef, useState } from "react";
import { PlayRow, type PlayView } from "@/components/PlayRow";
import { Loading } from "@/components/ui";

/**
 * The rest of a list, fetched the first time the fold is opened and kept
 * from then on. A <details>, so it behaves as one for anyone who never
 * opens it.
 */

/** Dates do not survive JSON, so they arrive as strings and are revived. */
type Wire = Omit<PlayView, "playedAt"> & { playedAt: string | null };

export function PlayMore({
  userId,
  list,
  count,
  offset,
}: {
  userId: number;
  list: "top" | "recent";
  /** How many are still to come, which is what the summary says. */
  count: number;
  offset: number;
}) {
  const [rows, setRows] = useState<PlayView[] | null>(null);
  const [failed, setFailed] = useState(false);
  // A ref, so reopening the fold mid-request does not send a second one.
  const loading = useRef(false);

  async function load() {
    if (rows || loading.current) return;
    loading.current = true;
    setFailed(false);
    try {
      const res = await fetch(
        "/api/plays?user=" + userId + "&list=" + list + "&offset=" + offset,
      );
      if (!res.ok) throw new Error("plays: " + res.status);
      const body: { plays: Wire[] } = await res.json();
      setRows(
        body.plays.map((p) => ({
          ...p,
          playedAt: p.playedAt ? new Date(p.playedAt) : null,
        })),
      );
    } catch {
      setFailed(true);
    } finally {
      loading.current = false;
    }
  }

  return (
    <details
      className="more"
      onToggle={(e) => {
        if (e.currentTarget.open) void load();
      }}
    >
      <summary>Show {count} more</summary>
      <div className="plays">
        {rows ? rows.map((p) => <PlayRow key={p.scoreId} play={p} />) : null}
        {!rows && !failed ? <Loading label="Loading plays" /> : null}
        {failed ? (
          <p className="small">
            Could not load the rest.{" "}
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => void load()}>
              Try again
            </button>
          </p>
        ) : null}
      </div>
    </details>
  );
}
