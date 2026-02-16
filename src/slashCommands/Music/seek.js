const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const { convertTime } = require('../../utils/convert.js');
const ms = require('ms');
const safeReply = require('../../utils/safeReply');
const musicChecks = require('../../utils/musicChecks');

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
    name: "seek",
    description: "Seek to a specific time in a song",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    djonly :true,
    wl : true,
    options: [
      {
        name: "time",
        description: "the time example 1m, 30s, 2h.",
        required: true,
        type: 3
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
        const cooldown = client.cooldownManager.check("seek", interaction.user.id);
        if (cooldown.onCooldown) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Cooldown active. Try again in ${cooldown.remaining()}ms`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        const timeStr = interaction.options.getString("time");
        const timeMs = ms(timeStr);

        // Validate time format
        if (!timeMs || isNaN(timeMs)) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Please specify a valid time ex: \`1h\`, \`30m\`, \`45s\`.`);
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
        const currentTrack = await client.playerController.getCurrentTrack(interaction.guildId);

        // Validate seek position against track duration
        if (currentTrack && currentTrack.duration && timeMs > currentTrack.duration) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Seek position exceeds track duration (${convertTime(currentTrack.duration)})`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        // Seek using player directly (seek is a player method)
        try {
          await player.seek(timeMs);

          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${ok} Seeked to \`${convertTime(timeMs)}\``);

          await safeReply.safeReply(interaction, { embeds: [embed] });

          // Set cooldown after success
          client.cooldownManager.set("seek", interaction.user.id, 1000);

          // Log the command
          client.logger.logCommand('seek', interaction.user.id, interaction.guildId, Date.now() - interaction.createdTimestamp, true);
        } catch (err) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Failed to seek: ${err && (err.message || err)}`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }
      });
    }
};

