/**
 * Run with: node --import tsx --test src/lib/levels.test.ts
 *
 * Covers the level rule as it was agreed with Kayrem, down to the worked
 * example he was sent, plus the promises the rule makes: a new map never
 * lowers anyone, only the best plays count, and a pack's name is only
 * reached by playing that pack.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  BEST_PLAYS, bestExp, categoryLevels, levelFromExp, mainLevel, playExp, threshold,
  totalExp, type Level, type LevelPlay,
} from "./levels";
import { CATEGORIES, TIERS, tierByName } from "./tiers";

const order = (name: string) => tierByName(name)!.order;
const RAW = "Aim - raw mechanic";
const CONSISTENCY = "Aim - consistency";
const play = (pack: string, grade: string, ...categories: string[]): LevelPlay => ({
  tierOrder: order(pack),
  categories: categories.length ? categories : [RAW],
  grade,
});
const fcs = (pack: string, n: number) => Array.from({ length: n }, () => play(pack, "SS"));

/* The example in the write-up: Emerald, 68/100 to Amethyst. */
const EXAMPLE: LevelPlay[] = [
  ...fcs("Emerald", 6),
  play("Amethyst", "SS"), // FC
  play("Amethyst", "A"), // 2 misses
  play("Amethyst", "B+"), // 4 misses
  play("Amethyst", "C+"), // 12 misses
];

test("a play is worth its pack's EXP times its grade's share", () => {
  assert.equal(playExp(order("Amethyst"), "A"), 3750);
  assert.equal(playExp(order("Emerald"), "SS"), 3400);
  assert.equal(playExp(order("Amethyst"), "SSS"), 6000);
  assert.equal(playExp(order("Bronze"), "Pass"), 1);
});

test("a pack is reached at ten 2-miss plays on it", () => {
  assert.equal(threshold(order("Emerald")), 25500);
  assert.equal(threshold(order("Amethyst")), 37500);
  assert.equal(threshold(order("Diamond")), 55500);
});

test("the worked example reads Emerald, 68/100 to Amethyst", () => {
  assert.equal(bestExp(EXAMPLE), 33700);
  assert.deepEqual(levelFromExp(bestExp(EXAMPLE)), {
    exp: 33700,
    tierOrder: order("Emerald"),
    progress: 68,
  });
});

test("one more Amethyst FC makes it 95, two reach Amethyst", () => {
  const one = levelFromExp(bestExp([...EXAMPLE, play("Amethyst", "SS")]));
  assert.equal(one.tierOrder, order("Emerald"));
  assert.equal(one.progress, 95);

  const two = levelFromExp(bestExp([...EXAMPLE, play("Amethyst", "SS"), play("Amethyst", "SS")]));
  assert.equal(two.tierOrder, order("Amethyst"));
  assert.equal(two.exp, 39150);
});

test("full combos on the pack below never reach a pack, however many", () => {
  assert.equal(bestExp(fcs("Emerald", 10)), 34000);
  assert.equal(levelFromExp(bestExp(fcs("Emerald", 25))).tierOrder, order("Emerald"));
  for (const t of TIERS.slice(1)) {
    const below = TIERS.find((x) => x.order === t.order - 1)!;
    const best = levelFromExp(bestExp(fcs(below.name, 50)));
    assert.equal(best.tierOrder, below.order, "ten " + below.name + " FCs stay " + below.name);
  }
});

test("only the best ten plays count", () => {
  const ten = [...EXAMPLE];
  assert.equal(ten.length, BEST_PLAYS);
  assert.equal(bestExp([...ten, play("Stone", "SS")]), bestExp(ten));
});

test("adding a play never lowers a level", () => {
  const extras = [
    play("Stone", "Pass"), play("Bronze", "F"), play("Emerald", "C"),
    play("Amethyst", "SS"), play("GOAT", "D"), play("Diamond", "A-"),
  ];
  let plays = [...EXAMPLE];
  let last = bestExp(plays);
  for (const extra of extras) {
    plays = [...plays, extra];
    const now = bestExp(plays);
    assert.ok(now >= last, "adding " + extra.grade + " on " + extra.tierOrder + " lowered it");
    last = now;
  }
});

test("no plays is Unranked, working toward Stone", () => {
  assert.deepEqual(levelFromExp(0), { exp: 0, tierOrder: null, progress: 0 });
  const some = levelFromExp(threshold(order("Stone")) / 2);
  assert.equal(some.tierOrder, null);
  assert.equal(some.progress, 50);
});

test("progress never reads 100 short of the next pack, and GOAT has no next", () => {
  const nearly = levelFromExp(threshold(order("Amethyst")) - 0.01);
  assert.equal(nearly.tierOrder, order("Emerald"));
  assert.equal(nearly.progress, 99);
  assert.deepEqual(levelFromExp(threshold(order("GOAT")) * 3), {
    exp: threshold(order("GOAT")) * 3,
    tierOrder: order("GOAT"),
    progress: null,
  });
});

test("each category counts only its own plays, and a dropped label counts toward none", () => {
  const levels = categoryLevels([
    ...EXAMPLE,
    play("Emerald", "SS", "Precision"),
    play("GOAT", "SSS", "Flow Aim"),
  ]);
  assert.deepEqual(Object.keys(levels), CATEGORIES);
  assert.equal(levels[RAW].exp, 33700);
  assert.equal(levels["Precision"].exp, 3400);
  assert.equal(levels["Anti-aim"].exp, 0);
  const total = Object.values(levels).reduce((sum, l) => sum + l.exp, 0);
  assert.equal(total, 33700 + 3400);
});

test("an old spelling still in the database counts toward the category it became", () => {
  const levels = categoryLevels([
    play("Copper", "SS", "Raw Aim"),
    play("Copper", "SS", "Consistency Aim"),
  ]);
  assert.equal(levels[RAW].exp, 45);
  assert.equal(levels["Aim - consistency"].exp, 45);
});

test("the main level averages the five", () => {
  const at = (tierOrder: number | null, progress: number | null): Level => ({
    exp: 0, tierOrder, progress,
  });
  const emerald68 = at(order("Emerald"), 68);
  assert.deepEqual(mainLevel([emerald68, emerald68, emerald68, emerald68, emerald68], 0), emerald68);
  // Amethyst 0 and Sapphire 0 average to Emerald 0.
  assert.deepEqual(mainLevel([at(order("Amethyst"), 0), at(order("Sapphire"), 0)], 0), at(order("Emerald"), 0));
  // An untouched category pulls the average down: that is the all-rounder rule.
  assert.deepEqual(mainLevel([at(order("Emerald"), 0), at(null, 0)], 0), at(6, 50));
  const goat = at(order("GOAT"), null);
  assert.deepEqual(mainLevel([goat, goat], 0), goat);
});

test("a map in two categories counts in full toward both", () => {
  const levels = categoryLevels([play("Emerald", "SS", RAW, CONSISTENCY), play("Emerald", "A")]);
  assert.equal(levels[RAW].exp, 3400 + 2550);
  assert.equal(levels[CONSISTENCY].exp, 3400);
  assert.equal(levels["Precision"].exp, 0);
});

test("the total adds each counting play once, however many categories it fills", () => {
  const both = play("Emerald", "SS", RAW, CONSISTENCY);
  assert.equal(totalExp([both]), 3400);
  assert.equal(totalExp([both, play("Emerald", "A"), play("Stone", "SS", "Precision")]), 3400 + 2550 + 30);
  // Only plays inside some category's best ten add to it.
  const eleven = [...fcs("Emerald", 10), play("Stone", "SS")];
  assert.equal(totalExp(eleven), 34000);
  // A dropped label earns nothing anywhere.
  assert.equal(totalExp([play("GOAT", "SSS", "Flow Aim")]), 0);
});

test("a play pushed out of one category still counts toward the total through another", () => {
  // Ten raw FCs fill that category; the shared play drops out of it but stays
  // Consistency's best, so it is still added once.
  const shared = play("Stone", "SS", RAW, CONSISTENCY);
  const plays = [...fcs("Emerald", 10), shared];
  assert.equal(categoryLevels(plays)[RAW].exp, 34000);
  assert.equal(categoryLevels(plays)[CONSISTENCY].exp, 30);
  assert.equal(totalExp(plays), 34030);
});
