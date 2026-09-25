/**
 * Run with: node --import tsx --test src/lib/roles.test.ts
 *
 * Roles: what each one lets someone do, and what a new one may be called.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILT_IN_ROLES, PERMISSIONS, can, canUseStaffArea, customRoleId, customRoleKey, isAdmin,
  isPermission, orderRoles, roleNameProblem, type RoleView,
} from "./roles";

const holding = (key: string) => {
  const role = BUILT_IN_ROLES.find((r) => r.key === key)!;
  return { roles: [role.key], permissions: role.permissions };
};
const admin = holding("admin");
const helper = holding("helper");

test("admins may do everything, helpers what they always could", () => {
  for (const p of PERMISSIONS) assert.ok(can(admin, p.key), p.key);
  assert.deepEqual([...helper.permissions].sort(), ["bank.edit", "maps.add", "queue.review"]);
  assert.equal(can(helper, "queue.approve"), false);
  assert.equal(can(helper, "scores.delete"), false);
});

test("a custom role may do exactly what it grants", () => {
  const judge = { roles: [customRoleKey(3)], permissions: ["queue.approve"] };
  assert.equal(can(judge, "queue.approve"), true);
  assert.equal(can(judge, "bank.edit"), false);
  assert.equal(canUseStaffArea(judge), true);
  // A role granting nothing is a title: on the team page, not in the staff area.
  assert.equal(canUseStaffArea({ roles: [customRoleKey(4)], permissions: [] }), false);
  assert.equal(canUseStaffArea({ roles: [], permissions: [] }), false);
  assert.equal(can(null, "maps.add"), false);
});

test("an admin who holds another role is still an admin", () => {
  const both = { roles: [customRoleKey(4), "admin"], permissions: [] };
  assert.equal(isAdmin(both), true);
  assert.equal(can(both, "scores.delete"), true);
  assert.equal(isAdmin({ roles: ["helper", customRoleKey(4)] }), false);
});

test("roles rank Admin first, then as ordered, then the rest as they came", () => {
  const custom = (id: number): RoleView => ({
    key: customRoleKey(id), name: "Role " + id, permissions: [], builtIn: false,
  });
  const all = [...BUILT_IN_ROLES, custom(1), custom(2), custom(3)];
  const keys = (order: string[]) => orderRoles(all, order).map((r) => r.key);
  assert.deepEqual(keys([]), ["admin", "helper", "custom:1", "custom:2", "custom:3"]);
  assert.deepEqual(keys(["custom:2", "helper"]), ["admin", "custom:2", "helper", "custom:1", "custom:3"]);
  // Admin stays on top whatever the stored order says.
  assert.deepEqual(keys(["custom:3", "admin"])[0], "admin");
});

test("a custom role's key names it, and nothing else does", () => {
  assert.equal(customRoleId(customRoleKey(12)), 12);
  for (const key of ["admin", "helper", "user", "custom:", "custom:x", "xcustom:1"]) {
    assert.equal(customRoleId(key), null, key);
  }
  assert.ok(isPermission("scores.delete"));
  assert.equal(isPermission("staff.manage"), false);
});

test("a role name must be new, short, and not a built in one", () => {
  assert.equal(roleNameProblem("Judge", ["Mapper"]), null);
  assert.ok(roleNameProblem("", []));
  assert.ok(roleNameProblem("x".repeat(25), []));
  for (const name of ["admin", "Helper", "PLAYER", "user"]) assert.ok(roleNameProblem(name, []), name);
  assert.ok(roleNameProblem("judge", ["Judge"]));
});
