const { EmbedBuilder, Client, CommandInteraction } = require('discord.js');

module.exports = {
  name: 'debugmusic',
  description: 'Debug music subsystem (lavalink, player, queue).',
  owner: false,
  player: false,
  wl : true,
  run: async (client, interaction) => {
    await interaction.deferReply({ flags: [64] }).catch(() => {});
    const embed = new EmbedBuilder().setTitle('Music Debug').setColor(interaction.client?.embedColor || '#ff0051');

    const lavalink = !!client.lavalink;
    const nodes = client.lavalink?.nodeManager?.nodes?.size ?? client.lavalink?.nodes?.length ?? 0;
    const players = client.lavalink?.players?.size ?? 0;

    embed.addFields(
      { name: 'Lavalink connected', value: `${lavalink}`, inline: true },
      { name: 'Nodes', value: `${nodes}`, inline: true },
      { name: 'Players', value: `${players}`, inline: true }
    );

    const player = client.lavalink?.players?.get(interaction.guild.id);
    if (player) {
      const { getQueueArray } = require('../../../src/utils/queue.js');
      const safePlayer = require('../../../src/utils/safePlayer');
      const tracks = getQueueArray(player);
      const queueSize = safePlayer.queueSize(player) || tracks.length || 0;
      const current = tracks[0];
      const currentTitle = current?.info?.title || current?.title || 'None';
      embed.addFields(
        { name: 'Guild player', value: `present`, inline: true },
        { name: 'Queue size', value: `${queueSize}`, inline: true },
        { name: 'Current', value: `${currentTitle}`, inline: false }
      );
    } else {
      embed.addFields({ name: 'Guild player', value: `not found`, inline: true });
    }

    await interaction.editReply({ embeds: [embed] });
  }
};
