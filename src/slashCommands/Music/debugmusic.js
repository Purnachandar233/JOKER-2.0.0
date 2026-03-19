const { EmbedBuilder } = require("discord.js");
const safeReply = require("../../utils/interactionResponder");
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
  name: "debugmusic",
  description: "Debug music subsystem (lavalink, player, queue).",
  owneronly: true,
  player: false,
  wl: true,
  run: async (client, interaction) => {
    return await client.errorHandler.executeWithErrorHandling(interaction, async (safeInteraction) => {
      await safeReply.safeDeferReply(safeInteraction);

      try {
        const embed = new EmbedBuilder()
          .setTitle("Lavalink Health")
          .setColor(safeInteraction.client?.embedColor || "#ff0051");

        if (!client.lavalink) {
          embed.setDescription("Lavalink manager is not initialized.");
          return await safeReply.safeReply(safeInteraction, { embeds: [embed] });
        }

        const manager = buildManagerSummary(client);
        const nodeList = Array.from(client.lavalink?.nodeManager?.nodes?.values?.() || []);
        const playerSummary = buildGuildPlayerSummary(client, safeInteraction.guildId);

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

        await safeReply.safeReply(safeInteraction, { embeds: [embed] });
        client.logger.logCommand("debugmusic", safeInteraction.user.id, safeInteraction.guildId, Date.now() - safeInteraction.createdTimestamp, true);
      } catch (err) {
        const embed = new EmbedBuilder()
          .setColor(safeInteraction.client?.embedColor || "#ff0051")
          .setDescription(`Failed to debug: ${err && (err.message || err)}`);
        return await safeReply.safeReply(safeInteraction, { embeds: [embed] });
      }
    });
  }
};
