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
  name: "guild-redeem",
  category: "special",
  aliases: ["server-redeem"],
  wl: true,
  description: "Redeem premium code for this server",
  execute: async (ctx, args, client) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";

    const ok = EMOJIS.ok;
    const no = EMOJIS.no;

    const guildId = ctx?.guild?.id;
    const guildName = ctx?.guild?.name;
    if (!guildId) {
      return sendResponse(ctx, { content: "This command can only be used in a server." });
    }

    const existing = await Premium.findOne({ Id: guildId, Type: "guild" });
    if (existing && (existing.Permanent || existing.Expire > Date.now())) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("premium")} Already Premium`)
        .setDescription(`${no} This server already has active premium access.`);
      return sendResponse(ctx, { embeds: [embed] });
    }

    const code = args?.[0];
    if (!code) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Missing Code`)
        .setDescription("Provide a redeem code.");
      return sendResponse(ctx, { embeds: [embed] });
    }

    const record = await redeemCode.findOne({ Code: code });
    if (!record) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Invalid Code`)
        .setDescription(`${no} Code is invalid or expired.`);
      return sendResponse(ctx, { embeds: [embed] });
    }

    if (!record.Permanent && record.Expiry < Date.now()) {
      await record.deleteOne().catch(() => {});
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Expired Code`)
        .setDescription(`${no} This code has expired.`);
      return sendResponse(ctx, { embeds: [embed] });
    }

    if (existing) await existing.deleteOne().catch(() => {});

    await Premium.create({
      Id: guildId,
      Type: "guild",
      Code: code,
      ActivatedAt: Date.now(),
      Expire: record.Expiry || 0,
      Permanent: record.Permanent || false,
      PlanType: "Standard"
    });

    if (record.Usage <= 1) await record.deleteOne().catch(() => {});
    else await redeemCode.findOneAndUpdate({ Code: code }, { Usage: record.Usage - 1 }).catch(() => {});

    const expiryText = record.Permanent ? "Never" : formatDuration(record.Expiry - Date.now());

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("premium")} Premium Activated`)
      .setDescription(`${ok} Premium activated successfully.`)
      .addFields(
        { name: "Server", value: `\`${guildName || guildId}\``, inline: true },
        { name: "Expiry", value: `\`${expiryText}\``, inline: true }
      );

    return sendResponse(ctx, { embeds: [embed] });
  }
};
