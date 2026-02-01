const { EmbedBuilder } = require("discord.js");
const os = require('os');

module.exports = {
  name: "server-stats",
  category: "owner",
  description: "Shows the VPS stats of the bot.",
  owneronly: true,
  execute: async (message, args, client, prefix) => {
    const totalSeconds = os.uptime();
    const realTotalSecs = Math.floor(totalSeconds % 60);
    const days = Math.floor((totalSeconds % (31536 * 100)) / 86400);
    const hours = Math.floor((totalSeconds / 3600) % 24);
    const mins = Math.floor((totalSeconds / 60) % 60);

    const vps = new EmbedBuilder()
      .setAuthor({ name: 'Virtual Private Server Stats' })
      .setColor(message.client?.embedColor || '#ff0051')
      .addFields(
        { name: 'Host', value: `${os.type()} ${os.arch()}`, inline: true },
        { name: 'CPU', value: `${os.cpus()[0].model}`, inline: true },
        { name: 'Uptime', value: `${days}d ${hours}h ${mins}m ${realTotalSecs}s`, inline: true },
        { name: 'RAM', value: `${Math.round(os.totalmem() / 1024 / 1024)}MB`, inline: true },
        { name: 'Memory Usage', value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true },
        { name: 'CPU Load', value: `${os.loadavg()[0].toFixed(2)}%`, inline: true },
        { name: 'CPU Cores', value: `${os.cpus().length}`, inline: true },
        { name: 'Speed', value: `${os.cpus()[0].speed}Mhz`, inline: true },
        { name: 'Heap Total', value: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`, inline: true },
        { name: 'Free Memory', value: `${Math.round(os.freemem() / 1024 / 1024)}MB`, inline: true },
        { name: 'Node Version', value: `${process.version}`, inline: true }
      )
      .setFooter({ text: 'Joker Music Bot' })
      .setTimestamp();

    message.channel.send({ embeds: [vps] });
  }
};
