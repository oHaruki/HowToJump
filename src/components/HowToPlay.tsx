import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { gradeFor } from "@/lib/grading";
import { BEST_PLAYS, levelFromExp, playExp } from "@/lib/levels";
import { TIERS, shortCategory, tierByName, tierFill } from "@/lib/tiers";
import { SITE_NAME } from "@/lib/site";
import {
  BankScene, ExpScene, LoginScene, PlayScene, type GuideMap,
} from "@/components/GuideScenes";

/** Maps from the bank as the pictures show them; the middle one is followed through every step. */
const MAPS: GuideMap[] = [
  {
    osuBeatmapId: 4922783,
    setId: 1938104,
    title: "Bloody Mary, Kate and Ashley",
    version: "Illusion",
    mapper: "table tennis",
    mod: "HRDT",
    tierOrder: 11,
    stars: 8.47,
    skill: shortCategory("Precision"),
  },
  {
    osuBeatmapId: 3678730,
    setId: 1794786,
    title: "When My Devil Rises",
    version: "DESPAIR",
    mapper: "-Kirigiri",
    mod: "NM",
    tierOrder: 12,
    stars: 8.14,
    skill: shortCategory("Aim - raw mechanic"),
  },
  {
    osuBeatmapId: 5489690,
    setId: 2496950,
    title: "Armed and Ready",
    version: "Soaring Fantasy",
    mapper: "NiniDialga",
    mod: "NM",
    tierOrder: 13,
    stars: 9.78,
    skill: shortCategory("Aim - consistency"),
  },
];
const PICK = 1;

/** A real play on the middle map, and the map's note count, which sets what a miss costs. */
const PLAY = { misses: 2, accuracy: 99.5485, noteCount: 1329 };

/** The player's level in the map's skill before the play, and the play it pushes out of their best ten. */
const LEVEL_BEFORE = 2_061_000;
const PUSHED_OUT = 141_820;

/** The guide's steps: each one's anchor, its name, the pack whose colour it wears, and its line. */
export const GUIDE_STEPS = [
  {
    id: "log-in",
    title: "Log in",
    pack: "Rhodonite",
    line: "Sign in with your osu! account. That's the whole sign up.",
  },
  {
    id: "find-a-map",
    title: "Look for a map",
    pack: "Sapphire",
    line: "Pick a map from the bank, in a pack you can almost clear.",
  },
  {
    id: "play",
    title: "Play",
    pack: "Emerald",
    line: "Play it in osu!, on stable or lazer, with the mods it's banked under.",
  },
  {
    id: "get-exp",
    title: "Get EXP",
    pack: "Topaz",
    line: "About a minute later the score lands on your profile and pays EXP.",
  },
];

/** A pack's colour and fill, which each step wears. */
function stepColour(name: string): CSSProperties {
  const t = tierByName(name);
  return { "--step": t?.color ?? "#777", "--step-fill": tierFill(t) } as CSSProperties;
}

type Step = (typeof GUIDE_STEPS)[number] & {
  notes: ReactNode[];
  action?: ReactNode;
  scene: ReactNode;
};

/** The steps at a glance, each a jump to its place in the guide. */
function StepIndex() {
  return (
    <ol className="guide-index">
      {GUIDE_STEPS.map((s, i) => (
        <li key={s.id} style={stepColour(s.pack)}>
          <a href={"#" + s.id}>
            <i>{i + 1}</i>
            {s.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

/** The guide on the overview: a card for each step, each opening the guide there. */
export function GuideTeaser() {
  return (
    <section className="stack-lg">
      <div className="section-head">
        <h2>How to play</h2>
        <p className="lede">
          Four steps from your first sign in to your first rank up.{" "}
          <Link href="/how-to-play">Read the guide</Link>
        </p>
      </div>
      <ol className="guide-cards">
        {GUIDE_STEPS.map((s, i) => (
          <li key={s.id} style={stepColour(s.pack)}>
            <Link href={"/how-to-play#" + s.id}>
              <span className="guide-card-head">
                <i>{i + 1}</i>
                <b>{s.title}</b>
              </span>
              <span className="guide-card-line">{s.line}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The how to play guide: four steps down a line from signing in to a first
 * rank up, each with its picture. The pictures follow the middle of `maps`.
 */
export function HowToPlay({
  signedIn,
  signIn,
}: {
  signedIn: boolean;
  /** Signs in with osu!. */
  signIn: () => Promise<void>;
}) {
  const map = MAPS[PICK];
  const grade = gradeFor({ missCount: PLAY.misses, isFc: false, isPerfect: false });
  const exp = playExp(map.tierOrder, grade, PLAY.misses, PLAY.noteCount, PLAY.accuracy);
  const before = levelFromExp(LEVEL_BEFORE);
  const after = levelFromExp(LEVEL_BEFORE + exp - PUSHED_OUT);

  const signInButton = (
    <form action={signIn}>
      <button className="btn btn-primary" type="submit">
        Sign in with osu!
      </button>
    </form>
  );

  const [logIn, findAMap, play, getExp] = GUIDE_STEPS;
  const steps: Step[] = [
    {
      ...logIn,
      notes: [
        "osu! asks once whether " + SITE_NAME + " may see your public profile. There's no password to make.",
        "From then on, every pass you set is picked up for you.",
      ],
      action: signedIn ? <span className="chip ok">✓ You&apos;re signed in</span> : signInButton,
      scene: <LoginScene site={SITE_NAME} />,
    },
    {
      ...findAMap,
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
      scene: <BankScene maps={MAPS} pick={PICK} />,
    },
    {
      ...play,
      notes: [
        "Only a pass counts. No Fail, Relax, Autopilot and Difficulty Adjust never do.",
        "Hidden is free: a Hidden run counts on the map without it.",
        "No screenshot and no clip. The score comes straight from osu!.",
      ],
      scene: <PlayScene map={map} accuracy={PLAY.accuracy} />,
    },
    {
      ...getExp,
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
        <ExpScene
          map={map}
          grade={grade}
          misses={PLAY.misses}
          accuracy={PLAY.accuracy}
          exp={exp}
          before={before}
          after={after}
        />
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
        <StepIndex />
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
            {i < steps.length - 1 ? (
              <svg className="gstep-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path d={i % 2 ? "M100 0C140 60 -40 40 0 100" : "M0 0C-40 60 140 40 100 100"} />
              </svg>
            ) : null}
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
