/**
 * Run with: node --import tsx --test src/lib/discord/gateway.test.ts
 *
 * What the connection answers to each frame. Nothing here opens a socket.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  DISPATCH, HEARTBEAT, HEARTBEAT_ACK, HELLO, IDENTIFY, INVALID_SESSION, RECONNECT,
  backoff, handle, identify, isFatal,
} from "./gateway";

const react = (frame: Parameters<typeof handle>[0], sequence: number | null = null) =>
  handle(frame, "tok", "the ladder", sequence);

test("the opening frame asks for no intents and a presence to show", () => {
  const { op, d } = identify("tok", "the ladder");
  const body = d as {
    token: string;
    intents: number;
    presence: { status: string; activities: Array<{ name: string; type: number }> };
  };
  assert.equal(op, IDENTIFY);
  assert.equal(body.token, "tok");
  // No events are wanted, so no intent is asked for and none can be refused.
  assert.equal(body.intents, 0);
  assert.equal(body.presence.status, "online");
  assert.deepEqual(body.presence.activities, [{ name: "the ladder", type: 3 }]);
});

test("hello sets the heartbeat and opens the session", () => {
  const r = react({ op: HELLO, d: { heartbeat_interval: 41250 } });
  assert.equal(r.heartbeatMs, 41250);
  assert.equal(r.send?.op, IDENTIFY);
});

test("a heartbeat Discord asks for carries the last sequence seen", () => {
  assert.deepEqual(react({ op: HEARTBEAT }, 7).send, { op: HEARTBEAT, d: 7 });
  // Before any dispatch there is no sequence, which Discord takes as null.
  assert.deepEqual(react({ op: HEARTBEAT }, null).send, { op: HEARTBEAT, d: null });
});

test("an ack is what lets the next heartbeat go out", () => {
  assert.equal(react({ op: HEARTBEAT_ACK }).acked, true);
});

test("both ways Discord drops a session ask for a reconnect", () => {
  assert.equal(react({ op: RECONNECT }).reconnect, true);
  assert.equal(react({ op: INVALID_SESSION }).reconnect, true);
});

test("ready is the only dispatch that means anything here", () => {
  assert.equal(react({ op: DISPATCH, t: "READY" }).ready, true);
  assert.deepEqual(react({ op: DISPATCH, t: "MESSAGE_CREATE" }), {});
});

test("a refused token is not retried, a dropped connection is", () => {
  assert.equal(isFatal(4004), true, "authentication failed");
  assert.equal(isFatal(4014), true, "disallowed intents");
  assert.equal(isFatal(1006), false, "connection lost");
  assert.equal(isFatal(1000), false, "closed cleanly");
  assert.equal(isFatal(4000), false, "unknown error");
});

test("waiting doubles between tries and stops at half a minute", () => {
  const flat = (n: number) => backoff(n, 0.5);
  assert.deepEqual([1, 2, 3, 4].map(flat), [1000, 2000, 4000, 8000]);
  assert.equal(flat(20), 30_000);
  // Jitter keeps a crowd of reconnects from landing together.
  assert.ok(backoff(4, 0) < backoff(4, 1));
});
