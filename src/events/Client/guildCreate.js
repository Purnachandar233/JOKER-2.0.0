const { EmbedBuilder, WebhookClient } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
const EMBED_COLOR = "#ff0051";

function getEmoji(_client, key, fallback = "") {
  return EMOJIS[key] || fallback;
}

function createEmbed(client, options = {}) {
  const {
    title,
    description,
    fields,
    author,
    thumbnail,
    image,
    footer,
    timestamp = false
  } = options;

  const embed = new EmbedBuilder().setColor(client?.embedColor || EMBED_COLOR);

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (Array.isArray(fields) && fields.length > 0) embed.addFields(fields);
  if (author) embed.setAuthor(author);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
return embed;
}

module.exports = async (client, guild) => {
  const url = process.env.GUILD_WEBHOOK_URL || client.config.webhooks?.guildLogs;
  if (!url) return;

  const webhook = new WebhookClient({ url });
  try {
    const servers = client.cluster
      ? await client.cluster.fetchClientValues("guilds.cache.size")
      : [client.guilds.cache.size];
    const totalServers = servers.reduce((prev, val) => prev + val, 0);

    let ownerInfo;
    try {
      ownerInfo = await guild.fetchOwner();
    } catch (_err) {
      ownerInfo = { user: { tag: "Unknown" }, id: guild?.ownerId || "Unknown" };
    }

    const embed = createEmbed(client, {
      title: `${getEmoji(client, "success", "✅")} Joined Server`,
      description: "Joker Music has joined a new guild.",
      fields: [
        { name: "Server", value: `\`${guild.name || "Unknown"}\``, inline: true },
        { name: "Guild ID", value: `\`${guild.id || "Unknown"}\``, inline: true },
        { name: "Members", value: `\`${guild.memberCount || 0}\``, inline: true },
        {
          name: "Owner",
          value: `Tag: \`${ownerInfo.user?.tag || "Unknown"}\`\nID: \`${ownerInfo.id || "Unknown"}\``,
          inline: false
        }
      ],
      footer: `${client.user.username} | Total Servers: ${totalServers}`
    });

    await webhook.send({ embeds: [embed] }).catch(err => {
      client.logger?.log?.(
        `Failed to send guildCreate webhook for ${guild.id}: ${err?.stack || err?.message || err}`,
        "warn"
      );
    });
  } catch (err) {
    client.logger?.log?.(`guildCreate handler error for ${guild.id}: ${err?.stack || err?.message || err}`, "error");
  }
};
