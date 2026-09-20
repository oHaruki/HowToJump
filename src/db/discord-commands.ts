/**
 * Registers the /rs command with the Discord server. Guild commands show up
 * straight away, where global ones can take an hour, so it targets one guild.
 * Re-running it replaces the set, so it is safe to run after any change.
 *
 * Usage: npm run discord:commands
 */
import "./env";

const commands = [
  {
    name: "rs",
    description: "Pull a player's recent plays in now",
    type: 1,
    options: [
      { type: 3, name: "player", description: "Their osu! username", required: true },
    ],
  },
];

async function main() {
  const app = process.env.DISCORD_APPLICATION_ID;
  const guild = process.env.DISCORD_GUILD_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!app || !guild || !token) {
    throw new Error("DISCORD_APPLICATION_ID, DISCORD_GUILD_ID and DISCORD_BOT_TOKEN must be set");
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
  console.log("registered /rs in guild " + guild);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
