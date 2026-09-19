import { after, NextResponse } from "next/server";
import { sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { cooldownLeft, syncUser } from "@/lib/osu/sync";
import { describeScores } from "@/lib/queries";
import { editReply, fitLines, md, scoreLine, verifyInteraction } from "@/lib/discord";

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

/**
 * Discord's interactions endpoint. Every request is signed and anything that
 * fails the check is refused; Discord tests exactly that with a bad signature
 * when the URL is saved in the developer portal.
 *
 * /rs has three seconds to answer and a sync can take longer, so it answers
 * "thinking" at once and edits the reply when the sync is done.
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

  if (interaction.type === APPLICATION_COMMAND && interaction.data?.name === "rs") {
    if (!rsAllowed()) {
      return NextResponse.json({
        type: MESSAGE,
        data: { content: "Lots of /rs right now. Try again in a minute.", flags: EPHEMERAL },
      });
    }
    const player = String(
      interaction.data.options?.find((o) => o.name === "player")?.value ?? "",
    ).trim();
    after(async () => {
      const text = await recentScoresReply(player).catch(
        (e) => "Something went wrong: " + (e instanceof Error ? e.message : String(e)),
      );
      await editReply(interaction.token, text);
    });
    return NextResponse.json({ type: DEFERRED_MESSAGE });
  }

  return NextResponse.json({
    type: MESSAGE,
    data: { content: "Unknown command.", flags: EPHEMERAL },
  });
}

async function recentScoresReply(name: string): Promise<string> {
  if (!name) return "Give an osu! name: `/rs player:<name>`";

  // Exact match ignoring case. ilike would treat the underscores common in
  // osu! names as wildcards.
  const [user] = await db
    .select({
      id: users.id,
      osuUserId: users.osuUserId,
      username: users.username,
      lastSyncedAt: users.lastSyncedAt,
      syncEnabled: users.syncEnabled,
      bannedAt: users.bannedAt,
    })
    .from(users)
    .where(raw`lower(${users.username}) = lower(${name})`)
    .limit(1);

  if (!user) return "**" + md(name) + "** hasn't connected their osu! account on the site yet.";
  const who = "**" + md(user.username) + "**";
  if (!user.syncEnabled || user.bannedAt) return who + " isn't being tracked.";

  const wait = cooldownLeft(user.lastSyncedAt);
  if (wait > 0) return who + " was synced moments ago. Try again in " + wait + "s.";

  const r = await syncUser(user.id, user.osuUserId);
  if (r.error) return "Couldn't read " + who + "'s plays from osu!: " + r.error;
  if (!r.imported.length) {
    return "Nothing new on the ladder in " + who + "'s last " + r.playsSeen + " plays.";
  }
  const lines = await describeScores(r.imported);
  return fitLines(["Imported for " + who + ":", ...lines.map(scoreLine)]);
}
