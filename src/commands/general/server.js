const { EmbedBuilder } = require("discord.js");
const Premium = require("../../schema/Premium.js");
const formatDuration = require("../../utils/formatDuration");
const { safeReply } = require("../../utils/interactionResponder");

const EMOJIS = require("../../utils/emoji.json");

function isInteraction(ctx) {
  return Boolean(ctx && typeof ctx.deferReply === "function" && typeof ctx.editReply === "function");
}

async function sendResponse(ctx, payload) {
  if (isInteraction(ctx)) {
    const normalized = typeof payload === "string" ? { content: payload } : payload;
    return safeReply(ctx, normalized);
  }
  return ctx.channel.send(payload);
}

module.exports = {
  name: "server",
  category: "general",
  description: "Shows information about the current server.",
  execute: async (ctx, args, client) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const statField = (label, value, emojiKey, inline = true) => ({
      name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
      value: String(value),
      inline
    });

    const guild = ctx.guild;
    if (!guild) {
      return sendResponse(ctx, { content: "This command can only be used in a server." });
    }

    const id = args?.[0] || guild.id;
    const premium = await Premium.findOne({ Id: id, Type: "guild" });

    let premiumLabel = "No Premium";
    if (premium) {
      if (!premium.Permanent && premium.Expire < Date.now()) {
        await premium.deleteOne().catch(() => {});
        premiumLabel = "Expired";
      } else if (premium.Permanent) {
        premiumLabel = "Permanent";
      } else {
        const remaining = formatDuration(premium.Expire - Date.now(), { verbose: false }).replace(/\s\d+s$/, "");
        premiumLabel = `Expires in ${remaining}`;
      }
    }

    const createdAt = Math.floor(guild.createdTimestamp / 1000);
    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({ name: guild.name, iconURL: guild.iconURL({ forceStatic: false, size: 256 }) || null })
      .setDescription("server information.")
      .setThumbnail(guild.iconURL({ forceStatic: false, size: 256 }) || null)
      .addFields(
        statField("Owner", `<@${guild.ownerId}>`, "users", true),
        statField("Members", `\`${guild.memberCount}\``, "users", true),
        statField("Roles", `\`${guild.roles.cache.size}\``, "info", true),
        statField("Channels", `\`${guild.channels.cache.size}\``, "queue", true),
        statField("Boosts", `\`${guild.premiumSubscriptionCount || 0}\``, "star", true),
        statField("Created", `<t:${createdAt}:R>`, "time", true),
        statField("Premium", `\`${premiumLabel}\``, "premium", false)
      )
      .setFooter({ text: `Server ID: ${guild.id}` });

    return sendResponse(ctx, { embeds: [embed] });
  }
};
