const { EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
const Prefix = require("../../schema/prefix");
const Welcome = require("../../schema/welcome");
const DjRole = require("../../schema/djroleSchema");
const DefaultVolume = require("../../schema/defaultvolumeSchema");
const Requester = require("../../schema/requesterSchema");
const TwentyFourSeven = require("../../schema/twentyfourseven");
const GuildFilters = require("../../schema/guildFilters");
const Autoplay = require("../../schema/autoplay");
const Premium = require("../../schema/Premium");
const RedeemCode = require("../../schema/redemcode");
const User = require("../../schema/User");
const Blacklist = require("../../schema/blacklistSchema");

function getEmoji(key, fallback = "") {
  return EMOJIS[key] || fallback;
}

function formatCount(value) {
  return Number(value || 0).toLocaleString("en-US");
}

async function deleteWithCount(model, filter) {
  const result = await model.deleteMany(filter).catch(() => ({ deletedCount: 0 }));
  return Number(result?.deletedCount || 0);
}

async function getAllGuildIds(client) {
  const normalizeIds = (lists) => {
    const merged = new Set();
    for (const list of Array.isArray(lists) ? lists : []) {
      for (const guildId of Array.isArray(list) ? list : []) {
        const normalized = String(guildId || "").trim();
        if (normalized) merged.add(normalized);
      }
    }
    return [...merged];
  };

  if (client?.cluster && typeof client.cluster.broadcastEval === "function") {
    try {
      const clusterGuildIds = await client.cluster.broadcastEval((c) => c.guilds.cache.map((guild) => guild.id));
      const normalized = normalizeIds(clusterGuildIds);
      if (normalized.length) return normalized;
    } catch (_err) {}
  }

  if (client?.shard && typeof client.shard.broadcastEval === "function") {
    try {
      const shardGuildIds = await client.shard.broadcastEval((c) => c.guilds.cache.map((guild) => guild.id));
      const normalized = normalizeIds(shardGuildIds);
      if (normalized.length) return normalized;
    } catch (_err) {}
  }

  return client.guilds.cache.map((guild) => String(guild.id));
}

module.exports = {
  name: "dbcleanup",
  category: "owner",
  aliases: ["cleanupdb", "dbclean", "cleandb", "dbc"],
  description: "Cleans expired and orphaned database records.",
  owneronly: true,
  execute: async (message, args, client) => {
    const embedColor = client?.embedColor || "#ff0051";
    const now = Date.now();
    const guildIds = await getAllGuildIds(client);

    const counts = {
      expiredUserPremium: await deleteWithCount(Premium, {
        Type: "user",
        Permanent: { $ne: true },
        Expire: { $gt: 0, $lte: now },
      }),
      expiredGuildPremium: await deleteWithCount(Premium, {
        Type: "guild",
        Permanent: { $ne: true },
        Expire: { $gt: 0, $lte: now },
      }),
      invalidPremium: await deleteWithCount(Premium, {
        $or: [
          { Id: null },
          { Id: "" },
          { Type: null },
          { Type: "" },
        ],
      }),
      expiredCodes: await deleteWithCount(RedeemCode, {
        Permanent: { $ne: true },
        Expiry: { $gt: 0, $lte: now },
      }),
      usedCodes: await deleteWithCount(RedeemCode, {
        Usage: { $lte: 0 },
      }),
      invalidCodes: await deleteWithCount(RedeemCode, {
        $or: [
          { Code: null },
          { Code: "" },
        ],
      }),
      invalidUsers: await deleteWithCount(User, {
        $or: [
          { userId: null },
          { userId: "" },
        ],
      }),
      invalidBlacklists: await deleteWithCount(Blacklist, {
        $or: [
          { UserID: null },
          { UserID: "" },
        ],
      }),
      prefix: 0,
      welcome: 0,
      djRole: 0,
      defaultVolume: 0,
      requester: 0,
      twentyFourSeven: 0,
      guildFilters: 0,
      autoplay: 0,
      orphanGuildPremium: 0,
    };

    if (guildIds.length) {
      counts.prefix = await deleteWithCount(Prefix, { Guild: { $nin: guildIds } });
      counts.welcome = await deleteWithCount(Welcome, { guildID: { $nin: guildIds } });
      counts.djRole = await deleteWithCount(DjRole, { guildID: { $nin: guildIds } });
      counts.defaultVolume = await deleteWithCount(DefaultVolume, { guildID: { $nin: guildIds } });
      counts.requester = await deleteWithCount(Requester, { guildID: { $nin: guildIds } });
      counts.twentyFourSeven = await deleteWithCount(TwentyFourSeven, { guildID: { $nin: guildIds } });
      counts.guildFilters = await deleteWithCount(GuildFilters, { guildId: { $nin: guildIds } });
      counts.autoplay = await deleteWithCount(Autoplay, { guildID: { $nin: guildIds } });
      counts.orphanGuildPremium = await deleteWithCount(Premium, {
        Type: "guild",
        Id: { $nin: guildIds },
      });
    }

    const totalRemoved = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("settings")} Database Cleanup`)
      .setDescription(
        totalRemoved > 0
          ? `${getEmoji("success")} Removed **${formatCount(totalRemoved)}** stale records from the database.`
          : `${getEmoji("info")} No stale records were found.`
      )
      .addFields(
        {
          name: `${getEmoji("premium")} Premium`,
          value: [
            `Expired user premium: \`${formatCount(counts.expiredUserPremium)}\``,
            `Expired guild premium: \`${formatCount(counts.expiredGuildPremium)}\``,
            `Invalid premium docs: \`${formatCount(counts.invalidPremium)}\``,
            `Orphan guild premium: \`${formatCount(counts.orphanGuildPremium)}\``,
          ].join("\n"),
          inline: false,
        },
        {
          name: `${getEmoji("vote")} Codes`,
          value: [
            `Expired redeem codes: \`${formatCount(counts.expiredCodes)}\``,
            `Used-up redeem codes: \`${formatCount(counts.usedCodes)}\``,
            `Invalid redeem codes: \`${formatCount(counts.invalidCodes)}\``,
          ].join("\n"),
          inline: false,
        },
        {
          name: `${getEmoji("server")} Guild Data`,
          value: [
            `Prefix: \`${formatCount(counts.prefix)}\``,
            `Welcome: \`${formatCount(counts.welcome)}\``,
            `DJ role: \`${formatCount(counts.djRole)}\``,
            `Default volume: \`${formatCount(counts.defaultVolume)}\``,
            `Requester: \`${formatCount(counts.requester)}\``,
            `24/7: \`${formatCount(counts.twentyFourSeven)}\``,
            `Guild filters: \`${formatCount(counts.guildFilters)}\``,
            `Autoplay: \`${formatCount(counts.autoplay)}\``,
          ].join("\n"),
          inline: false,
        },
        {
          name: `${getEmoji("users")} Invalid Docs`,
          value: [
            `Users: \`${formatCount(counts.invalidUsers)}\``,
            `Blacklist entries: \`${formatCount(counts.invalidBlacklists)}\``,
          ].join("\n"),
          inline: false,
        }
      )
      .setFooter({
        text: `Guilds scanned: ${formatCount(guildIds.length)} | Owner-only maintenance command`,
      });

    return message.channel.send({ embeds: [embed] });
  },
};
