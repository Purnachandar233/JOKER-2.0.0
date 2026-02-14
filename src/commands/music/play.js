const { EmbedBuilder } = require('discord.js');
const track = require('../../schema/trackinfoSchema.js');
// Use spotify-url-info (no axios dependency)
const fetch = require('isomorphic-unfetch');
const { getPreview, getTracks } = require('spotify-url-info')(fetch);
const { withTimeout } = require('../../utils/promiseHandler.js');

// Common URL shorteners that may redirect to YouTube
const URL_SHORTENERS = /bit\.ly|tinyurl\.com|ow\.ly|short\.link|youtu\.be|buff\.ly|tiny\.cc|goo\.gl|t\.co/i;
const safePlayer = require('../../utils/safePlayer');

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

    // Defer connecting until playback starts to ensure queue message posts first.
    // Connection will be attempted inside `attemptPlay` when needed.

    let s;
    // Helper: robustly start playback with atomic queue operations.
    // Avoids race conditions by using the track data directly instead of polling
    const attemptPlay = async (player, searchResult, preferTrack) => {
      try {
        // Ensure player is connected right before trying to play
        if (player.state !== "CONNECTED") {
          try {
            await safePlayer.safeCall(player, 'connect');
            await new Promise(resolve => setTimeout(resolve, 400));
          } catch (connectErr) {
            client.logger?.log && client.logger.log(`Player connection failed during play attempt: ${connectErr && (connectErr.message || connectErr)}`,'error');
            return false;
          }
        }

        // Use direct track data instead of polling queue (atomic operation)
        // This prevents race conditions where queue changes between check and play
        const trackToPlay = preferTrack || (searchResult?.tracks?.[0]);
        
        if (!trackToPlay) {
          // No preferred track - try queue polling as fallback (slower but safer)
          for (let i = 0; i < 3; i++) {
            try {
              if (safePlayer.queueSize(player) > 0) {
                return await safePlayer.safeCall(player, 'play');
              }
            } catch (e) {}
            await new Promise(r => setTimeout(r, 150));
          }
          return false;
        }

        // Use direct track encoding/URI to avoid queue race condition
        const trackStr = trackToPlay.track || trackToPlay.encoded || 
                         trackToPlay?.info?.identifier || trackToPlay?.id || 
                         trackToPlay?.uri || trackToPlay;
        
        try {
          return await safePlayer.safeCall(player, 'play', trackStr);
        } catch (e) {
          client.logger?.log && client.logger.log(`attemptPlay play call failed: ${e && (e.message || e)}`,'warn');
          return false;
        }
      } catch (err) {
        client.logger?.log && client.logger.log(`attemptPlay error: ${err && (err.message || err)}`,'error');
        return false;
      }
    };
    if (query.match(/https?:\/\/(open\.spotify\.com|spotify\.link)/)) {
      // Try direct URL loading first (works for playlists and tracks)
      try {
        const directLoadPromise = player.search(query, message.member.user);
        s = await withTimeout(directLoadPromise, 10000, 'Direct Spotify load timeout');
      } catch (directErr) {
        client.logger?.log(`Direct Spotify URL load failed: ${directErr.message}, trying search...`, 'warn');
        // Fallback: try to get playlist tracks via getTracks(), then search each track.
        try {
          let searchQuery = null;
          // try getTracks (best for playlists)
          try {
            const tracksInfo = await getTracks(query).catch(() => null);
            if (tracksInfo && Array.isArray(tracksInfo) && tracksInfo.length) {
              const limit = Math.min(tracksInfo.length, 50);
              const sources = ['spotify', 'soundcloud', 'bandcamp', 'deezer', 'applemusic'];
              const searchOne = async (q) => {
                for (const source of sources) {
                  try {
                    const p = player.search({ query: q, source }, message.member.user);
                    const res = await withTimeout(p, 8000, 'track search timeout');
                    if (res && res.tracks && res.tracks.length) return res.tracks[0];
                  } catch (e) { continue; }
                }
                // final attempt without specifying source
                try {
                  const p = player.search({ query: q }, message.member.user);
                  const res = await withTimeout(p, 8000, 'track search timeout');
                  if (res && res.tracks && res.tracks.length) return res.tracks[0];
                } catch (e) {}
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
                const searchPromise = player.search({ query: searchQuery, source: 'spotify' }, message.member.user);
                s = await withTimeout(searchPromise, 10000, 'Spotify search timeout');
              }
            } catch (searchErr) {
              client.logger?.log(`Spotify URL search error: ${searchErr.message}`, 'error');
            }
          }

          // If still no results, try other sources using either searchQuery or raw query
          if (!s || !s.tracks || s.tracks.length === 0) {
            try {
              const sources = ['spotify', 'soundcloud', 'bandcamp', 'deezer', 'applemusic'];
              const fallbackQuery = searchQuery || query;
              for (const source of sources) {
                try {
                  const fallbackSearchPromise = player.search({ query: fallbackQuery, source }, message.member.user);
                  s = await withTimeout(fallbackSearchPromise, 8000, `${source} fallback search timeout`);
                  if (s && s.tracks && s.tracks.length > 0) break;
                } catch (fallbackErr) {
                  client.logger?.log(`Fallback search failed for ${source}: ${fallbackErr.message}`, 'warn');
                  continue;
                }
              }
              if (!s || !s.tracks || s.tracks.length === 0) {
                return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("Failed to load Spotify content from alternative sources. Please try a different query.")] }).catch(() => {});
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
      // Try multiple sources for regular searches
      const sources = [ 'spotify','soundcloud','applemusic','deezer','bandcamp' ];
      for (const source of sources) {
        try {
          const searchPromise = player.search({ query, source }, message.member.user);
          s = await withTimeout(searchPromise, 8000, `${source} search timeout`);
          if (s && s.tracks && s.tracks.length > 0) break;
        } catch (err) {
          client.logger?.log(`Search failed for ${source}: ${err.message}`, 'warn');
          continue;
        }
      }
    }

    const { getQueueArray } = require('../../utils/queue.js');
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
        await safePlayer.safeDestroy(player);
      }
      return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription('No results found across all sources. Try a different query.')] }).catch(() => {});
    }

    // Validate search result
    if (!s || !s.tracks) {
      if (player && getQueueArray(player).length === 0) {
        await safePlayer.safeDestroy(player);
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
          await safePlayer.safeDestroy(player);
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
            safePlayer.queueAdd(player, toAdd);
            try {
              const qarr = getQueueArray(player) || [];
              const qsample = (qarr || []).slice(0,5).map(x => (x?.info?.uri || x?.uri || x?.title || '')).join(',');
            } catch (e) {}
        // Suppress immediate TrackStart messages briefly so queued message orders first
        try { player.set('suppressUntil', Date.now() + 2000); } catch (e) {}
        const playlistName = s.playlist?.name || 'Unknown';
        const playlistUrl = (typeof query === 'string' && query.match(/^https?:\/\//i)) ? query : (s.playlist?.info?.uri || s.playlist?.url || '');
        const tick = (client.emoji && client.emoji.ok) ? client.emoji.ok : '✅';
        const userLabel = message.member.toString();
        const embed = new EmbedBuilder()
          .setColor(message.client?.embedColor || '#ff0051')
          .setDescription(`${tick} Added ${s.tracks.length} songs to the queue - ${userLabel}`)
        const playlistMsg = await message.channel.send({ embeds: [embed] }).catch(() => {});

        // Start playback after the queued message is sent so TrackStart embed
        // always follows the queue notification.
        if (!player.playing && !player.paused) {
          try {
            const ok = await attemptPlay(player, s);
            if (!ok) throw new Error('no-track-started');
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
        if (!newId || !existing.includes(newId)) {
          safePlayer.queueAdd(player, newTrack);
          existing.push(newId);
        }

        // Suppress immediate TrackStart messages briefly so queued message orders first
        try { player.set('suppressUntil', Date.now() + 2000); } catch (e) {}

        const trackTitle = s.tracks[0].info?.title || s.tracks[0].title || 'Unknown';
        const trackUri = s.tracks[0].info?.uri || s.tracks[0].uri || '';
        const queuedMsg = await message.channel.send({
          embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription(`Queued [${trackTitle}](${trackUri})\n Requested by: \`${message.member.user.tag}\``)]
        }).catch(() => {});

        // Start playback after queued message is sent
        if (!player.playing && !player.paused) {
          try {
            const ok = await attemptPlay(player, s, s.tracks && s.tracks[0]);
            if (!ok) throw new Error('no-track-started');
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

