"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addStaffMember, setUserRole } from "@/lib/actions";
import { NONE } from "@/components/ui";

export type MemberRow = {
  id: number;
  username: string;
  avatarUrl: string | null;
  osuUserId: number;
  role: string;
  globalRank: number | null;
  /** Already in words, so the server and the browser show the same thing. */
  lastSynced: string;
};

/**
 * Only staff are listed. Every player who ever signs in gets a row in the
 * users table, so listing all of them would grow without bound and bury the
 * handful of people this page is actually about.
 */
export function MembersTable({
  roles,
  rows,
  playerCount,
}: {
  /** Every staff role, built in first, as the selects offer them. */
  roles: Array<{ key: string; name: string }>;
  rows: MemberRow[];
  playerCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [newRole, setNewRole] = useState("helper");
  const roleName = (key: string) => roles.find((r) => r.key === key)?.name ?? key;

  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    setNotice(null);
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const add = () =>
    run(async () => {
      const res = await addStaffMember(identifier, newRole);
      setIdentifier("");
      setNotice(
        res.created
          ? res.username + " added as " + roleName(newRole) + ", before their first sign in"
          : res.username + " is now " + roleName(newRole),
      );
    });

  return (
    <>
      {error ? (
        <div className="notice bad">
          <span className="chip bad" style={{ flex: "none" }}>Error</span>
          <div>{error}</div>
        </div>
      ) : null}
      {notice ? (
        <div className="notice">
          <span className="chip ok" style={{ flex: "none" }}>Done</span>
          <div>{notice}</div>
        </div>
      ) : null}

      <div className="box stack">
        <span className="lbl">Add staff</span>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="field" style={{ flex: "3 1 280px" }}>
            <span className="lbl">osu! user ID or username</span>
            <input
              type="text"
              value={identifier}
              placeholder="3673149 or -Haruki"
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && identifier.trim() && !pending) add();
              }}
            />
          </label>
          <label className="field" style={{ flex: "1 1 140px" }}>
            <span className="lbl">Role</span>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-primary"
            type="button"
            disabled={pending || !identifier.trim()}
            onClick={add}
          >
            {pending ? "Looking up" : "Add"}
          </button>
        </div>
        <p className="small">
          Looked up against osu!, so the name and avatar are correct. They do not
          need to have signed in yet.
        </p>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Staff member</th>
              <th>osu! rank</th>
              <th>Last sync</th>
              <th>Role</th>
              <th style={{ textAlign: "right" }}>Remove</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="map-cell">
                    {u.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="av" src={u.avatarUrl} alt="" />
                    ) : null}
                    <a
                      className="t-title"
                      href={"https://osu.ppy.sh/users/" + u.osuUserId}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {u.username}
                    </a>
                  </div>
                </td>
                <td className="num">
                  {u.globalRank ? "#" + u.globalRank.toLocaleString("en") : NONE}
                </td>
                <td className="small">{u.lastSynced}</td>
                <td>
                  <select
                    className="mini"
                    defaultValue={u.role}
                    disabled={pending}
                    onChange={(e) => run(() => setUserRole(u.id, e.target.value))}
                  >
                    {roles.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn btn-sm btn-no"
                    type="button"
                    disabled={pending}
                    title="Drops them back to an ordinary player"
                    onClick={() => run(() => setUserRole(u.id, "user"))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="small">
                  No staff yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="small">
        {rows.length} staff {NONE} {playerCount.toLocaleString("en")} registered{" "}
        {playerCount === 1 ? "player" : "players"} in total
      </p>
    </>
  );
}
