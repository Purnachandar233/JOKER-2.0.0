const { EmbedBuilder } = require("discord.js");
const { mem } = require('node-os-utils');
const moment = require('moment');

module.exports = {
  name: "info",
  category: "general",
  description: "Shows information about the bot.",
  execute: async (message, args, client, prefix) => {
    const { usedMemMb } = await mem.info();
    const d = moment.duration(client.uptime);
    const up = `${d.days()}d, ${d.hours()}h, ${d.minutes()}m, ${d.seconds()}s`;

    const embed = new EmbedBuilder()
      .setColor(message.client?.embedColor || '#ff0051')
      .setAuthor({ name: `Bot Information`, iconURL: message.author.displayAvatarURL() })
      .addFields(
        { name: 'Node Version', value: `\`${process.version}\``, inline: true },
        { name: 'Discord.js', value: `\`v14.x\``, inline: true },
        { name: 'Uptime', value: `\`${up}\``, inline: true },
        { name: 'Memory', value: `\`${usedMemMb}MB\``, inline: true }
      )
      .setFooter({ text: "Developed with ❤️ by Joker Team" });

    message.channel.send({ embeds: [embed] });
  }
};
