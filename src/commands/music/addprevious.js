const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: 'addprevious',
  category: 'music',
  aliases: ["previ"],
  description: 'adds the previous song to the queue',
  owner: false,
  votelock:true,
  wl : true,
  execute: async (message, args, client, prefix) => {

    let ok = EMOJIS.ok;
    let no = EMOJIS.no;

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

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitForVoiceBridge = async () => {
    const startedAt = Date.now();
    while ((Date.now() - startedAt) < 10000) {
      const botChannelId = message.guild.members.me?.voice?.channelId || null;
      const hasVoiceBridge = Boolean(
        player?.voice?.sessionId &&
        player?.voice?.token &&
        player?.voice?.endpoint
      );

      if (botChannelId === channel.id && hasVoiceBridge) {
        return true;
      }

      await sleep(200);
    }

    return false;
  };

  const ensurePlaybackStarted = async () => {
    if (player.state !== "CONNECTED" || message.guild.members.me?.voice?.channelId !== channel.id) {
      await player.connect();
    }

    const voiceReady = await waitForVoiceBridge();
    if (!voiceReady) return false;

    await player.play({ paused: false });
    return true;
  };

  const last = typeof player.get === 'function' ? player.get('lastTrack') : null;
  if (!last) {
      const noperms = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`No previous songs found`)
      return await message.channel.send({embeds: [noperms]});
  }

  const previousQuery =
    last?.uri ||
    last?.info?.uri ||
    last?.identifier ||
    last?.info?.identifier ||
    last?.title ||
    last?.info?.title ||
    null;

  if (!previousQuery) {
      const noperms = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`No previous song source found`)
      return await message.channel.send({embeds: [noperms]});
  }

  let s = null;
  try {
    s = await player.search({ query: previousQuery }, message.author);
  } catch (_err) {
    return await message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(message.client?.embedColor || '#ff0051')
          .setDescription(`${no} Failed to load the previous track right now.`)
      ]
    }).catch(() => {});
  }

  if (s.loadType === "LOAD_FAILED") {
    if (player && !player.queue?.current && !(Array.isArray(player.queue?.tracks) && player.queue.tracks.length > 0)) await player.destroy().catch(() => {});
    return await message.channel.send({
      content: `${no} Error while Loading track.`
    }).catch(() => {});
  } else if (s.loadType === "NO_MATCHES") {
    if (player && !player.queue?.current && !(Array.isArray(player.queue?.tracks) && player.queue.tracks.length > 0)) await player.destroy().catch(() => {});
    return await message.channel.send({
      content: `${no} No results found, try to be specific as possible.`
    }).catch(() => {});
  } else if (s.loadType === "TRACK_LOADED") {
    const shouldStart = !player.playing && !player.paused && !player.queue?.current && !(Array.isArray(player.queue?.tracks) && player.queue.tracks.length > 0);
    if (player) await player.queue.add(s.tracks[0]);
    if (shouldStart) await ensurePlaybackStarted();
    return await message.channel.send({
      embeds: [new EmbedBuilder() .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`Queued ${s.tracks[0].title}`)]
    }).catch(() => {});
  } else if (s.loadType === "PLAYLIST_LOADED") {
    const shouldStart = !player.playing && !player.paused && !player.queue?.current && !(Array.isArray(player.queue?.tracks) && player.queue.tracks.length > 0);
    if (player) await player.queue.add(s.tracks);
    if (shouldStart) await ensurePlaybackStarted();

    return await message.channel.send({
      embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051')
      .setDescription(`Queued **${s.tracks.length}** tracks from **${s.playlist.name}**`)]
    }).catch(() => {} )
  } else if (s.loadType === "SEARCH_RESULT") {
    const shouldStart = !player.playing && !player.paused && !player.queue?.current && !(Array.isArray(player.queue?.tracks) && player.queue.tracks.length > 0);
    if (player) await player.queue.add(s.tracks[0]);
    if (shouldStart) await ensurePlaybackStarted();
    return await message.channel.send({
      embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`Queued ${s.tracks[0].title}`)]
    }).catch(() => {});
  } else return await message.channel.send({
    content: `${no} No results found, try to be specific as possible.`
  }).catch(() => {});
}

}
