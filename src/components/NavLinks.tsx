"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: Array<{ href: string; label: string }> }) {
  const path = usePathname();
  return (
    <nav className="nav-links" aria-label="Sections">
      {links.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className="nav-btn" data-active={String(active)}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
