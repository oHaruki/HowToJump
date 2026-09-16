"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveSuggestions, rejectSuggestions, setSuggestionTier } from "@/lib/actions";
import { TIERS, tierByOrder } from "@/lib/tiers";
import { Banner, ModChip, NONE } from "@/components/ui";
import { secondsToDrain } from "@/lib/import/parse";

export type QueueRow = {
  id: number;
  osuBeatmapId: number;
  osuBeatmapsetId: number | null;
  title: string | null;
  version: string | null;
  mapper: string | null;
  mod: string;
  tierOrder: number | null;
  category: string | null;
  stars: number | null;
  bpm: number | null;
  drainSeconds: number | null;
  cs: number | null;
  ar: number | null;
  od: number | null;
  lengthBucket: string | null;
  speedBucket: string | null;
  batchId: number | null;
  createdAt: string;
  submittedBy: string | null;
};

export function QueueTable({ rows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    start(async () => {
      try {
        await fn();
        setSelected(new Set());
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  // Approving without a pack would put an unplaced entry on the ladder.
  const approvable = selectedIds.filter(
    (id) => rows.find((r) => r.id === id)?.tierOrder != null,
  );

  return (
    <>
      {error ? (
        <div className="notice bad">
          <span className="chip bad" style={{ flex: "none" }}>Error</span>
          <div>{error}</div>
        </div>
      ) : null}

      <div className="row spread">
        <span className="small">
          {selected.size} selected
          {selected.size && approvable.length < selected.size
            ? ", " + (selected.size - approvable.length) + " without a pack"
            : ""}
        </span>
        <div className="row">
          <button
            className="btn btn-sm"
            type="button"
            onClick={() =>
              setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
            }
          >
            {allSelected ? "Select none" : "Select all"}
          </button>
          <button
            className="btn btn-sm btn-ok"
            type="button"
            disabled={pending || !approvable.length}
            onClick={() => run(() => approveSuggestions(approvable))}
          >
            Approve selected
          </button>
          <button
            className="btn btn-sm btn-no"
            type="button"
            disabled={pending || !selectedIds.length}
            onClick={() => run(() => rejectSuggestions(selectedIds))}
          >
            Reject selected
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="mid">
          <thead>
            <tr>
              <th style={{ width: 30 }} />
              <th>Map</th>
              <th>Mod</th>
              <th>Proposed pack</th>
              <th>Category</th>
              <th>Stars</th>
              <th>BPM</th>
              <th>Length</th>
              <th>CS / AR / OD</th>
              <th>Pacing</th>
              <th>Batch</th>
              <th>By</th>
              <th style={{ textAlign: "right" }}>Review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                </td>
                <td>
                  <div className="map-cell">
                    <Banner
                      map={{
                        osuBeatmapId: r.osuBeatmapId,
                        osuBeatmapsetId: r.osuBeatmapsetId,
                        title: r.title,
                        version: r.version,
                        tierOrder: r.tierOrder,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                    <a
                      className="t-title"
                      href={
                        r.osuBeatmapsetId
                          ? "https://osu.ppy.sh/beatmapsets/" +
                            r.osuBeatmapsetId +
                            "#osu/" +
                            r.osuBeatmapId
                          : "https://osu.ppy.sh/b/" + r.osuBeatmapId
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {r.title}
                    </a>
                    <span className="t-diff">
                      {[r.version ? "[" + r.version + "]" : "", r.mapper]
                        .filter(Boolean)
                        .join("  " + NONE + "  ")}
                    </span>
                    </div>
                  </div>
                </td>
                <td>
                  <ModChip mod={r.mod} />
                </td>
                <td>
                  <select
                    className="mini"
                    defaultValue={tierByOrder(r.tierOrder)?.name ?? ""}
                    onChange={(e) => run(() => setSuggestionTier(r.id, e.target.value))}
                  >
                    <option value="">Pick a pack</option>
                    {TIERS.map((t) => (
                      <option key={t.slug} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{r.category ?? NONE}</td>
                <td className="num">
                  {r.stars != null ? r.stars.toFixed(2) + "★" : NONE}
                </td>
                <td className="num">{r.bpm != null ? Math.round(r.bpm) : NONE}</td>
                <td className="num">{secondsToDrain(r.drainSeconds) || NONE}</td>
                <td className="trio">
                  <b>{r.cs ?? NONE}</b> / <b>{r.ar ?? NONE}</b> / <b>{r.od ?? NONE}</b>
                </td>
                <td className="small">
                  {(r.lengthBucket || NONE) + " " + NONE + " " + (r.speedBucket || NONE)}
                </td>
                <td className="small">{r.batchId ? "#" + r.batchId : NONE}</td>
                <td className="small">{r.submittedBy ?? NONE}</td>
                <td style={{ textAlign: "right" }}>
                  <div
                    className="row-tight"
                    style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}
                  >
                    <button
                      className="btn btn-sm btn-ok"
                      type="button"
                      disabled={pending || r.tierOrder == null}
                      title={r.tierOrder == null ? "Set a pack first" : undefined}
                      onClick={() => run(() => approveSuggestions([r.id]))}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-sm btn-no"
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => rejectSuggestions([r.id]))}
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={13} className="small">
                  Nothing pending. Add maps and they land here.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
