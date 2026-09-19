"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncMyScores, type SyncSummary } from "@/lib/actions";

/** How many imported maps the message names before it just counts the rest. */
const NAMED = 3;

function describe(r: SyncSummary): string {
  if (r.error) return r.error;
  if (r.syncedSecondsAgo != null) return "Synced " + r.syncedSecondsAgo + "s ago";
  if (!r.imported.length) return r.playsSeen + " plays read, nothing new";
  const named = r.imported.slice(0, NAMED).join(", ");
  const rest = r.imported.length - NAMED;
  return "Imported " + named + (rest > 0 ? " and " + rest + " more" : "");
}

export function SyncButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="row-tight">
      {msg ? <span className="small">{msg}</span> : null}
      <button
        className="btn btn-primary"
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            try {
              setMsg(describe(await syncMyScores()));
              router.refresh();
            } catch (e) {
              setMsg(e instanceof Error ? e.message : String(e));
            }
          })
        }
      >
        {pending ? "Syncing" : "Sync now"}
      </button>
    </div>
  );
}
