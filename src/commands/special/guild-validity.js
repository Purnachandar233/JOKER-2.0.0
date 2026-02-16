const { EmbedBuilder } = require("discord.js");

const Premium = require("../../schema/Premium.js");
const formatDuration = require("../../utils/formatDuration");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "guild-validity",
  category: "special",
  aliases: ["server-validity","gv"],
  wl: true,
  description: "Shows server premium validity",
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

    const id = args[0] || message.guild.id;
    const premium = await Premium.findOne({ Id: id, Type: "guild" });

    if (!premium) {
      const embed = createEmbed({
        title: `${getEmoji("premium")} Premium Status`,
        description: "This server has no premium subscription."
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

    const validity = premium.Permanent
      ? "Permanent"
      : formatDuration(premium.Expire - Date.now(), { verbose: false }).replace(/\s\d+s$/, "");

    const embed = createEmbed({
      title: `${getEmoji("premium")} Server Premium Validity`,
      description: `Server: \`${id}\`\nValidity: \`${validity}\``
    });

    return message.channel.send({ embeds: [embed] });
  }
};

