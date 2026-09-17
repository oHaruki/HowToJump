"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeEntry, updateEntry } from "@/lib/actions";
import { CATEGORIES, LENGTHS, SPEEDS, tierByName, tierByOrder, tierBySlug } from "@/lib/tiers";
import { MODS } from "@/lib/mods";
import { ModChip, NONE } from "@/components/ui";
import { MapCard, PackTile } from "@/components/MapCard";
import { PackPicker } from "@/components/PackPicker";

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
          const pacing = [r.lengthBucket, r.speedBucket]
            .filter(Boolean)
            .join(" " + NONE + " ");

          return (
            <MapCard
              key={r.entryId}
              osuBeatmapId={r.osuBeatmapId}
              osuBeatmapsetId={r.osuBeatmapsetId}
              title={r.title}
              version={r.version}
              mapper={r.mapper}
              tierOrder={r.tierOrder}
              stars={r.stars}
              bpm={r.bpm}
              drain={r.drain}
              cs={r.cs}
              ar={r.ar}
              od={r.od}
              packEditable={isEditing}
              pack={
                isEditing ? (
                  <PackPicker
                    value={tierByName(draft.tier)?.slug ?? ""}
                    onChange={(slug) => {
                      const t = tierBySlug(slug);
                      if (t) setDraft({ ...draft, tier: t.name });
                    }}
                  />
                ) : (
                  <PackTile tierOrder={r.tierOrder} />
                )
              }
              tags={
                isEditing ? (
                  <>
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
                      <span className="small">Mod change recalculates the figures</span>
                    ) : null}
                  </>
                ) : (
                  <>
                    <ModChip mod={r.mod} />
                    <span className="chip">{r.category}</span>
                    {pacing ? <span className="chip">{pacing}</span> : null}
                    {r.judgedByName ? (
                      <span className="small">by {r.judgedByName}</span>
                    ) : null}
                  </>
                )
              }
              actions={
                isEditing ? (
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
                    <button
                      className="btn btn-sm btn-no"
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setConfirming(null);
                        run(() => removeEntry(r.entryId));
                      }}
                    >
                      Confirm
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
                      onClick={() => {
                        setError(null);
                        setConfirming(null);
                        setEditing(r.entryId);
                        setDraft({
                          tier: tierByOrder(r.tierOrder)?.name ?? "",
                          category: r.category ?? "",
                          mod: r.mod,
                          length: r.lengthBucket ?? "",
                          speed: r.speedBucket ?? "",
                        });
                      }}
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
                )
              }
            />
          );
        })}

        {!rows.length ? <p className="small">The ladder is empty.</p> : null}
      </div>
    </>
  );
}
