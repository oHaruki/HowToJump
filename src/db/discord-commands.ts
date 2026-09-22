/**
 * Registers the slash commands with the Discord server. Guild commands show
 * up straight away, where global ones can take an hour, so it targets one
 * guild. Re-running it replaces the set, so every deploy runs it and a
 * changed command needs no step of its own.
 *
 * Usage: npm run discord:commands
 */
import "./env";

const player = {
  type: 3,
  name: "player",
  description: "Their osu! username",
  required: true,
};

const commands = [
  {
    name: "rs",
    description: "A player's most recent play",
    type: 1,
    options: [player],
  },
  {
    name: "sync",
    description: "Pull a player's recent plays in now",
    type: 1,
    options: [player],
  },
  {
    name: "profile",
    description: "A player's levels, tallies and best play",
    type: 1,
    options: [player],
  },
];

async function main() {
  const app = process.env.DISCORD_APPLICATION_ID;
  const guild = process.env.DISCORD_GUILD_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!app || !guild || !token) {
    // Runs on every deploy, so a server without Discord says so and moves on.
    const missing = Object.entries({
      DISCORD_APPLICATION_ID: app,
      DISCORD_GUILD_ID: guild,
      DISCORD_BOT_TOKEN: token,
    })
      .filter(([, value]) => !value)
      .map(([key]) => key);
    console.log("not registering: " + missing.join(", ") + " not set");
    return;
  }

  const res = await fetch(
    "https://discord.com/api/v10/applications/" + app + "/guilds/" + guild + "/commands",
    {
      method: "PUT",
      headers: { Authorization: "Bot " + token, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
    },
  );
  if (!res.ok) throw new Error("Discord said " + res.status + ": " + (await res.text()));
  console.log("registered " + commands.map((c) => "/" + c.name).join(", ") + " in guild " + guild);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
