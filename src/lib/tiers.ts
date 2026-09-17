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
};

export const TIERS: Tier[] = [
  { order: 1, name: "Stone", slug: "stone", color: "#777777" },
  { order: 2, name: "Copper", slug: "copper", color: "#d25907" },
  { order: 3, name: "Iron", slug: "iron", color: "#555a5c" },
  { order: 4, name: "Bronze", slug: "bronze", color: "#783f04" },
  { order: 5, name: "Silver", slug: "silver", color: "#c0c0c0" },
  { order: 6, name: "Gold", slug: "gold", color: "#f0d959" },
  { order: 7, name: "Platinum", slug: "platinum", color: "#E5E4E2" },
  { order: 8, name: "Titanium", slug: "titanium", color: "#708a99" },
  {
    order: 9,
    name: "Rhodonite",
    slug: "rhodonite",
    color: "#f19bc2",
    // The sheet still calls this pack Opal, so pasted rows keep resolving.
    aliases: ["Opal"],
  },
  { order: 10, name: "Topaz", slug: "topaz", color: "#ffb84d" },
  { order: 11, name: "Ruby", slug: "ruby", color: "#d21f3c" },
  { order: 12, name: "Sapphire", slug: "sapphire", color: "#5fa6ff" },
  { order: 13, name: "Emerald", slug: "emerald", color: "#4ef399" },
  { order: 14, name: "Amethyst", slug: "amethyst", color: "#8e44ad" },
  { order: 15, name: "Diamond", slug: "diamond", color: "#a2f0ff" },
  {
    order: 16,
    name: "GOAT",
    slug: "goat",
    color: "#c7e9e4",
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

export const CATEGORIES = [
  "Raw Aim",
  "Consistency Aim",
  "Flow Aim",
  "Precision",
  "Speed",
];

export const LENGTHS = ["TV Size", "Short", "Medium", "Long", "Marathon"];
export const SPEEDS = ["Low", "Medium", "High"];
