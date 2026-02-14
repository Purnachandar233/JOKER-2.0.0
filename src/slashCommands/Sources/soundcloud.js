const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const safePlayer = require('../../utils/safePlayer');
module.exports = {
  name: "soundcloud",
  description: "plays some high quality music from soundcloud",
  owner: false,
  player: false,
  inVoiceChannel: true,
  sameVoiceChannel: false,
  wl : true,
  options: [
    {
      name: "query",
      description: "name link etc.",
      required: true,
      type: 3
		}
	],
  votelock: true,

  

  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   */

  run: async (client, interaction,) => {
   await interaction.deferReply({
            ephemeral: false
        });
          
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
      const emojiaddsong = client.emoji.addsong;
      const emojiplaylist = client.emoji.playlist;

    const query = interaction.options.getString("query");
    if (!query) return await interaction.editReply({ flags: [64], embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051')                     
      .setDescription(`${no}Please provide a search input to search.`)]
      }).catch(() => {});
      const { channel } = interaction.member.voice;
      if (!channel) {
                      const noperms = new EmbedBuilder()
                
           .setColor(interaction.client?.embedColor || '#ff0051')
             .setDescription(`${no} You must be connected to a voice channel to use this command.`)
          return await interaction.editReply({embeds: [noperms]});
      }
      if(interaction.member.voice.selfDeaf) {	
        let thing = new EmbedBuilder()
         .setColor(interaction.client?.embedColor || '#ff0051')

       .setDescription(`${no} <@${interaction.member.id}> You cannot run this command while deafened.`)
         return await interaction.editReply({embeds: [thing]});
       }

    let player = client.lavalink.players.get(interaction.guildId);
    if(player && channel.id !== player.voiceChannelId) {
      const noperms = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
.setDescription(`${no} You must be connected to the same voice channel as me.`)
return await interaction.editReply({embeds: [noperms]});
}

    if (!player) player = client.lavalink.createPlayer({
      guildId: interaction.guildId,
      textChannelId: interaction.channelId,
      voiceChannelId: interaction.member.voice.channelId,
      selfDeafen: true,
    });

    // Add 10-second timeout to search
    const searchPromise = player.search({
        query: query,
        source: 'soundcloud'
      }, interaction.user);
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Search timeout after 10 seconds')), 10000)
    );
    
    let s;
    try {
      s = await Promise.race([searchPromise, timeoutPromise]);
    } catch (err) {
      client.logger?.log(`SoundCloud search error: ${err.message}`, 'error');
      if (player && safePlayer.queueSize(player) === 0) {
        await safePlayer.safeDestroy(player);
      }
      return await interaction.editReply({
        content: `${no} Search failed: ${err.message}`
      }).catch((err) => client.logger?.log(`Reply error: ${err.message}`, 'error'));
    }

    if (s.loadType === "LOAD_FAILED") {
      if (player && safePlayer.queueSize(player) === 0) {
        await safePlayer.safeDestroy(player);
      }
      return await interaction.editReply({
        content: `${no} Error while Loading track.`
      }).catch((err) => client.logger?.log(`Reply error: ${err.message}`, 'error'));
    } else if (s.loadType === "NO_MATCHES") {
      if (player && safePlayer.queueSize(player) === 0) {
        await safePlayer.safeDestroy(player);
      }
      return await interaction.editReply({
        content: `${no} No results found, try to be specific as possible.`
      }).catch((err) => client.logger?.log(`Reply error: ${err.message}`, 'error'));
    } else if (s.loadType === "TRACK_LOADED") {
      try {
        if (player && player.state !== "CONNECTED") await safePlayer.safeCall(player, 'connect');
        safePlayer.queueAdd(player, s.tracks[0]);
        if (player && player.state === "CONNECTED" && !player.playing && !player.paused && safePlayer.queueSize(player) === 0) await safePlayer.safeCall(player, 'play');
      } catch (err) {
        client.logger?.log(`Player error: ${err.message}`, 'error');
      }
      return await interaction.editReply({
        embeds: [new EmbedBuilder() .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`Queued [${s.tracks[0].title}](${s.tracks[0].uri}) [\`${interaction.member.user.tag}\`]`)]
      }).catch((err) => client.logger?.log(`Reply error: ${err.message}`, 'error'));
    } else if (s.loadType === "PLAYLIST_LOADED") {
      try {
        if (player && player.state !== "CONNECTED") await safePlayer.safeCall(player, 'connect');
        safePlayer.queueAdd(player, s.tracks);
        if (player && player.state === "CONNECTED" && !player.playing && !player.paused && safePlayer.queueSize(player) === s.tracks.length) await safePlayer.safeCall(player, 'play');
      } catch (err) {
        client.logger?.log(`Player error: ${err.message}`, 'error');
      }
      return await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051')
        .setDescription(`Queued **${s.tracks.length}** tracks from **${s.playlist.name}**`)]
      }).catch((err) => client.logger?.log(`Reply error: ${err.message}`, 'error'));
    } else if (s.loadType === "SEARCH_RESULT") {
      try {
        if (player && player.state !== "CONNECTED") await safePlayer.safeCall(player, 'connect');
        safePlayer.queueAdd(player, s.tracks[0]);
        if (player && player.state === "CONNECTED" && !player.playing && !player.paused && safePlayer.queueSize(player) === 0) await safePlayer.safeCall(player, 'play');
      } catch (err) {
        client.logger?.log(`Player error: ${err.message}`, 'error');
      }
      return await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`Queued [${s.tracks[0].title}](${s.tracks[0].uri}) [\`${s.tracks[0].requester.tag}\`]`)]
      }).catch((err) => client.logger?.log(`Reply error: ${err.message}`, 'error'));
    } else {
      return await interaction.editReply({
        content: `${no} No results found, try to be specific as possible.`
      }).catch((err) => client.logger?.log(`Reply error: ${err.message}`, 'error'));
    }
  },
};