"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps an open profile current. The worker picks scores up within a minute,
 * so the page asks again every minute, and straight away when the player
 * comes back to the tab, which is usually right after a play. Fresh data is
 * all this brings: the page itself stays still, and the level up popup waits
 * for the player to be looking before it offers anything.
 */
export function LiveRefresh({ everyMs = 60_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(refresh, everyMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, everyMs]);
  return null;
}
