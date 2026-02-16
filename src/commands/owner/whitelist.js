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
    const inputId = args[0];

    if (!inputId) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Missing User ID`,
        description: `${no} Usage: \`${prefix}whitelist <user_id>\``
      });
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    const targetUser = await client.users.fetch(inputId).catch(() => null);
    if (!targetUser) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Invalid User ID`,
        description: `${no} I could not resolve that user ID.`
      });
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    const existing = await Blacklist.findOne({ UserID: targetUser.id });
    if (!existing) {
      const embed = createEmbed({
        title: `${getEmoji("info")} Not Blacklisted`,
        description: `${no} **${targetUser.tag}** is not in the blacklist.`
      });
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    await existing.deleteOne();

    const embed = createEmbed({
      title: `${getEmoji("success")} User Whitelisted`,
      description: `${ok} Successfully removed **${targetUser.tag}** from blacklist.`,
      fields: [statField("User ID", `\`${targetUser.id}\``, "users")]
    });

    return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  }
};

