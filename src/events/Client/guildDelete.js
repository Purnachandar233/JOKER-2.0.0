const { EmbedBuilder, WebhookClient } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
const EMBED_COLOR = "#ff0051";
const Prefix = require("../../schema/prefix");
const Welcome = require("../../schema/welcome");
const DjRole = require("../../schema/djroleSchema");
const DefaultVolume = require("../../schema/defaultvolumeSchema");
const Requester = require("../../schema/requesterSchema");
const TwentyFourSeven = require("../../schema/twentyfourseven");
const GuildFilters = require("../../schema/guildFilters");
const Autoplay = require("../../schema/autoplay");
const Premium = require("../../schema/Premium");

function getEmoji(client, key, fallback = "") {
  return EMOJIS[key] || fallback;
}

async function cleanupGuildData(guildId) {
  const id = String(guildId || "").trim();
  if (!id) return { deleted: 0 };

  const results = await Promise.all([
    Prefix.deleteMany({ Guild: id }).catch(() => ({ deletedCount: 0 })),
    Welcome.deleteMany({ guildID: id }).catch(() => ({ deletedCount: 0 })),
    DjRole.deleteMany({ guildID: id }).catch(() => ({ deletedCount: 0 })),
    DefaultVolume.deleteMany({ guildID: id }).catch(() => ({ deletedCount: 0 })),
    Requester.deleteMany({ guildID: id }).catch(() => ({ deletedCount: 0 })),
    TwentyFourSeven.deleteMany({ guildID: id }).catch(() => ({ deletedCount: 0 })),
    GuildFilters.deleteMany({ guildId: id }).catch(() => ({ deletedCount: 0 })),
    Autoplay.deleteMany({ guildID: id }).catch(() => ({ deletedCount: 0 })),
    Premium.deleteMany({ Id: id, Type: "guild" }).catch(() => ({ deletedCount: 0 })),
  ]);

  const deleted = results.reduce((count, result) => count + Number(result?.deletedCount || 0), 0);
  return { deleted };
}

module.exports = async (client, guild) => {
  try {
    const cleanup = await cleanupGuildData(guild?.id);
    client.logger?.log?.(`guildDelete data cleanup for ${guild?.id}: removed ${cleanup.deleted} records`, "info");
  } catch (err) {
    client.logger?.log?.(`guildDelete database cleanup error for ${guild?.id}: ${err?.message || err}`, "warn");
  }

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
