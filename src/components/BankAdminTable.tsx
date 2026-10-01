"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeEntry, restoreEntry, updateEntry } from "@/lib/actions";
import {
  LENGTHS, SPEEDS, LENGTH_SCALE, SPEED_SCALE, scaleHint,
  tierByName, tierByOrder, tierBySlug,
} from "@/lib/tiers";
import { MODS, modsText } from "@/lib/mods";
import type { SpecialPack } from "@/lib/packs";
import { timeAgo } from "@/lib/time";
import { CategoryChips, ModChip, PacingChips, PickSelect, SpecialChip } from "@/components/ui";
import { MapCard, PackTile } from "@/components/MapCard";
import { PackPicker } from "@/components/PackPicker";
import { CategoryPicker } from "@/components/CategoryPicker";

const LENGTH_HINT = scaleHint(LENGTH_SCALE, "Drain time");
const SPEED_HINT = scaleHint(SPEED_SCALE, "BPM");

export type BankAdminRow = {
  entryId: number;
  osuBeatmapId: number;
  osuBeatmapsetId: number | null;
  title: string | null;
  version: string | null;
  mapper: string | null;
  mod: string;
  tierOrder: number;
  /** The special pack it sits in, off the ladder. */
  pack: SpecialPack | null;
  categories: string[];
  lengthBucket: string | null;
  speedBucket: string | null;
  stars: number | null;
  bpm: number | null;
  drain: string;
  cs: number | null;
  ar: number | null;
  od: number | null;
  judgedByName: string | null;
  isActive: boolean;
  createdAt: Date;
};

type Draft = {
  tier: string;
  /** A special pack's ID, or "" for the ladder. */
  pack: string;
  categories: string[];
  mod: string;
  length: string;
  speed: string;
};

export function BankAdminTable({
  rows,
  special = [],
  showAdded,
}: {
  rows: BankAdminRow[];
  /** Special packs an entry can be moved into. */
  special?: readonly SpecialPack[];
  /** Adds when each entry was added. */
  showAdded?: boolean;
}) {
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
              status={
                r.isActive ? null : (
                  <span className="chip warn">Removed</span>
                )
              }
              pack={
                isEditing ? (
                  <>
                    <PackPicker
                      value={tierByName(draft.tier)?.slug ?? ""}
                      placeholder="Pick a pack"
                      allowClear={false}
                      onChange={(slug) => {
                        const t = tierBySlug(slug);
                        if (t) setDraft({ ...draft, tier: t.name });
                      }}
                    />
                    <SpecialSelect
                      value={draft.pack}
                      special={special}
                      current={r.pack}
                      disabled={pending}
                      onChange={(v) => setDraft({ ...draft, pack: v })}
                    />
                  </>
                ) : (
                  <>
                    <PackTile tierOrder={r.tierOrder} />
                    {r.pack ? <SpecialChip pack={r.pack} /> : null}
                  </>
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
                    <CategoryPicker
                      mini
                      value={draft.categories}
                      onChange={(v) => setDraft({ ...draft, categories: v })}
                    />
                    <PickSelect
                      value={draft.length}
                      options={LENGTHS}
                      placeholder="Length"
                      hint={LENGTH_HINT}
                      disabled={pending}
                      onChange={(v) => setDraft({ ...draft, length: v })}
                    />
                    <PickSelect
                      value={draft.speed}
                      options={SPEEDS}
                      placeholder="Speed"
                      hint={SPEED_HINT}
                      disabled={pending}
                      onChange={(v) => setDraft({ ...draft, speed: v })}
                    />
                    {draft.mod !== r.mod ? (
                      <span className="small">
                        Mod change recalculates the figures and removes the{" "}
                        {modsText([r.mod])} scores
                      </span>
                    ) : null}
                  </>
                ) : (
                  <>
                    <ModChip mod={r.mod} />
                    <CategoryChips categories={r.categories} />
                    <PacingChips length={r.lengthBucket} speed={r.speedBucket} />
                    {r.judgedByName || showAdded ? (
                      <span className="small">
                        {[
                          r.judgedByName ? "by " + r.judgedByName : "",
                          showAdded ? "added " + timeAgo(r.createdAt) : "",
                        ].filter(Boolean).join(" · ")}
                      </span>
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
                      onClick={() =>
                        run(
                          () =>
                            updateEntry(r.entryId, {
                              ...draft,
                              pack: draft.pack ? Number(draft.pack) : null,
                            }),
                          closeEdit,
                        )
                      }
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
                          pack: r.pack ? String(r.pack.id) : "",
                          categories: r.categories,
                          mod: r.mod,
                          length: r.lengthBucket ?? "",
                          speed: r.speedBucket ?? "",
                        });
                      }}
                    >
                      Edit
                    </button>
                    {r.isActive ? (
                      <button
                        className="btn btn-sm btn-no"
                        type="button"
                        onClick={() => setConfirming(r.entryId)}
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        className="btn btn-sm"
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => restoreEntry(r.entryId))}
                      >
                        Restore
                      </button>
                    )}
                  </>
                )
              }
            />
          );
        })}

        {!rows.length ? (
          <p className="small">Nothing matches those filters.</p>
        ) : null}
      </div>
    </>
  );
}

/**
 * Where an entry sits: on the ladder, or in a special pack. A special
 * pack's map keeps its ladder pack, which sets what it pays.
 */
function SpecialSelect({
  value,
  special,
  current,
  disabled,
  onChange,
}: {
  value: string;
  special: readonly SpecialPack[];
  /** The entry's special pack now, offered even when the list leaves it out. */
  current: SpecialPack | null;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const options = current && !special.some((p) => p.id === current.id) ? [...special, current] : special;
  if (!options.length) return null;
  return (
    <select
      className="mini"
      value={value}
      disabled={disabled}
      aria-label="Special pack"
      title="A special pack's maps count toward its own board, not toward levels"
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">On the ladder</option>
      {options.map((p) => (
        <option key={p.id} value={String(p.id)}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
