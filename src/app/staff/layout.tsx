import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can, canSeeQueue, canUseStaffArea, isAdmin } from "@/lib/roles";
import { StaffNav } from "@/components/StaffNav";
import { getStaffStats, getVoteStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // Gated on the layout, so no staff route is reachable by URL alone.
  if (!session?.userId || !canUseStaffArea(session)) redirect("/");

  const votes = can(session, "maps.vote");
  const [stats, voteStats] = await Promise.all([
    getStaffStats(),
    votes ? getVoteStats(session.userId) : null,
  ]);

  return (
    <div className="shell">
      <StaffNav
        pending={stats.pending}
        waiting={voteStats?.waiting ?? 0}
        show={{
          add: can(session, "maps.add"),
          queue: canSeeQueue(session),
          bank: can(session, "bank.edit"),
          votes,
          admin: isAdmin(session),
        }}
      />
      <div className="stack-lg" style={{ minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
