const { EmbedBuilder } = require("discord.js");

const formatDuration = require("../../utils/formatDuration");
const Premium = require("../../schema/Premium.js");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "user-validity",
  category: "special",
  wl: true,
  description: "Shows user premium validity",
  execute: async (message, args, client) => {
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

    const mentionId = message?.mentions?.users?.first?.()?.id || null;
    const argId = args?.[0] ? String(args[0]).replace(/[<@!>]/g, "") : null;
    const id = mentionId || (argId && /^\d{16,20}$/.test(argId) ? argId : null) || message.author.id;
    const premium = await Premium.findOne({ Id: id, Type: "user" });

    if (!premium) {
      const embed = createEmbed({
        title: `${getEmoji("premium")} Premium Status`,
        description: "This user has no premium subscription."
      });
      return message.channel.send({ embeds: [embed] });
    }

    if (!premium.Permanent && premium.Expire < Date.now()) {
      await premium.deleteOne();
      const embed = createEmbed({
        title: `${getEmoji("error")} Premium Expired`,
        description: "The premium subscription has expired."
      });
      return message.channel.send({ embeds: [embed] });
    }

    const validity = premium.Permanent ? "Permanent" : formatDuration(premium.Expire - Date.now());
    const embed = createEmbed({
      title: `${getEmoji("premium")} User Premium Validity`,
      description: `User: \`${id}\`\nValidity: \`${validity}\``
    });

    return message.channel.send({ embeds: [embed] });
  }
};

