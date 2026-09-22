"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback, useEffect, useRef, useState, useTransition, type ReactNode,
} from "react";
import { PackPicker } from "@/components/PackPicker";
import { tierBySlug, tierFill } from "@/lib/tiers";

type Current = {
  q: string;
  pack: string;
  category: string;
  mod: string;
  length: string;
  speed: string;
  /** Staff only, empty on the public bank. */
  status?: string;
  stale?: string;
};

/** The order the chips read in, and the wording each filter gets. */
const FIELDS: Array<{ key: keyof Current; label: string }> = [
  { key: "q", label: "Search" },
  { key: "pack", label: "Pack" },
  { key: "category", label: "Category" },
  { key: "mod", label: "Mod" },
  { key: "length", label: "Length" },
  { key: "speed", label: "Speed" },
  { key: "status", label: "Status" },
  { key: "stale", label: "Flagged" },
];

/* The staff filters are the only ones whose URL value is a key rather than
   the words to show, so a chip reads "Removed only" and not "removed". */
const VALUE_LABELS: Record<string, string> = {
  removed: "Removed only",
  all: "All entries",
  labels: "Stale label",
};

/* Search is the only field that flexes. Each dropdown is sized to its own
   widest option and wraps rather than shrinking. */

/**
 * Filters live in the URL, so a filtered bank can be linked and the server
 * does the filtering. The bar sticks below the nav, and what is applied
 * reads back as a row of chips underneath, each removable on its own.
 */
export function BankFilters({
  basePath = "/maps",
  packCounts,
  categories,
  mods,
  lengths,
  speeds,
  current,
  count,
  staff,
}: {
  /** Which bank this bar filters. The staff one lives at its own route. */
  basePath?: string;
  packCounts: Record<string, number>;
  categories: string[];
  mods: string[];
  lengths: string[];
  speeds: string[];
  current: Current;
  /** How many entries the filters match. A node, so it can arrive suspended. */
  count?: ReactNode;
  /** Adds the two filters only staff have any use for. */
  staff?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      // A narrower list has different pages, so a filter change starts over.
      next.delete("page");
      startTransition(() => {
        router.replace(
          next.toString() ? basePath + "?" + next.toString() : basePath,
        );
      });
    },
    [params, router, basePath],
  );

  /* Controlled, so removing its chip or pressing Clear empties the box. */
  const [draft, setDraft] = useState(current.q);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => setDraft(current.q), [current.q]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const search = (v: string) => {
    setDraft(v);
    // Let typing settle before hitting the server.
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setParam("q", v), 300);
  };

  const applied = FIELDS.filter((f) => current[f.key]);

  return (
    <div className="bankbar box box-tight box-open">
      <div className="row" style={{ alignItems: "flex-end", opacity: pending ? 0.6 : 1 }}>
        <label className="field" style={{ flex: "3 1 200px" }}>
          <span className="lbl">Search</span>
          <input
            type="search"
            name="q"
            value={draft}
            placeholder="Title, difficulty or mapper"
            onChange={(e) => search(e.target.value)}
          />
        </label>

        <label className="field" style={{ flex: "0 0 176px" }}>
          <span className="lbl">Pack</span>
          <PackPicker
            value={current.pack}
            counts={packCounts}
            onChange={(v) => setParam("pack", v)}
          />
        </label>

        <Select label="Category" value={current.category} placeholder="All categories"
          options={categories.map((c) => ({ value: c, label: c }))}
          onChange={(v) => setParam("category", v)} flex="0 0 172px" />

        <Select label="Mod" value={current.mod} placeholder="Any mod"
          options={mods.map((m) => ({ value: m, label: m }))}
          onChange={(v) => setParam("mod", v)} flex="0 0 128px" />

        <Select label="Length" value={current.length} placeholder="Any length"
          options={lengths.map((l) => ({ value: l, label: l }))}
          onChange={(v) => setParam("length", v)} flex="0 0 140px" />

        <Select label="Speed" value={current.speed} placeholder="Any speed"
          options={speeds.map((s) => ({ value: s, label: s }))}
          onChange={(v) => setParam("speed", v)} flex="0 0 140px" />

        {staff ? (
          <>
            <Select label="Status" value={current.status ?? ""} placeholder="Listed"
              options={[
                { value: "removed", label: "Removed only" },
                { value: "all", label: "All entries" },
              ]}
              onChange={(v) => setParam("status", v)} flex="0 0 160px" />

            <Select label="Flagged" value={current.stale ?? ""} placeholder="Anything"
              options={[{ value: "labels", label: "Stale label" }]}
              onChange={(v) => setParam("stale", v)} flex="0 0 148px" />
          </>
        ) : null}
      </div>

      <div className="bankbar-state">
        <span className="small">{count}</span>

        {applied.length ? (
          <div className="fchips">
            {applied.map((f) => (
              <FilterChip
                key={f.key}
                label={f.label}
                value={chipValue(f.key, current)}
                fill={f.key === "pack" ? tierFill(tierBySlug(current.pack)) : undefined}
                onRemove={() => setParam(f.key, "")}
              />
            ))}
            <button
              className="fchip-clear"
              type="button"
              onClick={() => startTransition(() => router.replace(basePath))}
            >
              Clear all
            </button>
          </div>
        ) : (
          <span className="small">No filters applied</span>
        )}
      </div>
    </div>
  );
}

/** What a chip shows: a pack name, a spelled out staff value, or the word itself. */
function chipValue(key: keyof Current, current: Current): string {
  if (key === "pack") return tierBySlug(current.pack)?.name ?? current.pack;
  const v = current[key] ?? "";
  return VALUE_LABELS[v] ?? v;
}

/** One applied filter. The whole chip removes it, so there is no small target. */
function FilterChip({
  label,
  value,
  fill,
  onRemove,
}: {
  label: string;
  value: string;
  fill?: string;
  onRemove: () => void;
}) {
  return (
    <button
      className="fchip"
      type="button"
      aria-label={"Remove the " + label.toLowerCase() + " filter"}
      onClick={onRemove}
    >
      {fill ? <span className="dot" style={{ background: fill }} /> : null}
      <i>{label}</i>
      <b>{value}</b>
      <span className="fchip-x" aria-hidden="true">
        &times;
      </span>
    </button>
  );
}

function Select({
  label, value, placeholder, options, onChange, flex,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  flex: string;
}) {
  return (
    <label className="field" style={{ flex }}>
      <span className="lbl">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
