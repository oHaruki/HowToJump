"use client";

import { useEffect, useState } from "react";

/** Copies a beatmap's ID, not its set's, to the clipboard. */
export function CopyBeatmapId({ id }: { id: number }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 1500);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <button
      className="btn btn-ghost"
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
      {state === "copied" ? "Copied " + id : state === "failed" ? "Copy failed" : "Copy beatmap ID"}
    </button>
  );
}
