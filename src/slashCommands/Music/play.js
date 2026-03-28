const { CommandInteraction, Client, EmbedBuilder, ApplicationCommandType } = require("discord.js");
const fetch = require('isomorphic-unfetch');
const { getData, getPreview, getTracks, getDetails } = require('spotify-url-info')(fetch)
const { withTimeout } = require('../../utils/promiseHandler.js');

const USER_SEARCH_SOURCE_ATTEMPTS = 2;
const USER_SEARCH_TIMEOUT_MS = 3000;
const USER_FALLBACK_SEARCH_TIMEOUT_MS = 2500;
const SPOTIFY_DIRECT_LOAD_TIMEOUT_MS = 5000;
const VOICE_BRIDGE_TIMEOUT_MS = 5000;
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

    if (!client.lavalink) {
      return await interaction.editReply({
        embeds: [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription("Lavalink is not connected yet. Please try again in a moment.")]
      }).catch(err => client.logger?.log(`editReply failed (lavalink missing): ${err?.message || err}`, 'warn'));
    }

    if (typeof client.waitForLavalinkReady === 'function') {
      const lavalinkReady = await client.waitForLavalinkReady(2500);
      if (!lavalinkReady) {
        return await interaction.editReply({
          embeds: [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription("No Lavalink node is available right now. Please try again in a moment.")]
        }).catch(err => client.logger?.log(`editReply failed (lavalink not ready): ${err?.message || err}`, 'warn'));
      }
    }

    const musicCore = client.core.music;
    const SEARCH_SOURCE_ORDER = musicCore.DEFAULT_SEARCH_SOURCE_ORDER;

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
    }

    const titleCase = (value) => {
      const text = String(value || '').trim();
      return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Search';
    };
    const describeSearchFailure = (attempt, fallbackMessage) => {
      if (!attempt) return fallbackMessage;

      if (attempt.hasNodeInfo && attempt.attemptedSources.length === 0) {
        return `No supported search sources are enabled on this Lavalink node. Available sources: ${musicCore.formatSourceList(attempt.advertisedSources)}.`;
      }

      if (attempt.lastError && musicCore.isTimeoutLikeError(attempt.lastError)) {
        const sourceLabel = titleCase(attempt.attemptedSources[0] || 'search');
        return `${sourceLabel} search timed out. Lavalink is responding too slowly right now.`;
      }

      return fallbackMessage;
    };

    if (query.toLowerCase().includes("youtube.com") || query.toLowerCase().includes("youtu.be")) {
      const noperms = new EmbedBuilder()
        .setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || 0xff0000)
        .setAuthor({ name: 'YouTube URL', iconURL: client.user.displayAvatarURL({ forceStatic: false }) })
        .setDescription(`We no longer support YouTube, please use other platforms like Spotify, SoundCloud or Bandcamp. Otherwise use a search query to use our default system.`);
      return await interaction.editReply({ embeds: [noperms] });
    }

    let s;
    let lastSearchAttempt = null;
    if (query.match(/https?:\/\/(open\.spotify\.com|spotify\.link)/)) {
      // Try direct URL loading first (works for playlists and tracks)
      try {
        const directLoadPromise = player.search({ query }, interaction.member.user);
        s = await withTimeout(directLoadPromise, SPOTIFY_DIRECT_LOAD_TIMEOUT_MS, 'Direct Spotify load timeout');
      } catch (directErr) {
        client.logger?.log(`Direct Spotify URL load failed: ${directErr.message}, trying search...`, 'warn');
        // Fallback: try to get track info and search
        let searchQuery = query;
        try {
          const data = await getPreview(query);
          searchQuery = `${data.title} ${data.artist}`;
          const spotifyPreferred = musicCore.getAvailableSearchSources(player, ['spotify']).sources.length
            ? ['spotify']
            : SEARCH_SOURCE_ORDER;
          const searchAttempt = await musicCore.searchWithAvailableSources({
            player,
            queryText: searchQuery,
            requester: interaction.member.user,
            preferredSources: spotifyPreferred,
            timeoutMs: USER_SEARCH_TIMEOUT_MS,
            logPrefix: 'Spotify preview search',
          });
          s = searchAttempt.result;
          lastSearchAttempt = searchAttempt;
        } catch (searchErr) {
          client.logger?.log(`Spotify URL search error: ${searchErr.message}`, 'error');
          // Fallback: search on other sources using extracted title/artist
          try {
            const fallbackAttempt = await musicCore.searchWithAvailableSources({
              player,
              queryText: searchQuery,
              requester: interaction.member.user,
              preferredSources: SEARCH_SOURCE_ORDER,
              timeoutMs: USER_FALLBACK_SEARCH_TIMEOUT_MS,
              logPrefix: 'Fallback search',
            });
            s = fallbackAttempt.result;
            lastSearchAttempt = fallbackAttempt;
            if (!s || !s.tracks || s.tracks.length === 0) {
              return await interaction.editReply({
                embeds: [new EmbedBuilder()
                  .setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051')
                  .setDescription(describeSearchFailure(lastSearchAttempt, 'Failed to load Spotify content from the enabled Lavalink sources. Please try again.'))]
              }).catch(err => client.logger?.log(`editReply failed (spotify fallback empty): ${err?.message || err}`, 'warn'));
            }
          } catch (fallbackErr) {
            client.logger?.log(`All fallback searches failed: ${fallbackErr.message}`, 'error');
            return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051').setDescription('Failed to load Spotify content. Please try a different query.')] }).catch(err => client.logger?.log(`editReply failed (spotify all fallback): ${err?.message || err}`, 'warn'));
          }
        }
      }
    } else {
      const searchAttempt = await musicCore.searchWithAvailableSources({
        player,
        queryText: query,
        requester: interaction.member.user,
        preferredSources: SEARCH_SOURCE_ORDER,
        timeoutMs: USER_SEARCH_TIMEOUT_MS,
        logPrefix: 'Search',
      });
      s = searchAttempt.result;
      lastSearchAttempt = searchAttempt;
    }

    if (!s || !s.tracks || s.tracks.length === 0) {
      if (player && (!player.queue?.current) && !(player.queue?.tracks?.length > 0)) await player.destroy().catch(() => {});
      return await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051')
          .setDescription(describeSearchFailure(lastSearchAttempt, 'No results found across the enabled Lavalink sources. Try a different query.'))]
      }).catch(err => client.logger?.log(`editReply failed (no results): ${err?.message || err}`, 'warn'));
    }

    if (!s || !s.tracks) {
      if (player && (!player.queue?.current) && !(player.queue?.tracks?.length > 0)) await player.destroy().catch(() => {});
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
      if (player && (!player.queue?.current) && !(player.queue?.tracks?.length > 0)) await player.destroy().catch(() => {});
      return await interaction.editReply({ embeds: [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription('No results found.')] }).catch(err => client.logger?.log(`editReply failed (load failed): ${err?.message || err}`, 'warn'));
    }

    if (s.loadType === "PLAYLIST_LOADED" && s.playlist) {
        try {
            const { getQueueArray, queueTracksForPlayback } = client.core.queue;
            const existing = (getQueueArray(player) || []).map(t => t?.info?.identifier || t?.identifier || t?.id || t?.uri).filter(Boolean);
            const toAdd = [];
            for (const trackItem of s.tracks) {
                const id = trackItem?.info?.identifier || trackItem?.identifier || trackItem?.id || trackItem?.uri;
                if (id && existing.includes(id)) continue;
                toAdd.push(trackItem);
                if (id) existing.push(id);
            }
            if (!toAdd.length) {
              return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051').setDescription("Those playlist tracks are already in the queue.")] }).catch(() => {});
            }
            try { player.set('suppressUntil', Date.now() + 1200); } catch (e) {}
            try {
              const playbackResult = await queueTracksForPlayback(
                player,
                toAdd,
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
                throw new Error('no-track-started');
              }
            } catch (e) {
              client.logger?.log('Failed to play playlist in guild ' + interaction.guildId + ': ' + (e && (e.message || e)), 'error');
              return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051').setDescription("Failed to start playback. Please try again.")] }).catch(() => {});
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
        const queuedTracksBefore = Array.isArray(player?.queue?.tracks) ? player.queue.tracks.length : 0;
        const hadExistingPlayback = Boolean(player?.queue?.current || player?.playing || player?.paused);
        const queuePosition = queuedTracksBefore + 1;
        const shouldShowQueuedState = hadExistingPlayback || queuedTracksBefore > 0;
        try {
          const { getQueueArray, queueTracksForPlayback } = client.core.queue;
          const trackIdentity = s.tracks[0]?.info?.identifier || s.tracks[0]?.identifier || s.tracks[0]?.id || s.tracks[0]?.uri;
          if (trackIdentity) {
            const existing = getQueueArray(player).map((trackItem) => trackItem?.info?.identifier || trackItem?.identifier || trackItem?.id || trackItem?.uri).filter(Boolean);
            if (existing.includes(trackIdentity)) {
              return await interaction.editReply({ embeds: [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription("That track is already in the queue.")] }).catch(() => {});
            }
          }
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
            throw new Error('no-track-started');
          }
        } catch (e) {
          client.logger?.log(`Failed to play track in guild ${interaction.guildId}: ${e.message}`, 'error');
          return await interaction.editReply({ embeds: [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription("Failed to start playback. Please try again.")] }).catch(err => client.logger?.log(`editReply failed (failed to play track): ${err?.message || err}`, 'warn'));
        }
        const queuedTrackTitle = client.core.queue.formatQueueTrackTitle(s.tracks[0], 75);
        const queuedTrackLength = client.core.queue.formatTrackLength(s.tracks[0]);
        const embed = new EmbedBuilder()
          .setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051')
          .setAuthor({
            name: shouldShowQueuedState ? `Track queued - Position #${queuePosition}` : "Now playing",
            iconURL: interaction.member?.displayAvatarURL?.({ forceStatic: false, size: 256 }) || interaction.user.displayAvatarURL({ forceStatic: false, size: 256 }),
          })
          .setDescription(
            shouldShowQueuedState
              ? `Added ${queuedTrackTitle} \`${queuedTrackLength}\` to the queue`
              : `Started ${queuedTrackTitle} \`${queuedTrackLength}\``
          );
        return await interaction.editReply({ embeds: [embed] }).catch(err => client.logger?.log(`editReply failed (track queued): ${err?.message || err}`, 'warn'));
    }
  },
};

