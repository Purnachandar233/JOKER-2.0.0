const { EmbedBuilder } = require("discord.js");

const Blacklist = require("../../schema/blacklistSchema.js");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "whitelist",
  category: "owner",
  aliases: ["allow"],
  description: "Remove a user from blacklist.",
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
    const inputId = args[0];

    if (!inputId) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Missing User ID`)
        .setDescription(`${no} Usage: \`${prefix}whitelist <user_id>\``);
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    const targetUser = await client.users.fetch(inputId).catch(() => null);
    if (!targetUser) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Invalid User ID`)
        .setDescription(`${no} I could not resolve that user ID.`);
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    const existing = await Blacklist.findOne({ UserID: targetUser.id });
    if (!existing) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("info")} Not Blacklisted`)
        .setDescription(`${no} **${targetUser.tag}** is not in the blacklist.`);
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    await existing.deleteOne();

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("success")} User Whitelisted`)
      .setDescription(`${ok} Successfully removed **${targetUser.tag}** from blacklist.`)
      .addFields(statField("User ID", `\`${targetUser.id}\``, "users"));

    return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  }
};
