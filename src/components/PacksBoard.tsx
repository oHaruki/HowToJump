"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPack, deletePack, updatePack } from "@/lib/actions";
import type { SpecialPackRow } from "@/lib/queries";

type Draft = { name: string; color: string; description: string };

const NEW_PACK: Draft = { name: "", color: "#7c8cff", description: "" };

/**
 * The special packs, oldest first, each edited or deleted from its own row.
 * New packs are made below the list. Maps go into one from its Maps page.
 */
export function PacksBoard({ packs }: { packs: SpecialPackRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);

  const run = (fn: () => Promise<{ error?: string } | void>, after?: () => void) => {
    setError(null);
    start(async () => {
      try {
        const r = await fn();
        if (r?.error) {
          setError(r.error);
          return;
        }
        after?.();
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

      {packs.length ? (
        <div className="packs-list">
          {packs.map((p) =>
            editing === p.id ? (
              <PackForm
                key={p.id}
                initial={{ name: p.name, color: p.color, description: p.description ?? "" }}
                label="Edit pack"
                submit="Save"
                pending={pending}
                onCancel={() => setEditing(null)}
                onSubmit={(d) => run(() => updatePack(p.id, d), () => setEditing(null))}
              />
            ) : (
              <div className="box packs-item" key={p.id}>
                <span className="pk-gem" style={{ background: p.color }} />
                <div className="packs-info">
                  <b>{p.name}</b>
                  <span className="small">
                    {p.maps} {p.maps === 1 ? "map" : "maps"}
                    {p.description ? " · " + p.description : ""}
                  </span>
                </div>
                <div className="packs-actions">
                  {confirming === p.id ? (
                    <>
                      <span className="small">
                        {p.maps
                          ? "Its " + (p.maps === 1 ? "map" : p.maps + " maps") + " and every score on them go too"
                          : "It has no maps"}
                      </span>
                      <button
                        className="btn btn-sm btn-no"
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setConfirming(null);
                          run(() => deletePack(p.id));
                        }}
                      >
                        Confirm
                      </button>
                      <button className="btn btn-sm" type="button" onClick={() => setConfirming(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <Link className="btn btn-sm" href={"/packs/" + p.id}>
                        View
                      </Link>
                      <Link className="btn btn-sm" href={"/staff/packs/" + p.id}>
                        Maps
                      </Link>
                      <button
                        className="btn btn-sm"
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setConfirming(null);
                          setEditing(p.id);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-no"
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setEditing(null);
                          setConfirming(p.id);
                        }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      ) : (
        <p className="small">No special packs yet.</p>
      )}

      <PackForm
        initial={NEW_PACK}
        label="New pack"
        submit="Create pack"
        pending={pending}
        onSubmit={(d, reset) => run(() => createPack(d), reset)}
      />
    </>
  );
}

function PackForm({
  initial,
  label,
  submit,
  pending,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  label: string;
  submit: string;
  pending: boolean;
  /** `reset` empties the form, for once the pack is made. */
  onSubmit: (draft: Draft, reset: () => void) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <form
      className="box stack"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft, () => setDraft(initial));
      }}
    >
      <span className="lbl">{label}</span>
      <div className="packs-form-top">
        <label className="field" style={{ flex: "1 1 240px" }}>
          <span className="lbl">Name</span>
          <input
            type="text"
            value={draft.name}
            maxLength={40}
            placeholder="Summer event"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="lbl">Colour</span>
          <input
            type="color"
            value={draft.color}
            onChange={(e) => setDraft({ ...draft, color: e.target.value })}
          />
        </label>
      </div>
      <label className="field">
        <span className="lbl">Description</span>
        <input
          type="text"
          value={draft.description}
          maxLength={300}
          placeholder="Optional, shown on the pack's page"
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </label>
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={pending || !draft.name.trim()}>
          {pending ? "Saving" : submit}
        </button>
        {onCancel ? (
          <button className="btn" type="button" disabled={pending} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
