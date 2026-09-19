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
// No note count, so each play earns what its grade says, as on a 1,500 note map.
const play = (pack: string, grade: string, ...categories: string[]): LevelPlay => ({
  tierOrder: order(pack),
  categories: categories.length ? categories : [RAW],
  grade,
  missCount: 0,
  noteCount: null,
});
const fcs = (pack: string, n: number) => Array.from({ length: n }, () => play(pack, "SS"));

/* The example in the write-up, under the doubled packs: Emerald, 50/100. */
const EXAMPLE: LevelPlay[] = [
  ...fcs("Emerald", 6),
  play("Amethyst", "SS"), // FC
  play("Amethyst", "A"), // 2 misses
  play("Amethyst", "B+"), // 4 misses
  play("Amethyst", "C+"), // 12 misses
];

test("a play is worth its pack's EXP times its grade's share", () => {
  assert.equal(playExp(order("Amethyst"), "A"), 614_400);
  assert.equal(playExp(order("Emerald"), "SS"), 409_600);
  assert.equal(playExp(order("Amethyst"), "SSS"), 983_040);
  assert.equal(playExp(order("Bronze"), "Pass"), 8);
});

test("a pack is reached at ten 2-miss plays on it", () => {
  assert.equal(threshold(order("Emerald")), 3_072_000);
  assert.equal(threshold(order("Amethyst")), 6_144_000);
  assert.equal(threshold(order("Diamond")), 12_288_000);
});

test("the worked example reads Emerald, 50/100 to Amethyst", () => {
  assert.equal(bestExp(EXAMPLE), 4_636_672);
  assert.deepEqual(levelFromExp(bestExp(EXAMPLE)), {
    exp: 4_636_672,
    tierOrder: order("Emerald"),
    progress: 50,
  });
});

test("one more Amethyst FC makes it 68, four reach Amethyst", () => {
  const one = levelFromExp(bestExp([...EXAMPLE, play("Amethyst", "SS")]));
  assert.equal(one.tierOrder, order("Emerald"));
  assert.equal(one.progress, 68);

  const four = levelFromExp(bestExp([...EXAMPLE, ...fcs("Amethyst", 4)]));
  assert.equal(four.tierOrder, order("Amethyst"));
  assert.equal(four.exp, 6_389_760);
});

test("full combos on the pack below never reach a pack, however many", () => {
  assert.equal(bestExp(fcs("Emerald", 10)), 4_096_000);
  assert.equal(levelFromExp(bestExp(fcs("Emerald", 25))).tierOrder, order("Emerald"));
  for (const t of TIERS.slice(1)) {
    const below = TIERS.find((x) => x.order === t.order - 1)!;
    const best = levelFromExp(bestExp(fcs(below.name, 50)));
    assert.equal(best.tierOrder, below.order, "ten " + below.name + " FCs stay " + below.name);
  }
});

test("even ten 100% runs on the pack below stay on that pack", () => {
  // Ten of them come to 12 times a pack's value against the 15 it takes.
  for (const t of TIERS.slice(1)) {
    const below = TIERS.find((x) => x.order === t.order - 1)!;
    const best = levelFromExp(bestExp(Array.from({ length: 10 }, () => play(below.name, "SSS"))));
    assert.equal(best.tierOrder, below.order, "ten " + below.name + " 100% runs stay " + below.name);
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
  assert.equal(levels[RAW].exp, 4_636_672);
  assert.equal(levels["Precision"].exp, 409_600);
  assert.equal(levels["Anti-aim"].exp, 0);
  const total = Object.values(levels).reduce((sum, l) => sum + l.exp, 0);
  assert.equal(total, 4_636_672 + 409_600);
});

test("an old spelling still in the database counts toward the category it became", () => {
  const levels = categoryLevels([
    play("Copper", "SS", "Raw Aim"),
    play("Copper", "SS", "Consistency Aim"),
  ]);
  assert.equal(levels[RAW].exp, 200);
  assert.equal(levels["Aim - consistency"].exp, 200);
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
  assert.equal(levels[RAW].exp, 409_600 + 307_200);
  assert.equal(levels[CONSISTENCY].exp, 409_600);
  assert.equal(levels["Precision"].exp, 0);
});

test("the total adds each counting play once, however many categories it fills", () => {
  const both = play("Emerald", "SS", RAW, CONSISTENCY);
  assert.equal(totalExp([both]), 409_600);
  assert.equal(
    totalExp([both, play("Emerald", "A"), play("Stone", "SS", "Precision")]),
    409_600 + 307_200 + 100,
  );
  // Only plays inside some category's best ten add to it.
  const eleven = [...fcs("Emerald", 10), play("Stone", "SS")];
  assert.equal(totalExp(eleven), 4_096_000);
  // A dropped label earns nothing anywhere.
  assert.equal(totalExp([play("GOAT", "SSS", "Flow Aim")]), 0);
});

test("a play pushed out of one category still counts toward the total through another", () => {
  // Ten raw FCs fill that category; the shared play drops out of it but stays
  // Consistency's best, so it is still added once.
  const shared = play("Stone", "SS", RAW, CONSISTENCY);
  const plays = [...fcs("Emerald", 10), shared];
  assert.equal(categoryLevels(plays)[RAW].exp, 4_096_000);
  assert.equal(categoryLevels(plays)[CONSISTENCY].exp, 100);
  assert.equal(totalExp(plays), 4_096_100);
});

test("misses cost EXP by map size, while the pack's bar stays put", () => {
  // Amethyst, one miss (A+): a 30 second map counts it about three times.
  assert.equal(playExp(order("Amethyst"), "A+", 1, 150), 532_480); // as A-, 65%
  assert.equal(playExp(order("Amethyst"), "A+", 1, 1500), 696_320); // as A+, 85%
  assert.equal(playExp(order("Amethyst"), "A", 2, 3000), 696_320); // counts as 1 miss
  // Full combos and 100% runs are never scaled.
  assert.equal(playExp(order("Amethyst"), "SS", 0, 150), 819_200);
  assert.equal(playExp(order("Amethyst"), "SSS", 0, 150), 983_040);
  // Reaching a pack is still ten 2-miss plays as the table reads them.
  assert.equal(threshold(order("Amethyst")), 6_144_000);

  const short: LevelPlay = { ...play("Emerald", "A"), missCount: 2, noteCount: 150 };
  const long: LevelPlay = { ...play("Emerald", "A"), missCount: 2, noteCount: 1500 };
  // 2 misses on 150 notes count as 6 (B, 50%): 409,600 × 50%.
  assert.equal(categoryLevels([short])[RAW].exp, 204_800);
  assert.equal(categoryLevels([long])[RAW].exp, 307_200);
});
