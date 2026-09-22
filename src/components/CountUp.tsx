"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * A figure that counts up to itself once, as the page arrives. The server
 * renders the real number, so that is what sits there without scripts.
 * Skipped entirely under reduced motion, which the stylesheet cannot reach.
 */

// useLayoutEffect has nothing to do on the server and says so loudly.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function CountUp({
  value,
  decimals = 0,
  durationMs = 1100,
}: {
  value: number;
  /** A star rating carries two of these; a count carries none. */
  decimals?: number;
  durationMs?: number;
}) {
  const [shown, setShown] = useState(value);
  const frame = useRef(0);

  useIsomorphicLayoutEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still || value <= 0) {
      setShown(value);
      return;
    }

    let started = 0;
    setShown(0);

    const step = (now: number) => {
      if (!started) started = now;
      const p = Math.min(1, (now - started) / durationMs);
      // Decelerating, so the last few numbers can be read.
      setShown(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [value, durationMs]);

  return <>{shown.toFixed(decimals)}</>;
}
