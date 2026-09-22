"use client";

import { useState } from "react";
import { tierByOrder } from "@/lib/tiers";

/**
 * Beatmap cover art. Sets with no cover uploaded 404, and the metadata does
 * not say which, so the fallback is driven by the image failing to load.
 */
export function Cover({
  setId,
  kind = "list",
  tierOrder,
  className = "thumb",
  label = true,
}: {
  setId: number | null | undefined;
  kind?: "list" | "card" | "cover";
  tierOrder?: number | null;
  className?: string;
  /** Off for full bleed backgrounds, where a caption would be noise. */
  label?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const tier = tierByOrder(tierOrder ?? null);
  const tint = "color-mix(in srgb, " + (tier ? tier.color : "#777") + " 22%, var(--bg-d))";

  if (!setId || failed) {
    const fill = tier
      ? "linear-gradient(120deg, color-mix(in srgb, " + tier.color +
        " 26%, var(--bg-d)), var(--bg-d))"
      : tint;
    return (
      <div className={className + " art-none"} style={{ background: fill }}>
        {label ? "no bg" : null}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={"https://assets.ppy.sh/beatmaps/" + setId + "/covers/" + kind + ".jpg"}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
