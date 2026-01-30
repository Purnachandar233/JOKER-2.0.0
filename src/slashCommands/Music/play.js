const { CommandInteraction, Client, EmbedBuilder, ApplicationCommandType } = require("discord.js");
const track = require('../../schema/trackinfoSchema.js')
const spotify = require("@ksolo/spotify-search");
const clientID = "657b7bbaf31d4b36b32946981de59ef7";
const secretKey = "97524c7edc7746e29f36f602e2d25b85";
 spotify.setCredentials(clientID, secretKey);
 const fetch = require('isomorphic-unfetch');

const { getData, getPreview, getTracks, getDetails } = require('spotify-url-info')(fetch)
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
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    
    const query = interaction.options.getString("query");
    if (!query) return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xff0051).setDescription("Please provide a search input to search.")] }).catch(() => {});

    const { channel } = interaction.member.voice;
    if (!channel) {
      const noperms = new EmbedBuilder().setColor(0xff0000).setDescription(`You must be connected to a voice channel to use this command.`);
      return await interaction.editReply({ embeds: [noperms] });
    }

    if (interaction.member.voice.selfDeaf) {
      let thing = new EmbedBuilder().setColor(0xff0000).setDescription(`You cannot run this command while deafened.`);
      return await interaction.editReply({ embeds: [thing] });
    }

    let player = client.lavalink.players.get(interaction.guildId);
    if (player && channel.id !== player.voiceChannelId) {
      const noperms = new EmbedBuilder().setColor(0xff0000).setDescription(`You must be connected to the same voice channel as me.`);
      return await interaction.editReply({ embeds: [noperms] });
    }

    if (query.toLowerCase().includes("youtube.com") || query.toLowerCase().includes("youtu.be")) {
      const noperms = new EmbedBuilder()
        .setColor(0xff0000)
        .setAuthor({ name: 'YouTube URL', iconURL: client.user.displayAvatarURL({ forceStatic: false }) })
        .setDescription(`We no longer support YouTube, please use other platforms like Spotify, SoundCloud or Bandcamp. Otherwise use a search query to use our default system.`);
      return await interaction.editReply({ embeds: [noperms] });
    }

    if (!player) player = client.lavalink.createPlayer({
      guildId: interaction.guildId,
      textChannelId: interaction.channelId,
      voiceChannelId: interaction.member.voice.channelId,
      selfDeafen: true,
    });

    try {
        if (player && player.state !== "CONNECTED") player.connect();
    } catch (e) {}

    let s;
    try {
        const searchPromise = player.search(query, interaction.member.user);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Search timeout')), 10000)
        );
        s = await Promise.race([searchPromise, timeoutPromise]);
    } catch (err) {
        if (player && !player.queue?.current) player.destroy();
        return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xff0051).setDescription('Search failed or timed out. Try again.')] }).catch(() => {});
    }

    if (!s || !s.tracks) {
        if (player && !player.queue?.current) player.destroy();
        return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xff0051).setDescription('No results found.')] }).catch(() => {});
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
        if (player && !player.queue?.current) player.destroy();
        return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xff0051).setDescription('No results found.')] }).catch(() => {});
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
        const playlistName = s.playlist?.name || 'Unknown';
        const embed = new EmbedBuilder().setColor(0xff0051).setDescription(`Queued **${s.tracks.length}** tracks from **${playlistName}**`);
        return await interaction.editReply({ embeds: [embed] }).catch(() => {});
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
        const embed = new EmbedBuilder().setColor(0xff0051).setDescription(`Queued **${trackTitle}** [\`${interaction.member.user.tag}\`]`);
        return await interaction.editReply({ embeds: [embed] }).catch(() => {});
    }
  },
};