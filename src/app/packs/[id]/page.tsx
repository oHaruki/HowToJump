import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  RANKING_PAGE_SIZE, getBank, getPackScoresOf, getPackStandings, getSpecialPack,
  type PackRankingRow,
} from "@/lib/queries";
import { playExp } from "@/lib/levels";
import { BankCard } from "@/components/MapList";
import { BankPager } from "@/components/BankPager";
import { LiveRefresh } from "@/components/LiveRefresh";
import { Flag, GradeLetter, NONE } from "@/components/ui";

export const dynamic = "force-dynamic";

const fmt = (n: number) => Math.round(n).toLocaleString("en");

type Params = Promise<{ id: string }>;

async function findPack(id: string) {
  const n = Number(id);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return getSpecialPack(n);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const pack = await findPack((await params).id);
  return pack ? { title: pack.name } : {};
}

/**
 * A special pack: what it is, then its maps with the signed in player's
 * score on each, or its board on the other tab. Nothing here counts toward
 * a level.
 */
export default async function SpecialPackPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ page?: string; view?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const pack = await findPack(id);
  if (!pack) notFound();

  const board = sp.view === "board";
  const session = await auth();
  const [maps, mine] = await Promise.all([
    getBank({ specialPack: pack.id }),
    session?.userId ? getPackScoresOf(pack.id, session.userId) : null,
  ]);
  const cleared = mine ? maps.filter((m) => mine.has(m.entryId)).length : 0;
  const href = "/packs/" + pack.id;

  return (
    <div className="view">
      <LiveRefresh />

      <div className="stack">
        <Link className="lbl bm-back" href="/ladder">
          ← Packs
        </Link>
        <section
          className="pk pk-lg"
          style={{ "--pack": pack.color, "--fill": pack.color } as CSSProperties}
        >
          <div className="pk-top">
            <span className="pk-gem" style={{ background: pack.color }} />
            <div className="pk-who">
              <span className="lbl">Special pack</span>
              <h1>{pack.name}</h1>
            </div>
          </div>
          {pack.description ? <p className="lede">{pack.description}</p> : null}
          {mine && maps.length ? (
            <div className="pk-bar">
              <i style={{ width: (cleared / maps.length) * 100 + "%" }} />
            </div>
          ) : null}
          <span className="pk-count">
            {mine ? cleared + " / " : ""}
            {maps.length} {maps.length === 1 ? "map" : "maps"}
            {mine ? " cleared" : ""} {NONE} its EXP doesn&apos;t count toward your level
          </span>
        </section>
      </div>

      <div className="stack-lg">
        <nav className="tabs" aria-label={pack.name}>
          <Link href={href} scroll={false} aria-current={board ? undefined : "page"}>
            Maps
          </Link>
          <Link href={href + "?view=board"} scroll={false} aria-current={board ? "page" : undefined}>
            Leaderboard
          </Link>
        </nav>

        {board ? (
          <Board
            packId={pack.id}
            page={Number(sp.page) || 1}
            me={session?.userId ?? null}
            mapCount={maps.length}
          />
        ) : maps.length ? (
          <div className="review-list" style={{ "--pack": pack.color } as CSSProperties}>
            {maps.map((m) => {
              const s = mine?.get(m.entryId);
              return (
                <BankCard
                  key={m.entryId}
                  map={m}
                  tone={mine && !s ? "muted" : undefined}
                  score={
                    s ? (
                      <Score s={s} />
                    ) : mine ? (
                      <span className="mapcard-score-none">Not cleared</span>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        ) : (
          <p className="small">No maps in this pack yet.</p>
        )}
      </div>
    </div>
  );
}

/** A pack's board, a page at a time, with the signed in player's place pinned below. */
async function Board({
  packId,
  page: asked,
  me,
  mapCount,
}: {
  packId: number;
  page: number;
  me: number | null;
  mapCount: number;
}) {
  const standings = await getPackStandings(packId);
  const total = standings.length;
  const pageCount = Math.max(1, Math.ceil(total / RANKING_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(asked)), pageCount);
  const rows = standings.slice((page - 1) * RANKING_PAGE_SIZE, page * RANKING_PAGE_SIZE);
  const mine = me == null ? null : (standings.find((s) => s.userId === me) ?? null);

  if (!rows.length) {
    return <p className="small">Nobody has a score here yet. Play any of its maps to be the first.</p>;
  }
  return (
    <>
      <PackTable rows={rows} me={me} mapCount={mapCount} />
      {mine && !rows.some((r) => r.userId === mine.userId) ? (
        <div className="stack">
          <span className="lbl">Your place</span>
          <PackTable rows={[mine]} me={mine.userId} mapCount={mapCount} />
        </div>
      ) : null}
      <BankPager
        basePath={"/packs/" + packId}
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={RANKING_PAGE_SIZE}
        query="view=board"
        noun={["player", "players"]}
      />
    </>
  );
}

function PackTable({
  rows,
  me,
  mapCount,
}: {
  rows: PackRankingRow[];
  me: number | null;
  mapCount: number;
}) {
  return (
    <div className="table-wrap">
      <table className="board">
        <thead>
          <tr>
            <th className="b-rank">#</th>
            <th>Player</th>
            <th className="r">EXP</th>
            <th className="r">Clears</th>
            <th className="r hide-sm">FCs</th>
            <th className="r hide-sm"><GradeLetter grade="SSS" size="sm" /></th>
            <th className="r hide-sm"><GradeLetter grade="SS" size="sm" /></th>
            <th className="r hide-sm"><GradeLetter grade="S" size="sm" /></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
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
              <td className="r b-exp">{fmt(r.exp)}</td>
              <td className="r">
                {r.clears} / {mapCount}
              </td>
              <td className="r hide-sm">{fmt(r.fcs)}</td>
              <td className="r hide-sm">{fmt(r.sss)}</td>
              <td className="r hide-sm">{fmt(r.ss)}</td>
              <td className="r hide-sm">{fmt(r.s)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A player's score on one map: grade, accuracy and misses, then its EXP. */
function Score({
  s,
}: {
  s: {
    tierOrder: number;
    grade: string;
    missCount: number;
    accuracy: number | null;
    noteCount: number | null;
  };
}) {
  return (
    <>
      <GradeLetter grade={s.grade} />
      <span className="mapcard-score-acc">
        {s.accuracy != null ? s.accuracy.toFixed(2) + "%" : NONE}
        <br />
        {s.missCount === 1 ? "1 miss" : s.missCount + " misses"}
      </span>
      <span className="mapcard-score-exp">
        <b>{fmt(playExp(s.tierOrder, s.grade, s.missCount, s.noteCount, s.accuracy))}</b>
        <span>EXP</span>
      </span>
    </>
  );
}
