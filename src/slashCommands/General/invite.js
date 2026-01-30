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
      .setURL(`https://discord.com/api/oauth2/authorize?client_id=898941398538158080&permissions=37088600&redirect_uri=https%3A%2F%2Fdiscord.gg%2FpCj2UBbwST&response_type=code&scope=bot%20applications.commands%20identify`),
      new ButtonBuilder()
      .setLabel("Joker Music 2")
      .setStyle(5)
      .setURL(`https://discord.com/api/oauth2/authorize?client_id=955499830732546128&permissions=37088600&redirect_uri=https%3A%2F%2Fdiscord.gg%2FpCj2UBbwST&response_type=code&scope=bot%20applications.commands%20identify`),
      new ButtonBuilder()
      .setLabel("Joker Music 3")
      .setStyle(5)
      .setURL(`https://discord.com/api/oauth2/authorize?client_id=955505051340775455&permissions=37088600&redirect_uri=https%3A%2F%2Fdiscord.gg%2FpCj2UBbwST&response_type=code&scope=bot%20applications.commands%20identify`),
      new ButtonBuilder()
      .setLabel("Alex Staging")
      .setStyle(5)
      .setURL(`https://discord.com/api/oauth2/authorize?client_id=955509682972270602&permissions=37088600&redirect_uri=https%3A%2F%2Fdiscord.gg%2FpCj2UBbwST&response_type=code&scope=bot%20applications.commands%20identify`),
      new ButtonBuilder()
      .setLabel("Support Server")
      .setStyle(5)
      .setURL(`https://discord.gg/pCj2UBbwST`),
        );
       
                const embed = new EmbedBuilder()
                
               .setDescription(`Click on the buttons to invite the bots! [Click here](https://discord.gg/pCj2UBbwST) to join the support server!
               
               `)
                    .setColor(0xff0051)
        await interaction.followUp({embeds: [embed], components: [row]})
    }
}
