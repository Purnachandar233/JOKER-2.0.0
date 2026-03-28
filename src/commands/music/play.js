const { EmbedBuilder } = require('discord.js');
const EMOJIS = require("../../utils/emoji.json");
// Use spotify-url-info (no axios dependency)
const fetch = require('isomorphic-unfetch');
const { getPreview, getTracks } = require('spotify-url-info')(fetch);
const { withTimeout } = require('../../utils/promiseHandler.js');

// Common URL shorteners that may redirect to YouTube
const URL_SHORTENERS = /bit\.ly|tinyurl\.com|ow\.ly|short\.link|youtu\.be|buff\.ly|tiny\.cc|goo\.gl|t\.co/i;
const USER_SEARCH_SOURCE_ATTEMPTS = 2;
const USER_SEARCH_TIMEOUT_MS = 3000;
const USER_FALLBACK_SEARCH_TIMEOUT_MS = 2500;
const SPOTIFY_DIRECT_LOAD_TIMEOUT_MS = 5000;
const SPOTIFY_PLAYLIST_FALLBACK_TRACK_LIMIT = 8;
const VOICE_BRIDGE_TIMEOUT_MS = 5000;

module.exports = {
  name: 'play',
  category: 'music',
  aliases: ["p", "pla"],
  description: 'Play your favorite melodies in high quality.',
  wl: true,
  execute: async (message, args, client, prefix) => {
    const query = args.join(" ");
    if (!query) {
      return await message.channel.send({
        embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("Please provide a search input.")]
      }).catch(() => { });
    }
    const { channel } = message.member.voice;
    if (!channel) {
      return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("You must be in a voice channel to use this command.")] });
    }

    if (query.toLowerCase().includes("youtube.com") || query.toLowerCase().includes("youtu.be") || URL_SHORTENERS.test(query)) {
      const noperms = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setAuthor({ name: 'YouTube URL', iconURL: client.user.displayAvatarURL({ forceStatic: false }) })
        .setDescription(`We do not support YouTube URLs. Please use other platforms like Spotify, SoundCloud, Bandcamp, Deezer or Apple Music.`);
      return await message.channel.send({ embeds: [noperms] });
    }

    if (!client.lavalink) {
      return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("Lavalink is not connected yet. Please try again in a moment.")] });
    }

    if (typeof client.waitForLavalinkReady === 'function') {
      const lavalinkReady = await client.waitForLavalinkReady(2500);
      if (!lavalinkReady) {
        return await message.channel.send({
          embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("No Lavalink node is available right now. Please try again in a moment.")]
        }).catch(() => {});
      }
    }

    const musicCore = client.core.music;
    const SEARCH_SOURCE_ORDER = musicCore.DEFAULT_SEARCH_SOURCE_ORDER;

    let player = client.lavalink.players.get(message.guild.id);
    if (player && channel.id !== player.voiceChannelId) {
      return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("*We must be in the same voice channel.*")] });
    }

    // Classic Aesthetic Play Logic
    if (!player) player = client.lavalink.createPlayer({
      guildId: message.guild.id,
      textChannelId: message.channelId,
      voiceChannelId: channel.id,
      selfDeafen: true,
    });

    let s;
    let lastSearchAttempt = null;
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
    if (query.match(/https?:\/\/(open\.spotify\.com|spotify\.link)/)) {
      // Try direct URL loading first (works for playlists and tracks)
      try {
        const directLoadPromise = player.search({ query }, message.member.user);
        s = await withTimeout(directLoadPromise, SPOTIFY_DIRECT_LOAD_TIMEOUT_MS, 'Direct Spotify load timeout');
      } catch (directErr) {
        client.logger?.log(`Direct Spotify URL load failed: ${directErr.message}, trying search...`, 'warn');
        // Fallback: try to get playlist tracks via getTracks(), then search each track.
        try {
          let searchQuery = null;
          // try getTracks (best for playlists)
          try {
            const tracksInfo = await getTracks(query).catch(() => null);
            if (tracksInfo && Array.isArray(tracksInfo) && tracksInfo.length) {
              const limit = Math.min(tracksInfo.length, SPOTIFY_PLAYLIST_FALLBACK_TRACK_LIMIT);
              const searchOne = async (q) => {
                const attempt = await musicCore.searchWithAvailableSources({
                  player,
                  queryText: q,
                  requester: message.member.user,
                  preferredSources: SEARCH_SOURCE_ORDER,
                  timeoutMs: USER_FALLBACK_SEARCH_TIMEOUT_MS,
                  logPrefix: 'Spotify playlist track search',
                  maxSourceAttempts: 2,
                });
                if (attempt.result?.tracks?.length) return attempt.result.tracks[0];

                lastSearchAttempt = attempt;
                return null;
              };

              const foundTracks = [];
              for (const t of tracksInfo.slice(0, limit)) {
                const q = `${t.name} ${ (t.artists && t.artists[0]) ? t.artists[0].name : '' }`;
                try {
                  const tr = await searchOne(q);
                  if (tr) foundTracks.push(tr);
                } catch (e) { continue; }
              }

              if (foundTracks.length) {
                s = { loadType: 'PLAYLIST_LOADED', tracks: foundTracks, playlist: { name: tracksInfo.name || 'Spotify Playlist' } };
              }
            }
          } catch (gtErr) {
            client.logger?.log(`getTracks fallback error: ${gtErr.message}`, 'warn');
          }

          // If getTracks didn't yield results, fallback to preview->search
          if (!s) {
            try {
              const data = await getPreview(query).catch(() => null);
              if (data) {
                searchQuery = `${data.title} ${data.artist}`;
                const spotifyPreferred = musicCore.getAvailableSearchSources(player, ['spotify']).sources.length
                  ? ['spotify']
                  : SEARCH_SOURCE_ORDER;
                const searchAttempt = await musicCore.searchWithAvailableSources({
                  player,
                  queryText: searchQuery,
                  requester: message.member.user,
                  preferredSources: spotifyPreferred,
                  timeoutMs: USER_SEARCH_TIMEOUT_MS,
                  logPrefix: 'Spotify preview search',
                });
                s = searchAttempt.result;
                lastSearchAttempt = searchAttempt;
              }
            } catch (searchErr) {
              client.logger?.log(`Spotify URL search error: ${searchErr.message}`, 'error');
            }
          }

          // If still no results, try other sources using either searchQuery or raw query
          if (!s || !s.tracks || s.tracks.length === 0) {
            try {
              const fallbackQuery = searchQuery || query;
              const fallbackAttempt = await musicCore.searchWithAvailableSources({
                player,
                queryText: fallbackQuery,
                requester: message.member.user,
                preferredSources: SEARCH_SOURCE_ORDER,
                timeoutMs: USER_FALLBACK_SEARCH_TIMEOUT_MS,
                logPrefix: 'Fallback search',
              });
              s = fallbackAttempt.result;
              lastSearchAttempt = fallbackAttempt;
              if (!s || !s.tracks || s.tracks.length === 0) {
                return await message.channel.send({
                  embeds: [new EmbedBuilder()
                    .setColor(message.client?.embedColor || '#ff0051')
                    .setDescription(describeSearchFailure(lastSearchAttempt, "Failed to load Spotify content from the enabled Lavalink sources. Please try again."))]
                }).catch(() => {});
              }
            } catch (fallbackErr) {
              client.logger?.log(`All fallback searches failed: ${fallbackErr.message}`, 'error');
              return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("Failed to load Spotify content. Please try a different query.")] }).catch(() => {});
            }
          }
        } catch (searchErr) {
          client.logger?.log(`Spotify URL overall fallback error: ${searchErr.message}`, 'error');
          return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("Failed to load Spotify content. Please try a different query.")] }).catch(() => {});
        }
      }
    } else {
      const searchAttempt = await musicCore.searchWithAvailableSources({
        player,
        queryText: query,
        requester: message.member.user,
        preferredSources: SEARCH_SOURCE_ORDER,
        timeoutMs: USER_SEARCH_TIMEOUT_MS,
        logPrefix: 'Search',
      });
      s = searchAttempt.result;
      lastSearchAttempt = searchAttempt;
    }

    const { getQueueArray, queueTracksForPlayback } = client.core.queue;
    try {
      if (s) {
        const summary = {
          loadType: s.loadType,
          tracksLength: Array.isArray(s.tracks) ? s.tracks.length : 0,
          sampleUris: (Array.isArray(s.tracks) ? s.tracks.slice(0,5).map(t => (t?.info?.uri || t?.uri || '').toString()) : []),
          playlistName: s.playlist?.name || null
        };
      }
    } catch (e) {}
    // Normalize loadType values from different lavalink responses (some nodes
    // return lowercase or different tokens). Map common variants to the
    // canonical values expected elsewhere in the code.
    try {
      if (s && s.loadType && typeof s.loadType === 'string') {
        const lt = s.loadType.trim().toUpperCase();
        if (lt === 'PLAYLIST' || lt === 'PLAYLIST_LOADED' || lt === 'PLAYLISTS') s.loadType = 'PLAYLIST_LOADED';
        else if (lt === 'TRACK' || lt === 'TRACK_LOADED') s.loadType = 'TRACK_LOADED';
        else if (lt === 'SEARCH' || lt === 'SEARCH_RESULT' || lt === 'SEARCHRESULT') s.loadType = 'SEARCH_RESULT';
        else if (lt === 'NO_MATCHES' || lt === 'NOMATCHES' || lt === 'NO_MATCH') s.loadType = 'NO_MATCHES';
        else s.loadType = lt;
      }
    } catch (e) {}
    if (!s || !s.tracks || s.tracks.length === 0) {
      if (player && getQueueArray(player).length === 0) {
        await player.destroy().catch(() => {});
      }
      return await message.channel.send({
        embeds: [new EmbedBuilder()
          .setColor(message.client?.embedColor || '#ff0051')
          .setDescription(describeSearchFailure(lastSearchAttempt, 'No results found across the enabled Lavalink sources. Try a different query.'))]
      }).catch(() => {});
    }

    // Validate search result
    if (!s || !s.tracks) {
      if (player && getQueueArray(player).length === 0) {
        await player.destroy().catch(() => {});
      }
      return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("*The search is not found . Try a different song.*")] }).catch(() => {});
    }

    // Filter out YouTube tracks
    if (s.tracks && Array.isArray(s.tracks)) {
        s.tracks = s.tracks.filter(track => {
            const uri = track.info?.uri || track.uri || '';
            return !uri.toLowerCase().includes('youtube.com') && !uri.toLowerCase().includes('youtu.be');
        });
        if ((s.loadType === "SEARCH_RESULT" || s.loadType === "TRACK_LOADED") && s.tracks.length === 0) s.loadType = "NO_MATCHES";
        if (s.loadType === "PLAYLIST_LOADED" && s.tracks.length === 0) s.loadType = "NO_MATCHES";
    }

    if (s.loadType === "LOAD_FAILED" || s.loadType === "NO_MATCHES" || !s.tracks || s.tracks.length === 0) {
        if (player && getQueueArray(player).length === 0) {
          await player.destroy().catch(() => {});
        }
        return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("*The search yielded no echoes. Try a different query.*")] }).catch(() => {});
    }

        // reuse getQueueArray declared earlier in this function

        if (s.loadType === "PLAYLIST_LOADED" && s.playlist) {
            // playlist handling
            // Add each track individually to the queue, skip duplicates by identifier
            const existing = getQueueArray(player).map(t => t?.info?.identifier || t?.identifier || t?.id || t?.uri).filter(Boolean);
            const toAdd = [];
            for (const track of s.tracks) {
              const id = track?.info?.identifier || track?.identifier || track?.id || track?.uri;
              if (id && existing.includes(id)) continue;
              toAdd.push(track);
              if (id) existing.push(id);
            }
            if (!toAdd.length) {
              return await message.channel.send({
                embeds: [new EmbedBuilder()
                  .setColor(message.client?.embedColor || '#ff0051')
                  .setDescription("Those playlist tracks are already in the queue.")]
              }).catch(() => {});
            }
            try {
              const qarr = getQueueArray(player) || [];
              const qsample = (qarr || []).slice(0,5).map(x => (x?.info?.uri || x?.uri || x?.title || '')).join(',');
            } catch (e) {}
        // Suppress immediate TrackStart messages briefly so queued message orders first
        try { player.set('suppressUntil', Date.now() + 2000); } catch (e) {}
        const playlistName = s.playlist?.name || 'Unknown';
        const playlistUrl = (typeof query === 'string' && query.match(/^https?:\/\//i)) ? query : (s.playlist?.info?.uri || s.playlist?.url || '');
        const tick = EMOJIS.ok || "OK";
        const userLabel = message.member.toString();
        const embed = new EmbedBuilder()
          .setColor(message.client?.embedColor || '#ff0051')
          .setDescription(`${tick} Added ${s.tracks.length} songs to the queue - ${userLabel}`)
        const playlistMsg = await message.channel.send({ embeds: [embed] }).catch(() => {});

        // Start playback after the queued message is sent so TrackStart embed
        // always follows the queue notification.
        try {
          const playbackResult = await queueTracksForPlayback(
            player,
            toAdd,
            (directTrack) => musicCore.ensurePlayerPlayback({
              player,
              guild: message.guild,
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
          client.logger?.log(`Failed to queue playlist in guild ${message.guild.id}: ${(e && (e.message || e))}`,'error');
          return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("Failed to queue playlist. Please try again.")] }).catch(() => {});
        }
        try { player.set('suppressUntil', Date.now()); } catch (e) {}
        return playlistMsg;
    } else if (s.tracks && s.tracks[0]) {
        // Add the track to the queue (avoid duplicates)
        const existing = getQueueArray(player).map(t => t?.info?.identifier || t?.identifier || t?.id || t?.uri).filter(Boolean);
        const newTrack = s.tracks[0];
        const newId = newTrack?.info?.identifier || newTrack?.identifier || newTrack?.id || newTrack?.uri;
        const shouldQueueTrack = !newId || !existing.includes(newId);
        if (shouldQueueTrack && newId) existing.push(newId);
        if (!shouldQueueTrack) {
          return await message.channel.send({
            embeds: [new EmbedBuilder()
              .setColor(message.client?.embedColor || '#ff0051')
              .setDescription("That track is already in the queue.")]
          }).catch(() => {});
        }

        const queuedTracksBefore = Array.isArray(player?.queue?.tracks) ? player.queue.tracks.length : 0;
        const hadExistingPlayback = Boolean(player?.queue?.current || player?.playing || player?.paused);
        const queuePosition = queuedTracksBefore + 1;
        const shouldShowQueuedState = hadExistingPlayback || queuedTracksBefore > 0;
        const queuedTrackTitle = client.core.queue.formatQueueTrackTitle(newTrack, 75);
        const queuedTrackLength = client.core.queue.formatTrackLength(newTrack);
        const queuedTrackEmbed = new EmbedBuilder()
          .setColor(message.client?.embedColor || '#ff0051')
          .setAuthor({
            name: shouldShowQueuedState ? `Track queued - Position #${queuePosition}` : "Now playing",
            iconURL: message.member.displayAvatarURL({ forceStatic: false, size: 256 }),
          })
          .setDescription(
            shouldShowQueuedState
              ? `Added ${queuedTrackTitle} \`${queuedTrackLength}\` to the queue`
              : `Started ${queuedTrackTitle} \`${queuedTrackLength}\``
          );

        let queuedMsg = null;
        if (shouldShowQueuedState) {
          // Suppress immediate TrackStart messages briefly so queued message orders first
          try { player.set('suppressUntil', Date.now() + 2000); } catch (e) {}
          queuedMsg = await message.channel.send({ embeds: [queuedTrackEmbed] }).catch(() => {});
        }

        // Start playback after queued message is sent
        if (shouldQueueTrack) {
          try {
            const playbackResult = await queueTracksForPlayback(
              player,
              newTrack,
              (directTrack) => musicCore.ensurePlayerPlayback({
                player,
                guild: message.guild,
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
            client.logger?.log(`Failed to play single track in guild ${message.guild.id}: ${(e && (e.message || e))}`,'error');
            try { player.set('suppressUntil', Date.now()); } catch (ee) {}
            return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("Failed to start playback. Please try again.")] }).catch(() => {});
          }
        }
        try { player.set('suppressUntil', Date.now()); } catch (e) {}
        if (!queuedMsg) {
          queuedMsg = await message.channel.send({ embeds: [queuedTrackEmbed] }).catch(() => {});
        }
        return queuedMsg;
    }
  }
};

