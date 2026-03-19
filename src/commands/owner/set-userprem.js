const { EmbedBuilder } = require("discord.js");

const formatDuration = require("../../utils/formatDuration");
const redeemCode = require("../../schema/redemcode.js");
const Premium = require("../../schema/Premium.js");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "set-userprem",
  category: "owner",
  aliases: ["adduser"],
  description: "Assign premium to a user using a redeem code.",
  owneronly: true,
  execute: async (message, args, client, prefix) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const statField = (label, value, emojiKey, inline = true) => ({
      name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
      value: String(value),
      inline
    });

    const ok = EMOJIS.ok;
    const no = EMOJIS.no;
    const explicitMember = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    const member = explicitMember || message.member;
    const code = explicitMember ? args[1] : args[0];

    if (!code) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Missing Code`)
        .setDescription(`${no} Usage: \`${prefix}set-userprem <@user|id> <code>\` or \`${prefix}set-userprem <code>\``);
      return message.channel.send({ embeds: [embed] });
    }

    const existing = await Premium.findOne({ Id: member.id, Type: "user" });
    if (existing && (existing.Permanent || existing.Expire > Date.now())) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("premium")} Already Premium`)
        .setDescription(`${no} This user already has an active premium subscription.`);
      return message.channel.send({ embeds: [embed] });
    }

    const codeDoc = await redeemCode.findOne({ Code: code });
    if (!codeDoc) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Invalid Code`)
        .setDescription(`${no} Code is invalid or expired.`);
      return message.channel.send({ embeds: [embed] });
    }

    if (!codeDoc.Permanent && codeDoc.Expiry < Date.now()) {
      await codeDoc.deleteOne();
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Expired Code`)
        .setDescription(`${no} This code has already expired.`);
      return message.channel.send({ embeds: [embed] });
    }

    if (existing) {
      await existing.deleteOne();
    }

    await Premium.create({
      Id: member.id,
      Type: "user",
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

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("premium")} Premium Activated`)
      .setDescription(`${ok} User premium activated successfully.`)
      .addFields(
        statField("User", `\`${member.user.tag}\``, "users"),
        statField("Plan", "`Standard`", "premium"),
        statField("Validity", `\`${validity}\``, "time")
      );

    return message.channel.send({ embeds: [embed] });
  }
};
