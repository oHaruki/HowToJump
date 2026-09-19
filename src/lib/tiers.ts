/**
 * The sixteen packs, ascending. A four column grid lays these out in the
 * bands the sheet uses: Stone-Bronze, Silver-Titanium, Rhodonite-Sapphire,
 * Emerald-GOAT.
 */
export type Tier = {
  order: number;
  name: string;
  slug: string;
  color: string;
  gradient?: string;
  /** Former names, so older spreadsheet rows still resolve. */
  aliases?: string[];
  /**
   * EXP for a full combo on one of this pack's maps. Each pack is worth about
   * 1.5 times the one below, so the hardest maps you play well carry a level.
   */
  exp: number;
};

export const TIERS: Tier[] = [
  { order: 1, name: "Stone", slug: "stone", color: "#777777", exp: 30 },
  { order: 2, name: "Copper", slug: "copper", color: "#d25907", exp: 45 },
  { order: 3, name: "Iron", slug: "iron", color: "#555a5c", exp: 70 },
  { order: 4, name: "Bronze", slug: "bronze", color: "#783f04", exp: 100 },
  { order: 5, name: "Silver", slug: "silver", color: "#c0c0c0", exp: 150 },
  { order: 6, name: "Gold", slug: "gold", color: "#f0d959", exp: 220 },
  { order: 7, name: "Platinum", slug: "platinum", color: "#E5E4E2", exp: 320 },
  { order: 8, name: "Titanium", slug: "titanium", color: "#708a99", exp: 480 },
  {
    order: 9,
    name: "Rhodonite",
    slug: "rhodonite",
    color: "#f19bc2",
    // The sheet still calls this pack Opal, so pasted rows keep resolving.
    aliases: ["Opal"],
    exp: 700,
  },
  { order: 10, name: "Topaz", slug: "topaz", color: "#ffb84d", exp: 1050 },
  { order: 11, name: "Ruby", slug: "ruby", color: "#d21f3c", exp: 1550 },
  { order: 12, name: "Sapphire", slug: "sapphire", color: "#5fa6ff", exp: 2300 },
  { order: 13, name: "Emerald", slug: "emerald", color: "#4ef399", exp: 3400 },
  { order: 14, name: "Amethyst", slug: "amethyst", color: "#8e44ad", exp: 5000 },
  { order: 15, name: "Diamond", slug: "diamond", color: "#a2f0ff", exp: 7400 },
  {
    order: 16,
    name: "GOAT",
    slug: "goat",
    color: "#c7e9e4",
    exp: 11000,
    // The iridescent fill this ladder used to give the Opal pack.
    gradient:
      "linear-gradient(140deg,#9FE2D0,#C7B8F0 45%,#FFD8E4 70%,#BFF0E4)",
  },
];

const byLower = new Map<string, Tier>();
for (const t of TIERS) {
  byLower.set(t.name.toLowerCase(), t);
  for (const a of t.aliases ?? []) byLower.set(a.toLowerCase(), t);
}
const bySlug = new Map(TIERS.map((t) => [t.slug, t]));
const byOrder = new Map(TIERS.map((t) => [t.order, t]));

export function tierByName(n: string | null | undefined): Tier | null {
  if (!n) return null;
  return byLower.get(n.trim().toLowerCase()) ?? null;
}
export function tierBySlug(s: string): Tier | null {
  return bySlug.get(s) ?? null;
}
export function tierByOrder(o: number | null | undefined): Tier | null {
  if (o == null) return null;
  return byOrder.get(o) ?? null;
}

/** Background value for a pack swatch or dot. */
export function tierFill(t: Tier | null): string {
  if (!t) return "var(--bg-d)";
  return t.gradient ?? t.color;
}

/**
 * The skills a map is judged on, as the grading team lists them. Flow Aim and
 * Speed were dropped when Anti-aim and Aim control were added, so an entry
 * still carrying one of those needs judging again rather than a rename.
 */
export const CATEGORIES = [
  "Aim - consistency",
  "Aim - raw mechanic",
  "Anti-aim",
  "Aim control",
  "Precision",
];

/* ------------------------------------------------------------ pacing scales */

/**
 * Length by drain time and speed by BPM, as the grading scale defines them.
 *
 * `upTo` is the highest value the bucket still covers, so a boundary belongs
 * to the longer or faster bucket: 1:00 is TV Size rather than Cut Ver., and
 * 170 BPM is Low rather than Very low. Keeping the bounds next to the names
 * means the dropdowns and the auto fill cannot drift apart.
 */
export type Bucket = { name: string; upTo: number; range: string };

export const LENGTH_SCALE: Bucket[] = [
  { name: "Cut Ver.", upTo: 59, range: "0:30 - 1:00" },
  { name: "TV Size", upTo: 89, range: "1:00 - 1:30" },
  { name: "Medium", upTo: 179, range: "1:30 - 3:00" },
  { name: "Long", upTo: 299, range: "3:00 - 5:00" },
  { name: "Marathon", upTo: Infinity, range: "5:00+" },
];

export const SPEED_SCALE: Bucket[] = [
  { name: "Very low", upTo: 169, range: "below 170" },
  { name: "Low", upTo: 199, range: "170 - 199" },
  { name: "Medium", upTo: 239, range: "200 - 239" },
  { name: "High", upTo: 279, range: "240 - 279" },
  { name: "Very high", upTo: 319, range: "280 - 319" },
  { name: "Extreme", upTo: 360, range: "320 - 360" },
  { name: "Extreme+", upTo: Infinity, range: "above 360" },
];

export const LENGTHS = LENGTH_SCALE.map((b) => b.name);
export const SPEEDS = SPEED_SCALE.map((b) => b.name);

/** One line spelling out the whole scale, for a dropdown's hover text. */
export function scaleHint(scale: Bucket[], unit: string): string {
  return unit + ": " + scale.map((b) => b.name + " " + b.range).join(", ");
}

/** The bucket a measured value falls in. */
export function bucketFor(scale: Bucket[], v: number): string {
  const rounded = Math.round(v);
  for (const b of scale) if (rounded <= b.upTo) return b.name;
  return scale[scale.length - 1].name;
}

/* Pasted cells arrive in whatever spelling the sheet used, and the scale has
   been renamed before ("Short" is now "Cut Ver."), so both resolve to one
   canonical label. A plus sign survives the key, or Extreme+ and Extreme
   would collide. */
const bucketKey = (s: string) =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9+]/g, "");

const LENGTH_ALIASES: Record<string, string> = {
  short: "Cut Ver.", cut: "Cut Ver.", cutver: "Cut Ver.", cutversion: "Cut Ver.",
  tv: "TV Size", tvsize: "TV Size", tvver: "TV Size",
  normal: "Medium", med: "Medium",
  extended: "Long",
  marathon: "Marathon",
};

const SPEED_ALIASES: Record<string, string> = {
  vlow: "Very low", verylow: "Very low",
  vhigh: "Very high", veryhigh: "Very high",
  extremeplus: "Extreme+", extremep: "Extreme+",
};

function canonical(
  names: string[],
  aliases: Record<string, string>,
  input: string | null | undefined,
): string {
  const k = bucketKey(input ?? "");
  if (!k) return "";
  const hit = names.find((n) => bucketKey(n) === k);
  if (hit) return hit;
  // Anything unrecognised is kept verbatim, so a paste is never silently reworded.
  return aliases[k] ?? String(input).trim();
}

export function normalizeLength(input: string | null | undefined): string {
  return canonical(LENGTHS, LENGTH_ALIASES, input);
}
export function normalizeSpeed(input: string | null | undefined): string {
  return canonical(SPEEDS, SPEED_ALIASES, input);
}

/* Two categories were only renamed, so older rows resolve to the new wording.
   The two that were dropped are deliberately absent: silently folding them
   into a surviving category would be a judgement call, not a rename. */
const CATEGORY_ALIASES: Record<string, string> = {
  rawaim: "Aim - raw mechanic",
  rawmechanic: "Aim - raw mechanic",
  rawmech: "Aim - raw mechanic",
  consistencyaim: "Aim - consistency",
  consistency: "Aim - consistency",
  control: "Aim control",
};

export function normalizeCategory(input: string | null | undefined): string {
  return canonical(CATEGORIES, CATEGORY_ALIASES, input);
}

/**
 * A map's categories, however they arrive: a list, or one sheet cell holding
 * several ("Raw Aim / Consistency"). Each is normalised, repeats go, and they
 * come back in the scale's order, so the same set always reads the same way.
 * Hyphens are not a separator, since "Aim - raw mechanic" has one.
 */
export function normalizeCategories(input: string | readonly string[] | null | undefined): string[] {
  const parts = typeof input === "string" ? input.split(/[/,;+&|\n]/) : (input ?? []);
  const out = new Set(parts.map((p) => normalizeCategory(p)).filter(Boolean));
  return orderByScale([...out], CATEGORIES);
}

/** Short labels where the full one would crowd, like a chart axis or a row. */
const CATEGORY_SHORT: Record<string, string> = {
  "Aim - consistency": "Consistency",
  "Aim - raw mechanic": "Raw mechanic",
  "Anti-aim": "Anti-aim",
  "Aim control": "Control",
  Precision: "Precision",
};

export function shortCategory(input: string | null | undefined): string {
  const c = normalizeCategory(input);
  return CATEGORY_SHORT[c] ?? c;
}

/** Whether a category is one the grading team still judges on. */
export function isCategory(input: string | null | undefined): boolean {
  return CATEGORIES.includes(normalizeCategory(input));
}

/**
 * Orders values the way the list they come from does rather than
 * alphabetically, so a filter reads Very low to Extreme+ instead of Extreme
 * to Very low. Values from outside the list sort last, keeping their own
 * order, since those are the ones that need a staff eye.
 */
export function orderByScale(values: string[], order: string[]): string[] {
  const rank = new Map(order.map((n, i) => [n, i]));
  return values
    .slice()
    .sort(
      (a, b) =>
        (rank.get(a) ?? 99) - (rank.get(b) ?? 99) || a.localeCompare(b),
    );
}
