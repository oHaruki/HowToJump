import { redirect } from "next/navigation";
import { auth, isStaff } from "@/lib/auth";
import { StaffNav } from "@/components/StaffNav";
import { getStaffStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // Gated on the layout, so no staff route is reachable by URL alone.
  if (!session?.userId || !isStaff(session.role)) redirect("/");

  const stats = await getStaffStats();

  return (
    <div className="shell">
      <StaffNav pending={stats.pending} isAdmin={session.role === "admin"} />
      <div className="stack-lg" style={{ minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
