const { EmbedBuilder } = require('discord.js');
const track = require('../../schema/trackinfoSchema.js');
const EMOJIS = require("../../utils/emoji.json");
// Use spotify-url-info (no axios dependency)
const fetch = require('isomorphic-unfetch');
const { getPreview, getTracks } = require('spotify-url-info')(fetch);
const { withTimeout } = require('../../utils/promiseHandler.js');

// Common URL shorteners that may redirect to YouTube
const URL_SHORTENERS = /bit\.ly|tinyurl\.com|ow\.ly|short\.link|youtu\.be|buff\.ly|tiny\.cc|goo\.gl|t\.co/i;
const SEARCH_SOURCE_ORDER = ['spotify', 'soundcloud', 'applemusic', 'deezer', 'bandcamp'];
const USER_SEARCH_SOURCE_ATTEMPTS = 3;
const USER_SEARCH_TIMEOUT_MS = 5000;
const USER_FALLBACK_SEARCH_TIMEOUT_MS = 4500;
const SPOTIFY_DIRECT_LOAD_TIMEOUT_MS = 7000;
const SPOTIFY_PLAYLIST_FALLBACK_TRACK_LIMIT = 12;

function normalizeSourceName(source) {
  const value = String(source || '').trim().toLowerCase();
  if (!value) return null;

  if (['spotify', 'spsearch', 'sp'].includes(value)) return 'spotify';
  if (['soundcloud', 'scsearch', 'sc'].includes(value)) return 'soundcloud';
  if (['applemusic', 'apple', 'apple music', 'amsearch', 'am'].includes(value)) return 'applemusic';
  if (['deezer', 'dzsearch', 'dz', 'dzisrc'].includes(value)) return 'deezer';
  if (['bandcamp', 'bcsearch', 'bc'].includes(value)) return 'bandcamp';

  return value;
}

function uniqueSources(list) {
  return [...new Set((Array.isArray(list) ? list : [list]).map(normalizeSourceName).filter(Boolean))];
}

function orderSourcesForPlayer(player, preferredSources = SEARCH_SOURCE_ORDER) {
  const ordered = uniqueSources(preferredSources);
  const preferred = normalizeSourceName(
    typeof player?.get === 'function' ? player.get('preferredSearchSource') : null
  );

  if (!preferred || !ordered.includes(preferred)) {
    return ordered;
  }

  return [preferred, ...ordered.filter((source) => source !== preferred)];
}

function getAvailableSearchSources(client, player, preferredSources = SEARCH_SOURCE_ORDER) {
  const preferred = orderSourcesForPlayer(player, preferredSources);
  const nodes = [];

  if (player?.node) nodes.push(player.node);

  for (const node of Array.from(client?.lavalink?.nodeManager?.nodes?.values?.() || [])) {
    if (!nodes.includes(node)) nodes.push(node);
  }

  const advertisedSources = new Set();
  let hasNodeInfo = false;

  for (const node of nodes) {
    if (!Array.isArray(node?.info?.sourceManagers)) continue;
    hasNodeInfo = true;

    for (const source of node.info.sourceManagers) {
      const normalized = normalizeSourceName(source);
      if (normalized) advertisedSources.add(normalized);
    }
  }

  return {
    sources: hasNodeInfo ? preferred.filter((source) => advertisedSources.has(source)) : preferred,
    advertisedSources: [...advertisedSources],
    hasNodeInfo,
  };
}

function formatSourceList(sources) {
  return Array.isArray(sources) && sources.length ? sources.join(', ') : 'none';
}

function isTimeoutLikeError(error) {
  return /timeout|timed out|aborted/i.test(String(error?.message || error || ''));
}

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
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitForVoiceBridge = async (expectedChannelId) => {
      const startedAt = Date.now();
      while ((Date.now() - startedAt) < 10000) {
        const botChannelId = message.guild.members.me?.voice?.channelId || null;
        const hasVoiceBridge = Boolean(
          player?.voice?.sessionId &&
          player?.voice?.token &&
          player?.voice?.endpoint
        );

        if (botChannelId === expectedChannelId && hasVoiceBridge) {
          return true;
        }

        await sleep(200);
      }

      return false;
    };

    const queueTracksNative = async (tracks) => {
      const incoming = (Array.isArray(tracks) ? tracks : [tracks]).filter(Boolean);
      if (!incoming.length) return;

      if (typeof player.queue?.add === 'function') {
        await player.queue.add(incoming);
        return;
      }

      if (!Array.isArray(player.queue?.tracks)) {
        player.queue.tracks = [];
      }
      player.queue.tracks.push(...incoming);
    };
    const hasActivePlayback = () => (
      Boolean(player?.queue?.current) ||
      Boolean(player?.playing) ||
      Boolean(player?.paused) ||
      (Array.isArray(player?.queue?.tracks) && player.queue.tracks.length > 0)
    );
    const searchWithAvailableSources = async (
      queryText,
      requester,
      {
        preferredSources = SEARCH_SOURCE_ORDER,
        timeoutMs = USER_SEARCH_TIMEOUT_MS,
        logPrefix = 'Search',
        maxSourceAttempts = USER_SEARCH_SOURCE_ATTEMPTS,
      } = {}
    ) => {
      const availability = getAvailableSearchSources(client, player, preferredSources);
      const attemptedSources = availability.sources.slice(0, Math.max(1, Number(maxSourceAttempts) || USER_SEARCH_SOURCE_ATTEMPTS));
      let lastError = null;

      if (!attemptedSources.length) {
        return {
          result: null,
          attemptedSources,
          advertisedSources: availability.advertisedSources,
          hasNodeInfo: availability.hasNodeInfo,
          lastError: new Error(
            availability.hasNodeInfo
              ? `No supported search sources are enabled on this Lavalink node. Available sources: ${formatSourceList(availability.advertisedSources)}`
              : 'No searchable sources are available yet.'
          ),
        };
      }

      for (const source of attemptedSources) {
        try {
          const result = await withTimeout(
            player.search({ query: queryText, source }, requester),
            timeoutMs,
            `${source} search timeout`
          );

          if (result?.loadType === 'LOAD_FAILED') {
            throw result.exception || new Error(`${source} search failed`);
          }

          if (result?.tracks?.length) {
            if (typeof player?.set === 'function') {
              player.set('preferredSearchSource', source);
            }
            return {
              result,
              attemptedSources,
              advertisedSources: availability.advertisedSources,
              hasNodeInfo: availability.hasNodeInfo,
              lastError: null,
            };
          }
        } catch (error) {
          lastError = error;
          if (!/has not '.*' enabled|has not .* enabled|required to have|Query \/ Link Provided for this Source/i.test(String(error?.message || error || ''))) {
            client.logger?.log(`${logPrefix} failed for ${source}: ${error?.message || error}`, 'warn');
          }
        }
      }

      return {
        result: null,
        attemptedSources,
        advertisedSources: availability.advertisedSources,
        hasNodeInfo: availability.hasNodeInfo,
        lastError,
      };
    };

    const attemptPlay = async (player) => {
      try {
        if (player.state !== "CONNECTED" || message.guild.members.me?.voice?.channelId !== channel.id) {
          try {
            await player.connect();
          } catch (connectErr) {
            client.logger?.log && client.logger.log(`Player connection failed during play attempt: ${connectErr && (connectErr.message || connectErr)}`,'error');
            return false;
          }
        }

        const voiceReady = await waitForVoiceBridge(channel.id);
        if (!voiceReady) return false;

        // Auto-recover from accidental silent volume (0) so playback is audible.
        try {
          const currentVolume = Number(player.volume ?? player?.options?.volume ?? 100);
          if (Number.isFinite(currentVolume) && currentVolume <= 0) {
            await player.setVolume(100);
          }
        } catch (_e) {}

        await player.play({ paused: false });
        return true;
      } catch (err) {
        client.logger?.log && client.logger.log(`attemptPlay error: ${err && (err.message || err)}`,'error');
        return false;
      }
    };
    const titleCase = (value) => {
      const text = String(value || '').trim();
      return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Search';
    };
    const describeSearchFailure = (attempt, fallbackMessage) => {
      if (!attempt) return fallbackMessage;

      if (attempt.hasNodeInfo && attempt.attemptedSources.length === 0) {
        return `No supported search sources are enabled on this Lavalink node. Available sources: ${formatSourceList(attempt.advertisedSources)}.`;
      }

      if (attempt.lastError && isTimeoutLikeError(attempt.lastError)) {
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
                const attempt = await searchWithAvailableSources(q, message.member.user, {
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
                const spotifyPreferred = getAvailableSearchSources(client, player, ['spotify']).sources.length
                  ? ['spotify']
                  : SEARCH_SOURCE_ORDER;
                const searchAttempt = await searchWithAvailableSources(searchQuery, message.member.user, {
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
              const fallbackAttempt = await searchWithAvailableSources(fallbackQuery, message.member.user, {
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
      const searchAttempt = await searchWithAvailableSources(query, message.member.user, {
        preferredSources: SEARCH_SOURCE_ORDER,
        timeoutMs: USER_SEARCH_TIMEOUT_MS,
        logPrefix: 'Search',
      });
      s = searchAttempt.result;
      lastSearchAttempt = searchAttempt;
    }

    const { getQueueArray } = client.core.queue;
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
            try {
              const qarr = getQueueArray(player) || [];
              const qsample = (qarr || []).slice(0,5).map(x => (x?.info?.uri || x?.uri || x?.title || '')).join(',');
            } catch (e) {}
        // Suppress immediate TrackStart messages briefly so queued message orders first
        try { player.set('suppressUntil', Date.now() + 2000); } catch (e) {}
        const playlistName = s.playlist?.name || 'Unknown';
        const playlistUrl = (typeof query === 'string' && query.match(/^https?:\/\//i)) ? query : (s.playlist?.info?.uri || s.playlist?.url || '');
        const tick = EMOJIS.ok || "✅";
        const userLabel = message.member.toString();
        const embed = new EmbedBuilder()
          .setColor(message.client?.embedColor || '#ff0051')
          .setDescription(`${tick} Added ${s.tracks.length} songs to the queue - ${userLabel}`)
        const playlistMsg = await message.channel.send({ embeds: [embed] }).catch(() => {});

        // Start playback after the queued message is sent so TrackStart embed
        // always follows the queue notification.
        const hadActivePlayback = hasActivePlayback();
        try {
          await queueTracksNative(toAdd);
        } catch (e) {
          client.logger?.log(`Failed to queue playlist in guild ${message.guild.id}: ${(e && (e.message || e))}`,'error');
          return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("Failed to queue playlist. Please try again.")] }).catch(() => {});
        }

        if (!hadActivePlayback) {
          try {
            const ok = await attemptPlay(player);
            if (ok === false) throw new Error('no-track-started');
          } catch (e) {
            client.logger?.log(`Failed to play playlist track in guild ${message.guild.id}: ${(e && (e.message || e))}`,'error');
            try { player.set('suppressUntil', Date.now()); } catch (ee) {}
            return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("Failed to start playback. Please try again.")] }).catch(() => {});
          }
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

        // Suppress immediate TrackStart messages briefly so queued message orders first
        try { player.set('suppressUntil', Date.now() + 2000); } catch (e) {}

        const trackTitle = s.tracks[0].info?.title || s.tracks[0].title || 'Unknown';
        const trackUri = s.tracks[0].info?.uri || s.tracks[0].uri || '';
        const queuedMsg = await message.channel.send({
          embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setAuthor({name:`Track Queued `,iconURL: client.user.displayAvatarURL()
          }).setDescription(`**Added**[${trackTitle}](${trackUri})\n Requested by: \`${message.member.user.tag}\``)]
        }).catch(() => {});

        // Start playback after queued message is sent
        if (shouldQueueTrack) {
          const hadActivePlayback = hasActivePlayback();
          try {
            await queueTracksNative(newTrack);
            if (!hadActivePlayback) {
              const ok = await attemptPlay(player);
              if (ok === false) throw new Error('no-track-started');
            }
          } catch (e) {
            client.logger?.log(`Failed to play single track in guild ${message.guild.id}: ${(e && (e.message || e))}`,'error');
            try { player.set('suppressUntil', Date.now()); } catch (ee) {}
            return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("Failed to start playback. Please try again.")] }).catch(() => {});
          }
        }
        try { player.set('suppressUntil', Date.now()); } catch (e) {}
        return queuedMsg;
    }
  }
};

