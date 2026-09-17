import { GRADE_RULES } from "@/lib/grading";
import { MODS, modLabel } from "@/lib/mods";
import { SectionHead } from "@/components/ui";

export default function InfoPage() {
  return (
    <div className="view">
      <SectionHead label="Info" title="How all of this works">
        The grading scale, the mods, the rules, and what the site does on its own.
      </SectionHead>

      <div className="stack-lg">
        <div className="section-head">
          <span className="lbl">Grading</span>
          <h2>One number decides it</h2>
          <p className="lede">
            Your grade comes from your misscount, with two exceptions at the top:
            hold the combo and you take SS, and a 100% takes SSS.
            Thresholds are stored as data, so staff retune them without a deploy.
          </p>
        </div>
        <div className="grade-grid">
          {GRADE_RULES.map((g) => (
            <div className="grade" key={g.grade}>
              <span className="grade-badge">{g.grade}</span>
              <span className="grade-cond">{g.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="two-col">
        <div className="box stack">
          <span className="lbl">Purpose</span>
          <h3>What this is for</h3>
          <p>
            This project is not a thorough guide about aim progression, but moreso a
            tracker for your personal progression through aim. The public
            leaderboards are just for competitive community purposes.
          </p>
        </div>

        <div className="box stack">
          <span className="lbl">Mods</span>
          <h3>Each mod is its own entry</h3>
          <p>
            A map is banked together with the mod it is judged under. The same
            beatmap under a different mod is a separate entry with its own pack and
            its own leaderboard, and a score only counts when the mods match.
          </p>
          <hr className="sep" />
          <div className="row-tight">
            {MODS.map((m) => (
              <span
                key={m}
                className="chip chip-mod"
                data-nm={String(m === "NM")}
                title={modLabel(m)}
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="two-col">
        <div className="box stack">
          <span className="lbl">Tracking</span>
          <h3>Scores arrive on their own</h3>
          <p>
            Connect your osu! account and the site reads your recent plays. Anything
            that lands on a bank entry is picked up automatically, with misscount,
            accuracy, combo and mods taken from osu! itself.
          </p>
          <hr className="sep" />
          <p className="small">
            Almost every map on the ladder is graveyard, so there is no beatmap
            leaderboard to read. Recent plays come back as plays rather than
            leaderboard entries, so they cover graveyard maps fine. It is the same
            data <code>&gt;rs</code> reads. The window is the last 100 plays or 24
            hours, whichever runs out first, which is what sets the half hour
            cadence.
          </p>
        </div>

        <div className="box stack">
          <span className="lbl">Rules</span>
          <h3>Getting a score counted</h3>
          <p>
            Play a map on the ladder with the right mods. That is the whole rule.
            There is no screenshot, no clip and no review queue, because the score
            comes from osu! rather than from a picture of osu!.
          </p>
          <hr className="sep" />
          <dl className="kv">
            <dt>Screenshot</dt>
            <dd>Not required</dd>
            <dt>Clip</dt>
            <dd>Not required</dd>
            <dt>Review</dt>
            <dd>Automatic</dd>
            <dt>History</dt>
            <dd>Starts when you connect</dd>
            <dt>Takedowns</dt>
            <dd>Staff can hide any score</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
