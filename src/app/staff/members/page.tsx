import { desc, inArray, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { SectionHead } from "@/components/ui";
import { MembersTable } from "@/components/MembersTable";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  // Staff only. Every signed in player has a row here, so listing them all
  // would grow without bound and bury the people this page is about.
  const [staff, [count]] = await Promise.all([
    db
      .select()
      .from(users)
      .where(inArray(users.role, ["helper", "admin"]))
      .orderBy(desc(users.role), desc(users.createdAt)),
    db.select({ n: raw<number>`count(*)::int` }).from(users),
  ]);

  return (
    <>
      <SectionHead label="Admin" title="Staff">
        Helpers can add and judge maps. Admins can also manage this list. Anyone
        not listed here is an ordinary player.
      </SectionHead>
      <MembersTable
        playerCount={count?.n ?? 0}
        rows={staff.map((u) => ({
          id: u.id,
          username: u.username,
          avatarUrl: u.avatarUrl,
          osuUserId: u.osuUserId,
          role: u.role,
          globalRank: u.globalRank,
          lastSyncedAt: u.lastSyncedAt ? String(u.lastSyncedAt) : null,
        }))}
      />
    </>
  );
}
