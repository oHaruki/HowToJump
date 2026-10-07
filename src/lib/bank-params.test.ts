/**
 * Run with: node --import tsx --test src/lib/bank-params.test.ts
 *
 * The bank's filters in the URL: values shown only, values hidden behind a
 * minus, and links from before a filter took more than one value.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { bankFiltersFrom, bankQueryFrom, pickedFrom, setPicked } from "./bank-params";
import { categoryKeys } from "./tiers";

test("a minus hides a value, and anything else shows only it", () => {
  assert.deepEqual(pickedFrom(["DT", "-NM", "HR"]), { only: ["DT", "HR"], not: ["NM"] });
});

test("a value both shown and hidden is hidden", () => {
  assert.deepEqual(pickedFrom(["DT", "-DT"]), { only: [], not: ["DT"] });
});

test("repeats and blanks drop out", () => {
  assert.deepEqual(pickedFrom(["DT", "DT", "", "-", " "]), { only: ["DT"], not: [] });
});

test("a category keeps the minus apart from the hyphen in its name", () => {
  const f = bankFiltersFrom({ category: ["-Aim - raw mechanic", "Precision"] });
  assert.deepEqual(f.category, { only: ["Precision"], not: ["Aim - raw mechanic"] });
});

test("an old category spelling reads as its current name", () => {
  assert.deepEqual(bankFiltersFrom({ category: "-Raw Aim" }).category?.not, ["Aim - raw mechanic"]);
  assert.ok(categoryKeys("Aim - raw mechanic").includes("rawaim"));
});

test("a link from before still filters to one pack", () => {
  const f = bankFiltersFrom({ pack: "goat" });
  assert.deepEqual(f.packs, { only: [16], not: [] });
  assert.equal(f.specialPacks, undefined);
});

test("special packs only reach the staff bank", () => {
  assert.deepEqual(bankFiltersFrom({ pack: ["ruby", "-3"] }).packs, { only: [11], not: [] });
  const staff = bankFiltersFrom({ pack: ["ruby", "-3"] }, true);
  assert.deepEqual(staff.packs, { only: [11], not: [] });
  assert.deepEqual(staff.specialPacks, { only: [], not: [3] });
});

test("paging links keep every value of a filter, and one of anything else", () => {
  const q = bankQueryFrom({ mod: ["DT", "-NM"], sort: ["newest", "oldest"], page: "3" });
  assert.equal(q, "mod=DT&mod=-NM&sort=newest");
});

test("writing picks back puts the hidden ones behind a minus", () => {
  const query = new URLSearchParams("mod=HR&sort=newest");
  setPicked(query, "mod", { only: ["DT"], not: ["NM"] });
  assert.equal(query.toString(), "sort=newest&mod=DT&mod=-NM");
});
