/**
 * Run with: node --import tsx --test src/lib/grading.test.ts
 *
 * Misses by map size, as Kayrem settled it: a 1,500 note map counts as it
 * is, shorter maps make each miss count more on the gentle curve, and only
 * the EXP moves. The grade always reads the real misses.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  GRADE_RULES, MISS_ACCEL, MISS_ACCEL_CAP, MISS_KNEE, MISS_SLOPE, THRESHOLD_MISSES,
  THRESHOLD_SHARE, compareResults, expPercentFor, expShare, gradeFor, missFactor,
  scaledMisses, shareForMisses,
} from "./grading";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.01, a + " is not " + b);

test("a 1,500 note map counts ×1, a 150 note map about ×3", () => {
  assert.equal(missFactor(1500), 1);
  near(missFactor(150), 3.16);
  near(missFactor(500), 1.73);
  near(missFactor(3000), 0.71);
  // A map osu! has not given a count for yet counts as it always did.
  assert.equal(missFactor(null), 1);
  assert.equal(missFactor(0), 1);
});

test("scaled misses round, and a miss never counts as none", () => {
  assert.equal(scaledMisses(0, 150), 0);
  assert.equal(scaledMisses(1, 150), 3);
  assert.equal(scaledMisses(2, 150), 6);
  assert.equal(scaledMisses(2, 1500), 2);
  assert.equal(scaledMisses(1, 3000), 1);
  assert.equal(scaledMisses(2, 3000), 1);
  assert.equal(scaledMisses(3, 3000), 2);
});

test("misses earn the share of what they count as", () => {
  const at = (m: number) => shareForMisses(m);
  assert.equal(expShare("A+", 1, 150), at(3)); // counts as 3
  assert.equal(expShare("A", 2, 150), at(6)); // counts as 6
  assert.equal(expShare("A+", 1, 500), at(2)); // counts as 2
  assert.equal(expShare("A+", 1, 1500), at(1)); // as it is
  assert.equal(expShare("A", 2, 3000), at(1)); // counts as 1
  assert.equal(expShare("A", 2, null), at(2)); // no count yet
  // Two misses on a 1,500 note map is the anchor every threshold reads.
  assert.equal(expShare("A", THRESHOLD_MISSES, 1500), THRESHOLD_SHARE);
});

test("full combos, 100% runs and clean passes are never scaled", () => {
  assert.equal(expShare("SSS", 0, 150), 120);
  assert.equal(expShare("SS", 0, 150), 100);
  assert.equal(expShare("S", 0, 150), 100);
});

test("the grade itself reads the real misses on any map", () => {
  assert.equal(gradeFor({ missCount: 1, isFc: false, isPerfect: false }), "A+");
  assert.equal(gradeFor({ missCount: 2, isFc: false, isPerfect: false }), "A");
});

test("a sloppier run never takes a personal best on accuracy alone", () => {
  // Both C-, which covers 21 to 30 misses: the 24 used to overwrite the 21.
  const clean = { gradeRank: 12, missCount: 21, accuracy: 97.15 };
  const sloppy = { gradeRank: 12, missCount: 24, accuracy: 98.34 };
  assert.ok(compareResults(clean, sloppy) < 0);
  assert.ok(compareResults(sloppy, clean) > 0);
  assert.equal(compareResults(clean, clean), 0);
});

/* ------------------------------------------------- the scale's own shape */

const byOrder = GRADE_RULES.slice().sort((a, b) => a.sortOrder - b.sortOrder);
const bands = byOrder.filter((g) => g.minMiss != null);
const plain = (missCount: number) => gradeFor({ missCount, isFc: false, isPerfect: false });

test("every grade has its own name and its own place in the order", () => {
  const names = GRADE_RULES.map((g) => g.grade);
  assert.equal(new Set(names).size, names.length, "two rules share a grade name");
  assert.deepEqual(
    byOrder.map((g) => g.sortOrder),
    byOrder.map((_, i) => i + 1),
    "sortOrder has to run 1..n with no gaps: it is what gradeRank stores",
  );
  assert.equal(GRADE_RULES.filter((g) => g.requiresPerfect).length, 1);
  assert.equal(GRADE_RULES.filter((g) => g.requiresFc).length, 1);
  // The two grades that are not about misses sit above every band that is.
  assert.ok(byOrder[0].requiresPerfect);
  assert.ok(byOrder[1].requiresFc);
});

test("the miss bands cover every misscount exactly once, in order", () => {
  assert.equal(bands[0].minMiss, 0, "the bands have to start at a clean pass");
  for (let i = 1; i < bands.length; i++) {
    assert.equal(
      bands[i].minMiss,
      (bands[i - 1].maxMiss ?? Infinity) + 1,
      bands[i].grade + " does not pick up where " + bands[i - 1].grade + " left off",
    );
  }
  assert.equal(bands[bands.length - 1].maxMiss, null, "the last band has to be open ended");

  for (let m = 0; m <= 400; m++) {
    const hit = bands.filter((b) => m >= b.minMiss! && (b.maxMiss == null || m <= b.maxMiss));
    assert.equal(hit.length, 1, m + " misses matched " + hit.length + " bands");
    assert.equal(plain(m), hit[0].grade, m + " misses graded as something else");
  }
});

test("a worse grade is never worth more, and every share fits the column", () => {
  for (let i = 1; i < byOrder.length; i++) {
    assert.ok(
      byOrder[i].expPercent <= byOrder[i - 1].expPercent,
      byOrder[i].grade + " is worth more than " + byOrder[i - 1].grade,
    );
  }
  // A full combo and a clean pass are deliberately level: holding the combo
  // is the nicer badge, not the better payout.
  assert.equal(expPercentFor("SS"), expPercentFor("S"));
  // Every band of misses is strictly worse than the band above it, or two
  // misscounts would be worth the same and the tail would flatten out.
  for (let i = 1; i < bands.length; i++) {
    assert.ok(
      bands[i].expPercent < bands[i - 1].expPercent,
      bands[i].grade + " is worth at least as much as " + bands[i - 1].grade,
    );
  }
  for (const g of GRADE_RULES) {
    assert.ok(g.expPercent > 0, g.grade + " earns nothing at all");
    // grade_rules.exp_percent is numeric(6, 3): under 1000, three decimals.
    assert.ok(g.expPercent < 1000, g.grade + " will not fit the column");
    assert.equal(
      Number(g.expPercent.toFixed(3)),
      g.expPercent,
      g.grade + " has more decimals than the column keeps",
    );
  }
});

test("a misscount osu! would never send still grades sensibly", () => {
  assert.equal(plain(Number.NaN), "S");
  assert.equal(plain(-5), "S", "a negative count must not fall through to Pass");
  assert.equal(plain(Number.POSITIVE_INFINITY), "S", "not finite, so read as clean");
  assert.equal(scaledMisses(-5, 150), 0);
  assert.equal(expShare("S", -5, 150), 100);
});

/* -------------------------------------------------- what a play is worth */

test("more misses never earn more EXP, on a map of any size", () => {
  for (const notes of [null, 100, 150, 300, 500, 1000, 1500, 3000, 9000]) {
    let last = Number.POSITIVE_INFINITY;
    for (let m = 0; m <= 300; m++) {
      const share = expShare(plain(m), m, notes);
      assert.ok(
        share <= last,
        m + " misses on " + notes + " notes earns more than " + (m - 1) + " did",
      );
      last = share;
    }
  }
});

test("the same misses on a longer map never earn less", () => {
  for (const m of [1, 2, 3, 5, 10, 25, 60, 150]) {
    let last = Number.NEGATIVE_INFINITY;
    for (const notes of [100, 150, 300, 500, 1000, 1500, 3000, 9000]) {
      const share = expShare(plain(m), m, notes);
      assert.ok(share >= last, m + " misses is worth less on " + notes + " notes");
      last = share;
    }
  }
});

test("a 1,500 note map is the one that pays the misscount as it stands", () => {
  for (let m = 0; m <= 200; m++) {
    assert.equal(expShare(plain(m), m, 1500), shareForMisses(m));
    // A map osu! has not given a count for is read the same way.
    assert.equal(expShare(plain(m), m, null), shareForMisses(m));
  }
});

test("EXP falls on a curve, not in the grade's steps", () => {
  // Every misscount is worth its own number, so two plays on one pack are
  // no longer worth the same for landing in the same band. That is what put
  // 36 and 52 misses on identical EXP on a profile.
  const inside = Array.from({ length: 25 }, (_, i) => shareForMisses(21 + i));
  assert.equal(new Set(inside).size, 25, "a band still pays one flat number");
  for (let i = 1; i < inside.length; i++) assert.ok(inside[i] < inside[i - 1]);

  // No cliff anywhere, at a band edge or inside one. Nothing like the old
  // table, where one more miss at the wrong moment halved a play.
  const drop = (m: number) => 1 - shareForMisses(m) / shareForMisses(m - 1);
  for (let m = 1; m <= 400; m++) {
    assert.ok(drop(m) < 0.17, "miss " + m + " costs " + (drop(m) * 100).toFixed(1) + "%");
  }
  assert.ok(drop(400) > 0.04, "the tail should keep falling, not flatten out");
});

test("each miss costs more than the last, until there is nothing left", () => {
  // The flat fall was the whole problem: every miss cost the same share of
  // what was left, so thirty misses and fifty were only a third apart, and
  // a map survived rather than cleared still paid like a clear.
  const drop = (m: number) => 1 - shareForMisses(m) / shareForMisses(m - 1);
  assert.ok(drop(40) > drop(20), "a fortieth miss should cost more than a twentieth");
  assert.ok(drop(20) > drop(10), "a twentieth miss should cost more than a tenth");
  // Past the cap it levels off: the share is already near nothing, and it
  // still has to keep falling so two hopeless passes never tie.
  assert.ok(drop(MISS_ACCEL_CAP + 1) < drop(MISS_ACCEL_CAP));
  assert.ok(shareForMisses(MISS_ACCEL_CAP) < 0.5, "the cap should sit where nothing is left");
  assert.ok(MISS_ACCEL > 0, "without this the fall is flat again");

  // Thirty misses against fifty: an order of magnitude apart, not a third.
  assert.ok(shareForMisses(30) / shareForMisses(50) > 8);
});

test("the curve is anchored where the pack thresholds read it", () => {
  assert.equal(shareForMisses(0), 100);
  assert.equal(shareForMisses(THRESHOLD_MISSES), THRESHOLD_SHARE);
  // Nonsense in, a clean clear out, rather than something off the bottom.
  assert.equal(shareForMisses(-4), 100);
  assert.equal(shareForMisses(Number.NaN), 100);
  // The knee and the slope are the two numbers Kayrem retunes.
  assert.ok(MISS_KNEE > 0 && MISS_SLOPE > 0);

  // Clean play is where Kayrem drew the line, so the first dozen misses are
  // still worth about what the hand written table paid them.
  const was: Array<[number, number]> = [[1, 85], [2, 75], [3, 65], [6, 50], [9, 44], [13, 36]];
  for (const [m, before] of was) {
    const now = shareForMisses(m);
    assert.ok(Math.abs(now - before) < 6, m + " misses moved from " + before + " to " + now);
  }
  // Past that it collapses: a map survived rather than cleared pays nothing
  // like a clear, which is what two rounds of feedback were about.
  assert.ok(shareForMisses(36) < 5, "36 misses still earns " + shareForMisses(36) + "%");
  assert.ok(shareForMisses(52) < 1, "52 misses still earns " + shareForMisses(52) + "%");
  assert.ok(shareForMisses(150) < 0.01, "150 misses still earns " + shareForMisses(150) + "%");
});

test("the share beside a grade is the most that grade pays", () => {
  assert.equal(expPercentFor("SSS"), 120);
  assert.equal(expPercentFor("SS"), 100);
  assert.equal(expPercentFor("S"), 100);
  for (const g of bands) {
    assert.equal(g.expPercent, Math.round(shareForMisses(g.minMiss!) * 1000) / 1000);
    // Where a band covers more than one misscount, the rest of it pays less.
    if (g.maxMiss != null && g.maxMiss > g.minMiss!) {
      assert.ok(shareForMisses(g.maxMiss) < g.expPercent, g.grade + " is flat across its band");
    }
  }
  // A label the team has dropped earns nothing rather than throwing.
  assert.equal(expPercentFor("Flow"), 0);
});

/* ------------------------------------------- picking between two results */

const result = (gradeRank: number, missCount: number, accuracy: number | null) => ({
  gradeRank, missCount, accuracy,
});

test("compareResults reads grade, then misses, then accuracy, in that order", () => {
  // A better grade wins however bad everything else is.
  assert.ok(compareResults(result(5, 99, 10), result(6, 0, 100)) < 0);
  // Inside one grade the misscount decides, whatever accuracy says.
  assert.ok(compareResults(result(12, 21, 97.15), result(12, 24, 98.34)) < 0);
  assert.ok(compareResults(result(12, 24, 98.34), result(12, 21, 97.15)) > 0);
  // Accuracy only breaks an equal misscount.
  assert.ok(compareResults(result(12, 21, 99), result(12, 21, 97)) < 0);
  assert.equal(compareResults(result(12, 21, 97), result(12, 21, 97)), 0);
  // A stored score with no accuracy loses the tie rather than winning it.
  assert.ok(compareResults(result(12, 21, null), result(12, 21, 0.01)) > 0);
  assert.equal(compareResults(result(12, 21, null), result(12, 21, null)), 0);
});

test("compareResults is a real ordering, so a sort cannot loop", () => {
  const all = [];
  for (const g of [3, 8, 12]) {
    for (const m of [0, 7, 21, 24]) {
      for (const a of [null, 90, 98.34]) all.push(result(g, m, a));
    }
  }
  for (const a of all) {
    for (const b of all) {
      // Summed rather than compared: Object.is tells 0 from -0 apart.
      assert.equal(
        Math.sign(compareResults(a, b)) + Math.sign(compareResults(b, a)),
        0,
        "not antisymmetric",
      );
      for (const c of all) {
        if (compareResults(a, b) <= 0 && compareResults(b, c) <= 0) {
          assert.ok(compareResults(a, c) <= 0, "not transitive");
        }
      }
    }
  }
});

test("a whole board sorts the way a map page is meant to read", () => {
  const board = [
    { id: "7 miss, best accuracy", ...result(8, 7, 98.34) },
    { id: "6 miss", ...result(8, 6, 97.15) },
    { id: "full combo", ...result(2, 0, 99.1) },
    { id: "6 miss, worse accuracy", ...result(8, 6, 95.0) },
    { id: "24 miss", ...result(12, 24, 99.9) },
  ];
  assert.deepEqual(
    board.slice().sort(compareResults).map((r) => r.id),
    ["full combo", "6 miss", "6 miss, worse accuracy", "7 miss, best accuracy", "24 miss"],
  );
});

test("a personal best is only taken by something actually better", () => {
  const held = result(12, 21, 97.15);
  const beats = (r: typeof held) => compareResults(r, held) < 0;
  assert.ok(!beats(result(12, 24, 98.34)), "the 24 miss run overwrote the 21 again");
  assert.ok(!beats(result(12, 21, 97.15)), "the same result is not an improvement");
  assert.ok(!beats(result(13, 31, 99.99)), "a worse grade is not an improvement");
  assert.ok(beats(result(12, 20, 10)), "fewer misses is an improvement");
  assert.ok(beats(result(11, 21, 97.15)), "a better grade is an improvement");
  assert.ok(beats(result(12, 21, 97.16)), "accuracy still splits an equal misscount");
});
