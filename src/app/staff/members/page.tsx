import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { SectionHead } from "@/components/ui";
import { MembersTable } from "@/components/MembersTable";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const rows = await db.select().from(users).orderBy(desc(users.createdAt)).limit(200);
  return (
    <>
      <SectionHead label="Admin" title="Members">
        Helpers can add and judge maps. Admins can also change roles.
      </SectionHead>
      <MembersTable
        rows={rows.map((u) => ({
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
