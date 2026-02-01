const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");

module.exports = {
  name: "about",
  category: "general",
  description: "Shows information about the bot.",
  execute: async (message, args, client, prefix) => {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Invite").setStyle(5).setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`),
      new ButtonBuilder().setLabel("Support").setStyle(5).setURL(`https://discord.gg/pCj2UBbwST`)
    );

    const embed = new EmbedBuilder()
      .setColor(message.client?.embedColor || '#ff0051')
      .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
      .setDescription(`Joker Music is a high-quality Discord music bot.`)
      .setFooter({ text: "Developed with ❤️ by Joker Team", iconURL: client.user.displayAvatarURL() });

    message.channel.send({ embeds: [embed], components: [row] });
  }
};
