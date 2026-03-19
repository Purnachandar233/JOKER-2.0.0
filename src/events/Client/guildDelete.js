const { EmbedBuilder, WebhookClient } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
const EMBED_COLOR = "#ff0051";

function getEmoji(client, key, fallback = "") {
  return EMOJIS[key] || fallback;
}

module.exports = async (client, guild) => {
  try {
    if (client.lavalink) {
      try {
        const player = client.lavalink.players.get(guild.id);
        if (player) {
          await player.destroy().catch(() => {});
          client.lavalink.players.delete(guild.id);
          client.logger?.log?.(`Cleaned up player for deleted guild ${guild.id}`, "info");
        }
      } catch (err) {
        client.logger?.log?.(`Error cleaning up player for guild ${guild.id}: ${err?.message || err}`, "warn");
      }
    }
  } catch (err) {
    client.logger?.log?.(`guildDelete cleanup error for ${guild.id}: ${err?.message || err}`, "error");
  }

  const url = process.env.GUILD_WEBHOOK_URL || client.config.webhooks?.guildLogs;
  if (!url) return;

  const webhook = new WebhookClient({ url });
  try {
    const servers = client.cluster
      ? await client.cluster.fetchClientValues("guilds.cache.size")
      : [client.guilds.cache.size];
    const totalServers = servers.reduce((acc, value) => acc + value, 0);

    let ownerInfo;
    try {
      ownerInfo = await guild.fetchOwner();
    } catch (_err) {
      ownerInfo = { user: { tag: "Unknown" }, id: guild?.ownerId || "Unknown" };
    }

    const embed = new EmbedBuilder()
      .setColor(client?.embedColor || EMBED_COLOR)
      .setTitle(`${getEmoji(client, "error")} Left Server`)
      .setDescription("Joker Music has been removed from a guild.")
      .addFields(
        { name: "Server", value: `\`${guild.name || "Unknown"}\``, inline: true },
        { name: "Guild ID", value: `\`${guild.id || "Unknown"}\``, inline: true },
        { name: "Members", value: `\`${guild.memberCount || 0}\``, inline: true },
        {
          name: "Owner",
          value: `Tag: \`${ownerInfo.user?.tag || "Unknown"}\`\nID: \`${ownerInfo.id || "Unknown"}\``,
          inline: false
        }
      )
      .setFooter({ text: `${client.user.username} | Total Servers: ${totalServers}` });

    await webhook.send({ embeds: [embed] }).catch(err => {
      client.logger?.log?.(
        `Failed to send guildDelete webhook for ${guild.id}: ${err?.stack || err?.message || err}`,
        "warn"
      );
    });
  } catch (err) {
    client.logger?.log?.(`guildDelete handler error for ${guild.id}: ${err?.stack || err?.message || err}`, "error");
  }
};
