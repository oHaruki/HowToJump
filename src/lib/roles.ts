/**
 * Who can do what. Admin and Helper are built in and never change; admins
 * make any other role, each granting some of the permissions below, and
 * someone holding several roles may do what any of them grants. Managing
 * staff and roles is not one of them: that stays with admins. Pure, so it
 * runs without the database.
 */

export const PERMISSIONS = [
  { key: "maps.add", name: "Add maps", hint: "Paste maps into the review queue." },
  { key: "queue.review", name: "Review the queue", hint: "Set a queued map's pack, or reject it." },
  { key: "queue.approve", name: "Approve maps", hint: "Move queued maps into the bank." },
  {
    key: "bank.edit",
    name: "Edit the bank",
    hint: "Change an entry's pack, categories or mod, or take it off the ladder.",
  },
  { key: "scores.delete", name: "Delete scores", hint: "Delete a score from a map's scoreboard." },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];

export type RoleView = {
  key: string;
  name: string;
  permissions: readonly Permission[];
  builtIn: boolean;
};

export const BUILT_IN_ROLES: RoleView[] = [
  { key: "admin", name: "Admin", permissions: PERMISSIONS.map((p) => p.key), builtIn: true },
  {
    key: "helper",
    name: "Helper",
    permissions: ["maps.add", "queue.review", "bank.edit"],
    builtIn: true,
  },
];

/** What someone holding no staff role is called. */
export const PLAYER: RoleView = { key: "user", name: "Player", permissions: [], builtIn: true };

const MAX_NAME = 24;

/** The key a user row holds for a custom role. */
export function customRoleKey(id: number): string {
  return "custom:" + id;
}

/** The custom role a key names, or null when it names a built in one. */
export function customRoleId(key: string): number | null {
  const m = /^custom:(\d+)$/.exec(key);
  return m ? Number(m[1]) : null;
}

export function isPermission(key: string): key is Permission {
  return PERMISSIONS.some((p) => p.key === key);
}

/** Someone signed in, as far as what they may do goes. */
type Holder = { roles: readonly string[]; permissions: readonly string[] } | null | undefined;

export function isAdmin(user: { roles: readonly string[] } | null | undefined): boolean {
  return !!user && user.roles.includes("admin");
}

/** Whether someone may do something. Admins may do everything. */
export function can(user: Holder, permission: Permission): boolean {
  return !!user && (isAdmin(user) || user.permissions.includes(permission));
}

/** Whether someone sees the staff area: an admin, or a role granting anything. */
export function canUseStaffArea(user: Holder): boolean {
  return !!user && (isAdmin(user) || user.permissions.length > 0);
}

/** The queue is for whoever fills it, sorts it or empties it. */
export function canSeeQueue(user: Holder): boolean {
  return can(user, "maps.add") || can(user, "queue.review") || can(user, "queue.approve");
}

/**
 * Roles from highest to lowest: Admin always first, then the keys in
 * `order`, then any role `order` doesn't name, in the order given.
 */
export function orderRoles(roles: readonly RoleView[], order: readonly string[]): RoleView[] {
  const rank = (r: RoleView) => {
    if (r.key === "admin") return -1;
    const i = order.indexOf(r.key);
    return i === -1 ? order.length + roles.indexOf(r) : i;
  };
  return roles.slice().sort((a, b) => rank(a) - rank(b));
}

/**
 * Why a new role name can't be used, or null when it can. `taken` holds
 * the other custom roles' names.
 */
export function roleNameProblem(name: string, taken: readonly string[]): string | null {
  if (!name) return "Give the role a name.";
  if (name.length > MAX_NAME) return "Keep the name to " + MAX_NAME + " characters.";
  const lower = name.toLowerCase();
  const reserved = [...BUILT_IN_ROLES, PLAYER].map((r) => r.name.toLowerCase()).concat("user");
  if (reserved.includes(lower)) return name + " is a built in role.";
  if (taken.some((t) => t.toLowerCase() === lower)) return "There is already a role called " + name + ".";
  return null;
}
