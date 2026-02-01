const { EmbedBuilder } = require("discord.js");
const { createBar } = require('../../functions.js');

module.exports = {
  name: 'nowplaying',
  category: 'music',
  aliases: ["np", "empata", "kyagaana"],
  description: 'Shows the current playing song information.',
  owner: false,
  wl: true,
  execute: async (message, args, client, prefix) => {
    let ok = client.emoji.ok;
    let no = client.emoji.no;

    const { channel } = message.member.voice;
    if (!channel) {
      const noperms = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`${no} You must be connected to a voice channel to use this command.`);
      return await message.channel.send({ embeds: [noperms] });
    }

    if (message.member.voice.selfDeaf) {
      let thing = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`${no} <@${message.member.id}> You cannot run this command while deafened.`);
      return await message.channel.send({ embeds: [thing] });
    }

    const safePlayer = require('../../utils/safePlayer');
    const { getQueueArray } = require('../../utils/queue.js');
    const player = client.lavalink.players.get(message.guild.id);
    const tracks = getQueueArray(player);
    
    if (!player || !tracks || tracks.length === 0) {
      const noperms = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`${no} There is nothing playing in this server.`);
      return await message.channel.send({ embeds: [noperms] });
    }

    if (player && channel.id !== player.voiceChannelId) {
      const noperms = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`${no} You must be connected to the same voice channel as me.`);
      return await message.channel.send({ embeds: [noperms] });
    }

    const song = tracks[0];
    const title = song?.info?.title || song?.title || 'Unknown Title';
    const uri = song?.info?.uri || song?.uri || '';
    const author = song?.info?.author || song?.author || 'Unknown';
    const isStream = song?.info?.isStream || song?.isStream || false;
    const duration = song?.info?.duration || song?.duration || null;
    const durationStr = isStream ? '◉ LIVE' : (duration ? new Date(duration).toISOString().slice(11, 19) : 'Unknown');

    let embed = new EmbedBuilder()
      .setTitle("Now playing")
      .addFields(
        { name: 'Song', value: `[${title}](${uri})` },
        { name: 'Song By', value: `${author}` },
        { name: 'Duration', value: `\`${durationStr}\`` },
        { name: 'Queue Length', value: `${safePlayer.queueSize(player)} Songs` },
        { name: 'Progress', value: createBar(player) }
      )
      .setColor(message.client?.embedColor || '#ff0051');

    return message.channel.send({ embeds: [embed] });
  }
};

