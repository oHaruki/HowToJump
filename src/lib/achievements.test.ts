/**
 * Run with: node --import tsx --test src/lib/achievements.test.ts
 *
 * Covers the achievement rules: each pack's six marks and when they were
 * reached, the grade lines they draw, the speed medals' bands, Grief, 727,
 * and which were reached since a given moment.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { achievements, reachedSince, type MedalPlay } from "./achievements";
import { tierByName } from "./tiers";

const order = (name: string) => tierByName(name)!.order;
const day = (d: number) => new Date(Date.UTC(2026, 9, d));

let next = 1;
function play(pack: string, grade: string, extra: Partial<MedalPlay> = {}): MedalPlay {
  const at = day(next++);
  return {
    tierOrder: order(pack),
    grade,
    speedBucket: null,
    maxCombo: null,
    createdAt: at,
    importedAt: at,
    ...extra,
  };
}

const byId = (states: ReturnType<typeof achievements>, id: string) => {
  const s = states.find((x) => x.id === id);
  assert.ok(s, "no achievement " + id);
  return s;
};

test("each pack has six marks, named the way the team calls them", () => {
  const states = achievements([], new Map([[order("Ruby"), 4]]));
  const ruby = states.filter((s) => s.group === "pack");
  assert.deepEqual(ruby.map((s) => s.name), [
    "Ruby Pass", "Ruby", "True Ruby", "Ruby+", "True Ruby+", "Perfect Ruby",
  ]);
  assert.ok(ruby.every((s) => s.at === null && s.have === 0));
  assert.deepEqual(ruby.map((s) => s.need), [1, 2, 4, 2, 4, 4]);
});

test("a pack with no maps has no marks", () => {
  const states = achievements([play("Ruby", "A")], new Map([[order("Ruby"), 0]]));
  assert.equal(states.filter((s) => s.group === "pack").length, 0);
});

test("passes reach a pack's marks in turn, each dated by the pass that completed it", () => {
  next = 1;
  const plays = [play("Ruby", "C"), play("Ruby", "B-"), play("Ruby", "A+"), play("Topaz", "SS")];
  const states = achievements(plays, new Map([[order("Ruby"), 5], [order("Topaz"), 3]]));
  assert.equal(byId(states, "pack-ruby-pass").at?.getTime(), day(1).getTime());
  // Half of five is three.
  assert.equal(byId(states, "pack-ruby-tier").at?.getTime(), day(3).getTime());
  assert.equal(byId(states, "pack-ruby-true").at, null);
  assert.equal(byId(states, "pack-ruby-true").have, 3);
  // The C misses the B- line, so only two of the three needed are in.
  assert.equal(byId(states, "pack-ruby-plus").at, null);
  assert.equal(byId(states, "pack-ruby-plus").have, 2);
  assert.equal(byId(states, "pack-topaz-pass").at?.getTime(), day(4).getTime());
});

test("plus marks count B- and up, Perfect needs a full combo on every map", () => {
  next = 1;
  const plays = [play("Gold", "B-"), play("Gold", "SSS"), play("Gold", "SS")];
  const states = achievements(plays, new Map([[order("Gold"), 3]]));
  assert.ok(byId(states, "pack-gold-trueplus").at);
  assert.equal(byId(states, "pack-gold-perfect").at, null);
  assert.equal(byId(states, "pack-gold-perfect").have, 2);

  const all = achievements([play("Gold", "SS"), play("Gold", "SS"), play("Gold", "SSS")], new Map([[order("Gold"), 3]]));
  assert.ok(byId(all, "pack-gold-perfect").at);
});

test("a pass is dated from when the map was first passed, a better result from when it landed", () => {
  const first = play("Iron", "D", { createdAt: day(2), importedAt: day(9) });
  const states = achievements([first], new Map([[order("Iron"), 2]]));
  assert.equal(byId(states, "pack-iron-pass").at?.getTime(), day(2).getTime());
});

test("speed medals take a full combo at that speed in their band of four packs", () => {
  const snail = play("Bronze", "SS", { speedBucket: "Very low" });
  const notSloth = play("Silver", "S", { speedBucket: "Very low" });
  const cheetah = play("GOAT", "SSS", { speedBucket: "Extreme+" });
  const fox = play("Titanium", "SS", { speedBucket: "extreme" });
  const states = achievements([snail, notSloth, cheetah, fox], new Map());
  assert.ok(byId(states, "speed-snail").at);
  assert.equal(byId(states, "speed-sloth").at, null);
  assert.ok(byId(states, "speed-cheetah").at);
  assert.ok(byId(states, "speed-fox").at);
  assert.equal(byId(states, "speed-rabbit").at, null);
  assert.equal(byId(states, "speed-snail").rule, "Full combo a Very low speed map from Stone to Bronze");
});

test("Grief takes A- or higher on GOAT only, and 727 takes a combo of exactly 727", () => {
  const states = achievements(
    [play("GOAT", "B+"), play("Diamond", "SS"), play("Emerald", "A", { maxCombo: 726 })],
    new Map(),
  );
  assert.equal(byId(states, "special-grief").at, null);
  assert.equal(byId(states, "special-727").at, null);

  const won = achievements([play("GOAT", "A-"), play("Copper", "C", { maxCombo: 727 })], new Map());
  assert.ok(byId(won, "special-grief").at);
  assert.ok(byId(won, "special-727").at);
});

test("reached since lists only what came after the moment, oldest first", () => {
  next = 1;
  const plays = [play("Stone", "A"), play("Stone", "A"), play("Stone", "A")];
  const states = achievements(plays, new Map([[order("Stone"), 3]]));
  const since = reachedSince(states, day(2));
  assert.deepEqual(since.map((s) => s.name), ["True Stone", "True Stone+"]);
  assert.deepEqual(reachedSince(states, day(1)).map((s) => s.name), ["Stone", "Stone+", "True Stone", "True Stone+"]);
});
