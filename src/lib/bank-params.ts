/**
 * The bank's filters as they travel in the URL. Both banks, the pager and
 * the filter bar read the same query keys from here.
 */
import { normalizeCategory, tierBySlug } from "@/lib/tiers";
import { specialPackId } from "@/lib/packs";
import type { BankFilters, BankSort, BankStatus } from "@/lib/queries";

export type Search = Record<string, string | string[] | undefined>;

/** A repeated key is a hand edited URL, so the first one wins. */
export const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

/** Every value of a key that can repeat. */
export const many = (v: string | string[] | undefined): string[] =>
  Array.isArray(v) ? v : v ? [v] : [];

/** The filters that take several values, in the order the bar reads. */
export const FACET_KEYS = ["pack", "category", "mod", "length", "speed"] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

/** Every filter that belongs in a paging link, in the order the bar reads. */
export const FILTER_KEYS = ["q", ...FACET_KEYS, "status", "stale", "sort"] as const;

/** One filter's values: the ones shown only, and the ones hidden. */
export type Picked = { only: string[]; not: string[] };

export const NOTHING_PICKED: Picked = { only: [], not: [] };

/** A value led by a minus is hidden. A value both shown and hidden is hidden. */
export function pickedFrom(
  values: readonly string[],
  fold: (v: string) => string = (v) => v,
): Picked {
  const only = new Set<string>();
  const not = new Set<string>();
  for (const raw of values) {
    const hide = raw.startsWith("-");
    const v = fold((hide ? raw.slice(1) : raw).trim());
    if (v) (hide ? not : only).add(v);
  }
  return { only: [...only].filter((v) => !not.has(v)), not: [...not] };
}

/** Each filter's picks. `get` returns every value of a key. */
export function bankPicksFrom(get: (key: string) => string[]): Record<FacetKey, Picked> {
  return {
    pack: pickedFrom(get("pack")),
    category: pickedFrom(get("category"), normalizeCategory),
    mod: pickedFrom(get("mod")),
    length: pickedFrom(get("length")),
    speed: pickedFrom(get("speed")),
  };
}

/** Writes one filter's picks into a query, hidden values led by a minus. */
export function setPicked(query: URLSearchParams, key: FacetKey, picked: Picked) {
  query.delete(key);
  for (const v of picked.only) query.append(key, v);
  for (const v of picked.not) query.append(key, "-" + v);
}

/**
 * Turns the query string into filters. `staff` gates the filters that can
 * reach entries taken off the ladder, and special packs' maps.
 */
export function bankFiltersFrom(sp: Search, staff = false): BankFilters {
  const picks = bankPicksFrom((k) => many(sp[k]));
  const status = one(sp.status);
  const ladder = (keys: string[]) => keys.flatMap((k) => tierBySlug(k)?.order ?? []);
  const special = (keys: string[]) => keys.flatMap((k) => specialPackId(k) ?? []);

  return {
    q: one(sp.q) || undefined,
    packs: { only: ladder(picks.pack.only), not: ladder(picks.pack.not) },
    specialPacks: staff
      ? { only: special(picks.pack.only), not: special(picks.pack.not) }
      : undefined,
    everyPack: staff,
    category: picks.category,
    mod: picks.mod,
    length: picks.length,
    speed: picks.speed,
    status: staff ? asStatus(status) : "listed",
    staleLabels: staff && one(sp.stale) === "labels",
    sort: asSort(one(sp.sort)),
  };
}

/** Anything unrecognised reads as the default rather than as an error. */
function asStatus(v: string): BankStatus {
  return v === "removed" || v === "all" ? v : "listed";
}

function asSort(v: string): BankSort {
  return v === "newest" || v === "oldest" ? v : "pack";
}

/** The filters serialised for a paging link. The page is the pager's own. */
export function bankQueryFrom(sp: Search): string {
  const query = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const values = (FACET_KEYS as readonly string[]).includes(k) ? many(sp[k]) : [one(sp[k])];
    for (const v of values) if (v) query.append(k, v);
  }
  return query.toString();
}

/** The page asked for, before it is clamped against the real page count. */
export function bankPageFrom(sp: Search): number {
  return Number(one(sp.page)) || 1;
}
