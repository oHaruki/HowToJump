/**
 * The links a staff member shows on the team page, beside the osu! profile
 * every member gets. Pure, so it runs without the database.
 */

/** How many links of their own a member can show. */
export const MAX_LINKS = 2;

const MAX_LENGTH = 200;

/** The sites that get their own icon, by the hosts they live on. */
const PLATFORMS: Array<{ icon: string; name: string; hosts: string[] }> = [
  { icon: "osu", name: "osu!", hosts: ["osu.ppy.sh"] },
  { icon: "x", name: "Twitter", hosts: ["x.com", "twitter.com"] },
  { icon: "youtube", name: "YouTube", hosts: ["youtube.com", "youtu.be"] },
  { icon: "twitch", name: "Twitch", hosts: ["twitch.tv"] },
  { icon: "discord", name: "Discord", hosts: ["discord.gg", "discord.com"] },
  { icon: "instagram", name: "Instagram", hosts: ["instagram.com"] },
  { icon: "tiktok", name: "TikTok", hosts: ["tiktok.com"] },
  { icon: "bluesky", name: "Bluesky", hosts: ["bsky.app"] },
  { icon: "github", name: "GitHub", hosts: ["github.com"] },
  { icon: "kick", name: "Kick", hosts: ["kick.com"] },
  { icon: "reddit", name: "Reddit", hosts: ["reddit.com"] },
  { icon: "steam", name: "Steam", hosts: ["steamcommunity.com"] },
  { icon: "soundcloud", name: "SoundCloud", hosts: ["soundcloud.com"] },
  { icon: "kofi", name: "Ko-fi", hosts: ["ko-fi.com"] },
  { icon: "spotify", name: "Spotify", hosts: ["spotify.com"] },
  { icon: "threads", name: "Threads", hosts: ["threads.net", "threads.com"] },
];

/**
 * A pasted link as it is kept: trimmed, https when no scheme is given, or
 * null when it isn't a web address.
 */
export function normalizeLink(raw: string): string | null {
  const text = String(raw ?? "").trim();
  if (!text || text.length > MAX_LENGTH || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : "https://" + text;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || !url.hostname.includes(".")) return null;
  return url.href;
}

/**
 * Which site a link is on, its host or any subdomain of it matching, as
 * the icon to draw and the name to show. A site without an icon is named
 * by its host.
 */
export function linkKind(link: string): { icon: string | null; name: string } {
  const host = new URL(link).hostname.toLowerCase().replace(/^www\./, "");
  const site = PLATFORMS.find((p) => p.hosts.some((h) => host === h || host.endsWith("." + h)));
  return site ? { icon: site.icon, name: site.name } : { icon: null, name: host };
}
