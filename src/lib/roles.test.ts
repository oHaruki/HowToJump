/**
 * Run with: node --import tsx --test src/lib/roles.test.ts
 *
 * Roles: what each one lets someone do, and what a new one may be called.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILT_IN_ROLES, PERMISSIONS, can, canUseStaffArea, customRoleId, customRoleKey,
  isPermission, roleNameProblem,
} from "./roles";

const holding = (key: string) => {
  const role = BUILT_IN_ROLES.find((r) => r.key === key)!;
  return { role: role.key, permissions: role.permissions };
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
  const judge = { role: customRoleKey(3), permissions: ["queue.approve"] };
  assert.equal(can(judge, "queue.approve"), true);
  assert.equal(can(judge, "bank.edit"), false);
  assert.equal(canUseStaffArea(judge), true);
  // A role granting nothing is a title: on the team page, not in the staff area.
  assert.equal(canUseStaffArea({ role: customRoleKey(4), permissions: [] }), false);
  assert.equal(canUseStaffArea({ role: "user", permissions: [] }), false);
  assert.equal(can(null, "maps.add"), false);
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
