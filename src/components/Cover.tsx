"use client";

import { useState } from "react";
import { tierByOrder } from "@/lib/tiers";

/**
 * Beatmap cover art.
 *
 * osu! serves every set from a predictable URL, but old sets genuinely have
 * no cover uploaded and 404 there. There is no way to know which from the
 * metadata, so the fallback is driven by the image failing to load rather
 * than by a missing URL.
 */
export function Cover({
  setId,
  kind = "list",
  tierOrder,
  className = "thumb",
}: {
  setId: number | null | undefined;
  kind?: "list" | "card" | "cover";
  tierOrder?: number | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const tier = tierByOrder(tierOrder ?? null);
  const tint = "color-mix(in srgb, " + (tier ? tier.color : "#777") + " 22%, var(--bg-d))";

  if (!setId || failed) {
    return (
      <div className={className + " art-none"} style={{ background: tint }}>
        no bg
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
