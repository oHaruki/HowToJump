"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode,
} from "react";
import { ChoiceMenu, FacetMenu, type MenuOption } from "@/components/FilterMenu";
import { ModIcons } from "@/components/ui";
import {
  FACET_KEYS, bankPicksFrom, setPicked, type FacetKey, type Picked,
} from "@/lib/bank-params";
import { modLabel } from "@/lib/mods";
import type { SpecialPack } from "@/lib/packs";
import type { Facets } from "@/lib/queries";
import {
  LENGTH_SCALE, SPEED_SCALE, TIERS, isCategory, tierBySlug, tierFill, type Bucket,
} from "@/lib/tiers";

const LABELS: Record<FacetKey, string> = {
  pack: "Pack",
  category: "Category",
  mod: "Mod",
  length: "Length",
  speed: "Speed",
};

/** An order, not a filter, so it gets no chip. */
const SORTS = [
  { value: "", label: "Pack order" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

const STATUSES = [
  { value: "", label: "Listed" },
  { value: "removed", label: "Removed only" },
  { value: "all", label: "All entries" },
];

const FLAGS = [
  { value: "", label: "Anything" },
  { value: "labels", label: "Stale label" },
];

const labelOf = (options: Array<{ value: string; label: string }>, v: string) =>
  options.find((o) => o.value === v)?.label ?? v;

/** A bucket's range, for the dim note beside it. */
const rangeOf = (scale: Bucket[], v: string, unit = "") => {
  const r = scale.find((b) => b.name === v)?.range;
  return r ? r + unit : undefined;
};

/** One applied value as its chip shows it. */
type Applied = { value: string; label: string; not?: boolean; fill?: string };

/**
 * Filters live in the URL, so a filtered bank can be linked and the server
 * does the filtering. Each filter is a pill opening its values, any of
 * which can be shown only or hidden. What is applied reads back as chips
 * underneath, each value removable on its own.
 */
export function BankFilters({
  basePath = "/maps",
  packCounts,
  special = [],
  facets,
  count,
  staff,
}: {
  /** Which bank this bar filters. The staff one lives at its own route. */
  basePath?: string;
  /** Maps per pack, keyed by slug, or by ID for a special pack. */
  packCounts: Record<string, number>;
  /** Special packs the pack filter offers. The staff bank lists their maps too. */
  special?: SpecialPack[];
  /** The values each filter offers, with their counts. */
  facets: Facets;
  /** How many entries the filters match. A node, so it can arrive suspended. */
  count?: ReactNode;
  /** Adds the two filters only staff have any use for. */
  staff?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  /* The query as last asked for, which can be ahead of the URL. */
  const [query, setQuery] = useOptimistic(params.toString());
  const latest = useRef(query);
  useEffect(() => {
    latest.current = query;
  }, [query]);

  const edit = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(latest.current);
    change(next);
    // A narrower list has different pages, so a filter change starts over.
    next.delete("page");
    const s = next.toString();
    latest.current = s;
    startTransition(() => {
      setQuery(s);
      router.replace(s ? basePath + "?" + s : basePath);
    });
  };
  const setOne = (key: string, v: string) => edit((n) => (v ? n.set(key, v) : n.delete(key)));
  const setFacet = (key: FacetKey, p: Picked) => edit((n) => setPicked(n, key, p));

  const sp = new URLSearchParams(query);
  const picks = bankPicksFrom((k) => sp.getAll(k));
  const q = sp.get("q") ?? "";
  const sort = sp.get("sort") ?? "";
  const status = staff ? (sp.get("status") ?? "") : "";
  const stale = staff ? (sp.get("stale") ?? "") : "";

  /* Controlled, so removing its chip or pressing Clear all empties the box. */
  const [draft, setDraft] = useState(q);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => setDraft(q), [q]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const search = (v: string) => {
    setDraft(v);
    // Let typing settle before hitting the server.
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOne("q", v.trim() ? v : ""), 300);
  };
  const clearSearch = () => {
    window.clearTimeout(timer.current);
    setDraft("");
    setOne("q", "");
  };
  const clearAll = () => {
    window.clearTimeout(timer.current);
    setDraft("");
    edit((n) => {
      for (const k of new Set(n.keys())) if (k !== "sort") n.delete(k);
    });
  };

  /* On a phone the filters fold away behind a button. */
  const [open, setOpen] = useState(false);

  const specialByKey = (key: string) => special.find((p) => String(p.id) === key);
  const gem = (fill: string) => <span className="fopt-gem" style={{ background: fill }} />;

  const packGroups: Array<{ label?: string; options: MenuOption[] }> = [
    {
      options: TIERS.map((t) => ({
        value: t.slug, label: t.name, lead: gem(tierFill(t)), n: packCounts[t.slug],
      })),
    },
  ];
  if (special.length) {
    packGroups.push({
      label: "Special packs",
      options: special.map((p) => ({
        value: String(p.id), label: p.name, lead: gem(p.color), n: packCounts[String(p.id)],
      })),
    });
  }

  const describe = (key: FacetKey, v: string): Omit<Applied, "value"> => {
    if (key !== "pack") return { label: v };
    const tier = tierBySlug(v);
    const pack = tier ? undefined : specialByKey(v);
    return { label: tier?.name ?? pack?.name ?? v, fill: tier ? tierFill(tier) : pack?.color };
  };

  const chips: Array<{ key: string; label: string; values: Applied[]; remove: (a: Applied) => void }> = [];
  if (q) {
    chips.push({
      key: "q", label: "Search", values: [{ value: q, label: "“" + q + "”" }],
      remove: clearSearch,
    });
  }
  for (const key of FACET_KEYS) {
    const p = picks[key];
    const values = [
      ...p.only.map((v) => ({ value: v, ...describe(key, v) })),
      ...p.not.map((v) => ({ value: v, not: true, ...describe(key, v) })),
    ];
    if (!values.length) continue;
    chips.push({
      key, label: LABELS[key], values,
      remove: (a) => setFacet(key, {
        only: p.only.filter((v) => v !== a.value),
        not: p.not.filter((v) => v !== a.value),
      }),
    });
  }
  if (status) {
    chips.push({
      key: "status", label: "Status", values: [{ value: status, label: labelOf(STATUSES, status) }],
      remove: () => setOne("status", ""),
    });
  }
  if (stale) {
    chips.push({
      key: "stale", label: "Flagged", values: [{ value: stale, label: labelOf(FLAGS, stale) }],
      remove: () => setOne("stale", ""),
    });
  }
  const narrowing = chips.reduce((n, c) => n + (c.key === "q" ? 0 : c.values.length), 0);

  return (
    <div className="bankbar box box-tight box-open" data-open={open || undefined}>
      <div className="bankbar-controls">
        <div className="fsearch">
          <SearchIcon />
          <input
            type="search"
            name="q"
            aria-label="Search the bank"
            value={draft}
            placeholder="Title, difficulty or mapper"
            onChange={(e) => search(e.target.value)}
          />
          {draft ? (
            <button type="button" className="fsearch-clear" aria-label="Clear the search" onClick={clearSearch}>
              &times;
            </button>
          ) : null}
        </div>

        <button
          type="button"
          className="btn bankbar-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <SlidersIcon />
          Filters
          {narrowing ? <span className="fpill-n">{narrowing}</span> : null}
        </button>

        <div className="bankbar-pills">
          <FacetMenu
            label="Pack"
            value={picks.pack}
            onChange={(p) => setFacet("pack", p)}
            groups={packGroups}
            columns={2}
          />
          <FacetMenu
            label="Category"
            value={picks.category}
            onChange={(p) => setFacet("category", p)}
            groups={[{
              options: facets.categories.map((o) => ({
                value: o.value, label: o.value, n: o.n,
                hint: isCategory(o.value) ? undefined : "no longer judged",
              })),
            }]}
          />
          <FacetMenu
            label="Mod"
            value={picks.mod}
            onChange={(p) => setFacet("mod", p)}
            groups={[{
              options: facets.mods.map((o) => ({
                value: o.value, label: modLabel(o.value), lead: <ModIcons mod={o.value} />, n: o.n,
              })),
            }]}
          />
          <FacetMenu
            label="Length"
            value={picks.length}
            onChange={(p) => setFacet("length", p)}
            groups={[{
              options: facets.lengths.map((o) => ({
                value: o.value, label: o.value, hint: rangeOf(LENGTH_SCALE, o.value), n: o.n,
              })),
            }]}
          />
          <FacetMenu
            label="Speed"
            value={picks.speed}
            onChange={(p) => setFacet("speed", p)}
            groups={[{
              options: facets.speeds.map((o) => ({
                value: o.value, label: o.value, hint: rangeOf(SPEED_SCALE, o.value, " BPM"), n: o.n,
              })),
            }]}
          />
          {staff ? (
            <>
              <ChoiceMenu
                label="Status"
                value={status}
                options={STATUSES}
                active={Boolean(status)}
                onChange={(v) => setOne("status", v)}
              />
              <ChoiceMenu
                label="Flagged"
                value={stale}
                options={FLAGS}
                active={Boolean(stale)}
                onChange={(v) => setOne("stale", v)}
              />
            </>
          ) : null}
        </div>
      </div>

      <div className="bankbar-state" data-pending={pending || undefined}>
        <span className="bankbar-count">{count}</span>

        {chips.length ? (
          <div className="fchips">
            {chips.map((c) => (
              <span key={c.key} className="fchip">
                <i>{c.label}</i>
                {c.values.map((a) => (
                  <button
                    key={(a.not ? "-" : "") + a.value}
                    type="button"
                    className="fchip-v"
                    data-not={a.not || undefined}
                    aria-label={(a.not ? "Stop hiding " : "Remove ") + a.label}
                    onClick={() => c.remove(a)}
                  >
                    {a.fill ? <span className="dot" style={{ background: a.fill }} /> : null}
                    {a.not ? <em>not</em> : null}
                    <b>{a.label}</b>
                    <span className="fchip-x" aria-hidden="true">&times;</span>
                  </button>
                ))}
              </span>
            ))}
            <button className="fchip-clear" type="button" onClick={clearAll}>
              Clear all
            </button>
          </div>
        ) : (
          <span className="small bankbar-none">No filters applied</span>
        )}

        <ChoiceMenu
          className="bankbar-sort"
          label="Sort"
          value={sort}
          options={SORTS}
          align="end"
          always
          onChange={(v) => setOne("sort", v)}
        />
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg className="ficon fsearch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" strokeLinecap="round" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg className="ficon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}
