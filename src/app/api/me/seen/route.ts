import { NextResponse } from "next/server";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { seenBody } from "@/lib/progress";

export const dynamic = "force-dynamic";

/**
 * Records what the player's profile last showed them, sent as a beacon on
 * leaving. Stores the snapshot the page rendered and when, so a score that
 * landed after it was drawn still reads as new. An older tab reporting in
 * late cannot wind the clock back.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.userId) return new NextResponse(null, { status: 401 });

  const parsed = seenBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const rendered = new Date(parsed.data.renderedAt);
  if (Number.isNaN(rendered.getTime())) return new NextResponse(null, { status: 400 });
  const at = rendered > new Date() ? new Date() : rendered;

  await db
    .update(users)
    .set({ progressSeen: parsed.data.snapshot, progressSeenAt: at })
    .where(
      and(
        eq(users.id, session.userId),
        or(isNull(users.progressSeenAt), lt(users.progressSeenAt, at)),
      ),
    );
  return new NextResponse(null, { status: 204 });
}
