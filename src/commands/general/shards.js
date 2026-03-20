const { EmbedBuilder } = require("discord.js");

const bytes = require("bytes");
const formatDuration = require("../../utils/formatDuration");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "shards",
  category: "general",
  description: "Shows shard diagnostics.",
  owner: false,
  votelock: true,
  wl: true,
  execute: async (message, args, client) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const line = (label, value) => `${String(label).padEnd(10)} :: ${value}`;

    const users = client.cluster
      ? await client.cluster.broadcastEval(c => c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0))
      : [message.guild.memberCount];
    const servers = client.cluster
      ? await client.cluster.fetchClientValues("guilds.cache.size")
      : [client.guilds.cache.size];
    const ping = client.cluster
      ? await client.cluster.fetchClientValues("ws.ping")
      : [client.ws.ping];
    const uptime = client.cluster
      ? await client.cluster.fetchClientValues("uptime")
      : [client.uptime];
    const memory = client.cluster
      ? await client.cluster.broadcastEval(() => process.memoryUsage().rss)
      : [process.memoryUsage().rss];

    const totalShards = client.cluster?.info?.TOTAL_SHARDS || 1;
    const currentShardId = message.guild.shardId || 0;
    const fields = [];
    const playerCount = Array.from(client?.lavalink?.nodeManager?.nodes?.values?.() || [])
      .reduce((acc, node) => acc + (Number(node?.stats?.players) || 0), 0);

    for (let i = 0; i < totalShards; i++) {
      const shardMemoryMb = (Number(memory[i] || 0) / 1024 / 1024).toFixed(2);

      const shardLines = [
        `shard id: ${i === currentShardId ? `${i} (current)` : i}`,
        line("servers", servers[i] ?? 0),
        line("users", users[i] ?? 0),
        line("ping", `${Math.round(ping[i] ?? 0)}ms`),
        line("uptime", formatDuration(uptime[i] || 0)),
        line("memory", `${shardMemoryMb} MB`)
      ].join("\n");

      fields.push({
        name: ` Shard ${i === currentShardId ? `${i} (current)` : i}`,
        value: `\`\`\`asciidoc\n${shardLines}\n\`\`\``,
        inline: true
      });
    }

    const totalMembers = users.reduce((acc, value) => acc + (Number(value) || 0), 0);
    const totalServers = servers.reduce((acc, value) => acc + (Number(value) || 0), 0);
    const totalMemory = memory.reduce((acc, value) => acc + (Number(value) || 0), 0);
    const avgPing = ping.reduce((acc, value) => acc + (Number(value) || 0), 0) / totalShards;

    const summary = [
      line("Total Servers", totalServers),
      line("Total Users", totalMembers),
      line("Total Players", playerCount),
      line("Total Memory", bytes(totalMemory)),
      line("Average Ping", `${Math.round(avgPing)}ms`)
    ].join("\n");

    fields.push({
      name: ` Global Totals`,
      value: `\`\`\`asciidoc\n${summary}\n\`\`\``,
      inline: false
    });

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({ name: "Shards" , iconURL: client.user.displayAvatarURL({ forceStatic: false, size: 256 }) })
      .addFields(fields)
     

    return message.channel.send({ embeds: [embed] });
  }
};
