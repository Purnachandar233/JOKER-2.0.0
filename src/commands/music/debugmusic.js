const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'debugmusic',
  category: 'music',
  description: 'Debug music subsystem (lavalink, player, queue).',
  owner: false,
  wl: true,
  execute: async (message, args, client) => {
    const embed = new EmbedBuilder().setTitle('Music Debug').setColor(message.client?.embedColor || '#ff0051');

    const lavalink = !!client.lavalink;
    const nodes = client.lavalink?.nodeManager?.nodes?.size ?? client.lavalink?.nodes?.length ?? 0;
    const players = client.lavalink?.players?.size ?? 0;

    embed.addFields(
      { name: 'Lavalink connected', value: `${lavalink}`, inline: true },
      { name: 'Nodes', value: `${nodes}`, inline: true },
      { name: 'Players', value: `${players}`, inline: true }
    );

    const player = client.lavalink?.players?.get(message.guild.id);
    if (player) {
      const queueSize = player.queue?.size ?? 0;
      const current = player.queue?.current;
      const currentTitle = current?.info?.title || current?.title || 'None';
      embed.addFields(
        { name: 'Guild player', value: `present`, inline: true },
        { name: 'Queue size', value: `${queueSize}`, inline: true },
        { name: 'Current', value: `${currentTitle}`, inline: false }
      );
    } else {
      embed.addFields({ name: 'Guild player', value: `not found`, inline: true });
    }

    return message.channel.send({ embeds: [embed] });
  }
};
