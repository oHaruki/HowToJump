"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { explainShare, type ShareSteps } from "@/lib/grading";
import { levelValue, progressText, type Place } from "@/lib/levels";
import { normalizeCategory, shortCategory, tierByOrder, tierFill, type Tier } from "@/lib/tiers";
import { ladderPosition } from "@/components/LevelView";
import { GradeLetter } from "@/components/ui";
import { CountUp } from "@/components/CountUp";

/**
 * The level up popup, shown when a player returns to their profile having
 * gained EXP or reached a pack. Waits for the tab to be showing and focused
 * before it offers anything, and plays only when the button is pressed.
 * Marked as seen on close, so leaving it unopened keeps it waiting.
 */

type Level = { exp: number; tierOrder: number | null; progress: number | null };
type Snapshot = Record<string, Level>;

/** A score since the last look, with what it takes to explain its EXP. */
export type EarnedPlay = {
  scoreId: number;
  title: string;
  version: string | null;
  mod: string;
  tierOrder: number;
  categories: string[];
  grade: string;
  missCount: number;
  accuracy: number | null;
  noteCount: number | null;
  osuBeatmapsetId: number | null;
  exp: number;
  places: Place[];
  fresh: "new" | "improved";
};

const fmt = (n: number) => Math.round(n).toLocaleString("en");
const UNRANKED: Level = { exp: 0, tierOrder: null, progress: 0 };

/** Slow start, quick middle, soft landing: a fill you can watch. */
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

type Change = { scope: string; label: string; from: Level; to: Level; gain: number; rankedUp: boolean };

function changesBetween(
  before: Snapshot,
  after: Snapshot,
  scopes: Array<{ scope: string; label: string }>,
): Change[] {
  return scopes.map(({ scope, label }) => {
    const from = before[scope] ?? UNRANKED;
    const to = after[scope] ?? UNRANKED;
    return {
      scope,
      label,
      from,
      to,
      gain: to.exp - from.exp,
      rankedUp: (to.tierOrder ?? 0) > (from.tierOrder ?? 0),
    };
  });
}

/** "Topaz 7/100%", or "GOAT" at the top pack. */
function describe(level: Level): string {
  const tier = tierByOrder(level.tierOrder);
  if (tier && level.progress == null) return tier.name;
  return (tier ? tier.name : "Unranked") + " " + progressText(level.progress);
}

function send(snapshot: Snapshot, renderedAt: string, beacon: boolean) {
  const body = new Blob([JSON.stringify({ snapshot, renderedAt })], { type: "application/json" });
  if (beacon && navigator.sendBeacon?.("/api/me/seen", body)) return;
  void fetch("/api/me/seen", { method: "POST", body, keepalive: true });
}

export function LevelUp({
  before,
  after,
  scopes,
  newScores,
  improved,
  earned,
  firstLook,
  renderedAt,
}: {
  /** The levels as last seen, or all unranked on a first visit. */
  before: Snapshot;
  after: Snapshot;
  /** The main level first, then the categories, with their labels. */
  scopes: Array<{ scope: string; label: string }>;
  newScores: number;
  improved: number;
  /** The new and improved scores, most EXP first. */
  earned: EarnedPlay[];
  firstLook: boolean;
  renderedAt: string;
}) {
  // Acknowledged here but maybe not yet stored when the page next refreshes;
  // it stands in for `before` until the server has caught up.
  const [local, setLocal] = useState<Snapshot | null>(null);
  const beforeKey = JSON.stringify(before);
  useEffect(() => {
    if (local && JSON.stringify(local) === beforeKey) setLocal(null);
  }, [beforeKey, local]);

  const base = local ?? before;
  const baseKey = JSON.stringify(base);
  const afterKey = JSON.stringify(after);
  const changes = useMemo(
    () => changesBetween(base, after, scopes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseKey, afterKey],
  );
  const main = changes[0];
  const noteworthy = main.gain > 0 || changes.some((c) => c.rankedUp);

  const [open, setOpen] = useState(false);
  // Frozen when the player presses play, so a refresh mid-animation cannot
  // change what is being shown.
  const [playing, setPlaying] = useState<{
    changes: Change[];
    after: Snapshot;
    renderedAt: string;
    earned: EarnedPlay[];
  } | null>(null);

  // Open once the player is actually looking: tab showing, window focused.
  useEffect(() => {
    if (!noteworthy || open) return;
    const tryOpen = () => {
      if (document.visibilityState === "visible" && document.hasFocus()) setOpen(true);
    };
    tryOpen();
    window.addEventListener("focus", tryOpen);
    document.addEventListener("visibilitychange", tryOpen);
    return () => {
      window.removeEventListener("focus", tryOpen);
      document.removeEventListener("visibilitychange", tryOpen);
    };
  }, [noteworthy, open]);

  // Nothing to celebrate: the visit is marked seen when the player leaves,
  // so scores marked new stay marked while they are on the page.
  const latest = useRef({ after, renderedAt, noteworthy });
  latest.current = { after, renderedAt, noteworthy };
  const pending = useRef<number | undefined>(undefined);
  useEffect(() => {
    const leave = () => {
      if (!latest.current.noteworthy) send(latest.current.after, latest.current.renderedAt, true);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") leave();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", leave);
    // Development mounts twice; the second mount cancels the first unmount's
    // send, so only a real exit records anything.
    window.clearTimeout(pending.current);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", leave);
      pending.current = window.setTimeout(leave, 0);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const close = () => {
    const seen = playing ?? { after, renderedAt };
    send(seen.after, seen.renderedAt, false);
    setLocal(seen.after);
    setPlaying(null);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!open) return null;

  const shown = playing?.changes ?? changes;
  const mainTier = tierByOrder(shown[0].to.tierOrder);
  return (
    <div className="lu-backdrop">
      <div
        className="lu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lu-title"
        style={{ "--tier": mainTier ? mainTier.color : "#777" } as CSSProperties}
      >
        {playing ? (
          <Celebration changes={playing.changes} earned={playing.earned} onClose={close} />
        ) : (
          <Summary
            changes={changes}
            firstLook={firstLook}
            newScores={newScores}
            improved={improved}
            onPlay={() => setPlaying({ changes, after, renderedAt, earned })}
            onSkip={close}
          />
        )}
      </div>
    </div>
  );
}

function Gem({ tier, size = 18 }: { tier: Tier | null; size?: number }) {
  return (
    <span
      className="lu-dot"
      data-empty={tier ? undefined : true}
      style={{ width: size, height: size, background: tier ? tierFill(tier) : undefined }}
    />
  );
}

/** What changed, before anything moves. */
function Summary({
  changes,
  firstLook,
  newScores,
  improved,
  onPlay,
  onSkip,
}: {
  changes: Change[];
  firstLook: boolean;
  newScores: number;
  improved: number;
  onPlay: () => void;
  onSkip: () => void;
}) {
  const [main, ...cats] = changes;
  const moved = cats.filter((c) => c.gain > 0 || c.rankedUp);
  const counts = [
    newScores ? newScores + (newScores === 1 ? " new score" : " new scores") : "",
    improved ? improved + " improved" : "",
  ].filter(Boolean);
  const sameTier = main.from.tierOrder === main.to.tierOrder;
  // "Topaz 7/100% → 93/100%" within a pack; at the top there is no way to
  // go, so just the pack.
  const within = main.to.progress == null
    ? describe(main.to)
    : describe(main.from) + " → " + progressText(main.to.progress);

  return (
    <>
      <span className="lu-kicker">{firstLook ? "Your levels are in" : "Since you last looked"}</span>
      <h2 id="lu-title" className="lu-headline">
        +{fmt(main.gain)}
        <small>EXP</small>
      </h2>
      {!firstLook && counts.length ? <p className="lu-sub">{counts.join(" · ")}</p> : null}
      <ul className="lu-list">
        <li
          data-up={main.rankedUp || undefined}
          style={{ "--tint": tierByOrder(main.to.tierOrder)?.color ?? "#777" } as CSSProperties}
        >
          <Gem tier={tierByOrder(main.to.tierOrder)} />
          <b>Main level</b>
          <span>
            {sameTier ? (
              within
            ) : (
              <>
                {describe(main.from)} → <em>{describe(main.to)}</em>
              </>
            )}
          </span>
        </li>
        {moved.map((c, i) => {
          const tier = tierByOrder(c.to.tierOrder);
          return (
            <li
              key={c.scope}
              data-up={c.rankedUp || undefined}
              style={{ "--tint": tier?.color ?? "#777", animationDelay: 120 + i * 70 + "ms" } as CSSProperties}
            >
              <Gem tier={tier} />
              <b>{c.label}</b>
              <span>
                {c.rankedUp ? (
                  <>
                    {tierByOrder(c.from.tierOrder)?.name ?? "Unranked"} → <em>{tier?.name}</em>
                  </>
                ) : (
                  "+" + fmt(c.gain) + " EXP"
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="lu-actions">
        <button className="btn lu-go" type="button" autoFocus onClick={onPlay}>
          Show me
        </button>
        <button className="btn btn-ghost" type="button" onClick={onSkip}>
          Skip
        </button>
      </div>
    </>
  );
}

/**
 * A value walked from one point on the ladder to another once `run` turns
 * true, and snapped to the end on `skip`. Not stopped by reduced motion —
 * the bar is the content; the bursts around it are what that turns off.
 */
function useFill(
  from: number[],
  to: number[],
  opts: { run: boolean; delay: number; duration: number; skip: boolean; onDone: () => void },
): number[] {
  const [k, setK] = useState(0);
  const finished = useRef(false);
  const onDone = useRef(opts.onDone);
  onDone.current = opts.onDone;

  useEffect(() => {
    if (!opts.run) return;
    const finish = () => {
      if (finished.current) return;
      finished.current = true;
      onDone.current();
    };
    if (opts.skip) {
      setK(1);
      finish();
      return;
    }
    let raf = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / opts.duration);
      setK(t);
      if (t < 1) raf = requestAnimationFrame(step);
      else finish();
    };
    const timer = window.setTimeout(() => {
      raf = requestAnimationFrame(step);
    }, opts.delay);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
    // Restarts only when it is told to run or to skip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.run, opts.skip]);

  const e = easeInOut(k);
  return to.map((t, i) => (k >= 1 ? t : from[i] + (t - from[i]) * e));
}

/** Counts every pack a moving value passes, to restart the burst each time. */
function useRankUps(tier: Tier | null): number {
  const [pops, setPops] = useState(0);
  const last = useRef(tier?.order ?? 0);
  useEffect(() => {
    const now = tier?.order ?? 0;
    if (now > last.current) setPops((p) => p + 1);
    last.current = now;
  }, [tier]);
  return pops;
}

const SPARKS = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2 + (i % 3) * 0.17;
  const d = 58 + ((i * 37) % 46);
  return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, rot: (i * 47) % 360, delay: (i % 4) * 25 };
});

/** Sparks and a shockwave out of a gem, in the colour of the pack reached. */
function Burst({ small }: { small?: boolean }) {
  const scale = small ? 0.55 : 1;
  return (
    <span className={"burst" + (small ? " sm" : "")} aria-hidden>
      <b />
      {SPARKS.map((s, i) => (
        <i
          key={i}
          style={
            {
              "--dx": s.dx * scale + "px",
              "--dy": s.dy * scale + "px",
              "--rot": s.rot + "deg",
              animationDelay: s.delay + "ms",
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

/**
 * The played part: the main level first, then each category that moved,
 * then each new score in turn.
 */
function Celebration({
  changes,
  earned,
  onClose,
}: {
  changes: Change[];
  earned: EarnedPlay[];
  onClose: () => void;
}) {
  const [main, ...cats] = changes;
  const moved = cats.filter((c) => c.gain > 0 || c.rankedUp);
  const [skip, setSkip] = useState(false);
  const [mainDone, setMainDone] = useState(false);
  const [catsDone, setCatsDone] = useState(0);
  // Which score is showing, or -1 while the levels are.
  const [page, setPage] = useState(-1);
  const done = mainDone && catsDone >= moved.length;

  if (page >= 0) {
    return (
      <ScorePage plays={earned} index={page} onNext={() => setPage(page + 1)} onClose={onClose} />
    );
  }

  return (
    <>
      <MainFill change={main} skip={skip} onDone={() => setMainDone(true)} />
      {moved.length ? (
        <div className="lu-cats">
          {moved.map((c, i) => (
            <CategoryFill
              key={c.scope}
              change={c}
              run={mainDone}
              delay={250 + i * 650}
              skip={skip}
              onDone={() => setCatsDone((n) => n + 1)}
            />
          ))}
        </div>
      ) : null}
      <div className="lu-actions">
        {done ? (
          <button
            className="btn lu-go"
            type="button"
            autoFocus
            onClick={earned.length ? () => setPage(0) : onClose}
          >
            {earned.length ? "Next" : "Nice"}
          </button>
        ) : (
          <button className="btn btn-ghost" type="button" onClick={() => setSkip(true)}>
            Skip
          </button>
        )}
      </div>
    </>
  );
}

function MainFill({ change, skip, onDone }: { change: Change; skip: boolean; onDone: () => void }) {
  const from = levelValue(change.from);
  const to = levelValue(change.to);
  // Longer for a longer climb, so every pack reached gets its moment.
  const duration = Math.min(6500, 1800 + 1100 * Math.abs(to - from));
  const [value, exp] = useFill([from, change.from.exp], [to, change.to.exp], {
    run: true,
    delay: 450,
    duration,
    skip,
    onDone,
  });
  const { tier, next, into } = ladderPosition(value);
  const pops = useRankUps(tier);
  const landed = value === to;
  const progress = landed ? change.to.progress ?? 0 : Math.min(99, Math.floor(into + 1e-6));

  return (
    <div
      className="lu-main"
      style={
        {
          "--tier": tier ? tier.color : "#777",
          "--fill": tier ? tierFill(tier) : "#777",
          "--next": next ? next.color : "#777",
        } as CSSProperties
      }
    >
      <span className="lu-kicker">Main level</span>
      <div className="lu-hero">
        <span className="lu-gemwrap">
          <span
            key={"gem" + pops}
            className={"lu-gem" + (pops ? " pop" : "")}
            style={tier ? { background: tierFill(tier) } : undefined}
            data-empty={tier ? undefined : true}
          />
          {pops ? <Burst key={"burst" + pops} /> : null}
        </span>
        <span className="lu-tiername">
          <span key={tier?.order ?? 0} className="lu-name">
            {tier ? tier.name : "Unranked"}
          </span>
          {pops ? (
            <span key={"up" + pops} className="lu-ribbon">
              Rank up!
            </span>
          ) : null}
        </span>
        <span className="lu-exp">
          <b>+{fmt(exp - change.from.exp)}</b>
          <small>EXP</small>
        </span>
      </div>
      <div className="lu-bar" data-live={landed ? undefined : true}>
        <i style={{ width: into + "%" }} />
        {pops ? <span key={"flash" + pops} className="lu-flash" /> : null}
      </div>
      <div className="lu-foot">
        <span>
          {next ? (
            <>
              {progressText(progress)} to <b>{next.name}</b>
            </>
          ) : (
            "Top pack"
          )}
        </span>
        <span>{fmt(exp)} EXP</span>
      </div>
    </div>
  );
}

function CategoryFill({
  change,
  run,
  delay,
  skip,
  onDone,
}: {
  change: Change;
  run: boolean;
  delay: number;
  skip: boolean;
  onDone: () => void;
}) {
  const from = levelValue(change.from);
  const to = levelValue(change.to);
  const duration = Math.min(4200, 1300 + 900 * Math.abs(to - from));
  const [value, exp] = useFill([from, change.from.exp], [to, change.to.exp], {
    run,
    delay,
    duration,
    skip,
    onDone,
  });
  const { tier, into } = ladderPosition(value);
  const pops = useRankUps(tier);
  const moving = run && value !== to;

  return (
    <div
      className="lu-cat"
      data-live={run || undefined}
      data-moving={moving || undefined}
      style={
        {
          "--tier": tier ? tier.color : "#777",
          "--fill": tier ? tierFill(tier) : "#777",
        } as CSSProperties
      }
    >
      <span className="lu-cat-label">{change.label}</span>
      <span className="lu-cat-tier">
        <span className="lu-gemwrap sm">
          <span
            key={"gem" + pops}
            className={"lu-gem" + (pops ? " pop" : "")}
            style={tier ? { background: tierFill(tier) } : undefined}
            data-empty={tier ? undefined : true}
          />
          {pops ? <Burst key={"burst" + pops} small /> : null}
        </span>
        <span key={tier?.order ?? 0} className="lu-name sm">
          {tier ? tier.name : "Unranked"}
        </span>
        {pops ? (
          <span key={"up" + pops} className="lu-ribbon sm">
            Rank up
          </span>
        ) : null}
      </span>
      <span className="lu-cat-bar">
        <i style={{ width: into + "%" }} />
      </span>
      <span className="lu-cat-exp">+{fmt(exp - change.from.exp)}</span>
    </div>
  );
}

/** Up to two decimals, with no trailing zeros. */
const num = (n: number) => String(Math.round(n * 100) / 100);
const pct = (n: number) => num(n) + "%";

/** One new score and what earned its EXP, with a button on to the next. */
function ScorePage({
  plays,
  index,
  onNext,
  onClose,
}: {
  plays: EarnedPlay[];
  index: number;
  onNext: () => void;
  onClose: () => void;
}) {
  const last = index >= plays.length - 1;
  return (
    <>
      <span className="lu-kicker">
        Where the EXP came from
        {plays.length > 1 ? " · " + (index + 1) + " of " + plays.length : ""}
      </span>
      <EarnedCard key={plays[index].scoreId} play={plays[index]} />
      {plays.length > 1 ? (
        <div className="lu-dots" aria-hidden>
          {plays.map((p, i) => (
            <i key={p.scoreId} data-on={i === index || undefined} />
          ))}
        </div>
      ) : null}
      <div className="lu-actions">
        <button className="btn lu-go" type="button" autoFocus onClick={last ? onClose : onNext}>
          {last ? "Nice" : "Next"}
        </button>
        {last ? null : (
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Skip
          </button>
        )}
      </div>
    </>
  );
}

function EarnedCard({ play: p }: { play: EarnedPlay }) {
  const tier = tierByOrder(p.tierOrder);
  const steps = explainShare(p.grade, p.missCount, p.noteCount, p.accuracy);
  const tiles = stepTiles(steps, p);
  const places = new Map(p.places.map((x) => [x.category, x.place]));
  const skills = Array.from(new Set(p.categories.map((c) => normalizeCategory(c))));

  return (
    <div
      className="lu-earn"
      style={{ "--tint": tier?.color ?? "#777", "--fill": tierFill(tier) } as CSSProperties}
    >
      <div className="lu-earn-art">
        {p.osuBeatmapsetId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={"https://assets.ppy.sh/beatmaps/" + p.osuBeatmapsetId + "/covers/card.jpg"}
            alt=""
            decoding="async"
          />
        ) : null}
      </div>
      <div className="lu-earn-head">
        <GradeLetter grade={p.grade} />
        <div className="lu-earn-map">
          <b>
            {p.title}
            {p.version ? <span> [{p.version}]</span> : null}
            {p.mod !== "NM" ? " +" + p.mod : null}
          </b>
          <span>
            {p.fresh === "new" ? "New score" : "Improved"} · {tier?.name}
          </span>
        </div>
        <span className="lu-earn-exp">
          +<CountUp value={Math.round(p.exp)} format={fmt} durationMs={1000} />
          <small>EXP</small>
        </span>
      </div>
      <div className="lu-earn-bar">
        <i style={{ width: Math.min(100, steps.share) + "%" }} />
      </div>
      <span className="lu-earn-of">
        {pct(steps.share)} of {tier?.name}&apos;s {fmt(tier?.exp ?? 0)}
      </span>
      <ol className="lu-earn-steps" style={{ "--n": tiles.length } as CSSProperties}>
        {tiles.map((t) => (
          <li key={t.label}>
            <span>{t.label}</span>
            <b data-kind={t.kind}>{t.value}</b>
            <small>{t.note}</small>
          </li>
        ))}
      </ol>
      <div className="lu-earn-skills">
        {skills.map((c) =>
          places.has(c) ? (
            <span key={c} data-counts>
              {shortCategory(c)} #{places.get(c)}
            </span>
          ) : (
            <span key={c}>{shortCategory(c)} · outside top 10</span>
          ),
        )}
      </div>
    </div>
  );
}

type Tile = { label: string; value: string; note: string; kind?: "gain" | "share" };

/** Each step from the result to the share of the pack it earns, with the running count. */
function stepTiles(s: ShareSteps, p: EarnedPlay): Tile[] {
  const acc = p.accuracy != null ? p.accuracy.toFixed(2) + "%" : "not recorded";
  if (s.kind === "perfect") {
    return [
      { label: "Result", value: "100%", note: "every note perfect" },
      { label: "Share", value: pct(s.share), note: "the most a map pays", kind: "share" },
    ];
  }
  if (s.kind === "fc") {
    return [
      { label: "Result", value: "FC", note: "full combo" },
      { label: "Accuracy", value: "+" + pct(s.share - 100), note: acc, kind: "gain" },
      { label: "Share", value: pct(s.share), note: "of the pack", kind: "share" },
    ];
  }
  if (s.counted === 0) {
    return [
      { label: "Misses", value: "0", note: "combo broke" },
      { label: "Share", value: pct(s.share), note: "of the pack", kind: "share" },
    ];
  }
  const left = s.counted - s.wonBack;
  return [
    { label: "Misses", value: String(s.misses), note: "as played" },
    {
      label: "Length",
      value: "×" + num(s.factor),
      note: (p.noteCount ? fmt(p.noteCount) + " notes" : "not known yet") + " → " + num(s.counted),
    },
    { label: "Accuracy", value: "−" + num(s.wonBack), note: acc + " → " + num(left), kind: "gain" },
    { label: "Share", value: pct(s.share), note: "of the pack", kind: "share" },
  ];
}
