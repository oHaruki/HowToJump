"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncMyScores } from "@/lib/actions";

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
              const r = await syncMyScores();
              setMsg(
                r.error
                  ? r.error
                  : r.scoresImported
                    ? r.scoresImported + " new"
                    : r.playsSeen + " plays read, nothing new",
              );
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
