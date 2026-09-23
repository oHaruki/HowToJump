import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { getBank, getProfilePlays, getTierCounts, type ProfilePlay } from "@/lib/queries";
import { profileLists, type ShownPlay } from "@/lib/progress";
import { gradeRank } from "@/lib/grading";
import { TIERS, shortCategory, tierBySlug, tierFill } from "@/lib/tiers";
import { BankCard } from "@/components/MapList";
import { GradeLetter, NONE, packHref } from "@/components/ui";
import { LiveRefresh } from "@/components/LiveRefresh";

export const dynamic = "force-dynamic";

const fmt = (n: number) => Math.round(n).toLocaleString("en");

type Params = Promise<{ osuUserId: string; pack: string }>;

/** A player who is not banned, by osu! user ID, or null. */
async function findPlayer(osuUserId: string) {
  const id = Number(osuUserId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const [player] = await db
    .select({ id: users.id, osuUserId: users.osuUserId, username: users.username })
    .from(users)
    .where(and(eq(users.osuUserId, id), isNull(users.bannedAt)));
  return player ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { osuUserId, pack } = await params;
  const tier = tierBySlug(pack);
  const player = tier ? await findPlayer(osuUserId) : null;
  return tier && player ? { title: player.username + " · " + tier.name } : {};
}

/**
 * One pack for one player: every map in it in the bank's order, with the
 * player's score on each. Maps they have not cleared are grayed out.
 */
export default async function PackPage({ params }: { params: Params }) {
  const { osuUserId, pack } = await params;
  const tier = tierBySlug(pack);
  const player = tier ? await findPlayer(osuUserId) : null;
  if (!tier || !player) notFound();

  const [session, maps, plays, counts] = await Promise.all([
    auth(),
    getBank({ pack: tier.order }),
    getProfilePlays(player.id),
    getTierCounts(),
  ]);

  // Places count across every play, not only this pack's.
  const byEntry = new Map(profileLists(plays, null).recent.map((p) => [p.entryId, p]));
  const cleared = maps.flatMap((m) => byEntry.get(m.entryId) ?? []);
  const best = cleared.reduce<string | null>(
    (b, p) => (b == null || gradeRank(p.grade) < gradeRank(b) ? p.grade : b),
    null,
  );
  const back = session?.userId === player.id ? "/me" : "/u/" + player.osuUserId;

  return (
    <div className="view">
      <LiveRefresh />

      <div className="stack">
        <div className="pk-nav">
          <Link className="lbl bm-back" href={back}>
            ← {player.username}
          </Link>
          <nav className="pk-strip" aria-label="Packs">
            {TIERS.map((t) =>
              counts.get(t.order) ? (
                <Link
                  key={t.slug}
                  href={packHref(player.osuUserId, t.slug)}
                  title={t.name}
                  aria-label={t.name}
                  aria-current={t.order === tier.order ? "page" : undefined}
                  data-idle={plays.some((p) => p.tierOrder === t.order) ? undefined : true}
                  style={{ background: tierFill(t) }}
                />
              ) : (
                <span key={t.slug} title={t.name + ", no maps yet"} style={{ background: tierFill(t) }} />
              ),
            )}
          </nav>
        </div>

        <section
          className="pk pk-lg"
          style={{ "--pack": tier.color, "--fill": tierFill(tier) } as CSSProperties}
        >
          <div className="pk-top">
            <span className="pk-gem" style={{ background: tierFill(tier) }} />
            <div className="pk-who">
              <span className="lbl">{player.username}</span>
              <h1>{tier.name}</h1>
            </div>
            {best ? <GradeLetter grade={best} /> : null}
          </div>
          <div className="pk-bar">
            <i style={{ width: (maps.length ? (cleared.length / maps.length) * 100 : 0) + "%" }} />
          </div>
          <span className="pk-count">
            {maps.length ? cleared.length + " / " + maps.length + " cleared" : "No maps yet"}
          </span>
        </section>
      </div>

      {maps.length ? (
        <div className="review-list" style={{ "--pack": tier.color } as CSSProperties}>
          {maps.map((m) => {
            const play = byEntry.get(m.entryId);
            return (
              <BankCard
                key={m.entryId}
                map={m}
                tone={play ? undefined : "muted"}
                score={
                  play ? <Score play={play} /> : <span className="mapcard-score-none">Not cleared</span>
                }
              />
            );
          })}
        </div>
      ) : (
        <p className="small">No maps in this pack yet.</p>
      )}
    </div>
  );
}

/** A score as a play row shows it: grade, accuracy and misses, then EXP. */
function Score({ play: p }: { play: ShownPlay<ProfilePlay> }) {
  const top = p.places[0];
  return (
    <>
      <GradeLetter grade={p.grade} />
      <span className="mapcard-score-acc">
        {p.accuracy != null ? p.accuracy.toFixed(2) + "%" : NONE}
        <br />
        {p.missCount === 1 ? "1 miss" : p.missCount + " misses"}
      </span>
      <span className="mapcard-score-exp">
        <b>{fmt(p.exp)}</b>
        <span
          data-counts={top ? true : undefined}
          title={p.places.map((x) => "#" + x.place + " " + shortCategory(x.category)).join(", ") || undefined}
        >
          {top ? "#" + top.place + " " + shortCategory(top.category) : "EXP"}
          {p.places.length > 1 ? " +" + (p.places.length - 1) : null}
        </span>
      </span>
    </>
  );
}
