const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");


module.exports = {
    name: "support",
    description: "Support Server link.",
    wl : true,
   
    run: async (client, interaction) => {
        let ok = client.emoji.ok;
        let no = client.emoji.no;

        const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
      .setLabel("Support Server")
      .setStyle(5)
      .setURL(`https://discord.gg/pCj2UBbwST`),
        );

            const mainPage = new EmbedBuilder()
            .setDescription(`[Click here](https://discord.gg/pCj2UBbwST) to join our support server.`)
            .setColor(interaction.client?.embedColor || '#ff0051')
        return interaction.editReply({embeds: [mainPage], components: [row]})

},
};
