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
  .setURL("https://discord.gg/pCj2UBbwST").setStyle(5)
  .setURL(`https://discord.gg/pCj2UBbwST`),
    );

        const mainPage = new EmbedBuilder()
        .setDescription(`[Click here](https://discord.gg/pCj2UBbwST) to join our support server.`)
        .setColor(0xff0051)
message.channel.send({embeds : [mainPage], components : [row]})
    }
}