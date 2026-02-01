const { EmbedBuilder } = require("discord.js");
const { mem } = require('node-os-utils');
const moment = require('moment');

module.exports = {
  name: "stats",
  category: "general",
  description: "Shows the stats of the bot.",
  execute: async (message, args, client, prefix) => {
    const servers = client.guilds.cache.size;
    const users = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    const { usedMemMb } = await mem.info().catch(() => ({ usedMemMb: 0 }));
    const d = moment.duration(client.uptime);
    const up = `${d.days()}d ${d.hours()}h ${d.minutes()}m`;

    const embed = new EmbedBuilder()
      .setColor(message.client?.embedColor || '#ff0051')
      .setAuthor({ name: `System Diagnostics`, iconURL: client.user.displayAvatarURL() })
      .setTitle(`Joker Music Stats`)
      .addFields(
        { name: '✧ Guilds', value: `\`${servers}\``, inline: true },
        { name: '✧ Users', value: `\`${users}\``, inline: true },
        { name: '✧ Uptime', value: `\`${up}\``, inline: true },
        { name: '✧ Memory', value: `\`${usedMemMb} MB\``, inline: true },
        { name: '✧ Ping', value: `\`${client.ws.ping}ms\``, inline: true }
      )
      .setFooter({ text: "Joker Music" });

    message.channel.send({ embeds: [embed] });
  }
};
