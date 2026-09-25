import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getRoles } from "@/lib/queries";
import { isAdmin } from "@/lib/roles";
import { SectionHead } from "@/components/ui";
import { RolesBoard } from "@/components/RolesBoard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Roles" };

/**
 * Every role against what it may do, highest first. Admin and Helper are
 * built in and fixed; admins make, rank, change and delete the rest here.
 */
export default async function RolesPage() {
  if (!isAdmin(await auth())) redirect("/staff");

  const [roles, counts] = await Promise.all([
    getRoles(),
    sql<Array<{ role: string; n: number }>>`
      select r as role, count(*)::int as n
      from users cross join unnest(users.roles) as r
      where users.banned_at is null
      group by r`,
  ]);
  const members = new Map(counts.map((c) => [c.role, c.n]));

  return (
    <>
      <SectionHead label="Admin" title="Roles">
        What each role lets its members do, highest first. Admin is always on top,
        and Admin and Helper are built in and stay as they are. Make any other role
        here and move it up or down: the Team page shows everyone under the highest
        role they hold. Hand roles out on the Members page. Managing staff and roles
        always stays with admins.
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
