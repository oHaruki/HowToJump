import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { MAIN_LEVEL, progressText } from "@/lib/levels";
import {
  getPlayerTallies, getRankOf, getRankings, type PlayerTally, type RankingRow,
} from "@/lib/queries";
import {
  CATEGORIES, categoryBySlug, categorySlug, shortCategory, tierByOrder, tierFill,
} from "@/lib/tiers";
import { Flag, GradeLetter, SectionHead } from "@/components/ui";
import { BankPager } from "@/components/BankPager";
import { LiveRefresh } from "@/components/LiveRefresh";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Leaderboard" };

const fmt = (n: number) => Math.round(n).toLocaleString("en");

const NO_TALLY: PlayerTally = { clears: 0, fcs: 0, sss: 0, ss: 0, s: 0 };

/**
 * The EXP leaderboard, laid out like osu!'s rankings: the place, the player
 * with their flag, what they have reached, and the figure it is ranked by,
 * with their clears and top grades beside it. Your own row is highlighted,
 * and pinned below the table when it is on another page. The main level's
 * board is the default; a switch above it reads one category's instead.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; board?: string }>;
}) {
  const sp = await searchParams;
  const category = categoryBySlug(sp.board);
  const scope = category ?? MAIN_LEVEL;
  const [board, session] = await Promise.all([
    getRankings(scope, Number(sp.page) || 1),
    auth(),
  ]);
  const mine = session?.userId ? await getRankOf(session.userId, scope) : null;
  const mineShown = !!mine && board.rows.some((r) => r.userId === mine.userId);
  const tallies = await getPlayerTallies(
    [...board.rows.map((r) => r.userId), ...(mine && !mineShown ? [mine.userId] : [])],
    category ?? undefined,
  );

  return (
    <div className="view">
      <LiveRefresh />
      <SectionHead
        label="Leaderboard"
        title={category ? shortCategory(category) + " Leaderboard" : "Project Aim Leaderboard"}
      />

      <div className="stack-lg">
        <BoardSwitch current={category} />
        {board.rows.length ? (
          <RankTable rows={board.rows} tallies={tallies} me={session?.userId ?? null} />
        ) : (
          <p className="small">
            {category
              ? "Nobody has EXP in " + category + " yet. Play any of its maps to be the first."
              : "Nobody has EXP here yet. Play any map from the bank to be the first."}
          </p>
        )}
      </div>

      {mine && !mineShown ? (
        <div className="stack">
          <span className="lbl">Your place</span>
          <RankTable rows={[mine]} tallies={tallies} me={mine.userId} />
        </div>
      ) : null}

      <BankPager
        basePath="/leaderboard"
        page={board.page}
        pageCount={board.pageCount}
        total={board.total}
        pageSize={board.pageSize}
        query={category ? "board=" + categorySlug(category) : ""}
        noun={["player", "players"]}
      />
    </div>
  );
}

/** The main board, then one per category. The main one lives at the bare URL. */
function BoardSwitch({ current }: { current: string | null }) {
  const boards = [
    { href: "/leaderboard", label: "Main", category: null as string | null },
    ...CATEGORIES.map((c) => ({
      href: "/leaderboard?board=" + categorySlug(c),
      label: shortCategory(c),
      category: c,
    })),
  ];
  return (
    <nav className="tabs" aria-label="Leaderboards">
      {boards.map((b) => (
        <Link
          key={b.href}
          href={b.href}
          scroll={false}
          aria-current={b.category === current ? "page" : undefined}
        >
          {b.label}
        </Link>
      ))}
    </nav>
  );
}

function RankTable({
  rows,
  tallies,
  me,
}: {
  rows: RankingRow[];
  tallies: Map<number, PlayerTally>;
  me: number | null;
}) {
  return (
    <div className="table-wrap">
      <table className="board">
        <thead>
          <tr>
            <th className="b-rank">#</th>
            <th>Player</th>
            <th>Level</th>
            <th className="r">EXP</th>
            <th className="r hide-sm">Clears</th>
            <th className="r hide-sm">FCs</th>
            <th className="r hide-sm"><GradeLetter grade="SSS" size="sm" /></th>
            <th className="r hide-sm"><GradeLetter grade="SS" size="sm" /></th>
            <th className="r hide-sm"><GradeLetter grade="S" size="sm" /></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const t = tallies.get(r.userId) ?? NO_TALLY;
            const tier = tierByOrder(r.tierOrder);
            const next = tierByOrder(tier ? tier.order + 1 : 1);
            return (
              <tr key={r.userId} data-me={r.userId === me || undefined} data-top={r.rank <= 3 ? r.rank : undefined}>
                <td className="b-rank">#{fmt(r.rank)}</td>
                <td>
                  <Link className="b-player" href={"/u/" + r.osuUserId}>
                    {r.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="av" src={r.avatarUrl} alt="" loading="lazy" />
                    ) : (
                      <span className="av" />
                    )}
                    <Flag code={r.countryCode} />
                    <span>{r.username}</span>
                  </Link>
                </td>
                <td>
                  <span
                    className="b-level"
                    style={{ "--fill": tier ? tierFill(tier) : "#777" } as CSSProperties}
                    title={next ? progressText(r.progress) + " to " + next.name : "Top pack"}
                  >
                    <span className="dot" style={{ background: tier ? tierFill(tier) : "transparent" }} />
                    <span className="b-level-name">{tier ? tier.name : "Unranked"}</span>
                    <span className="b-bar">
                      <i style={{ width: (next ? r.progress ?? 0 : 100) + "%" }} />
                    </span>
                  </span>
                </td>
                <td className="r b-exp">{fmt(r.exp)}</td>
                <td className="r hide-sm">{fmt(t.clears)}</td>
                <td className="r hide-sm">{fmt(t.fcs)}</td>
                <td className="r hide-sm">{fmt(t.sss)}</td>
                <td className="r hide-sm">{fmt(t.ss)}</td>
                <td className="r hide-sm">{fmt(t.s)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
