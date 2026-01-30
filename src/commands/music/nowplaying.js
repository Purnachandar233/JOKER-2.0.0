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
        .setColor(0xff0051)
        .setDescription(`${no} You must be connected to a voice channel to use this command.`);
      return await message.channel.send({ embeds: [noperms] });
    }

    if (message.member.voice.selfDeaf) {
      let thing = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`${no} <@${message.member.id}> You cannot run this command while deafened.`);
      return await message.channel.send({ embeds: [thing] });
    }

    const player = client.lavalink.players.get(message.guild.id);
    
    if (!player || !player.queue.current) {
      const noperms = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`${no} There is nothing playing in this server.`);
      return await message.channel.send({ embeds: [noperms] });
    }

    if (player && channel.id !== player.voiceChannelId) {
      const noperms = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`${no} You must be connected to the same voice channel as me.`);
      return await message.channel.send({ embeds: [noperms] });
    }

    const song = player.queue.current;

    let embed = new EmbedBuilder()
      .setTitle("Now playing")
      .addFields(
        { name: 'Song', value: `[${song.info?.title || song.title}](${song.info?.uri || song.uri})` },
        { name: 'Song By', value: `${song.info?.author || song.author}` },
        { name: 'Duration', value: `\`${!(song.info?.isStream || song.isStream) ? new Date(song.info?.duration || song.duration).toISOString().slice(11, 19) : '◉ LIVE'}\`` },
        { name: 'Queue Length', value: `${player.queue.size} Songs` },
        { name: 'Progress', value: createBar(player) }
      )
      .setColor(0xff0051);

    return message.channel.send({ embeds: [embed] });
  }
};

