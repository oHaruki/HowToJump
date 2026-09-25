import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { getRoles } from "@/lib/queries";
import { isAdmin } from "@/lib/roles";
import { timeAgo } from "@/lib/time";
import { SectionHead } from "@/components/ui";
import { MembersTable } from "@/components/MembersTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage() {
  if (!isAdmin(await auth())) redirect("/staff");

  // Staff only. Every signed in player has a row here, so listing them all
  // would grow without bound and bury the people this page is about.
  const [staff, [count], roles] = await Promise.all([
    db
      .select()
      .from(users)
      .where(raw`cardinality(${users.roles}) > 0`)
      .orderBy(desc(users.createdAt)),
    db.select({ n: raw<number>`count(*)::int` }).from(users),
    getRoles(),
  ]);
  // Each member's roles highest first, and the members by their highest.
  const rank = new Map(roles.map((r, i) => [r.key, i]));
  const ranked = (keys: string[]) =>
    keys.filter((k) => rank.has(k)).sort((a, b) => rank.get(a)! - rank.get(b)!);
  const top = (keys: string[]) => rank.get(ranked(keys)[0]) ?? roles.length;
  staff.sort((a, b) => top(a.roles) - top(b.roles));

  return (
    <>
      <SectionHead label="Admin" title="Staff">
        Helpers can add and judge maps, and admins can do everything, this list
        included. Anyone can hold several roles and may do what any of them allows;
        the Roles page sets what each one does. Anyone not listed here is an
        ordinary player.
      </SectionHead>
      <MembersTable
        roles={roles.map((r) => ({ key: r.key, name: r.name }))}
        playerCount={count?.n ?? 0}
        rows={staff.map((u) => ({
          id: u.id,
          username: u.username,
          avatarUrl: u.avatarUrl,
          osuUserId: u.osuUserId,
          roles: ranked(u.roles),
          globalRank: u.globalRank,
          lastSynced: timeAgo(u.lastSyncedAt),
        }))}
      />
    </>
  );
}
