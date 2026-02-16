const { EmbedBuilder } = require("discord.js");

const formatDuration = require("../../utils/formatDuration");
const redeemCode = require("../../schema/redemcode.js");
const Premium = require("../../schema/Premium.js");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "set-serverprem",
  category: "owner",
  aliases: ["add"],
  description: "Assign premium to a guild using a redeem code.",
  owneronly: true,
  execute: async (message, args, client, prefix) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const createEmbed = ({ title, description, fields, author, thumbnail, image, footer, timestamp = false }) => {
      const embed = new EmbedBuilder().setColor(embedColor);
      if (title) embed.setTitle(title);
      if (description) embed.setDescription(description);
      if (Array.isArray(fields) && fields.length > 0) embed.addFields(fields);
      if (author) embed.setAuthor(author);
      if (thumbnail) embed.setThumbnail(thumbnail);
      if (image) embed.setImage(image);
return embed;
    };
    const statField = (label, value, emojiKey, inline = true) => ({
      name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
      value: String(value),
      inline
    });

    const ok = EMOJIS.ok;
    const no = EMOJIS.no;
    const firstArg = args[0];
    const looksLikeGuildId = /^\d{16,20}$/.test(firstArg || "");
    const guildId = looksLikeGuildId ? firstArg : message.guild.id;
    const code = looksLikeGuildId ? args[1] : firstArg;

    if (!code) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Missing Code`,
        description: `${no} Usage: \`${prefix}set-serverprem <guildId> <code>\` or \`${prefix}set-serverprem <code>\``
      });
      return message.channel.send({ embeds: [embed] });
    }

    const existing = await Premium.findOne({ Id: guildId, Type: "guild" });
    if (existing && (existing.Permanent || existing.Expire > Date.now())) {
      const embed = createEmbed({
        title: `${getEmoji("premium")} Already Premium`,
        description: `${no} This server already has an active premium subscription.`
      });
      return message.channel.send({ embeds: [embed] });
    }

    const codeDoc = await redeemCode.findOne({ Code: code });
    if (!codeDoc) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Invalid Code`,
        description: `${no} Code is invalid or expired.`
      });
      return message.channel.send({ embeds: [embed] });
    }

    if (!codeDoc.Permanent && codeDoc.Expiry < Date.now()) {
      await codeDoc.deleteOne();
      const embed = createEmbed({
        title: `${getEmoji("error")} Expired Code`,
        description: `${no} This code has already expired.`
      });
      return message.channel.send({ embeds: [embed] });
    }

    if (existing) {
      await existing.deleteOne();
    }

    await Premium.create({
      Id: guildId,
      Type: "guild",
      Code: code,
      ActivatedAt: Date.now(),
      Expire: codeDoc.Expiry || 0,
      Permanent: codeDoc.Permanent || false,
      PlanType: "Standard"
    });

    if (codeDoc.Usage <= 1) {
      await codeDoc.deleteOne();
    } else {
      await redeemCode.findOneAndUpdate({ Code: code }, { Usage: codeDoc.Usage - 1 });
    }

    const validity = codeDoc.Permanent
      ? "Permanent"
      : formatDuration(Math.max(0, codeDoc.Expiry - Date.now()), { verbose: false }).replace(/\s\d+s$/, "");

    const embed = createEmbed({
      title: `${getEmoji("premium")} Premium Activated`,
      description: `${ok} Server premium activated successfully.`,
      fields: [
        statField("Target Guild", `\`${guildId}\``, "server"),
        statField("Plan", "`Standard`", "premium"),
        statField("Validity", `\`${validity}\``, "time")
      ]
    });

    return message.channel.send({ embeds: [embed] });
  }
};

