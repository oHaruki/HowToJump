/**
 * Run with: node --import tsx --test src/lib/mods.test.ts
 *
 * Mods as a score was played, as the bank keys them, and as words.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { modsAsPlayed, modsFromApi, modsText, refusedMod } from "./mods";

test("a play with No Fail, Relax, Autopilot or Difficulty Adjust doesn't count", () => {
  assert.equal(refusedMod([{ acronym: "HD" }, { acronym: "NF" }]), "No Fail");
  assert.equal(refusedMod([{ acronym: "RX" }]), "Relax");
  assert.equal(refusedMod([{ acronym: "AP" }, { acronym: "CL" }]), "Autopilot");
  assert.equal(refusedMod([{ acronym: "DA" }]), "Difficulty Adjust");
  // Older replies list the acronyms as strings.
  assert.equal(refusedMod(["nf", "DT"]), "No Fail");
  for (const fine of [[], null, [{ acronym: "HD" }, { acronym: "DT" }], [{ acronym: "CL" }], ["SD"]]) {
    assert.equal(refusedMod(fine), null, JSON.stringify(fine));
  }
});

test("mods read as words the way a message names them", () => {
  assert.equal(modsText(["NM"]), "nomod");
  assert.equal(modsText(["HR"]), "+HR");
  assert.equal(modsText(["NM", "HR"]), "nomod and +HR");
  assert.equal(modsText(["NM", "HR", "DT"]), "nomod, +HR and +DT");
  assert.equal(modsText([]), "");
});

test("a score's mods as played keep what the bank folds away, less the classic marker", () => {
  assert.equal(modsAsPlayed([{ acronym: "HD" }, { acronym: "DT" }]), "HDDT");
  assert.equal(modsAsPlayed([{ acronym: "RX" }, { acronym: "CL" }]), "RX");
  assert.equal(modsAsPlayed([{ acronym: "CL" }]), "NM");
  assert.equal(modsAsPlayed(["hd", "hr"]), "HDHR");
  assert.equal(modsAsPlayed([]), "NM");
  assert.equal(modsAsPlayed(null), "NM");
  // The bank's key for the same score folds Hidden away.
  assert.equal(modsFromApi([{ acronym: "HD" }, { acronym: "DT" }]), "DT");
});
