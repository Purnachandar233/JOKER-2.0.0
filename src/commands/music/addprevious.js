const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const safePlayer = require('../../utils/safePlayer');

module.exports = {
  name: 'addprevious',
  category: 'music',
  aliases: ["previ"],
  description: 'adds the previous song to the queue',
  owner: false,
  votelock:true,
  wl : true,
  execute: async (message, args, client, prefix) => {
   
    let ok = client.emoji.ok;
    let no = client.emoji.no;

    if (!message.replied) await message.channel.send().catch(() => {});
    const { channel } = message.member.voice;
    if (!channel) {
                    const noperms = new EmbedBuilder()
              
         .setColor(message.client?.embedColor || '#ff0051')
           .setDescription(`${no} You must be connected to a voice channel to use this command.`)
        return await message.channel.send({embeds: [noperms]});
    }
    if(message.member.voice.selfDeaf) {	
      let thing = new EmbedBuilder()
       .setColor(message.client?.embedColor || '#ff0051')

     .setDescription(`${no} <@${message.member.id}> You cannot run this command while deafened.`)
       return await message.channel.send({embeds: [thing]});
     }

  let player = client.lavalink.players.get(message.guild.id);
  if(player && channel.id !== player.voiceChannelId) {
    const noperms = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
.setDescription(`${no} You must be connected to the same voice channel as me.`)
return await message.channel.send({embeds: [noperms]});
}

  if (!player) player = client.lavalink.createPlayer({
    guildId: message.guild.id,
    textChannelId: message.channelId,
    voiceChannelId: message.member.voice.channel.id,
    selfDeafen: true,
  });


  const last = typeof player.get === 'function' ? player.get('lastTrack') : null;
  if (!last) {
      const noperms = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`No previous songs found`)
      return await message.channel.send({embeds: [noperms]});
  }

  const s = await player.search(last.uri, message.user);
  if (s.loadType === "LOAD_FAILED") {
    if (player && safePlayer.queueSize(player) === 0) await safePlayer.safeDestroy(player);
    return await message.channel.send({
      content: `${no} Error while Loading track.`
    }).catch(() => {});
  } else if (s.loadType === "NO_MATCHES") {
    if (player && safePlayer.queueSize(player) === 0) await safePlayer.safeDestroy(player);
    return await message.channel.send({
      content: `${no} No results found, try to be specific as possible.`
    }).catch(() => {});
  } else if (s.loadType === "TRACK_LOADED") {
    if (player && player.state !== "CONNECTED") await safePlayer.safeCall(player, 'connect');
    if (player) safePlayer.queueAdd(player, s.tracks[0]);
    if (player && player.state === "CONNECTED" && !player.playing && !player.paused && !safePlayer.queueSize(player)) await safePlayer.safeCall(player, 'play');
    return await message.channel.send({
      embeds: [new EmbedBuilder() .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`Queued [${s.tracks[0].title}](https://www.youtube.com/watch?v=dQw4w9WgXcQ) `)]
    }).catch(() => {});
  } else if (s.loadType === "PLAYLIST_LOADED") {
    if (player && player.state !== "CONNECTED") await safePlayer.safeCall(player, 'connect');
    if (player) safePlayer.queueAdd(player, s.tracks);
    if (player && player.state === "CONNECTED" && !player.playing && !player.paused && safePlayer.queueSize(player) === s.tracks.length) await safePlayer.safeCall(player, 'play');

    return await message.channel.send({
      embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051')
      .setDescription(`Queued **${s.tracks.length}** tracks from **${s.playlist.name}**`)]
    }).catch(() => {})
  } else if (s.loadType === "SEARCH_RESULT") {
    if (player && player.state !== "CONNECTED") await safePlayer.safeCall(player, 'connect');
    if (player) safePlayer.queueAdd(player, s.tracks[0]);
    if (player && player.state === "CONNECTED" && !player.playing && !player.paused && !safePlayer.queueSize(player)) await safePlayer.safeCall(player, 'play');
    return await message.channel.send({
      embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`Queued [${s.tracks[0].title}](https://www.youtube.com/watch?v=dQw4w9WgXcQ) `)]
    }).catch(() => {});
  } else return await message.channel.send({
    content: `${no} No results found, try to be specific as possible.`
  }).catch(() => {});
}
   
}
