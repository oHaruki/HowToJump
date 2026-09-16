import { normalizeMod } from "@/lib/mods";
import { tierByName, type Tier } from "@/lib/tiers";

/**
 * Reads what staff paste: a range copied out of Google Sheets (which lands on
 * the clipboard tab separated), a CSV export, or a bare list of links and IDs.
 */

export type RowStatus = "new" | "attention" | "duplicate" | "exists" | "error";
export type ParseMode = "sheet" | "csv" | "links" | null;

export type ParsedRow = {
  uid: string;
  /** Raw source cells, kept verbatim for the audit trail. */
  raw: Record<string, string>;
  link: string;
  beatmapId: number | null;
  beatmapsetId: number | null;
  title: string;
  version: string;
  mapper: string;
  category: string;
  length: string;
  speed: string;
  mod: string;
  stars: number | null;
  bpm: number | null;
  drain: string;
  drainSeconds: number | null;
  cs: number | null;
  ar: number | null;
  od: number | null;
  tier: string;
  tierObj: Tier | null;
  judge: string;
  fromLink: boolean;
  notes: string[];
  status: RowStatus;
};

export type ParseResult = { mode: ParseMode; rows: ParsedRow[] };

const FIELD_ORDER: string[] = [
  "link", "category", "length", "speed", "mod", "bg", "id", "mapper",
  "title", "stars", "bpm", "drain", "cs", "ar", "od", "tier", "judge",
];

const HEADER_MAP: Record<string, string> = {
  link: "link", url: "link",
  maincategory: "category", category: "category", cat: "category",
  length: "length", speed: "speed",
  mod: "mod", mods: "mod",
  bg: "bg", background: "bg",
  id: "id", beatmapid: "id", diffid: "id", difficultyid: "id",
  mapper: "mapper", creator: "mapper", host: "mapper",
  titledifficultyname: "title", title: "title", name: "title", song: "title",
  stars: "stars", sr: "stars", starrating: "stars",
  bpm: "bpm",
  drain: "drain", drainlength: "drain", draintime: "drain",
  cs: "cs", ar: "ar", od: "od",
  pack: "tier", packname: "tier", tier: "tier",
  judgement: "judge", judge: "judge", judgedby: "judge",
};

const DQ = String.fromCharCode(34);
const norm = (s: string) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The sheet uses European decimal commas throughout ("9,92"). Reading these
 * with parseFloat alone would silently truncate every star rating to 9.
 */
export function num(v: string | null | undefined): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/,/g, ".");
  if (!s) return null;
  const f = Number.parseFloat(s);
  return Number.isFinite(f) ? f : null;
}

/** "3:10" becomes 190. */
export function drainToSeconds(v: string | null | undefined): number | null {
  const m = String(v ?? "").trim().match(/^(\d+):([0-5]?\d)$/);
  if (!m) return null;
  return Number.parseInt(m[1], 10) * 60 + Number.parseInt(m[2], 10);
}

export function secondsToDrain(s: number | null | undefined): string {
  if (s == null) return "";
  const m = Math.floor(s / 60);
  const r = Math.abs(s % 60);
  return m + ":" + String(r).padStart(2, "0");
}

/** Pulls the difficulty ID out of a link, or takes it from the ID column. */
export function extractBeatmapId(
  link: string | null | undefined,
  idCell?: string | null,
): number | null {
  const direct = String(idCell ?? "").trim();
  if (/^\d+$/.test(direct)) return Number.parseInt(direct, 10);
  const s = String(link ?? "").trim();
  const m =
    s.match(/#(?:osu|taiko|fruits|mania)\/(\d+)/) ||
    s.match(/\/beatmaps\/(\d+)/) ||
    s.match(/\/b\/(\d+)/);
  if (m) return Number.parseInt(m[1], 10);
  if (/^\d+$/.test(s)) return Number.parseInt(s, 10);
  return null;
}

export function extractBeatmapsetId(link: string | null | undefined): number | null {
  const m = String(link ?? "").match(/beatmapsets\/(\d+)/);
  return m ? Number.parseInt(m[1], 10) : null;
}

/** "Title [Diff]" splits into its two halves. */
export function splitTitle(v: string | null | undefined) {
  const s = String(v ?? "").trim();
  const m = s.match(/^(.*)\s\[([^\]]+)\]$/);
  return m ? { title: m[1].trim(), version: m[2].trim() } : { title: s, version: "" };
}

/**
 * Splits one delimited line, honouring quoted cells so a map title containing
 * a comma survives a CSV round trip.
 */
export function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === DQ) {
        if (line[i + 1] === DQ) {
          cur += DQ;
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === DQ) {
      quoted = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

let seq = 0;
function nextUid(): string {
  seq += 1;
  return "r" + seq.toString(36) + "-" + Date.now().toString(36).slice(-4);
}

export function parsePaste(text: string): ParseResult {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (!lines.length) return { mode: null, rows: [] };

  const tabbed = lines.filter((l) => l.includes("\t")).length;
  const commad = lines.filter((l) => l.includes(",")).length;

  if (!tabbed && !commad) {
    return { mode: "links", rows: lines.map((l) => rowFromLink(l)) };
  }

  const delim = tabbed >= commad ? "\t" : ",";
  const cells = lines.map((l) => splitLine(l, delim).map((c) => c.trim()));

  // A header row is one where enough cells resolve to fields we know.
  const hits = cells[0].filter((c) => HEADER_MAP[norm(c)]).length;
  let order: Array<string | null> = FIELD_ORDER.slice();
  let body = cells;
  if (hits >= 4) {
    order = cells[0].map((c) => HEADER_MAP[norm(c)] ?? null);
    body = cells.slice(1);
  }

  return {
    mode: delim === "\t" ? "sheet" : "csv",
    rows: body.map((c) => rowFromCells(c, order)),
  };
}

export function rowFromLink(
  line: string,
  defaults?: { tier?: string; category?: string; mod?: string },
): ParsedRow {
  const link = String(line).trim();
  return finish({
    uid: nextUid(),
    raw: { link },
    link,
    beatmapId: extractBeatmapId(link),
    beatmapsetId: extractBeatmapsetId(link),
    title: "",
    version: "",
    mapper: "",
    category: defaults?.category ?? "",
    length: "",
    speed: "",
    mod: normalizeMod(defaults?.mod),
    stars: null,
    bpm: null,
    drain: "",
    drainSeconds: null,
    cs: null,
    ar: null,
    od: null,
    tier: defaults?.tier ?? "",
    tierObj: null,
    judge: "",
    fromLink: true,
    notes: [],
    status: "new",
  });
}

function rowFromCells(cells: string[], order: Array<string | null>): ParsedRow {
  const g: Record<string, string> = {};
  order.forEach((field, i) => {
    if (field) g[field] = cells[i] !== undefined ? cells[i] : "";
  });
  const t = splitTitle(g.title);
  return finish({
    uid: nextUid(),
    raw: g,
    link: g.link ?? "",
    beatmapId: extractBeatmapId(g.link, g.id),
    beatmapsetId: extractBeatmapsetId(g.link),
    title: t.title,
    version: t.version,
    mapper: g.mapper ?? "",
    category: g.category ?? "",
    length: g.length ?? "",
    speed: g.speed ?? "",
    mod: normalizeMod(g.mod),
    stars: num(g.stars),
    bpm: num(g.bpm),
    drain: g.drain ?? "",
    drainSeconds: drainToSeconds(g.drain),
    cs: num(g.cs),
    ar: num(g.ar),
    od: num(g.od),
    tier: g.tier ?? "",
    tierObj: null,
    judge: g.judge ?? "",
    fromLink: false,
    notes: [],
    status: "new",
  });
}

function finish(r: ParsedRow): ParsedRow {
  if (r.drainSeconds == null) r.drainSeconds = drainToSeconds(r.drain);
  return recheck(r);
}

/** Re-run after staff edit a row in the preview. */
export function recheck(r: ParsedRow): ParsedRow {
  r.notes = [];
  r.mod = normalizeMod(r.mod);
  r.tierObj = tierByName(r.tier);

  if (!r.beatmapId) {
    r.status = "error";
    r.notes.push(
      /beatmapsets\/\d+$/.test(r.link)
        ? "Set link with no difficulty, copy the link with the difficulty picked"
        : "No difficulty ID found in this row",
    );
    return r;
  }
  if (!r.tierObj) {
    r.notes.push(r.tier ? "Unknown pack: " + r.tier : "Pick a pack");
  }
  if (!r.category) r.notes.push("Pick a category");
  r.status = r.notes.length ? "attention" : "new";
  return r;
}

/** Identity is beatmap plus mod, so the same map under DT is a new entry. */
export function entryKey(beatmapId: number, mod: string): string {
  return beatmapId + "|" + normalizeMod(mod);
}

/**
 * Marks rows that repeat within the paste, and rows that already sit on the
 * ladder under the same mod.
 */
export function classify(rows: ParsedRow[], existingKeys: Set<string>): ParsedRow[] {
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.status === "error") continue;
    recheck(r);
    if (r.beatmapId == null) continue;
    const key = entryKey(r.beatmapId, r.mod);
    if (existingKeys.has(key)) {
      r.status = "exists";
      r.notes = ["Already on the ladder under " + r.mod];
      continue;
    }
    if (seen.has(key)) {
      r.status = "duplicate";
      r.notes = ["Same map and mod appears earlier in this paste"];
      continue;
    }
    seen.add(key);
  }
  return rows;
}

/** Which normalisations fired, so staff can see the paste was read correctly. */
export function normalizations(r: ParsedRow): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const pairs: Array<[string, number | null]> = [
    ["stars", r.stars],
    ["cs", r.cs],
    ["ar", r.ar],
    ["od", r.od],
  ];
  for (const pair of pairs) {
    const raw = r.raw[pair[0]];
    if (raw && raw.includes(",")) out.push([raw, String(pair[1])]);
  }
  if (r.drainSeconds != null && r.drain) out.push([r.drain, r.drainSeconds + "s"]);
  return out;
}
