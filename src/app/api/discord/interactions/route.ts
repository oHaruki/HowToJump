import { after, NextResponse } from "next/server";
import { cooldownLeft, syncUser } from "@/lib/osu/sync";
import { describeScores } from "@/lib/queries";
import {
  editReply, findPlayer, md, profileReply, scoresMessage, unknownPlayer, verifyInteraction,
  type Message,
} from "@/lib/discord";

export const dynamic = "force-dynamic";

// Interaction and response types, as Discord numbers them.
const PING = 1;
const APPLICATION_COMMAND = 2;
const PONG = 1;
const MESSAGE = 4;
const DEFERRED_MESSAGE = 5;
const EPHEMERAL = 64;

type Interaction = {
  type: number;
  token: string;
  data?: { name?: string; options?: Array<{ name: string; value?: unknown }> };
};

/*
 * Every player has their own cooldown, but /rs takes any name, so a burst of
 * different names could still queue enough syncs to crowd out the worker in
 * the shared osu! budget. This caps the command as a whole.
 */
const RS_PER_MINUTE = 10;
let rsWindowStart = 0;
let rsUsed = 0;

function rsAllowed(now = Date.now()): boolean {
  if (now - rsWindowStart >= 60_000) {
    rsWindowStart = now;
    rsUsed = 0;
  }
  if (rsUsed >= RS_PER_MINUTE) return false;
  rsUsed += 1;
  return true;
}

function option(interaction: Interaction, name: string): string {
  return String(interaction.data?.options?.find((o) => o.name === name)?.value ?? "").trim();
}

function reply(content: string) {
  return NextResponse.json({ type: MESSAGE, data: { content, flags: EPHEMERAL } });
}

/**
 * Answers "thinking" at once and edits the reply once the work is done. A
 * command has three seconds to answer, which a sync can outlast.
 */
function deferred(token: string, work: () => Promise<Message>) {
  after(async () => {
    const message = await work().catch(
      (e): Message => ({
        content: "Something went wrong: " + (e instanceof Error ? e.message : String(e)),
      }),
    );
    await editReply(token, message);
  });
  return NextResponse.json({ type: DEFERRED_MESSAGE });
}

/**
 * Discord's interactions endpoint. Every request is signed and anything that
 * fails the check is refused; Discord tests exactly that with a bad signature
 * when the URL is saved in the developer portal.
 */
export async function POST(req: Request) {
  const body = await req.text();
  const signed = verifyInteraction(
    body,
    req.headers.get("x-signature-ed25519"),
    req.headers.get("x-signature-timestamp"),
  );
  if (!signed) return new NextResponse("Bad signature", { status: 401 });

  const interaction = JSON.parse(body) as Interaction;
  if (interaction.type === PING) return NextResponse.json({ type: PONG });
  if (interaction.type !== APPLICATION_COMMAND) return reply("Unknown command.");

  const player = option(interaction, "player");

  if (interaction.data?.name === "rs") {
    if (!rsAllowed()) return reply("Lots of /rs right now. Try again in a minute.");
    return deferred(interaction.token, () => recentScoresReply(player));
  }

  if (interaction.data?.name === "profile") {
    return deferred(interaction.token, () => profileReply(player));
  }

  return reply("Unknown command.");
}

async function recentScoresReply(name: string): Promise<Message> {
  if (!name) return { content: "Give an osu! name: `/rs player:<name>`" };

  const user = await findPlayer(name);
  if (!user) return { content: unknownPlayer(name) };

  const who = "**" + md(user.username) + "**";
  if (!user.syncEnabled || user.bannedAt) return { content: who + " isn't being tracked." };

  const wait = cooldownLeft(user.lastSyncedAt);
  if (wait > 0) {
    return { content: who + " was synced moments ago. Try again in " + wait + "s." };
  }

  const r = await syncUser(user.id, user.osuUserId);
  if (r.error) return { content: "Couldn't read " + who + "'s plays from osu!: " + r.error };
  if (!r.imported.length) {
    return {
      content: "Nothing new from the bank in " + who + "'s last " + r.playsSeen + " plays.",
    };
  }
  return scoresMessage(user, await describeScores(r.imported));
}
