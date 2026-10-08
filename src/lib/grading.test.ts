/**
 * Run with: node --import tsx --test src/lib/grading.test.ts
 *
 * Misses by map size: a map of 1,000 to 1,600 notes counts as it is,
 * shorter maps make each miss count more, and only the EXP moves.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CLEAN_SHARE, GRADE_RULES, LONG_NOTES, MIN_MISS_FACTOR, SHORT_NOTES, accuracyCredit,
  compareResults, expPercentFor, expShare, explainShare, gradeFor, gradeRank, missFactor,
  scaledMisses, shareForMisses,
} from "./grading";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.01, a + " is not " + b);

test("a map of 1,000 to 1,600 notes counts ×1, a 150 note map about ×2.6", () => {
  assert.equal(missFactor(SHORT_NOTES), 1);
  assert.equal(missFactor(1300), 1);
  assert.equal(missFactor(LONG_NOTES), 1);
  near(missFactor(150), 2.58);
  near(missFactor(500), 1.41);
  near(missFactor(2000), 0.89);
  // A map osu! has not given a count for yet counts as it always did.
  assert.equal(missFactor(null), 1);
  assert.equal(missFactor(0), 1);
});

test("a long map forgives a miss by a fifth at most, however long it runs", () => {
  assert.equal(missFactor(3000), MIN_MISS_FACTOR);
  assert.equal(missFactor(6000), MIN_MISS_FACTOR);
  assert.equal(missFactor(100_000), MIN_MISS_FACTOR);
  assert.ok(MIN_MISS_FACTOR < 1, "a long map should still forgive something");

  // Short maps are untouched by the floor.
  assert.ok(missFactor(150) > 2.5);
  assert.ok(missFactor(500) > 1.4);

  // Nothing between the two ends jumps: the factor only ever eases off.
  let last = Number.POSITIVE_INFINITY;
  for (let notes = 50; notes <= 20_000; notes += 25) {
    const f = missFactor(notes);
    assert.ok(f <= last + 1e-12, "the factor rose at " + notes + " notes");
    last = f;
  }
});

test("scaled misses keep their fraction, and a miss never counts as less than one", () => {
  assert.equal(scaledMisses(0, 150), 0);
  near(scaledMisses(1, 150), 2.58);
  near(scaledMisses(2, 150), 5.16);
  assert.equal(scaledMisses(3, 250), 6);
  assert.equal(scaledMisses(2, 1500), 2);
  assert.equal(scaledMisses(1, 3000), 1);
  near(scaledMisses(2, 3000), 1.6);
  near(scaledMisses(3, 3000), 2.4);
  // A map long enough to hit the floor forgives a fifth, and no more.
  assert.equal(scaledMisses(30, 6000), 24);
  assert.equal(scaledMisses(30, 60_000), 24);
});

test("a pack's weight scales misses on top of the map's length", () => {
  assert.equal(scaledMisses(40, 1500, 0.75), 30);
  near(scaledMisses(4, 250, 0.75), 6); // 4 × 2 × 0.75
  near(scaledMisses(40, 6000, 0.75), 24); // 40 × 0.8 × 0.75
  // Never below one, whatever the weight.
  assert.equal(scaledMisses(1, 1500, 0.75), 1);
  assert.equal(scaledMisses(1, 6000, 0.75), 1);
  assert.equal(scaledMisses(0, 1500, 0.75), 0);
  // A weight of one leaves the count as it was.
  assert.equal(scaledMisses(7, 719, 1), scaledMisses(7, 719));
});

test("misses earn the share of what they count as", () => {
  const at = (m: number) => shareForMisses(m);
  near(expShare("A+", 1, 150), at(Math.sqrt(1000 / 150))); // counts as 2.58
  assert.equal(expShare("A-", 3, 250), at(6)); // counts as 6
  near(expShare("A+", 1, 500), at(Math.SQRT2)); // counts as 1.41
  assert.equal(expShare("A+", 1, 1500), at(1)); // as it is
  near(expShare("A", 2, 3000), at(1.6)); // a long map forgives a fifth
  assert.equal(expShare("A", 2, null), at(2)); // no count yet
});

test("full combos, 100% runs and clean passes are never scaled", () => {
  assert.equal(expShare("SSS", 0, 150), 120);
  assert.equal(expShare("SS", 0, 150), 100);
  assert.equal(expShare("S", 0, 150), CLEAN_SHARE);
});

test("the grade itself reads the real misses on any map", () => {
  assert.equal(gradeFor({ missCount: 1, isFc: false, isPerfect: false }), "A+");
  assert.equal(gradeFor({ missCount: 2, isFc: false, isPerfect: false }), "A");
});

test("a sloppier run never takes a personal best on accuracy alone", () => {
  // Both C-, which covers 21 to 30 misses, so the misscount settles it.
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
  // A clean pass that broke the combo starts below a full combo.
  assert.equal(expPercentFor("S"), CLEAN_SHARE);
  assert.ok(expPercentFor("S") < expPercentFor("SS"));
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
  assert.equal(expShare("S", -5, 150), CLEAN_SHARE);
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

test("a map of 1,000 to 1,600 notes pays the misscount as it stands", () => {
  for (let m = 0; m <= 200; m++) {
    for (const notes of [SHORT_NOTES, 1500, LONG_NOTES]) {
      assert.equal(expShare(plain(m), m, notes), shareForMisses(m));
    }
    // A map osu! has not given a count for is read the same way.
    assert.equal(expShare(plain(m), m, null), shareForMisses(m));
  }
});

test("EXP falls on a curve, not in the grade's steps", () => {
  // Every misscount is worth its own number, so two plays in one band are
  // not worth the same.
  const inside = Array.from({ length: 25 }, (_, i) => shareForMisses(21 + i));
  assert.equal(new Set(inside).size, 25, "a band still pays one flat number");
  for (let i = 1; i < inside.length; i++) assert.ok(inside[i] < inside[i - 1]);

  // No cliff anywhere, at a band edge or inside one.
  const drop = (m: number) => 1 - shareForMisses(m) / shareForMisses(m - 1);
  for (let m = 1; m <= 400; m++) {
    assert.ok(drop(m) < 0.17, "miss " + m + " costs " + (drop(m) * 100).toFixed(1) + "%");
  }
  // It keeps falling, so two hopeless passes never tie.
  assert.ok(shareForMisses(400) < shareForMisses(399));
});

test("the first misses cost the most, and the tail forgives", () => {
  const drop = (m: number) => 1 - shareForMisses(m) / shareForMisses(m - 1);
  assert.ok(drop(1) > drop(10), "a first miss should cost more than a tenth");
  assert.ok(drop(10) > drop(40), "a tenth miss should cost more than a fortieth");
});

test("the curve starts at a clean pass and pays the agreed table", () => {
  assert.equal(shareForMisses(0), CLEAN_SHARE);
  // Nonsense in, a clean pass out.
  assert.equal(shareForMisses(-4), CLEAN_SHARE);
  assert.equal(shareForMisses(Number.NaN), CLEAN_SHARE);

  const table: Array<[number, number]> = [[1, 81.2], [2, 73.3], [10, 35.1], [30, 8.3]];
  for (const [m, share] of table) {
    const now = shareForMisses(m);
    assert.ok(Math.abs(now - share) < 0.05, m + " misses pays " + now + ", not " + share);
  }
  // Under 1% from 74 misses.
  assert.ok(shareForMisses(73) >= 1, "73 misses already pays under 1%");
  assert.ok(shareForMisses(74) < 1, "74 misses still pays " + shareForMisses(74) + "%");
});

test("the share beside a grade is the most that grade pays before accuracy", () => {
  assert.equal(expPercentFor("SSS"), 120);
  assert.equal(expPercentFor("SS"), 100);
  assert.equal(expPercentFor("S"), CLEAN_SHARE);
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

/* ------------------------------------------------ what accuracy wins back */

test("accuracy wins back almost nothing below 90%, and most of a miss past 96%", () => {
  assert.equal(accuracyCredit(null), 0);
  assert.equal(accuracyCredit(Number.NaN), 0);
  assert.equal(accuracyCredit(0), 0);
  assert.equal(accuracyCredit(100), 1);
  assert.equal(accuracyCredit(104), 1);
  near(accuracyCredit(90), 0.08);
  near(accuracyCredit(96), 0.375);
  near(accuracyCredit(99), 0.786);

  // Per point of accuracy, 96 to 100 is worth far more than 90 to 96, and
  // that far more than anything below 90.
  const rate = (from: number, to: number) => (accuracyCredit(to) - accuracyCredit(from)) / (to - from);
  assert.ok(rate(96, 100) > 3 * rate(90, 96));
  assert.ok(rate(90, 96) > 3 * rate(80, 90));

  let last = -1;
  for (let a = 0; a <= 100; a += 0.25) {
    assert.ok(accuracyCredit(a) > last || accuracyCredit(a) === 0, "credit fell at " + a + "%");
    last = accuracyCredit(a);
  }
});

test("a full combo climbs to the 100% run's share, and a clean pass to a full combo's", () => {
  assert.equal(expShare("SS", 0, 1500), 100);
  assert.equal(expShare("SS", 0, 1500, null), 100);
  near(expShare("SS", 0, 1500, 97), 109.17);
  near(expShare("SS", 0, 1500, 100), 120);
  assert.ok(expShare("SS", 0, 1500, 99.99) < 120);
  // Map length never touches a full combo.
  assert.equal(expShare("SS", 0, 150, 97), expShare("SS", 0, 3000, 97));

  // A clean pass that dropped the combo climbs from CLEAN_SHARE toward 100.
  assert.equal(expShare("S", 0, 1500), CLEAN_SHARE);
  near(expShare("S", 0, 1500, 97), CLEAN_SHARE * Math.pow(100 / CLEAN_SHARE, accuracyCredit(97)));
  assert.ok(expShare("S", 0, 1500, 99.5) > CLEAN_SHARE);
  assert.ok(expShare("S", 0, 1500, 99.5) < expShare("SS", 0, 1500, 80));
  assert.equal(expShare("S", 0, 150, 97), expShare("S", 0, 3000, 97));
});

test("accuracy lifts a play with misses, by at most one counted miss", () => {
  const plainAt = (m: number, notes: number | null, acc: number | null) =>
    expShare(plain(m), m, notes, acc);
  assert.ok(plainAt(2, 1500, 97) > plainAt(2, 1500, null));
  near(plainAt(2, 1500, 97), shareForMisses(2 - accuracyCredit(97)));
  // On a short map a miss counts as 2.58, and accuracy still wins back only one.
  near(plainAt(1, 150, 99), shareForMisses(Math.sqrt(1000 / 150) - accuracyCredit(99)));
  // On a long map it wins back at most the real miss, which counts for less.
  near(plainAt(3, 3000, 99), shareForMisses(2.4 - 0.8 * accuracyCredit(99)));
});

/** The best accuracy a play with these misses can have: every other note a 300. */
const bestAccuracy = (missCount: number, notes: number | null) =>
  missCount === 0 ? 100 : (((notes ?? 1500) - missCount) / (notes ?? 1500)) * 100;

test("one miss fewer always pays more, whatever the accuracy", () => {
  for (const notes of [null, 60, 100, 150, 300, 375, 500, 700, 1000, 1500, 2000, 2344, 3000, 9000]) {
    for (let m = 1; m <= 200 && m < (notes ?? 1500); m++) {
      const best = expShare(plain(m), m, notes, bestAccuracy(m, notes));
      const worst = expShare(plain(m - 1), m - 1, notes, 0);
      assert.ok(
        best < worst,
        m + " misses at its best on " + notes + " notes pays " + best + ", one fewer at 0% " + worst,
      );
    }
  }
});

test("a result the site ranks higher never pays less, so a best score never loses EXP", () => {
  // Every result on one map, the way upsertScore and the boards compare them.
  const notes = 1500;
  const results: Array<{ gradeRank: number; missCount: number; accuracy: number; share: number }> = [];
  const add = (grade: string, missCount: number, accuracy: number) =>
    results.push({ gradeRank: gradeRank(grade), missCount, accuracy, share: expShare(grade, missCount, notes, accuracy) });
  add("SSS", 0, 100);
  for (const a of [80, 90, 95, 97, 99, 99.9]) {
    add("SS", 0, a);
    add("S", 0, a);
  }
  for (let m = 1; m <= 60; m++) {
    for (const a of [70, 85, 92, 96, 98, 99.5]) {
      if (a <= bestAccuracy(m, notes)) add(plain(m), m, a);
    }
  }
  for (const better of results) {
    for (const worse of results) {
      if (compareResults(better, worse) < 0) {
        assert.ok(
          better.share >= worse.share,
          JSON.stringify(better) + " is ranked above " + JSON.stringify(worse) + " but pays less",
        );
      }
    }
  }
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

test("the steps behind a share are the ones the share is worked from", () => {
  // Two misses on a 250 note map count as four; 99% wins back most of one.
  const short = explainShare("A", 2, 250, 99);
  assert.equal(short.kind, "misses");
  if (short.kind !== "misses") return;
  assert.equal(short.factor, 2);
  assert.equal(short.counted, 4);
  near(short.wonBack, accuracyCredit(99));
  near(short.share, shareForMisses(4 - accuracyCredit(99)));

  // One miss on a long map is floored at one, and still wins back its accuracy.
  const long = explainShare("A+", 1, 6000, 98);
  assert.ok(long.kind === "misses" && long.counted === 1 && long.factor === MIN_MISS_FACTOR);

  // No accuracy wins nothing back.
  const unknown = explainShare("A", 2, 1500, null);
  assert.ok(unknown.kind === "misses" && unknown.wonBack === 0);

  // No misses climbs from a clean pass, a full combo from 100.
  const clean = explainShare("S", 0, 1500, 97);
  assert.ok(clean.kind === "clean" && clean.base === CLEAN_SHARE && clean.credit === accuracyCredit(97));
  assert.deepEqual(explainShare("SSS", 0, 800, 100), { kind: "perfect", share: 120 });
  const fc = explainShare("SS", 0, 800, 99);
  assert.ok(fc.kind === "fc" && fc.base === 100 && fc.credit === accuracyCredit(99));
});

test("a pack's weight is a step of its own, after the map's length", () => {
  // Forty misses on a 1,500 note map, on a pack that counts a miss as 0.75.
  const weighted = explainShare("D+", 40, 1500, null, 0.75);
  assert.equal(weighted.kind, "misses");
  if (weighted.kind !== "misses") return;
  assert.equal(weighted.factor, 1);
  assert.equal(weighted.weight, 0.75);
  assert.equal(weighted.counted, 30);
  assert.equal(weighted.share, shareForMisses(30));

  // Accuracy wins back part of the last miss as it counts there.
  const accurate = explainShare("D+", 40, 1500, 99, 0.75);
  assert.ok(accurate.kind === "misses");
  if (accurate.kind !== "misses") return;
  near(accurate.wonBack, 0.75 * accuracyCredit(99));

  // Full combos, 100% runs and clean passes are not weighted.
  assert.equal(expShare("SSS", 0, 1500, null, 0.75), 120);
  assert.equal(expShare("SS", 0, 1500, null, 0.75), 100);
  assert.equal(expShare("S", 0, 1500, null, 0.75), CLEAN_SHARE);
});

test("every explained share is the share the levels are paid", () => {
  for (const grade of ["SSS", "SS", "S", "A+", "A", "B", "C-", "Pass"]) {
    for (const misses of [0, 1, 2, 5, 24, 150]) {
      for (const notes of [null, 190, 719, 1500, 6000]) {
        for (const acc of [null, 88.5, 96.7, 99.9, 100]) {
          for (const weight of [1, 0.75]) {
            assert.equal(
              explainShare(grade, misses, notes, acc, weight).share,
              expShare(grade, misses, notes, acc, weight),
            );
          }
        }
      }
    }
  }
});
