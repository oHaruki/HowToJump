import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isNull, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { getRoles } from "@/lib/queries";
import { SectionHead } from "@/components/ui";
import { RolesBoard } from "@/components/RolesBoard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Roles" };

/**
 * Every role against what it may do. Admin and Helper are built in and
 * fixed; admins make, change and delete the rest here.
 */
export default async function RolesPage() {
  const session = await auth();
  if (session?.role !== "admin") redirect("/staff");

  const [roles, counts] = await Promise.all([
    getRoles(),
    db
      .select({ role: users.role, n: raw<number>`count(*)::int` })
      .from(users)
      .where(isNull(users.bannedAt))
      .groupBy(users.role),
  ]);
  const members = new Map(counts.map((c) => [c.role, c.n]));

  return (
    <>
      <SectionHead label="Admin" title="Roles">
        What each role lets its members do. Admin and Helper are built in and stay as
        they are. Make any other role here, then hand it out on the Members page.
        Managing staff and roles always stays with admins.
      </SectionHead>
      <RolesBoard
        roles={roles.map((r) => ({
          ...r,
          permissions: [...r.permissions],
          members: members.get(r.key) ?? 0,
        }))}
      />
    </>
  );
}
