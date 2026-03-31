const { EmbedBuilder } = require("discord.js");
const formatDuration = require("../../utils/formatDuration.js");
const Premium = require("../../schema/Premium.js");
const { safeReply } = require("../../utils/interactionResponder.js");
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

function getEmoji(key, fallback = "") {
  return EMOJIS[key] || fallback;
}

function normalizeTarget(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["user", "u", "member"].includes(raw)) return "user";
  if (["server", "guild", "g"].includes(raw)) return "guild";
  return null;
}

function resolveTarget(ctx, args) {
  if (isInteraction(ctx)) {
    return normalizeTarget(ctx.options?.getString?.("target"));
  }
  return normalizeTarget(args?.[0]);
}

function resolveUserId(ctx, args) {
  if (isInteraction(ctx)) {
    return ctx.options?.getUser?.("user")?.id || ctx?.user?.id || null;
  }

  const mentionId = ctx?.mentions?.users?.first?.()?.id || null;
  const argId = args?.[1] ? String(args[1]).replace(/[<@!>]/g, "") : null;
  return mentionId || (argId && /^\d{16,20}$/.test(argId) ? argId : null) || ctx?.author?.id || null;
}

function formatActivatedByLine(doc) {
  const activatorId = String(doc?.ActivatedBy || "").trim();
  return activatorId ? `Activated by: <@${activatorId}>` : null;
}

module.exports = {
  name: "validity",
  category: "special",
  aliases: [],
  wl: true,
  description: "Shows premium validity for a user or this server.",
  execute: async (ctx, args, client, prefix) => {
    const embedColor = client?.embedColor || "#ff0051";
    const target = resolveTarget(ctx, args);

    if (!target) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Validity Usage`)
        .setDescription(
          [
            `Use \`${prefix || "="}validity <user|server> [user]\``,
            `Examples: \`${prefix || "="}validity user\` or \`${prefix || "="}validity server\``,
          ].join("\n")
        );
      return sendResponse(ctx, { embeds: [embed] });
    }

    const targetId = target === "user"
      ? resolveUserId(ctx, args)
      : (ctx?.guild?.id || null);

    if (!targetId) {
      return sendResponse(ctx, {
        content: target === "user" ? "User could not be resolved." : "Server could not be resolved.",
      });
    }

    const premium = await Premium.findOne({ Id: targetId, Type: target });

    if (!premium) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("premium")} Premium Status`)
        .setDescription(
          target === "user"
            ? "This user has no premium access."
            : "This server has no premium access."
        );
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
      : formatDuration(Math.max(0, premium.Expire - Date.now()), { verbose: false }).replace(/\s\d+s$/, "");

    const activatedByLine = target === "guild" ? formatActivatedByLine(premium) : null;

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("premium")} ${target === "user" ? "User" : "Server"} Premium Validity`)
      .setDescription(
        [
          `${target === "user" ? "User" : "Server"}: \`${targetId}\``,
          `Validity: \`${validity}\``,
          activatedByLine,
        ].filter(Boolean).join("\n")
      );

    return sendResponse(ctx, {
      embeds: [embed],
      allowedMentions: { parse: [], repliedUser: false },
    });
  },
};
