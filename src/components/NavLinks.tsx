"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavLink = { href: string; label: string };

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

/**
 * The section links: in the bar on wide screens, and behind a menu button
 * that opens a panel under the bar on narrow ones.
 */
export function NavLinks({ links }: { links: NavLink[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <nav className="nav-links" aria-label="Sections">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="nav-btn" data-active={String(isActive(path, l.href))}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="nav-burger" ref={wrap}>
        <button
          className="tool burger-btn"
          type="button"
          aria-expanded={open}
          aria-controls="nav-panel"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="burger-lines" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
        {open ? (
          <nav className="nav-panel" id="nav-panel" aria-label="Sections">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="nav-panel-link"
                data-active={String(isActive(path, l.href))}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </>
  );
}
