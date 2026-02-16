const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const safeReply = require('../../utils/safeReply');
const musicChecks = require('../../utils/musicChecks');
const safePlayer = require('../../utils/safePlayer');

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
    name: "skipto",
    description: "Skips to a certain track.",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    djonly: true,
    wl: true,
    options: [
      {
        name: "number",
        description: "Number of song in queue",
        required: true,
        type: 4
      }
    ],

    /**
     * @param {Client} client
     * @param {CommandInteraction} interaction
     */

    run: async (client, interaction) => {
      return await client.errorHandler.executeWithErrorHandling(interaction, async (interaction) => {
        await safeReply.safeDeferReply(interaction);

        let ok = EMOJIS.ok;
        let no = EMOJIS.no;

        // Check cooldown
        const cooldown = client.cooldownManager.check("skipto", interaction.user.id);
        if (cooldown.onCooldown) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Cooldown active. Try again in ${cooldown.remaining()}ms`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        const position = interaction.options.getNumber("number");

        // Validate position is positive
        if (position < 1) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Track number must be at least 1.`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        // Run music checks
        const check = await musicChecks.runMusicChecks(client, interaction, {
          inVoiceChannel: true,
          botInVoiceChannel: true,
          sameChannel: true,
          requirePlayer: true,
          requireQueue: true
        });

        if (!check.valid) {
          return await safeReply.safeReply(interaction, { embeds: [check.embed] });
        }

        const player = check.player;
        const queueSize = safePlayer.queueSize(player);

        // Validate position is within queue bounds
        if (position > queueSize) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Track not found. Queue has only **${queueSize}** track(s).`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        try {
          // Remove all tracks before the target position
          safePlayer.queueRemove(player, 0, position - 1);

          // Stop playback to advance to the new first track
          await safePlayer.safeStop(player);

          const embed = new EmbedBuilder()
            .setDescription(`${ok} Skipped to track **${position}**.`)
            .setColor(interaction.client.embedColor);

          await safeReply.safeReply(interaction, { embeds: [embed] });

          // Set cooldown after success
          client.cooldownManager.set("skipto", interaction.user.id, 1000);

          // Log the command
          client.logger.logCommand('skipto', interaction.user.id, interaction.guildId, Date.now() - interaction.createdTimestamp, true);
        } catch (err) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Failed to skip to track: ${err && (err.message || err)}`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }
      });
    }
};

