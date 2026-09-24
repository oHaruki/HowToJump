"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteScore } from "@/lib/actions";

/** An admin's delete on a scoreboard row, asked a second time before it goes. */
export function ScoreDelete({ scoreId }: { scoreId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="sb-delete">
      {error ? <span className="small">{error}</span> : null}
      {confirming ? (
        <>
          <button
            className="btn btn-sm btn-no"
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                try {
                  await deleteScore(scoreId);
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                  setConfirming(false);
                }
              })
            }
          >
            {pending ? "Deleting" : "Confirm"}
          </button>
          <button
            className="btn btn-sm"
            type="button"
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
        </>
      ) : (
        <button className="btn btn-sm" type="button" onClick={() => setConfirming(true)}>
          Delete
        </button>
      )}
    </span>
  );
}
