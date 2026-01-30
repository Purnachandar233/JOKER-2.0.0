const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");


module.exports = {
  name: "premium",
  category: "general",
  description: "Gives the link to  vote the bot.",
  owner: false,
  wl : true,

  execute: async (message, args, client, prefix) => {

    let ok = client.emoji.ok;
    let no = client.emoji.no;
    const buttonbolte = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
  .setLabel("Premium")
  .setURL("https://discord.gg/DdTX6gPTWF")
  .setStyle(5)
    );

        const mainPage = new EmbedBuilder()
        .setDescription(`Help me by buying premium :)`) 
        .setColor(0xff0051)
message.channel.send({embeds : [mainPage], components : [buttonbolte]})
    }
}