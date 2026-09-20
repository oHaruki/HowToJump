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
/*
 * A play carries the misscount its grade starts at, because EXP is read off
 * the misscount now and the grade only names the band it lands in. No note
 * count, so misses count as they are, the same as on a 1,500 note map.
 */
const missesFor = (grade: string) => GRADE_RULES.find((g) => g.grade === grade)?.minMiss ?? 0;
const play = (pack: string, grade: string, ...categories: string[]): LevelPlay => ({
  tierOrder: order(pack),
  categories: categories.length ? categories : [RAW],
  grade,
  missCount: missesFor(grade),
  noteCount: null,
});
const fcs = (pack: string, n: number) => Array.from({ length: n }, () => play(pack, "SS"));

/* The example in the write-up, under the 1.7x ladder and the miss curve. */
const EXAMPLE: LevelPlay[] = [
  ...fcs("Emerald", 6),
  play("Amethyst", "SS"), // FC
  play("Amethyst", "A"), // 2 misses
  play("Amethyst", "B+"), // 4 misses
  play("Amethyst", "C+"), // 12 misses
];

test("a play is worth its pack's EXP times the share its misses earn", () => {
  assert.equal(playExp(order("Amethyst"), "A", 2), 742_500); // three quarters
  assert.equal(playExp(order("Emerald"), "SS", 0), 580_000);
  assert.equal(playExp(order("Amethyst"), "SSS", 0), 1_188_000);
  assert.equal(Math.round(playExp(order("Bronze"), "Pass", 101)), 2);
  // The grade only names the band. Inside it the misscount still tells, so
  // two plays on one pack are no longer worth the same for being both B.
  assert.ok(playExp(order("Emerald"), "B", 6) > playExp(order("Emerald"), "B", 7));
});

test("a pack is reached at ten 2-miss plays on it", () => {
  assert.equal(threshold(order("Emerald")), 4_350_000);
  assert.equal(threshold(order("Amethyst")), 7_425_000);
  assert.equal(threshold(order("Diamond")), 12_600_000);
});

test("the worked example reads Emerald, 59/100 to Amethyst", () => {
  assert.equal(Math.round(bestExp(EXAMPLE)), 6_193_199);
  const level = levelFromExp(bestExp(EXAMPLE));
  assert.equal(level.tierOrder, order("Emerald"));
  assert.equal(level.progress, 59);
});

test("a sandbagged pass on a hard pack stays under a clean clear well below it", () => {
  // 150 misses on a Diamond map used to earn 16,384, beating a clean full
  // combo on a Titanium map outright. It is worth under a Stone one now.
  const pass = playExp(order("Diamond"), "Pass", 150, 1500);
  assert.equal(Math.round(pass), 62);
  assert.ok(
    pass < playExp(order("Stone"), "SS", 0) / 10,
    pass + " is still worth a tenth of a clean Stone full combo",
  );
  // A misscount that still says something about the play keeps its worth.
  assert.equal(Math.round(playExp(order("Diamond"), "C+", 12, 1500)), 571_122);
  assert.equal(Math.round(playExp(order("Diamond"), "B-", 9, 1500)), 713_698);
  assert.equal(playExp(order("Diamond"), "SS", 0), 1_680_000);
});

test("one more Amethyst FC makes it 80, four reach Amethyst", () => {
  const one = levelFromExp(bestExp([...EXAMPLE, play("Amethyst", "SS")]));
  assert.equal(one.tierOrder, order("Emerald"));
  assert.equal(one.progress, 80);

  const four = levelFromExp(bestExp([...EXAMPLE, ...fcs("Amethyst", 4)]));
  assert.equal(four.tierOrder, order("Amethyst"));
  assert.equal(Math.round(four.exp), 8_050_617);
});

test("full combos on the pack below never reach a pack, however many", () => {
  assert.equal(bestExp(fcs("Emerald", 10)), 5_800_000);
  assert.equal(levelFromExp(bestExp(fcs("Emerald", 25))).tierOrder, order("Emerald"));
  for (const t of TIERS.slice(1)) {
    const below = TIERS.find((x) => x.order === t.order - 1)!;
    const best = levelFromExp(bestExp(fcs(below.name, 50)));
    assert.equal(best.tierOrder, below.order, "ten " + below.name + " FCs stay " + below.name);
  }
});

test("even ten 100% runs on the pack below stay on that pack", () => {
  // Ten of them come to 12 times a pack's value against the 7.5 it takes,
  // and a pack is 1.7 times the one below, so 12 / 1.7 falls short.
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
  // Misses count by map size, so six on a 1,500 note map and twelve on a
  // 6,000 note one both count as six and are worth the same. The cleaner
  // real misscount leads; the older score used to take #1 underneath it.
  const six: LevelPlay & { id: number } =
    { id: 40, tierOrder: order("Emerald"), categories: [RAW], grade: "B", missCount: 6, noteCount: 1500 };
  const twelve: LevelPlay & { id: number } =
    { id: 12, tierOrder: order("Emerald"), categories: [RAW], grade: "C+", missCount: 12, noteCount: 6000 };
  const exp = (p: LevelPlay) => playExp(p.tierOrder, p.grade, p.missCount, p.noteCount);
  assert.equal(exp(six), exp(twelve));

  const listed = [twelve, six].map((p) => ({ ...p, exp: exp(p) })).sort(byWorth);
  assert.deepEqual(listed.map((p) => p.id), [40, 12]);

  const places = countingPlaces([twelve, six]);
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
  assert.equal(Math.round(levels[RAW].exp), 6_193_199);
  assert.equal(levels["Precision"].exp, 580_000);
  assert.equal(levels["Anti-aim"].exp, 0);
  const total = Object.values(levels).reduce((sum, l) => sum + l.exp, 0);
  assert.equal(Math.round(total), 6_193_199 + 580_000);
});

test("an old spelling still in the database counts toward the category it became", () => {
  const levels = categoryLevels([
    play("Copper", "SS", "Raw Aim"),
    play("Copper", "SS", "Consistency Aim"),
  ]);
  assert.equal(levels[RAW].exp, 1_700);
  assert.equal(levels["Aim - consistency"].exp, 1_700);
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
  assert.equal(levels[RAW].exp, 580_000 + 435_000);
  assert.equal(levels[CONSISTENCY].exp, 580_000);
  assert.equal(levels["Precision"].exp, 0);
});

test("the total adds each counting play once, however many categories it fills", () => {
  const both = play("Emerald", "SS", RAW, CONSISTENCY);
  assert.equal(totalExp([both]), 580_000);
  assert.equal(
    totalExp([both, play("Emerald", "A"), play("Stone", "SS", "Precision")]),
    580_000 + 435_000 + 1_000,
  );
  // Only plays inside some category's best ten add to it.
  const eleven = [...fcs("Emerald", 10), play("Stone", "SS")];
  assert.equal(totalExp(eleven), 5_800_000);
  // A dropped label earns nothing anywhere.
  assert.equal(totalExp([play("GOAT", "SSS", "Flow Aim")]), 0);
});

test("a play pushed out of one category still counts toward the total through another", () => {
  // Ten raw FCs fill that category; the shared play drops out of it but stays
  // Consistency's best, so it is still added once.
  const shared = play("Stone", "SS", RAW, CONSISTENCY);
  const plays = [...fcs("Emerald", 10), shared];
  assert.equal(categoryLevels(plays)[RAW].exp, 5_800_000);
  assert.equal(categoryLevels(plays)[CONSISTENCY].exp, 1_000);
  assert.equal(totalExp(plays), 5_801_000);
});

test("misses cost EXP by map size, while the pack's bar stays put", () => {
  // Amethyst, one miss: a 30 second map counts it about three times.
  assert.equal(Math.round(playExp(order("Amethyst"), "A+", 1, 150)), 674_195); // counts as 3
  assert.equal(Math.round(playExp(order("Amethyst"), "A+", 1, 1500)), 833_927);
  assert.equal(Math.round(playExp(order("Amethyst"), "A", 2, 3000)), 833_927); // counts as 1
  // Full combos and 100% runs are never scaled.
  assert.equal(playExp(order("Amethyst"), "SS", 0, 150), 990_000);
  assert.equal(playExp(order("Amethyst"), "SSS", 0, 150), 1_188_000);
  // Reaching a pack is still ten 2-miss plays on it.
  assert.equal(threshold(order("Amethyst")), 7_425_000);

  const short: LevelPlay = { ...play("Emerald", "A"), missCount: 2, noteCount: 150 };
  const long: LevelPlay = { ...play("Emerald", "A"), missCount: 2, noteCount: 1500 };
  // 2 misses on 150 notes count as 6, and six misses earn 53.2% of a pack.
  assert.equal(Math.round(categoryLevels([short])[RAW].exp), 308_730);
  assert.equal(categoryLevels([long])[RAW].exp, 435_000);
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
  // EXP follows the misscount as the map's length counts it, so a tie now
  // means two plays whose misses count the same: six on a 1,500 note map,
  // twelve on a 6,000 note one. The twelve is the older score, which used
  // to take #1 while being drawn underneath.
  const six = graded(40, "Emerald", 6, 1500);
  const twelve = graded(12, "Emerald", 12, 6000);
  assert.equal(expOf(six), expOf(twelve));
  // The grade letters differ, because a grade always reads the real misses.
  assert.equal(six.grade, "B");
  assert.equal(twelve.grade, "C+");

  assert.deepEqual(listed([twelve, six]).map((p) => p.id), [40, 12]);
  const places = countingPlaces([twelve, six]);
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
  // Eleven plays whose misses all count as six: five that really are six on
  // a 1,500 note map, six that are twelve on a 6,000 note one.
  const six = [1, 2, 3, 4, 5].map((i) => graded(i, "Emerald", 6, 1500));
  const twelve = [6, 7, 8, 9, 10, 11].map((i) => graded(i, "Emerald", 12, 6000));
  const all = [...six, ...twelve];
  assert.equal(new Set(all.map(expOf)).size, 1, "they have to all be worth the same");

  const places = countingPlaces(all);
  // The six miss runs take places 1 to 5, then the five oldest twelve miss ones.
  assert.deepEqual(
    all.filter((p) => places.has(p.id)).map((p) => p.id),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.equal(places.has(11), false, "the newest twelve miss run should be the one dropped");
  assert.equal(
    Math.round(categoryLevels(all)[RAW].exp),
    Math.round(BEST_PLAYS * expOf(six[0])),
  );
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
      pass < playExp(below.order, "SS", 0),
      "a 150 miss pass on " + t.name + " is worth a clean " + below.name + " FC or more",
    );
  }
  // What Kayrem reported, in full: it used to beat a clean Titanium FC.
  const diamond = playExp(order("Diamond"), "Pass", 150, 1500);
  assert.equal(Math.round(diamond), 62);
  assert.ok(diamond < playExp(order("Stone"), "SS", 0));
  assert.ok(diamond > 0, "a pass should still be worth something, however little");
});

test("a clean clear outranks a sloppy one well above it", () => {
  // The screenshot that started this: a 105 miss pass on a GOAT marathon,
  // counting as about 70, stood above a 5 miss clear on a Ruby map five
  // packs below it. The whole miss curve has to be worth more than the gap
  // five packs open, and at 1.7 a pack it is.
  const sandbagged = playExp(order("GOAT"), "F+", 70, 1500);
  const clean = playExp(order("Ruby"), "B-", 9, 1500);
  assert.ok(clean > sandbagged, "a 5 miss Ruby clear is still under a 70 miss GOAT one");

  // Twelve misses costs about two packs: a twelve miss Diamond clear comes
  // out level with a clean Emerald full combo, and clear of a Sapphire one.
  // Cutting C+ to 16% put it under the Sapphire, which is what Kayrem read
  // as too harsh on play that is still a real clear.
  const twelve = playExp(order("Diamond"), "C+", 12, 1500);
  const emerald = playExp(order("Emerald"), "SS", 0);
  assert.ok(
    twelve > emerald * 0.9 && twelve < emerald * 1.1,
    "a 12 miss Diamond clear is " + (twelve / emerald).toFixed(2) + " of an Emerald FC",
  );
  assert.ok(twelve > playExp(order("Sapphire"), "SS", 0));
});

test("the ladder rises about 1.7 a pack, and thresholds follow it", () => {
  assert.equal(threshold(order("Stone")), 7_500);
  assert.equal(threshold(order("Silver")), 63_750);
  assert.equal(threshold(order("Emerald")), 4_350_000);
  assert.equal(threshold(order("Amethyst")), 7_425_000);
  assert.equal(threshold(order("GOAT")), 21_450_000);
  for (const t of TIERS) assert.equal(threshold(t.order), BEST_PLAYS * t.exp * 0.75);

  // Every step has to clear 1.6, or ten 100% runs on the pack below would
  // reach the next one, and stay near 1.7 so the miss curve outweighs it.
  for (let i = 1; i < TIERS.length; i++) {
    const ratio = TIERS[i].exp / TIERS[i - 1].exp;
    assert.ok(ratio > 1.6 && ratio < 1.8, TIERS[i].name + " is " + ratio.toFixed(3) + " of " + TIERS[i - 1].name);
  }
});

test("the rules string carries the grade shares, so a retune rebuilds levels", () => {
  // db:deploy compares this with what the stored levels were computed under.
  const rules = JSON.parse(levelRules()) as {
    grades: Array<[string, number]>;
    packs: Array<[number, number]>;
    bestPlays: number;
    missShape: number[];
  };
  assert.equal(rules.grades.length, GRADE_RULES.length);
  for (const g of GRADE_RULES) {
    assert.deepEqual(rules.grades.find(([name]) => name === g.grade), [g.grade, g.expPercent]);
  }
  assert.equal(rules.packs.length, TIERS.length);
  assert.deepEqual(rules.packs.find(([o]) => o === order("GOAT")), [order("GOAT"), 2_860_000]);
  assert.equal(rules.bestPlays, BEST_PLAYS);
  // The curve's own numbers are in there too, so retuning it rebuilds levels
  // even where every grade's headline share happens to round the same way.
  assert.equal(rules.missShape.length, 5);
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
  // Ten of them do not even reach Stone, where they once reached Topaz.
  assert.equal(Math.round(sandbag), 1_057);
  assert.equal(levelFromExp(sandbag).tierOrder, null, "ten of them do not even reach Stone");
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
