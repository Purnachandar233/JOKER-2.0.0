const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");

module.exports = {
  name: "vote",
  category: "general",
  description: "Gives the link to vote the bot.",
  owner: false,
  wl : true,

  execute: async (message, args, client, prefix) => {
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel("Top.gg")
          .setURL(`https://top.gg/bot/${client.user.id}/vote`)
          .setStyle(5),
        new ButtonBuilder()
          .setLabel("DBL")
          .setURL(`https://discordbotlist.com/bots/joker-music/upvote`) // Updated name
          .setStyle(5)
      );

    const mainPage = new EmbedBuilder()
      .setDescription(`Help me by voting! You'll get access to premium commands for 12 hours if you vote me on [Top.gg](https://top.gg/bot/${client.user.id}/vote)`)
      .setColor(message.client?.embedColor || '#ff0051');
      
    message.channel.send({ embeds: [mainPage], components: [row] });
  }
}
