const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");

module.exports = {
  name: "about",
  category: "general",
  description: "Shows information about the bot.",
  execute: async (message, args, client, prefix) => {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Invite").setStyle(5).setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`),
      new ButtonBuilder().setLabel("Support").setStyle(5).setURL(`https://discord.gg/JQzBqgmwFm`),
      new ButtonBuilder().setLabel("Vote").setStyle(5).setURL(`https://top.gg/bot/${client.user.id}/vote`)
    );

    const embed = new EmbedBuilder()
      .setColor(message.client?.embedColor || '#ff0051')
      .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
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
     
      .setFooter({ text: "Developed with ❤️ by Joker Team", iconURL: client.user.displayAvatarURL() });

    message.channel.send({ embeds: [embed], components: [row] });
  }
};
