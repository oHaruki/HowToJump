/**
 * Run with: node --import tsx --test src/lib/queries.test.ts
 *
 * That the SQL orders a board by the misscount, and that listing a board
 * and the row_number placing one player in it say the same thing.
 *
 * Nothing here connects: toSQL renders a query without running it.
 */
import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://unused:unused@127.0.0.1:5432/unused";

const { boardOrder, boardRank, BOARD_ORDER_TEXT } = await import("./queries");
const { db } = await import("./db");
const { scores } = await import("./schema");

/** The columns an order by names, in the order it names them. */
function ordering(sql: string): string[] {
  const clause = sql.slice(sql.lastIndexOf("order by"));
  return [...clause.matchAll(/"[a-z_]+"\."([a-z_]+)"/g)].map((m) => m[1]);
}

/** Grade, then the misscount, then accuracy, then who got there first. */
const EXPECTED = ["grade_rank", "miss_count", "accuracy", "played_at", "id"];

const listed = db.select().from(scores).orderBy(boardOrder).toSQL().sql;
const ranked = db.select({ rank: boardRank }).from(scores).toSQL().sql;

test("a map's board is ordered by grade, then the misscount, then accuracy", () => {
  assert.deepEqual(ordering(listed), EXPECTED);
});

test("the misscount is read ascending, so the cleaner run stands above", () => {
  const clause = listed.slice(listed.lastIndexOf("order by"));
  const misses = clause.indexOf('"miss_count"');
  assert.ok(misses > 0, "the board does not order by the misscount at all");
  // Nothing between the misscount and the next column, so it sorts ascending:
  // a direction would have to be spelled out to land anywhere else.
  assert.match(clause.slice(misses), /^"miss_count",/);
  assert.match(clause, /"accuracy" desc nulls last/);
  assert.match(clause, /"played_at" asc nulls last/);
});

test("the row_number that places one player reads that same order", () => {
  assert.match(ranked, /row_number\(\) over \(order by /);
  assert.deepEqual(ordering(ranked), EXPECTED);
});

test("the caption over a board names everything the SQL orders by", () => {
  // The caption said "grade first, then accuracy" for a whole commit after
  // the misscount went into the order by. Every column the SQL sorts on has
  // to show up in the sentence players read above the table.
  const inWords: Record<string, string> = {
    grade_rank: "grade",
    miss_count: "misscount",
    accuracy: "accuracy",
    played_at: "set it first",
    id: "set it first",
  };
  const caption = BOARD_ORDER_TEXT.toLowerCase();
  for (const column of ordering(listed)) {
    const word = inWords[column];
    assert.ok(word, "no wording is defined for " + column);
    assert.ok(caption.includes(word), "the caption never mentions " + column);
  }
});

test("the list and the placing are built from one fragment, not two copies", () => {
  const clause = (sql: string) => sql.slice(sql.lastIndexOf("order by") + "order by".length);
  // Rendered from the same SQL object, so a change to one is a change to both.
  assert.equal(clause(listed).trim(), clause(ranked).replace(/\)\)::int.*$/s, "").trim());
});
