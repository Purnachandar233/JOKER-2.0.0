const { EmbedBuilder } = require("discord.js");
const { mem } = require('node-os-utils');
const moment = require('moment');
const bytes = require("bytes");

module.exports = {
  name: "shards",
  category: "general",
  description: "Shows the shards information.",
  owner: false,
  votelock: true,
  wl: true,
  execute: async (message, args, client, prefix) => {
    let ok = client.emoji.ok;
    let no = client.emoji.no;

    const emee = new EmbedBuilder();
    const { totalMemMb, usedMemMb } = await mem.info();
    
    let users = client.cluster ? await client.cluster.broadcastEval(c => c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)) : [message.guild.memberCount];
    let servers = client.cluster ? await client.cluster.fetchClientValues('guilds.cache.size') : [client.guilds.cache.size];
    let ping = client.cluster ? await client.cluster.fetchClientValues('ws.ping') : [client.ws.ping];
    let memory = client.cluster ? await client.cluster.broadcastEval(async () => process.memoryUsage().rss) : [process.memoryUsage().rss];
    
    const d = moment.duration(client.uptime);
    const days = `${d.days()}d`;
    const hours = `${d.hours()}h`;
    const minutes = `${d.minutes()}m`;
    const seconds = `${d.seconds()}s`;
    const fktime = require("pretty-ms")(client.uptime);

    const fields = [];
    
    const totalShards = client.cluster ? client.cluster.info.TOTAL_SHARDS : 1;
    for (let i = 0; i < totalShards; i++) {
      const status = (client.cluster && client.cluster.mode === 'process') ? '<a:online:915956426696966164>' : '<:offline:1466305315921334304>';
      fields.push({
        name: `${status} Shard ${i === (message.guild.shardId || 0) ? i + ' 📍' : i}`,
        value: `\`\`\`ml\nServers: ${servers[i] || 'null'}\nUsers  : ${users[i] || 'null'}\nPing   : ${ping[i] || 'null'}\`\`\``,
        inline: true
      });
    }
    
    let totalMembers = users.reduce((acc, memberCount) => acc + memberCount, 0);
    let totalServers = servers.reduce((prev, val) => prev + val, 0);
    let pingMedia = ping.reduce((prev, val) => prev + (val || 0), 0);
    let media = pingMedia / totalShards;

    const playerCount = client.lavalink.nodeManager.nodes.values().next().value?.stats?.players || 0;
    
    fields.push({
      name: '📊 Total',
      value: `\`\`\`ml\nTotalServers: ${totalServers}\nTotalMembers: ${totalMembers}\nTotalPlayers: ${playerCount}\nUptime : ${fktime}\nTotalMemory : ${bytes(bytes(`${usedMemMb}MB`))}\nPing        : ${Math.round(media)}\`\`\``
    });

    emee.addFields(fields);
    emee.setColor(message.client?.embedColor || '#ff0051');
    
    message.channel.send({ embeds: [emee] });
  }
};
