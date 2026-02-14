/**
 * PLAY COMMAND - REFACTORED EXAMPLE
 * 
 * Shows how to integrate all 11 services into a real command
 * This is the recommended pattern for all music/fun/admin commands
 */

const { EmbedBuilder, ApplicationCommandType } = require("discord.js");
const safeReply = require('../../utils/safeReply');
const musicChecks = require('../../utils/musicChecks');
const fetch = require('isomorphic-unfetch');
const { getData, getPreview, getTracks, getDetails } = require('spotify-url-info')(fetch);

module.exports = {
  name: "play",
  description: "Play a song from Spotify, SoundCloud, or search query",
  owner: false,
  player: false,
  inVoiceChannel: true,
  sameVoiceChannel: false,
  type: ApplicationCommandType.ChatInput,
  
  options: [
    {
      name: "query",
      description: "Song name, artist, or URL",
      required: true,
      type: 3
    }
  ],

  // ===== REFACTORED RUN FUNCTION =====
  run: async (client, interaction) => {
    // ===== 1. WRAP ENTIRE COMMAND IN ERROR HANDLER =====
    return await client.errorHandler.executeWithErrorHandling(interaction, async (interaction) => {
      
      // Always defer reply early to prevent timeout
      await safeReply.safeDeferReply(interaction);

      // ===== 2. CHECK COOLDOWN FIRST =====
      const cooldown = client.cooldownManager.check("play", interaction.user.id);
      if (cooldown.onCooldown) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('⏱️ Cooldown Active')
          .setDescription(`Please wait **${cooldown.remaining()}ms** before using this command again.`);
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }

      // ===== 3. RUN MUSIC-SPECIFIC VALIDATION CHECKS =====
      const check = await musicChecks.runMusicChecks(client, interaction, {
        inVoiceChannel: true,
        botInVoiceChannel: false,
        sameChannel: false,
        requirePlayer: false
      });

      if (!check.valid) {
        return await safeReply.safeReply(interaction, { embeds: [check.embed] });
      }

      // ===== 4. CHECK DJ PERMISSION =====
      const isDJEnabled = await client.permissionService.canUseDJ(interaction.member, interaction.guildId);
      if (!isDJEnabled) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('❌ DJ Permission Required')
          .setDescription('You do not have permission to use music commands in this server.');
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }

      // ===== 5. GET AND VALIDATE QUERY =====
      const query = interaction.options.getString("query");
      
      if (!query || query.trim().length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setDescription('Please provide a search query or URL.');
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }

      // ===== 6. CHECK FOR YOUTUBE (BLOCKED) =====
      if (query.toLowerCase().includes("youtube.com") || query.toLowerCase().includes("youtu.be")) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setAuthor({ 
            name: 'YouTube Not Supported', 
            iconURL: client.user.displayAvatarURL({ forceStatic: false }) 
          })
          .setDescription('❌ We no longer support YouTube. Please use Spotify, SoundCloud, Bandcamp, or search by song/artist name instead.');
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }

      // ===== 7. SEARCH/LOAD TRACKS =====
      await safeReply.safeReply(interaction, { 
        content: '🔍 Searching for tracks...' 
      });

      let tracks = [];
      try {
        // Try Spotify URL first
        if (query.match(/https?:\/\/(open\.spotify\.com|spotify\.link)/)) {
          const spotifyData = await getData(query);
          if (spotifyData.type === 'playlist') {
            tracks = spotifyData.tracks.map(t => ({
              title: `${t.name} by ${t.artists.map(a => a.name).join(', ')}`,
              uri: t.external_urls.spotify,
              length: t.duration_ms,
              isPlayable: true,
              author: t.artists.map(a => a.name).join(', '),
              source: 'spotify'
            }));
          } else {
            // Single track
            tracks = [
              {
                title: `${spotifyData.name} by ${spotifyData.artist}`,
                uri: query,
                length: spotifyData.duration,
                isPlayable: true,
                author: spotifyData.artist,
                source: 'spotify'
              }
            ];
          }
        } else {
          // Search via Lavalink (supports SoundCloud, YouTube Music, etc)
          const results = await client.lavalink.search({ query }, interaction.user);
          
          if (!results || !results.tracks || results.tracks.length === 0) {
            const embed = new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle('❌ No Tracks Found')
              .setDescription(`No results found for: **${query}**`);
            return await safeReply.safeReply(interaction, { embeds: [embed] });
          }

          // Take top 5 results
          tracks = results.tracks.slice(0, 5);
        }
      } catch (error) {
        // Log the error with context
        client.logger.error('Track search failed', error, {
          query,
          user: interaction.user.id,
          guild: interaction.guildId
        });

        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('❌ Search Failed')
          .setDescription('Failed to search for tracks. Please try again.');
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }

      // ===== 8. LOAD TRACKS INTO PLAYER USING PLAYERCONTROLLER (THREAD-SAFE) =====
      const playResult = await client.playerController.playTracks(
        interaction.guildId,
        tracks,
        {
          voiceChannelId: check.channel.id,
          textChannelId: interaction.channelId
        }
      );

      if (!playResult.success) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('❌ Playback Failed')
          .setDescription(playResult.error || 'Failed to load tracks.');
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }

      // ===== 9. SEND SUCCESS RESPONSE =====
      const currentTrack = playResult.currentTrack;
      const queueLength = playResult.queueLength || 0;

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('▶️ Now Playing')
        .addFields(
          { 
            name: 'Track', 
            value: `**${currentTrack?.title || 'Unknown'}**`, 
            inline: false 
          },
          { 
            name: 'Author', 
            value: currentTrack?.author || 'Unknown', 
            inline: true 
          },
          { 
            name: 'Queue Size', 
            value: `${queueLength} track${queueLength !== 1 ? 's' : ''}`, 
            inline: true 
          }
        )
        .setTimestamp();

      await safeReply.safeReply(interaction, { embeds: [embed] });

      // ===== 10. SET COOLDOWN AFTER SUCCESSFUL EXECUTION =====
      client.cooldownManager.set("play", interaction.user.id, 2000); // 2 second cooldown

      // ===== 11. LOG THE COMMAND EXECUTION =====
      client.logger.logCommand('play', interaction.user.id, interaction.guildId, Date.now() - interaction.createdTimestamp, true);
    });
  }
};

/**
 * PATTERN SUMMARY
 * 
 * 1. CommandErrorHandler.executeWithErrorHandling() - Wrap everything
 * 2. SafeReply.safeDeferReply() - Always defer early
 * 3. CooldownManager.check() - Prevent spam
 * 4. MusicChecks.runMusicChecks() - Reusable validation
 * 5. PermissionService.canUseDJ() - Check perms
 * 6. Get user input and validate
 * 7. Search/load tracks with error handling
 * 8. PlayerController.playTracks() - NEVER direct player access!
 * 9. Send user-facing embed response
 * 10. CooldownManager.set() - After success
 * 11. Logger.logCommand() - Audit trail
 * 
 * Result: Crash-proof, race-condition-proof, well-audited command!
 */
