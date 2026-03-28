const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const { safeReply, safeDeferReply } = require('../../utils/interactionResponder');
const { withTimeout } = require('../../utils/promiseHandler');

const EMOJIS = require("../../utils/emoji.json");
const SEARCH_TIMEOUT_MS = 5000;
const VOICE_BRIDGE_TIMEOUT_MS = 5000;
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
    const deferred = await safeDeferReply(interaction, { ephemeral: false });
    if (!deferred) return safeReply(interaction, { content: 'Failed to defer reply.' });

    let ok = EMOJIS.ok;
    let no = EMOJIS.no;

      const emojiaddsong = EMOJIS.addsong;
      const emojiplaylist = EMOJIS.playlist;

    const query = interaction.options.getString("query");
    if (!query) return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051')
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
    const musicCore = client.core.music;

    // Add 10-second timeout to search
    const searchPromise = player.search({
        query: query,
        source: 'soundcloud'
      }, interaction.user);

    let s;
    try {
      s = await withTimeout(searchPromise, SEARCH_TIMEOUT_MS, `Search timeout after ${SEARCH_TIMEOUT_MS / 1000} seconds`);
    } catch (err) {
      client.logger?.log(`SoundCloud search error: ${err.message}`, 'error');
      if (player && !player.queue?.current && !(player.queue?.tracks?.length > 0)) {
        await player.destroy().catch(() => {});
      }
      return await interaction.editReply({
        content: `${no} Search failed: ${err.message}`
      }).catch((err) => client.logger?.log(`Reply error: ${err.message}`, 'error'));
    }

    if (s.loadType === "LOAD_FAILED") {
      if (player && !player.queue?.current && !(player.queue?.tracks?.length > 0)) {
        await player.destroy().catch(() => {});
      }
      return await interaction.editReply({
        content: `${no} Error while Loading track.`
      }).catch((err) => client.logger?.log(`Reply error: ${err.message}`, 'error'));
    } else if (s.loadType === "NO_MATCHES") {
      if (player && !player.queue?.current && !(player.queue?.tracks?.length > 0)) {
        await player.destroy().catch(() => {});
      }
      return await interaction.editReply({
        content: `${no} No results found, try to be specific as possible.`
      }).catch((err) => client.logger?.log(`Reply error: ${err.message}`, 'error'));
    } else if (s.loadType === "TRACK_LOADED") {
      try {
        const { queueTracksForPlayback } = client.core.queue;
        const playbackResult = await queueTracksForPlayback(
          player,
          s.tracks[0],
          (directTrack) => musicCore.ensurePlayerPlayback({
            player,
            guild: interaction.guild,
            channelId: channel.id,
            directTrack,
            timeoutMs: VOICE_BRIDGE_TIMEOUT_MS,
            recoverVolume: true,
          })
        );
        if (!playbackResult.hadActivePlayback && !playbackResult.startedPlayback) {
          throw new Error('Failed to start playback.');
        }
      } catch (err) {
        client.logger?.log(`Player error: ${err.message}`, 'error');
        return await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Failed to start playback. Please try again.`)]
        }).catch(() => {});
      }
      return await interaction.editReply({
        embeds: [new EmbedBuilder() .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`Queued [${s.tracks[0].title}](${s.tracks[0].uri}) [\`${interaction.member.user.tag}\`]`)]
      }).catch((err) => client.logger?.log(`Reply error: ${err.message}`, 'error'));
    } else if (s.loadType === "PLAYLIST_LOADED") {
      try {
        const { queueTracksForPlayback } = client.core.queue;
        const playbackResult = await queueTracksForPlayback(
          player,
          s.tracks,
          (directTrack) => musicCore.ensurePlayerPlayback({
            player,
            guild: interaction.guild,
            channelId: channel.id,
            directTrack,
            timeoutMs: VOICE_BRIDGE_TIMEOUT_MS,
            recoverVolume: true,
          })
        );
        if (!playbackResult.hadActivePlayback && !playbackResult.startedPlayback) {
          throw new Error('Failed to start playback.');
        }
      } catch (err) {
        client.logger?.log(`Player error: ${err.message}`, 'error');
        return await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Failed to start playback. Please try again.`)]
        }).catch(() => {});
      }
      return await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051')
        .setDescription(`Queued **${s.tracks.length}** tracks from **${s.playlist.name}**`)]
      }).catch((err) => client.logger?.log(`Reply error: ${err.message}`, 'error'));
    } else if (s.loadType === "SEARCH_RESULT") {
      try {
        const { queueTracksForPlayback } = client.core.queue;
        const playbackResult = await queueTracksForPlayback(
          player,
          s.tracks[0],
          (directTrack) => musicCore.ensurePlayerPlayback({
            player,
            guild: interaction.guild,
            channelId: channel.id,
            directTrack,
            timeoutMs: VOICE_BRIDGE_TIMEOUT_MS,
            recoverVolume: true,
          })
        );
        if (!playbackResult.hadActivePlayback && !playbackResult.startedPlayback) {
          throw new Error('Failed to start playback.');
        }
      } catch (err) {
        client.logger?.log(`Player error: ${err.message}`, 'error');
        return await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Failed to start playback. Please try again.`)]
        }).catch(() => {});
      }
      return await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`Queued [${s.tracks[0].title}](${s.tracks[0].uri}) [\`${s.tracks[0].requester?.tag || interaction.user.tag}\`]`)]
      }).catch((err) => client.logger?.log(`Reply error: ${err.message}`, 'error'));
    } else {
      return await interaction.editReply({
        content: `${no} No results found, try to be specific as possible.`
      }).catch((err) => client.logger?.log(`Reply error: ${err.message}`, 'error'));
    }
  },
};
