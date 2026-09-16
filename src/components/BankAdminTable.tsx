"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveEntryTier, removeEntry } from "@/lib/actions";
import { TIERS, tierByOrder } from "@/lib/tiers";
import { MapCell, ModChip, NONE, type MapLike } from "@/components/ui";

export type BankAdminRow = MapLike & {
  entryId: number;
  mod: string;
  tierOrder: number;
  category: string;
  stars: number | null;
  mapper: string | null;
};

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

      <div className="table-wrap">
        <table className="mid">
          <thead>
            <tr>
              <th>Map</th>
              <th>Mod</th>
              <th>Pack</th>
              <th>Category</th>
              <th>Stars</th>
              <th>Mapper</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.entryId}>
                <td>
                  <MapCell map={r} />
                </td>
                <td>
                  <ModChip mod={r.mod} />
                </td>
                <td>
                  <select
                    className="mini"
                    defaultValue={tierByOrder(r.tierOrder)?.name ?? ""}
                    onChange={(e) => run(() => moveEntryTier(r.entryId, e.target.value))}
                  >
                    {TIERS.map((t) => (
                      <option key={t.slug} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{r.category}</td>
                <td className="num">
                  {r.stars != null ? r.stars.toFixed(2) + "★" : NONE}
                </td>
                <td>{r.mapper || NONE}</td>
                <td style={{ textAlign: "right" }}>
                  {confirming === r.entryId ? (
                    <div
                      className="row-tight"
                      style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}
                    >
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
                        Yes
                      </button>
                      <button
                        className="btn btn-sm"
                        type="button"
                        onClick={() => setConfirming(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-sm btn-no"
                      type="button"
                      onClick={() => setConfirming(r.entryId)}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="small">
                  The ladder is empty.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
