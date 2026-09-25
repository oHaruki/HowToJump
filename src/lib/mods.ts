/**
 * A bank entry is a beatmap plus a mod, so the same map under DT is a
 * separate entry with its own pack and leaderboard.
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

/** Mods whose plays never count: they keep a run alive or play part of it. */
const REFUSED: Record<string, string> = {
  NF: "No Fail",
  RX: "Relax",
  AP: "Autopilot",
  DA: "Difficulty Adjust",
  AT: "Auto",
  CP: "Cinema",
};

/** The first mod a score was played with that keeps it from counting, by name, or null. */
export function refusedMod(mods: Array<{ acronym: string }> | string[] | null | undefined): string | null {
  for (const m of (mods ?? []) as Array<{ acronym: string } | string>) {
    const name = REFUSED[String(typeof m === "string" ? m : m.acronym).toUpperCase()];
    if (name) return name;
  }
  return null;
}

/** Canonical ordering, so HRDT and DTHR resolve to the same entry. */
const ORDER = ["EZ", "HT", "HR", "DT", "FL"];

/** Mods that do not move the notes, so they never split an entry. */
const COSMETIC = new Set([
  "HD", "CL", "NF", "SO", "SD", "PF", "MR", "TD", "AT", "CP", "DA", "AC", "RX", "AP",
]);

/** Any mod string into the canonical entry key. Accepts "hd,dt", "DTHD", "HD DT". */
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

/** The mods a score was played with, as osu! lists them, less the classic marker: "HDDT", or "NM". */
export function modsAsPlayed(mods: Array<{ acronym: string }> | string[] | null | undefined): string {
  const list = (mods ?? []) as Array<{ acronym: string } | string>;
  const acronyms = list
    .map((m) => (typeof m === "string" ? m : m.acronym))
    .filter((a) => a && a.toUpperCase() !== "CL");
  return acronyms.length ? acronyms.join("").toUpperCase() : "NM";
}

export function modLabel(m: string): string {
  return MOD_NAMES[m] ?? m;
}

/** Canonical mod strings as words: "nomod", "nomod and +HR", "nomod, +HR and +DT". */
export function modsText(mods: string[]): string {
  const one = (m: string) => (m === "NM" ? "nomod" : "+" + m);
  if (mods.length < 2) return mods.map(one).join("");
  return mods.slice(0, -1).map(one).join(", ") + " and " + one(mods[mods.length - 1]);
}

/** Splits a canonical mod string into the acronyms the osu! API expects. */
export function modAcronyms(mod: string): string[] {
  const m = normalizeMod(mod);
  if (m === "NM") return [];
  const out: string[] = [];
  for (let i = 0; i + 2 <= m.length; i += 2) out.push(m.slice(i, i + 2));
  return out;
}
