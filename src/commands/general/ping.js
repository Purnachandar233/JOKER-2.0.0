const { EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "ping",
  category: "general",
  description: "Check bot latency.",
  args: false,
  wl: true,
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

    const pending = createEmbed({
      title: `${getEmoji("time")} Measuring Latency`,
      description: "Collecting gateway and message latency...",
      timestamp: false
    });

    const probe = await message.channel.send({ embeds: [pending] }).catch(() => null);
    if (!probe) return;

    const baseTimestamp = message.editedTimestamp || message.createdTimestamp;
    const messageLatency = Math.max(0, Math.floor(probe.createdTimestamp - baseTimestamp));
    const apiLatency = Math.max(0, Math.floor(client.ws.ping || 0));

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`ping`)  
      .setDescription(`Message Latency: \`${messageLatency}ms\`\nAPI Latency: \`${apiLatency}ms\``);

    return probe.edit({ embeds: [embed] }).catch(() => {});
  }
};

