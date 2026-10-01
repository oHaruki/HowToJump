import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { MAIN_LEVEL, progressText } from "@/lib/levels";
import {
  getPlayerTallies, getRankOf, getRankings, getTopPlays, type PlayerTally, type RankingRow,
  type TopPlay,
} from "@/lib/queries";
import {
  CATEGORIES, categoryBySlug, categorySlug, shortCategory, tierByOrder, tierFill,
} from "@/lib/tiers";
import { Flag, GradeLetter, SectionHead, mapHref } from "@/components/ui";
import { BankPager } from "@/components/BankPager";
import { LiveRefresh } from "@/components/LiveRefresh";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Leaderboard" };

const fmt = (n: number) => Math.round(n).toLocaleString("en");

const NO_TALLY: PlayerTally = { clears: 0, fcs: 0, sss: 0, ss: 0, s: 0 };

/** Players ranked by their EXP, or single plays ranked by theirs. */
type View = "players" | "scores";

/** A board's URL. Players and the main board live at the bare URL. */
function boardQuery(view: View, category: string | null): string {
  const q = new URLSearchParams();
  if (view === "scores") q.set("view", "scores");
  if (category) q.set("board", categorySlug(category));
  return q.toString();
}

const boardHref = (view: View, category: string | null) => {
  const q = boardQuery(view, category);
  return q ? "/leaderboard?" + q : "/leaderboard";
};

/**
 * The EXP leaderboards, laid out like osu!'s rankings. Players ranks each
 * player by their level's EXP; Scores ranks every play by what it earned.
 * Both read the main level by default, or one category. Your own row is
 * highlighted, and pinned below the table when it is on another page.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; board?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const category = categoryBySlug(sp.board);
  const view: View = sp.view === "scores" ? "scores" : "players";
  const page = Number(sp.page) || 1;
  const me = (await auth())?.userId ?? null;

  const nav = (
    <div className="stack">
      <ViewSwitch view={view} category={category} />
      <BoardSwitch view={view} current={category} />
    </div>
  );

  return (
    <div className="view">
      <LiveRefresh />
      <SectionHead
        title={category ? shortCategory(category) + " Leaderboard" : "Project Aim Leaderboard"}
      />
      {view === "scores" ? (
        <ScoresBoard category={category} page={page} me={me} nav={nav} />
      ) : (
        <PlayersBoard category={category} page={page} me={me} nav={nav} />
      )}
    </div>
  );
}

function ViewSwitch({ view, category }: { view: View; category: string | null }) {
  const views: Array<{ view: View; label: string }> = [
    { view: "players", label: "Players" },
    { view: "scores", label: "Scores" },
  ];
  return (
    <nav className="tabs tabs-lg" aria-label="Rank by">
      {views.map((v) => (
        <Link
          key={v.view}
          href={boardHref(v.view, category)}
          scroll={false}
          aria-current={v.view === view ? "page" : undefined}
        >
          {v.label}
        </Link>
      ))}
    </nav>
  );
}

/** The main board, then one per category. */
function BoardSwitch({ view, current }: { view: View; current: string | null }) {
  const boards = [
    { label: "Main", category: null as string | null },
    ...CATEGORIES.map((c) => ({ label: shortCategory(c), category: c })),
  ];
  return (
    <nav className="tabs" aria-label="Leaderboards">
      {boards.map((b) => (
        <Link
          key={b.label}
          href={boardHref(view, b.category)}
          scroll={false}
          aria-current={b.category === current ? "page" : undefined}
        >
          {b.label}
        </Link>
      ))}
    </nav>
  );
}

type BoardProps = { category: string | null; page: number; me: number | null; nav: ReactNode };

async function PlayersBoard({ category, page, me, nav }: BoardProps) {
  const scope = category ?? MAIN_LEVEL;
  const [board, mine] = await Promise.all([
    getRankings(scope, page),
    me ? getRankOf(me, scope) : null,
  ]);
  const mineShown = !!mine && board.rows.some((r) => r.userId === mine.userId);
  const tallies = await getPlayerTallies(
    [...board.rows.map((r) => r.userId), ...(mine && !mineShown ? [mine.userId] : [])],
    category ?? undefined,
  );

  return (
    <>
      <div className="stack-lg">
        {nav}
        {board.rows.length ? (
          <RankTable rows={board.rows} tallies={tallies} me={me} />
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
        query={boardQuery("players", category)}
        noun={["player", "players"]}
      />
    </>
  );
}

async function ScoresBoard({ category, page, me, nav }: BoardProps) {
  const board = await getTopPlays(category, page, me);
  const mineShown = !!board.mine && board.rows.some((r) => r.scoreId === board.mine!.scoreId);

  return (
    <>
      <div className="stack-lg">
        {nav}
        {board.rows.length ? (
          <ScoreTable rows={board.rows} me={me} />
        ) : (
          <p className="small">
            {category
              ? "Nobody has a score in " + category + " yet. Play any of its maps to be the first."
              : "Nobody has a score here yet. Play any map from the bank to be the first."}
          </p>
        )}
      </div>

      {board.mine && !mineShown ? (
        <div className="stack">
          <span className="lbl">Your best play</span>
          <ScoreTable rows={[board.mine]} me={me} />
        </div>
      ) : null}

      <BankPager
        basePath="/leaderboard"
        page={board.page}
        pageCount={board.pageCount}
        total={board.total}
        pageSize={board.pageSize}
        query={boardQuery("scores", category)}
        noun={["score", "scores"]}
      />
    </>
  );
}

function Avatar({ url }: { url: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="av" src={url} alt="" loading="lazy" />
  ) : (
    <span className="av" />
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
                    <Avatar url={r.avatarUrl} />
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

/** Plays ranked by EXP: who set each, on which map, and how it went. */
function ScoreTable({ rows, me }: { rows: TopPlay[]; me: number | null }) {
  return (
    <div className="table-wrap">
      <table className="board">
        <thead>
          <tr>
            <th className="b-rank">#</th>
            <th>Play</th>
            <th>Grade</th>
            <th className="r hide-sm">Accuracy</th>
            <th className="r hide-sm">Misses</th>
            <th className="r">EXP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const tier = tierByOrder(r.tierOrder);
            return (
              <tr key={r.scoreId} data-me={r.userId === me || undefined} data-top={r.rank <= 3 ? r.rank : undefined}>
                <td className="b-rank">#{fmt(r.rank)}</td>
                <td>
                  <div className="b-play">
                    <Avatar url={r.avatarUrl} />
                    <div className="b-play-text">
                      <Link className="b-play-who" href={"/u/" + r.osuUserId}>
                        <Flag code={r.countryCode} />
                        <span>{r.username}</span>
                      </Link>
                      <Link className="b-play-map" href={mapHref(r.osuBeatmapId, r.mod)}>
                        <span className="dot" style={{ background: tierFill(tier) }} title={tier?.name} />
                        <span>
                          {r.title}
                          {r.version ? " [" + r.version + "]" : ""}
                        </span>
                        {r.mod !== "NM" ? <b>+{r.mod}</b> : null}
                      </Link>
                    </div>
                  </div>
                </td>
                <td><GradeLetter grade={r.grade} size="sm" /></td>
                <td className="r hide-sm">{r.accuracy != null ? r.accuracy.toFixed(2) + "%" : "·"}</td>
                <td className="r hide-sm">{fmt(r.missCount)}</td>
                <td className="r b-exp">{fmt(r.exp)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
