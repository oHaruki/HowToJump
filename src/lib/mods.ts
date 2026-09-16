/**
 * A bank entry is a beatmap plus a mod, so mods are part of an entry's
 * identity rather than a label on it. The same map under DT is a separate
 * entry with its own pack and its own leaderboard.
 */
export const MODS = [
  "NM", "HD", "HR", "DT", "NC", "HT", "EZ", "FL",
  "HDHR", "HDDT", "HRDT", "HDHRDT",
];

export const MOD_NAMES: Record<string, string> = {
  NM: "No mod",
  HD: "Hidden",
  HR: "Hard Rock",
  DT: "Double Time",
  NC: "Nightcore",
  HT: "Half Time",
  EZ: "Easy",
  FL: "Flashlight",
  HDHR: "Hidden + Hard Rock",
  HDDT: "Hidden + Double Time",
  HRDT: "Hard Rock + Double Time",
  HDHRDT: "Hidden + Hard Rock + Double Time",
};

/** Canonical ordering, so HDDT and DTHD resolve to the same entry. */
const ORDER = ["EZ", "HT", "HD", "HR", "DT", "NC", "FL"];

/** Mods osu! reports that do not change difficulty, so they never split an entry. */
const COSMETIC = new Set([
  "CL", "NF", "SO", "SD", "PF", "MR", "TD", "AT", "CP", "DA", "AC", "RX", "AP",
]);

/**
 * Normalise any mod string into the canonical form used in an entry key.
 * Accepts "hd,dt", "DTHD", "HD DT" and similar.
 */
export function normalizeMod(input: string | null | undefined): string {
  const raw = String(input ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!raw) return "NM";
  if (raw === "NM" || raw === "NOMOD") return "NM";

  const pairs: string[] = [];
  for (let i = 0; i + 2 <= raw.length; i += 2) pairs.push(raw.slice(i, i + 2));

  const kept = Array.from(new Set(pairs.filter((m) => !COSMETIC.has(m))));
  // Nightcore already implies Double Time in osu!, so keep only NC.
  if (kept.includes("NC")) {
    const i = kept.indexOf("DT");
    if (i > -1) kept.splice(i, 1);
  }
  if (!kept.length) return "NM";

  kept.sort((a, b) => {
    const ia = ORDER.indexOf(a);
    const ib = ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
  return kept.join("");
}

/** Turn the mod array the osu! API returns into our canonical string. */
export function modsFromApi(
  mods: Array<{ acronym: string }> | string[] | null | undefined,
): string {
  if (!mods || !mods.length) return "NM";
  const list = mods as Array<{ acronym: string } | string>;
  const acronyms = list.map((m) => (typeof m === "string" ? m : m.acronym));
  return normalizeMod(acronyms.join(""));
}

export function modLabel(m: string): string {
  return MOD_NAMES[m] ?? m;
}
