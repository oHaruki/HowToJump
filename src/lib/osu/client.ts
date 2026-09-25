import { modsFromApi, refusedMod } from "@/lib/mods";

/**
 * osu! API v2 client. Two credentials paths share one rate limiter:
 * client_credentials for beatmap lookups, and a user's access token for
 * their recent plays. osu! allow 60 requests a minute.
 */

const API = "https://osu.ppy.sh/api/v2";
const TOKEN_URL = "https://osu.ppy.sh/oauth/token";

/* ------------------------------------------------------------ rate limiter */

const MAX_PER_MINUTE = 55; // a little under osu!'s stated 60
let windowStart = Date.now();
let used = 0;
let chain: Promise<unknown> = Promise.resolve();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Serialises calls and holds the app under the published limit. */
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    for (;;) {
      const now = Date.now();
      if (now - windowStart >= 60_000) {
        windowStart = now;
        used = 0;
      }
      if (used < MAX_PER_MINUTE) {
        used += 1;
        return fn();
      }
      await sleep(Math.max(50, 60_000 - (now - windowStart)));
    }
  };
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next;
}

/* ----------------------------------------------------------- app token */

let appToken: { value: string; expiresAt: number } | null = null;

async function appAccessToken(): Promise<string> {
  if (appToken && Date.now() < appToken.expiresAt - 60_000) return appToken.value;

  const clientId = process.env.OSU_CLIENT_ID;
  const clientSecret = process.env.OSU_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("OSU_CLIENT_ID and OSU_CLIENT_SECRET must be set");
  }

  const res = await limited(() =>
    fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
        scope: "public",
      }),
      cache: "no-store",
    }),
  );
  if (!res.ok) throw new Error("osu! token request failed: " + res.status);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  appToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return appToken.value;
}

async function apiGet<T>(path: string, token?: string): Promise<T> {
  const bearer = token ?? (await appAccessToken());
  const res = await limited(() =>
    fetch(API + path, {
      headers: {
        Authorization: "Bearer " + bearer,
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-version": "20220705",
      },
      cache: "no-store",
    }),
  );
  if (res.status === 404) throw new NotFound(path);
  if (!res.ok) throw new Error("osu! GET " + path + " failed: " + res.status);
  return (await res.json()) as T;
}

export class NotFound extends Error {
  constructor(path: string) {
    super("osu! resource not found: " + path);
  }
}

/* --------------------------------------------------------------- beatmaps */

export type OsuBeatmap = {
  id: number;
  beatmapset_id: number;
  version: string;
  difficulty_rating: number;
  bpm: number | null;
  hit_length: number;
  total_length: number;
  cs: number;
  ar: number;
  accuracy: number; // OD
  drain: number; // HP
  max_combo: number | null;
  count_circles?: number;
  count_sliders?: number;
  count_spinners?: number;
  status: string;
  user_id: number;
  beatmapset?: {
    id: number;
    artist: string;
    title: string;
    creator: string;
    user_id: number;
    status: string;
    covers?: Record<string, string>;
  };
};

export type BeatmapFacts = {
  osuBeatmapId: number;
  osuBeatmapsetId: number;
  artist: string;
  title: string;
  version: string;
  mapper: string;
  mapperUserId: number;
  stars: number;
  bpm: number | null;
  drainSeconds: number;
  totalSeconds: number;
  cs: number;
  ar: number;
  od: number;
  hp: number;
  maxCombo: number | null;
  /** Circles, sliders and spinners: what a miss can land on. */
  noteCount: number | null;
  status: string;
  coverUrl: string;
  cardUrl: string;
  listUrl: string;
};

const coverBase = (setId: number, kind: string) =>
  "https://assets.ppy.sh/beatmaps/" + setId + "/covers/" + kind + ".jpg";

export function toFacts(b: OsuBeatmap): BeatmapFacts {
  const set = b.beatmapset;
  const setId = b.beatmapset_id ?? set?.id ?? 0;
  return {
    osuBeatmapId: b.id,
    osuBeatmapsetId: setId,
    artist: set?.artist ?? "",
    title: set?.title ?? "",
    version: b.version,
    // The difficulty's own owner, which differs from the set host on guest diffs.
    mapper: set?.creator ?? "",
    mapperUserId: b.user_id ?? set?.user_id ?? 0,
    stars: b.difficulty_rating,
    bpm: b.bpm,
    drainSeconds: b.hit_length,
    totalSeconds: b.total_length,
    cs: b.cs,
    ar: b.ar,
    od: b.accuracy,
    hp: b.drain,
    maxCombo: b.max_combo ?? null,
    noteCount:
      b.count_circles == null
        ? null
        : b.count_circles + (b.count_sliders ?? 0) + (b.count_spinners ?? 0),
    status: b.status ?? set?.status ?? "unknown",
    coverUrl: coverBase(setId, "cover"),
    cardUrl: coverBase(setId, "card"),
    listUrl: coverBase(setId, "list"),
  };
}

/** Looks up to 50 difficulties up in one call, so a 200 row paste is 4 requests. */
export async function fetchBeatmaps(ids: number[]): Promise<Map<number, BeatmapFacts>> {
  const out = new Map<number, BeatmapFacts>();
  const unique = Array.from(new Set(ids.filter((n) => Number.isFinite(n) && n > 0)));
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const qs = chunk.map((id) => "ids[]=" + id).join("&");
    const json = await apiGet<{ beatmaps: OsuBeatmap[] }>("/beatmaps?" + qs);
    for (const b of json.beatmaps ?? []) out.set(b.id, toFacts(b));
  }
  return out;
}

export async function fetchBeatmap(id: number): Promise<BeatmapFacts | null> {
  try {
    const b = await apiGet<OsuBeatmap>("/beatmaps/" + id);
    return toFacts(b);
  } catch (err) {
    if (err instanceof NotFound) return null;
    throw err;
  }
}

/**
 * Mod adjusted star rating. Needs the full difficulty calculator, so it
 * comes from a POST, one beatmap and mod at a time.
 */
export async function fetchStarRating(
  osuBeatmapId: number,
  mods: string[],
): Promise<number | null> {
  const bearer = await appAccessToken();
  const res = await limited(() =>
    fetch(API + "/beatmaps/" + osuBeatmapId + "/attributes", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + bearer,
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-version": "20220705",
      },
      body: JSON.stringify({ ruleset: "osu", mods }),
      cache: "no-store",
    }),
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    attributes?: { star_rating?: number; approach_rate?: number; overall_difficulty?: number };
  };
  return json.attributes?.star_rating ?? null;
}

/* ----------------------------------------------------------------- scores */

type OsuScoreStatistics = {
  count_miss?: number;
  miss?: number;
  great?: number;
  ok?: number;
  meh?: number;
  large_tick_hit?: number;
  slider_tail_hit?: number;
  legacy_combo_increase?: number;
};

export type OsuScore = {
  id?: number;
  best_id?: number;
  user_id?: number;
  user?: { id: number };
  /** 0 is osu!standard. Older replies say mode_int instead. */
  ruleset_id?: number;
  mode_int?: number;
  beatmap?: {
    id: number;
    version?: string;
    difficulty_rating?: number;
    count_circles?: number;
    count_sliders?: number;
    count_spinners?: number;
  };
  beatmapset?: { id: number; artist?: string; title?: string; creator?: string };
  beatmap_id?: number;
  accuracy: number;
  max_combo: number;
  perfect?: boolean;
  is_perfect_combo?: boolean;
  legacy_perfect?: boolean;
  rank: string;
  mods: Array<{ acronym: string }> | string[];
  statistics: OsuScoreStatistics;
  /** What a full run would have judged; how far a fail got is read against it. */
  maximum_statistics?: OsuScoreStatistics;
  created_at?: string;
  ended_at?: string;
  passed?: boolean;
};

export type PlayFacts = {
  osuScoreId: number | null;
  osuBeatmapId: number;
  mods: string;
  missCount: number;
  accuracy: number;
  maxCombo: number;
  isFc: boolean;
  isPerfect: boolean;
  playedAt: Date | null;
  passed: boolean;
  /** The mod that keeps the play from counting, by name, such as No Fail. */
  refused: string | null;
};

/**
 * Whether every combo a play is short of the map's could be a dropped slider
 * end, which costs one combo without breaking it. A lazer score counts its
 * ends; a stable one shows each as a 100.
 */
function onlyDroppedEnds(s: OsuScore): boolean {
  const most = s.maximum_statistics;
  if (!most) return false;
  const mapCombo =
    (most.great ?? 0) + (most.large_tick_hit ?? 0) + (most.slider_tail_hit ?? 0) +
    (most.legacy_combo_increase ?? 0);
  if (!mapCombo) return false;
  const stats = s.statistics ?? {};
  const dropped =
    most.slider_tail_hit != null
      ? most.slider_tail_hit - (stats.slider_tail_hit ?? 0)
      : (stats.ok ?? 0);
  return mapCombo - (s.max_combo ?? 0) <= dropped;
}

export function toPlay(s: OsuScore): PlayFacts {
  const stats = s.statistics ?? {};
  const missCount = stats.count_miss ?? stats.miss ?? 0;
  // A full combo means no misses and no break in the combo. osu! flags only
  // a combo that matches the map's, as "perfect" on legacy scores and
  // "is_perfect_combo" on newer ones, so dropped slider ends are read too.
  const isFc =
    missCount === 0 &&
    (Boolean(s.perfect ?? s.legacy_perfect ?? s.is_perfect_combo) || onlyDroppedEnds(s));
  // SSS is reserved for a run that also dropped nothing to 100 or 50.
  const rank = String(s.rank ?? "");
  const isPerfect = isFc && (rank === "X" || rank === "XH" || rank === "SS" || rank === "SSH");
  const when = s.ended_at ?? s.created_at ?? null;
  return {
    osuScoreId: s.id ?? s.best_id ?? null,
    osuBeatmapId: s.beatmap?.id ?? s.beatmap_id ?? 0,
    mods: modsFromApi(s.mods),
    missCount,
    accuracy: (s.accuracy ?? 0) * 100,
    maxCombo: s.max_combo ?? 0,
    isFc,
    isPerfect,
    playedAt: when ? new Date(when) : null,
    passed: s.passed !== false,
    refused: refusedMod(s.mods),
  };
}

/**
 * A player's recent plays. Returns plays rather than leaderboard entries,
 * so it covers graveyard maps. Limited to the last 100 plays or 24 hours,
 * whichever runs out first, which sets the sync cadence.
 */
export async function fetchRecentPlays(
  osuUserId: number,
  token: string | undefined,
  limit = 100,
): Promise<PlayFacts[]> {
  const qs = "include_fails=1&mode=osu&limit=" + Math.min(100, limit);
  const rows = await apiGet<OsuScore[]>(
    "/users/" + osuUserId + "/scores/recent?" + qs,
    token,
  );
  return (rows ?? []).map(toPlay).filter((p) => p.osuBeatmapId > 0);
}

/** How much of the map a play got through, in percent, or null when it can't be told. */
export function completionOf(score: OsuScore, noteCount: number | null): number | null {
  const s = score.statistics ?? {};
  const judged = (s.great ?? 0) + (s.ok ?? 0) + (s.meh ?? 0) + (s.miss ?? s.count_miss ?? 0);
  const total = score.maximum_statistics?.great ?? noteCount;
  if (!total) return null;
  return Math.min(100, (judged / total) * 100);
}

/** A player's newest play in the last day, fails included, or null when there is none. */
export async function fetchLatestScore(osuUserId: number): Promise<OsuScore | null> {
  const rows = await apiGet<OsuScore[]>(
    "/users/" + osuUserId + "/scores/recent?include_fails=1&mode=osu&limit=1",
  );
  return rows?.[0] ?? null;
}

/**
 * One score by its osu! ID, or null when osu! has none. An old style ID,
 * from a /scores/osu/<id> link, is looked up under its ruleset.
 */
export async function fetchScore(ref: {
  id: number;
  ruleset: string | null;
}): Promise<OsuScore | null> {
  try {
    return await apiGet<OsuScore>("/scores/" + (ref.ruleset ? ref.ruleset + "/" : "") + ref.id);
  } catch (err) {
    if (err instanceof NotFound) return null;
    throw err;
  }
}

type OsuUserWithStats = {
  id: number;
  statistics_rulesets?: { osu?: { play_count?: number } };
};

/**
 * osu! standard play counts, fifty players to a request. Comparing between
 * checks says who has played since. Restricted or deleted accounts are
 * absent from the result.
 */
export async function fetchPlayCounts(osuUserIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const unique = Array.from(new Set(osuUserIds.filter((n) => Number.isFinite(n) && n > 0)));
  for (let i = 0; i < unique.length; i += 50) {
    const qs = unique
      .slice(i, i + 50)
      .map((id) => "ids[]=" + id)
      .join("&");
    const json = await apiGet<{ users?: OsuUserWithStats[] }>("/users?" + qs);
    for (const u of json.users ?? []) {
      const n = u.statistics_rulesets?.osu?.play_count;
      if (typeof n === "number") out.set(u.id, n);
    }
  }
  return out;
}

export type OsuMe = {
  id: number;
  username: string;
  avatar_url: string;
  country_code: string;
  statistics?: { global_rank: number | null };
};

/** Looks a player up by numeric ID or by username. */
export async function fetchUser(identifier: string): Promise<OsuMe | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  const key = /^\d+$/.test(trimmed) ? "id" : "username";
  try {
    return await apiGet<OsuMe>(
      "/users/" + encodeURIComponent(trimmed) + "/osu?key=" + key,
    );
  } catch (err) {
    if (err instanceof NotFound) return null;
    throw err;
  }
}

export async function fetchMe(token: string): Promise<OsuMe> {
  return apiGet<OsuMe>("/me/osu", token);
}

/** Exchanges a refresh token for a fresh access token. */
export async function refreshUserToken(refreshToken: string) {
  const res = await limited(() =>
    fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: process.env.OSU_CLIENT_ID,
        client_secret: process.env.OSU_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      cache: "no-store",
    }),
  );
  if (!res.ok) throw new Error("osu! refresh failed: " + res.status);
  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}
