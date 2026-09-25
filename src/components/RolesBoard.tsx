"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRole, deleteRole, updateRole } from "@/lib/actions";
import { PERMISSIONS, customRoleId, type Permission } from "@/lib/roles";

export type BoardRole = {
  key: string;
  name: string;
  permissions: Permission[];
  builtIn: boolean;
  members: number;
};

const toggled = (list: Permission[], p: Permission) =>
  list.includes(p) ? list.filter((x) => x !== p) : [...list, p];

/**
 * Every role against every permission. The built in rows are fixed. A
 * custom role saves as its boxes are ticked, and is renamed or deleted
 * from its own row. New roles are made below the board.
 */
export function RolesBoard({ roles }: { roles: BoardRole[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPermissions, setNewPermissions] = useState<Permission[]>([]);

  const run = (fn: () => Promise<{ error?: string } | void>, after?: () => void) => {
    setError(null);
    start(async () => {
      try {
        const r = await fn();
        if (r?.error) {
          setError(r.error);
          return;
        }
        after?.();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <>
      {error ? (
        <div className="notice bad">
          <span className="chip bad" style={{ flex: "none" }}>Error</span>
          <div>{error}</div>
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="roles-board">
          <thead>
            <tr>
              <th>Role</th>
              {PERMISSIONS.map((p) => (
                <th key={p.key} className="c" title={p.hint}>
                  {p.name}
                </th>
              ))}
              <th className="c">Members</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => {
              const id = customRoleId(r.key);
              return (
                <tr key={r.key}>
                  <td>
                    {renaming === r.key && id != null ? (
                      <form
                        className="row-tight roles-rename"
                        onSubmit={(e) => {
                          e.preventDefault();
                          run(() => updateRole(id, { name: draftName }), () => setRenaming(null));
                        }}
                      >
                        <input
                          type="text"
                          value={draftName}
                          maxLength={24}
                          aria-label="Role name"
                          autoFocus
                          onChange={(e) => setDraftName(e.target.value)}
                        />
                        <button className="btn btn-sm btn-primary" type="submit" disabled={pending}>
                          Save
                        </button>
                        <button
                          className="btn btn-sm"
                          type="button"
                          disabled={pending}
                          onClick={() => setRenaming(null)}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <span className="roles-name">
                        <b>{r.name}</b>
                        {r.builtIn ? <span className="chip">Built in</span> : null}
                      </span>
                    )}
                  </td>
                  {PERMISSIONS.map((p) => (
                    <td key={p.key} className="c">
                      <input
                        type="checkbox"
                        checked={r.permissions.includes(p.key)}
                        disabled={id == null || pending}
                        aria-label={r.name + ": " + p.name}
                        onChange={() => {
                          if (id != null) {
                            run(() => updateRole(id, { permissions: toggled(r.permissions, p.key) }));
                          }
                        }}
                      />
                    </td>
                  ))}
                  <td className="c num">{r.members}</td>
                  <td>
                    {id == null ? null : confirming === r.key ? (
                      <span className="row-tight roles-actions">
                        {r.members ? (
                          <span className="small">
                            {r.members === 1 ? "1 member becomes a player" : r.members + " members become players"}
                          </span>
                        ) : null}
                        <button
                          className="btn btn-sm btn-no"
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            setConfirming(null);
                            run(() => deleteRole(id));
                          }}
                        >
                          Confirm
                        </button>
                        <button className="btn btn-sm" type="button" onClick={() => setConfirming(null)}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <span className="row-tight roles-actions">
                        <button
                          className="btn btn-sm"
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            setConfirming(null);
                            setDraftName(r.name);
                            setRenaming(r.key);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          className="btn btn-sm btn-no"
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            setRenaming(null);
                            setConfirming(r.key);
                          }}
                        >
                          Delete
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form
        className="box stack"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => createRole(newName, newPermissions),
            () => {
              setNewName("");
              setNewPermissions([]);
            },
          );
        }}
      >
        <span className="lbl">New role</span>
        <label className="field roles-new-name">
          <span className="lbl">Name</span>
          <input
            type="text"
            value={newName}
            maxLength={24}
            placeholder="Judge"
            onChange={(e) => setNewName(e.target.value)}
          />
        </label>
        <div className="roles-perms">
          {PERMISSIONS.map((p) => (
            <label key={p.key} className="roles-perm">
              <input
                type="checkbox"
                checked={newPermissions.includes(p.key)}
                onChange={() => setNewPermissions(toggled(newPermissions, p.key))}
              />
              <span>
                <b>{p.name}</b>
                <span className="small">{p.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={pending || !newName.trim()}>
            {pending ? "Saving" : "Create role"}
          </button>
          <span className="small">
            A role without any permissions is a title: its members show on the Team page
            but don&apos;t get the staff area.
          </span>
        </div>
      </form>
    </>
  );
}
