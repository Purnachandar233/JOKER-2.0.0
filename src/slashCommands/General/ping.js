const { EmbedBuilder } = require("discord.js");

const { safeReply, safeDeferReply } = require("../../utils/safeReply");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "ping",
  description: "Show websocket and API latency",
  wl: true,
  run: async (client, interaction) => {
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

    const deferred = await safeDeferReply(interaction, { ephemeral: false });
    if (!deferred) return safeReply(interaction, { content: "Failed to defer reply." });

    const probe = await safeReply(interaction, { content: "Measuring latency..." });
    const messageLatency = probe?.createdTimestamp
      ? Math.max(0, Math.floor(probe.createdTimestamp - interaction.createdTimestamp))
      : 0;
    const apiLatency = Math.max(0, Math.floor(client.ws.ping || 0));

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`ping`)  
      .setDescription(`Message Latency: \`${messageLatency}ms\`\nAPI Latency: \`${apiLatency}ms\``);

    return safeReply(interaction, { embeds: [embed], content: "" });
  }
};

