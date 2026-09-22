"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Cover } from "@/components/Cover";
import { CategoryChips, ModChip, NONE, TierChip } from "@/components/ui";
import type { BankRow } from "@/lib/queries";
import { tierByOrder } from "@/lib/tiers";

/**
 * Cycles the hero card through the newest entries. Pauses while the pointer
 * or keyboard focus is on it.
 */
export function FeaturedRotator({
  entries,
  intervalMs = 7000,
}: {
  entries: BankRow[];
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || entries.length < 2) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % entries.length),
      intervalMs,
    );
    return () => window.clearInterval(id);
  }, [paused, entries.length, intervalMs]);

  if (!entries.length) {
    return (
      <div className="box feat">
        <div className="feat-body">
          <span className="lbl">Nothing banked yet</span>
          <h3>The bank is empty</h3>
          <p className="small">Staff add the first entries from the Add maps screen.</p>
        </div>
      </div>
    );
  }

  const m = entries[Math.min(index, entries.length - 1)];
  const tier = tierByOrder(m.tierOrder);
  const url = m.osuBeatmapsetId
    ? "https://osu.ppy.sh/beatmapsets/" + m.osuBeatmapsetId + "#osu/" + m.osuBeatmapId
    : "https://osu.ppy.sh/b/" + m.osuBeatmapId;

  return (
    <div
      className="box feat rotator"
      style={{ "--tier": tier ? tier.color : "var(--accent)" } as CSSProperties}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* How long this card has left, on the same interval as the swap. */}
      {entries.length > 1 ? (
        <span
          className="rotator-bar"
          key={"bar-" + m.entryId}
          style={{
            animationDuration: intervalMs + "ms",
            animationPlayState: paused ? "paused" : "running",
          }}
        />
      ) : null}

      {/* Keyed on the entry so each swap replays the fade. */}
      <div className="rotator-slide" key={m.entryId}>
        <Cover
          setId={m.osuBeatmapsetId}
          kind="card"
          tierOrder={m.tierOrder}
          className="feat-art"
          label={false}
        />
        <div className="feat-body">
          <span className="lbl">Newest in the bank</span>
          <h3>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              {m.title}
            </a>
          </h3>
          <span className="t-diff">
            {[m.version ? "[" + m.version + "]" : "", m.mapper]
              .filter(Boolean)
              .join("  " + NONE + "  ")}
          </span>
          <div className="row-tight" style={{ marginTop: 2 }}>
            <TierChip tier={m.tierOrder} />
            <ModChip mod={m.mod} />
            <CategoryChips categories={m.categories} />
          </div>
          <div className="statline">
            <span>
              <i>Stars</i>
              <b>{m.stars != null ? m.stars.toFixed(2) + "★" : NONE}</b>
            </span>
            <span><i>BPM</i><b>{m.bpm != null ? Math.round(m.bpm) : NONE}</b></span>
            <span><i>Length</i><b>{m.drain || NONE}</b></span>
            <span><i>CS</i><b>{m.cs ?? NONE}</b></span>
            <span><i>AR</i><b>{m.ar ?? NONE}</b></span>
            <span><i>OD</i><b>{m.od ?? NONE}</b></span>
          </div>
        </div>
      </div>

      {entries.length > 1 ? (
        <div className="rotator-dots">
          {entries.map((e, i) => (
            <button
              key={e.entryId}
              type="button"
              className="rotator-dot"
              data-active={String(i === index)}
              aria-label={"Show " + (e.title ?? "entry " + (i + 1))}
              aria-current={i === index}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
