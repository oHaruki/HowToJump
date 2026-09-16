import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userTierProgress, users } from "@/lib/schema";
import { getUserScores } from "@/lib/queries";
import { TIERS, tierByOrder, tierFill } from "@/lib/tiers";
import { GradeBadge, MapCell, ModChip, NONE, StatCard, TierChip } from "@/components/ui";
import { SyncButton } from "@/components/SyncButton";

export const dynamic = "force-dynamic";

function ago(d: Date | null) {
  if (!d) return "never";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + " min ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + (hrs === 1 ? " hour ago" : " hours ago");
  const days = Math.round(hrs / 24);
  return days + (days === 1 ? " day ago" : " days ago");
}

export default async function MePage() {
  const session = await auth();
  if (!session?.userId) redirect("/");

  const [me] = await db.select().from(users).where(eq(users.id, session.userId));
  const [progress, scoreRows] = await Promise.all([
    db
      .select()
      .from(userTierProgress)
      .where(eq(userTierProgress.userId, session.userId)),
    getUserScores(session.userId),
  ]);

  const byTier = new Map(progress.map((p) => [p.tierOrder, p]));
  const cleared = progress.reduce((n, p) => n + p.entriesCleared, 0);
  const packsTouched = progress.filter((p) => p.entriesCleared > 0).length;
  const best = scoreRows.length
    ? scoreRows.reduce((a, b) => (a.gradeRank <= b.gradeRank ? a : b))
    : null;
  const topPack = scoreRows.length
    ? scoreRows.reduce((a, b) => (a.tierOrder >= b.tierOrder ? a : b))
    : null;

  return (
    <div className="view">
      <div className="row spread">
        <div className="section-head">
          <span className="lbl">Your progression</span>
          <h1>{me?.username ?? session.user?.name}</h1>
        </div>
        <div className="row">
          <span className="small">Last synced {ago(me?.lastSyncedAt ?? null)}</span>
          <SyncButton />
        </div>
      </div>

      <div className="grid-4">
        <StatCard label="entries cleared" value={cleared} />
        <StatCard label="packs touched" value={packsTouched + " of 16"} />
        <StatCard label="best grade" value={best ? best.grade : NONE} />
        <StatCard
          label="top pack"
          value={topPack ? tierByOrder(topPack.tierOrder)?.name ?? NONE : NONE}
        />
      </div>

      <div className="two-col">
        <div className="box stack">
          <span className="lbl">Packs cleared</span>
          <div>
            {TIERS.slice()
              .reverse()
              .filter((t) => (byTier.get(t.order)?.entriesTotal ?? 0) > 0)
              .map((t) => {
                const p = byTier.get(t.order)!;
                const pct = p.entriesTotal
                  ? Math.round((p.entriesCleared / p.entriesTotal) * 100)
                  : 0;
                return (
                  <div className="prow" key={t.slug}>
                    <div className="prow-name">
                      <span className="dot" style={{ background: tierFill(t) }} />
                      {t.name}
                    </div>
                    <div className="pbar">
                      <i style={{ width: pct + "%", background: tierFill(t) }} />
                    </div>
                    <span className="num">
                      {p.entriesCleared} / {p.entriesTotal}
                    </span>
                  </div>
                );
              })}
            {!progress.length ? (
              <p className="small">
                Nothing yet. Play anything on the ladder and it shows up here after
                the next sync.
              </p>
            ) : null}
          </div>
        </div>

        <div className="box stack">
          <span className="lbl">Recent scores</span>
          <div className="table-wrap" style={{ boxShadow: "none", border: 0 }}>
            <table style={{ minWidth: 460 }}>
              <thead>
                <tr>
                  <th>Map</th>
                  <th>Mod</th>
                  <th>Pack</th>
                  <th>Miss</th>
                  <th>Acc</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {scoreRows.map((s) => (
                  <tr key={s.scoreId}>
                    <td>
                      <MapCell map={s} />
                    </td>
                    <td>
                      <ModChip mod={s.mod} />
                    </td>
                    <td>
                      <TierChip tier={s.tierOrder} />
                    </td>
                    <td className="num">{s.missCount}</td>
                    <td className="num">
                      {s.accuracy != null ? s.accuracy.toFixed(1) + "%" : NONE}
                    </td>
                    <td>
                      <GradeBadge grade={s.grade} />
                    </td>
                  </tr>
                ))}
                {!scoreRows.length ? (
                  <tr>
                    <td colSpan={6} className="small">
                      No scores imported yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
