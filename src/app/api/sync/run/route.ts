import { NextResponse } from "next/server";
import { syncDueUsers } from "@/lib/osu/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * One pass of the sync worker. The worker container calls this every minute;
 * a shared secret keeps it off the public internet.
 */
export async function POST(req: Request) {
  const expected = process.env.SYNC_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "SYNC_TOKEN is not set" }, { status: 500 });
  }
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (given !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pass = await syncDueUsers();
  return NextResponse.json({
    skipped: pass.skipped,
    checked: pass.checked,
    swept: pass.results.length,
    imported: pass.results.reduce((n, r) => n + r.scoresImported, 0),
    results: pass.results,
  });
}
