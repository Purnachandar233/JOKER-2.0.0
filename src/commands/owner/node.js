const { EmbedBuilder } = require("discord.js");

const formatDuration = require("../../utils/formatDuration");

const EMOJIS = require("../../utils/emoji.json");
function formatPercent(value, digits = 2) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw < 0) return "n/a";
  return `${raw.toFixed(digits)}%`;
}

function formatMemory(bytes) {
  const raw = Number(bytes);
  if (!Number.isFinite(raw) || raw < 0) return "n/a";
  return `${Math.round(raw / 1024 / 1024)}MB`;
}

function formatPing(node) {
  const candidates = [
    node?.stats?.ping,
    node?.heartBeatPing,
    node?.ping,
  ];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return `${Math.round(parsed)}ms`;
    }
  }

  return "n/a";
}

function formatNodeInfo(node, index) {
  const line = (label, value) => `${String(label).padEnd(10)} :: ${value}`;
  const id = node?.id || node?.options?.id || `Node ${index + 1}`;
  const host = node?.options?.host || "unknown";
  const port = node?.options?.port || "n/a";
  const connected = node?.connected ? "yes" : "no";
  const sessionId = node?.sessionId || "n/a";
  const usedMb = formatMemory(node?.stats?.memory?.used);
  const allocatedMb = formatMemory(node?.stats?.memory?.allocated);
  const lavalinkLoad = formatPercent(Number(node?.stats?.cpu?.lavalinkLoad || 0) * 100);
  const systemLoad = formatPercent(Number(node?.stats?.cpu?.systemLoad || 0) * 100);
  const uptime = formatDuration(node?.stats?.uptime || 0, { verbose: false, secondsDecimalDigits: 0 });
  const playing = Number(node?.stats?.playingPlayers || 0);
  const players = Number(node?.stats?.players || 0);
  const ping = formatPing(node);

  return [
    `[${id}]`,
    line("Status", connected),
    line("Host", `${host}:${port}`),
    line("Players", `${playing}/${players}`),
    line("Ping", ping),
    line("Uptime", uptime),
    line("Memory", `${usedMb} / ${allocatedMb}`),
    line("LL Load", lavalinkLoad),
    line("Sys Load", systemLoad),
    line("Session", sessionId),
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

    const blocks = nodes.map((node, index) => formatNodeInfo(node, index));

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("server")} Node Status`)
      .setDescription(`\`\`\`asciidoc\n${blocks.join("\n\n")}\n\`\`\``);

    return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  }
};
