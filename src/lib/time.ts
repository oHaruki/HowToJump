/** How long ago something happened, in words. Called from both server and client. */
export function timeAgo(d: Date | null, now = Date.now()): string {
  if (!d) return "never";
  const mins = Math.round((now - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + " min ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + (hrs === 1 ? " hour ago" : " hours ago");
  const days = Math.round(hrs / 24);
  if (days < 31) return days + (days === 1 ? " day ago" : " days ago");
  return d.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}
