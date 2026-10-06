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

export type ModType = "increase" | "reduction" | "conversion" | "automation" | "system";

/**
 * osu!standard's mods by acronym, with the type that colours their icon.
 * Each has its mark at /mods/<acronym>.svg. Fun mods are left out.
 */
export const OSU_MODS: Record<string, { name: string; type: ModType }> = {
  NM: { name: "No Mod", type: "system" },
  EZ: { name: "Easy", type: "reduction" },
  NF: { name: "No Fail", type: "reduction" },
  HT: { name: "Half Time", type: "reduction" },
  DC: { name: "Daycore", type: "reduction" },
  HR: { name: "Hard Rock", type: "increase" },
  SD: { name: "Sudden Death", type: "increase" },
  PF: { name: "Perfect", type: "increase" },
  DT: { name: "Double Time", type: "increase" },
  NC: { name: "Nightcore", type: "increase" },
  HD: { name: "Hidden", type: "increase" },
  TC: { name: "Traceable", type: "increase" },
  FL: { name: "Flashlight", type: "increase" },
  BL: { name: "Blinds", type: "increase" },
  ST: { name: "Strict Tracking", type: "increase" },
  AC: { name: "Accuracy Challenge", type: "increase" },
  TP: { name: "Target Practice", type: "conversion" },
  DA: { name: "Difficulty Adjust", type: "conversion" },
  CL: { name: "Classic", type: "conversion" },
  RD: { name: "Random", type: "conversion" },
  MR: { name: "Mirror", type: "conversion" },
  AL: { name: "Alternate", type: "conversion" },
  SG: { name: "Single Tap", type: "conversion" },
  AT: { name: "Autoplay", type: "automation" },
  CN: { name: "Cinema", type: "automation" },
  RX: { name: "Relax", type: "automation" },
  AP: { name: "Autopilot", type: "automation" },
  SO: { name: "Spun Out", type: "automation" },
  TD: { name: "Touch Device", type: "system" },
  SV2: { name: "Score V2", type: "system" },
};

/** A mod string as one acronym per mod: "HDDT" into HD and DT, "" into NM. */
export function modParts(mod: string | null | undefined): string[] {
  const raw = String(mod ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return raw.match(/SV2|[A-Z0-9]{2}/g) ?? ["NM"];
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
