/**
 * Holds one gateway connection, so the bot shows online. Nothing else runs
 * through it: commands reach the site over HTTP and announcements leave it
 * over REST.
 *
 * Usage: npm run discord:presence
 */
import "./env";
import {
  GATEWAY_URL, backoff, handle, isFatal, type Frame,
} from "../lib/discord/gateway";

/** What the bot is shown watching, unless a deploy says otherwise. */
const DEFAULT_PRESENCE = "the ladder";

/** Keeps the process up without a connection, so a restart loop cannot start. */
function park(why: string): Promise<never> {
  console.log("presence: " + why + "; idling");
  return new Promise(() => {});
}

/**
 * One connection, from open to close. Resolves with the close code, so the
 * loop below can tell a hiccup from a refusal.
 */
function connect(token: string, watching: string): Promise<number> {
  return new Promise((resolve) => {
    const ws = new WebSocket(GATEWAY_URL);
    let beat: ReturnType<typeof setInterval> | undefined;
    let sequence: number | null = null;
    let acked = true;
    let opened = false;

    const send = (frame: unknown) => ws.send(JSON.stringify(frame));

    const heartbeat = () => {
      // An unanswered heartbeat means the connection is dead but still open.
      if (!acked) {
        clearInterval(beat);
        ws.close(4000, "no heartbeat ack");
        return;
      }
      acked = false;
      send({ op: 1, d: sequence });
    };

    ws.addEventListener("message", (e) => {
      const frame = JSON.parse(String(e.data)) as Frame;
      if (frame.s != null) sequence = frame.s;

      const r = handle(frame, token, watching, sequence);
      if (r.acked) acked = true;
      if (r.send) send(r.send);
      if (r.heartbeatMs) {
        // The first beat is offset, so every bot does not beat together.
        setTimeout(() => {
          heartbeat();
          beat = setInterval(heartbeat, r.heartbeatMs);
        }, r.heartbeatMs * Math.random());
      }
      if (r.ready) {
        opened = true;
        console.log("presence: online, watching " + watching);
      }
      if (r.reconnect) {
        clearInterval(beat);
        ws.close(4000, "asked to reconnect");
      }
    });

    ws.addEventListener("error", () => {
      // The close that follows carries the code, so it is handled there.
    });

    ws.addEventListener("close", (e) => {
      clearInterval(beat);
      console.log("presence: closed " + e.code + (e.reason ? " " + e.reason : ""));
      resolve(opened && e.code === 1000 ? 0 : e.code);
    });
  });
}

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return park("DISCORD_BOT_TOKEN is not set");
  const watching = process.env.DISCORD_PRESENCE || DEFAULT_PRESENCE;

  let attempt = 0;
  for (;;) {
    const code = await connect(token, watching).catch(() => 1006);
    if (isFatal(code)) {
      // Retrying a refused token only repeats the refusal at Discord.
      return park("Discord refused the connection with " + code);
    }
    attempt = code === 0 ? 0 : attempt + 1;
    const wait = backoff(attempt + 1);
    console.log("presence: reconnecting in " + Math.round(wait / 1000) + "s");
    await new Promise((r) => setTimeout(r, wait));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
