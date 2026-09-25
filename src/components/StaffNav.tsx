"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The staff area's sections, each shown only to those it lets do something. */
export function StaffNav({
  pending,
  show,
}: {
  pending: number;
  show: { add: boolean; queue: boolean; bank: boolean; admin: boolean };
}) {
  const path = usePathname();
  const items: Array<{ href: string; label: string; exact?: boolean; badge?: number }> = [
    { href: "/staff", label: "Dashboard", exact: true },
  ];
  if (show.add) items.push({ href: "/staff/add", label: "Add maps" });
  if (show.queue) items.push({ href: "/staff/queue", label: "Queue", badge: pending });
  if (show.bank) items.push({ href: "/staff/bank", label: "Map bank" });
  if (show.admin) {
    items.push({ href: "/staff/members", label: "Members" });
    items.push({ href: "/staff/roles", label: "Roles" });
  }

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
