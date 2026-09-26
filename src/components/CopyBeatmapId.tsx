"use client";

import { useEffect, useState } from "react";

/**
 * Copies a beatmap's ID, not its set's, to the clipboard. Compact is the
 * small line on a map card; otherwise it is a full button.
 */
export function CopyBeatmapId({ id, compact }: { id: number; compact?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 1500);
    return () => clearTimeout(t);
  }, [state]);

  const idle = compact ? "Copy ID " + id : "Copy beatmap ID";

  return (
    <button
      className={compact ? "copyid" : "btn btn-ghost"}
      type="button"
      title={"Beatmap ID " + id}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(String(id));
          setState("copied");
        } catch {
          setState("failed");
        }
      }}
    >
      {state === "copied" ? "Copied " + id : state === "failed" ? "Copy failed" : idle}
    </button>
  );
}
