const { CommandInteraction, Client, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'forceplayerdestroy',
  description: 'Forcefully destroy the player for this guild',
  owner: false,
  djonly: true,
  wl: true,
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});

    const ok = client.emoji?.ok;
    const no = client.emoji?.no;

    if (!interaction.member.permissions.has('MANAGE_CHANNELS')) {
      const noperms = new EmbedBuilder()
        .setColor(interaction.client?.embedColor || '#ff0051')
        .setDescription(`${no} You need this required Permissions: \`MANAGE_CHANNELS\` to run this command.`);
      return await interaction.editReply({ embeds: [noperms] }).catch(() => {});
    }

    const player = client.lavalink.players.get(interaction.guild.id);
    const safePlayer = require('../../utils/safePlayer');
    try {
      await safePlayer.safeDestroy(player);
      const thing = new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051').setDescription(`${ok} Forcely Destroyed the player for this guild!`);
      return await interaction.editReply({ embeds: [thing] }).catch(() => {});
    } catch (err) {
      client.logger?.log(`forceplayerdestroy slash error: ${err && (err.stack || err.toString())}`, 'error');
      const embed = new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051').setDescription('Failed to destroy the player.');
      return await interaction.editReply({ embeds: [embed] }).catch(() => {});
    }
  },
};
