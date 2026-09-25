import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, ne, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { getRoles } from "@/lib/queries";
import { PLAYER } from "@/lib/roles";
import { timeAgo } from "@/lib/time";
import { SectionHead } from "@/components/ui";
import { MembersTable } from "@/components/MembersTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage() {
  const session = await auth();
  if (session?.role !== "admin") redirect("/staff");

  // Staff only. Every signed in player has a row here, so listing them all
  // would grow without bound and bury the people this page is about.
  const [staff, [count], roles] = await Promise.all([
    db
      .select()
      .from(users)
      .where(ne(users.role, PLAYER.key))
      .orderBy(desc(users.createdAt)),
    db.select({ n: raw<number>`count(*)::int` }).from(users),
    getRoles(),
  ]);
  // In the order the roles board lists the roles.
  const order = new Map(roles.map((r, i) => [r.key, i]));
  staff.sort((a, b) => (order.get(a.role) ?? roles.length) - (order.get(b.role) ?? roles.length));

  return (
    <>
      <SectionHead label="Admin" title="Staff">
        Helpers can add and judge maps, and admins can do everything, this list
        included. Any other role does what the Roles page gives it. Anyone not
        listed here is an ordinary player.
      </SectionHead>
      <MembersTable
        roles={roles.map((r) => ({ key: r.key, name: r.name }))}
        playerCount={count?.n ?? 0}
        rows={staff.map((u) => ({
          id: u.id,
          username: u.username,
          avatarUrl: u.avatarUrl,
          osuUserId: u.osuUserId,
          role: u.role,
          globalRank: u.globalRank,
          lastSynced: timeAgo(u.lastSyncedAt),
        }))}
      />
    </>
  );
}
