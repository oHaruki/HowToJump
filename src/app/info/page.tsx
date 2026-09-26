import type { Metadata } from "next";
import {
  GRADE_RULES, MIN_MISS_FACTOR, REFERENCE_NOTES, accuracyCredit, missFactor,
} from "@/lib/grading";
import { BEST_PLAYS, THRESHOLD_GRADE, threshold } from "@/lib/levels";
import { tierByName } from "@/lib/tiers";
import { GradeLetter, SectionHead, gradeTone } from "@/components/ui";
import { ModLegend, PackLadder, SkillSlots, SyncFlow } from "@/components/InfoViz";

export const metadata: Metadata = { title: "Info" };

const fmt = (n: number) => n.toLocaleString("en");
/* The curve gives shares from 120 down to hundredths of a percent, so the
   small ones keep a second decimal rather than rounding away to nothing. */
const share = (n: number) => (n < 1 ? +n.toFixed(2) : +n.toFixed(1));
const standard = GRADE_RULES.find((g) => g.grade === THRESHOLD_GRADE);
/** How much of one miss an accuracy wins back, in percent. */
const wonBack = (accuracy: number) => Math.round(accuracyCredit(accuracy) * 100);
const packLine = (name: string) => {
  const t = tierByName(name);
  return t ? fmt(threshold(t.order)) + " for " + t.name : "";
};

export default function InfoPage() {
  return (
    // rise-in lands each band of the page a step after the one above it.
    <div className="view rise-in">
      <SectionHead label="Info" title="How all of this works">
        The grading scale, the mods, the rules, and what the site does on its own.
      </SectionHead>

      <section className="iband">
        <span className="lbl">Grading</span>
        <div className="iband-main">
          <h2>One number decides it</h2>
          <div className="grade-split">
            <div className="stack">
              <p className="lede">
                Your grade comes from your misscount, with two exceptions at the top:
                hold the combo and you take SS, and a 100% takes SSS.
              </p>
              <p className="lede">
                EXP does not step from grade to grade. It falls with every miss on
                one curve, and each miss costs a little more than the one before,
                so a map survived is worth nothing like a map cleared. The
                percentage beside a grade is the most that grade pays before
                accuracy, on a normal {fmt(REFERENCE_NOTES)} note map.
              </p>
              <p className="lede">
                Accuracy then wins back part of one miss: {wonBack(90)}% of it at
                90%, {wonBack(96)}% at 96% and {wonBack(99)}% at 99%. Never a whole
                one, so one miss fewer always pays more. A full combo climbs the same
                way toward SSS, and a clean pass that dropped the combo stays where
                it is.
              </p>
              <p className="lede">
                Staying clean is easier on a short map, so there each miss costs
                more: on a 150 note map it counts ×{missFactor(150).toFixed(1)}. A
                long map forgives, but only so far, never under{" "}
                ×{MIN_MISS_FACTOR.toFixed(1)}, so a marathon is not a way around the
                curve. The grade always shows your real misses.
              </p>
            </div>
            <div className="grade-grid">
              {GRADE_RULES.map((g) => (
                <div className="grade" key={g.grade} data-tone={gradeTone(g.grade)}>
                  <GradeLetter grade={g.grade} />
                  <span className="grade-cond">{g.label}</span>
                  <span className="grade-exp num">{share(g.expPercent)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="iband">
        <span className="lbl">Levels</span>
        <div className="iband-main">
          <h3>Your best {BEST_PLAYS} plays in each skill</h3>
          <div className="iband-cols">
            <div className="stack">
              <p>
                Every play earns EXP: its pack&apos;s value times the percentage its
                misses and accuracy earn. Each category adds up your best{" "}
                {BEST_PLAYS} plays in it, so grinding easy maps does not help, and a
                new map never lowers anyone. A map can sit in more than one category,
                and then a play on it counts toward each.
              </p>
              <p className="small">
                You reach a pack when your best {BEST_PLAYS} add up to {BEST_PLAYS}{" "}
                plays at {standard?.grade} ({standard?.label}) on it, before accuracy:{" "}
                {packLine("Emerald")},{" "}
                {packLine("Amethyst")}. Full combos on the pack below never get there on
                their own, so reaching a pack means playing it. Your main level is the
                average of the five categories. The leaderboard ranks the main level,
                and each category has a board of its own beside it.
              </p>
            </div>
            <SkillSlots />
          </div>
        </div>
      </section>

      <section className="iband">
        <span className="lbl">Pack values</span>
        <div className="iband-main">
          <h3>EXP for a full combo</h3>
          <div className="iband-cols">
            <PackLadder />
          </div>
        </div>
      </section>

      <section className="iband">
        <span className="lbl">Special packs</span>
        <div className="iband-main">
          <h3>Packs off the ladder</h3>
          <div className="iband-cols">
            <p>
              Admins can make packs beside the sixteen, for events and the like. Each
              map in one is judged into a pack and pays EXP like any other, but that
              EXP doesn&apos;t count toward your level. It goes on the special
              pack&apos;s own board instead, which adds up everyone&apos;s maps.
            </p>
          </div>
        </div>
      </section>

      <section className="iband">
        <span className="lbl">Purpose</span>
        <div className="iband-main">
          <h3>What this is for</h3>
          <div className="iband-cols">
            <p>
              This project is not a thorough guide about aim progression, but moreso a
              tracker for your personal progression through aim. The public
              leaderboards are just for competitive community purposes.
            </p>
          </div>
        </div>
      </section>

      <section className="iband">
        <span className="lbl">Mods</span>
        <div className="iband-main">
          <h3>Each mod is its own entry</h3>
          <div className="iband-cols">
            <p>
              A map is banked together with the mod it is judged under. The same
              beatmap under a different mod is a separate entry with its own pack and
              its own leaderboard, and a score only counts when the mods match.
              Hidden is the exception: it moves no notes, so it never splits an entry
              and a Hidden run counts on the entry without it. Nightcore counts as
              Double Time, and the other mods that change nothing count too. No Fail,
              Relax, Autopilot and Difficulty Adjust never count: every score has to
              be a real pass.
            </p>
            <ModLegend />
          </div>
        </div>
      </section>

      <section className="iband">
        <span className="lbl">Tracking</span>
        <div className="iband-main">
          <h3>Scores arrive on their own</h3>
          <div className="iband-cols">
            <div className="stack">
              <p>
                Connect your osu! account and the site reads your recent plays. Anything
                that lands on a bank entry is picked up automatically, with misscount,
                accuracy, combo and mods taken from osu! itself.
              </p>
              <p className="small">
                Almost every map in the bank is graveyard, so there is no beatmap
                leaderboard to read. Recent plays come back as plays rather than
                leaderboard entries, so they cover graveyard maps fine, on stable and
                lazer. It is the same data <code>&gt;rs</code> reads. The site checks
                every minute who has played, so a score usually shows up within a
                minute. In a hurry? Sync now on your page, or <code>/sync</code> in the
                Discord, pulls it straight away.
              </p>
              <p className="small">
                Played a bank map before you connected, or one the site missed? Paste
                the score&apos;s osu! link on your page and it counts like any other.
              </p>
            </div>
            <SyncFlow />
          </div>
        </div>
      </section>

      <section className="iband">
        <span className="lbl">Rules</span>
        <div className="iband-main">
          <h3>Getting a score counted</h3>
          <div className="iband-cols">
            <p>
              Play a map from the bank with the right mods. That is the whole rule.
              There is no screenshot, no clip and no review queue, because the score
              comes from osu! rather than from a picture of osu!.
            </p>
            <dl className="kv">
              <dt>Screenshot</dt>
              <dd>Not required</dd>
              <dt>Clip</dt>
              <dd>Not required</dd>
              <dt>Review</dt>
              <dd>Automatic</dd>
              <dt>History</dt>
              <dd>From when you connect, plus older scores by link</dd>
              <dt>Takedowns</dt>
              <dd>Staff can hide any score</dd>
            </dl>
          </div>
        </div>
      </section>

    </div>
  );
}
