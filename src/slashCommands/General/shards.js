const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const { mem, cpu, os } = require('node-os-utils');
const { stripIndent } = require('common-tags');
const moment = require('moment');
const Discord = require("discord.js");
const bytes = require("bytes");

module.exports = {
    name: "shards",
    description: "shows the Alexmusics shards",
    wl: true,
   
    run: async (client, interaction) => {
        await interaction.deferReply({ ephemeral: false }).catch(() => {});
        
        let ok = client.emoji.ok;
        let no = client.emoji.no;
          
          const emee = new EmbedBuilder();
          emee.setColor(interaction.client?.embedColor || '#ff0051');
          const { totalMemMb, usedMemMb } = await mem.info();
          let users = client.cluster ? await client.cluster.broadcastEval(c => c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)) : [interaction.guild.memberCount];
          let servers = client.cluster ? await client.cluster.fetchClientValues('guilds.cache.size') : [client.guilds.cache.size];
          let ping = client.cluster ? await client.cluster.fetchClientValues('ws.ping') : [client.ws.ping];
          let uptime = client.cluster ? await client.cluster.fetchClientValues('uptime') : [client.uptime];
          let memoryUsage = await (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
          let memory = await client.cluster.broadcastEval(async () => process.memoryUsage().rss);
          const d = moment.duration(client.uptime);
          const days = (d.days() == 1) ? `${d.days()}d` : `${d.days()}d`;
          const hours = (d.hours() == 1) ? `${d.hours()}h` : `${d.hours()}h`;
          const minutes = (d.minutes() == 1) ? `${d.minutes()}m` : `${d.minutes()}m`;
          const seconds = (d.seconds() == 1) ? `${d.seconds()}s` : `${d.seconds()}s`;
          const up = `${days}${hours}${minutes}${seconds}`;

          const totalShards = client.cluster ? client.cluster.info.TOTAL_SHARDS : 1;
          for (let i = 0; i < totalShards; i++) {
              const status = client.cluster ? (client.cluster.mode === 'process' ? '<:online:968819259683770389>' : '<:dnd:968819300611817532>') : '<:online:968819259683770389>';
              emee.addFields({
                  name: `${status} Shard ${i === (interaction.guild.shardId || 0) ? i + '   <:location_alex:997428426380161024>' : i}`,
                  value: `\`\`\`ml\nServers: ${servers[i] || 'null'}\nUsers  : ${users[i] || 'null'}\nPing   : ${ping[i]}\nUptime : ${require('pretty-ms')(uptime[i]) || 'null'}\nMemory : ${Number(memoryUsage).toLocaleString()}mb\`\`\``,
                  inline: true
              });
          }

          let totalMembers = users.reduce((acc, memberCount) => acc + memberCount, 0);
          let totalServers = servers.reduce((prev, val) => prev + val);
          let totalMemory = memory.reduce((prev, val) => prev + val);
          let pingMedia = ping.reduce((prev, val) => prev + val);
          let media = pingMedia / totalShards;
          const playerCount = client.lavalink?.nodeManager?.nodes?.values()?.next()?.value?.stats?.players || 0;
          const totalMemoryStr = bytes(bytes(usedMemMb + "MB"));
          emee.addFields({ name: '<:idle:968819647170347048> Total', value: `\`\`\`ml\nTotalServers: ${totalServers}\nTotalMembers: ${totalMembers}\nTotalPlayers: ${playerCount}\nTotalMemory : ${totalMemoryStr}\nPing        : ${Math.round(media)}\`\`\`` });

          return interaction.editReply({ embeds: [emee] });
    }
};
