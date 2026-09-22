import { createPublicKey, verify } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { describeScores, entryName, gradeText, type ScoreLine } from "@/lib/queries";
import { shortCategory, tierByOrder } from "@/lib/tiers";

/**
 * Discord over plain HTTP: /rs arrives as a signed POST answered by editing
 * the reply, and the score feed is a channel webhook. No bot process.
 */

const API = "https://discord.com/api/v10";

/* Discord gives the Ed25519 key as raw hex; node:crypto wants it wrapped in
   the fixed SPKI header for that key type. */
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Checks the signature Discord puts on every interaction it sends. */
export function verifyInteraction(
  body: string,
  signature: string | null,
  timestamp: string | null,
): boolean {
  const key = process.env.DISCORD_PUBLIC_KEY;
  if (!key || !signature || !timestamp) return false;
  try {
    const publicKey = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(key, "hex")]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(timestamp + body), publicKey, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

/* No @everyone from a map title, and no pings from a username. */
const NO_PINGS = { parse: [] as string[] };

/** Discord's cap on one message. */
const MESSAGE_LIMIT = 2000;

/** Escapes Discord markdown, so a name like some_name_here stays literal. */
export function md(text: string): string {
  return text.replace(/[\\*_~`|>]/g, "\\$&");
}

/** One imported score as a line: map, grade, pack and categories. */
export function scoreLine(s: ScoreLine): string {
  const pack = tierByOrder(s.tierOrder)?.name ?? "?";
  const categories = s.categories.map((c) => shortCategory(c)).join(" + ");
  return md(entryName(s)) + " · " + gradeText(s) + " · " + pack + " · " + md(categories);
}

/** Joins lines into one message, dropping what does not fit and saying how much. */
export function fitLines(lines: string[]): string {
  const kept: string[] = [];
  let length = 0;
  for (let i = 0; i < lines.length; i++) {
    const more = "\n…and " + (lines.length - i) + " more";
    if (length + lines[i].length + 1 + more.length > MESSAGE_LIMIT) {
      return kept.join("\n") + more;
    }
    kept.push(lines[i]);
    length += lines[i].length + 1;
  }
  return kept.join("\n");
}

/** Replaces the "thinking" placeholder Discord shows after a deferred reply. */
export async function editReply(interactionToken: string, content: string): Promise<void> {
  const app = process.env.DISCORD_APPLICATION_ID;
  if (!app) return;
  await fetch(API + "/webhooks/" + app + "/" + interactionToken + "/messages/@original", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, allowed_mentions: NO_PINGS }),
  });
}

/** Posts imported scores to the feed channel, if one is set up. Never throws. */
export async function announceScores(
  userId: number,
  imported: Array<{ entryId: number; grade: string; missCount: number }>,
): Promise<void> {
  const url = process.env.DISCORD_SCORES_WEBHOOK_URL;
  if (!url || !imported.length) return;
  try {
    const [who] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, userId));
    const lines = await describeScores(imported);
    if (!who || !lines.length) return;
    const name = "**" + md(who.username) + "** · ";
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: fitLines(lines.map((s) => name + scoreLine(s))),
        allowed_mentions: NO_PINGS,
      }),
    });
  } catch {
    // The score is saved either way; the feed is a courtesy.
  }
}
