const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");

module.exports = {
    name: "invite",
    description: "gives the links to invite the bots",
    wl : true,

    /**
     * 
     * @param {Client} client 
     * @param {CommandInteraction} interaction 
     */

    run: async (client, interaction) => {
        await interaction.deferReply({
          ephemeral: false
        });
          
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
        const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
      .setLabel("Joker Music")
      .setStyle(5)
      .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=37088600&redirect_uri=https%3A%2F%2Fdiscord.gg%2FpCj2UBbwST&response_type=code&scope=bot%20applications.commands%20identify`)
      .setLabel("Support Server")
      .setStyle(5)
      .setURL(`https://discord.gg/pCj2UBbwST`),
        );
       
                const embed = new EmbedBuilder()
                
               .setDescription(`Click on the buttons to invite the bots! [Click here](https://discord.gg/JQzBqgmwFm) to join the support server!
               
               `)
                    .setColor(interaction.client?.embedColor || '#ff0051')
        await interaction.followUp({embeds: [embed], components: [row]})
    }
}
