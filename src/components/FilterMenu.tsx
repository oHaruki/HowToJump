"use client";

import {
  useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode,
} from "react";
import { NOTHING_PICKED, type Picked } from "@/lib/bank-params";

/** One value a filter offers. */
export type MenuOption = {
  value: string;
  label: string;
  /** Drawn before the label, such as a pack's gem or a mod's icons. */
  lead?: ReactNode;
  /** A dim note after the label, such as a bucket's range. */
  hint?: string;
  /** Entries carrying it. */
  n?: number;
};

/**
 * A pill that opens a panel under it. The panel closes on a click outside
 * or on Escape, and lines up with the pill's other edge when it would run
 * off the screen.
 */
function Menu({
  label,
  pill,
  active,
  align = "start",
  className,
  children,
}: {
  /** Names the panel for screen readers. */
  label: string;
  pill: ReactNode;
  active?: boolean;
  align?: "start" | "end";
  className?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [flip, setFlip] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setFlip(false);
      return;
    }
    const r = pop.current?.getBoundingClientRect();
    if (r && (r.right > document.documentElement.clientWidth - 8 || r.left < 8)) setFlip(true);
  }, [open]);

  const side = flip ? (align === "start" ? "end" : "start") : align;

  return (
    <div className={"fmenu" + (className ? " " + className : "")} ref={wrap}>
      <button
        ref={button}
        type="button"
        className="fpill"
        data-active={active || undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {pill}
        <span className="caret" aria-hidden="true" />
      </button>

      {open ? (
        <div ref={pop} className="fmenu-pop" data-align={side} role="dialog" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A filter that takes several values. Ticking a value shows only the ticked
 * ones; the minus beside it hides that value instead.
 */
export function FacetMenu({
  label,
  value,
  onChange,
  groups,
  columns,
}: {
  label: string;
  value: Picked;
  onChange: (next: Picked) => void;
  /** The options, in titled groups where a list has parts. */
  groups: Array<{ label?: string; options: MenuOption[] }>;
  /** Columns a long list runs down. */
  columns?: number;
}) {
  const stateOf = (v: string) =>
    value.only.includes(v) ? "only" : value.not.includes(v) ? "not" : undefined;

  const toggle = (v: string, side: "only" | "not") => {
    const only = value.only.filter((x) => x !== v);
    const not = value.not.filter((x) => x !== v);
    if (stateOf(v) !== side) (side === "only" ? only : not).push(v);
    onChange({ only, not });
  };

  const picked = value.only.length + value.not.length > 0;

  return (
    <Menu
      label={label}
      active={picked}
      pill={
        <>
          <span>{label}</span>
          {value.only.length ? <span className="fpill-n">{value.only.length}</span> : null}
          {value.not.length ? (
            <span className="fpill-n" data-not>
              &minus;{value.not.length}
            </span>
          ) : null}
        </>
      }
    >
      {() => (
        <>
          <div className="fmenu-head">
            <span className="lbl">{label}</span>
            {picked ? (
              <button type="button" className="fmenu-reset" onClick={() => onChange(NOTHING_PICKED)}>
                Clear
              </button>
            ) : null}
          </div>

          {groups.map((g, i) => (
            <div key={g.label ?? i} className="fmenu-group">
              {g.label ? <span className="lbl fmenu-sub">{g.label}</span> : null}
              <div
                className="fopts"
                data-columns={columns}
                style={
                  columns
                    ? ({ "--rows": Math.ceil(g.options.length / columns) } as CSSProperties)
                    : undefined
                }
              >
                {g.options.map((o) => {
                  const state = stateOf(o.value);
                  return (
                    <div
                      key={o.value}
                      className="fopt"
                      data-state={state}
                      data-empty={o.n === 0 || undefined}
                    >
                      <button
                        type="button"
                        className="fopt-main"
                        aria-pressed={state === "only"}
                        onClick={() => toggle(o.value, "only")}
                      >
                        <span className="fopt-box" aria-hidden="true" />
                        {o.lead}
                        <span className="fopt-name">{o.label}</span>
                        {o.hint ? <span className="fopt-hint">{o.hint}</span> : null}
                        {o.n != null ? <span className="fopt-n">{o.n}</span> : null}
                      </button>
                      <button
                        type="button"
                        className="fopt-not"
                        aria-pressed={state === "not"}
                        aria-label={"Hide " + o.label}
                        title={"Hide " + o.label}
                        onClick={() => toggle(o.value, "not")}
                      >
                        <HideIcon />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <p className="fmenu-foot">
            <span className="fopt-box" data-demo="only" aria-hidden="true" /> shows only those
            <span className="fmenu-foot-gap" aria-hidden="true" />
            <HideIcon /> hides one
          </p>
        </>
      )}
    </Menu>
  );
}

/** A filter or an order with one value at a time. Picking closes it. */
export function ChoiceMenu({
  label,
  value,
  options,
  onChange,
  align,
  always,
  active,
  className,
}: {
  label: string;
  value: string;
  /** The first is what an empty value means. `n` is a count drawn beside it. */
  options: Array<{ value: string; label: string; n?: number }>;
  onChange: (v: string) => void;
  align?: "start" | "end";
  /** Shows the pick on the pill even when it is the first. */
  always?: boolean;
  active?: boolean;
  className?: string;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  const shown = always || current !== options[0];

  return (
    <Menu
      label={label}
      active={active}
      align={align}
      className={className}
      pill={
        <>
          <span className={shown ? "fpill-key" : undefined}>{label}</span>
          {shown ? <span className="fpill-val">{current.label}</span> : null}
        </>
      }
    >
      {(close) => (
        <div className="fchoices">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className="fchoice"
              aria-pressed={o === current}
              data-empty={o.n === 0 || undefined}
              onClick={() => {
                onChange(o.value);
                close();
              }}
            >
              {o.label}
              {o.n != null ? <span className="fopt-n">{o.n}</span> : null}
            </button>
          ))}
        </div>
      )}
    </Menu>
  );
}

function HideIcon() {
  return (
    <svg className="ficon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 12h8" strokeLinecap="round" />
    </svg>
  );
}
