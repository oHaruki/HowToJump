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
  BEST_PLAYS, bestExp, byWorth, categoryLevels, countingPlaces, levelFromExp, levelRules,
  mainLevel, playExp, progressText, threshold, totalExp, type Level, type LevelPlay,
} from "./levels";
import { GRADE_RULES, gradeFor } from "./grading";
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
  assert.equal(playExp(order("Bronze"), "Pass"), 1.6);
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

test("a sandbagged pass on a hard pack stays under a clean clear well below it", () => {
  // 150 misses on a Diamond map used to earn 16,384, beating a clean full
  // combo on a Titanium map outright. It is worth about a Gold one now.
  const pass = playExp(order("Diamond"), "Pass", 150, 1500);
  assert.equal(Math.round(pass), 3_277);
  assert.ok(
    pass < playExp(order("Platinum"), "SS"),
    pass + " is still worth a Platinum FC or more",
  );
  // A misscount that still says something about the play is untouched.
  assert.equal(playExp(order("Diamond"), "C+", 12, 1500), 1_638_400 * 0.36);
  assert.equal(playExp(order("Diamond"), "B-", 9, 1500), 1_638_400 * 0.44);
  assert.equal(playExp(order("Diamond"), "SS"), 1_638_400);
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

test("plays worth the same EXP are ordered and numbered the same way", () => {
  // Both B on a 1,500 note map, so both earn 50% of Emerald: same EXP, and
  // the newer one is the cleaner. Six misses has to lead, and to be #1.
  const tied = (id: number, missCount: number): LevelPlay & { id: number } => ({
    id, tierOrder: order("Emerald"), categories: [RAW], grade: "B", missCount, noteCount: 1500,
  });
  const six = tied(40, 6);
  const seven = tied(12, 7);
  const exp = (p: LevelPlay) => playExp(p.tierOrder, p.grade, p.missCount, p.noteCount);
  assert.equal(exp(six), exp(seven));

  const listed = [seven, six].map((p) => ({ ...p, exp: exp(p) })).sort(byWorth);
  assert.deepEqual(listed.map((p) => p.id), [40, 12]);

  const places = countingPlaces([seven, six]);
  assert.deepEqual(places.get(40), [{ category: RAW, place: 1 }]);
  assert.deepEqual(places.get(12), [{ category: RAW, place: 2 }]);
});

test("progress reads out with its percent sign", () => {
  assert.equal(progressText(17), "17/100%");
  assert.equal(progressText(0), "0/100%");
  assert.equal(progressText(null), "0/100%");
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

/* ------------------------------------------ ordering a player's plays */

const worth = (exp: number, missCount: number, id: number) => ({ exp, missCount, id });

test("byWorth ranks by EXP, then the real misscount, then the older score", () => {
  assert.ok(byWorth(worth(100, 99, 9), worth(90, 0, 1)) < 0, "EXP comes first");
  assert.ok(byWorth(worth(100, 7, 1), worth(100, 6, 9)) > 0, "misses split equal EXP");
  assert.ok(byWorth(worth(100, 6, 9), worth(100, 6, 2)) > 0, "the older score keeps the tie");
  assert.equal(byWorth(worth(100, 6, 2), worth(100, 6, 2)), 0);
  assert.deepEqual(
    [worth(50, 0, 3), worth(100, 7, 2), worth(100, 6, 9), worth(100, 6, 1)]
      .sort(byWorth)
      .map((p) => p.id),
    [1, 9, 2, 3],
  );
});

test("byWorth is a real ordering, so a sort cannot loop", () => {
  const all = [];
  for (const e of [0, 100, 409_600]) {
    for (const m of [0, 6, 7]) for (const id of [1, 2]) all.push(worth(e, m, id));
  }
  for (const a of all) {
    for (const b of all) {
      assert.equal(Math.sign(byWorth(a, b)) + Math.sign(byWorth(b, a)), 0, "not antisymmetric");
      for (const c of all) {
        if (byWorth(a, b) <= 0 && byWorth(b, c) <= 0) {
          assert.ok(byWorth(a, c) <= 0, "not transitive");
        }
      }
    }
  }
});

/* A play the way a profile builds one, with the grade its misses earn. */
const graded = (
  id: number,
  pack: string,
  missCount: number,
  noteCount: number | null,
  ...categories: string[]
): LevelPlay & { id: number } => ({
  id,
  tierOrder: order(pack),
  categories: categories.length ? categories : [RAW],
  grade: gradeFor({ missCount, isFc: false, isPerfect: false }),
  missCount,
  noteCount,
});

const expOf = (p: LevelPlay) => playExp(p.tierOrder, p.grade, p.missCount, p.noteCount);
const listed = (plays: Array<LevelPlay & { id: number }>) =>
  plays.map((p) => ({ ...p, exp: expOf(p) })).sort(byWorth);

test("the screenshot case: tied EXP, and the cleaner run leads and is #1", () => {
  // Both B on a 1,500 note map, so both earn 50% of Emerald. The seven miss
  // run is the older score, which used to take #1 and be drawn underneath.
  const six = graded(40, "Emerald", 6, 1500);
  const seven = graded(12, "Emerald", 7, 1500);
  assert.equal(expOf(six), expOf(seven));
  assert.equal(six.grade, "B");
  assert.equal(seven.grade, "B");

  assert.deepEqual(listed([seven, six]).map((p) => p.id), [40, 12]);
  const places = countingPlaces([seven, six]);
  assert.deepEqual(places.get(40), [{ category: RAW, place: 1 }]);
  assert.deepEqual(places.get(12), [{ category: RAW, place: 2 }]);
});

test("however the plays fall, the list order and the printed places agree", () => {
  // The bug was that a profile listed top plays one way and numbered them
  // another, so a #1 could be drawn under the #2 it tied with. Both read
  // byWorth now, which this checks over a spread wide enough to tie often.
  let seed = 20260920;
  const rnd = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };
  const packs = TIERS.map((t) => t.name);
  const plays = Array.from({ length: 120 }, (_, i) =>
    graded(
      i + 1,
      // A narrow spread of packs and misses, so ties are common rather than rare.
      packs[10 + rnd(3)],
      [0, 1, 6, 7, 12, 13, 25, 40][rnd(8)],
      [null, 150, 1500, 3000][rnd(4)],
      ...CATEGORIES.filter(() => rnd(2) === 0),
    ),
  );
  const ties = listed(plays).filter((p, i, xs) => i > 0 && xs[i - 1].exp === p.exp);
  assert.ok(ties.length > 20, "only " + ties.length + " ties: not testing much");

  const places = countingPlaces(plays);
  for (const category of CATEGORIES) {
    const shown = listed(plays)
      .map((p) => places.get(p.id)?.find((x) => x.category === category)?.place)
      .filter((place): place is number => place != null);
    assert.deepEqual(
      shown,
      shown.map((_, i) => i + 1),
      category + " is numbered in a different order from the one it is drawn in",
    );
  }
});

test("on a tie for the last counting place, the cleaner play takes it", () => {
  // Eleven plays all worth 50% of Emerald: five at six misses, six at seven.
  const six = [1, 2, 3, 4, 5].map((i) => graded(i, "Emerald", 6, 1500));
  const seven = [6, 7, 8, 9, 10, 11].map((i) => graded(i, "Emerald", 7, 1500));
  const all = [...six, ...seven];
  assert.equal(new Set(all.map(expOf)).size, 1, "they have to all be worth the same");

  const places = countingPlaces(all);
  // The six miss runs take places 1 to 5, then the five oldest seven miss ones.
  assert.deepEqual(
    all.filter((p) => places.has(p.id)).map((p) => p.id),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.equal(places.has(11), false, "the newest seven miss run should be the one dropped");
  assert.equal(categoryLevels(all)[RAW].exp, BEST_PLAYS * 204_800);
});

/* ---------------------------------------------- what the retune promises */

test("on every pack, more misses is never worth more", () => {
  for (const t of TIERS) {
    for (const notes of [null, 150, 1500, 3000]) {
      let last = Number.POSITIVE_INFINITY;
      for (let m = 0; m <= 200; m++) {
        const v = playExp(t.order, gradeFor({ missCount: m, isFc: false, isPerfect: false }), m, notes);
        assert.ok(v <= last, m + " misses on " + t.name + " (" + notes + " notes) pays more");
        last = v;
      }
    }
  }
});

test("a 100+ miss pass never outranks a clean full combo three packs below", () => {
  for (const t of TIERS) {
    const below = tierByName(TIERS.find((x) => x.order === t.order - 3)?.name ?? "");
    if (!below) continue;
    const pass = playExp(t.order, "Pass", 150, 1500);
    assert.ok(
      pass < playExp(below.order, "SS"),
      "a 150 miss pass on " + t.name + " is worth a clean " + below.name + " FC or more",
    );
  }
  // What Kayrem reported, in full: it used to beat a clean Titanium FC.
  const diamond = playExp(order("Diamond"), "Pass", 150, 1500);
  assert.equal(Math.round(diamond), 3_277);
  assert.ok(diamond < playExp(order("Platinum"), "SS"));
  assert.ok(diamond > playExp(order("Gold"), "SS"), "it should still be worth something");
});

test("what a misscount still says about the play is paid in full", () => {
  // Everything at twenty misses or under is the original scale, untouched.
  assert.equal(playExp(order("Diamond"), "SS"), 1_638_400);
  assert.equal(playExp(order("Diamond"), "B", 7, 1500), 1_638_400 * 0.5);
  assert.equal(playExp(order("Diamond"), "B-", 9, 1500), 1_638_400 * 0.44);
  assert.equal(playExp(order("Diamond"), "C+", 12, 1500), 589_824);
  // Written out rather than as 1,638,400 x 0.29, which in floating point is
  // a hair under the whole number the percentage itself works out to.
  assert.equal(playExp(order("Diamond"), "C", 18, 1500), 475_136);
  // A twelve miss clear on Diamond still stands over a clean Emerald FC, two
  // packs below it. That is the objection to the first attempt at the tail.
  assert.ok(playExp(order("Diamond"), "C+", 12, 1500) > playExp(order("Emerald"), "SS"));
});

test("retuning the tail leaves what it takes to reach a pack alone", () => {
  // Thresholds are read off the 2 miss grade, which did not move.
  assert.equal(threshold(order("Stone")), 750);
  assert.equal(threshold(order("Silver")), 12_000);
  assert.equal(threshold(order("Emerald")), 3_072_000);
  assert.equal(threshold(order("Amethyst")), 6_144_000);
  assert.equal(threshold(order("GOAT")), 24_576_000);
  for (const t of TIERS) assert.equal(threshold(t.order), BEST_PLAYS * t.exp * 0.75);
});

test("the rules string carries the grade shares, so a retune rebuilds levels", () => {
  // db:deploy compares this with what the stored levels were computed under.
  const rules = JSON.parse(levelRules()) as {
    grades: Array<[string, number]>;
    packs: Array<[number, number]>;
    bestPlays: number;
  };
  assert.equal(rules.grades.length, GRADE_RULES.length);
  assert.deepEqual(rules.grades.find(([g]) => g === "Pass"), ["Pass", 0.2]);
  assert.deepEqual(rules.grades.find(([g]) => g === "C+"), ["C+", 36]);
  assert.equal(rules.packs.length, TIERS.length);
  assert.equal(rules.bestPlays, BEST_PLAYS);
});

test("sandbagging a pack is worth far less than playing the one you are on", () => {
  // Ten 150 miss passes on GOAT, against ten clean full combos on Titanium.
  const sandbag = bestExp(
    Array.from({ length: BEST_PLAYS }, () => graded(1, "GOAT", 150, 1500)),
  );
  const honest = bestExp(
    Array.from({ length: BEST_PLAYS }, () => graded(1, "Titanium", 0, 1500)),
  );
  assert.ok(sandbag < honest, sandbag + " beats ten clean Titanium full combos");
  // Before the retune those ten passes came to 327,680, which reached Topaz.
  // Rounded because a fractional share leaves a sum a hair under the round
  // number; stored EXP is rounded the same way in refreshProgress.
  assert.equal(Math.round(sandbag), 65_536);
  assert.equal(levelFromExp(sandbag).tierOrder, order("Platinum"));
  assert.equal(levelFromExp(honest).tierOrder, order("Titanium"));
});

/* --------------------------------------------------------- reading it out */

test("progress reads out with its percent sign, everywhere it is shown", () => {
  assert.equal(progressText(17), "17/100%");
  assert.equal(progressText(0), "0/100%");
  assert.equal(progressText(99), "99/100%");
  // null is the top pack, where a caller shows its own wording instead.
  assert.equal(progressText(null), "0/100%");
  assert.equal(progressText(undefined), "0/100%");
});

test("a profile never shows a bar that has run past its pack", () => {
  for (const t of TIERS) {
    for (const share of [0, 0.01, 0.5, 0.99, 0.999999]) {
      const from = threshold(t.order);
      const to = tierByName(TIERS.find((x) => x.order === t.order + 1)?.name ?? "");
      if (!to) continue;
      const level = levelFromExp(from + (threshold(to.order) - from) * share);
      assert.equal(level.tierOrder, t.order);
      assert.ok(level.progress != null && level.progress >= 0 && level.progress <= 99);
    }
  }
});
