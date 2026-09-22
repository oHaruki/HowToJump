"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const ROLE_LABEL: Record<string, string> = {
  user: "Player",
  helper: "Helper",
  admin: "Admin",
};

export type MenuUser = {
  name: string;
  image: string | null;
  role: string;
  osuUserId: number;
};

/**
 * The avatar opens a menu; signing out is a choice inside it. Sign out is a
 * form posting to a server action, so
 * it still works without JavaScript.
 */
export function UserMenu({
  user,
  isStaff,
  signOutAction,
}: {
  user: MenuUser;
  isStaff: boolean;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="menu-wrap" ref={wrap}>
      <button
        className="tool userbtn"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="av" src={user.image} alt="" />
        ) : null}
        <span>{user.name}</span>
      </button>

      {open ? (
        <div className="menu" role="menu">
          <div className="menu-head">
            <span style={{ color: "var(--text-focus)" }}>{user.name}</span>
            <span className="small">{ROLE_LABEL[user.role] ?? user.role}</span>
          </div>
          <hr className="sep" />

          <Link className="menu-item" href="/me" role="menuitem" onClick={() => setOpen(false)}>
            My progress
          </Link>
          {isStaff ? (
            <Link
              className="menu-item"
              href="/staff"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Staff area
            </Link>
          ) : null}
          <a
            className="menu-item"
            href={"https://osu.ppy.sh/users/" + user.osuUserId}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            osu! profile
          </a>

          <hr className="sep" />
          <form action={signOutAction}>
            <button className="menu-item danger" type="submit" role="menuitem">
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
