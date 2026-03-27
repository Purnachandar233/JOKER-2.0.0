const { EmbedBuilder } = require("discord.js");
const formatDuration = require("../../utils/formatDuration");
const redeemCode = require("../../schema/redemcode.js");
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

module.exports = {
  name: "user-redeem",
  category: "special",
  aliases: ["redeem-user"],
  wl: true,
  description: "Redeem a premium code for your account.",
  execute: async (ctx, args, client, prefix) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const statField = (label, value, emojiKey, inline = true) => ({
      name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
      value: String(value),
      inline
    });

    const ok = EMOJIS.ok;
    const no = EMOJIS.no;

    const user = ctx?.author || ctx?.user;
    if (!user?.id) {
      return sendResponse(ctx, { content: "Unable to resolve command user." });
    }

    const code = args?.[0]?.trim() || (isInteraction(ctx) ? ctx.options?.getString?.("code")?.trim() : null);
    if (!code) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Missing Code`)
        .setDescription(`${no} Usage: \`${prefix || "="}user-redeem <code>\``);
      return sendResponse(ctx, { embeds: [embed] });
    }

    const activePremium = await Premium.findOne({ Id: user.id, Type: "user" });
    if (activePremium && (activePremium.Permanent || activePremium.Expire > Date.now())) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("premium")} Already Premium`)
        .setDescription(`${no} You already have active premium access.`);
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

    if (activePremium) {
      await activePremium.deleteOne().catch(() => {});
    }

    await Premium.create({
      Id: user.id,
      Type: "user",
      Code: code,
      ActivatedAt: Date.now(),
      Expire: codeDoc.Expiry || 0,
      Permanent: codeDoc.Permanent || false,
      PlanType: "Standard"
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
      .setDescription(`${ok} User premium has been activated successfully.`)
      .addFields(
        statField("User", `\`${user.tag || user.id}\``, "users"),
        statField("Plan", "`Standard`", "premium"),
        statField("Validity", `\`${validity}\``, "time")
      );

    return sendResponse(ctx, { embeds: [embed] });
  }
};
