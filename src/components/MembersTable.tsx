"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUserRole } from "@/lib/actions";
import { NONE } from "@/components/ui";

export type MemberRow = {
  id: number;
  username: string;
  avatarUrl: string | null;
  osuUserId: number;
  role: string;
  globalRank: number | null;
  lastSyncedAt: string | null;
};

const ROLES = ["user", "helper", "admin"] as const;

export function MembersTable({ rows }: { rows: MemberRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {error ? (
        <div className="notice bad">
          <span className="chip bad" style={{ flex: "none" }}>Error</span>
          <div>{error}</div>
        </div>
      ) : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>osu! rank</th>
              <th>Last sync</th>
              <th>Role</th>
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
                  {u.globalRank ? "#" + u.globalRank.toLocaleString() : NONE}
                </td>
                <td className="small">
                  {u.lastSyncedAt
                    ? new Date(u.lastSyncedAt).toLocaleString()
                    : "never"}
                </td>
                <td>
                  <select
                    className="mini"
                    defaultValue={u.role}
                    disabled={pending}
                    onChange={(e) => {
                      const role = e.target.value as (typeof ROLES)[number];
                      setError(null);
                      start(async () => {
                        try {
                          await setUserRole(u.id, role);
                          router.refresh();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : String(err));
                        }
                      });
                    }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
