"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveSuggestions, rejectSuggestions, setSuggestionTier } from "@/lib/actions";
import { tierByOrder, tierBySlug } from "@/lib/tiers";
import { ModChip, NONE, PacingChips } from "@/components/ui";
import { MapCard } from "@/components/MapCard";
import { PackPicker } from "@/components/PackPicker";
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
          {rows.length} pending
          {selected.size ? ", " + selected.size + " selected" : ""}
          {selected.size && approvable.length < selected.size
            ? " (" + (selected.size - approvable.length) + " without a pack)"
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

      <div className="review-list">
        {rows.map((r) => (
          <MapCard
            key={r.id}
            osuBeatmapId={r.osuBeatmapId}
            osuBeatmapsetId={r.osuBeatmapsetId}
            title={r.title}
            version={r.version}
            mapper={r.mapper}
            tierOrder={r.tierOrder}
            stars={r.stars}
            bpm={r.bpm}
            drain={secondsToDrain(r.drainSeconds)}
            cs={r.cs}
            ar={r.ar}
            od={r.od}
            tone={r.tierOrder == null ? "attention" : undefined}
            leading={
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
                aria-label={"Select " + (r.title ?? "map")}
              />
            }
            packEditable
            pack={
              <PackPicker
                value={tierByOrder(r.tierOrder)?.slug ?? ""}
                placeholder="Pick a pack"
                allowClear={false}
                onChange={(slug) => {
                  const t = tierBySlug(slug);
                  run(() => setSuggestionTier(r.id, t ? t.name : ""));
                }}
              />
            }
            tags={
              <>
                <ModChip mod={r.mod} />
                <span className="chip">{r.category ?? "no category"}</span>
                <PacingChips length={r.lengthBucket} speed={r.speedBucket} />
                <span className="small">
                  {"batch #" + (r.batchId ?? NONE) + "  " + NONE + "  " +
                    (r.submittedBy ?? NONE)}
                </span>
              </>
            }
            actions={
              <>
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
              </>
            }
          />
        ))}

        {!rows.length ? (
          <p className="small">Nothing pending. Add maps and they land here.</p>
        ) : null}
      </div>
    </>
  );
}
