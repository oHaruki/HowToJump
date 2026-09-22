import { createPublicKey, verify } from "node:crypto";

/**
 * Discord over plain HTTP: a command arrives as a signed POST answered by
 * editing the reply, and every announcement is a channel webhook. No bot
 * process.
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

/** Discord's caps on the parts of an embed. */
export const EMBED_LIMITS = {
  author: 256,
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  footer: 2048,
};

/** How long a call to Discord is given, so a slow one cannot hold a page. */
const TIMEOUT_MS = 5000;

/**
 * One call to Discord, as JSON and with nothing in it allowed to ping. A
 * token signs as the bot; a reply carries its own in the URL instead.
 */
function send(url: string, method: "POST" | "PATCH", message: Message, token?: string) {
  return fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bot " + token } : {}),
    },
    body: JSON.stringify({ ...message, allowed_mentions: NO_PINGS }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** Most embeds Discord takes in one message. */
export const EMBEDS_PER_MESSAGE = 10;

export type EmbedField = { name: string; value: string; inline?: boolean };

export type Embed = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  author?: { name: string; url?: string; icon_url?: string };
  thumbnail?: { url: string };
  image?: { url: string };
  fields?: EmbedField[];
  footer?: { text: string; icon_url?: string };
  timestamp?: string;
};

export type Message = { content?: string; embeds?: Embed[] };

/** Escapes Discord markdown, so a name like some_name_here stays literal. */
export function md(text: string): string {
  return text.replace(/[\*_~`|>]/g, "\$&");
}

/** Cuts a string to a length Discord accepts. */
export function clamp(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

/** Joins lines into one message, dropping what does not fit and saying how much. */
export function fitLines(lines: string[], limit = MESSAGE_LIMIT): string {
  const kept: string[] = [];
  let length = 0;
  for (let i = 0; i < lines.length; i++) {
    const more = "\n…and " + (lines.length - i) + " more";
    if (length + lines[i].length + 1 + more.length > limit) {
      return kept.join("\n") + more;
    }
    kept.push(lines[i]);
    length += lines[i].length + 1;
  }
  return kept.join("\n");
}

/** An embed with every part cut to the size Discord accepts. */
export function trimEmbed(e: Embed): Embed {
  return {
    ...e,
    title: e.title && clamp(e.title, EMBED_LIMITS.title),
    description: e.description && clamp(e.description, EMBED_LIMITS.description),
    author: e.author && { ...e.author, name: clamp(e.author.name, EMBED_LIMITS.author) },
    footer: e.footer && { ...e.footer, text: clamp(e.footer.text, EMBED_LIMITS.footer) },
    fields: e.fields?.map((f) => ({
      ...f,
      name: clamp(f.name, EMBED_LIMITS.fieldName),
      value: clamp(f.value, EMBED_LIMITS.fieldValue),
    })),
  };
}

/** A message with every embed trimmed, in chunks Discord accepts. */
function chunks(message: Message): Message[] {
  const embeds = (message.embeds ?? []).map(trimEmbed);
  if (embeds.length <= EMBEDS_PER_MESSAGE) {
    return [{ ...message, embeds: embeds.length ? embeds : undefined }];
  }
  const out: Message[] = [];
  for (let i = 0; i < embeds.length; i += EMBEDS_PER_MESSAGE) {
    out.push({
      content: i === 0 ? message.content : undefined,
      embeds: embeds.slice(i, i + EMBEDS_PER_MESSAGE),
    });
  }
  return out;
}

/**
 * Replaces the "thinking" placeholder Discord shows after a deferred reply.
 * A refusal is logged: fetch reads one as an answer, and an answer nobody
 * checks leaves the command thinking for good with nothing said anywhere.
 */
export async function editReply(interactionToken: string, message: Message): Promise<void> {
  const app = process.env.DISCORD_APPLICATION_ID;
  if (!app) {
    console.error("discord: no reply sent, DISCORD_APPLICATION_ID is not set");
    return;
  }
  const hook = API + "/webhooks/" + app + "/" + interactionToken;
  const [first, ...rest] = chunks(message);
  try {
    const res = await send(hook + "/messages/@original", "PATCH", first);
    if (!res.ok) {
      console.error("discord: reply said " + res.status + ": " + (await res.text()));
      return;
    }
    for (const more of rest) {
      const follow = await send(hook, "POST", more);
      if (!follow.ok) {
        console.error("discord: follow-up said " + follow.status + ": " + (await follow.text()));
        return;
      }
    }
  } catch (e) {
    console.error("discord: reply failed: " + (e instanceof Error ? e.message : String(e)));
  }
}

/**
 * Posts to a channel as the bot, quiet until a channel and a token are set.
 * Never throws: an announcement is a courtesy. A refusal is logged, since a
 * channel the bot cannot post in looks the same as one nothing happened in.
 */
export async function postChannel(
  channelId: string | undefined,
  message: Message,
): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!channelId || !token) return;
  try {
    for (const part of chunks(message)) {
      const res = await send(API + "/channels/" + channelId + "/messages", "POST", part, token);
      if (!res.ok) {
        console.error(
          "discord: channel " + channelId + " said " + res.status + ": " + (await res.text()),
        );
        return;
      }
    }
  } catch (e) {
    console.error("discord: " + (e instanceof Error ? e.message : String(e)));
  }
}
