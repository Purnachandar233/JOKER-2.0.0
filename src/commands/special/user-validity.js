const { EmbedBuilder } = require("discord.js");
const formatDuration = require("../../utils/formatDuration");
const Premium = require("../../schema/Premium.js");
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

function resolveUserId(ctx, args) {
  if (isInteraction(ctx)) {
    const opt = ctx.options?.getUser?.("user");
    if (opt?.id) return opt.id;
  }

  const mentionId = ctx?.mentions?.users?.first?.()?.id || null;
  const argId = args?.[0] ? String(args[0]).replace(/[<@!>]/g, "") : null;
  return mentionId || (argId && /^\d{16,20}$/.test(argId) ? argId : null) || ctx?.author?.id || ctx?.user?.id || null;
}

module.exports = {
  name: "user-validity",
  category: "special",
  wl: true,
  description: "Shows user premium validity",
  execute: async (ctx, args, client) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";

    const id = resolveUserId(ctx, args);
    if (!id) return sendResponse(ctx, { content: "User could not be resolved." });

    const premium = await Premium.findOne({ Id: id, Type: "user" });

    if (!premium) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("premium")} Premium Status`)
        .setDescription("This user has no premium access.");
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
      .setTitle(`${getEmoji("premium")} User Premium Validity`)
      .setDescription(`User: \`${id}\`\nValidity: \`${validity}\``);

    return sendResponse(ctx, { embeds: [embed] });
  }
};
