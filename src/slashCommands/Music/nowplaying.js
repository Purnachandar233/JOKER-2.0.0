const { EmbedBuilder, CommandInteraction, Client } = require("discord.js");
const { createBar } = require('../../functions.js');
const safeReply = require('../../utils/safeReply');
const musicChecks = require('../../utils/musicChecks');

module.exports = {
    name: "nowplaying",
    description: "Show now playing song",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: false,
    wl : true,

    /**
     * 
     * @param {Client} client 
     * @param {CommandInteraction} interaction 
     */

    run: async (client, interaction) => {
      return await client.errorHandler.executeWithErrorHandling(interaction, async (interaction) => {
        await safeReply.safeDeferReply(interaction);

        let ok = client.emoji.ok;
        let no = client.emoji.no;

        // Check cooldown
        const cooldown = client.cooldownManager.check("nowplaying", interaction.user.id);
        if (cooldown.onCooldown) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Cooldown active. Try again in ${cooldown.remaining()}ms`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        // Run music checks
        const check = await musicChecks.runMusicChecks(client, interaction, {
          inVoiceChannel: true,
          botInVoiceChannel: true,
          sameChannel: false,
          requirePlayer: true,
          requireQueue: true
        });

        if (!check.valid) {
          return await safeReply.safeReply(interaction, { embeds: [check.embed] });
        }

        // Get current track using thread-safe controller
        const currentTrack = await client.playerController.getCurrentTrack(interaction.guildId);
        const queue = await client.playerController.getQueue(interaction.guildId);

        if (!currentTrack) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} No track is currently playing.`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        const title = currentTrack?.info?.title || currentTrack?.title || 'Unknown Title';
        const author = currentTrack?.info?.author || currentTrack?.author || 'Unknown';
        const isStream = currentTrack?.info?.isStream || currentTrack?.isStream || false;
        const duration = currentTrack?.info?.duration || currentTrack?.duration || null;
        const durationStr = isStream ? '◉ LIVE' : (duration ? new Date(duration).toISOString().slice(11, 19) : 'Unknown');
        const queueSize = queue ? queue.length : 0;

        const embed = new EmbedBuilder()
          .setTitle("Now playing")
          .addFields(
            { name: 'Song', value: `[${title}](https://discord.gg)`, inline: true },
            { name: 'Song By', value: `[ ${author} ]`, inline: true },
            { name: 'Duration', value: `[ \`${durationStr}\` ]`, inline: true },
            { name: `Queue length:`, value: `${queueSize} Songs`, inline: true },
            { name: `⏳ Progress:`, value: createBar(check.player) }
          )
          .setColor(interaction.client?.embedColor || '#ff0051');

        await safeReply.safeReply(interaction, { embeds: [embed] });

        // Set cooldown after success
        client.cooldownManager.set("nowplaying", interaction.user.id, 1000);

        // Log the command
        client.logger.logCommand('nowplaying', interaction.user.id, interaction.guildId, Date.now() - interaction.createdTimestamp, true);
      });
    }
};

