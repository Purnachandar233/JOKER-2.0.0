const { EmbedBuilder } = require("discord.js");
const {
  buildGuildPlayerSummary,
  buildManagerSummary,
  formatGuildPlayerSummary,
  formatNodeSummary,
  formatRestoreSummary,
  summarizeNode,
} = require("../../utils/lavalinkHealth");

function truncateField(value, maxLength = 1024) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

module.exports = {
  name: "lavalink",
  category: "owner",
  description: "Show Lavalink node and guild player diagnostics (owner only).",
  owneronly: true,
  execute: async (message, args, client) => {
    const embed = new EmbedBuilder()
      .setTitle("Lavalink Diagnostics")
      .setColor(message.client?.embedColor || "#ff0051");

    if (!client.lavalink) {
      embed.setDescription("Lavalink manager is not initialized.");
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    const manager = buildManagerSummary(client);
    const nodeList = Array.from(client.lavalink?.nodeManager?.nodes?.values?.() || []);
    const playerSummary = buildGuildPlayerSummary(client, message.guild.id);

    embed.setDescription(
      [
        `Usable: ${manager.usable ? "yes" : "no"}`,
        `Nodes: ${manager.connectedNodes}/${manager.totalNodes} connected`,
        `Players: ${manager.totalPlayers}`,
        `24/7 Restore:\n${formatRestoreSummary(manager.restore)}`,
      ].join("\n")
    );

    for (const node of nodeList.slice(0, 4)) {
      const summary = summarizeNode(client, node);
      embed.addFields({
        name: `Node ${summary.label}`,
        value: truncateField(formatNodeSummary(summary)),
        inline: false,
      });
    }

    if (nodeList.length > 4) {
      embed.addFields({
        name: "More Nodes",
        value: `${nodeList.length - 4} additional nodes not shown.`,
        inline: false,
      });
    }

    embed.addFields({
      name: "Guild Player",
      value: truncateField(formatGuildPlayerSummary(playerSummary)),
      inline: false,
    });

    return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  }
};
