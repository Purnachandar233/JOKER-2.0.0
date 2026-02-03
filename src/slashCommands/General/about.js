const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");

module.exports = {
    name: "about",
    description: "shows about joker music",
    wl : true,

    /**
     * 
     * @param {Client} client 
     * @param {CommandInteraction} interaction 
     */

    run: async (client, interaction) => {
        let ok = client.emoji.ok;
        let no = client.emoji.no;
    
        const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
      .setLabel("Support Server")
      .setStyle(5)
      .setURL(`https://discord.gg/JQzBqgmwFm`),
      new ButtonBuilder()
      .setLabel("Invite Me")
      .setStyle(5)
      .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=70510540062032&integration_type=0&scope=bot+applications.commands`),
      new ButtonBuilder()
      .setLabel("Vote")
      .setStyle(5)
      .setURL(`https://top.gg/bot/${client.user.id}/vote`),
        );
               
        const embed = new EmbedBuilder()
        .setAuthor({ name: "Joker Music" })
        .setThumbnail(client.user.displayAvatarURL())
          .setDescription(`Joker is the easiest way to play music in your Discord server. It supports Spotify, Soundcloud [and more!](https://top.gg/bot/${client.user.id}/vote)

To get started, join a voice channel and  \`/play\` a song. You can use song names, video links, and playlist links.
          
**Why Joker?**
We provide you the best and updated features without any charges. We provide you 24/7 Mode, Volume control, audio effects and much more for [free](https://top.gg/bot/${client.user.id}/vote).

**Commands**
For full list of commands Type /help\`

**Invite**
Joker Music can be added to as many server as you want! [Click here to add it to yours](https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=37088600&redirect_uri=https%3A%2F%2Fdiscord.gg%2FpCj2UBbwST&response_type=code&scope=bot%20applications.commands%20identify)

**Support**
[Click here](https://discord.gg/JQzBqgmwFm) to talk to our support team if you're having any trouble or have any questions.`)
          
        
 
.setColor(interaction.client?.embedColor || '#ff0051')
        await interaction.reply({embeds: [embed], components: [row]})
    }
}
