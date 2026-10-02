import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can, isAdmin } from "@/lib/roles";
import {
  getEntriesByIds, getPackVotes, getSpotlights, getStayVotes, getTierCounts, getVoteBoard,
  getVoteStats, type BankRow, type Spotlight,
} from "@/lib/queries";
import { TIERS, tierBySlug } from "@/lib/tiers";
import { NO_STAY, NO_VOTES } from "@/lib/votes";
import { SectionHead, StatCard } from "@/components/ui";
import { VoteCard } from "@/components/VoteCard";
import { VoteFilters } from "@/components/VoteFilters";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Map votes" };

type Search = { pack?: string; by?: string; left?: string; entry?: string };

/**
 * Staff votes on whether maps stay in their packs. The map a card's Staff
 * vote link opened goes first, then the maps an admin pinned, then the open
 * votes or every map in one pack.
 */
export default async function VotesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await auth();
  if (!session?.userId || !can(session, "maps.vote")) redirect("/staff");
  const sp = await searchParams;
  const me = session.userId;
  const tier = sp.pack ? tierBySlug(sp.pack) : null;
  const byPack = !!tier || sp.by === "pack";
  const left = sp.left === "1";
  const opened = Number(sp.entry);

  const [stats, pinned, board, found, tierCounts] = await Promise.all([
    getVoteStats(me),
    getSpotlights(),
    byPack && !tier
      ? Promise.resolve([])
      : getVoteBoard({ pack: tier?.order, unvotedBy: left ? me : undefined }),
    Number.isSafeInteger(opened) && opened > 0 ? getEntriesByIds([opened]) : Promise.resolve([]),
    getTierCounts(),
  ]);

  const focus = found.find((r) => r.isActive) ?? null;
  const spot = new Map(pinned.map((p) => [p.entryId, p.spotlight]));
  const pinnedRows = pinned.filter((p) => p.entryId !== focus?.entryId);
  const rows = board.filter((r) => r.entryId !== focus?.entryId && !spot.has(r.entryId));

  const ids = [...(focus ? [focus] : []), ...pinnedRows, ...rows].map((r) => r.entryId);
  const [stay, players] = await Promise.all([getStayVotes(ids, me), getPackVotes(ids, me)]);

  const may = { spotlight: isAdmin(session), settle: can(session, "bank.edit") };
  const counts: Record<string, number> = {};
  for (const t of TIERS) counts[t.slug] = tierCounts.get(t.order) ?? 0;

  const card = (r: BankRow, extra: { spotlight?: Spotlight; focus?: boolean } = {}) => (
    <VoteCard
      key={r.entryId}
      map={r}
      tally={stay.get(r.entryId) ?? NO_STAY}
      players={players.get(r.entryId) ?? NO_VOTES}
      me={session.user?.name ?? "You"}
      may={may}
      {...extra}
    />
  );

  return (
    <>
      <SectionHead title="Map votes">
        Should each map stay in its pack? Vote Stay or Delete, and click your vote again to
        take it back. Talk it over in Discord, this page only counts.
      </SectionHead>

      <div className="grid-4">
        <StatCard label="open votes" value={stats.open} />
        <StatCard label="leaning delete" value={stats.leaningDrop} />
        <StatCard label="in the spotlight" value={stats.spotlit} />
        <StatCard label="waiting on your vote" value={stats.waiting} />
      </div>

      {focus ? (
        <section className="stack">
          <h2>The map you opened</h2>
          <div className="review-list">
            {card(focus, { spotlight: spot.get(focus.entryId), focus: true })}
          </div>
        </section>
      ) : null}

      {pinnedRows.length || may.spotlight ? (
        <section className="stack">
          <div className="section-head">
            <h2>Spotlight</h2>
            <p>
              {may.spotlight
                ? "Maps you pin stay here, above everything else, until someone unpins or closes them."
                : "Maps an admin wants everyone to look at."}
            </p>
          </div>
          {pinnedRows.length ? (
            <div className="review-list">
              {pinnedRows.map((r) => card(r, { spotlight: r.spotlight }))}
            </div>
          ) : (
            <p className="small">Nothing pinned. Spotlight a map from its card below.</p>
          )}
        </section>
      ) : null}

      <section className="stack">
        <VoteFilters
          byPack={byPack}
          pack={tier?.slug ?? ""}
          left={left}
          open={stats.open}
          counts={counts}
        />
        {rows.length ? (
          <div className="review-list">{rows.map((r) => card(r))}</div>
        ) : (
          <p className="small">
            {byPack && !tier
              ? "Pick a pack to go through its maps one by one."
              : tier
                ? left
                  ? "You've voted on every map in " + tier.name + "."
                  : "No maps in " + tier.name + " yet."
                : left
                  ? "You've voted on every open map."
                  : "No open votes. Press Staff vote on a map in the bank, or go through a pack."}
          </p>
        )}
      </section>
    </>
  );
}
