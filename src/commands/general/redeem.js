const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const formatDuration = require("../../utils/formatDuration.js");
const redeemCode = require("../../schema/redemcode.js");
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

function statField(label, value, emojiKey, inline = true) {
  return {
    name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
    value: String(value),
    inline,
  };
}

function hasManageServerPermission(ctx) {
  const memberPermissions = ctx?.memberPermissions || ctx?.member?.permissions;
  return Boolean(
    memberPermissions?.has?.(PermissionFlagsBits.ManageGuild) ||
    memberPermissions?.has?.(PermissionFlagsBits.Administrator)
  );
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

function resolveCode(ctx, args) {
  if (isInteraction(ctx)) {
    return String(ctx.options?.getString?.("code") || "").trim();
  }
  return String(args?.[1] || "").trim();
}

module.exports = {
  name: "redeem",
  category: "special",
  aliases: [],
  wl: true,
  description: "Redeem a premium code for yourself or this server.",
  execute: async (ctx, args, client, prefix) => {
    const embedColor = client?.embedColor || "#ff0051";
    const ok = EMOJIS.ok;
    const no = EMOJIS.no;

    const target = resolveTarget(ctx, args);
    const code = resolveCode(ctx, args);

    if (!target || !code) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Redeem Usage`)
        .setDescription(
          [
            `${no} Use \`${prefix || "="}redeem <user|server> <code>\``,
            `Examples: \`${prefix || "="}redeem user ABC123\` or \`${prefix || "="}redeem server ABC123\``,
          ].join("\n")
        );
      return sendResponse(ctx, { embeds: [embed] });
    }

    if (target === "guild" && !ctx?.guild?.id) {
      return sendResponse(ctx, { content: "Server premium can only be redeemed inside a server." });
    }

    if (target === "guild" && !hasManageServerPermission(ctx)) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Missing Permission`)
        .setDescription(`${no} You need **Manage Server** permission to redeem premium for this server.`);
      return sendResponse(ctx, { embeds: [embed] });
    }

    const codeDoc = await redeemCode.findOne({ Code: code });
    if (!codeDoc) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Invalid Code`)
        .setDescription(`${no} The provided code is invalid or already used.`);
      return sendResponse(ctx, { embeds: [embed] });
    }

    if (!codeDoc.Permanent && codeDoc.Expiry < Date.now()) {
      await codeDoc.deleteOne().catch(() => {});
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Expired Code`)
        .setDescription(`${no} This redeem code has expired.`);
      return sendResponse(ctx, { embeds: [embed] });
    }

    const targetId = target === "user" ? (ctx?.author?.id || ctx?.user?.id) : ctx.guild.id;
    const targetLabel = target === "user"
      ? (ctx?.author?.tag || ctx?.user?.tag || targetId)
      : (ctx?.guild?.name || targetId);

    const existing = await Premium.findOne({ Id: targetId, Type: target });
    if (existing && (existing.Permanent || existing.Expire > Date.now())) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("premium")} Already Premium`)
        .setDescription(
          target === "user"
            ? `${no} You already have active premium access.`
            : `${no} This server already has active premium access.`
        );
      return sendResponse(ctx, { embeds: [embed] });
    }

    if (existing) {
      await existing.deleteOne().catch(() => {});
    }

    await Premium.create({
      Id: targetId,
      Type: target,
      Code: code,
      ActivatedBy: ctx?.author?.id || ctx?.user?.id || null,
      ActivatedAt: Date.now(),
      Expire: codeDoc.Expiry || 0,
      Permanent: codeDoc.Permanent || false,
      PlanType: "Standard",
    });

    if (codeDoc.Usage <= 1) {
      await codeDoc.deleteOne().catch(() => {});
    } else {
      await redeemCode.findOneAndUpdate({ Code: code }, { Usage: codeDoc.Usage - 1 }).catch(() => {});
    }

    const validity = codeDoc.Permanent
      ? "Permanent"
      : formatDuration(Math.max(0, codeDoc.Expiry - Date.now()), { verbose: false }).replace(/\s\d+s$/, "");

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("premium")} Premium Activated`)
      .setDescription(
        target === "user"
          ? `${ok} User premium has been activated successfully.`
          : `${ok} Server premium has been activated successfully.`
      )
      .addFields(
        statField(target === "user" ? "User" : "Server", `\`${targetLabel}\``, target === "user" ? "users" : "server"),
        statField("Plan", "`Standard`", "premium"),
        statField("Validity", `\`${validity}\``, "time")
      );

    return sendResponse(ctx, { embeds: [embed] });
  },
};
