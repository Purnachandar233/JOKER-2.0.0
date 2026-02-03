const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js')

module.exports = {
  name: 'invite',
  category: 'general',
  description: 'Gives the invite links of the bots.',
  owner: false,
  wl: true,
  execute: async (message, args, client, prefix) => {
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Joker Music')
          .setStyle(5)
          .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=70510540062032&integration_type=0&scope=bot+applications.commands`),
         new ButtonBuilder()
          .setLabel('Support Server')
          .setStyle(5)
          .setURL('https://discord.gg/JQzBqgmwFm')
      )

    const embed = new EmbedBuilder()
      .setDescription(`[Click here](https://discord.gg/JQzBqgmwFm) to join the support server!`)
      .setColor(message.client?.embedColor || '#ff0051')
    message.channel.send({ embeds: [embed], components: [row] })
  }
}
