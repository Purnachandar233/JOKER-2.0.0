const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");


module.exports = {
  name: "support",
  category: "general",
  description: "Gives the support server link.",
  owner: false,
  wl : true,
  execute: async (message, args, client, prefix) => {

    let ok = client.emoji.ok;
    let no = client.emoji.no;
   
    const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
  .setLabel("Support Server")
  .setURL("https://discord.gg/JQzBqgmwFmT").setStyle(5)
  .setURL(`https://discord.gg/JQzBqgmwFm`),
    );

        const mainPage = new EmbedBuilder()
        .setDescription(`[Click here](https://discord.gg/JQzBqgmwFm) to join our support server.`)
        .setColor(message.client?.embedColor || '#ff0051')
message.channel.send({embeds : [mainPage], components : [row]})
    }
}