/**
 * The sixteen packs, ascending. A four column grid lays these out in the
 * bands the sheet uses: Stone-Bronze, Silver-Titanium, Topaz-Emerald, Opal-GOAT.
 */
export type Tier = {
  order: number;
  name: string;
  slug: string;
  color: string;
  gradient?: string;
};

export const TIERS: Tier[] = [
  { order: 1, name: "Stone", slug: "stone", color: "#8C8C8C" },
  { order: 2, name: "Copper", slug: "copper", color: "#B87333" },
  { order: 3, name: "Iron", slug: "iron", color: "#A8A9AD" },
  { order: 4, name: "Bronze", slug: "bronze", color: "#CD7F32" },
  { order: 5, name: "Silver", slug: "silver", color: "#C0C0C0" },
  { order: 6, name: "Gold", slug: "gold", color: "#FFD24A" },
  { order: 7, name: "Platinum", slug: "platinum", color: "#E5E4E2" },
  { order: 8, name: "Titanium", slug: "titanium", color: "#7C8A99" },
  { order: 9, name: "Topaz", slug: "topaz", color: "#FFC24B" },
  { order: 10, name: "Ruby", slug: "ruby", color: "#E0115F" },
  { order: 11, name: "Sapphire", slug: "sapphire", color: "#2F6FE0" },
  { order: 12, name: "Emerald", slug: "emerald", color: "#4FC978" },
  {
    order: 13,
    name: "Opal",
    slug: "opal",
    color: "#9FE2D0",
    gradient: "linear-gradient(140deg,#9FE2D0,#C7B8F0 45%,#FFD8E4 70%,#BFF0E4)",
  },
  { order: 14, name: "Amethyst", slug: "amethyst", color: "#9B6BD6" },
  { order: 15, name: "Diamond", slug: "diamond", color: "#8FE3F5" },
  {
    order: 16,
    name: "GOAT",
    slug: "goat",
    color: "#FFD700",
    gradient:
      "conic-gradient(from 140deg,#FFD700,#E0115F,#9B6BD6,#2F6FE0,#4FC978,#FFD700)",
  },
];

const byLower = new Map(TIERS.map((t) => [t.name.toLowerCase(), t]));
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
