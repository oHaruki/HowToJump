import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { missFactor } from "@/lib/grading";
import { playExp } from "@/lib/levels";
import { normalizeMod } from "@/lib/mods";
import {
  getBeatmapPage, getEntryLeaderboard, getEntryPlayerCount, getEntryRankOf,
  type BeatmapEntry, type BoardScore,
} from "@/lib/queries";
import { secondsToDrain } from "@/lib/import/parse";
import { shortCategory, tierByOrder, tierFill } from "@/lib/tiers";
import { Flag, GradeLetter, ModChip, PacingChips, mapHref } from "@/components/ui";
import { timeAgo } from "@/components/PlayList";

export const dynamic = "force-dynamic";

const fmt = (n: number) => Math.round(n).toLocaleString("en");

/*
 * osu!'s own star rating colours, from blue at the easy end through green,
 * yellow and red to purple and black at the top.
 */
const STAR_STOPS: Array<[number, [number, number, number]]> = [
  [0.1, [0x42, 0x90, 0xfb]], [1.25, [0x4f, 0xc0, 0xff]], [2, [0x4f, 0xff, 0xd5]],
  [2.5, [0x7c, 0xff, 0x4f]], [3.3, [0xf6, 0xf0, 0x5c]], [4.2, [0xff, 0x80, 0x68]],
  [4.9, [0xff, 0x4e, 0x6f]], [5.8, [0xc6, 0x45, 0xb8]], [6.7, [0x65, 0x63, 0xde]],
  [7.7, [0x18, 0x15, 0x8e]], [9, [0, 0, 0]],
];

function starColour(stars: number): string {
  const s = Math.min(9, Math.max(0.1, stars));
  let i = 0;
  while (i < STAR_STOPS.length - 2 && s > STAR_STOPS[i + 1][0]) i++;
  const [a, ca] = STAR_STOPS[i];
  const [b, cb] = STAR_STOPS[i + 1];
  const k = (s - a) / (b - a);
  return "rgb(" + ca.map((c, j) => Math.round(c + (cb[j] - c) * k)).join(",") + ")";
}

/**
 * A beatmap's page, at the same ID as on osu!, laid out like osu!'s: the
 * cover and what the map is, its figures as bars, then the scoreboard. The
 * top score gets a card of its own, and so does the signed in player's best.
 * One beatmap banked under several mods gets a switch for each.
 */
export default async function BeatmapPage({
  params,
  searchParams,
}: {
  params: Promise<{ beatmapId: string }>;
  searchParams: Promise<{ mod?: string }>;
}) {
  const [{ beatmapId }, sp] = await Promise.all([params, searchParams]);
  const id = Number(beatmapId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  const banked = await getBeatmapPage(id);
  if (!banked.length) notFound();
  // Nomod first, then by pack, so a bare link opens the plainest entry.
  const choices = banked.slice().sort((a, b) => Number(b.mod === "NM") - Number(a.mod === "NM"));
  const wanted = sp.mod ? normalizeMod(sp.mod) : null;
  const map = choices.find((e) => e.mod === wanted) ?? choices[0];

  const session = await auth();
  const [board, players, mine] = await Promise.all([
    getEntryLeaderboard(map.entryId, 50),
    getEntryPlayerCount(map.entryId),
    session?.userId ? getEntryRankOf(map.entryId, session.userId) : null,
  ]);

  const tier = tierByOrder(map.tierOrder);
  const colour = tier ? tier.color : "#777";
  const expOf = (s: BoardScore) => playExp(map.tierOrder, s.grade, s.missCount, map.noteCount);

  return (
    <div className="view">
      <Header map={map} choices={choices} colour={colour} />

      <section className="sb">
        <div className="sb-head">
          <div className="section-head">
            <span className="lbl">Scoreboard</span>
            <h2>
              {fmt(players)} {players === 1 ? "player" : "players"}
            </h2>
          </div>
          <p className="small">Best grade first, then accuracy. A tie goes to whoever set it first.</p>
        </div>

        {board.length ? (
          <>
            <ScoreCard s={board[0]} exp={expOf(board[0])} setId={map.osuBeatmapsetId} kind="top" />
            {mine && mine.rank !== 1 ? (
              <ScoreCard s={mine} exp={expOf(mine)} setId={map.osuBeatmapsetId} kind="mine" />
            ) : null}
            <Scoreboard scores={board} expOf={expOf} me={session?.userId ?? null} />
          </>
        ) : (
          <div className="sb-empty">
            <GradeLetter grade="S" big />
            <p>Nobody has a score on this map yet. The top spot is open.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Header({
  map,
  choices,
  colour,
}: {
  map: BeatmapEntry;
  choices: BeatmapEntry[];
  colour: string;
}) {
  const tier = tierByOrder(map.tierOrder);
  const osuUrl = map.osuBeatmapsetId
    ? "https://osu.ppy.sh/beatmapsets/" + map.osuBeatmapsetId + "#osu/" + map.osuBeatmapId
    : "https://osu.ppy.sh/b/" + map.osuBeatmapId;
  const stars = map.stars ?? 0;
  const high = stars >= 6.5;
  const bars: Array<[string, number | null, string]> = [
    ["Stars", map.stars, map.stars != null ? map.stars.toFixed(2) : "·"],
    ["CS", map.cs, map.cs != null ? String(map.cs) : "·"],
    ["AR", map.ar, map.ar != null ? String(map.ar) : "·"],
    ["OD", map.od, map.od != null ? String(map.od) : "·"],
  ];

  return (
    <header
      className="bm-head"
      style={
        {
          "--tier": colour,
          "--art-fill":
            "linear-gradient(120deg, color-mix(in srgb, " + colour + " 30%, var(--bg-d)), var(--bg-b))",
        } as CSSProperties
      }
    >
      <div className="bm-art">
        {map.osuBeatmapsetId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={"https://assets.ppy.sh/beatmaps/" + map.osuBeatmapsetId + "/covers/cover.jpg"}
            alt=""
            decoding="async"
          />
        ) : null}
      </div>

      <div className="bm-in">
        <div className="bm-top">
          <Link className="lbl bm-back" href="/maps">
            ← Map bank
          </Link>
          {choices.length > 1 ? (
            <nav className="bm-mods" aria-label="Banked under">
              {choices.map((e) => (
                <Link
                  key={e.entryId}
                  href={mapHref(e.osuBeatmapId, e.mod)}
                  aria-current={e.entryId === map.entryId ? "page" : undefined}
                >
                  {e.mod}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>

        <div className="bm-main">
          <div className="bm-info">
            {map.stars != null ? (
              <span
                className="bm-star"
                style={{ background: starColour(stars), color: high ? "#ffd966" : "#000000bf" } as CSSProperties}
              >
                ★ {stars.toFixed(2)}
              </span>
            ) : null}
            <h1 className="bm-title">{map.title}</h1>
            {map.artist ? <p className="bm-artist">{map.artist}</p> : null}
            <p className="bm-diff">
              {map.version ? <b>{map.version}</b> : null}
              {map.mapper ? <span> mapped by {map.mapper}</span> : null}
            </p>
            <div className="row-tight">
              <span className="chip chip-tier">
                <span className="dot" style={{ background: tierFill(tier) }} />
                {tier ? tier.name : "unassigned"}
              </span>
              <ModChip mod={map.mod} />
              {map.categories.map((c) => (
                <span key={c} className="chip">{shortCategory(c)}</span>
              ))}
              <PacingChips length={map.lengthBucket} speed={map.speedBucket} />
            </div>
            <div className="row-tight bm-actions">
              <a className="btn" href={osuUrl} target="_blank" rel="noopener noreferrer">
                osu! page ↗
              </a>
              <a className="btn btn-ghost" href={"osu://b/" + map.osuBeatmapId}>
                osu!direct
              </a>
            </div>
          </div>

          <aside className="bm-panel">
            <div className="bm-quick">
              <span>
                <i>Length</i>
                <b>{secondsToDrain(map.drainSeconds) || "·"}</b>
              </span>
              <span>
                <i>BPM</i>
                <b>{map.bpm != null ? Math.round(map.bpm) : "·"}</b>
              </span>
              <span>
                <i>Max combo</i>
                <b>{map.maxCombo != null ? fmt(map.maxCombo) + "x" : "·"}</b>
              </span>
            </div>
            <div className="bm-bars">
              {bars.map(([label, value, text]) => (
                <div className="bm-bar" key={label} data-stars={label === "Stars" || undefined}>
                  <span>{label}</span>
                  <span className="bm-track">
                    <i style={{ width: Math.min(100, ((value ?? 0) / 10) * 100) + "%" }} />
                  </span>
                  <b>{text}</b>
                </div>
              ))}
            </div>
            <div className="bm-worth">
              <span>A full combo here is worth</span>
              <b>{fmt(playExp(map.tierOrder, "SS", 0))} EXP</b>
            </div>
            {map.noteCount ? <MissNote notes={map.noteCount} /> : null}
          </aside>
        </div>
      </div>
    </header>
  );
}

function Player({ s, avatar }: { s: BoardScore; avatar?: boolean }) {
  return (
    <Link className="sb-player" href={"/u/" + s.osuUserId}>
      {avatar ? (
        s.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="av" src={s.avatarUrl} alt="" loading="lazy" />
        ) : (
          <span className="av" />
        )
      ) : null}
      <Flag code={s.countryCode} />
      <span>{s.username}</span>
    </Link>
  );
}

/**
 * What a miss costs here. Misses count for more on short maps and less on
 * long ones, against a 1,500 note map; the grade itself stays the real count.
 */
function MissNote({ notes }: { notes: number }) {
  const f = missFactor(notes);
  return (
    <p className="bm-misses">
      {fmt(notes)} notes, so each miss counts as{" "}
      <b>×{f >= 1 ? f.toFixed(1) : f.toFixed(2)}</b> in EXP
    </p>
  );
}

/** The top score, or the signed in player's best, as osu! cards them. */
function ScoreCard({
  s,
  exp,
  setId,
  kind,
}: {
  s: BoardScore;
  exp: number;
  setId: number | null;
  kind: "top" | "mine";
}) {
  return (
    <article className="sb-card" data-kind={kind}>
      <div className="sb-card-art">
        {setId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={"https://assets.ppy.sh/beatmaps/" + setId + "/covers/cover.jpg"} alt="" loading="lazy" />
        ) : null}
      </div>
      <div className="sb-card-in">
        <div className="sb-card-place">
          <span className="sb-card-kind">{kind === "top" ? "Top score" : "Your best"}</span>
          <span className="sb-card-rank">#{fmt(s.rank)}</span>
        </div>
        <GradeLetter grade={s.grade} big />
        <div className="sb-card-who">
          {s.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="sb-card-av" src={s.avatarUrl} alt="" />
          ) : (
            <span className="sb-card-av" />
          )}
          <div>
            <Link className="sb-card-name" href={"/u/" + s.osuUserId}>
              <Flag code={s.countryCode} />
              <span>{s.username}</span>
            </Link>
            <span className="small">Set {timeAgo(s.playedAt)}</span>
          </div>
        </div>
        <dl className="sb-card-stats">
          <div>
            <dt>Accuracy</dt>
            <dd>{s.accuracy != null ? s.accuracy.toFixed(2) + "%" : "·"}</dd>
          </div>
          <div>
            <dt>Max combo</dt>
            <dd data-fc={s.isFc || undefined}>{s.maxCombo != null ? fmt(s.maxCombo) + "x" : "·"}</dd>
          </div>
          <div>
            <dt>Misses</dt>
            <dd>{s.missCount}</dd>
          </div>
          <div>
            <dt>Mods</dt>
            <dd>
              <ModChip mod={s.mods} />
            </dd>
          </div>
          <div>
            <dt>EXP</dt>
            <dd className="sb-card-exp">{fmt(exp)}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

/** Every score, a row each, the way osu!'s beatmap scoreboard lists them. */
function Scoreboard({
  scores,
  expOf,
  me,
}: {
  scores: BoardScore[];
  expOf: (s: BoardScore) => number;
  me: number | null;
}) {
  return (
    <div className="sb-list" role="table" aria-label="Scoreboard">
      <div className="sb-row sb-cols" role="row">
        <span role="columnheader">Rank</span>
        <span role="columnheader" className="c">Grade</span>
        <span role="columnheader" className="c">Accuracy</span>
        <span role="columnheader">Player</span>
        <span role="columnheader" className="c sb-opt">Max combo</span>
        <span role="columnheader" className="c sb-opt">Misses</span>
        <span role="columnheader" className="c sb-end">EXP</span>
        <span role="columnheader" className="r sb-opt">Set</span>
        <span role="columnheader" className="r sb-opt">Mods</span>
      </div>
      {scores.map((s) => (
        <div
          className="sb-row"
          role="row"
          key={s.scoreId}
          data-me={s.userId === me || undefined}
          data-top={s.rank <= 3 ? s.rank : undefined}
        >
          <span role="cell" className="sb-rank">#{fmt(s.rank)}</span>
          <span role="cell" className="c">
            <GradeLetter grade={s.grade} />
          </span>
          <span role="cell" className="c sb-num">
            {s.accuracy != null ? s.accuracy.toFixed(2) + "%" : "·"}
          </span>
          <span role="cell" className="sb-who">
            <Player s={s} avatar />
          </span>
          <span role="cell" className="c sb-num sb-opt" data-fc={s.isFc || undefined}>
            {s.maxCombo != null ? fmt(s.maxCombo) + "x" : "·"}
          </span>
          <span role="cell" className="c sb-num sb-opt" data-zero={s.missCount === 0 || undefined}>
            {s.missCount}
          </span>
          <span role="cell" className="c sb-num sb-exp sb-end">{fmt(expOf(s))}</span>
          <span role="cell" className="r small sb-opt">{timeAgo(s.playedAt)}</span>
          <span role="cell" className="r sb-opt">
            <ModChip mod={s.mods} />
          </span>
        </div>
      ))}
    </div>
  );
}
