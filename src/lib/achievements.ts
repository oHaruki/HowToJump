import { gradeRank } from "@/lib/grading";
import { TIERS, normalizeSpeed, type Tier } from "@/lib/tiers";

/**
 * Achievements: medals for reaching a mark, worked out from a player's plays
 * and the packs as they stand. A pack that gains maps can take a medal back
 * until the new ones are played. Each medal is dated by the play that
 * completed it.
 */

/** The six marks every pack has, in the order they are usually reached. */
export const PACK_LEVELS = ["pass", "tier", "true", "plus", "trueplus", "perfect"] as const;
export type PackLevel = (typeof PACK_LEVELS)[number];

export const ANIMALS = [
  "snail", "sloth", "tortoise", "panda", "rabbit", "fox", "horse", "cheetah",
] as const;
export type Animal = (typeof ANIMALS)[number];

/** A medal's picture: a pack's mark, an animal, or one of its own. */
export type MedalArt = PackLevel | Animal | "grief" | "727";

export type Achievement = {
  id: string;
  name: string;
  /** What earns it, in a line. */
  rule: string;
  group: "pack" | "speed" | "special";
  art: MedalArt;
  /** The pack whose colour the medal wears. */
  tierOrder: number;
};

export type AchievementState = Achievement & {
  /** When the play that completed it landed, or null while it is out of reach. */
  at: Date | null;
  /** How many of the plays it needs are in, never more than `need`. */
  have: number;
  need: number;
};

/** What the rules read of a play. */
export type MedalPlay = {
  tierOrder: number;
  grade: string;
  speedBucket: string | null;
  maxCombo: number | null;
  /** When the map was first passed. */
  createdAt: Date;
  /** When the current result landed. */
  importedAt: Date;
};

/** B- or higher for a pack's plus marks, A- or higher on GOAT for Grief, SS and SSS for a full combo. */
const PLUS_GRADE = gradeRank("B-");
const GRIEF_GRADE = gradeRank("A-");
const FC_GRADE = gradeRank("SS");

const SLOW = ["Very low"];
const FAST = ["Extreme", "Extreme+"];

/** The ladder in four bands of four, as the speed medals split it. */
const BAND = 4;

const SPEED_MEDALS: Array<{ art: Animal; slow: boolean; band: number }> = [
  { art: "snail", slow: true, band: 0 },
  { art: "sloth", slow: true, band: 1 },
  { art: "tortoise", slow: true, band: 2 },
  { art: "panda", slow: true, band: 3 },
  { art: "rabbit", slow: false, band: 0 },
  { art: "fox", slow: false, band: 1 },
  { art: "horse", slow: false, band: 2 },
  { art: "cheetah", slow: false, band: 3 },
];

/** The combo the 727 medal asks for. */
const WYSI = 727;

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** When the `need`th of these dates came, or null short of it, with how many are in. */
function reached(dates: Date[], need: number): Pick<AchievementState, "at" | "have" | "need"> {
  const sorted = dates.map((d) => d.getTime()).sort((a, b) => a - b);
  return {
    at: need > 0 && sorted.length >= need ? new Date(sorted[need - 1]) : null,
    have: Math.min(sorted.length, need),
    need,
  };
}

/** A pack's six marks, from the player's plays on it and how many maps it holds. */
function packMarks(tier: Tier, size: number, plays: readonly MedalPlay[]): AchievementState[] {
  const here = plays.filter((p) => p.tierOrder === tier.order);
  const passed = here.map((p) => p.createdAt);
  const plus = here.filter((p) => gradeRank(p.grade) <= PLUS_GRADE).map((p) => p.importedAt);
  const fcs = here.filter((p) => gradeRank(p.grade) <= FC_GRADE).map((p) => p.importedAt);
  const half = Math.ceil(size / 2);
  const t = tier.name;
  const marks: Array<[PackLevel, string, string, Date[], number]> = [
    ["pass", t + " Pass", "Pass any " + t + " map", passed, 1],
    ["tier", t, "Pass half the " + t + " maps", passed, half],
    ["true", "True " + t, "Pass every " + t + " map", passed, size],
    ["plus", t + "+", "Pass half the " + t + " maps at B- or higher", plus, half],
    ["trueplus", "True " + t + "+", "Pass every " + t + " map at B- or higher", plus, size],
    ["perfect", "Perfect " + t, "Full combo every " + t + " map", fcs, size],
  ];
  return marks.map(([level, name, rule, dates, need]) => ({
    id: "pack-" + tier.slug + "-" + level,
    name,
    rule,
    group: "pack",
    art: level,
    tierOrder: tier.order,
    ...reached(dates, need),
  }));
}

/**
 * Every achievement and where the player stands on it: each pack's six,
 * then the speed medals, then the special ones. A pack with no maps has
 * none. `packSizes` counts the listed ladder maps in each pack.
 */
export function achievements(
  plays: readonly MedalPlay[],
  packSizes: ReadonlyMap<number, number>,
): AchievementState[] {
  const out: AchievementState[] = [];
  for (const tier of TIERS) {
    const size = packSizes.get(tier.order) ?? 0;
    if (size) out.push(...packMarks(tier, size, plays));
  }

  const fcs = plays.filter((p) => gradeRank(p.grade) <= FC_GRADE);
  for (const m of SPEED_MEDALS) {
    const band = TIERS.slice(m.band * BAND, m.band * BAND + BAND);
    const orders = new Set(band.map((t) => t.order));
    const speeds = m.slow ? SLOW : FAST;
    const dates = fcs
      .filter((p) => orders.has(p.tierOrder) && speeds.includes(normalizeSpeed(p.speedBucket)))
      .map((p) => p.importedAt);
    out.push({
      id: "speed-" + m.art,
      name: titleCase(m.art),
      rule:
        "Full combo " + (m.slow ? "a Very low" : "an Extreme or Extreme+") + " speed map from " +
        band[0].name + " to " + band[band.length - 1].name,
      group: "speed",
      art: m.art,
      tierOrder: band[band.length - 1].order,
      ...reached(dates, 1),
    });
  }

  const top = TIERS[TIERS.length - 1];
  out.push({
    id: "special-grief",
    name: "Grief",
    rule: "Get A- or higher on a " + top.name + " map",
    group: "special",
    art: "grief",
    tierOrder: top.order,
    ...reached(
      plays.filter((p) => p.tierOrder === top.order && gradeRank(p.grade) <= GRIEF_GRADE).map((p) => p.importedAt),
      1,
    ),
  });
  out.push({
    id: "special-727",
    name: "727",
    rule: "Set a combo of exactly " + WYSI + " on any map",
    group: "special",
    art: "727",
    tierOrder: top.order,
    ...reached(plays.filter((p) => p.maxCombo === WYSI).map((p) => p.importedAt), 1),
  });
  return out;
}

/** The achievements reached after `since`, in the order they were reached. */
export function reachedSince(states: readonly AchievementState[], since: Date): AchievementState[] {
  return states
    .filter((s): s is AchievementState & { at: Date } => s.at != null && s.at > since)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}
