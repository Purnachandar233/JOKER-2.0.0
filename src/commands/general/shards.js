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

    for (let i = 0; i < totalShards; i++) {
      const shardMemoryMb = (Number(memory[i] || 0) / 1024 / 1024).toFixed(2);
      fields.push({
        name: `${getEmoji("server")} Shard ${i === currentShardId ? `${i} (current)` : i}`,
        value: [
          `Servers: \`${servers[i] ?? 0}\``,
          `Users: \`${users[i] ?? 0}\``,
          `Ping: \`${Math.round(ping[i] ?? 0)}ms\``,
          `Uptime: \`${formatDuration(uptime[i] || 0)}\``,
          `Memory: \`${shardMemoryMb} MB\``
        ].join("\n"),
        inline: true
      });
    }

    const totalMembers = users.reduce((acc, value) => acc + (Number(value) || 0), 0);
    const totalServers = servers.reduce((acc, value) => acc + (Number(value) || 0), 0);
    const totalMemory = memory.reduce((acc, value) => acc + (Number(value) || 0), 0);
    const avgPing = ping.reduce((acc, value) => acc + (Number(value) || 0), 0) / totalShards;
    const playerCount = client.lavalink?.nodeManager?.nodes?.values()?.next()?.value?.stats?.players || 0;

    fields.push({
      name: `${getEmoji("info")} Global Totals`,
      value: [
        `Total Servers: \`${totalServers}\``,
        `Total Users: \`${totalMembers}\``,
        `Total Players: \`${playerCount}\``,
        `Total Memory: \`${bytes(totalMemory)}\``,
        `Average Ping: \`${Math.round(avgPing)}ms\``
      ].join("\n"),
      inline: false
    });

    const embed = createEmbed({
      title: `${getEmoji("server")} Shard Diagnostics`,
      description: "Cluster-wide shard health metrics.",
      fields,
      footer: `${getEmoji("music")} Joker Music | Shard Monitor`
    });

    return message.channel.send({ embeds: [embed] });
  }
};

