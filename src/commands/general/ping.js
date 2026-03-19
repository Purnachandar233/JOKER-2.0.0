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
    const now = Date.now();
    const baseTimestamp = message.editedTimestamp || message.createdTimestamp;
    const processingLatency = Math.max(0, Math.floor(now - baseTimestamp));
    const gatewayLatency = Math.max(0, Math.floor(client.ws.ping || 0));

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setDescription(
        [
          `api: \`${gatewayLatency}ms\``,
          `message: \`${processingLatency}ms\``
        ].join("\n")
      );

    return message.channel.send({ embeds: [embed] }).catch(() => {});
  }
};
