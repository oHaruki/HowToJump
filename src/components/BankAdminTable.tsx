"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeEntry, updateEntry } from "@/lib/actions";
import { CATEGORIES, LENGTHS, SPEEDS, TIERS, tierByOrder } from "@/lib/tiers";
import { MODS } from "@/lib/mods";
import { ModChip, NONE, TierChip } from "@/components/ui";
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

type Draft = {
  tier: string;
  category: string;
  mod: string;
  length: string;
  speed: string;
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span>
      <i>{label}</i>
      <b>{value}</b>
    </span>
  );
}

function draftOf(r: BankAdminRow): Draft {
  return {
    tier: tierByOrder(r.tierOrder)?.name ?? "",
    category: r.category ?? "",
    mod: r.mod,
    length: r.lengthBucket ?? "",
    speed: r.speedBucket ?? "",
  };
}

export function BankAdminTable({ rows }: { rows: BankAdminRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);

  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    start(async () => {
      try {
        await fn();
        after?.();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const beginEdit = (r: BankAdminRow) => {
    setError(null);
    setConfirming(null);
    setEditing(r.entryId);
    setDraft(draftOf(r));
  };

  const closeEdit = () => {
    setEditing(null);
    setDraft(null);
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
          const isEditing = editing === r.entryId && draft !== null;
          const url = r.osuBeatmapsetId
            ? "https://osu.ppy.sh/beatmapsets/" + r.osuBeatmapsetId + "#osu/" + r.osuBeatmapId
            : "https://osu.ppy.sh/b/" + r.osuBeatmapId;
          const pacing = [r.lengthBucket, r.speedBucket]
            .filter(Boolean)
            .join(" " + NONE + " ");

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
                </div>

                {isEditing ? (
                  <div className="review-controls">
                    <select
                      className="mini"
                      value={draft.tier}
                      disabled={pending}
                      onChange={(e) => setDraft({ ...draft, tier: e.target.value })}
                    >
                      {TIERS.map((t) => (
                        <option key={t.slug} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                    <select
                      className="mini"
                      value={draft.mod}
                      disabled={pending}
                      onChange={(e) => setDraft({ ...draft, mod: e.target.value })}
                    >
                      {MODS.concat(MODS.includes(draft.mod) ? [] : [draft.mod]).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      className="mini"
                      value={draft.category}
                      disabled={pending}
                      onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    >
                      {CATEGORIES.concat(
                        draft.category && !CATEGORIES.includes(draft.category)
                          ? [draft.category]
                          : [],
                      ).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <select
                      className="mini"
                      value={draft.length}
                      disabled={pending}
                      onChange={(e) => setDraft({ ...draft, length: e.target.value })}
                    >
                      <option value="">Length</option>
                      {LENGTHS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <select
                      className="mini"
                      value={draft.speed}
                      disabled={pending}
                      onChange={(e) => setDraft({ ...draft, speed: e.target.value })}
                    >
                      <option value="">Speed</option>
                      {SPEEDS.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
                    </select>
                    {draft.mod !== r.mod ? (
                      <span className="small">
                        Changing the mod recalculates the figures
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div className="review-controls">
                    <TierChip tier={r.tierOrder} />
                    <ModChip mod={r.mod} />
                    <span className="chip">{r.category}</span>
                    {pacing ? <span className="chip">{pacing}</span> : null}
                    {r.judgedByName ? (
                      <span className="small">judged by {r.judgedByName}</span>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="review-actions">
                {isEditing ? (
                  <>
                    <button
                      className="btn btn-sm btn-primary"
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => updateEntry(r.entryId, draft), closeEdit)}
                    >
                      {pending ? "Saving" : "Save"}
                    </button>
                    <button
                      className="btn btn-sm"
                      type="button"
                      disabled={pending}
                      onClick={closeEdit}
                    >
                      Cancel
                    </button>
                  </>
                ) : confirming === r.entryId ? (
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
                  <>
                    <button
                      className="btn btn-sm"
                      type="button"
                      onClick={() => beginEdit(r)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-no"
                      type="button"
                      onClick={() => setConfirming(r.entryId)}
                    >
                      Remove
                    </button>
                  </>
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
