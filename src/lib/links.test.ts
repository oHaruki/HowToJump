/**
 * Run with: node --import tsx --test src/lib/links.test.ts
 *
 * A staff member's links: what is kept, and which site each one is on.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { linkKind, normalizeLink } from "./links";

test("a link without a scheme is kept as https", () => {
  assert.equal(normalizeLink("  x.com/kayrem "), "https://x.com/kayrem");
  assert.equal(normalizeLink("https://www.youtube.com/@kayrem"), "https://www.youtube.com/@kayrem");
  assert.equal(normalizeLink("http://kayrem.carrd.co"), "http://kayrem.carrd.co/");
});

test("anything that isn't a web address is turned away", () => {
  for (const bad of [
    "",
    "   ",
    "javascript:alert(1)",
    "data:text/html,hi",
    "mailto:me@example.com",
    "localhost",
    "not a link",
    "https://user:pass@example.com",
    "https://" + "a".repeat(200) + ".com",
  ]) {
    assert.equal(normalizeLink(bad), null, bad);
  }
});

test("a link on a known site gets its icon, whatever the subdomain", () => {
  assert.deepEqual(linkKind("https://x.com/kayrem"), { icon: "x", name: "Twitter" });
  assert.deepEqual(linkKind("https://twitter.com/kayrem"), { icon: "x", name: "Twitter" });
  assert.deepEqual(linkKind("https://m.youtube.com/@kayrem"), { icon: "youtube", name: "YouTube" });
  assert.deepEqual(linkKind("https://youtu.be/dQw4w9WgXcQ"), { icon: "youtube", name: "YouTube" });
  assert.deepEqual(linkKind("https://www.twitch.tv/kayrem"), { icon: "twitch", name: "Twitch" });
  assert.deepEqual(linkKind("https://open.spotify.com/user/kayrem"), { icon: "spotify", name: "Spotify" });
});

test("a link anywhere else is named by its host", () => {
  assert.deepEqual(linkKind("https://www.kayrem.carrd.co/about"), { icon: null, name: "kayrem.carrd.co" });
  // A host that only ends in a known one's letters is not that site.
  assert.deepEqual(linkKind("https://notx.com/kayrem"), { icon: null, name: "notx.com" });
});
