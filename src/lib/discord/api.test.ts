/**
 * Run with: node --import tsx --test src/lib/discord/api.test.ts
 *
 * How an announcement reaches Discord. Nothing here calls out: fetch is
 * replaced, and the test reads what would have been sent.
 */
import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";

const { postChannel } = await import("./api");

type Call = { url: string; init: RequestInit };

/** Stands in for fetch and keeps every call, answering with one status. */
function capture(t: TestContext, status = 200): Call[] {
  const calls: Call[] = [];
  t.mock.method(globalThis, "fetch", async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response("nope", { status });
  });
  return calls;
}

const body = (c: Call) => JSON.parse(String(c.init.body));

test("an announcement is posted to the channel as the bot", async (t) => {
  process.env.DISCORD_BOT_TOKEN = "tok";
  const calls = capture(t);

  await postChannel("123", { embeds: [{ title: "Ghost [Extra]" }] });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://discord.com/api/v10/channels/123/messages");
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bot tok");
  assert.equal(body(calls[0]).embeds[0].title, "Ghost [Extra]");
  // No map title or username can ping the channel.
  assert.deepEqual(body(calls[0]).allowed_mentions, { parse: [] });
});

test("nothing is sent until a channel and a token are both set", async (t) => {
  const calls = capture(t);

  process.env.DISCORD_BOT_TOKEN = "tok";
  await postChannel(undefined, { content: "x" });
  delete process.env.DISCORD_BOT_TOKEN;
  await postChannel("123", { content: "x" });

  assert.equal(calls.length, 0);
});

test("more embeds than Discord takes at once are split across messages", async (t) => {
  process.env.DISCORD_BOT_TOKEN = "tok";
  const calls = capture(t);

  await postChannel("123", {
    embeds: Array.from({ length: 23 }, (_, i) => ({ title: "e" + i })),
  });

  assert.deepEqual(calls.map((c) => body(c).embeds.length), [10, 10, 3]);
});

test("a channel the bot cannot post in is logged rather than thrown", async (t) => {
  process.env.DISCORD_BOT_TOKEN = "tok";
  capture(t, 403);
  const logged: string[] = [];
  t.mock.method(console, "error", (...a: unknown[]) => void logged.push(String(a[0])));

  await postChannel("123", { content: "x" });

  assert.equal(logged.length, 1);
  assert.match(logged[0], /403/);
});
