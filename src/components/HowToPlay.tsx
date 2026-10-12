import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { gradeFor } from "@/lib/grading";
import { BEST_PLAYS, playExp } from "@/lib/levels";
import { TIERS, tierByName, tierFill } from "@/lib/tiers";
import { SITE_NAME } from "@/lib/site";
import {
  BankScene, ExpScene, LoginScene, PlayScene, type GuideMap,
} from "@/components/GuideScenes";

/** The example play the pictures follow. */
const MISSES = 1;
const ACCURACY = 98.12;
const COMBO = 412;

/** Drawn when the bank has nothing to show yet. */
const SAMPLE: GuideMap = {
  osuBeatmapId: 0,
  setId: null,
  title: "Your first map",
  version: "Insane",
  mapper: null,
  mod: "NM",
  tierOrder: 10,
  stars: 6.4,
  skill: "Precision",
};

/** A pack's colour and fill, which each step wears. */
function stepColour(name: string): CSSProperties {
  const t = tierByName(name);
  return { "--step": t?.color ?? "#777", "--step-fill": tierFill(t) } as CSSProperties;
}

type Step = {
  id: string;
  title: string;
  /** The pack whose colour the step wears. */
  pack: string;
  line: string;
  notes: ReactNode[];
  action?: ReactNode;
  scene: ReactNode;
};

/**
 * The how to play guide: four steps down a line from signing in to a first
 * rank up, each with its picture. The pictures follow the middle of `maps`.
 */
export function HowToPlay({
  signedIn,
  maps: given,
  signIn,
}: {
  signedIn: boolean;
  /** Up to three maps for the bank picture. */
  maps: GuideMap[];
  /** Signs in with osu!. */
  signIn: () => Promise<void>;
}) {
  const maps = given.length ? given : [SAMPLE];
  const pick = maps.length > 1 ? 1 : 0;
  const map = maps[pick];
  const grade = gradeFor({ missCount: MISSES, isFc: false, isPerfect: false });
  const exp = playExp(map.tierOrder, grade, MISSES, null, ACCURACY);

  const signInButton = (
    <form action={signIn}>
      <button className="btn btn-primary" type="submit">
        Sign in with osu!
      </button>
    </form>
  );

  const steps: Step[] = [
    {
      id: "log-in",
      title: "Log in",
      pack: "Rhodonite",
      line: "Sign in with your osu! account. That's the whole sign up.",
      notes: [
        "osu! asks once whether " + SITE_NAME + " may see your public profile. There's no password to make.",
        "From then on, every pass you set is picked up for you.",
      ],
      action: signedIn ? <span className="chip ok">✓ You&apos;re signed in</span> : signInButton,
      scene: <LoginScene site={SITE_NAME} />,
    },
    {
      id: "find-a-map",
      title: "Look for a map",
      pack: "Sapphire",
      line: "Pick a map from the bank, in a pack you can almost clear.",
      notes: [
        "Filter by pack, skill, mod, length and speed.",
        "osu!direct sends it straight to the game, or grab it from its osu! page.",
        "Each map is judged under the mods its hexagons show.",
      ],
      action: (
        <Link className="btn" href="/maps">
          Open the map bank
        </Link>
      ),
      scene: <BankScene maps={maps} pick={pick} />,
    },
    {
      id: "play",
      title: "Play",
      pack: "Emerald",
      line: "Play it in osu!, on stable or lazer, with the mods it's banked under.",
      notes: [
        "Only a pass counts. No Fail, Relax, Autopilot and Difficulty Adjust never do.",
        "Hidden is free: a Hidden run counts on the map without it.",
        "No screenshot and no clip. The score comes straight from osu!.",
      ],
      scene: <PlayScene map={map} accuracy={ACCURACY} combo={COMBO} />,
    },
    {
      id: "get-exp",
      title: "Get EXP",
      pack: "Topaz",
      line: "About a minute later the score lands on your profile and pays EXP.",
      notes: [
        "Fewer misses pay more, and good accuracy wins back part of a miss.",
        <>
          Your best {BEST_PLAYS} plays in each skill make its level, from {TIERS[0].name} up
          to {TIERS[TIERS.length - 1].name}.
        </>,
        <>
          In a hurry? Sync now on your profile, or <code>/sync</code> in the Discord.
        </>,
      ],
      action: signedIn ? (
        <Link className="btn" href="/me">
          Your profile
        </Link>
      ) : (
        <Link className="btn" href="/info">
          How EXP works
        </Link>
      ),
      scene: (
        <ExpScene map={map} grade={grade} misses={MISSES} accuracy={ACCURACY} exp={exp} />
      ),
    },
  ];

  return (
    <div className="view guide">
      <header className="guide-head">
        {/* Decorative only, so it is hidden from assistive tech. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="guide-art"
          src="/hero-render.webp"
          alt=""
          aria-hidden="true"
          width={691}
          height={900}
        />
        <h1>How to play</h1>
        <p className="lede">
          Four steps from your first sign in to your first rank up. There&apos;s nothing to
          upload: osu! tells the site what you played.
        </p>
        <ol className="guide-index">
          {steps.map((s, i) => (
            <li key={s.id} style={stepColour(s.pack)}>
              <a href={"#" + s.id}>
                <i>{i + 1}</i>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </header>

      <ol className="guide-steps">
        {steps.map((s, i) => (
          <li key={s.id} id={s.id} className="gstep" style={stepColour(s.pack)}>
            <span className="gstep-node" aria-hidden="true">
              <b>{i + 1}</b>
            </span>
            <div className="gstep-text">
              <h2>{s.title}</h2>
              <p className="gstep-line">{s.line}</p>
              <ul className="gstep-notes">
                {s.notes.map((n, j) => (
                  <li key={j}>{n}</li>
                ))}
              </ul>
              {s.action ? <div className="row">{s.action}</div> : null}
            </div>
            <figure className="gstep-shot">{s.scene}</figure>
          </li>
        ))}
      </ol>

      <section
        className="guide-end"
        style={
          {
            "--rail":
              "linear-gradient(90deg, " +
              steps.map((s) => tierByName(s.pack)?.color ?? "#777").join(", ") +
              ")",
          } as CSSProperties
        }
      >
        <h2>That&apos;s the whole loop</h2>
        <p className="lede">
          Play more maps and climb more packs. The full rules for grades, levels and mods are on
          the <Link href="/info">Info</Link> page.
        </p>
        <div className="row guide-end-cta">
          {signedIn ? (
            <>
              <Link className="btn btn-primary" href="/maps">
                Find a map
              </Link>
              <Link className="btn" href="/me">
                My progress
              </Link>
            </>
          ) : (
            <>
              {signInButton}
              <Link className="btn" href="/maps">
                Browse the bank
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
