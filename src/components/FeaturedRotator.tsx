"use client";

import { useEffect, useRef, useState, type CSSProperties, type TouchEvent } from "react";
import Link from "next/link";
import { Cover } from "@/components/Cover";
import { CategoryChips, ModIcons, NONE, TierChip, mapHref } from "@/components/ui";
import type { BankRow } from "@/lib/queries";
import { tierByOrder } from "@/lib/tiers";

/**
 * Cycles the hero card through the newest entries. Pauses while the pointer
 * or keyboard focus is on it, stops once a dot, an arrow or a swipe is used,
 * and never starts under reduced motion.
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
  const [held, setHeld] = useState(false);
  const [still, setStill] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const cycling = entries.length > 1 && !held && !still;

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (paused || !cycling) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % entries.length),
      intervalMs,
    );
    return () => window.clearInterval(id);
  }, [paused, cycling, entries.length, intervalMs]);

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

  const step = (by: number) => {
    setIndex((i) => (i + by + entries.length) % entries.length);
    setHeld(true);
  };

  const m = entries[Math.min(index, entries.length - 1)];
  const tier = tierByOrder(m.tierOrder);

  // A mostly sideways swipe of 40px or more steps the card.
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || entries.length < 2) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    step(dx < 0 ? 1 : -1);
  };

  return (
    <div
      className="box feat rotator"
      style={{ "--tier": tier ? tier.color : "var(--accent)" } as CSSProperties}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => {
        touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => (touch.current = null)}
    >
      {/* How long this card has left, on the same interval as the swap. */}
      {cycling ? (
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
        <span className="feat-badge">Newest in the bank</span>
        <div className="feat-body">
          <h2 className="feat-title">
            <Link href={mapHref(m.osuBeatmapId, m.mod)}>{m.title}</Link>
          </h2>
          <span className="t-diff">
            {[m.version ? "[" + m.version + "]" : "", m.mapper]
              .filter(Boolean)
              .join("  " + NONE + "  ")}
          </span>
          <div className="row-tight" style={{ marginTop: 2 }}>
            <TierChip tier={m.tierOrder} />
            <ModIcons mod={m.mod} />
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
        <div className="rotator-nav">
          <button type="button" className="rotator-arrow" aria-label="Previous map" onClick={() => step(-1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14.5 6 8.5 12l6 6" />
            </svg>
          </button>
          <button type="button" className="rotator-arrow" aria-label="Next map" onClick={() => step(1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9.5 6 6 6-6 6" />
            </svg>
          </button>
        </div>
      ) : null}

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
              onClick={() => {
                setIndex(i);
                setHeld(true);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
