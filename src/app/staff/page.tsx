import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog, suggestions } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getCoverage, getStaffStats } from "@/lib/queries";
import { CATEGORIES, TIERS, normalizeCategories, tierByOrder, tierFill } from "@/lib/tiers";
import { BEST_PLAYS } from "@/lib/levels";
import { NONE, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Staff" };

/*
 * Below this many maps of a category in a pack, reaching that pack through
 * the category takes near full combos on every one of them, and at two it is
 * all but out of reach, so those cells are dimmed for staff to fill.
 */
const THIN = 5;

export default async function StaffDashboard() {
  const [session, stats, byTier, log, coverageRows] = await Promise.all([
    auth(),
    getStaffStats(),
    db
      .select({ tierOrder: suggestions.proposedTierOrder })
      .from(suggestions)
      .where(eq(suggestions.status, "pending")),
    db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(8),
    getCoverage(),
  ]);

  // Old spellings count under the category they were renamed to, the way
  // levels count them; only dropped categories land in Other. A map in two
  // categories counts once in each, since it feeds both levels.
  const coverage = new Map<string, number>();
  const otherBy = new Map<number, number>();
  for (const r of coverageRows) {
    const categories = normalizeCategories(r.categories);
    for (const category of categories.filter((c) => CATEGORIES.includes(c))) {
      const key = r.tierOrder + "|" + category;
      coverage.set(key, (coverage.get(key) ?? 0) + r.n);
    }
    if (!categories.length || categories.some((c) => !CATEGORIES.includes(c))) {
      otherBy.set(r.tierOrder, (otherBy.get(r.tierOrder) ?? 0) + r.n);
    }
  }

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
        {can(session, "maps.add") ? (
          <Link className="btn btn-primary" href="/staff/add">
            Add maps
          </Link>
        ) : null}
      </div>

      <div className="grid-4">
        <StatCard label="in the queue" value={stats.pending} />
        <StatCard label="entries in the bank" value={stats.bank} />
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

      <div className="stack">
        <div className="section-head">
          <span className="lbl">Coverage</span>
          <h2>Maps per pack and category</h2>
          <p className="lede">
            Levels count a player&apos;s best {BEST_PLAYS} plays in a category, so a
            category with only a few maps in a pack is hard to reach that pack
            through. A map in two categories counts in both. Cells under {THIN} are
            dimmed. Other counts maps still carrying a dropped category, which count
            toward no level until judged again.
          </p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pack</th>
                {CATEGORIES.map((c) => (
                  <th key={c}>{c}</th>
                ))}
                <th>Other</th>
              </tr>
            </thead>
            <tbody>
              {TIERS.slice()
                .reverse()
                .map((t) => (
                  <tr key={t.slug}>
                    <td>
                      <span className="row-tight">
                        <span className="dot" style={{ background: tierFill(t) }} />
                        {t.name}
                      </span>
                    </td>
                    {CATEGORIES.map((c) => {
                      const n = coverage.get(t.order + "|" + c) ?? 0;
                      return (
                        <td key={c} className={n < THIN ? "num thin" : "num"}>
                          {n || NONE}
                        </td>
                      );
                    })}
                    <td className="num thin">{otherBy.get(t.order) || NONE}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
