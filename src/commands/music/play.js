const { EmbedBuilder } = require('discord.js');
const track = require('../../schema/trackinfoSchema.js');
const spotify = require("@ksolo/spotify-search");

// Load Spotify credentials from environment variables
const clientID = process.env.SPOTIFY_CLIENT_ID || "657b7bbaf31d4b36b32946981de59ef7";
const secretKey = process.env.SPOTIFY_SECRET || "97524c7edc7746e29f36f602e2d25b85";

if (!clientID || !secretKey) {
    console.warn('[WARN] Spotify credentials not properly configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_SECRET environment variables.');
}

spotify.setCredentials(clientID, secretKey);
const fetch = require('isomorphic-unfetch');
const { getPreview, getTracks } = require('spotify-url-info')(fetch);

// Common URL shorteners that may redirect to YouTube
const URL_SHORTENERS = /bit\.ly|tinyurl\.com|ow\.ly|short\.link|youtu\.be|buff\.ly|tiny\.cc|goo\.gl|t\.co/i;

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
        embeds: [new EmbedBuilder().setColor(0xff0051).setDescription("Please provide a search input.")]
      }).catch(() => { });
    }
    const { channel } = message.member.voice;
    if (!channel) {
      return await message.reply({ embeds: [new EmbedBuilder().setColor(0xff0051).setDescription("You must be in a voice channel to use this command.")] });
    }

    if (query.toLowerCase().includes("youtube.com") || query.toLowerCase().includes("youtu.be") || URL_SHORTENERS.test(query)) {
      const noperms = new EmbedBuilder()
        .setColor(0xff0051)
        .setAuthor({ name: 'YouTube URL', iconURL: client.user.displayAvatarURL({ forceStatic: false }) })
        .setDescription(`We no longer support YouTube, please use other platforms like Spotify, SoundCloud or Bandcamp.`);
      return await message.reply({ embeds: [noperms] });
    }

    if (!client.lavalink) {
      return await message.reply({ embeds: [new EmbedBuilder().setColor(0xff0051).setDescription("Lavalink is not connected yet. Please try again in a moment.")] });
    }

    let player = client.lavalink.players.get(message.guild.id);
    if (player && channel.id !== player.voiceChannelId) {
      return await message.reply({ embeds: [new EmbedBuilder().setColor(0x2f3136).setDescription("*We must be in the same voice channel to harmonize.*")] });
    }

    // Classic Aesthetic Play Logic
    if (!player) player = client.lavalink.createPlayer({
      guildId: message.guild.id,
      textChannelId: message.channelId,
      voiceChannelId: message.member.voice.channelId,
      selfDeafen: true,
    });

    if (player.state !== "CONNECTED") player.connect();

    // Modify query for search if it's not a URL
    let searchQuery = query;
    if (!query.includes('http://') && !query.includes('https://')) {
        searchQuery = `scsearch:${query}`;
    }
    
    // Add 10-second timeout to search
    const searchPromise = player.search(searchQuery, message.member.user);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Search timeout after 10 seconds')), 10000)
    );
    
    let s;
    try {
      s = await Promise.race([searchPromise, timeoutPromise]);
    } catch (err) {
      client.logger?.log(`Search error: ${err.message}`, 'error');
      return await message.channel.send({ embeds: [new EmbedBuilder().setColor(0xff0051).setDescription("Search failed. Please try again.")] }).catch(() => {});
    }

    // Validate search result
    if (!s || !s.tracks) {
      if (player && player.queue && !player.queue.current) {
        try { player.destroy(); } catch (e) {}
      }
      return await message.channel.send({ embeds: [new EmbedBuilder().setColor(0x2f3136).setDescription("*The search yielded no echoes. Try a different query.*")] }).catch(() => {});
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
        if (player && player.queue && !player.queue.current) {
          try { player.destroy(); } catch (e) {}
        }
        return await message.channel.send({ embeds: [new EmbedBuilder().setColor(0x2f3136).setDescription("*The search yielded no echoes. Try a different query.*")] }).catch(() => {});
    }
    
    if (s.loadType === "PLAYLIST_LOADED" && s.playlist) {
        if (player.queue && typeof player.queue.add === 'function') {
          player.queue.add(s.tracks);
        }
        if (!player.queue?.current && s.tracks[0]) {
          player.queue.current = s.tracks[0];
        }
        if (!player.playing && !player.paused) {
          try { player.play(); } catch (e) {}
        }
        return await message.channel.send({
          embeds: [new EmbedBuilder().setColor(0x2f3136).setTitle("Playlist Entrusted").setDescription(`┕ Added **${s.tracks.length}** tracks from **${s.playlist.name || 'Unknown'}**`).setFooter({ text: "Classic Aesthetic • Joker Music" })]
        }).catch(() => {});
    } else if (s.tracks && s.tracks[0]) {
        if (player.queue && typeof player.queue.add === 'function') {
          player.queue.add(s.tracks[0]);
        }
        if (!player.queue?.current) {
          player.queue.current = s.tracks[0];
        }
        if (!player.playing && !player.paused) {
          try { player.play(); } catch (e) {}
        }
        const trackTitle = s.tracks[0].info?.title || s.tracks[0].title || 'Unknown';
        const trackUri = s.tracks[0].info?.uri || s.tracks[0].uri || '';
        return await message.channel.send({
          embeds: [new EmbedBuilder().setColor(0x2f3136).setDescription(`Queued [${trackTitle}](${trackUri})\n Requested by: \`${message.member.user.tag}\``)]
        }).catch(() => {});
    }
  }
}
