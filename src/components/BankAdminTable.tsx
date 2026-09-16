"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveEntryTier, removeEntry } from "@/lib/actions";
import { TIERS, tierByOrder } from "@/lib/tiers";
import { ModChip, NONE } from "@/components/ui";
import { Cover } from "@/components/Cover";

export type BankAdminRow = {
  entryId: number;
  osuBeatmapId: number;
  osuBeatmapsetId: number | null;
  title: string | null;
  version: string | null;
  mapper: string | null;
  mod: string;
  tierOrder: number;
  category: string;
  lengthBucket: string | null;
  speedBucket: string | null;
  stars: number | null;
  bpm: number | null;
  drain: string;
  cs: number | null;
  ar: number | null;
  od: number | null;
  judgedByName: string | null;
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span>
      <i>{label}</i>
      <b>{value}</b>
    </span>
  );
}

export function BankAdminTable({ rows }: { rows: BankAdminRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);

  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <>
      {error ? (
        <div className="notice bad">
          <span className="chip bad" style={{ flex: "none" }}>Error</span>
          <div>{error}</div>
        </div>
      ) : null}

      <div className="review-list">
        {rows.map((r) => {
          const url = r.osuBeatmapsetId
            ? "https://osu.ppy.sh/beatmapsets/" + r.osuBeatmapsetId + "#osu/" + r.osuBeatmapId
            : "https://osu.ppy.sh/b/" + r.osuBeatmapId;
          return (
            <div className="review-card" key={r.entryId}>
              <Cover
                setId={r.osuBeatmapsetId}
                kind="card"
                tierOrder={r.tierOrder}
                className="review-art"
              />

              <div className="review-body">
                <div>
                  <a className="t-title" href={url} target="_blank" rel="noopener noreferrer">
                    {r.title}
                  </a>
                  <span className="t-diff">
                    {[r.version ? "[" + r.version + "]" : "", r.mapper]
                      .filter(Boolean)
                      .join("  " + NONE + "  ")}
                  </span>
                </div>

                <div className="statline">
                  <Stat
                    label="Stars"
                    value={r.stars != null ? r.stars.toFixed(2) + "★" : NONE}
                  />
                  <Stat label="BPM" value={r.bpm != null ? Math.round(r.bpm) : NONE} />
                  <Stat label="Length" value={r.drain || NONE} />
                  <Stat label="CS" value={r.cs ?? NONE} />
                  <Stat label="AR" value={r.ar ?? NONE} />
                  <Stat label="OD" value={r.od ?? NONE} />
                  <Stat
                    label="Pacing"
                    value={
                      [r.lengthBucket, r.speedBucket].filter(Boolean).join(" " + NONE + " ") ||
                      NONE
                    }
                  />
                </div>

                <div className="review-controls">
                  <select
                    className="mini"
                    defaultValue={tierByOrder(r.tierOrder)?.name ?? ""}
                    disabled={pending}
                    onChange={(e) => run(() => moveEntryTier(r.entryId, e.target.value))}
                  >
                    {TIERS.map((t) => (
                      <option key={t.slug} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <ModChip mod={r.mod} />
                  <span className="chip">{r.category}</span>
                  {r.judgedByName ? (
                    <span className="small">judged by {r.judgedByName}</span>
                  ) : null}
                </div>
              </div>

              <div className="review-actions">
                {confirming === r.entryId ? (
                  <>
                    <span className="small">Take it off?</span>
                    <button
                      className="btn btn-sm btn-no"
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setConfirming(null);
                        run(() => removeEntry(r.entryId));
                      }}
                    >
                      Yes, remove
                    </button>
                    <button
                      className="btn btn-sm"
                      type="button"
                      onClick={() => setConfirming(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-sm btn-no"
                    type="button"
                    onClick={() => setConfirming(r.entryId)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!rows.length ? <p className="small">The ladder is empty.</p> : null}
      </div>
    </>
  );
}
