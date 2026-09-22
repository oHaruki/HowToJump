import type { CSSProperties } from "react";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userLevels, userTierProgress, users } from "@/lib/schema";
import { RANKING_PAGE_SIZE, getProfilePlays, getRankOf } from "@/lib/queries";
import { GRADE_RULES } from "@/lib/grading";
import { BEST_PLAYS, MAIN_LEVEL, levelValue } from "@/lib/levels";
import { PROFILE_SCOPES, profileLists, readSnapshot, snapshotOf } from "@/lib/progress";
import { CATEGORIES, TIERS, shortCategory, tierByOrder, tierFill } from "@/lib/tiers";
import { Flag, GradeLetter } from "@/components/ui";
import { LevelBar, SkillRadar } from "@/components/LevelView";
import { LevelUp } from "@/components/LevelUp";
import { LiveRefresh } from "@/components/LiveRefresh";
import { PlayList } from "@/components/PlayList";
import type { PlayView } from "@/components/PlayRow";
import { timeAgo } from "@/lib/time";
import { SyncButton } from "@/components/SyncButton";

const fmt = (n: number) => Math.round(n).toLocaleString("en");

/** The grades a profile counts, osu! style: the top three, then the A band. */
const GRADE_TALLY = [
  { label: "SSS", grades: ["SSS"] },
  { label: "SS", grades: ["SS"] },
  { label: "S", grades: ["S"] },
  { label: "A", grades: ["A+", "A", "A-"] },
];

/**
 * A player's profile, osu! style. The owner's own view, at /me, adds what
 * only makes sense to them: the level up popup, Sync now, the page keeping
 * itself fresh, and scores marked new since they last looked. Everyone else,
 * arriving from a leaderboard, sees the same page without those.
 */
export async function ProfileView({ userId, owner }: { userId: number; owner: boolean }) {
  const renderedAt = new Date();
  // One round trip: nothing in the batch needs the player's own row.
  const [[me], packRows, plays, levelRows, standing] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    db.select().from(userTierProgress).where(eq(userTierProgress.userId, userId)),
    getProfilePlays(userId),
    db.select().from(userLevels).where(eq(userLevels.userId, userId)),
    getRankOf(userId, MAIN_LEVEL),
  ]);

  // Where the player is, and, for the owner, where they were when they last looked.
  const current = snapshotOf(levelRows);
  const previous = owner ? readSnapshot(me?.progressSeen) : null;
  const seenAt = owner ? (me?.progressSeenAt ?? null) : null;
  const main = current[MAIN_LEVEL];
  const mainTier = tierByOrder(main.tierOrder);

  // Newest first for the history, by what they are worth for the top plays,
  // the second under the same order their places are numbered in.
  const { recent: views, top }: { recent: PlayView[]; top: PlayView[] } =
    profileLists(plays, seenAt);

  const clears = packRows.reduce((n, p) => n + p.entriesCleared, 0);
  const packsTouched = packRows.filter((p) => p.entriesCleared > 0).length;
  const hardest = tierByOrder(plays.reduce((m, p) => Math.max(m, p.tierOrder), 0));
  const byPack = new Map(packRows.map((p) => [p.tierOrder, p]));
  const banner = top[0];
  const checks = [me?.lastSyncedAt, me?.playCountCheckedAt].filter((d): d is Date => d != null);
  const lastChecked = checks.length ? new Date(Math.max(...checks.map((d) => d.getTime()))) : null;

  return (
    <div className="view">
      <LiveRefresh />
      {owner ? (
        <>
          <LevelUp
            before={previous ?? snapshotOf([])}
            after={current}
            scopes={PROFILE_SCOPES.map((scope) => ({
              scope,
              label: scope === MAIN_LEVEL ? "Main level" : shortCategory(scope),
            }))}
            newScores={views.filter((v) => v.fresh === "new").length}
            improved={views.filter((v) => v.fresh === "improved").length}
            firstLook={!previous}
            renderedAt={renderedAt.toISOString()}
          />
        </>
      ) : null}

      <header
        className="pf-head"
        style={
          {
            "--tier": mainTier ? mainTier.color : "#777",
            "--art-fill":
              "linear-gradient(120deg, color-mix(in srgb, " +
              (mainTier ? mainTier.color : "#777") +
              " 24%, var(--bg-d)), var(--bg-b))",
          } as CSSProperties
        }
      >
        <div className="pf-art">
          {banner?.osuBeatmapsetId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={"https://assets.ppy.sh/beatmaps/" + banner.osuBeatmapsetId + "/covers/cover.jpg"}
              alt=""
              decoding="async"
            />
          ) : null}
        </div>
        <div className="pf-head-in">
          <div className="pf-top">
            <div className="pf-id">
              {me?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="pf-avatar" src={me.avatarUrl} alt="" />
              ) : (
                <span className="pf-avatar" />
              )}
              <div className="pf-who">
                <span className="lbl">{owner ? "Your progression" : "Player"}</span>
                <h1 className="pf-name">{me?.username}</h1>
                <div className="pf-meta">
                  {standing ? (
                    <Link
                      className="chip pf-rank"
                      href={
                        "/leaderboard" +
                        (standing.rank > RANKING_PAGE_SIZE
                          ? "?page=" + Math.ceil(standing.rank / RANKING_PAGE_SIZE)
                          : "")
                      }
                    >
                      #{fmt(standing.rank)} on the leaderboard
                    </Link>
                  ) : null}
                  {me?.countryCode ? (
                    <span className="chip">
                      <Flag code={me.countryCode} />
                      {me.countryCode}
                    </span>
                  ) : null}
                  {me?.globalRank ? (
                    <span className="chip">#{fmt(me.globalRank)} global</span>
                  ) : null}
                  <a
                    className="chip"
                    href={"https://osu.ppy.sh/users/" + me?.osuUserId}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    osu! profile ↗
                  </a>
                  {me?.createdAt ? (
                    <span className="small">
                      Tracked since{" "}
                      {me.createdAt.toLocaleDateString("en", { month: "short", year: "numeric" })}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="pf-sync">
              {owner ? (
                <span className="live" title="This page checks for new scores every minute">
                  <i />
                  Live
                </span>
              ) : null}
              {/* When the site last looked for new plays, which is every
                  minute, rather than when it last found some to fetch. */}
              {lastChecked ? <span className="small">Checked {timeAgo(lastChecked)}</span> : null}
              {owner ? <SyncButton /> : null}
            </div>
          </div>

          <LevelBar size="lg" label="Main level" level={main} />
        </div>
      </header>

      <div className="stat-strip">
        <div className="stat">
          <b>{fmt(main.exp)}</b>
          <span>total EXP</span>
        </div>
        <div className="stat">
          <b>{fmt(clears)}</b>
          <span>maps cleared</span>
        </div>
        <div className="stat">
          <b>{fmt(plays.filter((p) => p.isFc).length)}</b>
          <span>full combos</span>
        </div>
        <div className="stat">
          <b>{packsTouched} / {TIERS.length}</b>
          <span>packs touched</span>
        </div>
        <div className="stat">
          <b className="pf-hardest">
            {hardest ? (
              <>
                <span className="dot" style={{ background: tierFill(hardest) }} />
                {hardest.name}
              </>
            ) : (
              "·"
            )}
          </b>
          <span>hardest clear</span>
        </div>
      </div>

      <div className="pf-grades">
        {GRADE_TALLY.map((g) => (
          <span className="pf-grade" key={g.label}>
            <GradeLetter grade={g.label} />
            <b className="num">{plays.filter((p) => g.grades.includes(p.grade)).length}</b>
          </span>
        ))}
      </div>

      <section className="stack-lg">
        <div className="section-head">
          <span className="lbl">Skills</span>
          <h2>Five ways to aim</h2>
          <p className="small">
            Each category adds up the best {BEST_PLAYS} plays in it, and a map in two
            categories counts toward both. The main level is the average of the five.
          </p>
        </div>
        <div className="pf-skills">
          <div className="box pf-radar">
            <SkillRadar
              axes={CATEGORIES.map((c) => ({
                label: shortCategory(c),
                value: levelValue(current[c]),
              }))}
            />
          </div>
          <div className="box pf-cats">
            {CATEGORIES.map((c) => (
              <LevelBar key={c} label={shortCategory(c)} level={current[c]} />
            ))}
          </div>
        </div>
      </section>

      <div className="pf-lists">
        <section className="stack">
          <div className="section-head">
            <span className="lbl">Best plays</span>
            <h2>Top plays</h2>
            <p className="small">
              Ranked by EXP. The ones counting toward a level show their place in it.
            </p>
          </div>
          <PlayList
            plays={top}
            userId={userId}
            list="top"
            empty={owner ? "No plays yet. Play any map from the bank." : "No plays yet."}
          />
        </section>
        <section className="stack">
          <div className="section-head">
            <span className="lbl">History</span>
            <h2>Recent plays</h2>
            <p className="small">Picked up from osu! within a minute of being set.</p>
          </div>
          <PlayList
            plays={views}
            userId={userId}
            list="recent"
            empty={owner ? "Nothing yet. Scores show up here a minute after you set them." : "Nothing yet."}
          />
        </section>
      </div>

      <section className="stack-lg">
        <div className="section-head">
          <span className="lbl">Packs</span>
          <h2>Through the packs</h2>
        </div>
        <div className="pf-packs">
          {TIERS.map((t) => {
            const p = byPack.get(t.order);
            const total = p?.entriesTotal ?? 0;
            const done = p?.entriesCleared ?? 0;
            const best = GRADE_RULES.find((g) => g.sortOrder === p?.bestGradeRank);
            return (
              <div
                className="pk"
                key={t.slug}
                data-idle={done ? undefined : true}
                style={{ "--pack": t.color, "--fill": tierFill(t) } as CSSProperties}
              >
                <div className="pk-top">
                  <span className="pk-gem" style={{ background: tierFill(t) }} />
                  <span className="pk-name">{t.name}</span>
                  {best ? <GradeLetter grade={best.grade} /> : null}
                </div>
                <div className="pk-bar">
                  <i style={{ width: (total ? (done / total) * 100 : 0) + "%" }} />
                </div>
                <span className="pk-count">
                  {total ? done + " / " + total + " cleared" : "No maps yet"}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
