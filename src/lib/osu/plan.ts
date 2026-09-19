/**
 * The decisions of a sync pass, kept apart from the database and the osu!
 * client so they can be tested on their own.
 */

export type SyncReason = "played" | "retry" | "backstop";

export type PlayCountReading = {
  userId: number;
  /** What the last check stored, null before the first one. */
  stored: number | null;
  /** What osu! reports now, undefined when it did not return the player. */
  fetched: number | undefined;
};

/**
 * Decides who a pass syncs, in order: players whose play count rose, then
 * players still waiting for a play to show up, then the backstop sweep.
 *
 * A first reading, with nothing stored to compare against, only records the
 * count. Players over the cap who played are handed back as `deferred`, so
 * the next pass takes them first rather than waiting for another play;
 * backstop players over the cap need no such help, as they stay overdue.
 */
export function planPass(input: {
  readings: PlayCountReading[];
  retrying: number[];
  overdue: number[];
  max: number;
}): { now: Array<{ userId: number; reason: SyncReason }>; deferred: number[] } {
  const order: Array<{ userId: number; reason: SyncReason }> = [];
  const seen = new Set<number>();
  const add = (userId: number, reason: SyncReason) => {
    if (seen.has(userId)) return;
    seen.add(userId);
    order.push({ userId, reason });
  };

  for (const r of input.readings) {
    if (r.fetched != null && r.stored != null && r.fetched > r.stored) add(r.userId, "played");
  }
  for (const id of input.retrying) add(id, "retry");
  for (const id of input.overdue) add(id, "backstop");

  const now = order.slice(0, Math.max(0, input.max));
  const deferred = order
    .slice(now.length)
    .filter((d) => d.reason !== "backstop")
    .map((d) => d.userId);
  return { now, deferred };
}
