"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { PackPicker } from "@/components/PackPicker";

type Current = {
  q: string;
  pack: string;
  category: string;
  mod: string;
  length: string;
  speed: string;
};

/**
 * Filters live in the URL so a filtered bank can be linked and shared, and so
 * the server does the filtering rather than shipping the whole bank down.
 */
export function BankFilters({
  packCounts,
  categories,
  mods,
  lengths,
  speeds,
  current,
}: {
  packCounts: Record<string, number>;
  categories: string[];
  mods: string[];
  lengths: string[];
  speeds: string[];
  current: Current;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      startTransition(() => {
        router.replace(next.toString() ? "/maps?" + next.toString() : "/maps");
      });
    },
    [params, router],
  );

  return (
    <div className="box box-tight">
      <div className="row" style={{ alignItems: "flex-end", opacity: pending ? 0.6 : 1 }}>
        <label className="field" style={{ flex: "3 1 240px" }}>
          <span className="lbl">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={current.q}
            placeholder="Title, difficulty or mapper"
            onChange={(e) => {
              const v = e.target.value;
              // Let typing settle before hitting the server.
              window.clearTimeout((window as never as { __htjT?: number }).__htjT);
              (window as never as { __htjT?: number }).__htjT = window.setTimeout(
                () => setParam("q", v),
                300,
              );
            }}
          />
        </label>

        <label className="field" style={{ flex: "1 1 190px" }}>
          <span className="lbl">Pack</span>
          <PackPicker
            value={current.pack}
            counts={packCounts}
            onChange={(v) => setParam("pack", v)}
          />
        </label>

        <Select label="Category" value={current.category} placeholder="All categories"
          options={categories.map((c) => ({ value: c, label: c }))}
          onChange={(v) => setParam("category", v)} flex="1 1 160px" />

        <Select label="Mod" value={current.mod} placeholder="Any mod"
          options={mods.map((m) => ({ value: m, label: m }))}
          onChange={(v) => setParam("mod", v)} flex="1 1 110px" />

        <Select label="Length" value={current.length} placeholder="Any length"
          options={lengths.map((l) => ({ value: l, label: l }))}
          onChange={(v) => setParam("length", v)} flex="1 1 120px" />

        <Select label="Speed" value={current.speed} placeholder="Any speed"
          options={speeds.map((s) => ({ value: s, label: s }))}
          onChange={(v) => setParam("speed", v)} flex="1 1 120px" />

        <button
          className="btn btn-sm"
          type="button"
          onClick={() => startTransition(() => router.replace("/maps"))}
        >
          Clear
        </button>
      </div>
    </div>
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
