"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BackfillForm } from "@/components/BackfillForm";

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
 * it still works without JavaScript. Adding an older score opens a dialog.
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
  const [adding, setAdding] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    if (!adding) return;
    dialog.current?.showModal();
    dialog.current?.querySelector("input")?.focus();
  }, [adding]);

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
        <span className="userbtn-name">{user.name}</span>
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
          <button
            className="menu-item"
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setAdding(true);
            }}
          >
            Add an older score
          </button>
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

      {/* Closes on a click that both starts and ends on the backdrop. */}
      <dialog
        ref={dialog}
        className="dialog"
        aria-labelledby="backfill-title"
        onClose={() => setAdding(false)}
        onMouseDown={(e) => {
          pressedBackdrop.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (pressedBackdrop.current && e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        {adding ? (
          <div className="dialog-in">
            <div className="dialog-head">
              <h2 id="backfill-title">Add an older score</h2>
              <button
                className="tool"
                type="button"
                aria-label="Close"
                onClick={() => dialog.current?.close()}
              >
                ✕
              </button>
            </div>
            <p className="small">
              Plays are picked up from when you connect. For one from before that, or one the
              site missed, paste the score&apos;s osu! link. It has to be your own pass on a bank
              map, with the mods the map is banked under.
            </p>
            <BackfillForm />
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
