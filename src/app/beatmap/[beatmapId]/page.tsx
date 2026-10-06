import { cache, type CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/roles";
import { missFactor } from "@/lib/grading";
import { playExp } from "@/lib/levels";
import { normalizeMod } from "@/lib/mods";
import {
  BOARD_ORDER_TEXT, getBeatmapPage, getEntryLeaderboard, getEntryPlayerCount,
  getEntryRankOf, getPackVotes, type BeatmapEntry, type BoardScore,
} from "@/lib/queries";
import { NO_VOTES, type VoteTally } from "@/lib/votes";
import { secondsToDrain } from "@/lib/import/parse";
import { shortCategory, tierByOrder, tierFill } from "@/lib/tiers";
import {
  Flag, GradeLetter, ModChip, ModIcons, PacingChips, SpecialChip, StaffVoteLink, mapHref,
} from "@/components/ui";
import { ScoreDelete } from "@/components/ScoreDelete";
import { CopyBeatmapId } from "@/components/CopyBeatmapId";
import { PackVote } from "@/components/PackVote";
import { timeAgo } from "@/lib/time";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

const fmt = (n: number) => Math.round(n).toLocaleString("en");

type Props = {
  params: Promise<{ beatmapId: string }>;
  searchParams: Promise<{ mod?: string }>;
};

/** Every entry banked on a beatmap, nomod first, and the one the link asks for. */
const pickEntry = cache(async (id: number, mod: string | undefined) => {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const banked = await getBeatmapPage(id);
  if (!banked.length) return null;
  const choices = banked.slice().sort((a, b) => Number(b.mod === "NM") - Number(a.mod === "NM"));
  const wanted = mod ? normalizeMod(mod) : null;
  return { choices, map: choices.find((e) => e.mod === wanted) ?? choices[0] };
});

async function entryFor({ params, searchParams }: Props) {
  const [{ beatmapId }, sp] = await Promise.all([params, searchParams]);
  return pickEntry(Number(beatmapId), sp.mod);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const picked = await entryFor(props);
  if (!picked) return {};
  const { map } = picked;
  const title = map.version ? `${map.title} [${map.version}]` : map.title;
  const facts = [
    tierByOrder(map.tierOrder)?.name,
    map.mod,
    map.stars != null ? map.stars.toFixed(2) + "★" : null,
    map.mapper ? "mapped by " + map.mapper : null,
  ].filter(Boolean).join(" · ");

  return {
    title,
    description: facts,
    openGraph: {
      siteName: SITE_NAME,
      title,
      description: facts,
      images: map.osuBeatmapsetId
        ? [{ url: "https://assets.ppy.sh/beatmaps/" + map.osuBeatmapsetId + "/covers/cover.jpg", width: 900, height: 250 }]
        : undefined,
    },
    twitter: { card: "summary_large_image" },
  };
}

/** The pack's colour, which Discord uses for the embed's side stripe. */
export async function generateViewport(props: Props): Promise<Viewport> {
  const picked = await entryFor(props);
  const tier = picked ? tierByOrder(picked.map.tierOrder) : null;
  return tier ? { themeColor: tier.color } : {};
}

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
export default async function BeatmapPage(props: Props) {
  const picked = await entryFor(props);
  if (!picked) notFound();
  const { map, choices } = picked;

  const session = await auth();
  const userId = session?.userId ?? null;
  const [board, players, mine, votes] = await Promise.all([
    getEntryLeaderboard(map.entryId, 50),
    getEntryPlayerCount(map.entryId),
    userId ? getEntryRankOf(map.entryId, userId) : null,
    getPackVotes([map.entryId], userId),
  ]);

  const tier = tierByOrder(map.tierOrder);
  const colour = tier ? tier.color : "#777";
  const expOf = (s: BoardScore) =>
    playExp(map.tierOrder, s.grade, s.missCount, map.noteCount, s.accuracy);

  return (
    <div className="view">
      <Header
        map={map}
        choices={choices}
        colour={colour}
        votes={votes.get(map.entryId) ?? NO_VOTES}
        signedIn={userId != null}
        staff={can(session, "maps.vote")}
      />

      <section className="sb">
        <div className="sb-head">
          <div className="sb-title">
            <h2>Scoreboard</h2>
            <span className="sb-count">
              {fmt(players)} {players === 1 ? "player" : "players"}
            </span>
          </div>
          <p className="small">{BOARD_ORDER_TEXT}</p>
        </div>

        {board.length ? (
          <>
            <ScoreCard s={board[0]} exp={expOf(board[0])} setId={map.osuBeatmapsetId} kind="top" />
            {mine && mine.rank !== 1 ? (
              <ScoreCard s={mine} exp={expOf(mine)} setId={map.osuBeatmapsetId} kind="mine" />
            ) : null}
            <Scoreboard
              scores={board}
              expOf={expOf}
              me={session?.userId ?? null}
              canDelete={can(session, "scores.delete")}
            />
          </>
        ) : (
          <div className="sb-empty">
            <GradeLetter grade="S" size="big" />
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
  votes,
  signedIn,
  staff,
}: {
  map: BeatmapEntry;
  choices: BeatmapEntry[];
  colour: string;
  votes: VoteTally;
  signedIn: boolean;
  /** Adds a link to the map's staff vote. */
  staff: boolean;
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
          <Link className="lbl bm-back" href={map.pack ? "/packs/" + map.pack.id : "/maps"}>
            ← {map.pack ? map.pack.name : "Map bank"}
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
              {map.pack ? <SpecialChip pack={map.pack} /> : null}
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
              <CopyBeatmapId id={map.osuBeatmapId} />
            </div>
            <div className="bm-vote">
              <span className="lbl">Right pack?</span>
              <PackVote
                key={map.entryId}
                entryId={map.entryId}
                tierOrder={map.tierOrder}
                tally={votes}
                signedIn={signedIn}
                named
              />
              {staff ? <StaffVoteLink entryId={map.entryId} /> : null}
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
            <p className="bm-misses">
              Accuracy lifts it to <b>{fmt(playExp(map.tierOrder, "SSS", 0))}</b> at 100%
            </p>
            {map.pack ? (
              <p className="bm-misses">
                It counts on the {map.pack.name} board, not toward your level
              </p>
            ) : null}
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
 * What a miss costs here: more on short maps, less on long ones, once in
 * between. The grade itself stays the real count.
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
        <GradeLetter grade={s.grade} size="big" />
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
            <dt>Misses</dt>
            <dd>{s.missCount}</dd>
          </div>
          <div>
            <dt>Max combo</dt>
            <dd data-fc={s.isFc || undefined}>{s.maxCombo != null ? fmt(s.maxCombo) + "x" : "·"}</dd>
          </div>
          <div>
            <dt>Accuracy</dt>
            <dd>{s.accuracy != null ? s.accuracy.toFixed(2) + "%" : "·"}</dd>
          </div>
          <div>
            <dt>Mods</dt>
            <dd>
              <ModIcons mod={s.mods} />
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

/**
 * Every score, a row each, the way osu!'s beatmap scoreboard lists them.
 * Anyone who may delete scores gets a delete on each row.
 */
function Scoreboard({
  scores,
  expOf,
  me,
  canDelete,
}: {
  scores: BoardScore[];
  expOf: (s: BoardScore) => number;
  me: number | null;
  canDelete: boolean;
}) {
  return (
    <div className="sb-list" role="table" aria-label="Scoreboard">
      <div className="sb-row sb-cols" role="row">
        <span role="columnheader">Rank</span>
        <span role="columnheader" className="c">Grade</span>
        <span role="columnheader" className="c">Misses</span>
        <span role="columnheader">Player</span>
        <span role="columnheader" className="c sb-opt">Max combo</span>
        <span role="columnheader" className="c sb-opt">Accuracy</span>
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
          <span role="cell" className="c sb-num" data-zero={s.missCount === 0 || undefined}>
            {s.missCount}
          </span>
          <span role="cell" className="sb-who">
            <Player s={s} avatar />
            {canDelete ? <ScoreDelete scoreId={s.scoreId} /> : null}
          </span>
          <span role="cell" className="c sb-num sb-opt" data-fc={s.isFc || undefined}>
            {s.maxCombo != null ? fmt(s.maxCombo) + "x" : "·"}
          </span>
          <span role="cell" className="c sb-num sb-opt">
            {s.accuracy != null ? s.accuracy.toFixed(2) + "%" : "·"}
          </span>
          <span role="cell" className="c sb-num sb-exp sb-end">{fmt(expOf(s))}</span>
          <span role="cell" className="r small sb-opt">{timeAgo(s.playedAt)}</span>
          <span role="cell" className="r sb-opt">
            {s.mods !== "NM" ? <ModIcons mod={s.mods} /> : null}
          </span>
        </div>
      ))}
    </div>
  );
}
