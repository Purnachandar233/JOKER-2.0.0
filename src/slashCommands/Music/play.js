const { CommandInteraction, Client, EmbedBuilder, ApplicationCommandType } = require("discord.js");
const track = require('../../schema/trackinfoSchema.js')
const fetch = require('isomorphic-unfetch');
const { getData, getPreview, getTracks, getDetails } = require('spotify-url-info')(fetch)
const safePlayer = require('../../utils/safePlayer');
module.exports = {
  name: "play",
  description: "plays some high quality music",
  owner: false,
  player: false,
  inVoiceChannel: true,
  sameVoiceChannel: false,
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: "query",
      description: "name link etc.",
      required: true,
      type: 3
    }
  ],

  run: async (client, interaction) => {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(err => client.logger?.log(`deferReply failed: ${err?.message || err}`, 'warn'));
    }
    
    const query = interaction.options.getString("query");
    if (!query) return await interaction.editReply({ embeds: [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription("Please provide a search input to search.")] }).catch(err => client.logger?.log(`editReply failed (no query): ${err?.message || err}`, 'warn'));

    const { channel } = interaction.member.voice;
    if (!channel) {
      const noperms = new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription(`You must be connected to a voice channel to use this command.`);
      return await interaction.editReply({ embeds: [noperms] }).catch(err => client.logger?.log(`editReply failed (not in VC): ${err?.message || err}`, 'warn'));
    }

    if (interaction.member.voice.selfDeaf) {
      let thing = new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription(`You cannot run this command while deafened.`);
      return await interaction.editReply({ embeds: [thing] }).catch(err => client.logger?.log(`editReply failed (deafened): ${err?.message || err}`, 'warn'));
    }

    let player = client.lavalink.players.get(interaction.guildId);
    if (player && channel.id !== player.voiceChannelId) {
      const noperms = new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription(`You must be connected to the same voice channel as me.`);
      return await interaction.editReply({ embeds: [noperms] }).catch(err => client.logger?.log(`editReply failed (youtube block): ${err?.message || err}`, 'warn'));
    }

    // Create player if it doesn't exist
    if (!player) {
      player = client.lavalink.createPlayer({
        guildId: interaction.guildId,
        textChannelId: interaction.channelId,
        voiceChannelId: interaction.member.voice.channelId,
        selfDeafen: true,
      });

      // Ensure player is connected before proceeding
      try {
        if (!player.connected) {
          await safePlayer.safeCall(player, 'connect');
          // Wait a bit for connection to establish
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        client.logger?.log(`Player connection failed: ${error?.message || error}`, 'error');
        return await interaction.editReply({ embeds: [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription("Failed to connect to voice channel. Please try again.")] }).catch(() => {});
      }
    }

    if (query.toLowerCase().includes("youtube.com") || query.toLowerCase().includes("youtu.be")) {
      const noperms = new EmbedBuilder()
        .setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || 0xff0000)
        .setAuthor({ name: 'YouTube URL', iconURL: client.user.displayAvatarURL({ forceStatic: false }) })
        .setDescription(`We no longer support YouTube, please use other platforms like Spotify, SoundCloud or Bandcamp. Otherwise use a search query to use our default system.`);
      return await interaction.editReply({ embeds: [noperms] });
    }

    let s;
    if (query.match(/https?:\/\/(open\.spotify\.com|spotify\.link)/)) {
      // Try direct URL loading first (works for playlists and tracks)
      try {
        const directLoadPromise = player.search(query, interaction.member.user);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Direct Spotify load timeout')), 10000)
        );
        s = await Promise.race([directLoadPromise, timeoutPromise]);
      } catch (directErr) {
        client.logger?.log(`Direct Spotify URL load failed: ${directErr.message}, trying search...`, 'warn');
        // Fallback: try to get track info and search
        try {
          const data = await getPreview(query);
          const searchQuery = `${data.title} ${data.artist}`;
          const searchPromise = player.search({ query: searchQuery, source: 'spotify' }, interaction.member.user);
          const searchTimeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Spotify search timeout')), 10000)
          );
          s = await Promise.race([searchPromise, searchTimeoutPromise]);
        } catch (searchErr) {
          client.logger?.log(`Spotify URL search error: ${searchErr.message}`, 'error');
          // Fallback: search on other sources using extracted title/artist
          try {
            const sources = ['soundcloud', 'bandcamp', 'deezer'];
            for (const source of sources) {
              try {
                const fallbackSearchPromise = player.search({ query: searchQuery, source }, interaction.member.user);
                const fallbackTimeoutPromise = new Promise((_, reject) =>
                  setTimeout(() => reject(new Error(`${source} fallback search timeout`)), 8000)
                );
                s = await Promise.race([fallbackSearchPromise, fallbackTimeoutPromise]);
                if (s && s.tracks && s.tracks.length > 0) break;
              } catch (fallbackErr) {
                client.logger?.log(`Fallback search failed for ${source}: ${fallbackErr.message}`, 'warn');
                continue;
              }
            }
            if (!s || !s.tracks || s.tracks.length === 0) {
                return await interaction.editReply({ embeds: [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription('Failed to load Spotify content from alternative sources. Please try a different query.')] }).catch(err => client.logger?.log(`editReply failed (spotify fallback empty): ${err?.message || err}`, 'warn'));
              }
          } catch (fallbackErr) {
            client.logger?.log(`All fallback searches failed: ${fallbackErr.message}`, 'error');
            return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051').setDescription('Failed to load Spotify content. Please try a different query.')] }).catch(err => client.logger?.log(`editReply failed (spotify all fallback): ${err?.message || err}`, 'warn'));
          }
        }
      }
    } else {
      // Try multiple sources for regular searches
      const sources = ['soundcloud', 'spotify', 'bandcamp', 'deezer'];
      for (const source of sources) {
        try {
          const searchPromise = player.search({ query, source }, interaction.member.user);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${source} search timeout`)), 8000)
          );
          s = await Promise.race([searchPromise, timeoutPromise]);
          if (s && s.tracks && s.tracks.length > 0) break;
        } catch (err) {
          client.logger?.log(`Search failed for ${source}: ${err.message}`, 'warn');
          continue;
        }
      }
    }


    if (!s || !s.tracks || s.tracks.length === 0) {
      if (player && safePlayer.queueSize(player) === 0) await safePlayer.safeDestroy(player);
      return await interaction.editReply({ embeds: [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription('No results found across all sources. Try a different query.')] }).catch(err => client.logger?.log(`editReply failed (no results): ${err?.message || err}`, 'warn'));
    }

    if (!s || !s.tracks) {
      if (player && safePlayer.queueSize(player) === 0) await safePlayer.safeDestroy(player);
      return await interaction.editReply({ embeds: [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription('No results found.')] }).catch(err => client.logger?.log(`editReply failed (no results 2): ${err?.message || err}`, 'warn'));
    }

    if (s.tracks && Array.isArray(s.tracks)) {
        s.tracks = s.tracks.filter(track => {
            const uri = track.info?.uri || track.uri || '';
            return !uri.toLowerCase().includes('youtube.com') && !uri.toLowerCase().includes('youtu.be');
        });
        if ((s.loadType === "SEARCH_RESULT" || s.loadType === "TRACK_LOADED") && s.tracks.length === 0) s.loadType = "NO_MATCHES";
        if (s.loadType === "PLAYLIST_LOADED" && s.tracks.length === 0) s.loadType = "NO_MATCHES";
    }

      if (s.loadType === "LOAD_FAILED" || s.loadType === "NO_MATCHES" || !s.tracks || s.tracks.length === 0) {
      if (player && safePlayer.queueSize(player) === 0) await safePlayer.safeDestroy(player);
      return await interaction.editReply({ embeds: [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription('No results found.')] }).catch(err => client.logger?.log(`editReply failed (load failed): ${err?.message || err}`, 'warn'));
    }

    if (s.loadType === "PLAYLIST_LOADED" && s.playlist) {
        try {
            const { getQueueArray } = require('../../utils/queue.js');
            const existing = (getQueueArray(player) || []).map(t => t?.info?.identifier || t?.identifier || t?.id || t?.uri).filter(Boolean);
            const toAdd = [];
            for (const trackItem of s.tracks) {
                const id = trackItem?.info?.identifier || trackItem?.identifier || trackItem?.id || trackItem?.uri;
                if (id && existing.includes(id)) continue;
                toAdd.push(trackItem);
                if (id) existing.push(id);
            }
            if (toAdd.length > 0) safePlayer.queueAdd(player, toAdd);
            try { player.set('suppressUntil', Date.now() + 1200); } catch (e) {}
            if (!player.playing && !player.paused) {
              try { await safePlayer.safeCall(player, 'play'); } catch (e) { client.logger?.log('Failed to play playlist in guild ' + interaction.guildId + ': ' + (e && (e.message || e)), 'error'); return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051').setDescription("Failed to start playback. Please try again.")] }).catch(() => {}); }
            }
            try { player.set('suppressUntil', Date.now()); } catch (e) {}
            const playlistName = s.playlist?.name || 'Unknown';
            const embed = new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051').setDescription(`Queued **${toAdd.length}** tracks from **${playlistName}**`);
            return await interaction.editReply({ embeds: [embed] }).catch(() => {});
        } catch (err) {
            client.logger?.log('Playlist handling error: ' + (err && (err.stack || err.toString())), 'error');
            return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051').setDescription('Failed to queue playlist.')] }).catch(() => {});
        }
    } else if (s.tracks && s.tracks[0]) {
        if (player.queue) {
          safePlayer.queueAdd(player, s.tracks[0]);
        }
        if (!player.playing && !player.paused) {
          try {
            await safePlayer.safeCall(player, 'play');
          } catch (e) {
            client.logger?.log(`Failed to play track in guild ${interaction.guildId}: ${e.message}`, 'error');
            return await interaction.editReply({ embeds: [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription("Failed to start playback. Please try again.")] }).catch(err => client.logger?.log(`editReply failed (failed to play track): ${err?.message || err}`, 'warn'));
          }
        }
        const trackTitle = s.tracks[0].info?.title || s.tracks[0].title || 'Unknown';
        const embed = new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription(`Queued **${trackTitle}** [\`${interaction.member.user.tag}\`]`);
        return await interaction.editReply({ embeds: [embed] }).catch(err => client.logger?.log(`editReply failed (track queued): ${err?.message || err}`, 'warn'));
    }
  },
};