const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'lavalink-debug',
  category: 'owner',
  description: 'Show Lavalink node and guild player diagnostics (owner only).',
  owneronly: true,
  execute: async (message, args, client) => {
    const embed = new EmbedBuilder().setTitle('Lavalink Diagnostics').setColor(message.client?.embedColor || '#ff0051');

    if (!client.lavalink) {
      embed.setDescription('Lavalink manager is not initialized.');
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    try {
      // Node summary
      const nodes = [];
      try {
        client.lavalink.nodeManager.nodes.forEach((node) => {
          const s = node.stats || {};
          nodes.push({
            id: node.options?.identifier || node.id || 'unknown',
            host: node.options?.host || 'unknown',
            port: node.options?.port || 'unknown',
            memMB: s.memory ? Math.round(s.memory.used / 1024 / 1024) : 'n/a',
            cpu: (s.cpu && s.cpu.lavalinkLoad) ? `${(Math.round(s.cpu.lavalinkLoad * 100) / 100).toFixed(2)}%` : 'n/a',
            players: s.players ?? 'n/a',
            playingPlayers: s.playingPlayers ?? 'n/a',
            uptime: s.uptime ?? null
          });
        });
      } catch (e) {
        // fallback when nodeManager shape differs
      }

      if (nodes.length === 0) {
        embed.addFields({ name: 'Nodes', value: 'No nodes found', inline: true });
      } else {
        const nodeLines = nodes.map(n => `ID: ${n.id} • ${n.host}:${n.port} • Mem: ${n.memMB}MB • CPU: ${n.cpu} • Players: ${n.playingPlayers}/${n.players}`);
        embed.addFields({ name: 'Nodes', value: `\n${nodeLines.join('\n')}`, inline: false });
      }

      // Lavalink manager totals
      const totalNodes = client.lavalink?.nodeManager?.nodes?.size ?? client.lavalink?.nodes?.length ?? 0;
      const totalPlayers = client.lavalink?.players?.size ?? 0;
      embed.addFields(
        { name: 'Totals', value: `Nodes: ${totalNodes} • Players: ${totalPlayers}`, inline: true }
      );

      // Guild player info
      const player = client.lavalink.players.get(message.guild.id);
      if (!player) {
        embed.addFields({ name: 'Guild Player', value: 'No player for this guild', inline: false });
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      const queueSize = player.queue?.size ?? player.queue?.tracks?.length ?? 0;
      const current = player.queue?.current ?? (player.queue?.tracks && player.queue.tracks[0]) ?? null;
      const currentTitle = current?.info?.title || current?.title || 'None';
      const currentUri = current?.info?.uri || current?.uri || 'N/A';
      const playing = typeof player.playing !== 'undefined' ? player.playing : (player.state === 'playing');
      const paused = !!player.paused;

      embed.addFields(
        { name: 'Guild Player', value: `present`, inline: true },
        { name: 'Queue size', value: `${queueSize}`, inline: true },
        { name: 'Playing', value: `${playing}`, inline: true },
        { name: 'Paused', value: `${paused}`, inline: true },
        { name: 'Current track', value: `${currentTitle}\n${currentUri}`, inline: false },
      );

      // Attempt to show player.volume if available
      try {
        const vol = typeof player.volume !== 'undefined' ? player.volume : (player.get ? player.get('volume') : null);
        embed.addFields({ name: 'Player volume', value: `${vol ?? 'unknown'}`, inline: true });
      } catch (e) {}

      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    } catch (err) {
      return message.reply({ embeds: [new EmbedBuilder().setColor('#ff0051').setDescription('Failed to gather Lavalink diagnostics: ' + (err && err.message || err))], allowedMentions: { repliedUser: false } });
    }
  }
};
