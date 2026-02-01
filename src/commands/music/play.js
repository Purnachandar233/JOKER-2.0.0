const { EmbedBuilder } = require('discord.js');
const track = require('../../schema/trackinfoSchema.js');
// Use spotify-url-info (no axios dependency)
const fetch = require('isomorphic-unfetch');
const { getPreview, getTracks } = require('spotify-url-info')(fetch);

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
        .setDescription(`We no longer support YouTube, please use other platforms like Spotify, SoundCloud or Bandcamp.`);
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

    // Ensure player is connected before proceeding
    if (player.state !== "CONNECTED") {
      try {
        await safePlayer.safeCall(player, 'connect');
        // Wait a bit for connection to establish
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        client.logger?.log(`Player connection failed: ${error.message}`, 'error');
        return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("Failed to connect to voice channel. Please try again.")] }).catch(() => {});
      }
    }

    let s;
    if (query.match(/https?:\/\/(open\.spotify\.com|spotify\.link)/)) {
      // Try direct URL loading first (works for playlists and tracks)
      try {
        const directLoadPromise = player.search(query, message.member.user);
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
          const searchPromise = player.search({ query: searchQuery, source: 'spotify' }, message.member.user);
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
                const fallbackSearchPromise = player.search({ query: searchQuery, source }, message.member.user);
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
              return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("Failed to load Spotify content from alternative sources. Please try a different query.")] }).catch(() => {});
            }
          } catch (fallbackErr) {
            client.logger?.log(`All fallback searches failed: ${fallbackErr.message}`, 'error');
            return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("Failed to load Spotify content. Please try a different query.")] }).catch(() => {});
          }
        }
      }
    } else {
      // Try multiple sources for regular searches
      const sources = ['soundcloud', 'spotify', 'bandcamp', 'deezer'];
      for (const source of sources) {
        try {
          const searchPromise = player.search({ query, source }, message.member.user);
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

    const { getQueueArray } = require('../../utils/queue.js');
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
            if (player.queue) {
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
            }
        // Suppress immediate TrackStart messages briefly so queued message orders first
        try { player.set('suppressUntil', Date.now() + 1200); } catch (e) {}
        if (!player.playing && !player.paused) {
          try {
            await safePlayer.safeCall(player, 'play');
          } catch (e) {
            client.logger?.log(`Failed to play playlist track in guild ${message.guild.id}: ${e.message}`, 'error');
            return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("Failed to start playback. Please try again.")] }).catch(() => {});
          }
        }
        const playlistMsg = await message.channel.send({
          embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setTitle("Playlist Entrusted").setDescription(`┕ Added **${s.tracks.length}** tracks from **${s.playlist.name || 'Unknown'}**`).setFooter({ text: "Classic Aesthetic • Joker Music" })]
        }).catch(() => {});
        try { player.set('suppressUntil', Date.now()); } catch (e) {}
        return playlistMsg;
    } else if (s.tracks && s.tracks[0]) {
        if (player.queue) {
          // avoid adding duplicate of same identifier
          const existing = getQueueArray(player).map(t => t?.info?.identifier || t?.identifier || t?.id || t?.uri).filter(Boolean);
          const newTrack = s.tracks[0];
          const newId = newTrack?.info?.identifier || newTrack?.identifier || newTrack?.id || newTrack?.uri;
          if (!newId || !existing.includes(newId)) {
            safePlayer.queueAdd(player, newTrack);
            existing.push(newId);
          }
        }
        // current track will be served from the normalized queue when playback starts
        // Suppress immediate TrackStart messages briefly so queued message orders first
        try { player.set('suppressUntil', Date.now() + 1200); } catch (e) {}
        if (!player.playing && !player.paused) {
          try {
            await safePlayer.safeCall(player, 'play');
          } catch (e) {
            client.logger?.log(`Failed to play single track in guild ${message.guild.id}: ${e.message}`, 'error');
            return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("Failed to start playback. Please try again.")] }).catch(() => {});
          }
        }
        const trackTitle = s.tracks[0].info?.title || s.tracks[0].title || 'Unknown';
        const trackUri = s.tracks[0].info?.uri || s.tracks[0].uri || '';
        const queuedMsg = await message.channel.send({
          embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription(`Queued [${trackTitle}](${trackUri})\n Requested by: \`${message.member.user.tag}\``)]
        }).catch(() => {});
        try { player.set('suppressUntil', Date.now()); } catch (e) {}
        return queuedMsg;
    }
  }
};

