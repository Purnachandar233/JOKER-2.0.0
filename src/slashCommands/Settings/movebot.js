const { CommandInteraction, Client, EmbedBuilder, ChannelType } = require('discord.js');
const { safeReply, safeDeferReply } = require('../../utils/safeReply');

module.exports = {
  name: 'movebot',
  description: 'Move the bot to your voice channel',
  owner: false,
  wl: true,
  run: async (client, interaction) => {
    const deferred = await safeDeferReply(interaction, { ephemeral: false });
    if (!deferred) return safeReply(interaction, { content: 'Failed to defer reply.' });

    const channel = interaction.member.voice.channel;
    if (!channel) {
      const nvc = new EmbedBuilder()
        .setColor(interaction.client?.embedColor || '#ff0051')
        .setDescription('Please connect to a voice channel first');
      return await interaction.editReply({ embeds: [nvc] }).catch(() => {});
    }

    const botChannel = interaction.guild.members.me?.voice?.channel;
    if (!botChannel) {
      const nobot = new EmbedBuilder()
        .setColor(interaction.client?.embedColor || '#ff0051')
        .setDescription('I am not connected to any voice channel');
      return await interaction.editReply({ embeds: [nobot] }).catch(() => {});
    }

    if (channel.id === botChannel.id) {
      const ttt = new EmbedBuilder()
        .setColor(interaction.client?.embedColor || '#ff0051')
        .setDescription('I am already in your channel');
      return await interaction.editReply({ embeds: [ttt] }).catch(() => {});
    }

    const player = client.lavalink.players.get(interaction.guild.id);
    const opop = new EmbedBuilder()
      .setColor(interaction.client?.embedColor || '#ff0051')
      .setDescription('Joining your channel');
    await interaction.editReply({ embeds: [opop] }).catch(() => {});

    try {
      await interaction.guild.members.me?.voice.setChannel(channel, 'Resume queue in new channel');
      if (channel.type === ChannelType.GuildStageVoice) {
        await interaction.guild.members.me?.voice.setSuppressed(false);
      }
      const rrr = new EmbedBuilder()
        .setColor(interaction.client?.embedColor || '#ff0051')
        .setDescription('Successfully continued queue!');
      return await interaction.editReply({ embeds: [rrr] }).catch(() => {});
    } catch (err) {
      client.logger?.log(`movebot slash error: ${err && (err.stack || err.toString())}`, 'error');
      const embed = new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051').setDescription('Failed to move the bot.');
      return await interaction.editReply({ embeds: [embed] }).catch(() => {});
    }
  },
};
