"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function StaffNav({ pending, isAdmin }: { pending: number; isAdmin: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/staff", label: "Dashboard", exact: true },
    { href: "/staff/add", label: "Add maps" },
    { href: "/staff/queue", label: "Queue", badge: pending },
    { href: "/staff/bank", label: "Map bank" },
  ];
  if (isAdmin) items.push({ href: "/staff/members", label: "Members" });

  return (
    <aside className="side">
      <div className="side-head">
        <span className="lbl">Staff area</span>
      </div>
      {items.map((i) => {
        const active = i.exact ? path === i.href : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className="side-btn" data-active={String(active)}>
            <span>{i.label}</span>
            {i.badge ? <span className="chip">{i.badge}</span> : null}
          </Link>
        );
      })}
    </aside>
  );
}
