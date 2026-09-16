import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog, suggestions } from "@/lib/schema";
import { getStaffStats } from "@/lib/queries";
import { tierByOrder, tierFill } from "@/lib/tiers";
import { StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function StaffDashboard() {
  const [stats, byTier, log] = await Promise.all([
    getStaffStats(),
    db
      .select({ tierOrder: suggestions.proposedTierOrder })
      .from(suggestions)
      .where(eq(suggestions.status, "pending")),
    db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(8),
  ]);

  const counts = new Map<number | null, number>();
  for (const s of byTier) {
    counts.set(s.tierOrder, (counts.get(s.tierOrder) ?? 0) + 1);
  }
  const max = Math.max(1, ...Array.from(counts.values()));
  const ordered = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="row spread">
        <div className="section-head">
          <span className="lbl">Staff</span>
          <h1>Dashboard</h1>
        </div>
        <Link className="btn btn-primary" href="/staff/add">
          Add maps
        </Link>
      </div>

      <div className="grid-4">
        <StatCard label="in the queue" value={stats.pending} />
        <StatCard label="entries on the ladder" value={stats.bank} />
        <StatCard label="need a pack" value={stats.needPack} />
        <StatCard label="players" value={stats.players} />
      </div>

      <div className="two-col">
        <div className="box stack">
          <span className="lbl">Queue by pack</span>
          <div>
            {ordered.map(([order, n]) => {
              const t = tierByOrder(order);
              return (
                <div className="prow" key={String(order)}>
                  <div className="prow-name">
                    <span className="dot" style={{ background: tierFill(t) }} />
                    {t ? t.name : "unassigned"}
                  </div>
                  <div className="pbar">
                    <i style={{ width: Math.round((n / max) * 100) + "%", background: tierFill(t) }} />
                  </div>
                  <span className="num">{n}</span>
                </div>
              );
            })}
          </div>
          {!ordered.length ? (
            <p className="small">Nothing waiting. Add maps to fill the queue.</p>
          ) : null}
        </div>

        <div className="box stack">
          <span className="lbl">Recent activity</span>
          <div className="stack" style={{ gap: 7 }}>
            {log.map((e) => (
              <div className="row-tight" key={e.id}>
                <span className="small">
                  {new Date(e.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span>
                  {e.actorName ? e.actorName + " " : ""}
                  {e.action}
                </span>
              </div>
            ))}
            {!log.length ? <p className="small">Nothing logged yet.</p> : null}
          </div>
        </div>
      </div>
    </>
  );
}
