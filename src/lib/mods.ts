/**
 * A bank entry is a beatmap plus a mod, so mods are part of an entry's
 * identity rather than a label on it. The same map under DT is a separate
 * entry with its own pack and its own leaderboard.
 */
export const MODS = ["NM", "HR", "DT", "HT", "EZ", "FL", "HRDT"];

export const MOD_NAMES: Record<string, string> = {
  NM: "No mod",
  HR: "Hard Rock",
  DT: "Double Time",
  HT: "Half Time",
  EZ: "Easy",
  FL: "Flashlight",
  HRDT: "Hard Rock + Double Time",
};

/** Canonical ordering, so HRDT and DTHR resolve to the same entry. */
const ORDER = ["EZ", "HT", "HR", "DT", "FL"];

/**
 * Mods that do not change where the notes are, so they never split an entry.
 * Hidden is one of them: it takes the approach circles away, but a DTHR map
 * played with DTHRHD is the same aim, so it counts on the DTHR entry.
 */
const COSMETIC = new Set([
  "HD", "CL", "NF", "SO", "SD", "PF", "MR", "TD", "AT", "CP", "DA", "AC", "RX", "AP",
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

  // Nightcore is Double Time with another sound, so it is banked as DT.
  const kept = Array.from(
    new Set(pairs.filter((m) => !COSMETIC.has(m)).map((m) => (m === "NC" ? "DT" : m))),
  );
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

/** Splits a canonical mod string into the acronyms the osu! API expects. */
export function modAcronyms(mod: string): string[] {
  const m = normalizeMod(mod);
  if (m === "NM") return [];
  const out: string[] = [];
  for (let i = 0; i + 2 <= m.length; i += 2) out.push(m.slice(i, i + 2));
  return out;
}
