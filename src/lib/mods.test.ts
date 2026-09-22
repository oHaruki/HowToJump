/**
 * Run with: node --import tsx --test src/lib/mods.test.ts
 *
 * Mods as a score was played, as the bank keys them, and as words.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { modsAsPlayed, modsFromApi, modsText } from "./mods";

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
