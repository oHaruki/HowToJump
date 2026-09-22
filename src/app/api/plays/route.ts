import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { getProfilePlays } from "@/lib/queries";
import { profileLists } from "@/lib/progress";
import type { PlayView } from "@/components/PlayRow";

export const dynamic = "force-dynamic";

/**
 * The rest of a profile's plays, past the handful its lists draw up front.
 * Both orders come from the same functions the page uses; `list` picks
 * which one is sliced. Public, like profiles: banned players 404, and
 * freshness is worked out only for the owner. Sends only the fields a row
 * draws.
 */

const LISTS = new Set(["top", "recent"]);

function bad() {
  return new NextResponse(null, { status: 400 });
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const userId = Number(q.get("user"));
  const list = q.get("list") ?? "";
  const offset = Number(q.get("offset") ?? "0");

  if (!Number.isSafeInteger(userId) || userId <= 0) return bad();
  if (!LISTS.has(list)) return bad();
  if (!Number.isSafeInteger(offset) || offset < 0) return bad();

  const [player] = await db
    .select({ id: users.id, progressSeenAt: users.progressSeenAt })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.bannedAt)));
  if (!player) return new NextResponse(null, { status: 404 });

  const session = await auth();
  const seenAt = session?.userId === player.id ? player.progressSeenAt : null;

  const plays = await getProfilePlays(userId);
  const lists = profileLists(plays, seenAt);
  const rows = (list === "top" ? lists.top : lists.recent).slice(offset);

  return NextResponse.json({
    plays: rows.map(
      (p): PlayView => ({
        scoreId: p.scoreId,
        entryId: p.entryId,
        title: p.title,
        version: p.version,
        mapper: p.mapper,
        mod: p.mod,
        tierOrder: p.tierOrder,
        categories: p.categories,
        grade: p.grade,
        missCount: p.missCount,
        accuracy: p.accuracy,
        playedAt: p.playedAt,
        osuBeatmapId: p.osuBeatmapId,
        osuBeatmapsetId: p.osuBeatmapsetId,
        exp: p.exp,
        places: p.places,
        fresh: p.fresh,
      }),
    ),
  });
}
