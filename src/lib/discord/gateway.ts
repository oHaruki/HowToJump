/**
 * The gateway, which exists only so the bot shows online. It carries no
 * traffic: commands arrive over HTTP and announcements go out over REST, so
 * the connection identifies with no intents and then does nothing but
 * heartbeat. Everything here is pure; the CLI drives the socket.
 */

/** Gateway opcodes, as Discord numbers them. */
export const DISPATCH = 0;
export const HEARTBEAT = 1;
export const IDENTIFY = 2;
export const RECONNECT = 7;
export const INVALID_SESSION = 9;
export const HELLO = 10;
export const HEARTBEAT_ACK = 11;

export const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";

/** What the bot is shown as doing. Discord's type 3 is "Watching". */
const WATCHING = 3;

export type Frame = { op: number; d?: unknown; s?: number | null; t?: string | null };
export type Outgoing = { op: number; d: unknown };

/**
 * Close codes worth retrying. The ones left out mean the settings are wrong
 * rather than the connection, so reconnecting would only repeat the refusal.
 */
export function isFatal(code: number): boolean {
  return code === 4004 || (code >= 4010 && code <= 4014);
}

/** The frame that opens a session: no intents, and a presence to show. */
export function identify(token: string, watching: string): Outgoing {
  return {
    op: IDENTIFY,
    d: {
      token,
      intents: 0,
      properties: { os: "linux", browser: "howtojump", device: "howtojump" },
      presence: {
        status: "online",
        afk: false,
        activities: [{ name: watching, type: WATCHING }],
      },
    },
  };
}

/** What one frame from Discord asks for. */
export type Reaction = {
  send?: Outgoing;
  /** Milliseconds between heartbeats, set once when the session opens. */
  heartbeatMs?: number;
  reconnect?: boolean;
  acked?: boolean;
  ready?: boolean;
};

/**
 * How to answer a frame. The caller keeps the sequence number, since it has
 * to send it on a heartbeat the timer raises as well as one Discord asks for.
 */
export function handle(frame: Frame, token: string, watching: string, sequence: number | null): Reaction {
  switch (frame.op) {
    case HELLO: {
      const d = frame.d as { heartbeat_interval?: number } | undefined;
      return { heartbeatMs: d?.heartbeat_interval, send: identify(token, watching) };
    }
    case HEARTBEAT:
      return { send: { op: HEARTBEAT, d: sequence } };
    case HEARTBEAT_ACK:
      return { acked: true };
    case RECONNECT:
    case INVALID_SESSION:
      return { reconnect: true };
    case DISPATCH:
      return frame.t === "READY" ? { ready: true } : {};
    default:
      return {};
  }
}

/** How long to wait before trying again, doubling to half a minute. */
export function backoff(attempt: number, jitter = Math.random()): number {
  const base = Math.min(30_000, 1000 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base * (0.8 + jitter * 0.4));
}
