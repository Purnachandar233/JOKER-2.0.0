const { EmbedBuilder } = require("discord.js");

const formatDuration = require("../../utils/formatDuration");

const EMOJIS = require("../../utils/emoji.json");
function formatNodeInfo(node) {
  const usedMb = Math.round((node?.stats?.memory?.used || 0) / 1024 / 1024);
  const load = Number(node?.stats?.cpu?.lavalinkLoad || 0) * 100;
  const uptime = formatDuration(node?.stats?.uptime || 0, { verbose: false, secondsDecimalDigits: 0 });
  const playing = node?.stats?.playingPlayers || 0;
  const players = node?.stats?.players || 0;
  const ping = node?.stats?.ping ?? "n/a";

  return [
    `Memory: ${usedMb}MB (${load.toFixed(2)}%)`,
    `Players: ${playing}/${players}`,
    `Ping: ${ping}ms`,
    `Uptime: ${uptime}`
  ].join("\n");
}

module.exports = {
  name: "node",
  category: "owner",
  description: "Shows Lavalink node information.",
  owneronly: true,
  execute: async (message, args, client) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";

    const nodes = Array.from(client?.lavalink?.nodeManager?.nodes?.values?.() || []);

    if (!nodes.length) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} No Nodes Available`)
        .setDescription("No Lavalink nodes are currently connected.");
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    const blocks = nodes.map((node, index) => {
      const id = node?.id || `Node ${index + 1}`;
      return `**${id}**\n${formatNodeInfo(node)}`;
    });

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("server")} Node Status`)
      .setDescription(blocks.join("\n\n"));

    return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  }
};
