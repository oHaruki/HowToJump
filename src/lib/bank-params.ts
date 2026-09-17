/**
 * The bank's filters as they travel in the URL.
 *
 * Both banks read the same query keys, so the parsing lives here rather than
 * twice: the public page and the staff page cannot drift into disagreeing
 * about what `?length=Long` means, and the pager builds its links from the
 * same list the bar writes.
 */
import { tierBySlug } from "@/lib/tiers";
import type { BankFilters, BankStatus } from "@/lib/queries";

export type Search = Record<string, string | string[] | undefined>;

/** A repeated key is a hand edited URL, so the first one wins. */
export const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

/** Every filter that belongs in a paging link, in the order the bar reads. */
export const FILTER_KEYS = [
  "q", "pack", "category", "mod", "length", "speed", "status", "stale",
] as const;

/**
 * Turns the query string into filters.
 *
 * `staff` gates the two filters that can reach entries taken off the ladder.
 * Without it `?status=all` on the public bank would list what staff removed,
 * so the flag is what makes that URL inert rather than the page remembering
 * not to pass it on.
 */
export function bankFiltersFrom(sp: Search, staff = false): BankFilters {
  const pack = tierBySlug(one(sp.pack));
  const status = one(sp.status);

  return {
    q: one(sp.q) || undefined,
    pack: pack?.order,
    category: one(sp.category) || undefined,
    mod: one(sp.mod) || undefined,
    length: one(sp.length) || undefined,
    speed: one(sp.speed) || undefined,
    status: staff ? asStatus(status) : "listed",
    staleLabels: staff && one(sp.stale) === "labels",
  };
}

/** Anything unrecognised reads as the default rather than as an error. */
function asStatus(v: string): BankStatus {
  return v === "removed" || v === "all" ? v : "listed";
}

/** The filters as the bar shows them, with every key present as a string. */
export function bankCurrentFrom(sp: Search) {
  return {
    q: one(sp.q),
    pack: one(sp.pack),
    category: one(sp.category),
    mod: one(sp.mod),
    length: one(sp.length),
    speed: one(sp.speed),
    status: one(sp.status),
    stale: one(sp.stale),
  };
}

/** The filters serialised for a paging link. The page is the pager's own. */
export function bankQueryFrom(sp: Search): string {
  const query = new URLSearchParams();
  for (const k of FILTER_KEYS) if (one(sp[k])) query.set(k, one(sp[k]));
  return query.toString();
}

/** The page asked for, before it is clamped against the real page count. */
export function bankPageFrom(sp: Search): number {
  return Number(one(sp.page)) || 1;
}
