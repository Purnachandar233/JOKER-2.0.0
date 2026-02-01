const { EmbedBuilder } = require("discord.js");
const { mem } = require('node-os-utils');
const moment = require('moment');

module.exports = {
  name: "cluster",
  category: "general",
  description: "Shows the current cluster details!.",
  owner: false,
  wl: true,
  execute: async (message, args, client, prefix) => {
    const memusage = process.memoryUsage();
    
    const d = moment.duration(client.uptime);
    const days = d.days() + "d";
    const hours = d.hours() + "h";
    const minutes = d.minutes() + "m";
    const seconds = d.seconds() + "s";
    const up = `${days}, ${hours}, ${minutes}, and ${seconds}`;

    const statsEmbed = new EmbedBuilder()
      .setColor(message.client?.embedColor || '#ff0051')
      .setAuthor({ name: `This Cluster Details`, iconURL: message.member.user.displayAvatarURL({ dynamic: true }) })
      .addFields(
        { name: 'Servers', value: `\`\`\`Total: ${client.guilds.cache.size} servers\`\`\``, inline: true },
        { name: 'Users', value: `\`\`\`Total: ${client.users.cache.size} users\`\`\``, inline: true },
        { name: 'Memory', value: `\`\`\`${Math.round(memusage.heapUsed / 1024 / 1024)}/${Math.round(memusage.heapTotal / 1024 / 1024)}mb\`\`\``, inline: true },
        { name: 'Uptime', value: `\`\`\`${up}\`\`\``, inline: true },
        { name: 'Cluster Ping', value: `\`\`\`${client.ws.ping}ms\`\`\``, inline: true },
        { name: 'Shard Id', value: `\`\`\`\n${message.guild.shardId}\n\`\`\``, inline: true }
      )
      .setFooter({ text: 'Developed with ❤️ by Joker Team', iconURL: client.user.displayAvatarURL() });

    message.channel.send({ embeds: [statsEmbed] });
  }
}
