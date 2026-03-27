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
  name: "guild-validity",
  category: "special",
  aliases: ["server-validity", "gv"],
  wl: true,
  description: "Shows server premium validity",
  execute: async (ctx, args, client) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";

    const guildId = ctx?.guild?.id;
    const id = args?.[0] || guildId;
    if (!id) {
      return sendResponse(ctx, { content: "Server ID is required." });
    }

    const premium = await Premium.findOne({ Id: id, Type: "guild" });

    if (!premium) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("premium")} Premium Status`)
        .setDescription("This server has no premium access.");
      return sendResponse(ctx, { embeds: [embed] });
    }

    if (!premium.Permanent && premium.Expire < Date.now()) {
      await premium.deleteOne().catch(() => {});
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Premium Expired`)
        .setDescription("This premium access has expired.");
      return sendResponse(ctx, { embeds: [embed] });
    }

    const validity = premium.Permanent
      ? "Permanent"
      : formatDuration(premium.Expire - Date.now(), { verbose: false }).replace(/\s\d+s$/, "");

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("premium")} Server Premium Validity`)
      .setDescription(`Server: \`${id}\`\nValidity: \`${validity}\``);

    return sendResponse(ctx, { embeds: [embed] });
  }
};
