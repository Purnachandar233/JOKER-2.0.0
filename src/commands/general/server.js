const { EmbedBuilder } = require("discord.js");

const Premium = require("../../schema/Premium.js");
const formatDuration = require("../../utils/formatDuration");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "server",
  category: "general",
  description: "Shows information about the current server.",
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
    const statField = (label, value, emojiKey, inline = true) => ({
      name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
      value: String(value),
      inline
    });

    const guild = message.guild;
    const id = args[0] || guild.id;
    const premium = await Premium.findOne({ Id: id, Type: "guild" });

    let premiumLabel = "No Premium";
    if (premium) {
      if (!premium.Permanent && premium.Expire < Date.now()) {
        await premium.deleteOne();
        premiumLabel = "Expired";
      } else if (premium.Permanent) {
        premiumLabel = "Permanent";
      } else {
        const remaining = formatDuration(premium.Expire - Date.now(), { verbose: false }).replace(/\s\d+s$/, "");
        premiumLabel = `Expires in ${remaining}`;
      }
    }

    const createdAt = Math.floor(guild.createdTimestamp / 1000);
    const embed = createEmbed({
      title: `${getEmoji("server")} ${guild.name}`,
      description: "Professional server overview and health indicators.",
      thumbnail: guild.iconURL({ forceStatic: false, size: 256 }) || null,
      fields: [
        statField("Owner", `<@${guild.ownerId}>`, "users", true),
        statField("Members", `\`${guild.memberCount}\``, "users", true),
        statField("Roles", `\`${guild.roles.cache.size}\``, "info", true),
        statField("Channels", `\`${guild.channels.cache.size}\``, "queue", true),
        statField("Boosts", `\`${guild.premiumSubscriptionCount || 0}\``, "star", true),
        statField("Created", `<t:${createdAt}:R>`, "time", true),
        statField("Premium", `\`${premiumLabel}\``, "premium", false)
      ],
      footer: `Server ID: ${guild.id}`
    });

    return message.channel.send({ embeds: [embed] });
  }
};

