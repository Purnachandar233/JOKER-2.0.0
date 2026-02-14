const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
  name: "truthordare",
  category: "fun",
  aliases: ["tod"],
  description: "Play a game of Truth or Dare!",
  execute: async (message, args, client, prefix) => {
    const truths = [
      "What is your biggest fear?",
      "What is the most embarrassing thing you've ever done?",
      "What is a secret you've never told anyone?",
      "Who is your secret crush?",
      "What is the biggest lie you've ever told?",
      "What is your most annoying habit?",
      "Have you ever cheated on a test?",
      "What is the meanest thing you've ever said to someone?",
      "What is your biggest regret?",
      "If you could be anyone else for a day, who would it be?",
      "What's the worst mistake you've made?",
      "What is the worst date you've ever been on?"
    ];

    const dares = [
      "Do 20 pushups.",
      "Sing a song loudly in the voice channel.",
      "Send a random meme in the chat.",
      "Tell a joke that makes everyone laugh.",
      "Bark like a dog for 30 seconds.",
      "Type a sentence using only your nose.",
      "Post an embarrassing photo of yourself (if you're comfortable).",
      "Do your best impression of someone in the chat.",
      "Dance for 1 minute without music.",
      "Send a message to your crush (if you dare!).",
      "Write a love poem about Discord.",
      "Speak in an accent for the next 5 messages."
    ];

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('tod_truth')
        .setLabel('Truth')
        .setEmoji('🎤')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('tod_dare')
        .setLabel('Dare')
        .setEmoji('🎯')
        .setStyle(ButtonStyle.Danger)
    );

    const startEmbed = new EmbedBuilder()
      .setTitle("🎭 Truth or Dare")
      .setDescription("Choose your challenge!")
      .setColor(client.embedColor || '#e74c3c')
      .setFooter({ text: `Game by ${message.author.username}` });
    
    const msg = await message.channel.send({ embeds: [startEmbed], components: [row] });

    const filter = (i) => i.customId.startsWith('tod_') && i.user.id === message.author.id;
    const collector = msg.createMessageComponentCollector({ filter, time: 20000, max: 1 });

    collector.on('collect', async (interaction) => {
      const choice = interaction.customId.split('_')[1];
      let content = '';
      let emoji = '';

      if (choice === 'truth') {
        content = truths[Math.floor(Math.random() * truths.length)];
        emoji = '🎤';
      } else {
        content = dares[Math.floor(Math.random() * dares.length)];
        emoji = '🎯';
      }

      const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${choice.charAt(0).toUpperCase() + choice.slice(1)}`)
        .setDescription(content)
        .setColor(choice === 'truth' ? '#3498db' : '#e74c3c')
        .setFooter({ text: `Requested by ${interaction.user.username}` });
      
      await interaction.update({ embeds: [embed], components: [] });
    });

    collector.on('end', (collected) => {
      if (collected.size === 0) {
        msg.edit({ content: 'Game cancelled due to inactivity.', components: [] }).catch(() => {});
      }
    });
  }
};