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
      .setAuthor({ name: `Ping!`, iconURL: message.member.displayAvatarURL({ forceStatic: false, size: 256 }) })
      .setDescription(
        [
          `Api latency : \`${gatewayLatency}ms\``,
          `Message latency: \`${processingLatency}ms\``
        ].join("\n")
      );

    return message.channel.send({ embeds: [embed] }).catch(() => {});
  }
};
