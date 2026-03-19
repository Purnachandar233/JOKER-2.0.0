const { EmbedBuilder } = require("discord.js");

const { safeReply } = require("../../utils/interactionResponder");

module.exports = {
  name: "ping",
  description: "Show websocket and API latency",
  wl: true,
  run: async (client, interaction) => {
    const embedColor = client?.embedColor || "#ff0051";
    const now = Date.now();
    const interactionLatency = Math.max(0, Math.floor(now - interaction.createdTimestamp));
    const gatewayLatency = Math.max(0, Math.floor(client.ws.ping || 0));

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle("Ping")
      .setDescription(
        [
          `Gateway Latency: \`${gatewayLatency}ms\``,
          `Interaction Processing: \`${interactionLatency}ms\``
        ].join("\n")
      );

    return safeReply(interaction, { embeds: [embed] });
  }
};
